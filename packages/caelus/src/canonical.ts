/**
 * astroengine canonical mode -- integer, hashable, precision-honest output.
 *
 * The engine is already deterministic run-to-run: identical inputs give
 * bit-identical doubles on one machine. What floating point does NOT give is
 * cross-platform bit-stability (IEEE 754 leaves the transcendentals to libm,
 * so V8, JSC, and Python can differ in the last ulp), stable serialization
 * (float repr differs across languages), and boundary coherence (one ulp can
 * flip a sign, a house, or an aspect at its orb limit). Canonical mode fixes
 * all three by quantizing every continuous quantity to an integer on a
 * declared grid and re-deriving the discrete facts from the quantized values.
 *
 * Three commitments make it canonical rather than decoratively integer:
 *
 *  1. **One rounding rule.** `quantizeUnit` is floor(x * scale + 0.5) with a
 *     guard for the IEEE edge where the addition itself crosses the half --
 *     the same bridge the skyview golden uses for JS-vs-Python rounding.
 *     Ties therefore round toward +infinity, which is also the tie-break
 *     everywhere discrete: a longitude exactly on a sign or house boundary
 *     belongs to the LATER sign/house, a speed of exactly 0 is not
 *     retrograde.
 *  2. **Quantize, then derive.** Sign, sign-degree, house, dignities, and
 *     the aspect list are recomputed from the quantized longitudes in
 *     integer arithmetic, so the displayed numbers and the derived facts can
 *     never disagree ("29 deg 59' 60'' Pisces" showing beside sign: Aries is
 *     impossible by construction).
 *  3. **Floats cannot leak.** {@link canonicalEncode} throws on any
 *     non-integer number, so a digest over a canonical value proves the
 *     whole payload was quantized.
 *
 * {@link canonicalDigest} (sha256 over the canonical encoding, implemented
 * dependency-free so the browser tier works) gives content-addressable
 * charts: stable cache keys, dedupe, provenance receipts -- and a
 * tolerance-free cross-language pin: the TS and Python digests must be
 * EQUAL, not close (canonical-golden).
 *
 * The `"accuracy"` grid is "validated, not asserted" applied to the output
 * format: each body quantizes no finer than its measured accuracy
 * (accuracy.json), so canonical output never states precision the
 * validation does not support.
 *
 * Mirrors python/astroengine/canonical.py; pinned by canonical-golden.
 */
import type { Chart, ChartWarning, Aspect } from "./chart.js";
import {
  ANGLE_SIGMA_DEG_PER_SECOND, MOON_SIGMA_DEG_PER_SECOND,
  EPOCH_SIGMA_DISPLAY_SECONDS, deltaTSigma, jdYear,
} from "./ranges.js";
import { SIGNS, DEFAULT_ORBS, ASPECTS, NOT_ASPECTABLE, dignities } from "./chart.js";
import { angularSeparation3d } from "./spherical.js";

// ------------------------------------------------------------------ rounding

/** Round half toward +infinity, guarded against the IEEE edge where
 *  `x + 0.5` itself rounds across the half (mirrors Python `_js_round`). */
export function roundHalfUp(x: number): number {
  const r = Math.floor(x + 0.5);
  // Guard: if x is just below a half but x + 0.5 rounded up to the next
  // integer, floor(x + 0.5) overshoots by 1.
  return (r - x > 0.5) ? r - 1 : r;
}

/** Quantize a value to integer units of `1/scale` (e.g. scale 3600 turns
 *  degrees into arcseconds). The single rounding rule of canonical mode. */
export function quantizeUnit(x: number, scale: number): number {
  return roundHalfUp(x * scale);
}

// -------------------------------------------------------------------- grids

/** Angular resolution presets. `"dms"` shares the arcsecond grid but renders
 *  angles as `[deg, min, sec]` triples -- the tradition's own integer form.
 *  `"accuracy"` snaps each body to its measured validated accuracy. */
export type CanonicalGrid = "arcsec" | "milliarcsec" | "centideg" | "dms" | "accuracy";

/** Integer units per degree for each grid ("accuracy" stores arcseconds and
 *  varies the snap per body; "dms" stores arcseconds rendered as triples). */
const UNITS_PER_DEG: Record<CanonicalGrid, number> = {
  arcsec: 3600, milliarcsec: 3_600_000, centideg: 100, dms: 3600, accuracy: 3600,
};

/**
 * Per-body accuracy quantum in arcseconds for the `"accuracy"` grid,
 * mirroring the measured bounds in accuracy.json rounded up to a whole
 * arcsecond quantum (Sun-Saturn <=1", Uranus <=1.9", Neptune <=4.6",
 * Moon <=2.5", Pluto <=3.4" on the pack, true node <=1', true Lilith <=3',
 * Uranians <=2.3", intp_apog degree-scale vs SE by construction). A body
 * not named quantizes at the default 1".
 */
