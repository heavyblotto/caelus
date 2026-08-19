// Validate one written slice against its brief + the corpus lints.
// Usage: node check-slice.mjs <brief.json> <slice.json>
import { readFileSync } from "node:fs";
import {
  lintPassage, lintDuplication, lintSharedSentences, lintSkeletons,
  lintNearDuplicateSentences, lintFormulaClusters,
} from "../dist/src/lint.js";

const [briefPath, slicePath] = process.argv.slice(2);
const brief = JSON.parse(readFileSync(briefPath, "utf8"));
const slice = JSON.parse(readFileSync(slicePath, "utf8"));

let bad = 0;
const fail = (m) => { console.error(`FAIL: ${m}`); bad++; };

const byId = new Map(brief.cells.map((c) => [c.id, c]));
if (slice.length !== brief.cells.length) fail(`expected ${brief.cells.length} entries, got ${slice.length}`);
const seen = new Set();
for (const p of slice) {
  if (seen.has(p.id)) fail(`${p.id}: duplicate id`);
  seen.add(p.id);
  const cell = byId.get(p.id);
  if (!cell) { fail(`${p.id}: not in brief`); continue; }
  if (p.family !== cell.family) fail(`${p.id}: family mismatch`);
  if (JSON.stringify(p.when) !== JSON.stringify(cell.when)) fail(`${p.id}: when differs from brief`);
  if (JSON.stringify(p.atomIds) !== JSON.stringify(cell.atomIds)) fail(`${p.id}: atomIds differ from brief`);
  if (typeof p.text !== "string" || !p.text.trim()) fail(`${p.id}: empty text`);
  for (const f of lintPassage(p)) fail(`${p.id} [${f.rule}] ${f.detail}`);
}
for (const c of brief.cells) if (!seen.has(c.id)) fail(`missing entry: ${c.id}`);
for (const f of lintDuplication(slice)) fail(`[duplication] ${f.id}: ${f.detail}`);
// The ratio lint above cannot see a single shared sentence or a shared
// opening/closing formula; these two can, and they are where sibling
// essays written to one brief actually fail.
for (const f of lintSharedSentences(slice)) fail(`[shared-sentence] ${f.id}: ${f.detail}`);
for (const f of lintSkeletons(slice)) fail(`[skeleton] ${f.id}: ${f.detail}`);
for (const f of lintFormulaClusters(slice)) {
  fail(`[formula-cluster] ${f.id}: ${f.detail}`);
}
for (const f of lintNearDuplicateSentences(slice)) {
  fail(`[near-duplicate-sentence] ${f.id}: ${f.detail}`);
}

if (bad) { console.error(`\n${bad} problems`); process.exit(1); }
console.log(`slice ok: ${slice.length} entries pass brief match + lints`);
