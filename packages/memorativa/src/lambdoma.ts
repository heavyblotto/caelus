/**
 * The lambdoma: the Pythagorean ratio table, shaped like the letter lambda.
 * The apex is 1:1, one leg carries the multiples (2:1, 3:1, 4:1, ...), the
 * other the submultiples (1:2, 1:3, 1:4, ...), and the interior holds every
 * ratio a:b with both terms within the depth. The table is the ancient
 * source of the musical concords: 2:1 the octave, 3:2 the fifth, 4:3 the
 * fourth.
 *
 * The printed ratio tables in godwin-02 and guthrie-02 (private store) are
 * the golden oracle; the hash-pinned fixtures arrive with the local
 * pipeline track. The committed tests pin the classical concord ratios and
 * the table's arithmetic identities.
 */

/** A ratio in reduced terms, q positive. */
export interface Ratio {
  p: number;
  q: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The ratio p:q in reduced terms. */
export function ratio(p: number, q: number): Ratio {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 1) {
    throw new RangeError(`ratio: expected positive integers, got ${p}:${q}`);
  }
  const d = gcd(p, q);
  return { p: p / d, q: q / d };
}

/**
 * The lambdoma of the given depth: a square table whose cell at row a,
 * column b (both 1-based in the figure) holds the reduced ratio a:b. Row 1
 * is the harmonic leg (1:1, 1:2, 1:3, ...), column 1 the arithmetic leg
 * (1:1, 2:1, 3:1, ...). The printed figures carry the ratios unreduced with
 * duplicates (2:2 beside 1:1); this table reduces them.
 */
export function lambdoma(depth: number): Ratio[][] {
  if (!Number.isInteger(depth) || depth < 1) {
    throw new RangeError(`lambdoma: expected a positive integer depth, got ${depth}`);
  }
  const table: Ratio[][] = [];
  for (let a = 1; a <= depth; a++) {
    const row: Ratio[] = [];
    for (let b = 1; b <= depth; b++) {
      row.push(ratio(a, b));
    }
    table.push(row);
  }
  return table;
}
