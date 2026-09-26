#!/usr/bin/env node
// Hosted GET /api/mcp must advertise the same tools, resource URIs, and
// prompts that packages/caelus-mcp/src/server.ts registers. The GET TOOLS
// array sat at 22 names after the server grew to 35; lint:claims only
// gated the count in prose. This script compares the two lists.
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");

let bad = 0;
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  bad++;
};

const server = read("packages/caelus-mcp/src/server.ts");
const route = read("apps/web/app/api/mcp/route.ts");
const dataTiers = read("apps/web/app/docs/data-tiers/page.mdx");
const chartRoute = read("apps/web/app/api/chart/route.ts");

function uniqSorted(xs) {
  return [...new Set(xs)].sort();
}

function same(label, expected, actual) {
  const a = uniqSorted(expected);
  const b = uniqSorted(actual);
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    fail(
      `${label}: server [${a.join(", ")}] vs hosted GET [${b.join(", ")}]`,
    );
  }
}

const tools = [...server.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map((m) => m[1]);
if (!tools.length) fail("no registerTool calls in server.ts");

const CONST_URIS = Object.fromEntries(
  [...server.matchAll(/const\s+([A-Z_]+)\s*=\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);

const resourceUris = [...server.matchAll(
  /server\.registerResource\(\s*"[^"]+"\s*,\s*(?:"([^"]+)"|([A-Z_]+))/g,
)].map((m) => m[1] ?? CONST_URIS[m[2]]).filter(Boolean);
if (!resourceUris.length) fail("no registerResource URIs in server.ts");

const prompts = [...server.matchAll(/server\.registerPrompt\(\s*"([^"]+)"/g)].map((m) => m[1]);
if (!prompts.length) fail("no registerPrompt calls in server.ts");

const toolsBlock = route.match(/const TOOLS = \[([\s\S]*?)\]/);
const routeTools = toolsBlock
  ? [...toolsBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];
if (!routeTools.length) fail("no TOOLS array in apps/web/app/api/mcp/route.ts");

const routeResources = [...(route.match(/resources:\s*\[([\s\S]*?)\]/)?.[1] ?? "")
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const routePrompts = [...(route.match(/prompts:\s*\[([\s\S]*?)\]/)?.[1] ?? "")
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]);

same("tools", tools, routeTools);
same("resources", resourceUris, routeResources);
same("prompts", prompts, routePrompts);

const yearLo = chartRoute.match(/y < (\d{4})/)?.[1];
const yearHi = chartRoute.match(/y > (\d{4})/)?.[1];
if (!yearLo || !yearHi) {
  fail("could not parse hosted REST year window from apps/web/app/api/chart/route.ts");
} else {
  const dash = `${yearLo}–${yearHi}`;
  const hyphen = `${yearLo}-${yearHi}`;
  if (!dataTiers.includes(dash) && !dataTiers.includes(hyphen)) {
    fail(
      `data-tiers REST window must include ${dash} (from /api/chart year gate ${yearLo}-${yearHi})`,
    );
  }
  if (!chartRoute.includes(`${yearLo}-${yearHi}`) && !chartRoute.includes(dash)) {
    fail(`chart route comment should name the ${yearLo}-${yearHi} embedded window`);
  }
}

if (bad) {
  console.error(`check-mcp-surface: ${bad} failure(s)`);
  process.exit(1);
}
console.log(
  `check-mcp-surface: ${tools.length} tools, ${resourceUris.length} resources, ${prompts.length} prompts; REST ${yearLo}-${yearHi}`,
);
