/**
 * caelus-widgets — the eclipses instrument, the logic half.
 *
 * The instrument asks two questions: which eclipses happen in a span of
 * years, and what does one place see of each? The engine answers with
 * `solarEclipses`, `lunarEclipses`, `solarEclipseLocal`, `lunarEclipseLocal`,
 * and, for the ground path of a central solar eclipse, `solarEclipseLimits`.
 * This module is everything around those calls that is not React: running
 * the search in slices so a page can draw progress, joining the slices,
 * deciding what "seen" means at a place, tracing a path into plot geometry,
 * and naming what comes out.
 *
 * Nothing here loads data. The host passes an `Engine`, so the same code
 * runs on the embedded tier in a browser and on the full packs in Node.
 * The interactive component lives in eclipses-widget.tsx.
 */
import {
  azAlt, jdTT, lunarEclipseLocal, lunarEclipses, solarEclipseLimits,
  solarEclipseLocal, solarEclipses,
  type Engine, type LunarEclipse, type SolarEclipse, type SolarLocal,
} from "caelus";
import { jdOfYear, stampOf } from "./sky-dating.js";

/** Preset places for the form. East longitude is positive. */
export const ECLIPSE_PLACES = [
  { id: "madrid", label: "Madrid", lat: 40.42, lonEast: -3.7 },
  { id: "dallas", label: "Dallas", lat: 32.78, lonEast: -96.8 },
  { id: "new_york", label: "New York", lat: 40.71, lonEast: -74.01 },
  { id: "delhi", label: "Delhi", lat: 28.61, lonEast: 77.21 },
  { id: "sydney", label: "Sydney", lat: -33.87, lonEast: 151.21 },
] as const;

export type EclipseKinds = "both" | "solar" | "lunar";

/** What the form holds. Years are astronomical and both inclusive. */
export interface EclipseQuery {
  startYear: number;
  endYear: number;
  kinds: EclipseKinds;
  place: { lat: number; lonEast: number };
}

/** The years the form accepts and the longest span it runs at once. */
export const ECLIPSE_SPAN = { from: -2998, to: 2998, maxYears: 100 } as const;

/** The opening query for a given year: that year and the two after it, both
 *  kinds, seen from Madrid. */
export function defaultEclipseQuery(year: number): EclipseQuery {
  return {
    startYear: year, endYear: year + 2, kinds: "both",
    place: { lat: ECLIPSE_PLACES[0].lat, lonEast: ECLIPSE_PLACES[0].lonEast },
  };
}

/** Whether a query can be run. */
export function eclipseQueryOk(q: EclipseQuery): boolean {
  if (!Number.isInteger(q.startYear) || !Number.isInteger(q.endYear)) return false;
  if (q.startYear < ECLIPSE_SPAN.from || q.endYear > ECLIPSE_SPAN.to) return false;
  if (q.endYear < q.startYear || q.endYear - q.startYear + 1 > ECLIPSE_SPAN.maxYears) return false;
  const { lat, lonEast } = q.place;
  if (!Number.isFinite(lat) || !Number.isFinite(lonEast)) return false;
  return Math.abs(lat) <= 90 && Math.abs(lonEast) <= 180;
}

/** How much of an eclipse a place gets. `seen`: the body is above the
 *  horizon at the local maximum. `partly`: it is below the horizon then but
 *  above it when the eclipse begins or ends there. `below`: the eclipse
 *  happens there with the body under the horizon throughout. `none`: no
 *  part of the Sun is covered from this place (solar only). */
export type Seen = "seen" | "partly" | "below" | "none";

/** What one place sees of a solar eclipse. */
export interface SolarSeen extends SolarLocal {
  seen: Seen;
  /** The Sun's altitude in degrees at the local maximum, or null. */
  altitude: number | null;
}

/** What one place sees of a lunar eclipse. */
export interface LunarSeen {
  seen: Exclude<Seen, "none">;
  /** The Moon's altitude in degrees at greatest eclipse. */
  altitude: number;
}