export const ACCURACY_QUANTUM_ARCSEC: Record<string, number> = {
  moon: 3, uranus: 2, neptune: 5, pluto: 4, chiron: 1,
  true_node: 60, mean_lilith: 2, true_lilith: 180, intp_apog: 3600,
  cupido: 3, hades: 3, zeus: 3, kronos: 3,
  apollon: 3, admetos: 3, vulkanus: 3, poseidon: 3,
};

function quantumFor(grid: CanonicalGrid, body: string | null): number {
  if (grid !== "accuracy" || body === null) return 1;
  return ACCURACY_QUANTUM_ARCSEC[body] ?? 1;
}

/** Quantize an angle (degrees) onto the grid: integer grid units, snapped to
 *  the body's accuracy quantum on the "accuracy" grid, normalized [0, 360). */
function qAngle(grid: CanonicalGrid, deg: number, body: string | null = null): number {
  const scale = UNITS_PER_DEG[grid];
  const quantum = quantumFor(grid, body);
  const q = roundHalfUp((deg * scale) / quantum) * quantum;
  const full = 360 * scale;
  return ((q % full) + full) % full;
}

/** Quantize a signed quantity (a latitude, a speed) onto the grid without
 *  normalization. */
function qSigned(grid: CanonicalGrid, value: number, body: string | null = null): number {
  const scale = UNITS_PER_DEG[grid];
  const quantum = quantumFor(grid, body);
  return roundHalfUp((value * scale) / quantum) * quantum;
}

/** Integer milliseconds since the J2000.0 epoch (JD 2451545.0 UT). The
 *  double ulp of a modern Julian Day is ~40 microseconds, well inside the
 *  millisecond grid. */
export function canonicalTimeMs(jdUt: number): number {
  return roundHalfUp((jdUt - 2451545.0) * 86_400_000);
}

/** `[deg, min, sec]` triple (base-60, all integers) for an arcsecond total. */
function dmsTriple(arcsecTotal: number): [number, number, number] {
  const neg = arcsecTotal < 0;
  let s = Math.abs(arcsecTotal);
  const d = Math.floor(s / 3600); s -= d * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return neg ? [-d, -m, -s] : [d, m, s];
}

// -------------------------------------------------------------- encode + hash

/**
 * Canonical JSON: keys sorted, no whitespace, and ONLY integers, strings,
 * booleans, null, arrays, and plain objects. Any non-integer number throws --
 * that is the enforcement making a canonical digest trustworthy: it proves
 * every quantity in the payload was quantized.
 */
export function canonicalEncode(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`canonicalEncode: non-integer number ${value} (quantize first)`);
    }
    if (Object.is(value, -0)) return "0";
    return String(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalEncode).join(",")}]`;
  }
  if (t === "object") {
    const keys = Object.keys(value as object).sort();
    const parts = keys
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalEncode((value as Record<string, unknown>)[k])}`);
    return `{${parts.join(",")}}`;
  }
  throw new Error(`canonicalEncode: unsupported type ${t}`);
}

