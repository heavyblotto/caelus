/**
 * Gematria: letter values across the systems, with notarikon and temurah.
 *
 * The committed tables pin public-domain sources, all from Agrippa's "Three
 * Books of Occult Philosophy" (J.F. translation, 1651), Book II:
 *
 * - hebrew: ch. XIX. The 22 letters at their standard values; the five
 *   final forms count at their base values (mem-final is 40), which is the
 *   convention Agrippa's own divine-name tables in ch. XXII compute with
 *   (Elim is printed as 81, Din as 64).
 * - hebrew-finals: ch. XIX's numeral-mark table, the five finals at
 *   500–900.
 * - greek-isopsephy: ch. XVIII's second order, the alphabet in three
 *   classes after the imitation of the Hebrews, with digamma 6, koppa 90,
 *   sampi 900.
 * - greek-ordinal: ch. XVIII's first order, each letter at its alphabet
 *   place, alpha 1 to omega 24.
 * - latin-agrippa: ch. XX's 27-place Roman table. The consonantal I is J
 *   (600) and the consonantal V is U (700); the printed HI 800 and HV 900
 *   aspirate digraphs are tabulated but not applied in letter-by-letter
 *   computation. W is outside the 1651 alphabet and carries no value.
 */

export type LetterSystemId =
  | "hebrew"
  | "hebrew-finals"
  | "greek-isopsephy"
  | "greek-ordinal"
  | "latin-agrippa";

export interface LetterValue {
  /** The letter form used for lookup, in the system's canonical case. */
  char: string;
  /** The letter's name in the tradition's usual English rendering. */
  name: string;
  value: number;
  /** True for the five Hebrew final forms and word-final sigma. */
  final?: boolean;
}

export interface LetterSystem {
  id: LetterSystemId;
  /** Chapter anchor in the J.F. printing. */
  source: string;
  entries: readonly LetterValue[];
}

const HEBREW_BASE: readonly LetterValue[] = [
  { char: "א", name: "aleph", value: 1 },
  { char: "ב", name: "beth", value: 2 },
  { char: "ג", name: "gimel", value: 3 },
  { char: "ד", name: "daleth", value: 4 },
  { char: "ה", name: "he", value: 5 },
  { char: "ו", name: "vau", value: 6 },
  { char: "ז", name: "zayin", value: 7 },
  { char: "ח", name: "cheth", value: 8 },
  { char: "ט", name: "teth", value: 9 },
  { char: "י", name: "yod", value: 10 },
  { char: "כ", name: "caph", value: 20 },
  { char: "ל", name: "lamed", value: 30 },
  { char: "מ", name: "mem", value: 40 },
  { char: "נ", name: "nun", value: 50 },
  { char: "ס", name: "samech", value: 60 },
  { char: "ע", name: "ayin", value: 70 },
  { char: "פ", name: "phe", value: 80 },
  { char: "צ", name: "tsadhe", value: 90 },
  { char: "ק", name: "koph", value: 100 },
  { char: "ר", name: "resh", value: 200 },
  { char: "ש", name: "shin", value: 300 },
  { char: "ת", name: "tau", value: 400 },
];

const HEBREW_FINALS_AT_BASE: readonly LetterValue[] = [
  { char: "ך", name: "caph final", value: 20, final: true },
  { char: "ם", name: "mem final", value: 40, final: true },
  { char: "ן", name: "nun final", value: 50, final: true },
  { char: "ף", name: "phe final", value: 80, final: true },
  { char: "ץ", name: "tsadhe final", value: 90, final: true },
];

const HEBREW_FINALS_AT_HUNDREDS: readonly LetterValue[] = [
  { char: "ך", name: "caph final", value: 500, final: true },
  { char: "ם", name: "mem final", value: 600, final: true },
  { char: "ן", name: "nun final", value: 700, final: true },
  { char: "ף", name: "phe final", value: 800, final: true },
  { char: "ץ", name: "tsadhe final", value: 900, final: true },
];

const GREEK_ISOPSEPHY: readonly LetterValue[] = [
  { char: "α", name: "alpha", value: 1 },
  { char: "β", name: "beta", value: 2 },
  { char: "γ", name: "gamma", value: 3 },
  { char: "δ", name: "delta", value: 4 },
  { char: "ε", name: "epsilon", value: 5 },
  { char: "ϛ", name: "digamma", value: 6 },
  { char: "ζ", name: "zeta", value: 7 },
  { char: "η", name: "eta", value: 8 },
  { char: "θ", name: "theta", value: 9 },
  { char: "ι", name: "iota", value: 10 },
  { char: "κ", name: "kappa", value: 20 },
  { char: "λ", name: "lambda", value: 30 },
  { char: "μ", name: "mu", value: 40 },
  { char: "ν", name: "nu", value: 50 },
  { char: "ξ", name: "xi", value: 60 },
  { char: "ο", name: "omicron", value: 70 },
  { char: "π", name: "pi", value: 80 },
  { char: "ϟ", name: "koppa", value: 90 },
  { char: "ρ", name: "rho", value: 100 },
  { char: "σ", name: "sigma", value: 200 },
  { char: "ς", name: "sigma final", value: 200, final: true },
  { char: "τ", name: "tau", value: 300 },
  { char: "υ", name: "upsilon", value: 400 },
  { char: "φ", name: "phi", value: 500 },
  { char: "χ", name: "chi", value: 600 },
  { char: "ψ", name: "psi", value: 700 },
  { char: "ω", name: "omega", value: 800 },
  { char: "ϡ", name: "sampi", value: 900 },
];

