/**
 * Generic planet-in-sign extractor for books that head each delineation
 * "PLANET IN SIGN" on its own line (often repeated as a running page header
 * through the section, which we de-duplicate).
 *
 * Combo running heads ("THE SUN IN GEMINI AND MOON IN ARIES") end the previous
 * cell; they are not a new planet-in-sign section. Leading OCR punctuation is
 * tolerated. Content restore runs after layout denoise.
 */
import { denoise, excerpt, stripCipher, sentenceStart, isSectionEnd } from "./denoise.js";
import { restore } from "./restore.js";
import { PLANET_TO_BODY, SIGN_CANON } from "./astro.js";
import type { PassageRecord } from "../../src/types.js";
import type { SourceMeta } from "./houses.js";

const planets = Object.keys(PLANET_TO_BODY).join("|");
const signs = Object.keys(SIGN_CANON).join("|");
const HEADING = new RegExp(
  `^[\\s.,•\\-]*(?:The\\s+)?(${planets})\\s+in\\s+(${signs})\\b(.*)$`,
  "i",
);
const COMBO = new RegExp(
  `\\b(?:${planets})\\s+in\\s+(?:${signs})\\b.*\\bAND\\s+(?:THE\\s+)?(?:${planets})\\b`,
  "i",
);

const title = (s: string): string => s[0].toUpperCase() + s.slice(1);

/** OCR-tolerant heading line: THB/UBRA/SCOKHIO etc. Layout only — not a rewrite of body text. */
function normalizeHead(line: string): string {
  return line
    .replace(/\bTHB\b/g, "THE")
    .replace(/\bLBOAND\b/g, "LEO AND")
    .replace(/\bARIBS\b/g, "ARIES")
    .replace(/\bARISS\b/g, "ARIES")
    .replace(/\bAaiRS\b/g, "ARIES")
    .replace(/\bTAURUiS\b/g, "TAURUS")
    .replace(/\bGBUINl\b/gi, "GEMINI")
    .replace(/\bGBMINI\b/g, "GEMINI")
    .replace(/\bGSMINI\b/g, "GEMINI")
    .replace(/\bCANCBft\b/g, "CANCER")
    .replace(/\bCANCKR\b/g, "CANCER")
    .replace(/\bCANCKft\b/g, "CANCER")
    .replace(/\bCANCKK\b/g, "CANCER")
    .replace(/\bCWCRR\b/g, "CANCER")
    .replace(/\bLBO\b/g, "LEO")
    .replace(/\bLKO\b/g, "LEO")
    .replace(/\bUBRA\b/g, "LIBRA")
    .replace(/\bLIUKA\b/g, "LIBRA")
    .replace(/\bLIBSA\b/g, "LIBRA")
    .replace(/\bLinRA\b/g, "LIBRA")
    .replace(/\bSCOKHIO\b/g, "SCORPIO")
    .replace(/\bSCOKPIO\b/g, "SCORPIO")
    .replace(/\bPISCBS\b/g, "PISCES")
    .replace(/\bFISCBS\b/g, "PISCES")
    .replace(/\bPISCB8\b/g, "PISCES")
    .replace(/\bUOON\b/g, "MOON")
    .replace(/\bHOON\b/g, "MOON")
    .replace(/\bKOON\b/g, "MOON")
    .replace(/\bANO\b/g, "AND")
    .replace(/\bAMD\b/g, "AND")
    .replace(/\bANT>\b/g, "AND")
    .replace(/\bAST\*\b/g, "AND")
    .replace(/\bASn\b/g, "AND");
}

/** Extract planet-in-sign PassageRecords from `lines`. */
export function extractSigns(lines: string[], source: SourceMeta): PassageRecord[] {
  const heads: { idx: number; key: string; body: string; sign: string }[] = [];
  lines.forEach((line, idx) => {
    const n = normalizeHead(line);
    if (COMBO.test(n)) return;
    const m = n.match(HEADING);
    if (!m) return;
    const body = PLANET_TO_BODY[m[1].toLowerCase()];
    const sign = SIGN_CANON[m[2].toLowerCase()];
    if (!body || !sign) return;
    heads.push({ idx, key: `${body}:${sign}`, body, sign });
  });

  const records: PassageRecord[] = [];
  const seen = new Set<string>();
  for (let h = 0; h < heads.length; h++) {
    const head = heads[h];
    if (seen.has(head.key)) continue;
    seen.add(head.key);
    let endIdx = lines.length;
    for (let k = h + 1; k < heads.length; k++) {
      if (heads[k].key !== head.key) { endIdx = heads[k].idx; break; }
    }
    for (let j = head.idx + 1; j < endIdx; j++) {
      const n = normalizeHead(lines[j]);
      if (COMBO.test(n) || isSectionEnd(n)) { endIdx = j; break; }
    }
    const block = lines.slice(head.idx + 1, endIdx).filter((l) => {
      const n = normalizeHead(l);
      return !HEADING.test(n) && !COMBO.test(n);
    });
    const text = restore(excerpt(sentenceStart(stripCipher(denoise(block)))));
    if (text.length < 80) continue;

    records.push({
      id: `${source.idPrefix}:${head.body}-in-${head.sign.toLowerCase()}`,
      when: { kind: "placement", body: head.body, sign: head.sign },
      atomIds: [`placement:${head.body}`],
      text,
      tradition: "modern",
      source: {
        author: source.author,
        work: source.work,
        locus: `${title(head.body)} in ${head.sign}`,
      },
      rights: source.rights ?? "pd-us",
      embed: true,
    });
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}
