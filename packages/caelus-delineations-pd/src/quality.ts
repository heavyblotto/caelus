/**
 * Passage-text quality scoring. Used by the census script and the validation
 * harness. Flags are the restore / quarantine work queue; `score` is 0..1
 * (1 = clean). Restore-only policy: readable English attributable to the cited
 * edition, never invented.
 */

export type QualityFlag =
  | "chapter-bleed"
  | "running-head"
  | "see-on-page"
  | "ocr-token"
  | "letter-spacing"
  | "glyph-cipher"
  | "shredded";

export interface QualityResult {
  score: number;
  flags: QualityFlag[];
  excerpt: string;
}

/** Tokens we treat as unrestored OCR (not period spelling). */
export const OCR_TOKENS = [
  /\bTue (?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune)\b/,
  /\bforegfoing\b/i,
  /\bintellectttal\b/i,
  /\bstrensjthens\b/i,
  /\bassertivcncss\b/i,
  /\bnuloriet?y\b/i,
  /\bBRIITAT\b/,
  /\bBRIUAT\b/,
  /\bNATIVITT\b/i,
  /\bbannomous\b/i,
  /\bmcurable\b/i,
  /\bivntings\b/i,
  /\ballenterprise\b/i,
  /\bIfthe\b/,
  /\btiie\b/i,
  /\bGBUINl\b/i,
  /\bTHB SUN\b/,
  /\bKlakes\b/,
  /\baasociajtes\b/i,
  /\bhcfoors\b/i,
  /\bGENETHLIACAL\b/,
  /\bAQROSCpPCS\b/i,
  /\binflnpnrpc/i,
  /\bThfrong/i,
  /\bwbon\b/i,
  /\bposses through\b/i,
  /\bAsh a cilia\b/i,
  /\bweallb\b/i,
  /\bgiatoful\b/i,
  /\buever\b/i,
  /\bworkscn\b/i,
];

const RUNNING_HEAD = [
  /\bTHE KEY TO YOUR OWN NATIV/i,
  /\bTHE KE\\\s*TO\b/,
  /\bBRI[IU]AT JATAKA\b/i,
  /\bGENETHLIACAL ASTROLOGY\b/,
  /\bHOW TO JUDGE A NATIVITY\b/,
  /\bPART H[I1],?\s+DELINEATIONS\b/i,
];

const CHAPTER_BLEED = /\bCHAPTER\s+(?:[IVXLC]{1,8}|[A-Z][A-Z ]{6,})\b/;
const SEE_ON_PAGE = /\bSee on page\b/i;
const GLYPH = /[$§¤][\s\dA-DP]{0,8}[§¤*]|[♀♂☿♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓]/;
const LETTER_SPACING = /(?:^|[^\w])(?:[A-Za-z0-9][\s^_]){3,}[A-Za-z0-9](?:[^\w]|$)/;
const SHREDDED = /\\ou\b|j'our|\^[A-Za-z]|[\uFFFD]/;

export function scorePassage(text: string): QualityResult {
  const flags: QualityFlag[] = [];
  if (CHAPTER_BLEED.test(text)) flags.push("chapter-bleed");
  if (RUNNING_HEAD.some((re) => re.test(text))) flags.push("running-head");
  if (SEE_ON_PAGE.test(text)) flags.push("see-on-page");
  if (OCR_TOKENS.some((re) => re.test(text))) flags.push("ocr-token");
  if (LETTER_SPACING.test(text)) flags.push("letter-spacing");
  if (GLYPH.test(text)) flags.push("glyph-cipher");
  if (SHREDDED.test(text)) flags.push("shredded");

  const toks = text.split(/\s+/).filter(Boolean);
  const singles = toks.filter((t) => /^[A-Za-z0-9]$/.test(t)).length;
  const weird = (text.match(/[^A-Za-z0-9\s.,;:'"’‘”“()\-—–!?]/g) ?? []).length;
  const density = toks.length ? singles / toks.length + weird / Math.max(text.length, 1) : 1;
  if (density > 0.12 && !flags.includes("letter-spacing") && !flags.includes("shredded")) {
    flags.push("shredded");
  }

  const penalty = flags.length * 0.18 + Math.min(0.4, density);
  const score = Math.max(0, 1 - penalty);
  const excerpt = text.slice(0, 110).replace(/\s+/g, " ");
  return { score, flags, excerpt };
}

/** True when a shipped passage is readable enough to quote. */
export function isShippable(text: string, floor = 0.55): boolean {
  const q = scorePassage(text);
  return q.score >= floor
    && !q.flags.includes("chapter-bleed")
    && !q.flags.includes("shredded")
    && !q.flags.includes("see-on-page")
    && !q.flags.includes("ocr-token")
    && !q.flags.includes("running-head")
    && !q.flags.includes("letter-spacing");
}
