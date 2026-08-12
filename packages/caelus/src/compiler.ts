/**
 * astroengine compiler -- synthesize a chart form from geometric constraints.
 *
 * The inverse of (time, place) -> chart: given weighted geometric constraints,
 * find the body positions that best satisfy them, and report how well they
 * can be. If the best fit is still poor, the form is geometrically
 * impossible -- a valid result.
 *
 * A body's state is (longitude, latitude). The original three constraint
 * kinds (aspect / sign / degree) speak only about longitude; three
 * latitude-aware kinds place bodies on the sphere the tradition already
 * measures in: `declination` (the body's declination equals a value, derived
 * from (lon, lat) through the fixed J2000 mean obliquity -- a compiled form
 * has no instant, so the obliquity is a stated convention), `parallel` (two
 * bodies share a declination, or hold equal-and-opposite ones with `contra`),
 * and `separation3d` (the true great-circle separation equals an angle, via
 * {@link angularSeparation3d}).
 *
 * Positions passed to the loss functions may be bare longitudes (latitude 0
 * -- the legacy shape, bit-for-bit compatible) or `{ lon, lat }` objects.
 * The solver varies latitude only for bodies that a latitude-sensitive
 * constraint touches, inside per-body bounds ({@link BODY_LAT_BOUNDS} /
 * {@link DEFAULT_LAT_BOUND}, overridable via `latBounds` -- a fixed star may
 * need the full +/-90), so a longitude-only form compiles to exactly the
 * same answer as before, latitudes all zero.
 *
 * No angle or horizon constraint exists here, deliberately: a compiled form
 * has no instant and no ground (docs/provenance-layer.md -- the `none` place
 * is exactly the heliocentric / archetypal case), so an ascendant for it
 * would be a number someone chose.
 *
 * The loss / constraint math is pure and mirrors the Python reference
 * (astroengine/compiler.py), pinned by the golden. The optimizer is a
 * deterministic coordinate descent with fixed low-discrepancy restarts.
 */
import { DEG } from "./core.js";
import { angularSeparation3d } from "./spherical.js";

const PHI = 0.6180339887498949;

/** A compiled form has no instant, so declination constraints resolve through
 *  a fixed, stated convention: the J2000 mean obliquity, degrees. */
export const OBLIQUITY_J2000_DEG = 23.4392911;

/** Generous per-body latitude envelopes (deg) for the solver's search bounds:
 *  roughly the maximum geocentric ecliptic latitude each real body reaches.
 *  Bounds, not assertions -- anything not named gets {@link DEFAULT_LAT_BOUND},
 *  and `latBounds` overrides per body. */
export const DEFAULT_LAT_BOUND = 9.0;
export const BODY_LAT_BOUNDS: Record<string, number> = {
  sun: 0.001, moon: 6.0, mercury: 8.0, venus: 9.0, mars: 7.0,
  jupiter: 2.0, saturn: 3.0, uranus: 1.0, neptune: 2.0,
  pluto: 18.0, chiron: 8.0,
};

export type Constraint =
  | { kind: "aspect"; a: string; b: string; angle: number; weight?: number }
  | { kind: "sign"; body: string; sign: number; weight?: number }
  | { kind: "degree"; body: string; degree: number; weight?: number }
  | { kind: "declination"; body: string; degree: number; weight?: number }
  | { kind: "parallel"; a: string; b: string; contra?: boolean; weight?: number }
  | { kind: "separation3d"; a: string; b: string; angle: number; weight?: number };

/** A body's compiled state: ecliptic longitude and latitude, degrees. */
export interface BodyState { lon: number; lat: number }

/** Loss-function input: bare longitudes (latitude 0) or full states. */
export type Positions = Record<string, number | BodyState>;

const lonOf = (p: number | BodyState): number => (typeof p === "number" ? p : p.lon);
const latOf = (p: number | BodyState): number => (typeof p === "number" ? 0.0 : p.lat ?? 0.0);

