/**
 * astroengine stability -- what a chart still says when its time is uncertain.
 *
 * A chart is computed for one instant, but the instant is often not known
 * that well: a birth time rounded to the quarter hour, a date with no time at
 * all, an ancient observation whose clock error (ΔT) runs to minutes. This
 * module takes a window of time around the stated instant and reports, for
 * each fact the chart asserts, whether it holds across the whole window and,
 * where it does not, the instants at which it changes.
 *
 * A fact is one discrete statement: a body's sign, a body's house, the sign
 * on the Ascendant or Midheaven, whether the chart is by day or by night,
 * whether a body is retrograde, and which aspect (if any) a pair of bodies is
 * in. The scan samples the window, and wherever a fact differs between two
 * neighbouring samples it bisects for the instant of the change.
 *
 * Pure search over the existing chart: no new astronomy and no new data.
 * Mirrors the Python reference (astroengine/stability.py); the golden
 * fixtures pin the two implementations together.
 */
import {
  BODIES, Engine, findAspects, SIGNS,
  type Aspect, type HouseSystem, type Position, type Zodiac,
} from "./chart.js";
import { isDayChart } from "./derived.js";
import { houseOf } from "./electional.js";
import { deltaTSigma, jdYear } from "./ranges.js";

/** The kinds of fact {@link chartStability} reports, in report order. */
export const STABILITY_KINDS = [
  "angle_sign", "sect", "sign", "house", "retrograde", "aspect",
] as const;

export type StabilityKind = (typeof STABILITY_KINDS)[number];

/** A fact's value: a sign or aspect name, a house number, a direction flag,
 *  `"day"` or `"night"`, or `null` where a pair is in no aspect. */
export type StabilityValue = string | number | boolean | null;

/** A run of the window in which a fact keeps one value. */
export interface StabilitySegment {
  value: StabilityValue;
  /** Start and end of the run, UT Julian Days. */
  from: number;
  to: number;
}

/** One fact of the chart and how it fares across the window. */
export interface StabilityFact {
  kind: StabilityKind;
  /** A body id, `"asc"` or `"mc"`, `"chart"` for sect, or `"a-b"` for a pair. */
  subject: string;
  /** The fact at the stated instant. */
  value: StabilityValue;
  /** True when the fact holds across the whole window. */
  stable: boolean;
  /** Fraction of the window in which the fact has its stated value. */
  share: number;
  /** The window cut into runs of one value; each boundary is a change. */
  segments: StabilitySegment[];
}

/** Options for {@link chartStability}. */
export interface StabilityOptions {
  /** Observer latitude and east longitude. Without them the angles, houses,
   *  and sect are left out. */
  lat?: number;
  lonEast?: number;
  /** Half the window, in seconds. Defaults to the one-sigma uncertainty of ΔT
   *  at the epoch: under a second today, minutes in antiquity. */
  halfWidthSeconds?: number;
  /** House system. Defaults to `"placidus"`. */
  houseSystem?: HouseSystem;
  /** Zodiac. Defaults to tropical. */
  zodiac?: Zodiac;
  /** Per-aspect orb overrides, as for {@link Engine.chartAt}. */
  orbs?: Record<string, number>;
  /** Sampling step in seconds. Defaults to 120. */
  stepSeconds?: number;
}

/** What {@link chartStability} returns. */
export interface StabilityResult {
  jdUt: number;
  /** The window, UT Julian Days. */
  from: number;
  to: number;
  halfWidthSeconds: number;
  facts: StabilityFact[];
  summary: { facts: number; stable: number };
}

// Bodies whose direction is worth reporting. The Sun and Moon never turn
// retrograde, the mean node always is, and the true node flips every few days.
const NO_RETROGRADE = new Set<string>(["sun", "moon", "mean_node", "true_node"]);
const ANGLES = ["asc", "mc"] as const;
const SEP = "\u0000";

type State = Map<string, StabilityValue>;

