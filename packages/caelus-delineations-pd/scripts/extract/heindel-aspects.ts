#!/usr/bin/env npx tsx
/**
 * Planet-aspect-planet delineations from Max Heindel, *The Message of the
 * Stars* (Fellowship HTML of the 1919 text). Selector: `aspect{ between, aspect }`.
 * Wrapped heads are rejoined; CHAPTER / all-caps dividers end the cell so a
 * missed heading cannot swallow the next planet's essay.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAspects, joinWrappedHeadings } from "../lib/aspects.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/heindel-message-of-the-stars.txt");
const OUT = path.join(PKG_ROOT, "data/passages/heindel-aspects.json");

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC} — run npm run fetch`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const records = extractAspects(joinWrappedHeadings(lines), {
  idPrefix: "heindel-aspects",
  author: "Max Heindel and Augusta Foss Heindel",
  work: "The Message of the Stars",
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length} planet-aspect-planet passages → ${OUT}`);
