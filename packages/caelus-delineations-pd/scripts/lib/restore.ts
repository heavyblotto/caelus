/**
 * Restore-only OCR correction for extract-time passage text.
 *
 * Policy: restore the author's printed words in the cited edition. Fix
 * substitutions, split/joined words, and unambiguous letter-spacing. Do not
 * modernize, paraphrase, or invent. Period spelling (`shew`, `connexion`,
 * `nativity`) and Sanskrit transliterations stay. If a span cannot be restored
 * with confidence, leave it for the quality gate to quarantine.
 */
import { denoise as layoutDenoise } from "./denoise.js";

/**
 * Reviewed corpus substitutions. Keys are OCR tokens as they appear after
 * layout denoise; values are the printed word. Do not add period-spelling
 * "fixes" or doctrinal paraphrases.
 */
const WORD: [RegExp, string][] = [
  [/\bTue(?=\s+(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune)\b)/g, "The"],
  [/\bbom\b/g, "born"],
  [/\bwbon\b/g, "when"],
  [/\bposses(?=\s+through\b)/g, "passes"],
  [/\btiie\b/gi, "the"],
  [/\bIfthe\b/g, "If the"],
  [/\ballenterprise\b/g, "all enterprise"],
  [/\bforegfoing\b/g, "foregoing"],
  [/\bnuloriety\b/gi, "notoriety"],
  [/\bnuloriely\b/gi, "notoriety"],
  [/\bintellectttal\b/gi, "intellectual"],
  [/\bstrensjthens\b/g, "strengthens"],
  [/\bassertivcncss\b/g, "assertiveness"],
  [/\buever\b/g, "never"],
  [/\bweallb\b/g, "wealth"],
  [/\bgiatoful\b/g, "grateful"],
  [/\bifa (?=watery|fiery|airy|earthy)/g, "if a "],
  [/\bai one time\b/g, "at one time"],
  [/\bown\s*>\s*powers\b/g, "own powers"],
  [/\bTHB\b/g, "THE"],
  [/\bGBUINl\b/gi, "GEMINI"],
  [/\bARIBS\b/g, "ARIES"],
  [/\bpronunent\b/g, "prominent"],
  [/\bbndly\b/g, "badly"],
  [/\bnspected\b/g, "aspected"],
  [/\bujay\b/g, "may"],
  [/\bvety\b/g, "very"],
  [/\bsoniething\b/g, "something"],
  [/\bs%n\b/g, "sign"],
  [/\btempeig\b/g, "temper,"],
  [/\bBR1HAT\b/g, "BRIHAT"],
  [/\bBRIITAT\b/g, "BRIHAT"],
  [/\bBRIUAT\b/g, "BRIHAT"],
  [/\bNATIVITT\b/gi, "NATIVITY"],
  [/\bNATIVm\b/g, "NATIVITY"],
  [/\bwill lie\b/g, "will be"],
  [/\bw\.ll\b/g, "will"],
  [/\bvir u\s*>\s*/g, "virtue "],
  [/\bwill uever\b/g, "will never"],
  [/\brich\*/g, "rich."],
  [/\bworkscn\b/g, "works."],
  [/\bdeeplylearned\b/g, "deeply learned"],
  [/\bpossesses perfect\b/g, "possess perfect"],
  [/\bwill posses\b/g, "will possess"],
  [/\bSmister SixtiU\b/g, "Sinister Sextile"],
  [/\bIll\.-I\.\b/g, "III.-I."],
  [/\btempeig\b/g, "temper,"],
  [/\baud\b/g, "and"],
  [/\bvalient\b/g, "valiant"],
  [/\bdiunkard\b/g, "drunkard"],
  [/\btheasterism\b/g, "the asterism"],
  [/\bwill he of\b/g, "will be of"],
  [/\bwill he very\b/g, "will be very"],
  [/\bwill bo\b/g, "will be"],
  [/\bIhe nstorism\b/g, "the asterism"],
  [/\bnstorism\b/g, "asterism"],
  [/\bnigp-ard\b/g, "niggard"],
  [/\bfound of acts\b/g, "fond of acts"],
  [/\bwill thoughtlessly\b/g, "will thoughtlessly"],
  [/\bthe 'Moon\b/g, "the Moon"],
  [/\bborn -when\b/g, "born when"],
  [/\bthrough Ihe\b/g, "through the"],
  [/\bPlmlguni\b/g, "Phalguni"],
  [/\bUBhadrapada\b/g, "U. Bhadrapada"],
  [/\bRoll ini\b/g, "Rohini"],
  [/\b1\*\.?\s*Ash a cilia\b/gi, "P. Ashadha"],
  [/\b1\*\.?\s*Ashadha\b/g, "P. Ashadha"],
  [/\bAsh a cilia\b/g, "P. Ashadha"],
  [/\bindividttality\b/gi, "individuality"],
  [/\bvexy\b/g, "very"],
  [/\bgo<xi\b/gi, "good"],
  [/\bcombinalion\b/gi, "combination"],
  [/\bcjualities\b/gi, "qualities"],
  [/\bhumanitcfrian\b/gi, "humanitarian"],
  [/\bmjkd\b/g, "mind"],
  [/\bTnind\b/g, "mind"],
  [/\bloftyminded\b/g, "lofty-minded"],
  [/\^hough\b/g, "though"],
  [/\busuaJly\b/g, "usually"],
  [/\bdis¬\s*/g, "dis"],
];

/** Split-word joins that are unique reconstructions, not modernization. */
const JOINS: [RegExp, string][] = [
  [/\bthem selves\b/gi, "themselves"],
  [/\bin fluence\b/gi, "influence"],
  [/\bwill power\b/gi, "will-power"],
];

/**
 * Collapse runs of single letters separated by spaces, carets, or underscores
 * when they reconstruct a unique alphabetic token of 4+ letters. `1`/`0` map
 * to `l`/`o` only inside such a run.
 */
export function collapseLetterSpacing(text: string): string {
  return text.replace(
    /(?:[A-Za-z0-9](?:[\s^_\\]|\\)+){3,}[A-Za-z0-9]/g,
    (run) => {
      const compact = run.replace(/[\s^_\\]+/g, "").replace(/1/g, "l").replace(/0/g, "o");
      if (/^[A-Za-z]{4,}$/.test(compact)) return compact;
      return run;
    },
  );
}

/** Restore OCR in a layout-cleaned string. Idempotent. */
export function restore(text: string): string {
  let s = collapseLetterSpacing(text);
  for (const [re, to] of WORD) s = s.replace(re, to);
  for (const [re, to] of JOINS) s = s.replace(re, to);
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
  s = s.replace(/\s*See page \d+\.\s*\(In the printed version of this book\.\)/gi, "");
  s = s.replace(/\s*For influence of Pluto see pages [\d,\-– ]+\.\s*\(In the original printed version\.\)/gi, "");
  s = s.replace(/\u00AD/g, "").replace(/¬\s*/g, "");
  return s.trim();
}

/** Layout denoise then content restore — the extract-time default. */
export function clean(lines: string[]): string {
  return restore(layoutDenoise(lines));
}
