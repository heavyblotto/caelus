// Report the formula clusters: a rhetorical move a family has converged on,
// where no two instances are near-duplicates. See `lintFormulaClusters`.
//
//   node report-formulas.mjs                  # cluster counts per family
//   node report-formulas.mjs <family>         # every cluster in one family
//   node report-formulas.mjs --file <name>    # findings owned by one file
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintFormulaClusters } from "../dist/src/lint.js";

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

const all = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".json")) continue;
  const rs = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (!Array.isArray(rs)) continue;
  for (const p of rs) all.push({ ...p, file: f });
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
  const l = byFamily.get(p.family) ?? [];
  l.push(p);
  byFamily.set(p.family, l);
}

const perFamily = [];
const rows = [];
for (const [family, list] of [...byFamily].sort()) {
  const findings = lintFormulaClusters(list);
  if (!findings.length) continue;
  // Group findings back into their clusters by the reported cluster size and
  // the co-cited ids, which is how a reviewer wants to read them.
  const clusters = new Set();
  for (const f of findings) {
    const size = /one of (\d+) entries/.exec(f.detail)?.[1] ?? "?";
    const also = /also ([^)]*)/.exec(f.detail)?.[1] ?? "";
    clusters.add(`${size}|${[f.id, ...also.split(", ")].sort().slice(0, 2).join()}`);
  }
  perFamily.push([family, list.length, findings.length, clusters.size]);
  for (const f of findings) rows.push({ family, file: owner.get(f.id), ...f });
}

if (filter) {
  const sel = rows.filter((r) => (fileMode
    ? r.file === filter || r.file === `${filter}.json`
    : r.family === filter));
  for (const r of sel) console.log(`[${r.file}] ${r.id}: ${r.detail}`);
  console.log(`\n${sel.length} findings`);
} else {
  console.log("family                 entries  findings  clusters");
  for (const [f, n, k, c] of perFamily.sort((a, b) => b[2] - a[2])) {
    console.log(`${f.padEnd(22)} ${String(n).padStart(7)} ${String(k).padStart(9)} `
      + `${String(c).padStart(9)}`);
  }
  const perFile = new Map();
  for (const r of rows) perFile.set(r.file, (perFile.get(r.file) ?? 0) + 1);
  console.log("\nfile                                    findings");
  for (const [f, n] of [...perFile].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`${f.padEnd(40)} ${String(n).padStart(8)}`);
  }
}
