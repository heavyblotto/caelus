#!/usr/bin/env npx tsx
/**
 * Curated dictionary lemmas from James Wilson, *A Complete Dictionary of
 * Astrology* (1819): exaltation, detriment, fall, reception. Robson-style —
 * not a full-book extract. Glyph tables in the scan are skipped; the prose
 * definitions are layout-cleaned and restored.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { denoise, excerpt } from "../lib/denoise.js";
import { restore } from "../lib/restore.js";
import type { PassageRecord, SelectorSpec } from "../../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/wilson-dictionary.txt");
const OUT = path.join(PKG_ROOT, "data/passages/wilson-dignities.json");

interface Lemma {
  id: string;
  head: RegExp;
  stop: RegExp;
  when: SelectorSpec;
  atomIds: string[];
  locus: string;
}

const LEMMAS: Lemma[] = [
  {
    id: "wilson-dignities:exaltation",
    head: /^EXALTATION,\s+an\s+essential/,
    stop: /^FALSE ANGLE|^FAMILIARITIES/,
    when: { kind: "placement", dignity: "exaltation" },
    atomIds: ["placement:sun"],
    locus: "s.v. Exaltation",
  },
  {
    id: "wilson-dignities:detriment",
    head: /^DETRIMENT\.\s+A\s+planet/,
    stop: /^DEXTER ASPECTS|^DIGNITIES/,
    when: { kind: "placement", dignity: "detriment" },
    atomIds: ["placement:sun"],
    locus: "s.v. Detriment",
  },
  {
    id: "wilson-dignities:fall",
    head: /^FALL\.\s+A\s+planet/,
    stop: /^FALSE ANGLE|^FAMILIARITIES/,
    when: { kind: "placement", dignity: "fall" },
    atomIds: ["placement:sun"],
    locus: "s.v. Fall",
  },
  {
    id: "wilson-dignities:reception",
    head: /^RECEPTION,\s+one of the unmeaning/,
    stop: /^RECTIFICATION/,
    when: { kind: "reception" },
    atomIds: ["reception:sun~moon"],
    locus: "s.v. Reception",
  },
];

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC}`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const records: PassageRecord[] = [];
for (const lemma of LEMMAS) {
  const start = lines.findIndex((l) => lemma.head.test(l.replace(/\s+/g, " ").trim()));
  if (start < 0) { console.warn(`lemma not found: ${lemma.id}`); continue; }
  let end = Math.min(lines.length, start + 45);
  for (let j = start + 1; j < end; j++) {
    const compact = lines[j].replace(/\s+/g, " ").trim();
    if (lemma.stop.test(compact) && j > start + 1) { end = j; break; }
  }
  let block = lines.slice(start, end).filter((l) => {
    const t = l.trim();
    if (!t) return false;
    const letters = (t.match(/[A-Za-z]/g) ?? []).length;
    const compact = t.replace(/\s+/g, "").length;
    const weird = (t.match(/[^A-Za-z0-9\s.,;:'"’‘”“()\-—–!?]/g) ?? []).length;
    return letters >= 10 && letters / Math.max(compact, 1) > 0.42 && weird < 8;
  });
  if (lemma.id === "wilson-dignities:exaltation") {
    const whence = block.findIndex((l) => /Whence this supposed/.test(l.replace(/\s+/g, " ")));
    if (whence > 0) block = [block[0], ...block.slice(whence)];
  }
  if (lemma.id === "wilson-dignities:fall") {
    const horary = block.findIndex((l) => /In horary questions/.test(l.replace(/\s+/g, " ")));
    if (horary > 0) block = [block[0], ...block.slice(horary)];
  }
  const text = restore(excerpt(denoise(block), 700));
  if (text.length < 40) { console.warn(`too short: ${lemma.id}`); continue; }
  records.push({
    id: lemma.id,
    when: lemma.when,
    atomIds: lemma.atomIds,
    text,
    tradition: "renaissance",
    source: {
      author: "James Wilson",
      work: "A Complete Dictionary of Astrology",
      locus: lemma.locus,
    },
    rights: "pd-us",
    embed: true,
  });
}

records.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length} dictionary lemmas → ${OUT}`);