// Dependency-free synchronous SHA-256 (FIPS 180-4), so canonical digests work
// on the browser/edge tiers where node:crypto is absent. Pinned by the test
// vectors in canonical-golden.
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256Hex(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let c = input.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < input.length) {
      const lo = input.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let s = 56; s >= 0; s -= 8) bytes.push((bitLen / 2 ** s) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array<number>(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16)
        | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** sha256 over the canonical encoding: the content address of any canonical
 *  value. Throws (via {@link canonicalEncode}) if a float leaked in. */
export function canonicalDigest(value: unknown): string {
  return sha256Hex(canonicalEncode(value));
}

// ------------------------------------------------------------ canonical chart

export interface CanonicalOptions {
  /** Angular grid; defaults to `"arcsec"`. */
  grid?: CanonicalGrid;
  /** Aspect orb overrides (degrees), merged over DEFAULT_ORBS -- pass the
   *  same options the chart was computed with so the re-derived aspect list
   *  matches intent. */
  orbs?: Record<string, number>;
  /** Aspect angle table; defaults to the five Ptolemaic ASPECTS. */
  aspects?: Record<string, number>;
  /** Aspect separation mode used for re-derivation (default "longitude"). */
  separation?: "longitude" | "spatial";
}

export interface CanonicalBody {
  lon: number | [number, number, number];
  lat: number | [number, number, number];
  speed: number;
  latSpeed: number | null;
  /** Micro-AU integer, or null (nodes, Lilith points, intp_apog). */
  distMicroAu: number | null;
  ra: number | [number, number, number];
  dec: number | [number, number, number];
  /** Derived FROM the quantized longitude (tie-break: a boundary value
   *  belongs to the later sign). */
  sign: string;
  signDeg: number | [number, number, number];
  house: number;
  /** Quantized speed < 0 (exactly 0 is direct). */
  retrograde: boolean;
  dignities: string[];
}

export interface CanonicalAspect {
  a: string;
  b: string;
  aspect: string;
  /** Orb in grid units. */
  orb: number;
  phase: "applying" | "separating" | "exact";
  /** Closeness in per-mille (1000 = exact), integer-derived. */
  strengthPerMille: number;
}

export interface CanonicalChart {
  format: "caelus-canonical";
  version: 1;
  grid: CanonicalGrid;
  /** Self-describing units, bound into the digest. */
  units: { angle: string; speed: string; time: string; dist: string; strength: string };
  timeMs: number;
  zodiac: string;
  houseSystem: string;
  houseSystemRequested: string;
  bodies: Record<string, CanonicalBody>;
  unavailable: string[];
  angles: Record<string, number | [number, number, number]>;
  cusps: Array<number | [number, number, number]>;
  aspects: CanonicalAspect[];
  warnings: Array<Record<string, unknown>>;
  /** The epoch's clock-error uncertainty as data, present only where it is
   *  visible at the app's display scale (sigma(deltaT) >= 10 s, the same
   *  threshold the delta_t_uncertain warning uses, so modern charts carry
   *  no block and keep their digests). The values are sigmas, ungraded; the
   *  app's damping display consumes them and applies its own grades.
   *  Rotation-anchored quantities (angles, houses, rise and set) move at the
   *  sky's rate, the Moon's longitude at its own; TT planet-to-planet
   *  geometry carries no sigma. Additive under the format-version rules;
   *  digests incorporate the block as any field. */
  epochSigma?: {
    /** sigma(deltaT) in whole seconds (Morrison & Stephenson 2004 table). */
    sigmaSeconds: number;
    /** Sigma of rotation-anchored quantities, in grid units. */
    angleSigma: number | [number, number, number];
    /** Sigma of the Moon's longitude for a UT-tagged instant, in grid
     *  units. */
    moonLongitudeSigma: number | [number, number, number];
  };
}

const UNIT_NAMES: Record<CanonicalGrid, string> = {
  arcsec: "arcsec", milliarcsec: "milliarcsec", centideg: "centidegree",
  dms: "arcsec (rendered [deg,min,sec])", accuracy: "arcsec (per-body accuracy quantum)",
};

/** 1-based house for a quantized longitude against quantized cusps -- pure
 *  integer comparison; a longitude exactly on a cusp belongs to that house
 *  (i.e. the LATER house begins at its own cusp), the discrete face of the
 *  round-half-up tie-break. */
function houseOfQ(lonQ: number, cuspsQ: number[], full: number): number {
  for (let i = 0; i < 12; i++) {
    const span = (((cuspsQ[(i + 1) % 12] - cuspsQ[i]) % full) + full) % full;
    const off = (((lonQ - cuspsQ[i]) % full) + full) % full;
    if (off < span) return i + 1;
  }
  return 12;
}

/** Integer per-mille rounding of (limit - orb) / limit without touching
 *  floats: floor((2000*(l-o) + l) / (2l)). */
function strengthPerMille(orbUnits: number, limitUnits: number): number {
  const num = 2000 * (limitUnits - orbUnits) + limitUnits;
  return Math.floor(num / (2 * limitUnits));
}

const render = (grid: CanonicalGrid, unitsVal: number): number | [number, number, number] =>
  grid === "dms" ? dmsTriple(unitsVal) : unitsVal;

/** Quantized-but-underived chart state: every frontier leaf as an integer in
 *  grid units, before the discrete facts are derived. This is the seam the
 *  remainder machinery composes through -- {@link composeRemainders} rebuilds
 *  a finer-grid state and feeds it to the SAME derivation as
 *  {@link canonicalChart}. */
interface QuantBody {
  lon: number; lat: number; speed: number;
  latSpeed: number | null; distMicroAu: number | null;
  ra: number; dec: number;
}
interface QuantState {
  timeMs: number;
  zodiac: string; houseSystem: string; houseSystemRequested: string;
  unavailable: string[];
  warnings: Array<Record<string, unknown>>;
  bodies: Record<string, QuantBody>;
  angles: { asc: number; mc: number; vertex: number; eastPoint: number };
  cusps: number[];
}

function quantizeChart(chart: Chart, grid: CanonicalGrid): QuantState {
  const bodies: Record<string, QuantBody> = {};
  for (const [id, p] of Object.entries(chart.bodies)) {
    if (!p) continue;
    bodies[id] = {
      lon: qAngle(grid, p.lon, id),
      lat: qSigned(grid, p.lat, id),
      speed: qSigned(grid, p.speed, id),
      latSpeed: p.latSpeed === undefined ? null : qSigned(grid, p.latSpeed, id),
      distMicroAu: p.dist === null ? null : roundHalfUp(p.dist * 1e6),
      ra: qAngle(grid, p.ra, id),
      dec: qSigned(grid, p.dec, id),
    };
  }
  const warnings = chart.warnings.map((w: ChartWarning) => {
    if (w.kind === "delta_t_uncertain") {
      return {
        kind: w.kind, text: w.text, sigmaSeconds: w.sigmaSeconds,
        angleSmearCentideg: roundHalfUp(w.angleSmearDeg * 100),
        moonSmearCentiarcmin: roundHalfUp(w.moonSmearArcmin * 100),
      };
    }
    return { kind: w.kind, body: w.body, validated: w.validated, text: w.text };
  });
  return {
    timeMs: canonicalTimeMs(chart.jdUt),
    zodiac: chart.zodiac,
    houseSystem: chart.houseSystem,
    houseSystemRequested: chart.houseSystemRequested,
    unavailable: [...chart.unavailable].sort(),
    warnings,
    bodies,
    angles: {
      asc: qAngle(grid, chart.angles.asc),
      mc: qAngle(grid, chart.angles.mc),
      vertex: qAngle(grid, chart.angles.vertex),
      eastPoint: qAngle(grid, chart.angles.eastPoint),
    },
    cusps: chart.cusps.map((c) => qAngle(grid, c)),
  };
}

/** Derive the full canonical payload from quantized state -- pure integer
 *  arithmetic from here down, shared by {@link canonicalChart} and
 *  {@link composeRemainders}. */
function buildCanonical(state: QuantState, grid: CanonicalGrid, opts: CanonicalOptions): CanonicalChart {
  const scale = UNITS_PER_DEG[grid];
  const full = 360 * scale;
  const signSpan = 30 * scale;
  const cuspsQ = state.cusps;

  const bodies: Record<string, CanonicalBody> = {};
  for (const [id, q] of Object.entries(state.bodies)) {
    const signIdx = Math.floor(q.lon / signSpan) % 12;
    bodies[id] = {
      lon: render(grid, q.lon),
      lat: render(grid, q.lat),
      speed: q.speed,
      latSpeed: q.latSpeed,
      distMicroAu: q.distMicroAu,
      ra: render(grid, q.ra),
      dec: render(grid, q.dec),
      sign: SIGNS[signIdx],
      signDeg: render(grid, q.lon - signIdx * signSpan),
      house: houseOfQ(q.lon, cuspsQ, full),
      retrograde: q.speed < 0,
      dignities: dignities(id, signIdx),
    };
  }

  // Aspects, re-derived in integer space from the quantized state.
  const table = opts.aspects ?? ASPECTS;
  const orbSource = opts.aspects ? (opts.orbs ?? {}) : { ...DEFAULT_ORBS, ...opts.orbs };
  const spatial = opts.separation === "spatial";
  const names = Object.keys(bodies).filter((b) => !NOT_ASPECTABLE.has(b));
  const aspects: CanonicalAspect[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]; const b = names[j];
      const qa = state.bodies[a]; const qb = state.bodies[b];
      let sepUnits: number;
      if (spatial) {
        // The 3D separation of the QUANTIZED positions, quantized once more
        // onto the grid -- deterministic because the inputs are integers.
        const sep = angularSeparation3d(
          qa.lon / scale, qa.lat / scale, qb.lon / scale, qb.lat / scale,
        );
        sepUnits = quantizeUnit(sep, scale);
      } else {
        const e = (((qa.lon - qb.lon + full / 2) % full) + full) % full - full / 2;
        sepUnits = Math.abs(e);
      }
      for (const [asp, angleDeg] of Object.entries(table)) {
        const limitDeg = orbSource[asp];
        if (limitDeg === undefined) continue;
        const angleUnits = roundHalfUp(angleDeg * scale);
        const limitUnits = roundHalfUp(limitDeg * scale);
        const orbUnits = Math.abs(sepUnits - angleUnits);
        if (orbUnits <= limitUnits) {
          const signedOrb = sepUnits - angleUnits;
          let phase: CanonicalAspect["phase"];
          if (signedOrb === 0) phase = "exact";
          else {
            // Longitude-derived closing rate on quantized speeds; in spatial
            // mode this is the same documented approximation findAspects makes
            // when no time derivative is available.
            const e = (((qa.lon - qb.lon + full / 2) % full) + full) % full - full / 2;
            const d = (signedOrb >= 0 ? 1 : -1) * (e >= 0 ? 1 : -1) * (qa.speed - qb.speed);
            phase = d < 0 ? "applying" : "separating";
          }
          aspects.push({
            a, b, aspect: asp, orb: orbUnits, phase,
            strengthPerMille: strengthPerMille(orbUnits, limitUnits),
          });
        }
      }
    }
  }

  // R3's epoch-certainty block: the chart's clock-error uncertainty as
  // canonical data, present only where it crosses the display threshold, so
  // modern charts carry no block and keep their digests.
  const jdUt = 2451545.0 + state.timeMs / 86_400_000;
  const sigmaSeconds = roundHalfUp(deltaTSigma(jdYear(jdUt)));
  const epochSigma = sigmaSeconds >= EPOCH_SIGMA_DISPLAY_SECONDS
    ? {
        sigmaSeconds,
        angleSigma: render(grid, qSigned(grid, sigmaSeconds * ANGLE_SIGMA_DEG_PER_SECOND)),
        moonLongitudeSigma: render(grid, qSigned(grid, sigmaSeconds * MOON_SIGMA_DEG_PER_SECOND)),
      }
    : undefined;

  return {
    format: "caelus-canonical",
    version: 1,
    grid,
    units: {
      angle: UNIT_NAMES[grid], speed: `${UNIT_NAMES[grid]}/day`,
      time: "ms since J2000.0 (JD 2451545.0 UT)", dist: "micro-AU",
      strength: "per-mille",
    },
    timeMs: state.timeMs,
    zodiac: state.zodiac,
    houseSystem: state.houseSystem,
    houseSystemRequested: state.houseSystemRequested,
    bodies,
    unavailable: state.unavailable,
    angles: {
      asc: render(grid, state.angles.asc),
      mc: render(grid, state.angles.mc),
      vertex: render(grid, state.angles.vertex),
      eastPoint: render(grid, state.angles.eastPoint),
    },
    cusps: cuspsQ.map((c) => render(grid, c)),
    aspects,
    warnings: state.warnings,
    // Omitted entirely when absent (never an undefined key), so the payload's
    // key set matches the Python mirror and the pinned golden structure.
    ...(epochSigma !== undefined ? { epochSigma } : {}),
  };
}

