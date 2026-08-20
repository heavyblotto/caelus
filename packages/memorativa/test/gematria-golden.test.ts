/**
 * Gematria golden: the letter-value tables pinned against Agrippa, "Three
 * Books of Occult Philosophy" (J.F., 1651), Book II ch. XVIII–XX, all
 * public domain. Notarikon and temurah pin their classical attestations
 * (AGLA; Sheshach for Babel in Jeremiah 25:26).
 *
 * The chapter XXII name rows whose printed values disagree with the printed
 * Hebrew are asserted at their computed values here, with the printed
 * figures in commentary; they are the QA rows for the private pipeline's
 * fixture work.
 */
import {
  LETTER_SYSTEMS,
  letterValue,
  gematria,
  notarikon,
  atbash,
  albam,
} from "../src/gematria.js";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}
function eq<T>(got: T, want: T, msg: string): void {
  if (got !== want) { failures++; console.error(`FAIL ${msg}: ${got} !== ${want}`); }
}

// Hebrew, ch. XIX: units, tens, hundreds, and the five finals.
const HEBREW_VALUES: [string, number][] = [
  ["א", 1], ["ב", 2], ["ג", 3], ["ד", 4], ["ה", 5], ["ו", 6], ["ז", 7],
  ["ח", 8], ["ט", 9], ["י", 10], ["כ", 20], ["ל", 30], ["מ", 40], ["נ", 50],
  ["ס", 60], ["ע", 70], ["פ", 80], ["צ", 90], ["ק", 100], ["ר", 200],
  ["ש", 300], ["ת", 400],
];
for (const [char, value] of HEBREW_VALUES) {
  eq(letterValue("hebrew", char), value, `hebrew ${char}`);
}
// In the name-computation convention the finals count at base value:
// Agrippa's ch. XXII tables print Elim as 81 and Din as 64.
eq(letterValue("hebrew", "ם"), 40, "hebrew mem final at base value");
eq(letterValue("hebrew", "ן"), 50, "hebrew nun final at base value");
eq(gematria("אלים", "hebrew").total, 81, "Elim is 81 (printed)");
eq(gematria("דין", "hebrew").total, 64, "Din is 64 (printed)");
// The ch. XIX numeral-mark table counts the finals at 500–900.
eq(letterValue("hebrew-finals", "ך"), 500, "hebrew-finals caph final");
eq(letterValue("hebrew-finals", "ם"), 600, "hebrew-finals mem final");
eq(letterValue("hebrew-finals", "ן"), 700, "hebrew-finals nun final");
eq(letterValue("hebrew-finals", "ף"), 800, "hebrew-finals phe final");
eq(letterValue("hebrew-finals", "ץ"), 900, "hebrew-finals tsadhe final");
eq(gematria("אלים", "hebrew-finals").total, 641, "Elim at hundreds-valued finals");

// Greek isopsephy, ch. XVIII second order (three classes after the Hebrews).
const GREEK_ISOPSEPHY: [string, number][] = [
  ["α", 1], ["β", 2], ["γ", 3], ["δ", 4], ["ε", 5], ["ϛ", 6], ["ζ", 7],
  ["η", 8], ["θ", 9], ["ι", 10], ["κ", 20], ["λ", 30], ["μ", 40], ["ν", 50],
  ["ξ", 60], ["ο", 70], ["π", 80], ["ϟ", 90], ["ρ", 100], ["σ", 200],
  ["ς", 200], ["τ", 300], ["υ", 400], ["φ", 500], ["χ", 600], ["ψ", 700],
  ["ω", 800], ["ϡ", 900],
];
for (const [char, value] of GREEK_ISOPSEPHY) {
  eq(letterValue("greek-isopsephy", char), value, `greek-isopsephy ${char}`);
}
eq(letterValue("greek-isopsephy", "Α"), 1, "isopsephy folds case");
eq(gematria("αβγω", "greek-isopsephy").total, 806, "isopsephy sum 1+2+3+800");