const GREEK_ORDINAL: readonly LetterValue[] = [
  { char: "α", name: "alpha", value: 1 },
  { char: "β", name: "beta", value: 2 },
  { char: "γ", name: "gamma", value: 3 },
  { char: "δ", name: "delta", value: 4 },
  { char: "ε", name: "epsilon", value: 5 },
  { char: "ζ", name: "zeta", value: 6 },
  { char: "η", name: "eta", value: 7 },
  { char: "θ", name: "theta", value: 8 },
  { char: "ι", name: "iota", value: 9 },
  { char: "κ", name: "kappa", value: 10 },
  { char: "λ", name: "lambda", value: 11 },
  { char: "μ", name: "mu", value: 12 },
  { char: "ν", name: "nu", value: 13 },
  { char: "ξ", name: "xi", value: 14 },
  { char: "ο", name: "omicron", value: 15 },
  { char: "π", name: "pi", value: 16 },
  { char: "ρ", name: "rho", value: 17 },
  { char: "σ", name: "sigma", value: 18 },
  { char: "ς", name: "sigma final", value: 18, final: true },
  { char: "τ", name: "tau", value: 19 },
  { char: "υ", name: "upsilon", value: 20 },
  { char: "φ", name: "phi", value: 21 },
  { char: "χ", name: "chi", value: 22 },
  { char: "ψ", name: "psi", value: 23 },
  { char: "ω", name: "omega", value: 24 },
];

const LATIN_AGRIPPA: readonly LetterValue[] = [
  { char: "A", name: "A", value: 1 },
  { char: "B", name: "B", value: 2 },
  { char: "C", name: "C", value: 3 },
  { char: "D", name: "D", value: 4 },
  { char: "E", name: "E", value: 5 },
  { char: "F", name: "F", value: 6 },
  { char: "G", name: "G", value: 7 },
  { char: "H", name: "H", value: 8 },
  { char: "I", name: "I", value: 9 },
  { char: "J", name: "J (consonantal I)", value: 600 },
  { char: "K", name: "K", value: 10 },
  { char: "L", name: "L", value: 20 },
  { char: "M", name: "M", value: 30 },
  { char: "N", name: "N", value: 40 },
  { char: "O", name: "O", value: 50 },
  { char: "P", name: "P", value: 60 },
  { char: "Q", name: "Q", value: 70 },
  { char: "R", name: "R", value: 80 },
  { char: "S", name: "S", value: 90 },
  { char: "T", name: "T", value: 100 },
  { char: "U", name: "U (consonantal V)", value: 700 },
  { char: "V", name: "V", value: 200 },
  { char: "X", name: "X", value: 300 },
  { char: "Y", name: "Y", value: 400 },
  { char: "Z", name: "Z", value: 500 },
];

export const LETTER_SYSTEMS: Record<LetterSystemId, LetterSystem> = {
  hebrew: {
    id: "hebrew",
    source: "Agrippa, Three Books of Occult Philosophy (J.F., 1651), Book II ch. XIX; finals at base values per ch. XXII",
    entries: [...HEBREW_BASE, ...HEBREW_FINALS_AT_BASE],
  },
  "hebrew-finals": {
    id: "hebrew-finals",
    source: "Agrippa, Three Books of Occult Philosophy (J.F., 1651), Book II ch. XIX; finals at 500–900",
    entries: [...HEBREW_BASE, ...HEBREW_FINALS_AT_HUNDREDS],
  },
  "greek-isopsephy": {
    id: "greek-isopsephy",
    source: "Agrippa, Three Books of Occult Philosophy (J.F., 1651), Book II ch. XVIII, second order",
    entries: GREEK_ISOPSEPHY,
  },
  "greek-ordinal": {
    id: "greek-ordinal",
    source: "Agrippa, Three Books of Occult Philosophy (J.F., 1651), Book II ch. XVIII, first order",
    entries: GREEK_ORDINAL,
  },
  "latin-agrippa": {
    id: "latin-agrippa",
    source: "Agrippa, Three Books of Occult Philosophy (J.F., 1651), Book II ch. XX",
    entries: LATIN_AGRIPPA,
  },
};