/**
 * Project a {@link Chart} into canonical (integer) form on a declared grid.
 * Every continuous quantity quantizes under the single rounding rule; sign,
 * sign-degree, house, dignities, retrograde, and the aspect list are then
 * re-derived from the quantized values in integer arithmetic, so displayed
 * numbers and discrete facts cannot disagree and one-ulp platform drift
 * cannot flip anything.
 *
 * @param chart A chart from {@link Engine.chart} / {@link Engine.chartAt}.
 * @param opts Grid (default `"arcsec"`) and the aspect options the chart was
 *   computed with.
 * @returns The {@link CanonicalChart}; feed it to {@link canonicalDigest}
 *   for a content address.
 */
export function canonicalChart(chart: Chart, opts: CanonicalOptions = {}): CanonicalChart {
  const grid = opts.grid ?? "arcsec";
  return buildCanonical(quantizeChart(chart, grid), grid, opts);
}

/** Content address of a chart: sha256 over the canonical encoding of
 *  {@link canonicalChart}. Equal digests mean equal charts at the grid's
 *  resolution -- across machines, browsers, and languages. */
export function chartDigest(chart: Chart, opts: CanonicalOptions = {}): string {
  return canonicalDigest(canonicalChart(chart, opts));
}

// ------------------------------------------------- derived-surface helpers