// Greek ordinal, ch. XVIII first order (alphabet place).
eq(letterValue("greek-ordinal", "α"), 1, "ordinal alpha");
eq(letterValue("greek-ordinal", "ι"), 9, "ordinal iota");
eq(letterValue("greek-ordinal", "ω"), 24, "ordinal omega");
eq(gematria("αβγω", "greek-ordinal").total, 30, "ordinal sum 1+2+3+24");

// Latin, ch. XX: units A–I, tens K–S, hundreds T–Z, then the consonantal
// I (J) at 600 and consonantal V (U) at 700. The printed aspirate digraphs
// HI 800 and HV 900 are not applied letter-by-letter.
const LATIN: [string, number][] = [
  ["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5], ["F", 6], ["G", 7],
  ["H", 8], ["I", 9], ["K", 10], ["L", 20], ["M", 30], ["N", 40], ["O", 50],
  ["P", 60], ["Q", 70], ["R", 80], ["S", 90], ["T", 100], ["V", 200],
  ["X", 300], ["Y", 400], ["Z", 500], ["J", 600], ["U", 700],
];
for (const [char, value] of LATIN) {
  eq(letterValue("latin-agrippa", char), value, `latin-agrippa ${char}`);
}
eq(letterValue("latin-agrippa", "a"), 1, "latin folds case");
eq(letterValue("latin-agrippa", "W"), undefined, "W is outside the 1651 alphabet");
eq(gematria("AGRIPPA", "latin-agrippa").total, 218, "latin sum 1+7+80+9+60+60+1");

// gematria reports the letters it counted and the characters it skipped.
const elAb = gematria("אל אב", "hebrew");
eq(elAb.total, 34, "El Ab total");
eq(elAb.letters.length, 4, "El Ab counts four letters");
ok(elAb.skipped.length === 1 && elAb.skipped[0] === " ", "El Ab skips the space");

// Notarikon: the initials of the phrase gather into the word.
eq(notarikon("Atah Gibor Le-olam Adonai"), "AGLA", "notarikon AGLA (printed)");

// Temurah. Atbash is attested in Jeremiah 25:26: Babel written as Sheshach.
eq(atbash("בבל"), "ששך", "atbash Babel is Sheshach (Jeremiah 25:26)");
eq(atbash(atbash("בבל")), "בבל", "atbash is an involution");
eq(atbash("א"), "ת", "atbash aleph");
// Albam pairs the halves of the alphabet: aleph with lamed.
eq(albam("א"), "ל", "albam aleph");
eq(albam(albam("שלום")), "שלום", "albam is an involution");

// Chapter XXII discrepancy rows: the printed values disagree with the
// printed Hebrew. Asserted at the computed values; the printed figures are
// the QA rows for the private fixture work.
eq(gematria("ברצאבאל", "hebrew").total, 326,
  "Barzabel as printed computes 326; the chapter prints 325 (variant ברצבאל computes 325)");
eq(gematria("ברצבאל", "hebrew").total, 325, "Barzabel variant computes the printed 325");
eq(gematria("קדמאל", "hebrew").total, 175,
  "Kedemel computes 175, the Venus constant; the chapter prints 157");
eq(gematria("השמודאי", "hebrew").total, 366,
  "Hasmodai as printed computes 366; the chapter prints 369 (variant חשמודאי computes 369)");
eq(gematria("חשמודאי", "hebrew").total, 369, "Chasmodai variant computes the printed 369");
eq(gematria("אזבוגה", "hebrew").total, 24,
  "Asboga computes 24; the chapter prints 8 for the octonarius extensus");

// Every system table is internally consistent: entries carry unique chars.
for (const system of Object.values(LETTER_SYSTEMS)) {
  const chars = system.entries.map((e) => e.char);
  ok(new Set(chars).size === chars.length, `${system.id} entries are unique`);
  ok(system.entries.every((e) => Number.isInteger(e.value) && e.value > 0),
    `${system.id} values are positive integers`);
}

console.log(`\ngematria-golden: ${failures} failures`);
process.exit(failures ? 1 : 0);
