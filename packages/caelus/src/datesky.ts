/**
 * astroengine datesky -- sky dating: from a description of a sky to its dates.
 *
 * The forward problem is a chart: an instant in, positions out. This module is
 * the inverse. Given constraints on where bodies stood ("Saturn in Libra,
 * Jupiter in Gemini, a waning Moon"), it returns every window inside a date
 * range in which all of them held at once. It is the computation behind dating
 * an undated horoscope.
 *
 * Method: interval pruning from the slowest quantity to the fastest. The first
 * constraint is scanned across the whole range and yields the windows in which
 * it holds; each later constraint is scanned only inside the windows that
 * survive, so the work shrinks at every stage. A window's edges are the
 * instants the quantity crosses the edge of its arc, found by bisection.
 *
 * A retrograde body can touch an arc briefly at a station, between two
 * samples. The scan therefore locates each turning point that could reach an
 * edge and adds it as a sample, which leaves every segment near an edge
 * monotone, and a monotone segment crosses an edge at most once.
 *
 * A constraint can also be a first or last visibility: "Venus was first seen
 * in the evening", at a named place. That is an event and not a quantity, so
 * it is not scanned. It is taken last, and inside each window that survives
 * the positions the events are found one after another with `heliacal()`;
 * the constraint holds on the local days from the event's earliest date to
 * its latest, the same event under a clearer and a hazier sky.
 *
 * `when()` in query.ts answers the same kind of question for arbitrary
 * predicates by sampling every predicate at one step across the whole range.
 * That is general and is the right tool for years or decades; over millennia
 * with the Moon involved it is millions of evaluations per body. `dateSky`
 * takes only position constraints, and prunes.
 *
 * Pure search over `engine.longitude`: no new astronomy and no new data.
 * Results inherit the engine's range, its ΔT model, and its zodiac handling.
 * Mirrors the Python reference (astroengine/datesky.py); the golden fixtures
 * pin the two implementations together.
 */
import { Engine, BodyId, SIGNS, Zodiac } from "./chart.js";
import {
  heliacal, heliacalKindsFor, localDay, HELIACAL_KINDS, HELIACAL_EXTINCTION,
  HELIACAL_SPREAD, type HeliacalEvent, type HeliacalKind, type HeliacalMethod,
} from "./heliacal.js";

/** The arc a constraint puts on its quantity. */
export type SkyArc =
  /** A zodiac sign, by name (`"Libra"`, case-insensitive) or index 0–11. */
  | { sign: string | number }
  /** Within `orb` degrees of a longitude. `orb` defaults to 1. */
  | { lon: number; orb?: number }
  /** The arc running forward from `from` to `to`, in degrees. */
  | { from: number; to: number };

/**
 * One constraint for {@link dateSky}: a quantity and the arc it must lie in.
 * The quantity is a body's ecliptic longitude, or the elongation of one body
 * from another (`["moon", "sun"]` is the Moon's longitude minus the Sun's, so
 * 0–180 is waxing and 180–360 is waning).
 */
export type SkyConstraint =
  | (({ body: BodyId } | { elongation: [BodyId, BodyId] })
    & SkyArc
    & {
      /** Degrees to widen the arc on both sides, for a source whose sign
       *  boundaries are not the engine's. Overrides the `pad` option. */
      pad?: number;
    })
  | {
    /** A first or last visibility at a place, in place of a position. */
    visibility: SkyVisibility;
    /** Days to widen the event's window of dates on each side. */
    within?: number;
  };

/**
 * A first or last visibility as a {@link dateSky} constraint: the event
 * {@link heliacal} finds for `target` and `kind` at one place. The
 * constraint holds on the local days from the event's earliest date to its
 * latest.
 */
export interface SkyVisibility {
  /** A planet id, `"moon"`, or a catalog star name. */
  target: string;
  kind: HeliacalKind | "heliacal_rising" | "heliacal_setting";
  /** Observer latitude in degrees, north positive. */
  lat: number;
  /** Observer longitude in degrees, east positive. */
  lonEast: number;
  /** V-band extinction, magnitudes per air mass. Default 0.25. */
  extinction?: number;
  /** Half-width of the extinction range behind the window. Default 0.05. */
  spread?: number;
  /** Observer altitude in metres. */
  altM?: number;
  /** `"visibility"` (default) or `"arcus"`. */
  method?: HeliacalMethod;
  /** The arcus visionis in degrees; required by the arcus method. */
  arcusVisionis?: number;
}

