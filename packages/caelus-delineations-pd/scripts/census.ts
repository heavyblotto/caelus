#!/usr/bin/env npx tsx
/**
 * Quality census of shipped PassageRecords. Prints per-file counts and the
 * flags that drive restore / quarantine. Read-only.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { scorePassage, type QualityFlag } from "../src/quality.js";
import type { PassageRecord } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../data/passages");

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

let total = 0;
const flagCounts: Record<string, number> = {};

console.log("file\tpassages\tflagged\tmeanScore\tflags");
for (const file of files) {
  const recs = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as PassageRecord[];
  total += recs.length;
  const scored = recs.map((r) => ({ id: r.id, ...scorePassage(r.text) }));
  const flagged = scored.filter((s) => s.flags.length > 0);
  const mean = scored.reduce((n, s) => n + s.score, 0) / (scored.length || 1);
  const flags = new Map<QualityFlag, number>();
  for (const s of flagged) {
    for (const f of s.flags) {
      flags.set(f, (flags.get(f) ?? 0) + 1);
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }
  const flagStr = [...flags.entries()].map(([k, n]) => `${k}:${n}`).join(",") || "-";
  console.log(`${file}\t${recs.length}\t${flagged.length}\t${mean.toFixed(2)}\t${flagStr}`);
  for (const s of flagged.slice(0, 8)) {
    console.log(`  ${s.id}  score=${s.score.toFixed(2)}  [${s.flags.join(", ")}]  ${s.excerpt}`);
  }
  if (flagged.length > 8) console.log(`  … ${flagged.length - 8} more flagged`);
}
console.log(`\ntotal passages: ${total}`);
console.log("flag totals:", flagCounts);
