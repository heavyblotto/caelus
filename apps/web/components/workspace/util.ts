import {
  SIGNS, BODIES, mod, findAspects, julianDay, planetaryHour,
  type BodyId, type Chart, type Constraint, type Engine, type HouseSystem, type Zodiac,
} from "caelus";
import type { WheelChart } from "caelus-wheel";
import type { BirthShare, FormShare, KundliStyle, Tradition } from "../../lib/share";

export type DocKind = "birth" | "form";
export type ProgressMethod = "secondary" | "solar-arc";
export type FigureView =
  | "natal" | "sphere" | "map" | "transits" | "tri" | "harmonic" | "antiscia" | "heliocentric"
  | "houses" | "derive" | "sect" | "retrograde" | "dial";
export type RailId =
  | "reading" | "placements" | "aspects" | "timing" | "compare"
  | "compose" | "sky" | "rectify" | "vedic" | "json"
  | "electional" | "synthetic";

export const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
export const fmtIso = (y: number, mo: number, d: number, h: number, mi: number) =>
  `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`;

export function isoFromJd(jd: number): string {
  return new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16);
}

export function jdFromIso(iso: string): number {
  const d = new Date(iso.length === 16 ? iso + ":00Z" : iso);
  return julianDay(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  );
}

export function jdToUtc(jd: number): string {
  return isoFromJd(jd).replace("T", " ");
}

export const DEFAULT_FORM: Constraint[] = [
  { kind: "sign", body: "sun", sign: 0 },
  { kind: "sign", body: "moon", sign: 3 },
  { kind: "aspect", a: "mars", b: "saturn", angle: 90 },
];

export function birthShareOf(opts: {
  t: string; la: string; lo: string; h: HouseSystem; z: Zodiac;
  n?: string; trad: Tradition; kundli: KundliStyle; timeUnknown: boolean;
}): BirthShare {
  const s: BirthShare = { v: 1, t: opts.t, la: opts.la, lo: opts.lo, h: opts.h, z: opts.z, trad: opts.trad, kundli: opts.kundli };
  if (opts.n?.trim()) s.n = opts.n.trim();
  if (opts.timeUnknown) s.time = "unknown";
  return s;
}

export function formShareOf(constraints: Constraint[], n?: string): FormShare {
  const s: FormShare = { v: 2, kind: "form", constraints };
  if (n?.trim()) s.n = n.trim();
  return s;
}

/** Aries-fixed wheel for a compiled form: no natal houses, dummy equal cusps. */
export function formAsWheel(longitudes: Record<string, number>): WheelChart {
  const bodies: WheelChart["bodies"] = {};
  for (const [k, lon] of Object.entries(longitudes)) bodies[k] = { lon };
  const aspects = findAspects(
    Object.fromEntries(Object.entries(longitudes).map(([k, lon]) => [k, { lon }])) as Parameters<typeof findAspects>[0],
  );
  return {
    bodies,
    angles: { asc: 0, mc: 90 },
    cusps: Array.from({ length: 12 }, (_, i) => i * 30),
    aspects,
  };
}

/** Solar-arc directed copy of a natal chart (same aspects; angles and bodies + arc). */
export function directedChart(natal: Chart, arc: number): Chart {
  const shift = (lon: number) => mod(lon + arc, 360);
  const bodies = Object.fromEntries(
    Object.entries(natal.bodies).map(([k, p]) => {
      if (!p) return [k, p];
      const lon = shift(p.lon);
      return [k, { ...p, lon, sign: SIGNS[Math.floor(lon / 30) % 12], signDeg: mod(lon, 30) }];
    }),
  ) as Chart["bodies"];
  return {
    ...natal,
    bodies,
    angles: {
      ...natal.angles,
      asc: shift(natal.angles.asc),
      mc: shift(natal.angles.mc),
      vertex: shift(natal.angles.vertex),
      eastPoint: shift(natal.angles.eastPoint),
    },
    cusps: natal.cusps.map(shift),
  };
}

