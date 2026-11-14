/**
 * caelus-widgets — the first-visibility instrument, the logic half.
 *
 * The instrument asks one question: on which days of a year is a star, a
 * planet, or the Moon first or last seen from one place? The engine answers
 * it with `heliacal`, one event at a time. This module is everything around
 * that call that is not React: walking a year event by event so a page can
 * draw progress, finding the stretches in which the body is lost in the
 * Sun's glare, sampling a morning or evening minute by minute for the
 * twilight curve, running Yallop's test across the evenings around a new
 * Moon, and naming what comes out.
 *
 * Nothing here loads data. The host passes an `Engine`, so the same code
 * runs on the embedded tier in a browser and on the full packs in Node.
 * The interactive component lives in first-visibility-widget.tsx.
 */
import {
  heliacal, localDay, lunarCrescent, visibility,
  type Engine, type HeliacalEvent, type HeliacalKind,
} from "caelus";
import { jdOfYear, stampOf } from "./sky-dating.js";

/** The targets the form offers. A star's id is its catalog name. */
export const VISIBILITY_TARGETS = [
  { id: "Sirius", label: "Sirius", group: "star" },
  { id: "Canopus", label: "Canopus", group: "star" },
  { id: "Arcturus", label: "Arcturus", group: "star" },
  { id: "Aldebaran", label: "Aldebaran", group: "star" },
  { id: "Antares", label: "Antares", group: "star" },
  { id: "Spica", label: "Spica", group: "star" },
  { id: "Regulus", label: "Regulus", group: "star" },
  { id: "Procyon", label: "Procyon", group: "star" },
  { id: "mercury", label: "Mercury", group: "planet" },
  { id: "venus", label: "Venus", group: "planet" },
  { id: "mars", label: "Mars", group: "planet" },
  { id: "jupiter", label: "Jupiter", group: "planet" },
  { id: "saturn", label: "Saturn", group: "planet" },
  { id: "moon", label: "The Moon", group: "moon" },
] as const;

export type VisibilityTargetId = (typeof VISIBILITY_TARGETS)[number]["id"];

/** Preset places for the form. East longitude is positive. */
export const VISIBILITY_PLACES = [
  { id: "memphis", label: "Memphis", lat: 29.85, lonEast: 31.25 },
  { id: "babylon", label: "Babylon", lat: 32.54, lonEast: 44.42 },
  { id: "athens", label: "Athens", lat: 37.98, lonEast: 23.73 },
  { id: "mecca", label: "Mecca", lat: 21.42, lonEast: 39.83 },
] as const;

/** The extinction coefficients the form offers, V-band magnitudes per air
 *  mass: a high desert site at the low end, a humid or dusty one at the
 *  high end. */
export const VISIBILITY_EXTINCTIONS = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45] as const;

/** The years the form accepts, astronomical. */
export const VISIBILITY_SPAN = { from: -2998, to: 2998 } as const;

/** What the form holds. The year is astronomical: 0 is 1 BCE. */
export interface VisibilityQuery {
  target: VisibilityTargetId;
  place: { lat: number; lonEast: number };
  year: number;
  extinction: number;
}

/** A named starting point: a query and the event to open on. */
export interface VisibilityPreset {
  id: string;
  label: string;
  /** One sentence on what the preset shows. */
  note: string;
  query: VisibilityQuery;
  /** The event the page selects once the year has been searched: the first
   *  of this kind on or after this month and day. */
  pick: { kind: HeliacalKind; month: number; day: number };
}

export const VISIBILITY_PRESETS: VisibilityPreset[] = [
  {
    id: "sirius",
    label: "Sirius at Memphis, 139 CE",
    note: "Censorinus implies that Sirius rose on the Egyptian New Year in 139 CE. "
      + "The manuscripts give 21 July, usually emended to 20 July.",
    query: { target: "Sirius", place: { lat: 29.85, lonEast: 31.25 }, year: 139, extinction: 0.25 },
    pick: { kind: "morning_first", month: 7, day: 1 },
  },
  {
    id: "venus",
    label: "Venus at Babylon, 2025",
    note: "Around inferior conjunction Venus leaves the evening sky and returns in the morning within days.",
    query: { target: "venus", place: { lat: 32.54, lonEast: 44.42 }, year: 2025, extinction: 0.25 },
    pick: { kind: "morning_first", month: 3, day: 1 },
  },
  {
    id: "crescent",
    label: "New crescent at Mecca, March 2025",
    note: "The first evening crescent after the new Moon of 29 March 2025.",
    query: { target: "moon", place: { lat: 21.42, lonEast: 39.83 }, year: 2025, extinction: 0.25 },
    pick: { kind: "evening_first", month: 3, day: 25 },
  },
];

