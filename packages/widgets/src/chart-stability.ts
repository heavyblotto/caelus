/**
 * caelus-widgets — the uncertain-time instrument, the logic half.
 *
 * The instrument asks one question: given a stated time and how uncertain it
 * is, which facts of the chart hold, and when do the others change? The
 * engine answers it with `chartStability`. This module is everything around
 * that call that is not React: turning the form's state into a call, running
 * the scan in slices so a page can draw progress, stitching the slices back
 * together, and naming what comes out.
 *
 * Nothing here loads data. The host passes an `Engine`, so the same code
 * runs on the embedded tier in a browser and on the full packs in Node.
 * The interactive component lives in chart-stability-widget.tsx.
 */
import {
  BODIES, calendarDate, chartStability, findAspects, julianDay, STABILITY_KINDS,
  type Engine, type HouseSystem, type Position, type StabilityFact,
  type StabilityKind, type StabilityOptions, type StabilityResult,
  type StabilitySegment, type StabilityValue, type Zodiac,
} from "caelus";
import { sweptArc, type WheelChart, type WheelUncertaintySample } from "caelus-wheel";

/** How uncertain the stated time is: half the window on each side of it. */
export const STABILITY_WINDOWS = [
  { id: "5m", label: "± 5 minutes", halfWidthSeconds: 300 },
  { id: "15m", label: "± 15 minutes", halfWidthSeconds: 900 },
  { id: "1h", label: "± 1 hour", halfWidthSeconds: 3600 },
  { id: "6h", label: "± 6 hours", halfWidthSeconds: 21600 },
  { id: "day", label: "The whole day, ± 12 hours", halfWidthSeconds: 43200 },
] as const;

export type StabilityWindowId = (typeof STABILITY_WINDOWS)[number]["id"];

/** Preset places for the form. East longitude is positive. */
export const STABILITY_PLACES = [
  { id: "tampa", label: "Tampa", lat: 27.95, lonEast: -82.46 },
  { id: "new_york", label: "New York", lat: 40.71, lonEast: -74.01 },
  { id: "london", label: "London", lat: 51.51, lonEast: -0.13 },
  { id: "delhi", label: "Delhi", lat: 28.61, lonEast: 77.21 },
] as const;

/** What the form holds. The date and time are UT, in the Gregorian calendar. */
export interface StabilityQuery {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Null for a chart with no place: no angles, houses, or sect. */
  place: { lat: number; lonEast: number } | null;
  window: StabilityWindowId;
  houseSystem: HouseSystem;
  zodiac: Zodiac;
}

/** The form's opening state: the birth the guide works through, in Tampa at
 *  18:30 UT on 10 June 1990, with the time good to an hour either way. */
export const STABILITY_DEFAULT: StabilityQuery = {
  year: 1990, month: 6, day: 10, hour: 18, minute: 30,
  place: { lat: 27.95, lonEast: -82.46 },
  window: "1h", houseSystem: "placidus", zodiac: "tropical",
};

/** Half the window of a query, in seconds. */
export function halfWidthOf(q: StabilityQuery): number {
  return STABILITY_WINDOWS.find((w) => w.id === q.window)!.halfWidthSeconds;
}

/** The stated instant of a query as a UT Julian Day. */
export function jdOfQuery(q: StabilityQuery): number {
  return julianDay(q.year, q.month, q.day, q.hour, q.minute, 0);
}

/** A query's place, house system, and zodiac as `chartStability` options,
 *  without the window. */
export function baseOptions(q: StabilityQuery): StabilityOptions {
  const opts: StabilityOptions = {};
  if (q.place) {
    opts.lat = q.place.lat;
    opts.lonEast = q.place.lonEast;
    opts.houseSystem = q.houseSystem;
  }
  opts.zodiac = q.zodiac;
  return opts;
}

/** Whether a query can be run: a real date and, if a place is set, one on
 *  the globe. */
