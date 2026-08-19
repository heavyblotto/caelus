// Report the cross-family echo backlog: essays in different families that a
// reader meets on one surface and that have converged on the same sentence.
//
// See `lintCrossFamilyEchoes` in src/lint.ts for why the family lints cannot
// see these. Same usage shape as report-near-dupes.mjs.
//
//   node report-cross-family.mjs                # counts per family pair and file
//   node report-cross-family.mjs --file <name>  # every finding owned by a file
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintCrossFamilyEchoes } from "../dist/src/lint.js";

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


const findings = lintCrossFamilyEchoes(all);
const perPair = new Map();
const perFile = new Map();
for (const f of findings) {
  const pair = /: ([\w-]+) echoes ([\w-]+) --/.exec(f.detail);
  const key = pair ? [pair[1], pair[2]].sort().join(" x ") : "?";
  perPair.set(key, (perPair.get(key) ?? 0) + 1);
  const file = owner.get(f.id) ?? "?";
  perFile.set(file, (perFile.get(file) ?? 0) + 1);
}

if (filter) {
  const rows = findings.filter((f) => {
    const file = owner.get(f.id) ?? "?";
    return fileMode
      ? file === filter || file === `${filter}.json`
      : f.detail.includes(filter);
  });
  for (const f of rows) {
    const other = /(?:from|as) ([\w:~.-]+):/.exec(f.detail)?.[1];
    console.log(`[${owner.get(f.id)} -> ${owner.get(other) ?? "?"}] ${f.detail}`);
  }
  console.log(`\n${rows.length} findings`);
} else {
  console.log("family pair                                     findings");
  for (const [k, n] of [...perPair].sort((a, b) => b[1] - a[1])) {
    console.log(`${k.padEnd(46)} ${String(n).padStart(8)}`);
  }
  console.log(`\n${findings.length} cross-family findings `
    + `(each collision is reported against both entries)\n`);
  console.log("file                                    findings");
  for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1])) {
    console.log(`${file.padEnd(40)} ${String(n).padStart(8)}`);
  }
}