/** Whether a query can be run. */
export function visibilityQueryOk(q: VisibilityQuery): boolean {
  if (!Number.isInteger(q.year) || q.year < VISIBILITY_SPAN.from || q.year > VISIBILITY_SPAN.to) return false;
  const { lat, lonEast } = q.place;
  if (!Number.isFinite(lat) || !Number.isFinite(lonEast)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lonEast) > 180) return false;
  return Number.isFinite(q.extinction) && q.extinction > 0;
}

const groupOf = (target: VisibilityTargetId): "star" | "planet" | "moon" =>
  VISIBILITY_TARGETS.find((t) => t.id === target)!.group;

/** The events a target has, in the order they are searched. Stars and the
 *  outer planets vanish once a year or so and come back. Mercury and Venus
 *  have four events in each cycle, and the Moon two a month. */
export function kindsOf(target: VisibilityTargetId): HeliacalKind[] {
  if (target === "moon") return ["morning_last", "evening_first"];
  if (target === "mercury" || target === "venus") {
    return ["evening_last", "morning_first", "morning_last", "evening_first"];
  }
  return ["evening_last", "morning_first"];
}

const KIND_LABEL: Record<HeliacalKind, string> = {
  morning_first: "Morning first",
  evening_last: "Evening last",
  evening_first: "Evening first",
  morning_last: "Morning last",
  acronychal_rising: "Acronychal rising",
  cosmical_setting: "Cosmical setting",
};

/** An event kind as a short label: `Morning first`. */
export function kindLabel(kind: HeliacalKind): string {
  return KIND_LABEL[kind];
}

/** Whether an event is seen before sunrise, and whether it begins or ends a
 *  stretch of visibility. */
export const isMorning = (kind: HeliacalKind): boolean => kind === "morning_first" || kind === "morning_last";
export const isFirst = (kind: HeliacalKind): boolean => kind === "morning_first" || kind === "evening_first";

/** The "first" that ends the invisibility a "last" begins. */
const RETURN_OF: Partial<Record<HeliacalKind, HeliacalKind>> = {
  evening_last: "morning_first", morning_last: "evening_first",
};

/** The state of a year's search, complete or partway. */
export interface VisibilitySearch {
  jdStart: number;
  jdEnd: number;
  /** Events inside the year, in time order. */
  events: HeliacalEvent[];
  /** Events found just outside the year, kept only to bound the gaps. */
  outside: HeliacalEvent[];
  /** Stretches of the year in which the body is not seen: from a last
   *  visibility to the first that answers it, cut to the year. */
  gaps: Array<[number, number]>;
  /** How far the search has run, from 0 to 1. */
  progress: number;
  done: boolean;
}

/** Two events belong to one conjunction when the engine dates that
 *  conjunction to the same instant for both, within this many days. */
const SAME_CONJUNCTION = 2;

/** The first visibility that answers a last one: the return of the matching
 *  kind around the same conjunction with the Sun. */
function returnOf(last: HeliacalEvent, all: HeliacalEvent[]): HeliacalEvent | undefined {
  const back = RETURN_OF[last.kind];
  return all.find((e) => e.kind === back && Math.abs(e.conjunction - last.conjunction) < SAME_CONJUNCTION);
}

/**
 * Each absence in full: a last visibility and the first visibility that
 * follows it around the same conjunction with the Sun. The end is null when
 * the list does not hold that return. A body whose return comes before its
 * last visibility is seen at both ends of the night for a while and is never
 * lost, so that pair is no absence.
 */
export function absencesOf(all: HeliacalEvent[]): Array<[number, number | null]> {
  const sorted = [...all].sort((a, b) => a.jd - b.jd);
  const out: Array<[number, number | null]> = [];
  for (const last of sorted) {
    if (!RETURN_OF[last.kind]) continue;
    const first = returnOf(last, sorted);
    if (!first) out.push([last.jd, null]);
    else if (first.jd > last.jd) out.push([last.jd, first.jd]);
  }
  return out;
}

