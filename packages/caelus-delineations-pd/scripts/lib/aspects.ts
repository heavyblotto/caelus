/**
 * Generic planet-aspect-planet extractor for books that head each delineation
 * "PlanetA <aspect words> to PlanetB" (Heindel groups benefic and malefic
 * aspects, e.g. "sextile or trine", so one paragraph yields a record per named
 * aspect that the engine knows). A heading naming "parallel" additionally
 * yields a `parallel{}` record: Caelus models the parallel of declination as
 * its own atom kind (a position, not an aspect — two bodies can hold one
 * while unaspected in longitude), and Heindel's headings pair it with the
 * conjunction ("parallel or conjunction"), reading it as the same in nature.
 *
 * Section ends at the next head *or* a CHAPTER / all-caps divider, so a missed
 * OCR heading cannot swallow the next planet's essay.
 */
import { denoise, excerpt, stripCipher, sentenceStart, isSectionEnd } from "./denoise.js";
import { restore } from "./restore.js";
import { PLANET_TO_BODY } from "./astro.js";
import type { PassageRecord } from "../../src/types.js";
import type { SourceMeta } from "./houses.js";

const ENGINE_ASPECTS = ["conjunction", "sextile", "square", "trine", "opposition"];
const ASPECT_WORDS = [...ENGINE_ASPECTS, "parallel"];

const planets = Object.keys(PLANET_TO_BODY).join("|");
const phrase = `(?:(?:${ASPECT_WORDS.join("|")})(?:\\s*,?\\s*(?:or\\s+)?)?)+`;
const HEADING = new RegExp(
  `(?:The\\s+)?(${planets})\\s+(?:in\\s+)?(${phrase})\\s+to\\s+(?:the\\s+)?(${planets})\\b`,
  "i",
);
const title = (s: string): string => s[0].toUpperCase() + s.slice(1);

/** Join a heading split across lines ("Saturn parallel, conjunction, square\\nor opposition to the Sun"). */
export function joinWrappedHeadings(lines: string[]): string[] {
  const planet = Object.keys(PLANET_TO_BODY).join("|");
  const aspecty = /(?:conjunction|sextile|square|trine|opposition|parallel)/i;
  const toPlanet = new RegExp(`\\bto\\s+(?:the\\s+)?(?:${planet})\\b`, "i");
  const startsAspect = new RegExp(`\\b(?:${planet})\\s+(?:in\\s+)?${aspecty.source}`, "i");
  const continuation = /^(?:or\s+|and\s+)?(?:conjunction|sextile|square|trine|opposition|parallel|to\b)/i;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let acc = lines[i];
    while (i + 1 < lines.length && startsAspect.test(acc) && !toPlanet.test(acc)) {
      const b = lines[i + 1];
      if (!continuation.test(b.trim()) && !toPlanet.test(b)) break;
      acc = `${acc.trimEnd()} ${b.trim()}`;
      i++;
    }
    out.push(acc);
  }
  return out;
}

/** Canonical aspects named in a phrase, in engine vocabulary, deduped.
 *  Includes "parallel", which compiles to a `parallel{}` spec, not `aspect{}`. */
function aspectsIn(p: string): string[] {
  const found = p.toLowerCase().match(/conjunction|sextile|square|trine|opposition|parallel/g) ?? [];
  return [...new Set(found)];
}

function sliceToEnd(lines: string[], start: number, nextHead: number): number {
  let end = nextHead;
  for (let j = start + 1; j < end; j++) {
    if (isSectionEnd(lines[j])) return j;
  }
  return end;
}

/** Extract planet-aspect-planet PassageRecords from `lines`. */
export function extractAspects(lines: string[], source: SourceMeta): PassageRecord[] {
  const heads: { idx: number; a: string; b: string; aspects: string[] }[] = [];
  lines.forEach((line, idx) => {
    const m = line.match(HEADING);
    if (!m || (m.index ?? 0) > 28) return;
    const a = PLANET_TO_BODY[m[1].toLowerCase()];
    const b = PLANET_TO_BODY[m[3].toLowerCase()];
    if (a === b) return;
    const aspects = aspectsIn(m[2]);
    if (!aspects.length) return;
    heads.push({ idx, a, b, aspects });
  });

  const records: PassageRecord[] = [];
  const seen = new Set<string>();
  heads.forEach((head, h) => {
    const rawEnd = h + 1 < heads.length ? heads[h + 1].idx : lines.length;
    const end = sliceToEnd(lines, head.idx, rawEnd);
    const firstLine = stripCipher(lines[head.idx].replace(HEADING, ""));
    const text = restore(excerpt(sentenceStart(denoise([firstLine, ...lines.slice(head.idx + 1, end)]))));
    if (text.length < 80) return;

    const [x, y] = [head.a, head.b].sort();
    for (const aspect of head.aspects) {
      const key = `${x}~${y}:${aspect}`;
      if (seen.has(key)) continue; // first treatment wins
      seen.add(key);
      records.push(aspect === "parallel"
        ? {
          id: `${source.idPrefix}:${x}-parallel-${y}`,
          when: { kind: "parallel", a: head.a, b: head.b, declination: "parallel" },
          atomIds: [`parallel:${x}~${y}:parallel`],
          text,
          tradition: "modern",
          source: {
            author: source.author,
            work: source.work,
            locus: `${title(head.a)} parallel ${title(head.b)}`,
          },
          rights: "pd-us",
          embed: true,
        }
        : {
          id: `${source.idPrefix}:${x}-${aspect}-${y}`,
          when: { kind: "aspect", a: head.a, b: head.b, aspect },
          atomIds: [`aspect:${x}~${y}:${aspect}`],
          text,
          tradition: "modern",
          source: {
            author: source.author,
            work: source.work,
            locus: `${title(head.a)} ${aspect} ${title(head.b)}`,
          },
          rights: "pd-us",
          embed: true,
        });
    }
  });
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}