export function queryOk(q: StabilityQuery): boolean {
  const nums = [q.year, q.month, q.day, q.hour, q.minute];
  if (!nums.every((n) => Number.isFinite(n))) return false;
  if (q.month < 1 || q.month > 12 || q.day < 1 || q.day > 31) return false;
  if (q.hour < 0 || q.hour > 23 || q.minute < 0 || q.minute > 59) return false;
  if (q.place) {
    const { lat, lonEast } = q.place;
    if (!Number.isFinite(lat) || !Number.isFinite(lonEast)) return false;
    if (Math.abs(lat) > 90 || Math.abs(lonEast) > 180) return false;
  }
  return true;
}

/** The state of a scan, complete or partway. */
export interface StabilityScan {
  jdUt: number;
  /** The window, UT Julian Days. */
  from: number;
  to: number;
  halfWidthSeconds: number;
  /** How far the scan has run, as a Julian Day. */
  jdDone: number;
  /** Every fact seen so far, in the engine's report order. Segments cover
   *  `from` to `jdDone`. */
  facts: StabilityFact[];
  summary: { facts: number; stable: number };
  done: boolean;
}

const keyOf = (f: { kind: StabilityKind; subject: string }): string => `${f.kind}:${f.subject}`;

/** The engine's report order: kind, then body order, pairs by both bodies. */
function rankOf(f: { kind: StabilityKind; subject: string }): number[] {
  const idx = (name: string): number => {
    if (name === "asc") return 0;
    if (name === "mc") return 1;
    const b = (BODIES as readonly string[]).indexOf(name);
    return b >= 0 ? b : BODIES.length;
  };
  const parts = (f.kind === "aspect" ? f.subject.split("-") : [f.subject]).map(idx);
  return [STABILITY_KINDS.indexOf(f.kind), ...parts];
}

function compareFacts(
  a: { kind: StabilityKind; subject: string }, b: { kind: StabilityKind; subject: string },
): number {
  const x = rankOf(a);
  const y = rankOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  if (x.length !== y.length) return x.length - y.length;
  return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
}

/** Join segments that meet with the same value, which is how a run cut by a
 *  slice boundary comes back whole. The input must be in time order. */
export function mergeSegments(segments: StabilitySegment[]): StabilitySegment[] {
  const out: StabilitySegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.value === s.value) last.to = s.to;
    else out.push({ value: s.value, from: last ? last.to : s.from, to: s.to });
  }
  return out;
}

/** The value a fact has at an instant, read off its segments. */
export function valueAt(segments: StabilitySegment[], jd: number): StabilityValue {
  for (const s of segments) if (jd < s.to) return s.value;
  return segments.length ? segments[segments.length - 1].value : null;
}

/** An empty scan over a window, ready for {@link foldStability}. */
export function emptyScan(jdUt: number, halfWidthSeconds: number): StabilityScan {
  const from = jdUt - halfWidthSeconds / 86400;
  return {
    jdUt, from, to: jdUt + halfWidthSeconds / 86400, halfWidthSeconds,
    jdDone: from, facts: [], summary: { facts: 0, stable: 0 }, done: false,
  };
}

/**
 * Fold one slice's result into the running scan. A fact that a slice does not
 * mention (a pair in no aspect anywhere in it) has no value there, so it gets
 * a `null` run for that slice; a fact first seen in a later slice gets a
 * `null` run for everything before it.
 */
export function foldStability(
  acc: StabilityScan, res: StabilityResult, sliceEnd: number,
): StabilityScan {
  const sliceStart = acc.jdDone;
  const prev = new Map(acc.facts.map((f) => [keyOf(f), f]));
  const next = new Map(res.facts.map((f) => [keyOf(f), f]));
  const facts: StabilityFact[] = [];
  for (const key of new Set([...prev.keys(), ...next.keys()])) {
    const a = prev.get(key);
    const b = next.get(key);
    const head = a?.segments
      ?? (sliceStart > acc.from ? [{ value: null, from: acc.from, to: sliceStart }] : []);
    const tail = b?.segments ?? [{ value: null, from: sliceStart, to: sliceEnd }];
    const segments = mergeSegments([...head, ...tail]);
    segments[0].from = acc.from;
    segments[segments.length - 1].to = sliceEnd;
    const stated = valueAt(segments, acc.jdUt);
    let held = 0;
    for (const s of segments) if (s.value === stated) held += s.to - s.from;
    const width = sliceEnd - acc.from;
    const src = (a ?? b)!;
    facts.push({
      kind: src.kind, subject: src.subject, value: stated,
      stable: segments.length === 1, share: width > 0 ? held / width : 1, segments,
    });
  }
  facts.sort(compareFacts);
  return {
    jdUt: acc.jdUt, from: acc.from, to: acc.to, halfWidthSeconds: acc.halfWidthSeconds,
    jdDone: sliceEnd, facts,
    summary: { facts: facts.length, stable: facts.filter((f) => f.stable).length },
    done: sliceEnd >= acc.to,
  };
}

