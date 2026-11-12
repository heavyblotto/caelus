/**
 * caelus-widgets — sky dating, the logic half.
 *
 * The instrument asks one question: on which dates did a described sky
 * occur? The engine answers it with `dateSky`. This module is everything
 * around that call that is not React: turning the form's state into
 * constraints, running the search in slices so a page can draw progress,
 * stitching the slices back together, and formatting what comes out.
 *
 * Nothing here loads data. The host passes an `Engine`, so the same code
 * runs on the embedded tier in a browser and on the full packs in Node.
 * The interactive component lives in sky-dating-widget.tsx.
 */
import {
  calendarDate, dateSky, julianDay, SIGNS,
  type DateSkyResult, type Engine, type SkyConstraint, type Zodiac,
} from "caelus";

/** The bodies the form offers, slowest first, with their glyphs. */
export const SKY_BODIES = [
  { id: "saturn", label: "Saturn", glyph: "♄" },
  { id: "jupiter", label: "Jupiter", glyph: "♃" },
  { id: "mars", label: "Mars", glyph: "♂︎" },
  { id: "sun", label: "Sun", glyph: "☉" },
  { id: "venus", label: "Venus", glyph: "♀︎" },
  { id: "mercury", label: "Mercury", glyph: "☿" },
  { id: "moon", label: "Moon", glyph: "☽" },
] as const;

export type SkyBodyId = (typeof SKY_BODIES)[number]["id"];

/** Lunar phases as eight 45° arcs of the Moon's elongation from the Sun. */
export const SKY_PHASES = [
  { id: "new", label: "New", from: 337.5, to: 22.5 },
  { id: "waxing_crescent", label: "Waxing crescent", from: 22.5, to: 67.5 },
  { id: "first_quarter", label: "First quarter", from: 67.5, to: 112.5 },
  { id: "waxing_gibbous", label: "Waxing gibbous", from: 112.5, to: 157.5 },
  { id: "full", label: "Full", from: 157.5, to: 202.5 },
  { id: "waning_gibbous", label: "Waning gibbous", from: 202.5, to: 247.5 },
  { id: "last_quarter", label: "Last quarter", from: 247.5, to: 292.5 },
  { id: "waning_crescent", label: "Waning crescent", from: 292.5, to: 337.5 },
] as const;

export type SkyPhaseId = (typeof SKY_PHASES)[number]["id"];

/** What the form holds. A body with no entry is unconstrained. */
export interface SkyQuery {
  /** Sign index 0–11 per body. */
  signs: Partial<Record<SkyBodyId, number>>;
  phase: SkyPhaseId | null;
  zodiac: Zodiac;
  /** Degrees added to both sides of every sign. */
  pad: number;
  /** Astronomical years, both inclusive: year 0 is 1 BCE. */
  startYear: number;
  endYear: number;
}

/** The first day the Gregorian calendar was in use: 15 October 1582. */
export const GREGORIAN_START_JD = 2299160.5;

/** The Julian Day at 0h UT on 1 January of an astronomical year, in the
 *  calendar that was in use (Julian through 1582). */
export function jdOfYear(year: number): number {
  return julianDay(year, 1, 1, 0, 0, 0, year < 1583 ? "julian" : "gregorian");
}

/** The form's state as `dateSky` constraints, in the form's own order. */
export function buildConstraints(q: SkyQuery): SkyConstraint[] {
  const out: SkyConstraint[] = [];
  for (const b of SKY_BODIES) {
    const sign = q.signs[b.id];
    if (sign !== undefined) out.push({ body: b.id, sign: SIGNS[sign] });
  }
  if (q.phase) {
    const p = SKY_PHASES.find((x) => x.id === q.phase)!;
    out.push({ elongation: ["moon", "sun"], from: p.from, to: p.to });
  }
  return out;
}

/** The signs the seven bodies occupy at an instant, as a query's `signs`. */
export function signsAt(
  engine: Engine, jdUt: number, zodiac: Zodiac = "tropical",
): Record<SkyBodyId, number> {
  const out = {} as Record<SkyBodyId, number>;
  for (const b of SKY_BODIES) {
    out[b.id] = Math.floor(engine.longitude(b.id, jdUt, { zodiac }) / 30) % 12;
  }
  return out;
}