/** Options for {@link dateSky}. */
export interface DateSkyOptions {
  /** Zodiac the body longitudes are measured in. Defaults to tropical. */
  zodiac?: Zodiac;
  /** Degrees to widen every arc that does not set its own `pad`. */
  pad?: number;
  /** Most windows to return. Defaults to 1000. */
  maxWindows?: number;
  /** Keep the windows left after each constraint, as `spans` on each funnel
   *  stage, for drawing where each constraint cut. Defaults to `false`. */
  keepStages?: boolean;
}

/** A span of time, as UT Julian Days, in which every constraint holds. */
export interface SkyWindow {
  start: number;
  end: number;
}

/** One stage of the search: a constraint and what survived it. */
export interface SkyFunnelStage {
  /** Index of the constraint in the input array. */
  constraint: number;
  /** The constraint in words, e.g. `"saturn in Libra"`. */
  label: string;
  /** Windows left after this constraint. */
  windows: number;
  /** Total length of those windows, in days. */
  days: number;
  /** The windows left after this constraint as `[start, end]` UT Julian
   *  Days. Present only with the `keepStages` option. */
  spans?: Array<[number, number]>;
}

/** What {@link dateSky} returns. */
export interface DateSkyResult {
  /** The matching windows in time order, at most `maxWindows` of them. */
  windows: SkyWindow[];
  /** The constraints in the order they were scanned, slowest first. */
  funnel: SkyFunnelStage[];
  /** True when more than `maxWindows` windows matched. */
  truncated: boolean;
}

// Sampling step in days for each body: small enough that a body never makes
// two turning points inside one step and never moves 90 degrees in one step.
// The scan order follows these steps, largest first, so the slowest body is
// the one scanned across the whole range.
const STEP_DAYS: Record<string, number> = {
  pluto: 30.0, neptune: 30.0, uranus: 30.0,
  saturn: 20.0, chiron: 20.0, mean_node: 20.0,
  jupiter: 15.0,
  mars: 5.0, sun: 5.0,
  venus: 3.0,
  mercury: 2.0, true_node: 2.0,
  moon: 0.5,
};
const DEFAULT_STEP_DAYS = 2.0;

// Bodies whose longitude never turns back, so the turning-point pass is
// skipped for them.
const MONOTONE = new Set<string>(["sun", "moon", "mean_node"]);

// Half-width limit for an arc, degrees. An arc must leave room on the far
// side of the circle for the wrap of the signed distance.
const MAX_HALF_WIDTH = 170.0;

// A visibility constraint looks this many days before a window for an event
// whose own window of dates reaches into it.
const EVENT_LOOKBACK_DAYS = 45.0;
// The longest stretch one heliacal() search is asked to cover.
const EVENT_SEARCH_DAYS = 825.0;

const BISECT_ITERS = 32;
const GOLDEN_ITERS = 32;
const INV_PHI = 0.6180339887498949;

const SIGN_INDEX = new Map<string, number>(
  SIGNS.map((name, i) => [name.toLowerCase(), i]),
);

/** Signed angle in [-180, 180). */
function wrap180(x: number): number {
  let m = (x + 180.0) % 360.0;
  if (m < 0) m += 360.0;
  return m - 180.0;
}

function mod360(x: number): number {
  const m = x % 360.0;
  return m < 0 ? m + 360.0 : m;
}

/** A degree value as text; the label must print the same in Python and JS. */
function fmt(x: number): string {
  return String(x);
}

interface EventSpec {
  target: string;
  kind: HeliacalKind;
  lat: number;
  lon: number;
  method: HeliacalMethod;
  arcusVisionis: number | undefined;
  extinction: number;
  spread: number;
  altM: number;
  within: number;
}

interface Norm {
  index: number;
  label: string;
  bodies: BodyId | [BodyId, BodyId];
  center: number;
  half: number;
  step: number;
  monotone: boolean;
  /** Set for a visibility constraint, which has no arc and no step. */
  event?: EventSpec;
}

const KIND_ALIASES: Record<string, HeliacalKind> = {
  heliacal_rising: "morning_first", heliacal_setting: "evening_last",
};