/** Options for {@link scanStability}. */
export interface ScanStabilityOptions {
  /** Seconds per slice. Smaller slices report progress more often. */
  sliceSeconds?: number;
  /** Called after every slice with the scan so far. */
  onProgress?: (scan: StabilityScan) => void;
  /** Return true to abandon the scan; checked between slices. */
  cancelled?: () => boolean;
  /** How to yield between slices. Defaults to a zero-delay timer, which
   *  lets a browser paint. */
  yieldFn?: () => Promise<void>;
}

/**
 * Run a stability scan in slices, yielding between them. Each slice is one
 * `chartStability` call over part of the window, and the slices are stitched
 * into one result. It has the facts, values, and changes one call over the
 * whole window gives. The instants of change agree to within the scan's own
 * resolution of about a second, because a slice and the whole window do not
 * always sample the same instants before bisecting. Resolves with the
 * finished scan, or with the partial one if it was cancelled.
 */
export async function scanStability(
  engine: Engine, q: StabilityQuery, opts: ScanStabilityOptions = {},
): Promise<StabilityScan> {
  const jdUt = jdOfQuery(q);
  const half = halfWidthOf(q);
  const base = baseOptions(q);
  let acc = emptyScan(jdUt, half);
  const sliceSeconds = opts.sliceSeconds ?? 3600;
  const count = Math.max(1, Math.ceil((2 * half) / sliceSeconds));
  const pause = opts.yieldFn
    ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (let i = 0; i < count; i++) {
    if (opts.cancelled?.()) return acc;
    // Slice edges are measured in seconds from the start of the window, so
    // the last slice ends exactly on the window's end.
    const a = acc.from + Math.min(i * sliceSeconds, 2 * half) / 86400;
    const b = i === count - 1 ? acc.to : acc.from + ((i + 1) * sliceSeconds) / 86400;
    const res = chartStability(engine, (a + b) / 2, {
      ...base, halfWidthSeconds: ((b - a) * 86400) / 2,
    });
    acc = foldStability(acc, res, b);
    opts.onProgress?.(acc);
    await pause();
  }
  return acc;
}

/** The instants at which the window is sampled for the wheel: the start,
 *  the stated instant, the end, and enough between them that no two are
 *  more than half an hour apart. The angles turn about 15° an hour, so the
 *  wheel's uncertainty layer can add the steps up without losing a turn. */
export function windowInstants(q: StabilityQuery): number[] {
  const half = halfWidthOf(q);
  const jd = jdOfQuery(q);
  const steps = 2 * Math.max(1, Math.ceil(half / 1800));
  return Array.from({ length: steps + 1 }, (_, i) => jd + ((i / steps) * 2 - 1) * (half / 86400));
}

/** What the wheel tile draws: the stated chart and the window around it. */
export interface WindowWheel {
  /** The chart at the stated instant. */
  chart: WheelChart;
  /** Charts across the window in time order, for `ChartWheel`'s
   *  `uncertainty` prop. */
  samples: WheelUncertaintySample[];
  /** False for a query with no place. The chart then has no angles or
   *  houses, and it is set with 0° Aries where the Ascendant would be. */
  placed: boolean;
  /** The drawn bodies whose sign changes inside the window. */
  bodiesCrossing: string[];
  /** The angles whose sign changes inside the window. */
  anglesCrossing: Array<"asc" | "mc">;
}