/** Quantize a list of event instants (Julian Days, UT) to integer
 *  milliseconds since J2000 -- nulls pass through (a polar sun that never
 *  sets stays null). */
export function canonicalTimesMs(jds: Array<number | null>): Array<number | null> {
  return jds.map((jd) => (jd === null ? null : canonicalTimeMs(jd)));
}

// ------------------------------------------------------------ remainder sets
//
// Canonical mode is residual coding: the canonical payload is the base layer,
// and the remainder set is the optional enhancement layer holding what
// quantization discarded. Two modes:
//
//  - "refine" (default): each residue is an INTEGER in sub-quanta of a finer
//    grid, so the sidecar is itself canonical (encodable, digestable, float-
//    free) and grids telescope: compose(base payload, residues) rebuilds the
//    finer-grid payload EXACTLY, discrete facts re-derived and all. Time
//    residues are always integer microseconds, distance residues always
//    integer nano-AU (both payloads carry ms / micro-AU regardless of grid,
//    so these two are pure precision escrow rather than telescoping).
//  - "bits": the pre-quantization IEEE 754 double of every frontier leaf,
//    big-endian hex. Truly lossless, but the bits are per-platform artifacts
//    (libm drift lives exactly here), so bits mode is a local archival /
//    forensics tool, never a cross-platform contract -- and it is exposed on
//    the engine API only, not over MCP.
//
// The frontier -- which leaves have residues -- is precisely the set of
// independently quantized scalars: body lon/lat/speed/latSpeed/dist/ra/dec,
// the four angles, the twelve cusps, and timeMs. Derived integers (sign,
// signDeg, house, dignities, retrograde, the whole aspect block) are exact
// functions of the frontier and carry no residue by construction; warnings
// quantize at fixed coarse advisory scales and are excluded.
//
// Requesting remainders never changes a byte of the base payload: the
// sidecar is additive, and binds to the payload via `for` (its digest).

/** Grids that can serve as refinement targets. A remainder grid must be
 *  strictly finer than the base grid. */
export type RemainderGrid = "arcsec" | "milliarcsec";

