// Snapshot the three open lint backlogs into `backlog/` as markdown worklists.
//
// The three lints below are writer-facing (check-slice, check-family) but not
// in `lintCorpus`, because they find real defects in already-shipped content.
// Committing their output means a reviewer can be handed a worklist without
// building anything, and means the backlog shrinking is visible in the diff.
//
// Run it after every repair wave:
//   node pipeline/report-backlog.mjs
//
// The per-file reports (report-near-dupes / report-cross-family /
// report-formulas) stay the interactive tools; this is the record.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  lintNearDuplicateSentences, lintCrossFamilyEchoes, lintFormulaClusters,
} from "../dist/src/lint.js";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "data", "passages");
const out = join(here, "..", "backlog");
mkdirSync(out, { recursive: true });

const all = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".json")) continue;
  const records = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (!Array.isArray(records)) continue;
  for (const p of records) all.push({ ...p, file: f });
}
const owner = new Map(all.map((p) => [p.id, p.file]));
const byFamily = new Map();
for (const p of all) {
  const list = byFamily.get(p.family) ?? [];
  list.push(p);
  byFamily.set(p.family, list);
}

/** Count distinct entry pairs. A collision is reported against both of its
 *  entries, so raw findings double count; the pair count is the number of
 *  repairs actually owed. */
function collisions(findings) {
  const pairs = new Set();
  for (const f of findings) {
    const other = /(?:from|as) ([\w:~.-]+):/.exec(f.detail)?.[1];
    if (other) pairs.add([f.id, other].sort().join(" | "));
  }
  return pairs.size;
}

/** Render one report to markdown: family summary, per-file worklist, findings. */
function render({ title, intro, howToFix, findings, unit, paired = true }) {
  const perFamily = new Map();
  const perFile = new Map();
  for (const f of findings) {
    perFamily.set(f.family, (perFamily.get(f.family) ?? 0) + 1);
    perFile.set(f.file, (perFile.get(f.file) ?? 0) + 1);
  }
  const L = [`# ${title}`, "", intro, "", "## How to clear it", "", howToFix, ""];

  L.push(paired
    ? `**${findings.length} ${unit} across the corpus, `
      + `${collisions(findings)} distinct collisions.** Each collision is `
      + `reported against both of its entries, so the collision count is the `
      + `number of repairs owed.`
    : `**${findings.length} ${unit} across the corpus.**`, "");
  L.push("## By family", "", "| family | entries | findings |", "|---|---|---|");
  for (const [fam, n] of [...perFamily].sort((a, b) => b[1] - a[1])) {
    L.push(`| ${fam} | ${byFamily.get(fam)?.length ?? "?"} | ${n} |`);
  }
  L.push("", "## By file — this is the worklist", "",
    "One reviewer per file, or per group of files sharing a first body.",
    "Edit only the files in your own scope; when a finding names an entry in",
    "someone else's file, fix your side and leave theirs.", "",
    "| file | findings |", "|---|---|");
  for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1])) {
    L.push(`| \`${file}\` | ${n} |`);
  }
  L.push("", "## Findings", "");
  let current = "";
  for (const f of findings.sort((a, b) => a.file.localeCompare(b.file))) {
    if (f.file !== current) { current = f.file; L.push("", `### ${f.file}`, ""); }
    L.push(`- **${f.id}** — ${f.detail}`);
  }
  return L.join("\n") + "\n";
}

const tag = (family) => (f) => ({ ...f, family, file: owner.get(f.id) ?? "?" });

// 1. Near-duplicate sentences.
const nearDupes = [];
for (const [family, list] of [...byFamily].sort()) {
  nearDupes.push(...lintNearDuplicateSentences(list).map(tag(family)));
}
writeFileSync(join(out, "near-duplicates.md"), render({
  title: "Backlog — near-duplicate sentences",
  unit: "findings",
  intro:
    "Two sentences that are the same sentence with a word swapped, scored by\n"
    + "longest common subsequence over words. Order-aware, because the defect is\n"
    + "a reused sentence *shape*: a synonym does not save it.",
  howToFix:
    "**Make a different move, not another word swap.** Two sentences at 79%\n"
    + "pass the lint and still read as a template. If both say the same true\n"
    + "thing about different geometry, one of them has drifted off its own cell;\n"
    + "fix that one and it stops being generic.",
  findings: nearDupes,
}));

// 2. Cross-family echoes.
const echoes = lintCrossFamilyEchoes(all).map((f) => ({
  ...f, file: owner.get(f.id) ?? "?",
  family: all.find((p) => p.id === f.id)?.family ?? "?",
}));
writeFileSync(join(out, "cross-family-echoes.md"), render({
  title: "Backlog — cross-family echoes",
  unit: "findings",
  intro:
    "A body's essays compared across the families a reader meets **on one\n"
    + "surface**. A reading puts a body's sign essay, its house essay and its\n"
    + "aspect essays in one column, so an echo between those is invisible to\n"
    + "every family-scoped lint and obvious to the reader.",
  howToFix:
    "Repair on your side, and remember what the two cells actually know: a\n"
    + "sign essay may not claim a house, a house essay may not claim a sign, an\n"
    + "aspect essay may claim neither. The echo usually means one of them\n"
    + "borrowed a claim it has no standing to make.",
  findings: echoes,
}));

// 3. Formula clusters.
const formulas = [];
for (const [family, list] of [...byFamily].sort()) {
  formulas.push(...lintFormulaClusters(list).map(tag(family)));
}
writeFileSync(join(out, "formula-clusters.md"), render({
  title: "Backlog — formula clusters",
  unit: "findings",
  intro:
    "A rhetorical *move* a family has converged on, where no two instances are\n"
    + "near-duplicates: nine essays opening \"What you give them is X\", eleven\n"
    + "closing on a hedge, a whole slice of sextiles explaining that the failure\n"
    + "mode is disuse. The lint links sentences at a lower bar than a\n"
    + "near-duplicate and reports the connected component, so a finding tells\n"
    + "you your sentence is one of nine.\n\n"
    + "This is the one that needs the most judgement, and the one no reviewer\n"
    + "found reliably by eye.",
  howToFix:
    "**Break the set up, do not reword one member of it.** Where the move is\n"
    + "doing real work, keep it in the entries where it bears hardest and cut it\n"
    + "from the rest. Where it is scaffolding, cut it everywhere.",
  findings: formulas,
  paired: false,
}));

console.log(`near-duplicates.md      ${nearDupes.length} findings`);
console.log(`cross-family-echoes.md  ${echoes.length} findings`);
console.log(`formula-clusters.md     ${formulas.length} findings`);
console.log(`\nwritten to ${out}`);