/**
 * The stated chart and the charts across the window, ready for the wheel.
 * With a place these are whole charts. Without one they are the bodies'
 * positions and the aspects between them, since the angles and houses need
 * a place.
 */
export function windowWheel(engine: Engine, q: StabilityQuery): WindowWheel {
  const instants = windowInstants(q);
  const placed = q.place !== null;
  const at = (jd: number): WheelChart => {
    if (q.place) {
      return engine.chartAt(jd, q.place.lat, q.place.lonEast, {
        houseSystem: q.houseSystem, zodiac: q.zodiac,
      });
    }
    const bodies: Record<string, Position> = {};
    for (const b of BODIES) {
      try {
        bodies[b] = engine.position(b, jd, { zodiac: q.zodiac });
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
      }
    }
    return {
      bodies, aspects: findAspects(bodies),
      angles: { asc: 0, mc: 270 },
      cusps: Array.from({ length: 12 }, (_, i) => i * 30),
    };
  };
  const charts = instants.map(at);
  const chart = charts[(charts.length - 1) / 2];
  const samples: WheelUncertaintySample[] = charts.map((c) => (
    placed ? { bodies: c.bodies, angles: c.angles } : { bodies: c.bodies }
  ));
  const crosses = (lons: Array<number | undefined>): boolean =>
    lons.every((v) => v !== undefined) && sweptArc(lons as number[]).boundaries.length > 0;
  const drawn = Object.keys(chart.bodies).filter((b) => b !== "mean_node" && chart.bodies[b] !== undefined);
  return {
    chart, samples, placed,
    bodiesCrossing: drawn.filter((b) => crosses(charts.map((c) => c.bodies[b]?.lon))),
    anglesCrossing: placed
      ? (["asc", "mc"] as const).filter((a) => crosses(charts.map((c) => c.angles[a])))
      : [],
  };
}

/** One change of one fact: the instant, and the value on each side of it. */
export interface StabilityChange {
  jd: number;
  fact: StabilityFact;
  from: StabilityValue;
  to: StabilityValue;
}

/** Every change in the window, in time order. */
export function changesOf(facts: StabilityFact[]): StabilityChange[] {
  const out: StabilityChange[] = [];
  for (const fact of facts) {
    for (let i = 1; i < fact.segments.length; i++) {
      out.push({
        jd: fact.segments[i].from, fact,
        from: fact.segments[i - 1].value, to: fact.segments[i].value,
      });
    }
  }
  return out.sort((a, b) => a.jd - b.jd);
}

const KIND_LABEL: Record<StabilityKind, string> = {
  angle_sign: "Angle signs",
  sect: "Sect",
  sign: "Signs",
  house: "Houses",
  retrograde: "Directions",
  aspect: "Aspects",
};

/** The heading a kind of fact is grouped under. */
export function kindLabel(kind: StabilityKind): string {
  return KIND_LABEL[kind];
}

const SUBJECT_LABEL: Record<string, string> = {
  asc: "Ascendant", mc: "Midheaven", chart: "Chart",
  mean_node: "Mean node", true_node: "True node",
};

/** A subject as text: `Moon`, `Ascendant`, `True node`. */
export function subjectLabel(subject: string): string {
  return SUBJECT_LABEL[subject] ?? subject.charAt(0).toUpperCase() + subject.slice(1).replace(/_/g, " ");
}

/** A fact as a short name: `Moon house`, `Ascendant sign`, `Sun and Moon`. */
export function factLabel(f: { kind: StabilityKind; subject: string }): string {
  switch (f.kind) {
    case "angle_sign": return `${subjectLabel(f.subject)} sign`;
    case "sect": return "Sect";
    case "sign": return `${subjectLabel(f.subject)} sign`;
    case "house": return `${subjectLabel(f.subject)} house`;
    case "retrograde": return `${subjectLabel(f.subject)} direction`;
    case "aspect": return f.subject.split("-").map(subjectLabel).join(" and ");
  }
}