/** Strict fineness order for refinement validation: "accuracy" is coarser
 *  than plain "arcsec" (the per-body snap discards more), "dms" IS arcsec. */
const FINENESS: Record<CanonicalGrid, number> = {
  centideg: 0, accuracy: 1, dms: 2, arcsec: 2, milliarcsec: 3,
};

/** One step finer, the default refinement target per base grid. There is no
 *  integer grid finer than milliarcsec -- refining it takes `"bits"`. */
const DEFAULT_REMAINDER: Partial<Record<CanonicalGrid, RemainderGrid>> = {
  centideg: "arcsec", accuracy: "arcsec", dms: "milliarcsec", arcsec: "milliarcsec",
};

export interface RefineRemainders {
  format: "caelus-remainders";
  version: 1;
  mode: "refine";
  /** Digest of the base payload this sidecar belongs to; {@link composeRemainders}
   *  refuses a mismatch. */
  for: string;
  grid: CanonicalGrid;
  remainderGrid: RemainderGrid;
  units: { angle: string; speed: string; time: string; dist: string };
  /** Flat path -> integer residue, one entry per frontier leaf (zeros kept,
   *  so completeness is checkable). Angle residues are the signed shortest
   *  modular distance, so a longitude at the 360-degree wrap stays small. */
  values: Record<string, number>;
}

export interface BitsRemainders {
  format: "caelus-remainders";
  version: 1;
  mode: "bits";
  for: string;
  grid: CanonicalGrid;
  units: { encoding: string; angle: string; speed: string; time: string; dist: string };
  /** Flat path -> big-endian hex of the pre-quantization IEEE 754 double. */
  values: Record<string, string>;
}

export type CanonicalRemainders = RefineRemainders | BitsRemainders;

export interface RemainderOptions extends CanonicalOptions {
  /** Refinement target grid, `"bits"` for exact doubles, or omitted for one
   *  step finer than the base grid. */
  remainder?: RemainderGrid | "bits";
}

/** IEEE 754 binary64 bit pattern of a double, big-endian, 16 hex chars. */
export function doubleBitsHex(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  let s = "";
  for (let i = 0; i < 8; i++) s += view.getUint8(i).toString(16).padStart(2, "0");
  return s;
}

/** Inverse of {@link doubleBitsHex} -- exact round-trip, `-0` included. */
export function doubleFromBitsHex(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) view.setUint8(i, parseInt(hex.slice(2 * i, 2 * i + 2), 16));
  return view.getFloat64(0);
}

type LeafKind = "angle" | "signed" | "time" | "dist";
interface FrontierLeaf { path: string; kind: LeafKind; body: string | null }

/** Enumerate the quantization frontier of a payload, in payload order. */
function frontierLeaves(payload: CanonicalChart): FrontierLeaf[] {
  const leaves: FrontierLeaf[] = [{ path: "timeMs", kind: "time", body: null }];
  for (const [id, b] of Object.entries(payload.bodies)) {
    leaves.push({ path: `bodies.${id}.lon`, kind: "angle", body: id });
    leaves.push({ path: `bodies.${id}.lat`, kind: "signed", body: id });
    leaves.push({ path: `bodies.${id}.speed`, kind: "signed", body: id });
    if (b.latSpeed !== null) leaves.push({ path: `bodies.${id}.latSpeed`, kind: "signed", body: id });
    if (b.distMicroAu !== null) leaves.push({ path: `bodies.${id}.distMicroAu`, kind: "dist", body: id });
    leaves.push({ path: `bodies.${id}.ra`, kind: "angle", body: id });
    leaves.push({ path: `bodies.${id}.dec`, kind: "signed", body: id });
  }
  for (const k of Object.keys(payload.angles)) leaves.push({ path: `angles.${k}`, kind: "angle", body: null });
  for (let i = 0; i < payload.cusps.length; i++) leaves.push({ path: `cusps.${i}`, kind: "angle", body: null });
  return leaves;
}

/** Base-grid integer for a rendered leaf ("dms" triples recompose). */
const asUnits = (v: number | [number, number, number]): number =>
  Array.isArray(v) ? v[0] * 3600 + v[1] * 60 + v[2] : v;

function leafValue(payload: CanonicalChart, path: string): number {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = payload;
  for (const p of parts) node = node[p];
  return asUnits(node);
}

/** The pre-quantization double behind a frontier leaf. */
function leafFloat(chart: Chart, path: string): number {
  if (path === "timeMs") return (chart.jdUt - 2451545.0) * 86_400_000;
  const parts = path.split(".");
  if (parts[0] === "bodies") {
    const p = chart.bodies[parts[1]];
    if (!p) throw new Error(`leafFloat: body ${parts[1]} missing`);
    switch (parts[2]) {
      case "lon": return p.lon;
      case "lat": return p.lat;
      case "speed": return p.speed;
      case "latSpeed": return p.latSpeed as number;
      case "distMicroAu": return p.dist as number; // AU
      case "ra": return p.ra;
      case "dec": return p.dec;
    }
  }
  if (parts[0] === "angles") return chart.angles[parts[1] as keyof Chart["angles"]];
  if (parts[0] === "cusps") return chart.cusps[Number(parts[1])];
  throw new Error(`leafFloat: unknown path ${path}`);
}

