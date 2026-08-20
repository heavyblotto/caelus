/**
 * The seven planetary kameas: construction data, magic constants, and sigil
 * tracing across the squares.
 *
 * The grids are the arrangements printed in Agrippa, "Three Books of Occult
 * Philosophy" (J.F., 1651), Book II ch. XXII, "Of the tables of the
 * Planets". The chapter's text gives each square's line constant and total
 * (Saturn 15 and 45, Jupiter 34 and 136, Mars 65 and 325, the Sun 111 and
 * 666, Venus 175 and 1225, Mercury 260 and 2080, the Moon 369 and 3321);
 * the golden test asserts the grids reproduce them.
 */

import { theosophicalReduce } from "./theosophy.js";
import { letterValue, type LetterSystemId } from "./gematria.js";

export type KameaPlanet =
  | "saturn"
  | "jupiter"
  | "mars"
  | "sun"
  | "venus"
  | "mercury"
  | "moon";

export interface KameaCell {
  row: number;
  col: number;
}

export interface Kamea {
  planet: KameaPlanet;
  /** The side of the square: 3 for Saturn through 9 for the Moon. */
  order: number;
  /** The printed arrangement, row-major. */
  grid: readonly (readonly number[])[];
  /** What every row, column, and diameter sums to: order(order² + 1)/2. */
  magicConstant: number;
  /** The sum of the whole square: order²(order² + 1)/2. */
  total: number;
}

/** The magic constant of the square of the given order. */
export function magicConstant(order: number): number {
  return (order * (order * order + 1)) / 2;
}

/** The sum of every cell of the square of the given order. */
export function kameaTotal(order: number): number {
  return (order * order * (order * order + 1)) / 2;
}

const GRIDS: Record<KameaPlanet, readonly (readonly number[])[]> = {
  saturn: [
    [4, 9, 2],
    [3, 5, 7],
    [8, 1, 6],
  ],
  jupiter: [
    [4, 14, 15, 1],
    [9, 7, 6, 12],
    [5, 11, 10, 8],
    [16, 2, 3, 13],
  ],
  mars: [
    [11, 24, 7, 20, 3],
    [4, 12, 25, 8, 16],
    [17, 5, 13, 21, 9],
    [10, 18, 1, 14, 22],
    [23, 6, 19, 2, 15],
  ],
  sun: [
    [6, 32, 3, 34, 35, 1],
    [7, 11, 27, 28, 8, 30],
    [19, 14, 16, 15, 23, 24],
    [18, 20, 22, 21, 17, 13],
    [25, 29, 10, 9, 26, 12],
    [36, 5, 33, 4, 2, 31],
  ],
  venus: [
    [22, 47, 16, 41, 10, 35, 4],
    [5, 23, 48, 17, 42, 11, 29],
    [30, 6, 24, 49, 18, 36, 12],
    [13, 31, 7, 25, 43, 19, 37],
    [38, 14, 32, 1, 26, 44, 20],
    [21, 39, 8, 33, 2, 27, 45],
    [46, 15, 40, 9, 34, 3, 28],
  ],
  mercury: [
    [8, 58, 59, 5, 4, 62, 63, 1],
    [49, 15, 14, 52, 53, 11, 10, 56],
    [41, 23, 22, 44, 45, 19, 18, 48],
    [32, 34, 35, 29, 28, 38, 39, 25],
    [40, 26, 27, 37, 36, 30, 31, 33],
    [17, 47, 46, 20, 21, 43, 42, 24],
    [9, 55, 54, 12, 13, 51, 50, 16],
    [64, 2, 3, 61, 60, 6, 7, 57],
  ],
  moon: [
    [37, 78, 29, 70, 21, 62, 13, 54, 5],
    [6, 38, 79, 30, 71, 22, 63, 14, 46],
    [47, 7, 39, 80, 31, 72, 23, 55, 15],
    [16, 48, 8, 40, 81, 32, 64, 24, 56],
    [57, 17, 49, 9, 41, 73, 33, 65, 25],
    [26, 58, 18, 50, 1, 42, 74, 34, 66],
    [67, 27, 59, 10, 51, 2, 43, 75, 35],
    [36, 68, 19, 60, 11, 52, 3, 44, 76],
    [77, 28, 69, 20, 61, 12, 53, 4, 45],
  ],
};

function buildKamea(planet: KameaPlanet): Kamea {
  const grid = GRIDS[planet];
  const order = grid.length;
  return {
    planet,
    order,
    grid,
    magicConstant: magicConstant(order),
    total: kameaTotal(order),
  };
}

export const KAMEAS: Record<KameaPlanet, Kamea> = {
  saturn: buildKamea("saturn"),
  jupiter: buildKamea("jupiter"),
  mars: buildKamea("mars"),
  sun: buildKamea("sun"),
  venus: buildKamea("venus"),
  mercury: buildKamea("mercury"),
  moon: buildKamea("moon"),
};

/** The kamea of a planet, in the Chaldean order Saturn through the Moon. */
export function kamea(planet: KameaPlanet): Kamea {
  return KAMEAS[planet];
}

/** The cell holding a value on the square. Values run 1 to order². */
export function cellOf(k: Kamea, value: number): KameaCell {
  if (!Number.isInteger(value) || value < 1 || value > k.order * k.order) {
    throw new RangeError(
      `cellOf: ${k.planet} holds values 1 to ${k.order * k.order}, got ${value}`,
    );
  }
  for (let row = 0; row < k.order; row++) {
    for (let col = 0; col < k.order; col++) {
      if (k.grid[row][col] === value) return { row, col };
    }
  }
  throw new RangeError(`cellOf: ${value} not found on the ${k.planet} square`);
}

export interface SigilStep {
  /** The source character. */
  letter: string;
  /** Its value in the letter system. */
  value: number;
  /** The value reduced into the square's range. */
  reduced: number;
  /** The cell the reduced value occupies. */
  cell: KameaCell;
}

/**
 * Trace a name across a planet's kamea toward its sigil: each letter takes
 * its value in the given system, values above the square's range are
 * theosophically reduced until they fit, and the reduced values locate the
 * cells the sigil line visits, in order. Characters outside the letter
 * system are skipped. The reduction rule is the one the tradition's printed
 * sigils follow (a value too large for the square is reduced by digit-sum).
 */
export function sigilTrace(
  name: string,
  system: LetterSystemId,
  planet: KameaPlanet,
): SigilStep[] {
  const k = kamea(planet);
  const max = k.order * k.order;
  const steps: SigilStep[] = [];
  for (const letter of name) {
    const value = letterValue(system, letter);
    if (value === undefined) continue;
    let reduced = value;
    while (reduced > max) reduced = theosophicalReduce(reduced);
    steps.push({ letter, value, reduced, cell: cellOf(k, reduced) });
  }
  return steps;
}