const LOOKUPS: Record<LetterSystemId, Map<string, number>> = {
  hebrew: new Map(LETTER_SYSTEMS.hebrew.entries.map((e) => [e.char, e.value])),
  "hebrew-finals": new Map(LETTER_SYSTEMS["hebrew-finals"].entries.map((e) => [e.char, e.value])),
  "greek-isopsephy": new Map(
    LETTER_SYSTEMS["greek-isopsephy"].entries.flatMap((e) => [
      [e.char, e.value],
      [e.char.toUpperCase(), e.value],
    ] as [string, number][]),
  ),
  "greek-ordinal": new Map(
    LETTER_SYSTEMS["greek-ordinal"].entries.flatMap((e) => [
      [e.char, e.value],
      [e.char.toUpperCase(), e.value],
    ] as [string, number][]),
  ),
  "latin-agrippa": new Map(
    LETTER_SYSTEMS["latin-agrippa"].entries.flatMap((e) => [
      [e.char, e.value],
      [e.char.toLowerCase(), e.value],
    ] as [string, number][]),
  ),
};

/** The value of one letter in a system, or undefined if it carries none. */
export function letterValue(system: LetterSystemId, char: string): number | undefined {
  return LOOKUPS[system].get(char);
}

export interface GematriaLetter {
  char: string;
  value: number;
}

export interface GematriaResult {
  total: number;
  /** The letters that carried a value, in order. */
  letters: GematriaLetter[];
  /** The characters that carried no value (spaces, punctuation), in order. */
  skipped: string[];
}

/**
 * The value of a word or phrase in a letter system: the sum of its letters'
 * values. Characters outside the system are skipped and reported.
 */
export function gematria(text: string, system: LetterSystemId): GematriaResult {
  const letters: GematriaLetter[] = [];
  const skipped: string[] = [];
  let total = 0;
  for (const char of text) {
    const value = letterValue(system, char);
    if (value === undefined) {
      skipped.push(char);
    } else {
      letters.push({ char, value });
      total += value;
    }
  }
  return { total, letters, skipped };
}

/**
 * Notarikon, the mechanical direction: the initial letters of a phrase's
 * words gathered into a word. The classic example is AGLA from "Atah Gibor
 * Le-olam Adonai". The expansion direction (reading each letter of a word
 * as the initial of a word in a phrase) chooses words and is interpretation,
 * so it lives outside the engine.
 */
export function notarikon(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => [...w][0])
    .join("");
}

const HEBREW_ALPHABET = HEBREW_BASE.map((e) => e.char);
const HEBREW_FINAL_OF: Record<string, string> = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };
const HEBREW_BASE_OF: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * Build a temurah substitution table from pairs of alphabet indices. A
 * final form maps to the final form of its partner letter when the partner
 * has one, otherwise to the partner's base form.
 */
function temurahTable(pairs: [number, number][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [a, b] of pairs) {
    const A = HEBREW_ALPHABET[a];
    const B = HEBREW_ALPHABET[b];
    map.set(A, B);
    map.set(B, A);
    const finalA = HEBREW_FINAL_OF[A];
    const finalB = HEBREW_FINAL_OF[B];
    if (finalA) map.set(finalA, finalB ?? B);
    if (finalB) map.set(finalB, finalA ?? A);
  }
  return map;
}

function applyTemurah(text: string, table: Map<string, string>): string {
  return [...text]
    .map((char) => table.get(char) ?? char)
    .join("");
}

/** Render word-final caph, mem, nun, phe, and tsadhe in their final forms. */
function finalizeHebrewWords(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (word.length === 0 || /^\s+$/.test(word)) return word;
      const chars = [...word];
      const last = chars[chars.length - 1];
      const final = HEBREW_FINAL_OF[last];
      if (final) chars[chars.length - 1] = final;
      return chars.join("");
    })
    .join("");
}

/**
 * Atbash: the alphabet folded on itself, aleph with tau, beth with shin.
 * Attested in Jeremiah 25:26, where Babel (בבל) is written Sheshach (ששך).
 * Output words end in final forms where the letters have them.
 */
export function atbash(text: string): string {
  const pairs: [number, number][] = [];
  for (let i = 0; i < 11; i++) pairs.push([i, 21 - i]);
  return finalizeHebrewWords(applyTemurah(text, temurahTable(pairs)));
}

/**
 * Albam: the alphabet split in two halves, the first letter paired with the
 * twelfth, aleph with lamed. Output words end in final forms where the
 * letters have them.
 */
export function albam(text: string): string {
  const pairs: [number, number][] = [];
  for (let i = 0; i < 11; i++) pairs.push([i, i + 11]);
  return finalizeHebrewWords(applyTemurah(text, temurahTable(pairs)));
}
