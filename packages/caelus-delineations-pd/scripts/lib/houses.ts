/**
 * Generic planet-in-house extractor, shared by the Alan Leo books that head a
 * delineation "Planet in the Nth House" with the prose following inline.
 *
 * Restore-only: layout via denoise, OCR via restore. Heading match is
 * OCR-tolerant (`Tue`/`Thc` for `The`) so a mangled head ends the previous
 * section instead of bleeding into it.
 */
import { denoise, excerpt, sentenceStart, isSectionEnd } from "./denoise.js";
import { restore } from "./restore.js";
import { ordinalToNumber } from "./ordinal.js";
import { PLANET_TO_BODY } from "./astro.js";
import type { PassageRecord, CorpusRights } from "../../src/types.js";

const planets = Object.keys(PLANET_TO_BODY).join("|");
const THE = "(?:The|Tue|Thc|Tne|Ths|Tbe)\\s+";
const HEADING = new RegExp(
  `^\\s*(?:${THE})?(${planets})\\s+in\\s+the\\s+([A-Za-z]+)\\s+House\\b(.*)$`,
  "i",
);

const title = (s: string): string => s[0].toUpperCase() + s.slice(1);

export interface SourceMeta {
  idPrefix: string;
  author: string;
  work: string;
  /** Defaults to "pd-us". Use "gratis-not-pd" for a rights-encumbered scan. */
  rights?: CorpusRights;
}

function cleanBlock(block: string[]): string {
  return restore(excerpt(sentenceStart(denoise(block))));
}

/** Extract planet-in-house PassageRecords from `lines`. */
export function extractHouses(lines: string[], source: SourceMeta): PassageRecord[] {
  const records: PassageRecord[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING);
    if (!m) continue;
    const body = PLANET_TO_BODY[m[1].toLowerCase()];
    const house = ordinalToNumber(m[2]);
    if (house === null) continue;

    const block = [m[3]];
    for (let j = i + 1; j < lines.length; j++) {
      if (HEADING.test(lines[j]) || isSectionEnd(lines[j])) break;
      block.push(lines[j]);
    }
    const text = cleanBlock(block);
    if (text.length < 80) continue;

    const key = `${body}:${house}`;
    if (seen.has(key)) continue; // keep the first, fullest treatment
    seen.add(key);
    records.push({
      id: `${source.idPrefix}:${body}-in-house-${house}`,
      when: { kind: "placement", body, house },
      atomIds: [`placement:${body}`],
      text,
      tradition: "modern",
      source: {
        author: source.author,
        work: source.work,
        locus: `${title(body)} in the ${m[2].toLowerCase()} house`,
      },
      rights: source.rights ?? "pd-us",
      embed: true,
    });
  }
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}