/** A fact's value as text: a sign, `house 5`, `retrograde`, `trine`, `day`. */
export function valueLabel(kind: StabilityKind, value: StabilityValue): string {
  if (kind === "house") return `house ${value}`;
  if (kind === "retrograde") return value ? "retrograde" : "direct";
  if (kind === "aspect") return value === null ? "no aspect" : String(value);
  return value === null ? "none" : String(value);
}

/** A value as it is printed inside a track, where room is short: a house is
 *  its number alone, and everything else reads as {@link valueLabel}. */
export function trackLabel(kind: StabilityKind, value: StabilityValue): string {
  return kind === "house" ? String(value) : valueLabel(kind, value);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** A Julian Day as UT clock time, to the second or the minute, with the day
 *  and month when `withDate` is set: `18:43:07`, `10 Jun 18:43`. */
export function timeText(jd: number, opts: { seconds?: boolean; withDate?: boolean } = {}): string {
  const unit = opts.seconds ? 1 : 60;
  // half a unit forward and floor: rounds without printing 24:00
  const d = calendarDate(jd + unit / 2 / 86400);
  const total = Math.min(86399, Math.floor(d.hour * 3600));
  const clock = `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}`
    + (opts.seconds ? `:${pad2(total % 60)}` : "");
  return opts.withDate ? `${d.day} ${MONTHS[d.month - 1]} ${clock}` : clock;
}

/** A query's stated instant as text: `10 Jun 1990, 18:30 UT`. */
export function statedText(q: StabilityQuery): string {
  return `${q.day} ${MONTHS[q.month - 1]} ${q.year}, ${pad2(q.hour)}:${pad2(q.minute)} UT`;
}

/** The call that reproduces a query, as source text for the code tile. */
export function stabilitySource(q: StabilityQuery): string {
  const opts: string[] = [];
  if (q.place) opts.push(`  lat: ${q.place.lat}, lonEast: ${q.place.lonEast},`);
  opts.push(`  halfWidthSeconds: ${halfWidthOf(q)},`);
  if (q.place && q.houseSystem !== "placidus") opts.push(`  houseSystem: "${q.houseSystem}",`);
  if (q.zodiac !== "tropical") opts.push(`  zodiac: "${q.zodiac}",`);
  return [
    "import { Engine, chartStability, julianDay } from \"caelus\";",
    "import { embeddedData } from \"caelus/data-embedded\";",
    "",
    "const engine = new Engine(embeddedData);",
    "",
    `const jd = julianDay(${q.year}, ${q.month}, ${q.day}, ${q.hour}, ${q.minute});`,
    "const { facts, summary } = chartStability(engine, jd, {",
    ...opts,
    "});",
    "",
    "facts.filter((f) => !f.stable);",
  ].join("\n");
}

/** The shape a scan returns, abridged, as source text for the code tile. */
export function returnedSource(scan: StabilityScan | null): string {
  if (!scan) return "{ facts: [], summary: { facts: 0, stable: 0 } }";
  const show = (v: StabilityValue): string => (typeof v === "string" ? `"${v}"` : String(v));
  const unstable = scan.facts.filter((f) => !f.stable);
  const pick = unstable[0] ?? scan.facts[0];
  const lines = [`{ summary: { facts: ${scan.summary.facts}, stable: ${scan.summary.stable} },`, "  facts: ["];
  if (pick) {
    lines.push(`    { kind: "${pick.kind}", subject: "${pick.subject}",`);
    lines.push(`      value: ${show(pick.value)}, stable: ${pick.stable}, share: ${pick.share.toFixed(3)},`);
    lines.push("      segments: [");
    for (const s of pick.segments.slice(0, 3)) {
      lines.push(`        { value: ${show(s.value)}, from: ${s.from.toFixed(5)}, to: ${s.to.toFixed(5)} },`);
    }
    if (pick.segments.length > 3) lines.push(`        // ${pick.segments.length - 3} more`);
    lines.push("      ] },");
  }
  if (scan.facts.length > 1) lines.push(`    // ${scan.facts.length - 1} more`);
  lines.push("  ] }");
  return lines.join("\n");
}