/** Normalize a first-or-last-visibility constraint. Step 0 sorts it after
 *  every position. */
function normVisibility(
  c: { visibility: SkyVisibility; within?: number }, index: number,
): Norm {
  const v = c.visibility;
  for (const key of ["target", "kind", "lat", "lonEast"] as const) {
    if (v[key] === undefined) {
      throw new RangeError(`constraint ${index}: visibility needs '${key}'`);
    }
  }
  for (const key of ["sign", "lon", "from", "to", "orb", "body", "elongation"]) {
    if (key in c) {
      throw new RangeError(`constraint ${index}: a visibility constraint takes no '${key}'`);
    }
  }
  const kind = KIND_ALIASES[v.kind] ?? (v.kind as HeliacalKind);
  if (!(HELIACAL_KINDS as readonly string[]).includes(kind)) {
    throw new RangeError(`constraint ${index}: unknown kind ${JSON.stringify(v.kind)}`);
  }
  const method = v.method ?? "visibility";
  if (method !== "visibility" && method !== "arcus") {
    throw new RangeError(`constraint ${index}: unknown method ${JSON.stringify(method)}`);
  }
  if (method === "arcus" && v.arcusVisionis === undefined) {
    throw new RangeError(`constraint ${index}: the arcus method needs 'arcusVisionis'`);
  }
  const within = c.within ?? 0.0;
  if (within < 0.0) throw new RangeError(`constraint ${index}: 'within' is negative`);
  let label = `${v.target} ${kind} at ${fmt(v.lat)}, ${fmt(v.lonEast)}`;
  if (within) label += ` within ${fmt(within)} d`;
  return {
    index, label, bodies: "sun", center: 0.0, half: 0.0, step: 0.0, monotone: true,
    event: {
      target: v.target, kind, lat: v.lat, lon: v.lonEast, method,
      arcusVisionis: v.arcusVisionis,
      extinction: v.extinction ?? HELIACAL_EXTINCTION,
      spread: v.spread ?? HELIACAL_SPREAD,
      altM: v.altM ?? 0.0, within,
    },
  };
}

/** A function (a, b) -> the sub-intervals of [a, b] that fall on the days of
 *  a first or last visibility. Windows arrive in time order and often close
 *  together, so each event is found once and remembered. */
