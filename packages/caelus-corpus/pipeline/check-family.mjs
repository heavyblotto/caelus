// Lint one written slice against every other shipped file in its family.
//
// check-slice.mjs lints a slice against itself, which is what a writer can
// see. But `lintCorpus` in the package test groups by *family* across the
// whole corpus, so two writers working in parallel can each pass their own
// check and still collide on a shared sentence or a shared opening formula.
// This script closes that gap: run it after check-slice and before merge.
//
// It also runs the cross-family pass, which needs the whole corpus rather
// than one family: a body's house essay and its sign essay live in different
// families and land in the same column of one Reading, so no family-scoped
// lint compares them and the reader sees the echo first.
//
// Usage: node check-family.mjs <slice.json> [more-slices.json ...]
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  lintDuplication, lintSharedSentences, lintSkeletons,
  lintNearDuplicateSentences, lintCrossFamilyEchoes, lintFormulaClusters,
} from "../dist/src/lint.js";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node check-family.mjs <slice.json> [...]");
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const dir = dirname(targets[0]);
const mine = new Set();
const family = new Set();
const all = [];
const corpus = []; // every family, for the cross-family pass

for (const t of targets) {
  const slice = read(t);
  for (const p of slice) {
    mine.add(p.id);
    family.add(p.family);
  }
}

// Every shipped file that carries one of the families under test.
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  const records = read(join(dir, f));
  if (!Array.isArray(records) || records.length === 0) continue;
  const isTarget = targets.some((t) => basename(t) === f);
  for (const p of records) {
    // A target file may already be on disk; take the caller's copy, not the
    // shipped one, so a repair in progress is what gets checked.
    if (isTarget && mine.has(p.id)) continue;
    corpus.push({ ...p, file: f });
    if (family.has(records[0].family)) all.push({ ...p, file: f });
  }
}
for (const t of targets) {
  for (const p of read(t)) {
    if (!all.some((x) => x.id === p.id)) all.push({ ...p, file: basename(t) });
    if (!corpus.some((x) => x.id === p.id)) corpus.push({ ...p, file: basename(t) });
  }
}

let bad = 0;
const report = (rule, f) => {
  // Only findings that name one of the slice's own entries are the writer's
  // to fix; the rest belong to whoever owns that file.
  const own = mine.has(f.id);
  console[own ? "error" : "log"](
    `${own ? "FAIL" : "note"}: [${rule}] ${f.id}: ${f.detail}`,
  );
  if (own) bad++;
};

const byFamily = new Map();
for (const p of all) {
  const list = byFamily.get(p.family) ?? [];
  list.push(p);
  byFamily.set(p.family, list);
}
for (const [fam, list] of byFamily) {
  console.log(`${fam}: ${list.length} entries across the family`);
  for (const f of lintDuplication(list)) report("duplication", f);
  for (const f of lintSharedSentences(list)) report("shared-sentence", f);
  for (const f of lintSkeletons(list)) report("skeleton", f);
  for (const f of lintNearDuplicateSentences(list)) {
    report("near-duplicate-sentence", f);
  }
  for (const f of lintFormulaClusters(list)) report("formula-cluster", f);
}

console.log(`cross-family: ${corpus.length} entries across the corpus`);
for (const f of lintCrossFamilyEchoes(corpus)) report("cross-family-echo", f);

if (bad) {
  console.error(`\n${bad} problems in your slice`);
  process.exit(1);
}
console.log(`family ok: ${mine.size} entries clean against the whole family`);