/** Signed shortest modular distance, centered on zero: [-full/2, full/2). */
function modSigned(d: number, full: number): number {
  return ((((d % full) + full + full / 2) % full) - full / 2);
}

/**
 * Canonical payload plus its remainder set. In `"refine"` mode (default:
 * one grid finer than the base) each residue is the integer difference
 * between the finer-grid quantization and the base leaf lifted onto the
 * finer grid, so `finer = ratio * base + residue` exactly and
 * {@link composeRemainders} can rebuild the finer payload. Time residues are
 * integer microseconds, distance residues integer nano-AU, always. In
 * `"bits"` mode each value is the pre-quantization double as big-endian hex
 * (lossless, platform-local, engine-API-only).
 */
export function canonicalChartWithRemainders(
  chart: Chart, opts: RemainderOptions = {},
): { payload: CanonicalChart; remainders: CanonicalRemainders } {
  const grid = opts.grid ?? "arcsec";
  const payload = canonicalChart(chart, opts);
  const forDigest = canonicalDigest(payload);
  const leaves = frontierLeaves(payload);

  const mode = opts.remainder ?? DEFAULT_REMAINDER[grid];
  if (mode === undefined) {
    throw new Error(
      `canonicalChartWithRemainders: no integer grid is finer than "${grid}"; pass remainder: "bits" for exact doubles`,
    );
  }

  if (mode === "bits") {
    const values: Record<string, string> = {};
    for (const leaf of leaves) values[leaf.path] = doubleBitsHex(leafFloat(chart, leaf.path));
    return {
      payload,
      remainders: {
        format: "caelus-remainders", version: 1, mode: "bits",
        for: forDigest, grid,
        units: {
          encoding: "IEEE 754 binary64, big-endian hex",
          angle: "deg", speed: "deg/day",
          time: "ms since J2000.0 (JD 2451545.0 UT)", dist: "AU",
        },
        values,
      },
    };
  }

  if (FINENESS[mode] <= FINENESS[grid]) {
    throw new Error(`canonicalChartWithRemainders: remainder grid "${mode}" is not finer than base grid "${grid}"`);
  }
  const fineScale = UNITS_PER_DEG[mode];
  const ratio = fineScale / UNITS_PER_DEG[grid];
  const fullF = 360 * fineScale;
  const values: Record<string, number> = {};
  for (const leaf of leaves) {
    const base = leafValue(payload, leaf.path);
    const x = leafFloat(chart, leaf.path);
    if (leaf.kind === "time") {
      values[leaf.path] = roundHalfUp(x * 1000) - 1000 * base; // microseconds
    } else if (leaf.kind === "dist") {
      values[leaf.path] = roundHalfUp(x * 1e9) - 1000 * base; // nano-AU
    } else if (leaf.kind === "angle") {
      values[leaf.path] = modSigned(qAngle(mode, x) - ratio * base, fullF);
    } else {
      values[leaf.path] = qSigned(mode, x) - ratio * base;
    }
  }
  return {
    payload,
    remainders: {
      format: "caelus-remainders", version: 1, mode: "refine",
      for: forDigest, grid, remainderGrid: mode,
      units: {
        angle: UNIT_NAMES[mode], speed: `${UNIT_NAMES[mode]}/day`,
        time: "microsecond", dist: "nano-AU",
      },
      values,
    },
  };
}

/**
 * Rebuild the finer-grid canonical payload from a base payload and its
 * refinement remainder set: every frontier leaf is reconstructed as
 * `ratio * base + residue` (modular for angles), then sign, house,
 * dignities, retrograde, and the aspect list are re-derived in integer
 * arithmetic exactly as {@link canonicalChart} would at that grid. Pass the
 * same `orbs`/`aspects`/`separation` options the base was built with.
 *
 * The result equals `canonicalChart(chart, { grid: remainders.remainderGrid })`
 * field for field -- the telescoping property the canonical-golden pins.
 * Time stays integer ms and distance micro-AU in the composed payload (both
 * are grid-independent); their microsecond / nano-AU residues are precision
 * escrow readable straight off the sidecar.
 *
 * Throws if the sidecar is a bits set, binds to a different payload, or its
 * key set does not exactly match the payload's frontier.
 */