function eventIntervals(
  engine: Engine, ev: EventSpec, jdEnd: number,
): (a: number, b: number) => Array<[number, number]> {
  const lon = ev.lon;
  const lookback = ev.within + EVENT_LOOKBACK_DAYS;
  const end = jdEnd + lookback;
  // Every event with jd in [coverFrom, coverTo) is in `events`, in order.
  let coverFrom: number | null = null;
  let coverTo = 0;
  let events: HeliacalEvent[] = [];

  /** The first event at or after t, or null when there is none before the
   *  end of the search. */
  const nextEvent = (t: number): HeliacalEvent | null => {
    if (coverFrom === null || t < coverFrom || t > coverTo) {
      coverFrom = t;
      coverTo = t;
      events = [];
    }
    for (const found of events) {
      if (found.jd >= t) return found;
    }
    while (coverTo < end) {
      const span = Math.min(end - coverTo, EVENT_SEARCH_DAYS);
      const found = heliacal(engine, ev.target, coverTo, ev.lat, lon, {
        kind: ev.kind, method: ev.method, extinction: ev.extinction, spread: ev.spread,
        arcusVisionis: ev.arcusVisionis, altM: ev.altM, span,
      });
      if (found === null) {
        coverTo += span;
        continue;
      }
      // two events of one kind are never a day apart
      events.push(found);
      coverTo = found.jd + 1.0;
      if (found.jd >= t) return found;
    }
    return null;
  };

  /** The local days the event may fall on, widened by `within`. */
  const daysOf = (found: HeliacalEvent): [number, number] => {
    const lo = found.earliest;
    const hi = found.latest;
    const jd = found.jd;
    const d0 = localDay(lo === null || lo === undefined ? jd : Math.min(lo, jd), lon);
    const d1 = localDay(hi === null || hi === undefined ? jd : Math.max(hi, jd), lon);
    return [d0 - 0.5 - lon / 360.0 - ev.within, d1 + 0.5 - lon / 360.0 + ev.within];
  };

  return (a: number, b: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    let t = a - lookback;
    for (;;) {
      const found = nextEvent(t);
      if (found === null) break;
      const [w0, w1] = daysOf(found);
      if (w0 >= b) break;
      const s = Math.max(w0, a);
      const e = Math.min(w1, b);
      if (e > s) {
        const last = out[out.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else out.push([s, e]);
      }
      t = found.jd + 1.0;
    }
    return out;
  };
}

function stepFor(body: string): number {
  return STEP_DAYS[body] ?? DEFAULT_STEP_DAYS;
}

function normConstraint(c: SkyConstraint, index: number, defaultPad: number): Norm {
  if ("visibility" in c) return normVisibility(c, index);
  const pad = c.pad ?? defaultPad;
  let bodies: BodyId | [BodyId, BodyId];
  let subject: string;
  let step: number;
  let monotone: boolean;
  const isElong = "elongation" in c;
  if ("elongation" in c) {
    const [a, b] = c.elongation;
    bodies = [a, b];
    subject = `${a}-${b}`;
    step = Math.min(stepFor(a), stepFor(b));
    monotone = a === "moon" && MONOTONE.has(b);
  } else if ("body" in c) {
    bodies = c.body;
    subject = c.body;
    step = stepFor(c.body);
    monotone = MONOTONE.has(c.body);
  } else {
    throw new RangeError(`constraint ${index}: needs 'body' or 'elongation'`);
  }

  let center: number;
  let half: number;
  let label: string;
  if ("sign" in c) {
    if (isElong) {
      throw new RangeError(
        `constraint ${index}: an elongation takes 'from'/'to' or 'lon'/'orb', not 'sign'`,
      );
    }
    const sign = c.sign;
    const idx = typeof sign === "number"
      ? sign
      : SIGN_INDEX.get(String(sign).toLowerCase()) ?? -1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= 12) {
      throw new RangeError(`constraint ${index}: unknown sign ${JSON.stringify(sign)}`);
    }
    center = idx * 30.0 + 15.0;
    half = 15.0;
    label = `${subject} in ${SIGNS[idx]}`;
  } else if ("lon" in c) {
    center = mod360(c.lon);
    half = c.orb ?? 1.0;
    label = `${subject} at ${fmt(center)} within ${fmt(half)}`;
  } else if ("from" in c && "to" in c) {
    const lo = mod360(c.from);
    const width = mod360(c.to - lo);
    if (width === 0.0) {
      throw new RangeError(`constraint ${index}: 'from' and 'to' span no arc`);
    }
    center = mod360(lo + width / 2.0);
    half = width / 2.0;
    label = `${subject} from ${fmt(lo)} to ${fmt(mod360(lo + width))}`;
  } else {
    throw new RangeError(`constraint ${index}: needs 'sign', 'lon', or 'from' and 'to'`);
  }

  half += pad;
  if (pad) label += ` pad ${fmt(pad)}`;
  if (!(half > 0.0 && half <= MAX_HALF_WIDTH)) {
    throw new RangeError(
      `constraint ${index}: arc half-width ${half} is outside (0, ${MAX_HALF_WIDTH}]`,
    );
  }
  return { index, label, bodies, center, half, step, monotone };
}

/** Golden-section search for the extremum of g on [t0, t2], where
 *  (t0, t1, t2) brackets a maximum (rising) or a minimum. */
function turningPoint(
  g: (t: number) => number, t0: number, t2: number, rising: boolean,
): number {
  const sign = rising ? 1.0 : -1.0;
  let a = t0;
  let b = t2;
  let c = b - (b - a) * INV_PHI;
  let d = a + (b - a) * INV_PHI;
  let fc = sign * g(c);
  let fd = sign * g(d);
  for (let i = 0; i < GOLDEN_ITERS; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - (b - a) * INV_PHI;
      fc = sign * g(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + (b - a) * INV_PHI;
      fd = sign * g(d);
    }
  }
  return (a + b) / 2.0;
}

/** Bisect for the instant g crosses `edge` on [lo, hi]; g(lo) and g(hi) lie
 *  on opposite sides. */
