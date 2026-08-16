#!/usr/bin/env node
// Assert the docs still describe the engine the code actually ships.
//
// The atom `kind` union is written out by hand in two places besides the
// source: the architecture note and the public docs page. Both drifted
// silently across releases -- `parallel` and `outOfBounds` shipped in
// 0.24 and neither doc ever learned them, and the M3 batch added five
// more. Nothing caught it, because nothing looked.
//
// This is the same shape of guard as check-versions (npm x PyPI x
// server.json) and check-tarball (advertised packs x the tarball): a
// claim the docs make, checked against the artifact that makes it true.
// Run in `preflight` and CI, so a new fact kind fails here instead of
// being discovered months later by a reader.
import { readFileSync } from "node:fs";

let bad = 0;
const fail = (m) => { console.error(`FAIL: ${m}`); bad++; };

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");

// --- the source of truth: the FactKind union
const src = read("packages/caelus/src/interpretation.ts");
const union = src.match(/export type FactKind =([\s\S]*?);/);
if (!union) {
  fail("could not find `export type FactKind` in interpretation.ts");
  process.exit(1);
}
const kinds = [...union[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);

// --- every doc that writes the union out by hand
const DOCS = [
  "docs/interpretation-layer.md",
  "apps/web/app/docs/interpretation/page.mdx",
];

for (const path of DOCS) {
  const doc = read(path);
  // `kind` -- `a | b | c`  /  **`kind`**: `a | b | c`
  const m = doc.match(/`kind`\**\s*(?:--|—|:)\s*`([^`]+)`/);
  if (!m) {
    fail(`${path}: no \`kind\` union found (did the wording change? update this check)`);
    continue;
  }
  const documented = m[1].split("|").map((s) => s.trim()).filter(Boolean);
  const missing = kinds.filter((k) => !documented.includes(k));
  const extra = documented.filter((k) => !kinds.includes(k));
  if (missing.length) fail(`${path}: undocumented fact kinds: ${missing.join(", ")}`);
  if (extra.length) fail(`${path}: documents kinds the engine does not emit: ${extra.join(", ")}`);
}

// --- every selector should be findable in the docs by name; a new
// selector with no prose is a feature nobody can discover.
const interpret = read("packages/caelus/src/interpret.ts");
const selectors = [...interpret.matchAll(/export function (has[A-Za-z]+)\(/g)]
  .map((m) => m[1]);
const allDocs = DOCS.map(read).join("\n");
const undocumented = selectors.filter((s) => !allDocs.includes(s));
if (undocumented.length) {
  fail(`selectors with no mention in the docs: ${undocumented.join(", ")}`);
}

if (bad) {
  console.error(`\n${bad} doc/code mismatch${bad === 1 ? "" : "es"}`);
  process.exit(1);
}
console.log(
  `docs check passed — ${kinds.length} fact kinds and ${selectors.length} selectors `
  + `documented in ${DOCS.length} places`,
);