/**
 * Whether the events show a body that is never lost: some return to the
 * morning (or evening) sky falls on or before the last visibility at the
 * other end of the night.
 */
export function neverLost(all: HeliacalEvent[]): boolean {
  return all.some((last) => {
    if (!RETURN_OF[last.kind]) return false;
    const first = returnOf(last, all);
    return first !== undefined && first.jd <= last.jd;
  });
}

/**
 * The stretches in which the body is lost to view, from {@link absencesOf},
 * cut to `jdStart`..`jdEnd`. An absence with no known end runs to the end of
 * the span.
 */
export function gapsOf(all: HeliacalEvent[], jdStart: number, jdEnd: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [from, to] of absencesOf(all)) {
    const a = Math.max(jdStart, from);
    const b = Math.min(jdEnd, to ?? jdEnd);
    if (b > a) out.push([a, b]);
  }
  return out;
}

/**
 * The longest absence that touches the year, in calendar days at the place,
 * measured in full even where it runs past either end of the year. Null when
 * the year has no absence with both ends known.
 */
export function longestAbsence(search: VisibilitySearch, lonEast: number): number | null {
  let best: number | null = null;
  for (const [from, to] of absencesOf([...search.events, ...search.outside])) {
    if (to === null || to <= search.jdStart || from >= search.jdEnd) continue;
    const days = gapDays([from, to], lonEast);
    if (best === null || days > best) best = days;
  }
  return best;
}

/** The length of a stretch in calendar days at the place: from an evening
 *  on the 18th to a morning on the 24th is six days. */
export function gapDays(gap: [number, number], lonEast: number): number {
  return localDay(gap[1], lonEast) - localDay(gap[0], lonEast);
}

/** The event the call tile shows before one is chosen: the return to
 *  visibility. */
export function defaultKind(target: VisibilityTargetId): HeliacalKind {
  return target === "moon" ? "evening_first" : "morning_first";
}

/** How far before the year the search starts, in days, so that a stretch of
 *  invisibility already under way on 1 January is found. */
function lookback(target: VisibilityTargetId): number {
  if (target === "moon") return 6;
  if (target === "mercury" || target === "venus") return 80;
  return 220;
}

/** Options for {@link searchVisibility}. */
export interface SearchVisibilityOptions {
  /** Called after every event found with the search so far. */
  onProgress?: (search: VisibilitySearch) => void;
  /** Return true to abandon the search; checked between events. */
  cancelled?: () => boolean;
  /** How to yield between events. Defaults to a zero-delay timer, which
   *  lets a browser paint. */
  yieldFn?: () => Promise<void>;
}

/**
 * Find every first and last visibility a target has in one year, from one
 * place. Each event is one `heliacal` call, and the search yields between
 * them. Resolves with the finished search, or with the partial one if it
 * was cancelled.
 */
export async function searchVisibility(
  engine: Engine, q: VisibilityQuery, opts: SearchVisibilityOptions = {},
): Promise<VisibilitySearch> {
  const jdStart = jdOfYear(q.year);
  const jdEnd = jdOfYear(q.year + 1);
  const kinds = kindsOf(q.target);
  const events: HeliacalEvent[] = [];
  const outside: HeliacalEvent[] = [];
  const from0 = jdStart - lookback(q.target);
  const pause = opts.yieldFn
    ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const state = (progress: number, done: boolean): VisibilitySearch => ({
    jdStart, jdEnd,
    events: [...events].sort((a, b) => a.jd - b.jd),
    outside: [...outside],
    gaps: gapsOf([...events, ...outside], jdStart, jdEnd),
    progress, done,
  });
  for (let k = 0; k < kinds.length; k++) {
    let from = from0;
    for (;;) {
      if (opts.cancelled?.()) return state((k + (from - from0) / (jdEnd - from0)) / kinds.length, false);
      const ev = heliacal(engine, q.target, from, q.place.lat, q.place.lonEast, {
        kind: kinds[k], extinction: q.extinction,
      });
      if (ev === null) break;
      if (ev.jd >= jdStart && ev.jd < jdEnd) events.push(ev);
      else outside.push(ev);
      if (ev.jd >= jdEnd) break;
      from = ev.jd + 1;
      opts.onProgress?.(state((k + Math.min(1, (from - from0) / (jdEnd - from0))) / kinds.length, false));
      await pause();
    }
  }
  return state(1, true);
}