const keyOf = (kind: StabilityKind, subject: string): string => `${kind}${SEP}${subject}`;
const signOf = (lon: number): string => SIGNS[Math.floor(lon / 30) % 12];

function stateAt(
  engine: Engine, t: number, opts: StabilityOptions, place: boolean,
): State {
  const zodiac = opts.zodiac ?? "tropical";
  let bodies: Record<string, Position>;
  let aspects: Aspect[];
  const st: State = new Map();
  let cusps: number[] | null = null;
  if (place) {
    const ch = engine.chartAt(t, opts.lat!, opts.lonEast!, {
      houseSystem: opts.houseSystem ?? "placidus", zodiac, orbs: opts.orbs,
    });
    bodies = {};
    for (const [b, p] of Object.entries(ch.bodies)) if (p) bodies[b] = p;
    aspects = ch.aspects;
    cusps = ch.cusps;
    for (const name of ANGLES) st.set(keyOf("angle_sign", name), signOf(ch.angles[name]));
    st.set(keyOf("sect", "chart"),
      isDayChart(engine, t, opts.lat!, opts.lonEast!) ? "day" : "night");
  } else {
    bodies = {};
    for (const b of BODIES) {
      try {
        bodies[b] = engine.position(b, t, { zodiac });
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
      }
    }
    aspects = opts.orbs ? findAspects(bodies, opts.orbs) : findAspects(bodies);
  }
  for (const [b, p] of Object.entries(bodies)) {
    st.set(keyOf("sign", b), signOf(p.lon));
    if (cusps) st.set(keyOf("house", b), houseOf(p.lon, cusps));
    if (!NO_RETROGRADE.has(b)) st.set(keyOf("retrograde", b), Boolean(p.retrograde));
  }
  for (const a of aspects) st.set(keyOf("aspect", `${a.a}-${a.b}`), a.aspect);
  return st;
}

/** Sort key parts: kind order, then body order (pairs by both bodies). */
function rank(key: string): { kind: number; parts: number[]; subject: string } {
  const [kind, subject] = key.split(SEP) as [StabilityKind, string];
  const idx = (name: string): number => {
    const a = (ANGLES as readonly string[]).indexOf(name);
    if (a >= 0) return a;
    const b = (BODIES as readonly string[]).indexOf(name);
    return b >= 0 ? b : BODIES.length;
  };
  const parts = (kind === "aspect" ? subject.split("-") : [subject]).map(idx);
  return { kind: STABILITY_KINDS.indexOf(kind), parts, subject };
}

function compareKeys(x: string, y: string): number {
  const a = rank(x);
  const b = rank(y);
  if (a.kind !== b.kind) return a.kind - b.kind;
  for (let i = 0; i < Math.min(a.parts.length, b.parts.length); i++) {
    if (a.parts[i] !== b.parts[i]) return a.parts[i] - b.parts[i];
  }
  if (a.parts.length !== b.parts.length) return a.parts.length - b.parts.length;
  return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
}

/**
 * Which facts of a chart survive an uncertain time.
 *
 * The window is `jdUt` plus and minus `halfWidthSeconds`. Left unset, the
 * half-width is the one-sigma uncertainty of ΔT at that epoch. Pass `900` for
 * a birth time good to the quarter hour, or `43200` for a date with no time.
 *
 * Each fact comes back with its value at the stated instant, whether it holds
 * across the window, the share of the window in which it holds, and the
 * window cut into runs of one value, so each boundary between runs is an
 * instant the fact changes.
 *
 * @param engine The engine to compute charts with.
 * @param jdUt The stated instant (Julian Day, UT).
 * @param opts Place, window, house system, zodiac, orbs, and sampling step.
 * @returns The window, every fact with its segments, and a count of how many
 *   facts are stable.
 * @example
 * ```ts
 * // Born 10 June 1990 in Tampa, "about 2:30 in the afternoon".
 * const jd = julianDay(1990, 6, 10, 18, 30);
 * const { facts } = chartStability(engine, jd, {
 *   lat: 27.95, lonEast: -82.46, halfWidthSeconds: 900,
 * });
 * facts.filter((f) => !f.stable).map((f) => `${f.kind} ${f.subject}`);
 * ```
 */
