#!/usr/bin/env node
/**
 * Runs every docs example a guide marks runnable, without a browser.
 *
 * A code block flagged `run` (```ts run, or <CodeBlock run … />) gets a Run
 * control on the site that executes it in the reader's browser. This test
 * extracts those blocks from the MDX sources and executes each one in Node
 * against the built engine, through the same code the browser worker uses
 * (apps/web/lib/runnable-core.mjs): the same import rewriting, the same module
 * table, the same cumulative scoping, where block N runs after blocks 0..N-1
 * of its page. It fails if any block throws, imports a module the runner does
 * not provide, or runs past the page's time limit, so a guide example cannot
 * rot while the site still builds.
 *
 * It needs `caelus` built (npm run build -w caelus).
 *
 * Usage:
 *   node scripts/test-docs-examples.mjs            # every guide
 *   node scripts/test-docs-examples.mjs --show     # also print each block's result
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execute, extractRunnable, formatValue } from "../apps/web/lib/runnable-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "apps", "web", "app", "docs");
const SHOW = process.argv.includes("--show");
/**
 * The browser stops a run at 15 s (RUN_TIME_LIMIT_MS in runnable-client.ts).
 * This limit is lower so a reader's slower machine keeps some headroom, and
 * high enough that a loaded CI runner does not trip it: the slowest example
 * takes about 1.5 s on a laptop.
 */
const TIME_LIMIT_MS = 10_000;

let caelus, dataEmbedded;
try {
  caelus = await import("caelus");
  dataEmbedded = await import("caelus/data-embedded");
} catch (err) {
  console.error(`test-docs-examples: cannot load the engine (${err.message}). Run \`npm run build -w caelus\` first.`);
  process.exit(1);
}
const MODULES = { caelus, "caelus/data-embedded": dataEmbedded };

function findGuides(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findGuides(full, out);
    else if (name === "page.mdx") out.push(full);
  }
  return out.sort();
}

let blocksRun = 0;
let guidesWithBlocks = 0;
let failures = 0;

for (const file of findGuides(DOCS)) {
  const blocks = extractRunnable(readFileSync(file, "utf8"));
  if (blocks.length === 0) continue;
  guidesWithBlocks++;
  const rel = relative(ROOT, file);
  console.log(`\n== ${rel} (${blocks.length} runnable)`);

  for (let i = 0; i < blocks.length; i++) {
    const where = `${rel}:${blocks[i].line}`;
    const started = performance.now();
    try {
      const { value, logs } = execute(blocks.slice(0, i + 1).map((b) => b.code), MODULES);
      const settled = await value;
      const ms = Math.round(performance.now() - started);
      blocksRun++;
      if (ms > TIME_LIMIT_MS) {
        failures++;
        console.error(`  FAIL ${where} took ${ms} ms; the page stops a run at 15 s and readers have slower machines`);
        continue;
      }
      const shown = settled === undefined ? "no value" : formatValue(settled);
      console.log(`  ok   ${where} (${ms} ms) ${SHOW ? "" : shown.split("\n")[0].slice(0, 70)}`);
      if (SHOW) console.log([...logs, shown].join("\n").replace(/^/gm, "       "));
    } catch (err) {
      failures++;
      console.error(`  FAIL ${where} threw ${err.name}: ${err.message}`);
    }
  }
}

console.log(`\ntest-docs-examples: ${blocksRun} blocks in ${guidesWithBlocks} guides, ${failures} failures`);
if (blocksRun === 0) {
  console.error("test-docs-examples: no runnable blocks found; the extraction is broken or the flags were removed");
  process.exit(1);
}
process.exit(failures ? 1 : 0);
