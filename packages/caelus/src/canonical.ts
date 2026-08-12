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
  const scale = UNITS_PER_DEG[grid];
  const full = 360 * scale;
  const signSpan = 30 * scale;

  const cuspsQ = chart.cusps.map((c) => qAngle(grid, c));
  const bodies: Record<string, CanonicalBody> = {};
  const lonQ: Record<string, number> = {};
  const latQ: Record<string, number> = {};
  const speedQ: Record<string, number> = {};
  const latSpeedQ: Record<string, number> = {};

  for (const [id, p] of Object.entries(chart.bodies)) {
    if (!p) continue;
    lonQ[id] = qAngle(grid, p.lon, id);
    latQ[id] = qSigned(grid, p.lat, id);
    speedQ[id] = qSigned(grid, p.speed, id);
    latSpeedQ[id] = qSigned(grid, p.latSpeed ?? 0, id);
    const signIdx = Math.floor(lonQ[id] / signSpan) % 12;
    bodies[id] = {
      lon: render(grid, lonQ[id]),
      lat: render(grid, latQ[id]),
      speed: speedQ[id],
      latSpeed: p.latSpeed === undefined ? null : latSpeedQ[id],
      distMicroAu: p.dist === null ? null : roundHalfUp(p.dist * 1e6),
      ra: render(grid, qAngle(grid, p.ra, id)),
      dec: render(grid, qSigned(grid, p.dec, id)),
      sign: SIGNS[signIdx],
      signDeg: render(grid, lonQ[id] - signIdx * signSpan),
      house: houseOfQ(lonQ[id], cuspsQ, full),
      retrograde: speedQ[id] < 0,
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
      let sepUnits: number;
      if (spatial) {
        // The 3D separation of the QUANTIZED positions, quantized once more
        // onto the grid -- deterministic because the inputs are integers.
        const sep = angularSeparation3d(
          lonQ[a] / scale, latQ[a] / scale, lonQ[b] / scale, latQ[b] / scale,
        );
        sepUnits = quantizeUnit(sep, scale);
      } else {
        const e = (((lonQ[a] - lonQ[b] + full / 2) % full) + full) % full - full / 2;
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
            const e = (((lonQ[a] - lonQ[b] + full / 2) % full) + full) % full - full / 2;
            const d = (signedOrb >= 0 ? 1 : -1) * (e >= 0 ? 1 : -1) * (speedQ[a] - speedQ[b]);
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
    format: "caelus-canonical",
    version: 1,
    grid,
    units: {
      angle: UNIT_NAMES[grid], speed: `${UNIT_NAMES[grid]}/day`,
      time: "ms since J2000.0 (JD 2451545.0 UT)", dist: "micro-AU",
      strength: "per-mille",
    },
    timeMs: canonicalTimeMs(chart.jdUt),
    zodiac: chart.zodiac,
    houseSystem: chart.houseSystem,
    houseSystemRequested: chart.houseSystemRequested,
    bodies,
    unavailable: [...chart.unavailable].sort(),
    angles: {
      asc: render(grid, qAngle(grid, chart.angles.asc)),
      mc: render(grid, qAngle(grid, chart.angles.mc)),
      vertex: render(grid, qAngle(grid, chart.angles.vertex)),
      eastPoint: render(grid, qAngle(grid, chart.angles.eastPoint)),
    },
    cusps: cuspsQ.map((c) => render(grid, c)),
    aspects,
    warnings,
  };
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
