#!/usr/bin/env npx tsx
/**
 * Moon-in-nakshatra delineations from Varahamihira, *Brihat Jataka*
 * (trans. N. Chidambaram Iyer, 1885), Chapter XVI "On The Nakshatras".
 * Selector: `nakshatra{ body: "moon", name }`.
 *
 * Unlike the rest of the book (verse/sloka-structured), Chapter XVI is
 * regular prose: every delineation opens "A person born when the Moon
 * passes through the asterism of <Name> will be ...", so heading extraction
 * works here. The scan's OCR garbles several asterism names ("Roll ini" for
 * Rohini, "Sravaua" for Shravana), so names resolve through an alias table
 * of observed OCR variants -- names are normalized to the engine's
 * NAKSHATRAS vocabulary, passage text stays as scanned (layout cleaned,
 * content untouched).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { denoise } from "../lib/denoise.js";
import type { PassageRecord } from "../../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/varahamihira-brihat-jataka.txt");
const OUT = path.join(PKG_ROOT, "data/passages/brihat-nakshatras.json");

/** Engine nakshatra name -> normalized OCR aliases seen in this scan.
 *  Aliases are matched against lowercased text stripped of non-letters, so
 *  "U- Bhadrapada" -> "ubhadrapada" and "Ash a cilia" -> "ashacilia". */
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
  // Prefixed pairs come before anything that could contain their stem.
  ["Purva Phalguni", ["pphalguni", "pplmlguni", "plmlguni"]],
  ["Uttara Phalguni", ["uphalguni"]],
  ["Hasta", ["hasta"]],
  ["Chitra", ["chittra", "chitra"]],
  ["Swati", ["swati"]],
  ["Vishakha", ["visakha", "vishakha"]],
  ["Anuradha", ["anuradha"]],
  ["Jyeshtha", ["jyeshta", "jyeshtha"]],
  ["Mula", ["moola", "mula"]],
  ["Purva Ashadha", ["pashadha", "ashacilia"]],
  ["Uttara Ashadha", ["uashadha"]],
  ["Shravana", ["sravana", "sravaua"]],
  ["Dhanishta", ["dhanishta"]],
  ["Shatabhisha", ["satabhishak", "satabhisha"]],
  ["Purva Bhadrapada", ["pbhadrapada"]],
  ["Uttara Bhadrapada", ["ubhadrapada"]],
  ["Revati", ["revati"]],
];

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, "");

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC} — run npm run fetch`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

// Bound the scan to Chapter XVI so a stray phrase elsewhere cannot match.
const start = lines.findIndex((l) => /CHAPTER\s+XVI\b/i.test(l));
const end = lines.findIndex((l, i) => i > start && /CHAPTER\s+XVII\b/i.test(l));
if (start < 0) { console.error("chapter XVI head not found"); process.exit(1); }
const chapter = lines.slice(start, end < 0 ? lines.length : end);

// Heads: "A person born when the Moon passes through ..." with OCR tolerance
// (observed: "bom" for "born", "wbon" for "when", "posses" for "passes",
// a stray "-" or quote). The asterism name may sit on the same or the
// following line ("... the as-\nterism of Rohini").
const HEAD = /\bperson\s+b\w{2,4}\b.{0,12}\bthe\s+.?Moon\s+p[ao]\w{2,4}\s+through/i;
const headIdx: number[] = [];
chapter.forEach((l, i) => { if (HEAD.test(l)) headIdx.push(i); });

const records: PassageRecord[] = [];
headIdx.forEach((h, k) => {
  const stop = k + 1 < headIdx.length ? headIdx[k + 1] : chapter.length;
  const text = denoise(chapter.slice(h, stop))
    // Drop a leading verse number ("8-", "12.", "1?.") the OCR kept.
    .replace(/^[\d\]!?*.\s-]{0,6}(?=[A-Z])/, "");
  if (text.length < 60) return;
  // Resolve the asterism from the head region only (name follows "asterism of").
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
