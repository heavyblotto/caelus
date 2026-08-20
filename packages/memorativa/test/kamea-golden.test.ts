/**
 * Kamea golden: the seven planetary squares pinned against Agrippa, "Three
 * Books of Occult Philosophy" (J.F., 1651), Book II ch. XXII, a
 * public-domain printing. The grids live in src/kamea.ts as data; this
 * suite asserts they are valid magic squares, that their constants and
 * totals are the numbers the chapter's text prints, and that the chapter's
 * divine-name table computes to the same numbers under Hebrew gematria.
 *
 * The sigil traces pin the letter-by-letter path the kamea widget draws.
 */
import {
  KAMEAS,
  kamea,
  cellOf,
  magicConstant,
  kameaTotal,
  sigilTrace,
  type KameaPlanet,
} from "../src/kamea.js";
import { gematria } from "../src/gematria.js";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}
function eq<T>(got: T, want: T, msg: string): void {
  if (got !== want) { failures++; console.error(`FAIL ${msg}: ${got} !== ${want}`); }
}

// The chapter's printed figures: order, line constant, whole sum.
const PRINTED: [KameaPlanet, number, number, number][] = [
  ["saturn", 3, 15, 45],
  ["jupiter", 4, 34, 136],
  ["mars", 5, 65, 325],
  ["sun", 6, 111, 666],
  ["venus", 7, 175, 1225],
  ["mercury", 8, 260, 2080],
  ["moon", 9, 369, 3321],
];

for (const [planet, order, constant, total] of PRINTED) {
  const k = kamea(planet);
  eq(k.order, order, `${planet} order`);
  eq(k.magicConstant, constant, `${planet} magic constant (printed ${constant})`);
  eq(k.total, total, `${planet} total (printed ${total})`);
  eq(k.magicConstant, magicConstant(order), `${planet} constant formula`);
  eq(k.total, kameaTotal(order), `${planet} total formula`);

  // The square holds each number 1..order² exactly once.
  const seen = new Set(k.grid.flat());
  ok(seen.size === order * order, `${planet} holds ${order * order} distinct cells`);
  ok(Math.min(...seen) === 1 && Math.max(...seen) === order * order,
    `${planet} cells run 1..${order * order}`);

  // Every row, column, and diameter sums to the constant.
  for (let i = 0; i < order; i++) {
    eq(k.grid[i].reduce((a, b) => a + b, 0), constant, `${planet} row ${i}`);
    eq(k.grid.reduce((a, r) => a + r[i], 0), constant, `${planet} column ${i}`);
  }
  eq(k.grid.reduce((a, r, i) => a + r[i], 0), constant, `${planet} diagonal`);
  eq(k.grid.reduce((a, r, i) => a + r[order - 1 - i], 0), constant, `${planet} counter-diagonal`);

  // cellOf round-trips the grid.
  for (let row = 0; row < order; row++) {
    for (let col = 0; col < order; col++) {
      const c = cellOf(k, k.grid[row][col]);
      ok(c.row === row && c.col === col, `${planet} cellOf ${k.grid[row][col]}`);
    }
  }
}

let threw = false;
try { cellOf(kamea("saturn"), 10); } catch { threw = true; }
ok(threw, "cellOf rejects a value above the square's range");

// The chapter's divine-name table: the names' Hebrew gematria equals the
// kamea figures they are set over. Only rows whose printed Hebrew computes
// to the printed value are pinned here; the discrepant rows are documented
// in gematria-golden.test.ts.
const NAMES: [string, number, string][] = [
  // [Hebrew, value, anchor]
  ["אב", 3, "Ab, Saturn's order"],
  ["הד", 9, "Hod, Saturn's cell count"],
  ["יה", 15, "Iah, Saturn's constant"],
  ["הוד", 15, "Hod, Saturn's constant"],
  ["יוד הא ואו הא", 45, "Jehovah extended, Saturn's total"],
  ["אגיאל", 45, "Agiel, the Intelligence of Saturn"],
  ["זאזל", 45, "Zazel, the spirit of Saturn"],
  ["אבא", 4, "Abba, Jupiter's order"],
  ["הוה", 16, "Jupiter's cell count"],
  ["אהי", 16, "Jupiter's cell count"],
  ["אל אב", 34, "El Ab, Jupiter's constant"],
  ["יהפיאל", 136, "Johphiel, the Intelligence of Jupiter"],
  ["הסמאל", 136, "Hismael, the spirit of Jupiter"],
  ["ה", 5, "He, Mars' order"],
  ["יהי", 25, "Mars' cell count"],
  ["אדני", 65, "Adonay, Mars' constant"],
  ["גראפיאל", 325, "Graphiel, the Intelligence of Mars"],
  ["ו", 6, "Vau, the Sun's order"],
  ["הא", 6, "He extended, the Sun's order"],
  ["אלה", 36, "Eloh, the Sun's cell count"],
  ["נכיאל", 111, "Nachiel, the Intelligence of the Sun"],
  ["סורת", 666, "Sorath, the spirit of the Sun"],
  ["אהא", 7, "Venus' order"],
  ["הגיאל", 49, "Hagiel, the Intelligence of Venus"],
  ["דין", 64, "Din, Mercury's cell count"],
  ["דני", 64, "Doni, Mercury's cell count"],
  ["טיריאל", 260, "Tiriel, the Intelligence of Mercury"],
  ["תפתרתרת", 2080, "Taphthartharath, the spirit of Mercury"],
  ["אלים", 81, "Elim, the Moon's cell count"],
];
for (const [name, value, anchor] of NAMES) {
  eq(gematria(name, "hebrew").total, value, `gematria ${anchor}`);
}

// Sigil traces: the letter-by-letter path across the square. Agiel
// (אגיאל = 1, 3, 10, 1, 30) on Saturn's square reduces 10 to 1 and 30 to 3.
const agiel = sigilTrace("אגיאל", "hebrew", "saturn");
eq(agiel.length, 5, "Agiel trace length");
eq(agiel.map((s) => s.reduced).join(","), "1,3,1,1,3", "Agiel reduced values");
eq(agiel.map((s) => `${s.cell.row},${s.cell.col}`).join(" "), "2,1 1,0 2,1 2,1 1,0",
  "Agiel cells on the Saturn square");

// Tiriel (טיריאל = 9, 10, 200, 10, 1, 30) on Mercury's square: 200 reduces
// to 2; the rest fit the 8 by 8 square as they stand, 30 included.
const tiriel = sigilTrace("טיריאל", "hebrew", "mercury");
eq(tiriel.map((s) => s.reduced).join(","), "9,10,2,10,1,30", "Tiriel reduced values");
eq(tiriel.map((s) => `${s.cell.row},${s.cell.col}`).join(" "),
  "6,0 1,6 7,1 1,6 0,7 4,5", "Tiriel cells on the Mercury square");

// Characters outside the letter system are skipped.
eq(sigilTrace("אגיאל!", "hebrew", "saturn").length, 5, "unvalued characters skip");

console.log(`\nkamea-golden: ${failures} failures`);
process.exit(failures ? 1 : 0);
