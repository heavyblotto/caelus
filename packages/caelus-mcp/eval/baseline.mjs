#!/usr/bin/env node
/**
 * Run the live tool-selection eval and commit the result as a dated baseline.
 *
 * The eval was built to answer one question -- do hosts pick the right tool
 * with the right args? -- and that question is unmeasured until a scored run
 * is committed. Per-run report.json/report.md stay gitignored scratch; this
 * wrapper snapshots them into eval/baselines/<date>-<model>.{json,md}, which
 * ARE committed and become the number the docs quote.
 *
 * Usage (needs a model key; see run.mjs):
 *   EVAL_MODEL=anthropic:claude-sonnet-5 ANTHROPIC_API_KEY=... \
 *     node packages/caelus-mcp/eval/baseline.mjs
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const model = process.env.EVAL_MODEL;
if (!model) {
  console.error(
    "eval baseline needs a live model run: set EVAL_MODEL (e.g. "
    + "anthropic:claude-sonnet-5) and the provider's API key. "
    + "The self-check mode cannot produce a baseline -- it never calls a model.",
  );
  process.exit(1);
}

execFileSync(process.execPath, [join(here, "run.mjs")], {
  stdio: "inherit", env: process.env,
});

const report = JSON.parse(readFileSync(join(here, "report.json"), "utf8"));
const date = new Date().toISOString().slice(0, 10);
const slug = model.replace(/[^a-z0-9.-]+/gi, "-");
const dir = join(here, "baselines");
mkdirSync(dir, { recursive: true });
copyFileSync(join(here, "report.json"), join(dir, `${date}-${slug}.json`));
copyFileSync(join(here, "report.md"), join(dir, `${date}-${slug}.md`));
console.log(
  `baseline written: eval/baselines/${date}-${slug}.{json,md} `
  + `(accuracy ${JSON.stringify(report.agg?.accuracy ?? report.agg)}) -- commit it`,
);