export interface RisingWindow {
  sign: number;
  signName: string;
  startJd: number;
  endJd: number;
  midJd: number;
  ascMid: number;
  mcMid: number;
}

/** ASC sign-change windows across a UTC day, same loop as MCP rectification_grid. */
export function risingWindows(
  engine: Engine, dateIso: string, lat: number, lon: number,
  stepMin = 20, windowStartHour = 0, windowEndHour = 24,
): RisingWindow[] {
  const d = new Date(dateIso.length >= 10 ? dateIso.slice(0, 10) + "T00:00:00Z" : dateIso);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, day = d.getUTCDate();
  type Sample = { jd: number; sign: number; asc: number; mc: number };
  const samples: Sample[] = [];
  for (let m = windowStartHour * 60; m <= windowEndHour * 60; m += stepMin) {
    const jd = julianDay(y, mo, day, 0, m, 0);
    const c = engine.chartAt(jd, lat, lon, { houseSystem: "whole_sign" });
    samples.push({
      jd, sign: Math.floor(mod(c.angles.asc, 360) / 30),
      asc: c.angles.asc, mc: c.angles.mc,
    });
  }
  if (!samples.length) return [];
  const out: RisingWindow[] = [];
  let i = 0;
  while (i < samples.length) {
    const sign = samples[i].sign;
    let j = i;
    while (j + 1 < samples.length && samples[j + 1].sign === sign) j++;
    const start = samples[i], end = samples[j];
    const mid = samples[Math.floor((i + j) / 2)];
    out.push({
      sign, signName: SIGNS[sign],
      startJd: start.jd, endJd: end.jd, midJd: mid.jd,
      ascMid: mid.asc, mcMid: mid.mc,
    });
    i = j + 1;
  }
  return out;
}

export const CLASSICAL = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const;
export const MAP_BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron", "true_node",
] as const;
export const MAP_ANGLES = ["mc", "ic", "asc", "dsc"] as const;
export type MapAngle = (typeof MAP_ANGLES)[number];

export const HELIO_BODIES = [
  "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron",
] as const;

export const PHENO_BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

/** Extra body ids beyond the default natal set, once packs (or synthetics) are on the engine. */
export function extraBodyIds(engine: Engine): BodyId[] {
  const core = new Set<string>(BODIES);
  return engine.bodies().filter((b) => !core.has(b));
}

/** The 24 planetary hours of the civil day that contains `jd`, sunrise to next sunrise. */
export function hoursOfDay(engine: Engine, jd: number, lat: number, lon: number) {
  const now = planetaryHour(engine, jd, lat, lon);
  if (!now) return [];
  let h = now;
  while (h.hour > 1) {
    const prev = planetaryHour(engine, h.start - 1e-5, lat, lon);
    if (!prev || prev.start >= h.start) break;
    h = prev;
  }
  const out = [h];
  for (let i = 0; i < 23; i++) {
    const next = planetaryHour(engine, h.end + 1e-5, lat, lon);
    if (!next) break;
    h = next;
    out.push(h);
  }
  return out;
}

/** Chart-defining params shared by Playground widget figures. */
export interface PlaygroundChartParams {
  instant: { y: number; mo: number; d: number; h: number; mi: number; s: number };
  place: { latDeg: number; lonEastDeg: number; label?: string };
  houseSystem?: HouseSystem;
}

/** UT civil fields for widget `ChartParams`, from the chart's Julian Day. */
export function playgroundChartParams(
  jdUt: number,
  latDeg: number,
  lonEastDeg: number,
  houseSystem: HouseSystem,
  placeLabel?: string,
): PlaygroundChartParams {
  const iso = isoFromJd(jdUt);
  const [date, time] = iso.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return {
    instant: { y, mo, d, h, mi, s: 0 },
    place: { latDeg, lonEastDeg, ...(placeLabel ? { label: placeLabel } : {}) },
    houseSystem,
  };
}
