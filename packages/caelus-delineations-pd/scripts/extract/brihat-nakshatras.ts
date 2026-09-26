#!/usr/bin/env npx tsx
/**
 * Moon-in-nakshatra delineations from Varahamihira, *Brihat Jataka*
 * (trans. N. Chidambaram Iyer, 1885), Chapter XVI "On The Nakshatras".
 * Selector: `nakshatra{ body: "moon", name }`.
 *
 * Restore-only: layout via denoise, OCR via restore. Names resolve through an
 * alias table of observed OCR variants; Iyer's transliteration in the quoted
 * sentence is kept unless it is an OCR mangling of that printed form.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { denoise, isSectionEnd } from "../lib/denoise.js";
import { restore } from "../lib/restore.js";
import type { PassageRecord } from "../../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/varahamihira-brihat-jataka.txt");
const OUT = path.join(PKG_ROOT, "data/passages/brihat-nakshatras.json");

const ALIASES: [string, string[]][] = [
  ["Ashwini", ["aswini", "ashwini"]],
  ["Bharani", ["bharani"]],
  ["Krittika", ["krittika"]],
  ["Rohini", ["rohini", "rollini"]],
  ["Mrigashira", ["mrigasirsha", "mrigashira"]],
  ["Ardra", ["ardra"]],
  ["Punarvasu", ["punarvasu"]],
  ["Pushya", ["pushya"]],
  ["Ashlesha", ["aslesha", "ashlesha"]],
  ["Magha", ["magha"]],
  ["Purva Phalguni", ["pphalguni", "pplmlguni", "plmlguni"]],
  ["Uttara Phalguni", ["uphalguni"]],
  ["Hasta", ["hasta"]],
  ["Chitra", ["chittra", "chitra"]],
  ["Swati", ["swati"]],
  ["Vishakha", ["visakha", "vishakha"]],
  ["Anuradha", ["anuradha"]],
  ["Jyeshtha", ["jyeshta", "jyeshtha"]],
  ["Mula", ["moola", "mula"]],
  ["Purva Ashadha", ["pashadha", "ashacilia", "1ashadha"]],
  ["Uttara Ashadha", ["uashadha"]],
  ["Shravana", ["sravana", "sravaua"]],
  ["Dhanishta", ["dhanishta"]],
  ["Shatabhisha", ["satabhishak", "satabhisha"]],
  ["Purva Bhadrapada", ["pbhadrapada"]],
  ["Uttara Bhadrapada", ["ubhadrapada"]],
  ["Revati", ["revati"]],
];

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, "");

function trimNakshatra(text: string): string {
  const cut = text.search(/\b(?:CHAPTER|BRIHAT|BR1HAT|BRIITAT|BRIUAT|Xotes|Notes\.|Ox Tut)/i);
  if (cut > 50) text = text.slice(0, cut);
  text = restore(text)
    .replace(/^[\d\]!?*.\s-]{0,6}(?=[A-Z])/, "")
    .replace(/\[cir\.[^\]]*\]?/gi, "")
    .replace(/\[[^\]]{0,12}\d+[^\]]{0,8}\]/g, "")
    .replace(/\s*O O X-?\s*$/g, "")
    .replace(/\s*cn\.\s*\d+[.\]]*\s*$/i, "")
    .replace(/[-–—]+\s*$/, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text;
}

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC} — run npm run fetch`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const start = lines.findIndex((l) => /CHAPTER\s+XVI\b/i.test(l));
// OCR of XVII is "CHAPTER  XV If."
const end = lines.findIndex((l, i) => i > start && (/CHAPTER\s+XV\s*I/i.test(l) || /Moon In The Several Signs/i.test(l)));
if (start < 0) { console.error("chapter XVI head not found"); process.exit(1); }
const chapter = lines.slice(start, end < 0 ? lines.length : end);

const HEAD = /\bperson\s+b\w{2,4}\b.{0,12}\bthe\s+.?Moon\s+p[ao]\w{2,4}\s+through/i;
const headIdx: number[] = [];
chapter.forEach((l, i) => { if (HEAD.test(l)) headIdx.push(i); });

const records: PassageRecord[] = [];
headIdx.forEach((h, k) => {
  let stop = k + 1 < headIdx.length ? headIdx[k + 1] : chapter.length;
  for (let j = h + 1; j < stop; j++) {
    if (isSectionEnd(chapter[j])) { stop = j; break; }
  }
  const text = trimNakshatra(denoise(chapter.slice(h, stop)));
  if (text.length < 60) return;
  const headNorm = normalize(text.slice(0, 140));
  const name = ALIASES.find(([, aliases]) => aliases.some((a) => headNorm.includes(a)))?.[0];
  if (!name) { console.warn(`unresolved asterism in: ${text.slice(0, 80)}…`); return; }
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  records.push({
    id: `brihat-nakshatras:moon-in-${slug}`,
    when: { kind: "nakshatra", body: "moon", name },
    atomIds: [`nakshatra:moon:${name.replace(/\s+/g, "_")}`],
    text,
    tradition: "vedic",
    source: {
      author: "Varahamihira (trans. N. Chidambaram Iyer)",
      work: "Brihat Jataka",
      locus: `ch. XVI, Moon in ${name}`,
    },
    rights: "pd-us",
    embed: true,
  });
});

const seen = new Set(records.map((r) => r.id));
if (seen.size !== records.length) { console.error("duplicate nakshatra records"); process.exit(1); }
records.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length}/27 Moon-in-nakshatra passages → ${OUT}`);