const DEG = Math.PI / 180;

/** The Sun's altitude in degrees at an instant and place. */
export function sunAltitude(engine: Engine, jd: number, lat: number, lonEast: number): number {
  const [lon, eclLat] = engine.ecliptic("sun", jdTT(jd));
  return azAlt(engine.data, lon / DEG, eclLat / DEG, jd, lat, lonEast)[1];
}

/** Local circumstances of a solar eclipse, with the horizon applied.
 *  `solarEclipseLocal` works from the geometry alone, so an eclipse that
 *  happens at night there still has a type and contact times. */
export function solarSeen(
  engine: Engine, e: SolarEclipse, place: { lat: number; lonEast: number },
): SolarSeen {
  const local = solarEclipseLocal(engine, e.tMax, place.lat, place.lonEast);
  if (local.type === "none" || local.maxTime === null) return { ...local, seen: "none", altitude: null };
  const up = (jd: number | null): boolean =>
    jd !== null && sunAltitude(engine, jd, place.lat, place.lonEast) > 0;
  const altitude = sunAltitude(engine, local.maxTime, place.lat, place.lonEast);
  const seen: Seen = altitude > 0 ? "seen" : up(local.c1) || up(local.c4) ? "partly" : "below";
  return { ...local, seen, altitude };
}

/** Whether the Moon is up for a lunar eclipse: at greatest eclipse, or
 *  failing that at the start or end of its outermost phase. */
export function lunarSeen(
  engine: Engine, e: LunarEclipse, place: { lat: number; lonEast: number },
): LunarSeen {
  const at = (jd: number) => lunarEclipseLocal(engine, jd, place.lat, place.lonEast);
  const mid = at(e.tMax);
  if (mid.visible) return { seen: "seen", altitude: mid.altitude };
  const begin = e.penumbralBegin ?? e.partialBegin ?? e.totalBegin;
  const end = e.penumbralEnd ?? e.partialEnd ?? e.totalEnd;
  const edge = (begin !== null && at(begin).visible) || (end !== null && at(end).visible);
  return { seen: edge ? "partly" : "below", altitude: mid.altitude };
}

/** One eclipse in the span with what the chosen place sees of it. */
export type EclipseRow =
  | { kind: "solar"; tMax: number; type: SolarEclipse["type"]; eclipse: SolarEclipse; local: SolarSeen }
  | { kind: "lunar"; tMax: number; type: LunarEclipse["type"]; eclipse: LunarEclipse; local: LunarSeen };

/** The state of a search, complete or partway. */
export interface EclipseSearch {
  jdStart: number;
  jdEnd: number;
  /** How far the search has run, as a Julian Day. */
  jdDone: number;
  /** Eclipses found so far, in time order. */
  rows: EclipseRow[];
  done: boolean;
}

/**
 * Fold one slice's eclipses into the running search. The engine looks a day
 * past each end of a range, so an eclipse near a slice boundary can come
 * back from both slices; it is kept once. Eclipses outside the search's own
 * range are dropped.
 */
export function foldEclipses(
  acc: EclipseSearch, found: EclipseRow[], sliceEnd: number,
): EclipseSearch {
  const rows = [...acc.rows];
  for (const row of [...found].sort((a, b) => a.tMax - b.tMax)) {
    if (row.tMax < acc.jdStart || row.tMax >= acc.jdEnd) continue;
    if (rows.some((r) => r.kind === row.kind && Math.abs(r.tMax - row.tMax) < 0.5)) continue;
    rows.push(row);
  }
  rows.sort((a, b) => a.tMax - b.tMax);
  return {
    jdStart: acc.jdStart, jdEnd: acc.jdEnd, jdDone: sliceEnd, rows,
    done: sliceEnd >= acc.jdEnd,
  };
}