/** The event a preset opens on: the first of its kind on or after the
 *  preset's month and day, or null if the year has none. */
export function pickEvent(events: HeliacalEvent[], pick: VisibilityPreset["pick"]): HeliacalEvent | null {
  return events.find((e) => {
    if (e.kind !== pick.kind) return false;
    const s = stampOf(e.jd);
    return s.month > pick.month || (s.month === pick.month && s.day >= pick.day);
  }) ?? null;
}

/** One sample of a twilight: how the body fares at one instant. */
export interface TwilightPoint {
  /** Minutes from the event's moment of best visibility. */
  minutes: number;
  /** Limiting magnitude less the body's: above zero it can be seen. Null
   *  while the body is below the horizon. */
  margin: number | null;
  /** The Sun's true altitude, degrees. */
  sunAltitude: number;
  /** The body's apparent altitude, degrees. */
  altitude: number;
}

/** A morning or evening sampled every two minutes, on the day of an event
 *  and on the day beside it. */
export interface TwilightCurve {
  /** The day of the event. */
  day: TwilightPoint[];
  /** The day beside it: the day before a first visibility, on which the
   *  body is still lost, or the day after a last visibility. */
  beside: TwilightPoint[];
  besideIs: "before" | "after";
  /** The best margin reached on each day. */
  best: number | null;
  bestBeside: number | null;
}

/**
 * Follow a star or planet through the twilight of an event: `visibility`
 * every two minutes for an hour either side of the event's best moment, on
 * that day and on the day beside it. The body's margin stays below zero on
 * one day and clears it on the other, which is what decides the date.
 */
export function twilightCurve(
  engine: Engine, q: VisibilityQuery, ev: HeliacalEvent, span = 60, step = 2,
): TwilightCurve {
  const besideIs = isFirst(ev.kind) ? "before" : "after";
  const shift = besideIs === "before" ? -1 : 1;
  const run = (t0: number): TwilightPoint[] => {
    const out: TwilightPoint[] = [];
    for (let m = -span; m <= span; m += step) {
      const v = visibility(engine, q.target, t0 + m / 1440, q.place.lat, q.place.lonEast, {
        extinction: q.extinction,
      });
      out.push({ minutes: m, margin: v.margin, sunAltitude: v.sunAltitude, altitude: v.altitude });
    }
    return out;
  };
  const best = (pts: TwilightPoint[]): number | null => {
    const ms = pts.map((p) => p.margin).filter((m): m is number => m !== null);
    return ms.length ? Math.max(...ms) : null;
  };
  const day = run(ev.jd);
  const beside = run(ev.jd + shift);
  return { day, beside, besideIs, best: best(day), bestBeside: best(beside) };
}

/** Yallop's zones by the lower bound of q, as the guide tabulates them. */
export const YALLOP_ZONES: Array<{ zone: string; above: number; meaning: string }> = [
  { zone: "A", above: 0.216, meaning: "easily visible" },
  { zone: "B", above: -0.014, meaning: "visible under perfect conditions" },
  { zone: "C", above: -0.16, meaning: "may need optical aid to find" },
  { zone: "D", above: -0.232, meaning: "optical aid only" },
  { zone: "E", above: -0.293, meaning: "not visible with a telescope" },
];

/** Yallop's test on one evening or morning near a new Moon. */
export interface CrescentDay {
  /** Local day number, as `localDay` gives it. */
  day: number;
  /** Noon of that local day as a UT Julian Day, for labelling. */
  jd: number;
  /** Null when the Moon does not set after the Sun that evening (or rise
   *  before it that morning), so there is nothing to test. */
  q: number | null;
  zone: string | null;
  lagMinutes: number | null;
  /** Whether this is the day of the event itself. */
  chosen: boolean;
}

/**
 * Yallop's q for each evening around the conjunction of a crescent event
 * (each morning, for a last crescent): the day before the conjunction to
 * four days after it, or the mirror of that for a morning. One of these is
 * the day `heliacal` chose.
 */
export function crescentDays(engine: Engine, q: VisibilityQuery, ev: HeliacalEvent): CrescentDay[] {
  const evening = ev.kind === "evening_first";
  const day0 = localDay(ev.conjunction, q.place.lonEast);
  const offsets = evening ? [-1, 0, 1, 2, 3, 4] : [-4, -3, -2, -1, 0, 1];
  const eventDay = localDay(ev.jd, q.place.lonEast);
  return offsets.map((d) => {
    const day = day0 + d;
    const c = lunarCrescent(engine, day, q.place.lat, q.place.lonEast, {
      half: evening ? "evening" : "morning",
    });
    return {
      day, jd: day - q.place.lonEast / 360,
      q: c ? c.q : null, zone: c ? c.zone : null, lagMinutes: c ? c.lagMinutes : null,
      chosen: day === eventDay,
    };
  });
}

