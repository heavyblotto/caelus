// Report the near-duplicate-sentence backlog across the whole corpus.
//
// `lintNearDuplicateSentences` runs writer-facing (check-slice, check-family)
// and gates in `lintCorpus` since the backlogs reached zero (2026-08-19).
// This script is how a review pass gets its worklist: it runs the lint
// per family over every passage file and reports findings grouped by the file
// that owns the entry, so a reviewer agent can be handed exactly its own.
//
// Usage:
//   node report-near-dupes.mjs                  # per-family + per-file counts
//   node report-near-dupes.mjs <family>         # every finding in one family
//   node report-near-dupes.mjs --file <name>    # every finding owned by a file
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintNearDuplicateSentences } from "../dist/src/lint.js";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "data", "passages");

const args = process.argv.slice(2);
const fileMode = args[0] === "--file";
let filter = fileMode ? args[1] : args[0];
if (fileMode) {
  // Accept a bare name, a name without .json, or a path: a reviewer copying
  // the command from a wave sheet types whichever they have to hand, and a
  // filter that matched nothing used to print "0 findings", which reads
  // exactly like a clean file.
  filter = basename(filter ?? "");
  if (!filter.endsWith(".json")) filter += ".json";
}

/** Every passage on disk, tagged with the file it came from. */
const all = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".json")) continue;
  const records = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (!Array.isArray(records)) continue;
  for (const p of records) all.push({ ...p, file: f });
}

const owner = new Map(all.map((p) => [p.id, p.file]));

// A filter naming no file on disk is a typo, not a clean result. Reporting it
// as "0 findings" is the worst possible failure here: a reviewer reads it as
// a clean slice and ships the collisions the report exists to find.
if (fileMode && !all.some((p) => p.file === filter)) {
  console.error(`no passage file named ${filter} in ${dir}`);
  process.exit(2);
}

const byFamily = new Map();
for (const p of all) {
  const list = byFamily.get(p.family) ?? [];
  list.push(p);
  byFamily.set(p.family, list);
}

// A finding is reported against both entries, so counting raw findings double
// counts every collision. Count each (family, id-pair) once for the totals and
// keep the per-file view one row per finding, which is what a reviewer fixes.
const perFamily = new Map();
const perFile = new Map();
const details = [];

for (const [family, list] of [...byFamily].sort()) {
  const findings = lintNearDuplicateSentences(list);
  const pairs = new Set();
  for (const f of findings) {
    const other = /as ([\w:~.-]+):/.exec(f.detail)?.[1];
    pairs.add([f.id, other].sort().join(" | "));
    const file = owner.get(f.id) ?? "?";
    perFile.set(file, (perFile.get(file) ?? 0) + 1);
    details.push({ family, file, ...f, otherFile: owner.get(other) ?? "?" });
  }
  perFamily.set(family, { entries: list.length, pairs: pairs.size,
    findings: findings.length });
}

if (filter) {
  const rows = details.filter((d) =>
    fileMode ? d.file === filter || d.file === `${filter}.json` : d.family === filter);
  for (const d of rows) {
    console.log(`[${d.file} -> ${d.otherFile}] ${d.detail}`);
  }
  console.log(`\n${rows.length} findings`);
} else {
  console.log("family                 entries  collisions  findings");
  let total = 0;
  for (const [family, s] of [...perFamily].sort((a, b) => b[1].pairs - a[1].pairs)) {
    if (s.findings === 0) continue;
    total += s.pairs;
    console.log(`${family.padEnd(22)} ${String(s.entries).padStart(7)} `
      + `${String(s.pairs).padStart(11)} ${String(s.findings).padStart(9)}`);
  }
  console.log(`\n${total} collisions across the corpus\n`);
  console.log("file                                    findings");
  for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1])) {
    console.log(`${file.padEnd(40)} ${String(n).padStart(8)}`);
  }
}