function edgeTime(
  g: (t: number) => number, edge: number, lo: number, hi: number,
): number {
  const below = g(lo) - edge < 0.0;
  for (let i = 0; i < BISECT_ITERS; i++) {
    const mid = (lo + hi) / 2.0;
    if ((g(mid) - edge < 0.0) === below) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2.0;
}

/** Sub-intervals of [a, b] in which q lies in the arc
 *  [center - half, center + half). */
function arcIntervals(
  q: (t: number) => number, center: number, half: number,
  a: number, b: number, step: number, monotone: boolean,
): Array<[number, number]> {
  const g = (t: number): number => wrap180(q(t) - center);

  // Samples across [a, b]. For a body that can turn back, one extra sample
  // each side gives the end segments a neighbour, so a turning point inside
  // the first or last step is still bracketed. The extra sample is dropped
  // where the engine has no data for it.
  let ts: number[] = [];
  let gs: number[] = [];
  if (!monotone) {
    try {
      const v = g(a - step);
      ts.push(a - step);
      gs.push(v);
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
    }
  }
  for (let n = 0; ; n++) {
    const t = a + n * step;
    if (t >= b) break;
    ts.push(t);
    gs.push(g(t));
  }
  ts.push(b);
  gs.push(g(b));
  if (!monotone) {
    try {
      const v = g(b + step);
      ts.push(b + step);
      gs.push(v);
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
    }
  }

  if (!monotone) {
    const extra: number[] = [];
    for (let i = 0; i < ts.length - 2; i++) {
      const d0 = wrap180(gs[i + 1] - gs[i]);
      const d1 = wrap180(gs[i + 2] - gs[i + 1]);
      if (d0 * d1 < 0.0) {
        // The middle sample is the extreme one. The true turning point lies
        // beyond it by less than the larger neighbouring step, so it only
        // matters when an edge sits in that margin.
        const top = gs[i + 1];
        const bound = Math.max(Math.abs(d0), Math.abs(d1));
        const rising = d0 > 0.0;
        let near = false;
        for (const edge of [-half, half]) {
          if (rising && top < edge && edge <= top + bound) near = true;
          if (!rising && top - bound <= edge && edge < top) near = true;
        }
        if (!near) continue;
        // unwrap around the middle sample so the search sees a continuous
        // function
        const u = (t: number): number => wrap180(g(t) - top);
        const tp = turningPoint(u, ts[i], ts[i + 2], rising);
        if (tp !== ts[i] && tp !== ts[i + 1] && tp !== ts[i + 2]) extra.push(tp);
      }
    }
    if (extra.length > 0) {
      const known = new Map<number, number>();
      for (let i = 0; i < ts.length; i++) known.set(ts[i], gs[i]);
      const merged = Array.from(new Set<number>([...ts, ...extra]))
        .sort((x, y) => x - y);
      ts = merged;
      gs = merged.map((t) => known.get(t) ?? g(t));
    }
  }

  // Crossings of the two edges. Inside means -half <= g < half.
  const cross: number[] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const g0 = gs[i];
    const g1 = gs[i + 1];
    if (Math.abs(g1 - g0) >= 180.0) continue; // wrapped through the far side
    for (const edge of [-half, half]) {
      if ((g0 - edge < 0.0) !== (g1 - edge < 0.0)) {
        cross.push(edgeTime(g, edge, ts[i], ts[i + 1]));
      }
    }
  }
  cross.sort((x, y) => x - y);

  const isInside = (v: number): boolean => -half <= v && v < half;
  const out: Array<[number, number]> = [];
  let inside = isInside(gs[0]);
  let start = ts[0];
  for (const t of cross) {
    if (inside) out.push([start, t]);
    else start = t;
    inside = !inside;
  }
  if (inside) out.push([start, ts[ts.length - 1]]);
  if (inside !== isInside(gs[gs.length - 1])) {
    throw new Error("datesky: crossing parity is inconsistent");
  }

  const clipped: Array<[number, number]> = [];
  for (const [s0, e0] of out) {
    const s = Math.max(s0, a);
    const e = Math.min(e0, b);
    if (e > s) clipped.push([s, e]);
  }
  return clipped;
}

