/**
 * Theosophical arithmetic checks. The printed oracle is Papus, "The Tarot
 * of the Bohemians" ch. III (public domain): reduction to a single figure,
 * addition as the sum of the series from unity, and the printed binary
 * neutralization 1 + 2 = 3. The encausse-01 tables (private store) pin the
 * full fixture tables when the pipeline track delivers them.
 */
import {
  theosophicalReduce,
  theosophicalReduceSteps,
  theosophicalAdd,
  neutralize,
} from "../src/theosophy.js";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}
function eq<T>(got: T, want: T, msg: string): void {
  if (got !== want) { failures++; console.error(`FAIL ${msg}: ${got} !== ${want}`); }
}

// Reduction: all numbers reduce to the nine first figures.
eq(theosophicalReduce(1), 1, "reduce 1");
eq(theosophicalReduce(9), 9, "reduce 9 stays 9");
eq(theosophicalReduce(10), 1, "reduce 10");
eq(theosophicalReduce(365), 5, "reduce 365");
eq(theosophicalReduce(666), 9, "reduce 666 is 9, not 0");
eq(theosophicalReduce(9999), 9, "reduce 9999");
eq(theosophicalReduce(0), 0, "reduce 0 is 0 (arithmetic convenience)");

// Reduction steps expose the chain for display.
const steps = theosophicalReduceSteps(365);
ok(steps.length === 3 && steps[0] === 365 && steps[1] === 14 && steps[2] === 5,
  "reduce steps 365 -> 14 -> 5");
eq(theosophicalReduceSteps(7).length, 1, "single figure reduces in place");

// Addition: Papus prints 4 = 10 (the tetraktys) and 7 = 28.
eq(theosophicalAdd(1), 1, "add 1");
eq(theosophicalAdd(4), 10, "add 4 is 10 (tetraktys)");
eq(theosophicalAdd(7), 28, "add 7 is 28");
eq(theosophicalAdd(10), 55, "add 10");
for (let n = 1; n <= 50; n++) {
  eq(theosophicalAdd(n), (n * (n + 1)) / 2, `add ${n} is triangular`);
}

// Papus: "Through it we find that 1, 4, 7, 10 are equal to 1."
for (const n of [1, 4, 7, 10]) {
  eq(theosophicalReduce(theosophicalAdd(n)), 1, `add then reduce ${n} is 1`);
}

// Neutralization: the printed binary example is 1 + 2 = 3.
eq(neutralize(1, 2), 3, "neutralize the binary 1, 2 (printed)");
eq(neutralize(3, 4), 7, "neutralize the binary 3, 4");
eq(neutralize(1, 2, 3), 6, "neutralize the ternary 1, 2, 3");
eq(neutralize(1, 2, 3, 4), 1, "neutralize the quaternary 1, 2, 3, 4 (10 reduces to 1)");
eq(neutralize(9, 9), 9, "neutralize 9, 9 (18 reduces to 9)");

// Neutralization is the theosophical reduction of the sum.
eq(neutralize(5, 6, 7), theosophicalReduce(5 + 6 + 7), "neutralize agrees with reduce of sum");

// Domain errors.
let threw = false;
try { theosophicalReduce(-1); } catch { threw = true; }
ok(threw, "reduce rejects negatives");
threw = false;
try { theosophicalReduce(1.5); } catch { threw = true; }
ok(threw, "reduce rejects non-integers");
threw = false;
try { theosophicalAdd(0); } catch { threw = true; }
ok(threw, "add rejects zero");
threw = false;
try { neutralize(5); } catch { threw = true; }
ok(threw, "neutralize rejects a single term");
threw = false;
try { neutralize(1, 2, 3, 4, 5); } catch { threw = true; }
ok(threw, "neutralize rejects five terms");

console.log(`\ntheosophy: ${failures} failures`);
process.exit(failures ? 1 : 0);