/** One constraint's track on the timeline. */
export interface SkyStage {
  /** Index into the constraints passed to the search. */
  constraint: number;
  label: string;
  /** Windows left after this constraint, merged across slices. */
  spans: Array<[number, number]>;
  days: number;
}

/** The state of a search, complete or partway. */
export interface SkySearch {
  jdStart: number;
  jdEnd: number;
  /** How far the search has run, as a Julian Day. */
  jdDone: number;
  /** Constraints in scan order, slowest first. */
  stages: SkyStage[];
  /** The last stage's spans: the windows in which everything held. */
  windows: Array<[number, number]>;
  done: boolean;
}

/** Join spans that meet end to start, which is how a window cut by a slice
 *  boundary comes back. The input must be in time order. */
export function mergeSpans(spans: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [s, e] of spans) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Fold one slice's result into the running search. */
export function foldSlice(
  acc: SkySearch, res: DateSkyResult, sliceEnd: number,
): SkySearch {
  const stages = res.funnel.map((f, i) => {
    const prev = acc.stages[i];
    const spans = mergeSpans([...(prev?.spans ?? []), ...(f.spans ?? [])]);
    let days = 0;
    for (const [s, e] of spans) days += e - s;
    return { constraint: f.constraint, label: f.label, spans, days };
  });
  const last = stages[stages.length - 1];
  return {
    jdStart: acc.jdStart, jdEnd: acc.jdEnd, jdDone: sliceEnd,
    stages, windows: last ? last.spans : [],
    done: sliceEnd >= acc.jdEnd,
  };
}

/** Options for {@link searchSky}. */
export interface SearchSkyOptions {
  /** Years per slice. Smaller slices report progress more often. */
  sliceYears?: number;
  /** Called after every slice with the search so far. */
  onProgress?: (search: SkySearch) => void;
  /** Return true to abandon the search; checked between slices. */
  cancelled?: () => boolean;
  /** How to yield between slices. Defaults to a zero-delay timer, which
   *  lets a browser paint. */
  yieldFn?: () => Promise<void>;
}

/**
 * Run a sky-dating search in slices, yielding between them. Resolves with the
 * finished search, or with the partial one if it was cancelled.
 */