/** Declination (deg) of an ecliptic (lon, lat) under a fixed obliquity. */
export function declinationOf(
  lonDeg: number, latDeg: number, obliquityDeg = OBLIQUITY_J2000_DEG,
): number {
  const lam = lonDeg * DEG;
  const beta = latDeg * DEG;
  const eps = obliquityDeg * DEG;
  const s = Math.sin(beta) * Math.cos(eps)
    + Math.cos(beta) * Math.sin(eps) * Math.sin(lam);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

function angDist(a: number, b: number): number {
  return Math.abs(((a - b + 180.0) % 360.0) - 180.0);
}

function signLoss(lon: number, sign: number): number {
  const lo = (((sign % 12) + 12) % 12) * 30.0;
  const d = (((lon - lo) % 360.0) + 360.0) % 360.0;
  if (d < 30.0) return 0.0;
  return Math.min(d - 30.0, 360.0 - d);
}

/**
 * Degrees by which a single {@link Constraint} is unmet for a set of body
 * positions — `0` when satisfied. The pure building block of {@link formLoss}
 * and {@link compileForm}.
 *
 * @param positions Body positions keyed by id: bare longitudes in degrees
 *   (latitude 0), or `{ lon, lat }` states.
 * @param c The constraint to score.
 * @returns The unmet amount in degrees (`0` = satisfied).
 */
export function constraintLoss(positions: Positions, c: Constraint): number {
  if (c.kind === "aspect") {
    return Math.abs(angDist(lonOf(positions[c.a]), lonOf(positions[c.b])) - c.angle);
  }
  if (c.kind === "sign") return signLoss(lonOf(positions[c.body]), c.sign);
  if (c.kind === "degree") return angDist(lonOf(positions[c.body]), c.degree);
  if (c.kind === "declination") {
    const p = positions[c.body];
    return Math.abs(declinationOf(lonOf(p), latOf(p)) - c.degree);
  }
  if (c.kind === "parallel") {
    const pa = positions[c.a];
    const pb = positions[c.b];
    const da = declinationOf(lonOf(pa), latOf(pa));
    const db = declinationOf(lonOf(pb), latOf(pb));
    return c.contra ? Math.abs(da + db) : Math.abs(da - db);
  }
  const pa = positions[c.a];
  const pb = positions[c.b];
  const sep = angularSeparation3d(lonOf(pa), latOf(pa), lonOf(pb), latOf(pb));
  return Math.abs(sep - c.angle);
}

/**
 * Total weighted loss for a set of body positions — the sum of each
 * constraint's {@link constraintLoss} times its weight. The objective
 * {@link compileForm} minimizes.
 *
 * @param positions Body positions keyed by id (bare longitudes or states).
 * @param constraints The constraints to score.
 * @returns The total weighted loss in degrees (`0` = all satisfied).
 */
export function formLoss(positions: Positions, constraints: Constraint[]): number {
  let total = 0;
  for (const c of constraints) total += (c.weight ?? 1.0) * constraintLoss(positions, c);
  return total;
}

const PAIR_KINDS = new Set(["aspect", "parallel", "separation3d"]);
const LAT_KINDS = new Set(["declination", "parallel", "separation3d"]);

function bodiesOf(constraints: Constraint[]): string[] {
  const s = new Set<string>();
  for (const c of constraints) {
    if (PAIR_KINDS.has(c.kind)) {
      const p = c as { a: string; b: string };
      s.add(p.a); s.add(p.b);
    } else {
      s.add((c as { body: string }).body);
    }
  }
  return [...s].sort();
}

/** Bodies a latitude-sensitive constraint touches: only these get a latitude
 *  sweep, so a longitude-only form compiles bit-for-bit as before. */
function latBodiesOf(constraints: Constraint[]): Set<string> {
  const s = new Set<string>();
  for (const c of constraints) {
    if (!LAT_KINDS.has(c.kind)) continue;
    if (PAIR_KINDS.has(c.kind)) {
      const p = c as { a: string; b: string };
      s.add(p.a); s.add(p.b);
    } else {
      s.add((c as { body: string }).body);
    }
  }
  return s;
}

function involves(c: Constraint, body: string): boolean {
  if (PAIR_KINDS.has(c.kind)) {
    const p = c as { a: string; b: string };
    return p.a === body || p.b === body;
  }
  return (c as { body: string }).body === body;
}

function bodyLoss(positions: Positions, body: string, constraints: Constraint[]): number {
  let total = 0;
  for (const c of constraints) if (involves(c, body)) total += (c.weight ?? 1.0) * constraintLoss(positions, c);
  return total;
}

export interface CompiledForm {
  longitudes: Record<string, number>;
  /** Solved ecliptic latitudes, degrees. Zero for every body no
   *  latitude-sensitive constraint touches (the legacy case). */
  latitudes: Record<string, number>;
  residual: number;
  maxConstraintLoss: number;
  impossible: boolean;
  constraints: Array<Constraint & { loss: number }>;
}

export interface CompileOptions {
  restarts?: number;
  iters?: number;
  /** A form is impossible when its worst constraint exceeds this (degrees). */
  impossibleDeg?: number;
  /** Per-body latitude search bound override, degrees (e.g. `{ algol: 90 }`
   *  for a fixed star). Defaults come from {@link BODY_LAT_BOUNDS} /
   *  {@link DEFAULT_LAT_BOUND}. */
  latBounds?: Record<string, number>;
}

/**
 * Synthesize a chart form from geometric constraints — the inverse of
 * (time, place) → chart. Given weighted {@link Constraint}s (aspects, sign
 * placements, exact degrees, declinations, parallels, true 3D separations),
 * find the body positions that best satisfy them via deterministic
 * coordinate descent over (longitude, latitude), and report how well they
 * can be met. When even the best fit is poor, the form is flagged
 * `impossible` — a valid, informative result.
 *
 * @param constraints The geometric constraints to satisfy; each may carry a
 *   `weight` (default `1`).
 * @param opts `restarts` and `iters` tune the optimizer (more = slower, more
 *   thorough); `impossibleDeg` is the worst-constraint threshold in degrees
 *   above which the form is impossible; `latBounds` widens a body's latitude
 *   search range. Defaults: `12`, `8`, `5`.
 * @returns A {@link CompiledForm}: solved `longitudes` and `latitudes`, total
 *   `residual`, `maxConstraintLoss`, the `impossible` flag, and each
 *   constraint annotated with its `loss`.
 * @example
 * ```ts
 * const form = compileForm([
 *   { kind: "parallel", a: "venus", b: "jupiter" },     // shared declination
 *   { kind: "declination", body: "moon", degree: -5 },
 *   { kind: "aspect", a: "venus", b: "jupiter", angle: 120 },
 * ]);
 * form.impossible;        // false
 * form.latitudes.venus;   // the latitude the parallel needed
 * ```
 */
export function compileForm(constraints: Constraint[], opts: CompileOptions = {}): CompiledForm {
  const restarts = opts.restarts ?? 12;
  const iters = opts.iters ?? 8;
  const impossibleDeg = opts.impossibleDeg ?? 5.0;
  const bodies = bodiesOf(constraints);
  const latSet = latBodiesOf(constraints);
  const boundOf: Record<string, number> = {};
  for (const b of bodies) {
    boundOf[b] = opts.latBounds?.[b] ?? BODY_LAT_BOUNDS[b] ?? DEFAULT_LAT_BOUND;
  }
  const n = Math.max(bodies.length, 1);

  let best: { e: number; pos: Record<string, BodyState> } | null = null;
  for (let r = 0; r < restarts; r++) {
    const pos: Record<string, BodyState> = {};
    bodies.forEach((b, i) => {
      pos[b] = { lon: (((r * n + i + 1) * PHI) % 1.0) * 360.0, lat: 0.0 };
    });
    for (let it = 0; it < iters; it++) {
      for (const b of bodies) {
        // longitude sweep at the current latitude
        let bestL = pos[b].lon;
        let bestE = bodyLoss(pos, b, constraints);
        for (let i = 0; i < 360; i++) {
          pos[b].lon = i;
          const e = bodyLoss(pos, b, constraints);
          if (e < bestE) { bestE = e; bestL = i; }
        }
        for (let k = -20; k <= 20; k++) {
          const cand = (((bestL + k * 0.05) % 360.0) + 360.0) % 360.0;
          pos[b].lon = cand;
          const e = bodyLoss(pos, b, constraints);
          if (e < bestE) { bestE = e; bestL = cand; }
        }
        pos[b].lon = bestL;
        if (!latSet.has(b)) continue;
        // latitude sweep within the body's bounds, same shape: coarse
        // 0.5-degree grid, then refine +/-0.5 at 0.025.
        const bound = boundOf[b];
        let bestT = pos[b].lat;
        bestE = bodyLoss(pos, b, constraints);
        const steps = Math.floor((2 * bound) / 0.5);
        for (let k = 0; k <= steps; k++) {
          const cand = -bound + k * 0.5;
          pos[b].lat = cand;
          const e = bodyLoss(pos, b, constraints);
          if (e < bestE) { bestE = e; bestT = cand; }
        }
        for (let k = -20; k <= 20; k++) {
          const cand = bestT + k * 0.025;
          if (cand < -bound || cand > bound) continue;
          pos[b].lat = cand;
          const e = bodyLoss(pos, b, constraints);
          if (e < bestE) { bestE = e; bestT = cand; }
        }
        pos[b].lat = bestT;
      }
    }
    const e = formLoss(pos, constraints);
    if (best === null || e < best.e) {
      best = { e, pos: Object.fromEntries(bodies.map((b) => [b, { ...pos[b] }])) };
    }
  }

  const pos = best!.pos;
  let maxLoss = 0;
  for (const c of constraints) maxLoss = Math.max(maxLoss, constraintLoss(pos, c));
  return {
    longitudes: Object.fromEntries(bodies.map((b) => [b, pos[b].lon])),
    latitudes: Object.fromEntries(bodies.map((b) => [b, pos[b].lat])),
    residual: best!.e,
    maxConstraintLoss: maxLoss,
    impossible: maxLoss > impossibleDeg,
    constraints: constraints.map((c) => ({ ...c, loss: constraintLoss(pos, c) })),
  };
}
