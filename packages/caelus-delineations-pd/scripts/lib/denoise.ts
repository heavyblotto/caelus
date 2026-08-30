/**
 * Shared OCR de-noising helpers for the extraction pipeline.
 *
 * Policy (restore-only): restore the author's printed words in the cited
 * edition. This module cleans *layout* — running heads, hyphenation, whitespace,
 * glyph ciphers, chapter furniture. Content restoration (OCR substitutions,
 * split words, letter-spacing) lives in `restore.ts` and is applied by
 * extractors after `denoise`. Do not modernize, paraphrase, or invent. Period
 * spelling stays. Unreadable scans are quarantined by the quality gate, not
 * guessed into doctrine.
 */

/** Lines that are running heads / page furniture, not prose. */
const FURNITURE = [
  /^\s*\d{1,3}\s+[A-Z][A-Z ,.'-]{2,}$/, // "159  THE MESSAGE OF THE STARS"
  /^\s*[A-Z][A-Z ,.'-]{2,}\s+\d{1,3}\s*$/, // "THE SUN, GIVER OF LIFE 159"
  /^\s*SIGNS\s+OF\s+THE\s+ZODIAC\s*$/i,
  /^\s*(?:THE\s+)?ASTROLOGY\s*$/i,
  /^\s*\d{1,4}\s*$/, // bare page numbers
  /^[\s\W\d]{0,8}$/, // empty / pure punctuation-glyph lines
  /^\s*CHAPTER\s+[IVXLC0-9XL.]+\s*$/i,
  /^\s*CHAPTER\s+[IVXLC]+\.\s+[A-Z].*$/i,
  /^\s*THE KEY TO YOUR OWN NATIV.*$/i,
  /^\s*HOW TO JUDGE A NATIVITY\s*$/i,
  /^\s*GENETHLIACAL ASTROLOGY\s*$/i,
  /^\s*BRI[IU1]+AT\s+J\s*ATAKA.*$/i,
  /^\s*BR1HAT\s+J\s*AT\s*AKA.*$/i,
  /^\s*See (?:on |dole oo )?page.*$/i,
  /^\s*PART\s+H[I1].*DELINEATIONS.*$/i,
  /^\s*\[?\s*ch\.?\s+\d+[.\]]?.*BRIHAT.*$/i,
  /^\s*cn\.\s+\S+\s*\].*JATAKA.*$/i,
  /^\s*Xotes\.?\s*$/i,
  /^\s*[A-Z]{4,}(?:\s+[A-Z]+){0,3}\.\s*$/, // dictionary running heads ("EXALTATION.")
];

/** True for a line that is page furniture rather than prose. */
export function isFurniture(line: string): boolean {
  return FURNITURE.some((re) => re.test(line));
}

/**
 * Collapse a block of OCR lines into a single clean paragraph string: drop page
 * furniture, repair end-of-line hyphenation, and normalize whitespace.
 */
export function denoise(lines: string[]): string {
  const kept = lines.filter((l) => !isFurniture(l));
  let text = kept.join("\n");
  // Repair "enterpris-\ning" and "disagree- ments" -> rejoin the split word.
  text = text.replace(/(\w)[-—]\s*\n\s*(\w)/g, "$1$2");
  text = text.replace(/(\w)-\s+(\w)/g, "$1$2");
  // Newlines become spaces; collapse runs of whitespace.
  text = text.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ");
  // Tidy spacing around punctuation the OCR scattered.
  text = text.replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ");
  return text.trim();
}

/** Sentence openers that mark where prose resumes after a glyph cipher. */
const STARTERS = new Set([
  "it", "he", "she", "this", "they", "its", "his", "her",
  "these", "those", "such", "when", "here", "there", "gives", "denotes",
  "represents", "describes",
]);

/**
 * Drop a leading astrological-glyph cipher ("* T5", "tf 8", "D * A O") that an
 * OCR leaves before the prose, stopping at the first real word (a sentence
 * opener, or any token of four or more letters).
 */
export function stripCipher(s: string): string {
  const toks = s.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < toks.length) {
    const w = toks[i].toLowerCase().replace(/[^a-z]/g, "");
    if (STARTERS.has(w) || w.length >= 4) break;
    i++;
  }
  return toks.slice(i).join(" ");
}

/**
 * Make a passage begin at a clean sentence. After a header and glyph cipher are
 * stripped, a delineation can start mid-sentence ("endows the person…"); if it
 * does, advance to the next capitalized sentence opener, or, failing that,
 * capitalize the first letter so the excerpt at least reads as a statement.
 */
export function sentenceStart(text: string): string {
  if (!text || /^["'(]?[A-Z]/.test(text)) return text;
  const m = text.match(/[.;:!?]\s+(?=["'(]?[A-Z])/);
  if (m && m.index !== undefined && m.index < 160) {
    return text.slice(m.index + m[0].length);
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Trim a long passage to a representative excerpt: keep whole sentences up to
 * `max` characters so a citation is self-contained, never cut mid-word.
 */
export function excerpt(text: string, max = 900): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "));
  return (lastStop > max * 0.5 ? slice.slice(0, lastStop + 1) : slice).trim();
}

/** Hard section end: a new chapter or an all-caps running title. */
export function isSectionEnd(line: string): boolean {
  const t = line.trim();
  if (/^CHAPTER\s+[IVXLC0-9]/i.test(t)) return true;
  if (/^CHAPTER\s+[A-Z][A-Z ]{8,}/.test(t)) return true;
  if (/IN THE [A-Z]+ HOUSES/.test(t)) return true;
  if (/^[A-Z][A-Z .'-]{14,}$/.test(t) && !/IN THE/.test(t)) return true;
  return false;
}