export async function searchSky(
  engine: Engine, q: SkyQuery, opts: SearchSkyOptions = {},
): Promise<SkySearch> {
  const constraints = buildConstraints(q);
  const jdStart = jdOfYear(q.startYear);
  const jdEnd = jdOfYear(q.endYear + 1);
  let acc: SkySearch = {
    jdStart, jdEnd, jdDone: jdStart, stages: [], windows: [], done: false,
  };
  if (constraints.length === 0 || !(jdEnd > jdStart)) return { ...acc, done: true };
  const sliceDays = (opts.sliceYears ?? 250) * 365.25;
  const pause = opts.yieldFn
    ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (let a = jdStart; a < jdEnd; a += sliceDays) {
    if (opts.cancelled?.()) return acc;
    const b = Math.min(a + sliceDays, jdEnd);
    const res = dateSky(engine, constraints, a, b, {
      zodiac: q.zodiac, pad: q.pad, keepStages: true, maxWindows: 100000,
    });
    acc = foldSlice(acc, res, b);
    opts.onProgress?.(acc);
    await pause();
  }
  return acc;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A year as text: `76 CE`, `410 BCE`. */
export function eraYear(year: number): string {
  return year > 0 ? `${year} CE` : `${1 - year} BCE`;
}

/** A Julian Day as a dated stamp in the calendar that was in use. */
export function stampOf(jd: number): {
  calendar: "julian" | "gregorian"; year: number; month: number; day: number;
  ut: string; text: string;
} {
  const calendar = jd < GREGORIAN_START_JD ? "julian" as const : "gregorian" as const;
  // half a minute forward and floor: rounds to the minute without printing 24:00
  const d = calendarDate(jd + 0.5 / 1440, calendar);
  const minutes = Math.min(1439, Math.floor(d.hour * 60));
  const pad2 = (n: number): string => String(n).padStart(2, "0");
  return {
    calendar, year: d.year, month: d.month, day: d.day,
    ut: `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`,
    text: `${d.day} ${MONTHS[d.month - 1]} ${eraYear(d.year)}`,
  };
}

/** A window as one line: `24 to 26 Jan 76 CE`, or both dates in full when
 *  it crosses a month. */
export function windowText(start: number, end: number): string {
  const a = stampOf(start);
  const b = stampOf(end);
  if (a.year === b.year && a.month === b.month) {
    return a.day === b.day ? a.text : `${a.day} to ${b.text}`;
  }
  return `${a.text} to ${b.text}`;
}

/** A longitude as degrees and minutes within its sign: `19°36′`. */
export function signDegree(lon: number): string {
  const within = ((lon % 30) + 30) % 30;
  let deg = Math.floor(within);
  let min = Math.round((within - deg) * 60);
  if (min === 60) { deg += 1; min = 0; }
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

/** The three-letter abbreviation the tables use for a sign. */
export function signAbbr(index: number): string {
  return SIGNS[index].slice(0, 3);
}

/** The call that reproduces a query, as source text for the code tile. */
export function callSource(q: SkyQuery): string {
  const lines = buildConstraints(q).map((c) => {
    if ("elongation" in c && "from" in c) {
      return `  { elongation: ["moon", "sun"], from: ${c.from}, to: ${c.to} },`;
    }
    if ("body" in c && "sign" in c) return `  { body: "${c.body}", sign: "${c.sign}" },`;
    return "";
  });
  const jd = (y: number): string =>
    y < 1583 ? `julianDay(${y}, 1, 1, 0, 0, 0, "julian")` : `julianDay(${y}, 1, 1)`;
  const opts: string[] = [];
  if (q.zodiac !== "tropical") opts.push(`zodiac: "${q.zodiac}"`);
  if (q.pad) opts.push(`pad: ${q.pad}`);
  const optText = opts.length ? `, { ${opts.join(", ")} }` : "";
  return [
    "import { Engine, dateSky, julianDay, calendarDate } from \"caelus\";",
    "import { embeddedData } from \"caelus/data-embedded\";",
    "",
    "const engine = new Engine(embeddedData);",
    "",
    "const { windows, funnel } = dateSky(engine, [",
    ...lines,
    `], ${jd(q.startYear)}, ${jd(q.endYear + 1)}${optText});`,
    "",
    "windows.map((w) => calendarDate(w.start, \"julian\"));",
  ].join("\n");
}

/** Named starting points for the form. */
export interface SkyPreset {
  id: string;
  label: string;
  /** One sentence on what the preset is and where its positions come from. */
  note: string;
  query: SkyQuery;
}

const sign = (name: string): number => SIGNS.indexOf(name);

/** The two historical horoscopes the engine's tests date, as presets. */
export const SKY_PRESETS: SkyPreset[] = [
  {
    id: "hadrian",
    label: "Horoscope of Hadrian",
    note: "The signs usually quoted from Hephaestio of Thebes. Neugebauer and "
      + "Van Hoesen date it to 24 January 76 CE. The text's zodiac ran a few "
      + "degrees ahead of the tropical one, so each sign is widened by 6°.",
    query: {
      signs: {
        saturn: sign("Capricorn"), jupiter: sign("Aquarius"), mars: sign("Pisces"),
        sun: sign("Aquarius"), venus: sign("Pisces"), mercury: sign("Capricorn"),
        moon: sign("Aquarius"),
      },
      phase: null, zodiac: "tropical", pad: 6, startYear: -2998, endYear: 2998,
    },
  },
  {
    id: "babylon",
    label: "Babylonian tablet, four planets",
    note: "The four signs usually quoted for the oldest surviving Babylonian "
      + "horoscope, which A. Sachs dated to 29 April 410 BCE.",
    query: {
      signs: {
        saturn: sign("Cancer"), jupiter: sign("Pisces"), mars: sign("Gemini"),
        venus: sign("Taurus"),
      },
      phase: null, zodiac: "tropical", pad: 0, startYear: -800, endYear: -1,
    },
  },
];