/** An instant as a date in the calendar that was in use: `19 Jul 139 CE`. */
export function dateText(jd: number): string {
  return stampOf(jd).text;
}

/** A date without its year, for a strip that is all one year: `19 Jul`. */
export function shortDate(jd: number): string {
  return stampOf(jd).text.replace(/ \d+ (BCE|CE)$/, "");
}

/** An event's window as text: the same event under a clearer and a hazier
 *  sky. Either end can be missing when that sky gives no event. */
export function windowText(ev: HeliacalEvent): string {
  const a = ev.earliest ?? null;
  const b = ev.latest ?? null;
  if (a === null && b === null) return "none";
  if (a === null) return `up to ${shortDate(b!)}`;
  if (b === null) return `from ${shortDate(a)}`;
  const sa = stampOf(a);
  const sb = stampOf(b);
  if (sa.month === sb.month && sa.year === sb.year) {
    return sa.day === sb.day ? shortDate(a) : `${sa.day} to ${shortDate(b)}`;
  }
  return `${shortDate(a)} to ${shortDate(b)}`;
}

/** The call that reproduces one event, as source text for the code tile. */
export function visibilitySource(q: VisibilityQuery, kind: HeliacalKind): string {
  const julian = q.year < 1583;
  const start = julian ? `julianDay(${q.year}, 1, 1, 0, 0, 0, "julian")` : `julianDay(${q.year}, 1, 1)`;
  const opts: string[] = [];
  if (kind !== "morning_first") opts.push(`kind: "${kind}"`);
  if (q.target !== "moon" && q.extinction !== 0.25) opts.push(`extinction: ${q.extinction}`);
  const tail = opts.length ? `, {\n  ${opts.join(", ")},\n}` : "";
  return [
    "import { Engine, heliacal, julianDay, calendarDate } from \"caelus\";",
    "import { embeddedData } from \"caelus/data-embedded\";",
    "",
    "const engine = new Engine(embeddedData);",
    `const start = ${start};`,
    "",
    `const ev = heliacal(engine, "${q.target}", start, ${q.place.lat}, ${q.place.lonEast}${tail});`,
    "",
    `calendarDate(ev.jd${julian ? ", \"julian\"" : ""});`,
    "// the next one: search again from ev.jd + 1",
  ].join("\n");
}

/** One event as the engine returns it, abridged, for the code tile. */
export function visibilityReturned(ev: HeliacalEvent | null): string {
  if (!ev) return "null";
  const n = (v: number | null | undefined, d: number): string =>
    v === null || v === undefined ? "null" : v.toFixed(d);
  const lines = [
    `{ target: "${ev.target}", kind: "${ev.kind}",`,
    `  method: "${ev.method}",`,
    `  jd: ${n(ev.jd, 5)},`,
    `  earliest: ${n(ev.earliest, 5)}, latest: ${n(ev.latest, 5)},`,
    `  conjunction: ${n(ev.conjunction, 5)},`,
  ];
  if (ev.method === "crescent") {
    lines.push(`  q: ${n(ev.q, 3)}, zone: "${ev.zone}", lagMinutes: ${n(ev.lagMinutes, 1)},`);
    lines.push(`  arcv: ${n(ev.arcv, 2)}, arcl: ${n(ev.arcl, 2)}, daz: ${n(ev.daz, 2)}, width: ${n(ev.width, 2)} }`);
  } else {
    lines.push(`  margin: ${n(ev.margin, 2)}, magnitude: ${n(ev.magnitude, 2)},`);
    lines.push(`  altitude: ${n(ev.altitude, 1)}, azimuth: ${n(ev.azimuth, 1)},`);
    lines.push(`  sunAltitude: ${n(ev.sunAltitude, 1)}, arcusVisionis: ${n(ev.arcusVisionis, 1)},`);
    lines.push(`  extinction: ${n(ev.extinction, 2)}, spread: ${n(ev.spread, 2)} }`);
  }
  return lines.join("\n");
}