/** Options for {@link searchEclipses}. */
export interface SearchEclipsesOptions {
  /** Years per slice. Smaller slices report progress more often. */
  sliceYears?: number;
  /** Called after every slice with the search so far. */
  onProgress?: (search: EclipseSearch) => void;
  /** Return true to abandon the search; checked between slices. */
  cancelled?: () => boolean;
  /** How to yield between slices. Defaults to a zero-delay timer, which
   *  lets a browser paint. */
  yieldFn?: () => Promise<void>;
}

/**
 * Find the eclipses in a span of years, in slices, with what the query's
 * place sees of each. Resolves with the finished search, or with the partial
 * one if it was cancelled.
 */
export async function searchEclipses(
  engine: Engine, q: EclipseQuery, opts: SearchEclipsesOptions = {},
): Promise<EclipseSearch> {
  const jdStart = jdOfYear(q.startYear);
  const jdEnd = jdOfYear(q.endYear + 1);
  let acc: EclipseSearch = { jdStart, jdEnd, jdDone: jdStart, rows: [], done: false };
  if (!(jdEnd > jdStart)) return { ...acc, done: true };
  const sliceYears = Math.max(1, Math.trunc(opts.sliceYears ?? 2));
  const pause = opts.yieldFn
    ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  // Slices begin on the first day of a year, so ten years in slices of two
  // is five slices whatever the leap years do.
  for (let y = q.startYear; y <= q.endYear; y += sliceYears) {
    if (opts.cancelled?.()) return acc;
    const a = jdOfYear(y);
    const b = jdOfYear(Math.min(y + sliceYears, q.endYear + 1));
    const found: EclipseRow[] = [];
    if (q.kinds !== "lunar") {
      for (const e of solarEclipses(engine, a, b)) {
        found.push({ kind: "solar", tMax: e.tMax, type: e.type, eclipse: e, local: solarSeen(engine, e, q.place) });
      }
    }
    if (q.kinds !== "solar") {
      for (const e of lunarEclipses(engine, a, b)) {
        found.push({ kind: "lunar", tMax: e.tMax, type: e.type, eclipse: e, local: lunarSeen(engine, e, q.place) });
      }
    }
    acc = foldEclipses(acc, found, b);
    opts.onProgress?.(acc);
    await pause();
  }
  return acc;
}