/**
 * Sky dating: every window in a date range in which a described sky occurred.
 *
 * Each constraint names a body (or an elongation between two bodies) and an
 * arc: a zodiac sign, a longitude with an orb, or a `from`–`to` span. The
 * search scans the slowest body across the whole range, then scans each
 * faster body only inside the windows that survive, so a description of the
 * seven classical bodies resolves across several thousand years in well under
 * a minute.
 *
 * The range is the caller's to choose and must lie inside the data the engine
 * was built with; {@link engineCapabilities} reports each body's span. An
 * instant is a UT Julian Day; use {@link julianDay} with `"julian"` for
 * historical dates and {@link calendarDate} to read a window back.
 *
 * @param engine The engine to compute positions with.
 * @param constraints What the sky looked like. At least one.
 * @param jdStart Start of the range (Julian Day, UT).
 * @param jdEnd End of the range (Julian Day, UT).
 * @param opts Zodiac, a default pad, and the window limit.
 * @returns The matching windows, and the search funnel: how many windows and
 *   days survived each constraint, in scan order.
 * @example
 * ```ts
 * // The oldest Babylonian horoscope names four planets by sign.
 * const { windows } = dateSky(engine, [
 *   { body: "jupiter", sign: "Pisces" },
 *   { body: "venus", sign: "Taurus" },
 *   { body: "saturn", sign: "Cancer" },
 *   { body: "mars", sign: "Gemini" },
 * ], julianDay(-499, 1, 1, 0, 0, 0, "julian"), julianDay(-299, 1, 1, 0, 0, 0, "julian"));
 * calendarDate(windows[0].start, "julian"); // { year: -409, month: 4, day: 16, ... }
 * ```
 */
export function dateSky(
  engine: Engine, constraints: SkyConstraint[], jdStart: number, jdEnd: number,
  opts: DateSkyOptions = {},
): DateSkyResult {
  if (constraints.length === 0) {
    throw new RangeError("dateSky needs at least one constraint");
  }
  if (!(jdEnd > jdStart)) {
    throw new RangeError("dateSky needs jdEnd after jdStart");
  }
  const zodiac = opts.zodiac ?? "tropical";
  const maxWindows = opts.maxWindows ?? 1000;
  const norm = constraints.map((c, i) => normConstraint(c, i, opts.pad ?? 0.0));
  for (const c of norm) {
    if (!c.event) continue;
    let kinds: HeliacalKind[];
    try {
      kinds = heliacalKindsFor(engine, c.event.target, c.event.method);
    } catch (e) {
      throw new RangeError(`constraint ${c.index}: ${(e as Error).message}`);
    }
    if (!kinds.includes(c.event.kind)) {
      throw new RangeError(
        `constraint ${c.index}: ${c.event.target} has no ${c.event.kind} by the ${c.event.method} method`);
    }
  }
  // slowest first; ties go to the narrower arc, then to input order
  const order = [...norm].sort((x, y) =>
    (y.step - x.step) || (x.half - y.half) || (x.index - y.index));

  let windows: Array<[number, number]> = [[jdStart, jdEnd]];
  const funnel: SkyFunnelStage[] = [];
  for (const c of order) {
    const next: Array<[number, number]> = [];
    if (c.event) {
      const intervals = eventIntervals(engine, c.event, jdEnd);
      for (const [a, b] of windows) {
        for (const iv of intervals(a, b)) next.push(iv);
      }
    } else {
      const bodies = c.bodies;
      const q = Array.isArray(bodies)
        ? (t: number): number =>
          engine.longitude(bodies[0], t, { zodiac }) - engine.longitude(bodies[1], t, { zodiac })
        : (t: number): number => engine.longitude(bodies, t, { zodiac });
      for (const [a, b] of windows) {
        for (const iv of arcIntervals(q, c.center, c.half, a, b, c.step, c.monotone)) {
          next.push(iv);
        }
      }
    }
    windows = next;
    let days = 0;
    for (const [s, e] of windows) days += e - s;
    const stage: SkyFunnelStage = {
      constraint: c.index, label: c.label, windows: windows.length, days,
    };
    if (opts.keepStages) stage.spans = windows.map(([s, e]) => [s, e]);
    funnel.push(stage);
    if (windows.length === 0) break;
  }
  for (const c of order.slice(funnel.length)) {
    const stage: SkyFunnelStage = {
      constraint: c.index, label: c.label, windows: 0, days: 0,
    };
    if (opts.keepStages) stage.spans = [];
    funnel.push(stage);
  }

  return {
    windows: windows.slice(0, maxWindows).map(([start, end]) => ({ start, end })),
    funnel,
    truncated: windows.length > maxWindows,
  };
}
