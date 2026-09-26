// Lint a passages JSON file after review edits (no brief needed).
// Usage: node check-texts.mjs <file.json> [<file2.json> ...]
import { readFileSync } from "node:fs";
import { lintPassage, lintDuplication } from "../dist/src/lint.js";

let bad = 0;
for (const path of process.argv.slice(2)) {
  const slice = JSON.parse(readFileSync(path, "utf8"));
  for (const p of slice) {
    for (const f of lintPassage(p)) {
      console.error(`FAIL ${path} ${p.id} [${f.rule}] ${f.detail}`);
      bad++;
    }
  }
  for (const f of lintDuplication(slice)) {
    console.error(`FAIL ${path} [duplication] ${f.id}: ${f.detail}`);
    bad++;
  }
}
if (bad) { console.error(`\n${bad} problems`); process.exit(1); }
console.log("texts ok");
