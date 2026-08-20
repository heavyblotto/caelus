/**
 * Theosophical arithmetic: reduction, addition, and the neutralization
 * operators.
 *
 * The definitions of record are the public ones in Papus, "The Tarot of the
 * Bohemians", ch. III ("The Esoterism of Numbers"): theosophical reduction
 * sums the digits of a number until one figure remains; theosophical
 * addition sums the series from unity to the number inclusively. Papus'
 * printed example of neutralization is the binary: "the union of the Unity
 * and Duality proceeds the third principle, which unites the two opposites
 * in one common neutrality, 1 + 2 = 3."
 *
 * The printed tables in encausse-01 (private store) are the golden oracle
 * for these operators; the hash-pinned fixtures arrive with the local
 * pipeline track and gate the same functions.
 */

function assertPositiveInteger(n: number, fn: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`${fn}: expected a positive integer, got ${n}`);
  }
}

/**
 * Theosophical reduction: sum the digits repeatedly until one figure
 * remains. Multiples of nine reduce to 9, not 0; the tradition's domain is
 * the positive integers and its range is 1–9. reduce(0) returns 0 as a
 * convenience for arithmetic callers.
 */
export function theosophicalReduce(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`theosophicalReduce: expected a non-negative integer, got ${n}`);
  }
  let current = n;
  while (current > 9) {
    let sum = 0;
    for (const d of String(current)) sum += Number(d);
    current = sum;
  }
  return current;
}

/**
 * The reduction chain from n down to its single figure, e.g. 365 gives
 * [365, 14, 5]. Widgets render the steps; `theosophicalReduce` is the last
 * element.
 */
export function theosophicalReduceSteps(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`theosophicalReduceSteps: expected a non-negative integer, got ${n}`);
  }
  const steps = [n];
  while (steps[steps.length - 1] > 9) {
    let sum = 0;
    for (const d of String(steps[steps.length - 1])) sum += Number(d);
    steps.push(sum);
  }
  return steps;
}

/**
 * Theosophical addition: the value of n is 1 + 2 + ... + n. Papus' printed
 * examples: 4 has the value 10 (the tetraktys), 7 has the value 28.
 */
export function theosophicalAdd(n: number): number {
  assertPositiveInteger(n, "theosophicalAdd");
  return (n * (n + 1)) / 2;
}

/**
 * The neutralization operators for binaries, ternaries, and quaternaries:
 * two, three, or four terms are united in one common neutrality, the
 * theosophical reduction of their sum. Papus' printed binary: 1 and 2
 * neutralize to 3.
 */
export function neutralize(...terms: number[]): number {
  if (terms.length < 2 || terms.length > 4) {
    throw new RangeError(
      `neutralize: expected 2 to 4 terms (binary, ternary, quaternary), got ${terms.length}`,
    );
  }
  let sum = 0;
  for (const t of terms) {
    assertPositiveInteger(t, "neutralize");
    sum += t;
  }
  return theosophicalReduce(sum);
}
