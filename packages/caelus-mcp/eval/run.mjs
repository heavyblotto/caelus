/**
 * MCP tool-selection eval orchestrator.
 *
 * Two modes:
 *
 *   CI / self-check (default, no model, no keys):
 *     node eval/run.mjs
 *   Spawns the real server, pulls each tool's live JSON Schema via
 *   client.listTools(), and validates each fixture's *expected* args against
 *   that schema with ajv. Also runs each fixture's expect block through
 *   score.mjs to prove the predicates fire and the fixtures are internally
 *   consistent (right tool name exists, expected args satisfy their own
 *   argChecks). This needs no API keys and is safe to gate in CI. It does NOT
 *   call any model.
 *
 *   Live model run (opt-in, needs a key in the environment):
 *     EVAL_MODEL=anthropic:claude-... ANTHROPIC_API_KEY=... node eval/run.mjs
 *   For each fixture, calls the configured model in tool-use mode with the
 *   live Caelus tools, captures {tool, args}, scores it, and writes a report.
 *   Model calls are behind the EVAL_MODEL flag and the adapter reads keys from
 *   the environment only. NO keys are read from disk or committed anywhere.
 *
 * Adapters are pluggable: add a `callModel` under MODEL_ADAPTERS keyed by the
 * provider prefix of EVAL_MODEL. Each adapter receives (tools, prompt) and
 * returns { tool, args } | { tool: null } (no tool call).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Ajv from "ajv";
import { scoreFixture, aggregate, renderMarkdown, ARG_CHECKS } from "./score.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = fileURLToPath(new URL("../dist/src/server.js", import.meta.url));

function loadFixtures() {
  const raw = readFileSync(join(here, "prompts.jsonl"), "utf8").trim();
  return raw.split("\n").filter(Boolean).map((l, i) => {
    try {
      return JSON.parse(l);
    } catch (e) {
      throw new Error(`prompts.jsonl line ${i + 1}: ${e.message}`);
    }
  });
}

// Strip {approx,tol} fixture sentinels down to concrete values so the expected
// args can be schema-validated and predicate-checked as if a model produced them.
function materialize(args) {
  if (Array.isArray(args)) return args.map(materialize);
  if (args && typeof args === "object") {
    if ("approx" in args) return args.approx;
    const out = {};
    for (const [k, v] of Object.entries(args)) {
      if (v === "now") continue; // a defaulted/now date contributes no concrete value
      out[k] = materialize(v);
    }
    return out;
  }
  return args;
}

async function connect() {
  const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
  const client = new Client({ name: "eval", version: "0.0.1" });
  await client.connect(transport);
  return client;
}

// --------------------------------------------------------- model adapters
// Each adapter: async (tools, prompt) => { tool: string|null, args: object }
// tools is the listTools() array (name, description, inputSchema as JSON Schema).
const MODEL_ADAPTERS = {
  // Anthropic Messages API with tool use. Reads ANTHROPIC_API_KEY from env only.
  async anthropic(tools, prompt, model) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    const body = {
      model,
      max_tokens: 1024,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
      messages: [{ role: "user", content: prompt }],
    };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const use = (data.content ?? []).find((b) => b.type === "tool_use");
    return use ? { tool: use.name, args: use.input ?? {} } : { tool: null, args: {} };
  },

  // OpenAI chat completions with tools. Reads OPENAI_API_KEY from env only.
  async openai(tools, prompt, model) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const body = {
      model,
      messages: [{ role: "user", content: prompt }],
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      })),
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return { tool: null, args: {} };
    return { tool: call.function.name, args: JSON.parse(call.function.arguments || "{}") };
  },
};

function resolveAdapter() {
  const spec = process.env.EVAL_MODEL;
  if (!spec) return null; // CI / self-check mode
  const idx = spec.indexOf(":");
  const provider = idx === -1 ? spec : spec.slice(0, idx);
  const model = idx === -1 ? "" : spec.slice(idx + 1);
  const fn = MODEL_ADAPTERS[provider];
  if (!fn) throw new Error(`unknown model provider "${provider}"; have ${Object.keys(MODEL_ADAPTERS).join(", ")}`);
  if (!model) throw new Error(`EVAL_MODEL must be "<provider>:<model>", got "${spec}"`);
  return { provider, model, callModel: (tools, prompt) => fn(tools, prompt, model) };
}

async function main() {
  const fixtures = loadFixtures();
  const client = await connect();
  const { tools } = await client.listTools();
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const ajv = new Ajv({ strict: false, allErrors: true });
  const validators = new Map();
  for (const t of tools) validators.set(t.name, ajv.compile(t.inputSchema));

  const adapter = resolveAdapter();
  const live = adapter !== null;

  // ----- self-consistency pass (always): every fixture's expectations sane.
  let selfFailures = 0;
  for (const f of fixtures) {
    const accepted = Array.isArray(f.expect.tool) ? f.expect.tool : [f.expect.tool];
    for (const name of accepted) {
      if (name !== null && !toolByName.has(name)) {
        selfFailures++;
        console.error(`SELF-FAIL ${f.id}: expects unknown tool "${name}"`);
      }
    }
    for (const name of f.expect.argChecks ?? []) {
      if (!ARG_CHECKS[name]) {
        selfFailures++;
        console.error(`SELF-FAIL ${f.id}: unknown argCheck "${name}"`);
      }
    }
    // The fixture's own expected args, materialized, must be schema-valid for
    // the single-tool happy cases (skip ambiguous multi-tool / null and the
    // deliberate engineError cases, whose args are valid-shape but the call
    // errors at runtime, not at the schema).
    const single = typeof f.expect.tool === "string" ? f.expect.tool : null;
    if (single && f.expect.args && Object.keys(f.expect.args).length) {
      const validate = validators.get(single);
      const concrete = materialize(f.expect.args);
      if (!validate(concrete)) {
        selfFailures++;
        console.error(`SELF-FAIL ${f.id}: expected args fail ${single} schema: ${ajv.errorsText(validate.errors)}`);
      }
      // And the materialized expected args must satisfy the fixture's own predicates.
      const verdict = scoreFixture(f, { tool: single, args: concrete }, true);
      for (const [pname, pres] of Object.entries(verdict.arg_checks)) {
        if (pres.applicable && !pres.pass) {
          selfFailures++;
          console.error(`SELF-FAIL ${f.id}: own expected args fail predicate "${pname}"`);
        }
      }
    }
  }

  if (!live) {
    await client.close();
    console.log(`\nself-check: ${fixtures.length} fixtures, ${selfFailures} failures`);
    if (process.env.CAELUS_STATS_OUT) {
      writeFileSync(process.env.CAELUS_STATS_OUT, JSON.stringify({
        suite: "mcp-eval-selfcheck",
        fixtures: fixtures.length,
        failures: selfFailures,
        live: false,
        generatedAt: new Date().toISOString(),
      }, null, 2) + "\n");
    }
    process.exit(selfFailures ? 1 : 0);
  }

  if (selfFailures) {
    await client.close();
    console.error(`\naborting live run: ${selfFailures} self-check failures`);
    process.exit(1);
  }

  // ----- live model run -----
  console.error(`Running ${fixtures.length} fixtures against ${adapter.provider}:${adapter.model}`);
  const results = [];
  for (const f of fixtures) {
    let observed;
    try {
      observed = await adapter.callModel(tools, f.prompt);
    } catch (e) {
      console.error(`model error on ${f.id}: ${e.message}`);
      observed = { tool: null, args: {}, error: e.message };
    }
    let schemaValid = null;
    if (observed.tool && validators.has(observed.tool)) {
      schemaValid = validators.get(observed.tool)(observed.args ?? {});
    }
    results.push(scoreFixture(f, observed, schemaValid));
  }
  await client.close();

  const agg = aggregate(results);
  writeFileSync(join(here, "report.json"), JSON.stringify({ model: `${adapter.provider}:${adapter.model}`, agg, results }, null, 2) + "\n");
  writeFileSync(join(here, "report.md"), renderMarkdown(agg, results));
  console.log(renderMarkdown(agg, results));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