export function composeRemainders(
  payload: CanonicalChart, remainders: CanonicalRemainders, opts: CanonicalOptions = {},
): CanonicalChart {
  if (remainders.mode !== "refine") {
    throw new Error("composeRemainders: bits remainders reconstruct doubles, not a finer grid; decode with doubleFromBitsHex");
  }
  if (remainders.grid !== payload.grid) {
    throw new Error(`composeRemainders: sidecar grid "${remainders.grid}" != payload grid "${payload.grid}"`);
  }
  if (remainders.for !== canonicalDigest(payload)) {
    throw new Error("composeRemainders: sidecar binds to a different payload (digest mismatch)");
  }
  const rGrid = remainders.remainderGrid;
  const fineScale = UNITS_PER_DEG[rGrid];
  const ratio = fineScale / UNITS_PER_DEG[payload.grid];
  const fullF = 360 * fineScale;

  const leaves = frontierLeaves(payload);
  for (const leaf of leaves) {
    if (!(leaf.path in remainders.values)) {
      throw new Error(`composeRemainders: sidecar missing frontier leaf ${leaf.path}`);
    }
  }
  if (Object.keys(remainders.values).length !== leaves.length) {
    throw new Error("composeRemainders: sidecar has keys outside the payload's frontier");
  }

  const angleF = (path: string): number =>
    ((ratio * leafValue(payload, path) + remainders.values[path]) % fullF + fullF) % fullF;
  const signedF = (path: string): number =>
    ratio * leafValue(payload, path) + remainders.values[path];

  const bodies: Record<string, QuantBody> = {};
  for (const [id, b] of Object.entries(payload.bodies)) {
    bodies[id] = {
      lon: angleF(`bodies.${id}.lon`),
      lat: signedF(`bodies.${id}.lat`),
      speed: signedF(`bodies.${id}.speed`),
      latSpeed: b.latSpeed === null ? null : signedF(`bodies.${id}.latSpeed`),
      distMicroAu: b.distMicroAu,
      ra: angleF(`bodies.${id}.ra`),
      dec: signedF(`bodies.${id}.dec`),
    };
  }
  const state: QuantState = {
    timeMs: payload.timeMs,
    zodiac: payload.zodiac,
    houseSystem: payload.houseSystem,
    houseSystemRequested: payload.houseSystemRequested,
    unavailable: payload.unavailable,
    warnings: payload.warnings,
    bodies,
    angles: {
      asc: angleF("angles.asc"), mc: angleF("angles.mc"),
      vertex: angleF("angles.vertex"), eastPoint: angleF("angles.eastPoint"),
    },
    cusps: payload.cusps.map((_, i) => angleF(`cusps.${i}`)),
  };
  return buildCanonical(state, rGrid, opts);
}

export interface BoundaryFlag {
  path: string;
  /** The residue itself, in sidecar sub-quanta. */
  residue: number;
  /** The base-grid quantum expressed in sidecar sub-quanta (per-body on the
   *  "accuracy" grid; 1000 for time and distance leaves). */
  quantum: number;
  /** floor(1000 * (quantum - 2|residue|) / quantum): 0 = exactly on a
   *  rounding boundary, 1000 = dead center of the quantum. */
  marginPerMille: number;
  /** +1: the value sits just below a boundary (a platform computing it a
   *  hair higher rounds UP); -1: just above one; 0: dead center. */
  side: -1 | 0 | 1;
}

/**
 * Fragility report from a refinement remainder set: frontier leaves whose
 * value landed close to a base-grid rounding boundary, i.e. the places where
 * sub-quantum drift on another platform could flip the quantized leaf (and
 * with it a sign, a house, or an aspect at its orb limit -- which is exactly
 * a digest change). Pure integer arithmetic; needs only the sidecar.
 *
 * @param opts.maxMarginPerMille report leaves with margin at or under this
 *   (default 10, i.e. within 1% of the quantum of a boundary).
 */
export function nearBoundary(
  remainders: RefineRemainders, opts: { maxMarginPerMille?: number } = {},
): BoundaryFlag[] {
  if (remainders.mode !== "refine") {
    throw new Error("nearBoundary: needs a refinement remainder set (bits carry no grid geometry)");
  }
  const maxPm = opts.maxMarginPerMille ?? 10;
  const ratio = UNITS_PER_DEG[remainders.remainderGrid] / UNITS_PER_DEG[remainders.grid];
  const out: BoundaryFlag[] = [];
  for (const [path, r] of Object.entries(remainders.values)) {
    let quantum: number;
    if (path === "timeMs" || path.endsWith(".distMicroAu")) {
      quantum = 1000;
    } else {
      const body = path.startsWith("bodies.") ? path.split(".")[1] : null;
      quantum = quantumFor(remainders.grid, body) * ratio;
    }
    const marginPerMille = Math.floor((1000 * (quantum - 2 * Math.abs(r))) / quantum);
    if (marginPerMille <= maxPm) {
      out.push({ path, residue: r, quantum, marginPerMille, side: Math.sign(r) as -1 | 0 | 1 });
    }
  }
  out.sort((a, b) => a.marginPerMille - b.marginPerMille || (a.path < b.path ? -1 : 1));
  return out;
}