/** How many of the rows the place gets any part of. */
export function seenCount(rows: EclipseRow[]): number {
  return rows.filter((r) => r.local.seen === "seen" || r.local.seen === "partly").length;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** A Julian Day as UT clock time, cut to the second as the eclipses guide
 *  prints it: `18:17:23`. */
export function clockText(jd: number): string {
  const z = jd + 0.5;
  const total = Math.min(86399, Math.floor((z - Math.floor(z)) * 86400));
  return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}

/** The date of an instant in the calendar that was in use: `12 Aug 2026 CE`. */
export function dateText(jd: number): string {
  // stampOf rounds to the minute; taking half a minute off first cuts
  // instead, so the date and {@link clockText} never disagree.
  return stampOf(jd - 0.5 / 1440).text;
}

/** What a place sees of an eclipse, as one line for the table. */
export function seenText(row: EclipseRow): string {
  if (row.kind === "lunar") {
    const a = row.local.altitude;
    const alt = Math.abs(a) < 0.5 ? "Moon on the horizon" : `Moon ${Math.abs(a).toFixed(0)}° ${a > 0 ? "up" : "below the horizon"}`;
    if (row.local.seen === "seen") return alt;
    if (row.local.seen === "partly") return `in part, ${alt} at greatest eclipse`;
    return `not seen, ${alt}`;
  }
  const l = row.local;
  if (l.seen === "none") return "not seen";
  const what = `${l.type}, magnitude ${l.magnitude.toFixed(3)}`;
  if (l.seen === "below") return "not seen, Sun below the horizon";
  if (l.seen === "partly") return `in part, Sun below the horizon at maximum (${what})`;
  return what;
}

/** The local contact times of a solar eclipse, as one line, or an empty
 *  string where nothing is seen. */
export function contactsText(row: EclipseRow): string {
  if (row.kind !== "solar" || row.local.seen === "none" || row.local.seen === "below") return "";
  const l = row.local;
  const parts: string[] = [];
  if (l.c1 !== null) parts.push(`begins ${clockText(l.c1)}`);
  if (l.c2 !== null && l.c3 !== null) parts.push(`${l.type} ${clockText(l.c2)} to ${clockText(l.c3)}`);
  else if (l.maxTime !== null) parts.push(`maximum ${clockText(l.maxTime)}`);
  if (l.c4 !== null) parts.push(`ends ${clockText(l.c4)}`);
  return parts.join(", ");
}

/** One sampled instant of a central path. Longitudes are unwrapped, so a
 *  path that crosses the date line stays continuous and can pass ±180.
 *  `north` and `south` are the two limits as continuous lines: the engine
 *  names them by the direction of the ground track, and where a path curls
 *  near a pole the track turns and the names swap, so the trace follows each
 *  line through the swap. Away from the poles they are the northern and
 *  southern limits. */
export interface PathPoint {
  jd: number;
  center: [number, number];
  north: [number, number] | null;
  south: [number, number] | null;
  widthKm: number | null;
}

/** The central path of a solar eclipse, sampled from its start to its end. */
export interface PathTrace {
  points: PathPoint[];
  /** Width of the path at greatest eclipse, in kilometres, or null. */
  widthAtMaxKm: number | null;
  /** The sample nearest greatest eclipse. */
  greatest: PathPoint;
}

/**
 * Trace the central path of a solar eclipse: `solarEclipseLimits` at evenly
 * spaced instants from `begin` to `end`, keeping the instants at which a
 * central eclipse exists. Returns null for an eclipse that is partial
 * everywhere, which has no central path.
 */
export function tracePath(engine: Engine, e: SolarEclipse, samples = 120): PathTrace | null {
  const points: PathPoint[] = [];
  let ref: number | null = null;
  const unwrap = (lon: number): number => {
    if (ref === null) return lon;
    let x = lon;
    while (x - ref > 180) x -= 360;
    while (x - ref < -180) x += 360;
    return x;
  };
  for (let i = 0; i <= samples; i++) {
    const jd = e.begin + ((e.end - e.begin) * i) / samples;
    const p = solarEclipseLimits(engine, jd);
    if (!p) continue;
    const cLon = unwrap(p.center.lonEast);
    ref = cLon;
    let north: [number, number] | null = p.north ? [unwrap(p.north.lonEast), p.north.lat] : null;
    let south: [number, number] | null = p.south ? [unwrap(p.south.lonEast), p.south.lat] : null;
    // keep each limit a continuous line: if this sample's limits sit nearer
    // the other line's last point, the engine's names have swapped
    const prev = points[points.length - 1];
    if (prev?.north && prev.south && north && south) {
      const k = Math.cos(prev.center[1] * DEG);
      const d = (a: [number, number], b: [number, number]): number =>
        Math.hypot((a[0] - b[0]) * k, a[1] - b[1]);
      if (d(prev.north, south) + d(prev.south, north) < d(prev.north, north) + d(prev.south, south)) {
        [north, south] = [south, north];
      }
    }
    points.push({ jd, center: [cLon, p.center.lat], north, south, widthKm: p.widthKm });
  }
  if (points.length < 2) return null;
  const atMax = solarEclipseLimits(engine, e.tMax);
  let greatest = points[0];
  for (const p of points) if (Math.abs(p.jd - e.tMax) < Math.abs(greatest.jd - e.tMax)) greatest = p;
  return { points, widthAtMaxKm: atMax?.widthKm ?? null, greatest };
}

/** Plot geometry for a path: everything an SVG needs, in view-box units. */
export interface PathPlot {
  width: number;
  height: number;
  /** Polyline point strings. */
  center: string;
  north: string;
  south: string;
  /** The band between the limits, as a polygon point string. */
  band: string;
  /** Graticule lines with their labels. */
  meridians: Array<{ x: number; label: string }>;
  parallels: Array<{ y: number; label: string }>;
  /** Where greatest eclipse and the two ends of the path fall. */
  greatest: [number, number];
  first: [number, number];
  last: [number, number];
  /** The chosen place, when it falls inside the plot. */
  place: [number, number] | null;
}

const lonLabel = (lon: number): string => {
  const x = ((((lon + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(x) < 1e-9 || Math.abs(Math.abs(x) - 180) < 1e-9) return `${Math.abs(Math.round(x))}°`;
  return `${Math.abs(Math.round(x))}°${x < 0 ? "W" : "E"}`;
};
const latLabel = (lat: number): string =>
  Math.abs(lat) < 1e-9 ? "0°" : `${Math.abs(Math.round(lat))}°${lat < 0 ? "S" : "N"}`;

/**
 * Lay a traced path out as a plain latitude and longitude plot. Longitude
 * runs left to right and is scaled by the cosine of the middle latitude, so
 * the path keeps roughly its true proportions; nothing else is projected.
 */
export function plotPath(
  trace: PathTrace, place: { lat: number; lonEast: number } | null, width = 640,
): PathPlot {
  const all: Array<[number, number]> = [];
  for (const p of trace.points) {
    all.push(p.center);
    if (p.north) all.push(p.north);
    if (p.south) all.push(p.south);
  }
  let lon0 = Math.min(...all.map((p) => p[0]));
  let lon1 = Math.max(...all.map((p) => p[0]));
  let lat0 = Math.min(...all.map((p) => p[1]));
  let lat1 = Math.max(...all.map((p) => p[1]));
  const padLon = Math.max(2, (lon1 - lon0) * 0.06);
  const padLat = Math.max(2, (lat1 - lat0) * 0.1);
  lon0 -= padLon; lon1 += padLon;
  lat0 = Math.max(-90, lat0 - padLat); lat1 = Math.min(90, lat1 + padLat);
  const k = Math.max(0.2, Math.cos(((lat0 + lat1) / 2) * DEG));
  const scale = width / ((lon1 - lon0) * k);
  const height = Math.round(Math.min(width, Math.max(width * 0.3, (lat1 - lat0) * scale)));
  const sy = height / (lat1 - lat0);
  const xy = (p: [number, number]): [number, number] =>
    [(p[0] - lon0) * k * scale, (lat1 - p[1]) * sy];
  const str = (pts: Array<[number, number]>): string =>
    pts.map((p) => { const [x, y] = xy(p); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  const norths = trace.points.filter((p) => p.north).map((p) => p.north!);
  const souths = trace.points.filter((p) => p.south).map((p) => p.south!);

  const step = (range: number): number => {
    for (const s of [1, 2, 5, 10, 15, 30, 45]) if (range / s <= 7) return s;
    return 60;
  };
  const meridians: PathPlot["meridians"] = [];
  const ls = step(lon1 - lon0);
  for (let l = Math.ceil(lon0 / ls) * ls; l <= lon1; l += ls) {
    meridians.push({ x: (l - lon0) * k * scale, label: lonLabel(l) });
  }
  const parallels: PathPlot["parallels"] = [];
  const ps = step(lat1 - lat0);
  for (let l = Math.ceil(lat0 / ps) * ps; l <= lat1; l += ps) {
    parallels.push({ y: (lat1 - l) * sy, label: latLabel(l) });
  }

  let placeXY: [number, number] | null = null;
  if (place) {
    let lon = place.lonEast;
    const mid = (lon0 + lon1) / 2;
    while (lon - mid > 180) lon -= 360;
    while (lon - mid < -180) lon += 360;
    if (lon >= lon0 && lon <= lon1 && place.lat >= lat0 && place.lat <= lat1) placeXY = xy([lon, place.lat]);
  }
  return {
    width, height,
    center: str(trace.points.map((p) => p.center)),
    north: str(norths), south: str(souths),
    band: str([...norths, ...[...souths].reverse()]),
    meridians, parallels,
    greatest: xy(trace.greatest.center),
    first: xy(trace.points[0].center),
    last: xy(trace.points[trace.points.length - 1].center),
    place: placeXY,
  };
}

/** The calls that reproduce a query, as source text for the code tile. */
export function eclipseSource(q: EclipseQuery): string {
  const jd = (y: number): string =>
    y < 1583 ? `julianDay(${y}, 1, 1, 0, 0, 0, "julian")` : `julianDay(${y}, 1, 1)`;
  const names: string[] = ["Engine", "julianDay"];
  if (q.kinds !== "lunar") names.push("solarEclipses", "solarEclipseLocal", "solarEclipseLimits");
  if (q.kinds !== "solar") names.push("lunarEclipses", "lunarEclipseLocal");
  const { lat, lonEast } = q.place;
  const lines = [
    `import {\n  ${names.join(", ")},\n} from "caelus";`,
    "import { embeddedData } from \"caelus/data-embedded\";",
    "",
    "const engine = new Engine(embeddedData);",
    `const from = ${jd(q.startYear)};`,
    `const to = ${jd(q.endYear + 1)};`,
  ];
  if (q.kinds !== "lunar") {
    lines.push(
      "",
      "for (const e of solarEclipses(engine, from, to)) {",
      `  solarEclipseLocal(engine, e.tMax, ${lat}, ${lonEast});`,
      "  solarEclipseLimits(engine, e.tMax);   // the path at greatest eclipse",
      "}",
    );
  }
  if (q.kinds !== "solar") {
    lines.push(
      "",
      "for (const e of lunarEclipses(engine, from, to)) {",
      `  lunarEclipseLocal(engine, e.tMax, ${lat}, ${lonEast});`,
      "}",
    );
  }
  return lines.join("\n");
}

/** The shape the search returns, abridged, as source text for the code tile. */
export function eclipseReturned(rows: EclipseRow[]): string {
  const solar = rows.find((r) => r.kind === "solar");
  const lunar = rows.find((r) => r.kind === "lunar");
  const lines: string[] = [];
  if (solar && solar.kind === "solar") {
    const e = solar.eclipse;
    lines.push(
      "// solarEclipses, first of " + rows.filter((r) => r.kind === "solar").length,
      `{ tMax: ${e.tMax.toFixed(5)}, type: "${e.type}",`,
      `  gamma: ${e.gamma.toFixed(4)},`,
      `  begin: ${e.begin.toFixed(5)}, end: ${e.end.toFixed(5)} }`,
      "// solarEclipseLocal",
      `{ type: "${solar.local.type}", magnitude: ${solar.local.magnitude.toFixed(3)},`,
      `  obscuration: ${solar.local.obscuration.toFixed(3)},`,
      `  maxTime: ${solar.local.maxTime === null ? "null" : solar.local.maxTime.toFixed(5)}, c1, c2, c3, c4 }`,
    );
  }
  if (lunar && lunar.kind === "lunar") {
    const e = lunar.eclipse;
    if (lines.length) lines.push("");
    lines.push(
      "// lunarEclipses, first of " + rows.filter((r) => r.kind === "lunar").length,
      `{ tMax: ${e.tMax.toFixed(5)}, type: "${e.type}",`,
      `  magUmbral: ${e.magUmbral.toFixed(3)}, magPenumbral: ${e.magPenumbral.toFixed(3)},`,
      "  penumbralBegin, penumbralEnd, partialBegin, ... }",
      "// lunarEclipseLocal",
      `{ altitude: ${lunar.local.altitude.toFixed(1)}, visible: ${lunar.local.altitude > 0} }`,
    );
  }
  return lines.length ? lines.join("\n") : "[]";
}
