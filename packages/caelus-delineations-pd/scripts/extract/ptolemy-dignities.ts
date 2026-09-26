#!/usr/bin/env npx tsx
/**
 * Essential-dignity doctrine from Ptolemy, *Tetrabiblos* (Ashmand 1822,
 * Gutenberg). Book I ch. XX (houses / domicile) and ch. XXII (exaltations).
 * Selectors: `placement{ dignity }`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { denoise, excerpt } from "../lib/denoise.js";
import { restore } from "../lib/restore.js";
import type { PassageRecord } from "../../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/ptolemy-tetrabiblos.txt");
const OUT = path.join(PKG_ROOT, "data/passages/ptolemy-dignities.json");

function chapter(lines: string[], title: RegExp, next: RegExp): string[] {
  const start = lines.findIndex((l) => title.test(l));
  if (start < 0) throw new Error(`chapter not found: ${title}`);
  const end = lines.findIndex((l, i) => i > start + 2 && next.test(l));
  return lines.slice(start + 1, end < 0 ? start + 80 : end);
}

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC}`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const houses = restore(excerpt(denoise(chapter(lines, /^HOUSES OF THE PLANETS\s*$/, /^CHAPTER XXI\b/)), 900));
const exalt = restore(excerpt(denoise(chapter(lines, /^EXALTATIONS\s*$/, /^CHAPTER XXIII\b/)), 900));

const records: PassageRecord[] = [
  {
    id: "ptolemy-dignities:domicile",
    when: { kind: "placement", dignity: "domicile" },
    atomIds: ["placement:sun"],
    text: houses,
    tradition: "hellenistic",
    source: {
      author: "Claudius Ptolemy (trans. J.M. Ashmand)",
      work: "Tetrabiblos",
      locus: "Book I, ch. XX, houses of the planets",
    },
    rights: "pd-us",
    embed: true,
  },
  {
    id: "ptolemy-dignities:exaltation",
    when: { kind: "placement", dignity: "exaltation" },
    atomIds: ["placement:sun"],
    text: exalt,
    tradition: "hellenistic",
    source: {
      author: "Claudius Ptolemy (trans. J.M. Ashmand)",
      work: "Tetrabiblos",
      locus: "Book I, ch. XXII, exaltations",
    },
    rights: "pd-us",
    embed: true,
  },
];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length} dignity passages → ${OUT}`);
