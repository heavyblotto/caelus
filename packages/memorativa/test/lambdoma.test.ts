/**
 * Lambdoma checks: the Pythagorean ratio table. The committed pins are the
 * classical concord ratios and the table's arithmetic identities, public
 * domain since antiquity (Nicomachus, Theon of Smyrna). The printed ratio
 * tables in godwin-02 and guthrie-02 (private store) pin the fixture tables
 * when the pipeline track delivers them.
 */
import { ratio, lambdoma, type Ratio } from "../src/lambdoma.js";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}
function eqRatio(got: Ratio, p: number, q: number, msg: string): void {
  if (got.p !== p || got.q !== q) {
    failures++;
    console.error(`FAIL ${msg}: ${got.p}:${got.q} !== ${p}:${q}`);
  }
}

// Ratios reduce to lowest terms.
eqRatio(ratio(1, 1), 1, 1, "unity");
eqRatio(ratio(2, 4), 1, 2, "2:4 reduces to 1:2");
eqRatio(ratio(6, 8), 3, 4, "6:8 reduces to 3:4");
eqRatio(ratio(9, 8), 9, 8, "9:8 is already reduced (the tone)");

let threw = false;
try { ratio(0, 1); } catch { threw = true; }
ok(threw, "ratio rejects zero");
threw = false;
try { ratio(3, -2); } catch { threw = true; }
ok(threw, "ratio rejects negatives");
threw = false;
try { ratio(1.5, 2); } catch { threw = true; }
ok(threw, "ratio rejects non-integers");

// The table's shape and legs.
const t1 = lambdoma(1);
ok(t1.length === 1 && t1[0].length === 1, "lambdoma(1) is the apex alone");
eqRatio(t1[0][0], 1, 1, "the apex is 1:1");

const t4 = lambdoma(4);
ok(t4.length === 4 && t4.every((r) => r.length === 4), "lambdoma(4) is 4 by 4");
// Row 1 is the harmonic leg: 1:1, 1:2, 1:3, 1:4.
for (let b = 1; b <= 4; b++) eqRatio(t4[0][b - 1], 1, b, `harmonic leg 1:${b}`);
// Column 1 is the arithmetic leg: 1:1, 2:1, 3:1, 4:1.
for (let a = 1; a <= 4; a++) eqRatio(t4[a - 1][0], a, 1, `arithmetic leg ${a}:1`);

// The classical concords sit in the table: octave 2:1, fifth 3:2, fourth 4:3.
eqRatio(t4[1][0], 2, 1, "the octave 2:1");
eqRatio(t4[2][1], 3, 2, "the fifth 3:2");
eqRatio(t4[3][2], 4, 3, "the fourth 4:3");

// Symmetry: cell (a, b) is the reciprocal of cell (b, a).
const t9 = lambdoma(9);
for (let a = 1; a <= 9; a++) {
  for (let b = 1; b <= 9; b++) {
    const ab = t9[a - 1][b - 1];
    const ba = t9[b - 1][a - 1];
    ok(ab.p === ba.q && ab.q === ba.p, `reciprocal symmetry at ${a}:${b}`);
  }
}
// The tone 9:8 sits at the lambdoma(9) interior.
eqRatio(t9[8][7], 9, 8, "the tone 9:8");

threw = false;
try { lambdoma(0); } catch { threw = true; }
ok(threw, "lambdoma rejects zero depth");

console.log(`\nlambdoma: ${failures} failures`);
process.exit(failures ? 1 : 0);
