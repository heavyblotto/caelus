#!/usr/bin/env npx tsx
/**
 * Rising-sign physical types from Sepharial, *Astrology: How to Make and
 * Read Your Own Horoscope* (Gutenberg transcription). Selector:
 * `angle{ asc, sign }`. The book heads each type "_Aries_ produces…".
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { denoise, excerpt } from "../lib/denoise.js";
import { restore } from "../lib/restore.js";
import { SIGN_CANON } from "../lib/astro.js";
import type { PassageRecord } from "../../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(PKG_ROOT, "sources/text/sepharial-horoscope.txt");
const OUT = path.join(PKG_ROOT, "data/passages/sepharial-rising.json");

const SIGN_ALIAS: Record<string, string> = { ...SIGN_CANON, capricornus: "Capricorn" };
const signs = Object.keys(SIGN_ALIAS).join("|");
const HEAD = new RegExp(`^_(${signs})_\\s+(?:produces|gives|renders|contributes|denotes)`, "i");

if (!fs.existsSync(SRC)) { console.error(`missing ${SRC}`); process.exit(1); }
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const heads: { idx: number; sign: string }[] = [];
const seen = new Set<string>();
lines.forEach((line, idx) => {
  const m = line.match(HEAD);
  if (!m) return;
  const raw = m[1].toLowerCase();
  const sign = SIGN_ALIAS[raw];
  if (!sign || seen.has(sign)) return;
  seen.add(sign);
  heads.push({ idx, sign });
});

const records: PassageRecord[] = [];
heads.forEach((head, h) => {
  const end = h + 1 < heads.length ? heads[h + 1].idx : Math.min(lines.length, head.idx + 12);
  const text = restore(excerpt(denoise(lines.slice(head.idx, end)), 700));
  if (text.length < 60) return;
  records.push({
    id: `sepharial-rising:asc-in-${head.sign.toLowerCase()}`,
    when: { kind: "angle", angle: "asc", sign: head.sign },
    atomIds: ["angle:asc"],
    text,
    tradition: "modern",
    source: {
      author: "Sepharial",
      work: "Astrology: How to Make and Read Your Own Horoscope",
      locus: `${head.sign} rising (sign types)`,
    },
    rights: "pd-us",
    embed: true,
  });
});

records.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length}/12 rising-sign passages → ${OUT}`);