export function chartStability(
  engine: Engine, jdUt: number, opts: StabilityOptions = {},
): StabilityResult {
  if ((opts.lat === undefined) !== (opts.lonEast === undefined)) {
    throw new RangeError("chartStability needs both lat and lonEast, or neither");
  }
  const place = opts.lat !== undefined;
  const half = opts.halfWidthSeconds ?? deltaTSigma(jdYear(jdUt));
  if (half < 0) throw new RangeError("halfWidthSeconds must not be negative");
  const stepSeconds = opts.stepSeconds ?? 120.0;
  if (!(stepSeconds > 0)) throw new RangeError("stepSeconds must be positive");

  const lo = jdUt - half / 86400.0;
  const hi = jdUt + half / 86400.0;
  const cache = new Map<number, State>();
  const state = (t: number): State => {
    let s = cache.get(t);
    if (!s) {
      s = stateAt(engine, t, opts, place);
      cache.set(t, s);
    }
    return s;
  };
  const get = (s: State, key: string): StabilityValue => s.get(key) ?? null;

  const ref = state(jdUt);
  const keys: string[] = [...ref.keys()];
  const seen = new Set<string>(keys);
  const flips = new Map<string, Array<[number, StabilityValue]>>();
  const first = new Map<string, StabilityValue>();

  if (hi > lo) {
    const n = Math.max(1, Math.ceil((hi - lo) * 86400.0 / stepSeconds));
    const iters = Math.max(1, Math.ceil(Math.log2(stepSeconds))); // to about a second
    const ts: number[] = [];
    for (let k = 0; k <= n; k++) ts.push(lo + (hi - lo) * k / n);
    const sLo = state(ts[0]);
    for (const key of sLo.keys()) {
      if (!seen.has(key)) { seen.add(key); keys.push(key); }
    }
    for (const key of keys) first.set(key, get(sLo, key));
    for (let i = 0; i < n; i++) {
      const s0 = state(ts[i]);
      const s1 = state(ts[i + 1]);
      const stepKeys = [...s0.keys()];
      for (const key of s1.keys()) if (!s0.has(key)) stepKeys.push(key);
      for (const key of stepKeys) {
        const v0 = get(s0, key);
        const v1 = get(s1, key);
        if (v0 === v1) continue;
        if (!seen.has(key)) { seen.add(key); keys.push(key); first.set(key, null); }
        let a = ts[i];
        let b = ts[i + 1];
        for (let j = 0; j < iters; j++) {
          const m = (a + b) / 2.0;
          if (get(state(m), key) === v0) a = m;
          else b = m;
        }
        const list = flips.get(key) ?? [];
        list.push([(a + b) / 2.0, v1]);
        flips.set(key, list);
      }
    }
  } else {
    for (const key of keys) first.set(key, get(ref, key));
  }

  const width = hi - lo;
  const facts: StabilityFact[] = [];
  for (const key of [...keys].sort(compareKeys)) {
    const [kind, subject] = key.split(SEP) as [StabilityKind, string];
    const segments: StabilitySegment[] = [];
    let start = lo;
    let value = first.get(key) ?? null;
    for (const [t, after] of flips.get(key) ?? []) {
      segments.push({ value, from: start, to: t });
      start = t;
      value = after;
    }
    segments.push({ value, from: start, to: hi });
    const atRef = get(ref, key);
    let share = 1.0;
    if (width > 0) {
      let held = 0;
      for (const s of segments) if (s.value === atRef) held += s.to - s.from;
      share = held / width;
    }
    facts.push({
      kind, subject, value: atRef, stable: segments.length === 1, share, segments,
    });
  }

  return {
    jdUt, from: lo, to: hi, halfWidthSeconds: half, facts,
    summary: { facts: facts.length, stable: facts.filter((f) => f.stable).length },
  };
}
