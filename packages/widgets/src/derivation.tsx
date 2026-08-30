/**
 * caelus-widgets — the derivation widget.
 *
 * One parameter `t` runs a continuous transformation from the sky at
 * the birthplace to the finished natal wheel: `SKY` (0) → `SPHERE`
 * (0.25) → `ECLIPTIC` (0.5) → `HORIZON` (0.75) → `WHEEL` (1). The
 * widget explains what a chart is without words.
 *
 * The pipeline splits in two. `deriveScene` runs the engine once and
 * returns a serializable scene: body positions in both frames, the
 * ecliptic→horizontal rotation, the wheel payload. `DerivationFigure`
 * is then a pure function of (scene, t) — no engine, no state, no
 * wall clock — so the same scene renders on the server (the plate),
 * in the browser (the scrub), and in the figure harness (the hash).
 *
 * Geometry notes, matching the plan (encyclopedia-widgets-plan.md):
 *
 * - Bodies always position from the ecliptic frame:
 *   `eclToHor · unitVector(λ, β·(1−s))`, `s` the flatten factor. At
 *   s = 0 this IS the true sky direction (both frames name the same
 *   point), so the coordinate handoff costs nothing and the settle is
 *   one interpolation.
 * - The camera pull-back is the engine's `radialScale` sweep: shape
 *   0 → 1 (equidistant fisheye → orthographic) with the field
 *   widening to the full sphere. Under orthographic the far
 *   hemisphere folds back into the disc — the glass-sphere view.
 * - The settle aims the camera at the ecliptic *south* pole: for an
 *   observer at the center that is the view an external observer
 *   above the *north* pole sees, and it makes longitude run
 *   counterclockwise, the wheel's handedness, with no late flip.
 * - An in-plane page rotation carries the Ascendant to the left edge;
 *   `t = 1` renders the standard `ChartWheel` itself, so the end of
 *   the morph is the ordinary figure by construction.
 * - The horizon carries the heaviest ink line and the ecliptic the
 *   oxblood accent, fixed across all five stations (the two
 *   characters). Without `overlays`, bodies stay grey dots until the
 *   wheel dresses them. With `overlays`, ecliptic / signs / houses /
 *   constellation figures and body glyphs draw from t = 0.
 */
import type { ReactElement } from "react";
import {
  azAlt, dirFromAzAlt, julianDay, jdTT, precessEcliptic, skyProjector,
  unitVector, VERSION, J2000, DEG as RAD,
  type Engine, type Vec3,
} from "caelus";
import {
  ChartWheel, GLYPHS, PLATE_THEME, PLATE_TOKENS, type WheelChart, type WheelTheme,
} from "caelus-wheel";
import type { ConsoleStation } from "./console.js";
import { dm, fmtZodiac } from "./format.js";
import { wheelPayload } from "./payload.js";
import type { DerivationParams } from "./spec.js";

// ------------------------------------------------------------------ scene

export interface SceneBody {
  id: string;
  /** Ecliptic longitude and latitude, degrees, of date. */
  lon: number;
  lat: number;
  /** True (unrefracted) horizontal position at the instant. */
  azDeg: number;
  altDeg: number;
  retrograde: boolean;
}

/** Constellation figure, vertices as ecliptic-of-date (lon, lat) degrees. */
export interface SceneFigure {
  con: string;
  segs: Array<Array<[number, number]>>;
}

export interface SceneFigureLabel {
  name: string;
  lon: number;
  lat: number;
}

export interface DerivationScene {
  bodies: SceneBody[];
  asc: number;
  mc: number;
  cusps: number[];
  /** The finished chart, exactly what `ChartWheel` takes at t = 1. */
  wheel: WheelChart;
  /** Ecliptic→horizontal rotation: the images of the ecliptic basis
   *  vectors (0 Aries, 90°, north pole) in the local horizontal
   *  frame. Orthonormal by construction. */
  eclToHor: [Vec3, Vec3, Vec3];
  /** Azimuth of the ascending ecliptic point, for the opening aim. */
  ascAz: number;
  /** Constellation figures of date, for the optional overlay layer. */
  figures: SceneFigure[];
  figureLabels: SceneFigureLabel[];
  /** Engine version that computed the scene, for the stamp. */
  engineVersion: string;
  params: DerivationParams;
}

/**
 * Run the engine once and capture everything the morph needs, as
 * serializable data. The rotation columns come from `azAlt` on the
 * ecliptic basis directions, so they carry the same precession,
 * nutation, and sidereal time as the per-body positions — the two
 * paths cannot disagree.
 */
export function deriveScene(
  engine: Engine, params: DerivationParams,
): DerivationScene {
  const { instant: i, place: p } = params;
  const jd = julianDay(i.y, i.mo, i.d, i.h, i.mi, i.s);
  const chart = engine.chart(
    i.y, i.mo, i.d, i.h, i.mi, i.s, p.latDeg, p.lonEastDeg,
    params.houseSystem ?? "placidus",
  );
  const hor = (lon: number, lat: number): [number, number] =>
    azAlt(engine.data, lon, lat, jd, p.latDeg, p.lonEastDeg);
  const horDir = (lon: number, lat: number): Vec3 => {
    const [az, alt] = hor(lon, lat);
    return dirFromAzAlt(az, alt);
  };

  const bodies: SceneBody[] = [];
  for (const [id, b] of Object.entries(chart.bodies)) {
    if (!b) continue;
    const [azDeg, altDeg] = hor(b.lon, b.lat);
    bodies.push({
      id, lon: b.lon, lat: b.lat, azDeg, altDeg,
      retrograde: !!b.retrograde,
    });
  }

  const figures: SceneFigure[] = [];
  const figureLabels: SceneFigureLabel[] = [];
  const pack = engine.data.constellations;
  if (pack) {
    const jde = jdTT(jd);
    const toDate = (lo: number, la: number): [number, number] => {
      const [l2, b2] = precessEcliptic(lo * RAD, la * RAD, J2000, jde);
      return [l2 / RAD, b2 / RAD];
    };
    for (const fig of pack.lines) {
      figures.push({
        con: fig.con,
        segs: fig.segs.map((seg) => seg.map(([lo, la]) => toDate(lo, la))),
      });
    }
    for (const lab of pack.labels) {
      const [lon, lat] = toDate(lab.lon, lab.lat);
      figureLabels.push({ name: lab.name, lon, lat });
    }
  }

  return {
    bodies,
    asc: chart.angles.asc,
    mc: chart.angles.mc,
    cusps: chart.cusps,
    wheel: wheelPayload(chart),
    eclToHor: [horDir(0, 0), horDir(90, 0), horDir(0, 90)],
    ascAz: hor(chart.angles.asc, 0)[0],
    figures,
    figureLabels,
    engineVersion: VERSION,
    params,
  };
}

// --------------------------------------------------------------- stations

export const DERIVATION_STATIONS: ConsoleStation[] = [
  { id: "sky", label: "SKY", t: 0 },
  { id: "sphere", label: "SPHERE", t: 0.25 },
  { id: "ecliptic", label: "ECLIPTIC", t: 0.5 },
  { id: "horizon", label: "HORIZON", t: 0.75 },
  { id: "wheel", label: "WHEEL", t: 1 },
];

/** Scrub position where a scenic `openingAim` hands off to SKY. */
export const VIEW_HANDOFF = 0.2;

/** Canonical morph parameter: with an opening aim, `t` in [0, VIEW_HANDOFF]
 *  is the scenic pre-roll and the existing SKY→WHEEL ramps occupy the rest. */
export function morphParameter(t: number, openingAim?: { az: number; alt: number }): number {
  const x = clamp01(t);
  if (!openingAim) return x;
  if (x <= VIEW_HANDOFF) return 0;
  return (x - VIEW_HANDOFF) / (1 - VIEW_HANDOFF);
}

/** Home-page console: VIEW overlay beats, then the five derivation stations. */
export const HOME_DERIVATION_STATIONS: ConsoleStation[] = [
  { id: "view", label: "VIEW", t: 0 },
  { id: "figures", label: "FIGURES", t: 0.07 },
  { id: "zodiac", label: "ZODIAC", t: 0.13 },
  { id: "sky", label: "SKY", t: VIEW_HANDOFF },
  { id: "sphere", label: "SPHERE", t: VIEW_HANDOFF + 0.25 * (1 - VIEW_HANDOFF) },
  { id: "ecliptic", label: "ECLIPTIC", t: VIEW_HANDOFF + 0.5 * (1 - VIEW_HANDOFF) },
  { id: "horizon", label: "HORIZON", t: VIEW_HANDOFF + 0.65 * (1 - VIEW_HANDOFF) },
  { id: "wheel", label: "WHEEL", t: 1 },
];

/** Optional per-station captions (params.captions draws them), in
 *  apparatus register: one sentence naming what the station shows. */
export const STATION_CAPTIONS: Record<string, string> = {
  view: "The sky as a photograph from this place, aimed at the Sun, the Moon, or south. Bodies in the frame are named.",
  figures: "The constellation figures of this sky, drawn as they sit on the sphere.",
  zodiac: "The ecliptic and the twelve signs. Longitude is the number the chart is made of.",
  sky: "The sky from the birthplace at the birth instant; bodies below the horizon are faint. The chart is not what you could see.",
  sphere: "The whole celestial sphere. The horizon is a great circle, and the hidden hemisphere swings into view.",
  ecliptic: "The camera turns toward the ecliptic pole and each body drops a perpendicular tick onto the band.",
  horizon: "Horizon and ecliptic cross at exactly two points. The eastern crossing is the Ascendant. From here the sphere folds onto the page.",
  wheel: "Latitude collapses onto the ecliptic plane, the disc squares to the page, and the natal wheel fades into place.",
};

// ----------------------------------------------------------------- datum

/** The follow datum line, exactly the console's register:
 *  `alt +34° 12′ · az 158° · λ 19°27′ ♊ · β +1°02′`. */
export function derivationDatum(b: SceneBody): string {
  const [ad, am] = dm(b.altDeg);
  const altSign = b.altDeg < 0 ? "−" : "+";
  const [bd, bm] = dm(b.lat);
  const betaSign = b.lat < 0 ? "−" : "+";
  return `alt ${altSign}${ad}° ${am}′ · az ${Math.round(b.azDeg)}° · `
    + `λ ${fmtZodiac(b.lon)} · β ${betaSign}${bd}°${bm}′`;
}

/** A civil instant shifted by whole minutes, in UT calendar arithmetic.
 *  Pure: the clock interaction is a params change, never a clock read. */
export function shiftInstant(
  i: { y: number; mo: number; d: number; h: number; mi: number; s: number },
  minutes: number,
): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const t = new Date(Date.UTC(i.y, i.mo - 1, i.d, i.h, i.mi + minutes, i.s));
  return {
    y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(),
    h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds(),
  };
}

// --------------------------------------------------------------- geometry

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓"];

function bodyCaption(id: string): string {
  if (id === "true_node" || id === "mean_node") return "Node";
  return id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const DEG = RAD;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** Smoothstep ramp of `t` across [a, b]. */
const ramp = (t: number, a: number, b: number): number => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** Cubic ease-out: motion lands on the end pose instead of hitting it. */
const rampOut = (t: number, a: number, b: number): number => {
  const x = clamp01((t - a) / (b - a));
  const y = 1 - x;
  return 1 - y * y * y;
};
const fix = (v: number): number => Math.round(v * 100) / 100;

const mul = (m: [Vec3, Vec3, Vec3], v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Spherical interpolation between unit vectors. */
function slerp(a: Vec3, b: Vec3, x: number): Vec3 {
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  const om = Math.acos(c);
  if (om < 1e-9) return a;
  const sa = Math.sin((1 - x) * om) / Math.sin(om);
  const sb = Math.sin(x * om) / Math.sin(om);
  return [
    sa * a[0] + sb * b[0],
    sa * a[1] + sb * b[1],
    sa * a[2] + sb * b[2],
  ];
}

/** Azimuth/altitude (degrees) of a unit direction in the horizontal
 *  frame (x east, y north, z up) — the inverse of `dirFromAzAlt`. */
function azAltOfDir(v: Vec3): [number, number] {
  const az = ((Math.atan2(v[0], v[1]) / DEG) + 360) % 360;
  return [az, Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG];
}

// --------------------------------------------------------------- figure

export interface DerivationFigureProps {
  scene: DerivationScene;
  /** Scrub position in [0, 1]. */
  t: number;
  /** Square size in px. */
  size?: number;
  /** Body id held highlighted through the morph. Its projection tick
   *  stays drawn at every t, not only past the ECLIPTIC ramp. */
  follow?: string;
  /** Scenic camera for a VIEW pre-roll. When set, `t` in [0, 0.2] slerps
   *  from this aim onto the Ascendant opening, then the usual morph
   *  occupies [0.2, 1]. Omit for the playground path (SKY at t = 0). */
  openingAim?: { az: number; alt: number };
  /** Draw body glyphs and names from t = 0, then fade in constellation
   *  figures, the ecliptic, signs, and houses as t advances. Omit for
   *  the playground path (those layers still fade in on the existing
   *  ramps). With overlays the camera keeps tilting from SPHERE through
   *  HORIZON so that range is not a still frame. */
  overlays?: boolean;
  /** Free-orbit offset (degrees) applied to the camera aim; the scrub
   *  owns the canonical view, so the widget clears this on release. */
  orbit?: { az: number; alt: number };
  /** Tap-a-body callback; handlers attach only when provided, so the
   *  server render (and the figure harness) is byte-identical without
   *  it. */
  onPick?: (id: string) => void;
  /** Wheel theme at t = 1; defaults to the plate theme. */
  theme?: Partial<WheelTheme>;
}

/**
 * The morph: a pure function of (scene, t). At `t = 1` it returns the
 * standard `ChartWheel` in the plate theme — the end of the morph is
 * the ordinary figure, not an imitation of it.
 */
export function DerivationFigure({
  scene, t: tRaw, size = 520, follow, openingAim, overlays, orbit, onPick, theme,
}: DerivationFigureProps): ReactElement {
  const t = clamp01(tRaw);
  if (t >= 1) {
    return <ChartWheel chart={scene.wheel} size={size} theme={theme ?? PLATE_THEME} />;
  }

  // --- the camera path -----------------------------------------------
  // Opening aim: toward the rising ecliptic, a little above the
  // horizon. Settle aim: the ecliptic south pole (see module notes).
  // A free-orbit offset rides on top; release clears it, so the scrub
  // keeps the canonical view. With `openingAim`, t in [0, VIEW_HANDOFF]
  // is a photographic pre-roll; `u` is the usual morph parameter.
  // With `overlays` the pole slerp occupies SPHERE→HORIZON so that
  // range keeps moving; without it the slerp stays in the last beat.
  const u = morphParameter(t, openingAim);
  const aimSky = dirFromAzAlt(scene.ascAz, 15);
  const aimSettle = neg(scene.eclToHor[2]);
  let aim0 = aimSky;
  if (openingAim) {
    aim0 = slerp(dirFromAzAlt(openingAim.az, openingAim.alt), aimSky, ramp(t, 0, VIEW_HANDOFF));
  }
  const aim = slerp(aim0, aimSettle, overlays ? ramp(u, 0.25, 0.65) : ramp(u, 0.875, 1));
  let [aimAz, aimAlt] = azAltOfDir(aim);
  if (orbit) {
    aimAz += orbit.az;
    aimAlt = Math.max(-85, Math.min(85, aimAlt + orbit.alt));
  }
  const pull = ramp(u, 0, 0.25);
  let shape = pull;
  let hfovDeg = 100 + 80 * pull;
  if (openingAim && t < VIEW_HANDOFF) {
    const pre = ramp(t, 0, VIEW_HANDOFF);
    shape = -1 + pre;
    hfovDeg = 70 + 30 * pre;
  }
  const proj = skyProjector(aimAz, aimAlt, { shape, hfovDeg });

  const c = size / 2;
  const R = (size / 2) * 0.92;
  const XY = (dir: Vec3): [number, number] => {
    const p = proj.placeDir(dir);
    return [fix(c + p.xn * R), fix(c - p.yn * R)];
  };
  const placeXY = (dir: Vec3): [number, number] | null => {
    if (shape < 0 && azAltOfDir(dir)[1] < -0.4) return null;
    const p = proj.placeDir(dir);
    if (p.behind || !Number.isFinite(p.xn) || !Number.isFinite(p.yn)) return null;
    if (shape < 0 && p.hemisphere === "far") return null;
    const x = c + p.xn * R;
    const y = c - p.yn * R;
    if (x < -size || x > size * 2 || y < -size || y > size * 2) return null;
    return [fix(x), fix(y)];
  };
  const inFrame = (xy: [number, number] | null): xy is [number, number] =>
    xy !== null && xy[0] >= -8 && xy[0] <= size + 8 && xy[1] >= -8 && xy[1] <= size + 8;

  // Positions come from the ecliptic frame throughout; at s = 0 this
  // is the true sky direction (the handoff is free by construction).
  // With overlays, flatten waits until HORIZON so the last beat is
  // the planes descending onto the page.
  const s = overlays ? rampOut(u, 0.65, 0.97) : ramp(u, 0.75, 0.875);
  const eclDir = (lon: number, lat: number): Vec3 =>
    mul(scene.eclToHor, unitVector(lon, lat));
  const bodyDir = (b: SceneBody): Vec3 => eclDir(b.lon, b.lat * (1 - s));

  // In-plane page rotation carrying the Ascendant to the left edge.
  const settle = overlays ? rampOut(u, 0.70, 0.97) : ramp(u, 0.875, 1);
  let rotate = 0;
  if (settle > 0) {
    const p = proj.placeDir(eclDir(scene.asc, 0));
    const angle = Math.atan2(-p.yn, p.xn) / DEG; // SVG rotate() is clockwise
    rotate = settle * (-180 - angle);
  }

  // --- polylines ------------------------------------------------------
  const N = 96;
  const path = (dirAt: (u: number) => Vec3): string => {
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const [x, y] = XY(dirAt((k / N) * 360));
      pts.push(`${k ? "L" : "M"}${x} ${y}`);
    }
    return pts.join("");
  };
  const visiblePath = (dirAt: (deg: number) => Vec3, n = N): string => {
    const parts: string[] = [];
    let drawing = false;
    for (let k = 0; k <= n; k++) {
      const xy = placeXY(dirAt((k / n) * 360));
      if (!inFrame(xy)) { drawing = false; continue; }
      parts.push(`${drawing ? "L" : "M"}${xy[0]} ${xy[1]}`);
      drawing = true;
    }
    return parts.join(" ");
  };
  const visiblePoly = (dirs: Vec3[]): string => {
    const parts: string[] = [];
    let drawing = false;
    for (const dir of dirs) {
      const xy = placeXY(dir);
      if (!inFrame(xy)) { drawing = false; continue; }
      parts.push(`${drawing ? "L" : "M"}${xy[0]} ${xy[1]}`);
      drawing = true;
    }
    return parts.join(" ");
  };
  const latBand = (lon: number, lat0: number, lat1: number, n: number): string => {
    const parts: string[] = [];
    let drawing = false;
    for (let k = 0; k <= n; k++) {
      const xy = placeXY(eclDir(lon, lat0 + (lat1 - lat0) * (k / n)));
      if (!inFrame(xy)) { drawing = false; continue; }
      parts.push(`${drawing ? "L" : "M"}${xy[0]} ${xy[1]}`);
      drawing = true;
    }
    return parts.join(" ");
  };
  // The two characters and the meridian, as great circles.
  const horizonPath = path((u) => dirFromAzAlt(u, 0));
  const eclipticPath = overlays
    ? visiblePath((deg) => eclDir(deg, 0))
    : path((u) => eclDir(u, 0));
  const meridianPath = path((u) =>
    [0, Math.sin(u * DEG), Math.cos(u * DEG)] as Vec3);

  // --- opacity ramps ---------------------------------------------------
  // Playground: ink fades in on the original SKY→WHEEL stations.
  // Overlays: VIEW starts as named bodies only; figures / ecliptic /
  // signs / houses light up across the pre-roll; constellation names
  // and extra labels recede as the wheel arrives.
  const oEcl = overlays ? ramp(t, 0.08, 0.14) : ramp(u, 0.25, 0.4);
  const oSigns = overlays ? ramp(t, 0.11, 0.17) : ramp(u, 0.375, 0.5);
  const oTicks = ramp(u, 0.5, 0.625);
  const oMeridian = ramp(u, 0.625, 0.75);
  const oAngles = ramp(u, 0.7, 0.8);
  const oDress = ramp(u, overlays ? 0.78 : 0.95, 1);
  const oWheel = overlays ? ramp(u, 0.92, 1) : 0;
  const oHorizon = overlays ? ramp(t, 0.17, 0.23) * (1 - oWheel) : 1;
  const oHouses = overlays ? ramp(t, 0.15, 0.21) : 0;
  const oConst = overlays
    ? ramp(t, 0.03, 0.09) * (1 - ramp(u, 0.55, 0.82)) : 0;
  const oGlyphs = overlays ? 1 - oWheel : 0;
  const oNames = overlays ? 1 - ramp(u, 0.78, 0.94) : 0;
  const oSignGlyphs = overlays ? oSigns * (1 - ramp(u, 0.78, 0.94)) : 0;
  const oHouseLabels = overlays ? oHouses * (1 - ramp(u, 0.78, 0.94)) : 0;
  const oHouseMeridians = overlays ? oHouses * (1 - oWheel) : 0;

  const els: ReactElement[] = [];
  const skipMean = scene.bodies.some((b) => b.id === "true_node");
  const halo = (
    key: string, x: number, y: number, text: string,
    fill: string, fontSize: number, opacity: number,
    extra?: { anchor?: "start" | "middle" | "end"; dx?: number; dy?: number },
  ): ReactElement => (
    <text key={key} x={x + (extra?.dx ?? 0)} y={y + (extra?.dy ?? 0)}
      textAnchor={extra?.anchor ?? "middle"} dominantBaseline="central"
      fontSize={fontSize} fontFamily={MONO}
      fill={fill} stroke={PLATE_TOKENS.paper} strokeWidth={3}
      paintOrder="stroke" opacity={fix(opacity)}>{text}</text>
  );

  // Horizon: the heaviest ink line. Present in every playground frame;
  // with overlays it waits until the SKY handoff so VIEW is the photo.
  if (oHorizon > 0) {
    els.push(<path key="horizon" d={horizonPath} fill="none"
      stroke={PLATE_TOKENS.ink} strokeWidth={1.75}
      {...(overlays ? { opacity: fix(oHorizon) } : {})} />);
  }

  if (oConst > 0) {
    let fi = 0;
    for (const fig of scene.figures ?? []) {
      for (const seg of fig.segs) {
        const d = visiblePoly(seg.map(([lo, la]) => eclDir(lo, la)));
        if (!d) continue;
        els.push(<path key={`con-${fig.con}-${fi++}`} d={d} fill="none"
          stroke={PLATE_TOKENS.mutedInk} strokeWidth={0.7}
          opacity={fix(oConst * 0.45)} />);
      }
    }
    const labels = scene.figureLabels ?? [];
    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      const xy = placeXY(eclDir(lab.lon, lab.lat));
      if (!inFrame(xy)) continue;
      // Names can repeat (Serpens Caput / Cauda); key by index.
      els.push(halo(`conlab-${i}`, xy[0], xy[1], lab.name,
        PLATE_TOKENS.mutedInk, size * 0.022, oConst * 0.7));
    }
  }

  if (oHouseMeridians > 0) {
    for (let k = 0; k < scene.cusps.length; k++) {
      const d = latBand(scene.cusps[k], -75, 75, 48);
      if (!d) continue;
      els.push(<path key={`house-m-${k}`} d={d} fill="none"
        stroke={PLATE_TOKENS.rule} strokeWidth={0.6}
        opacity={fix(oHouseMeridians * 0.7)} />);
    }
  }

  // Ecliptic: the oxblood accent, implicit before `SPHERE`.
  if (oEcl > 0) {
    els.push(<path key="ecliptic" d={eclipticPath} fill="none"
      stroke={PLATE_TOKENS.accent} strokeWidth={1.25} opacity={fix(oEcl)} />);
  }

  if (oMeridian > 0) {
    els.push(<path key="meridian" d={meridianPath} fill="none"
      stroke={PLATE_TOKENS.mutedInk} strokeWidth={0.75}
      opacity={fix(oMeridian)} />);
  }

  // Sign boundaries: short ticks across the ecliptic at each 30°.
  if (oSigns > 0) {
    for (let k = 0; k < 12; k++) {
      if (overlays) {
        const a = placeXY(eclDir(k * 30, -4));
        const b = placeXY(eclDir(k * 30, 4));
        if (!inFrame(a) || !inFrame(b)) continue;
        els.push(<line key={`sign-${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={PLATE_TOKENS.accent} strokeWidth={0.75}
          opacity={fix(oSigns)} />);
      } else {
        const [x1, y1] = XY(eclDir(k * 30, -4));
        const [x2, y2] = XY(eclDir(k * 30, 4));
        els.push(<line key={`sign-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={PLATE_TOKENS.accent} strokeWidth={0.75}
          opacity={fix(oSigns)} />);
      }
    }
    if (oSignGlyphs > 0) {
      for (let k = 0; k < 12; k++) {
        const xy = placeXY(eclDir(k * 30 + 15, 8));
        if (!inFrame(xy)) continue;
        els.push(halo(`sglyph-${k}`, xy[0], xy[1], SIGN_GLYPHS[k],
          PLATE_TOKENS.accent, size * 0.036, oSignGlyphs));
      }
    }
  }

  if (oHouseLabels > 0) {
    for (let k = 0; k < scene.cusps.length; k++) {
      const xy = placeXY(eclDir(scene.cusps[k], 12));
      if (!inFrame(xy)) continue;
      els.push(halo(`hlab-${k}`, xy[0], xy[1], `H${k + 1}`,
        PLATE_TOKENS.faintInk, size * 0.024, oHouseLabels));
    }
    const dsc = (scene.asc + 180) % 360;
    const ic = (scene.mc + 180) % 360;
    for (const [key, lon] of [
      ["ASC", scene.asc], ["MC", scene.mc], ["DSC", dsc], ["IC", ic],
    ] as const) {
      const xy = placeXY(eclDir(lon, -8));
      if (!inFrame(xy)) continue;
      els.push(halo(`ang-${key}`, xy[0], xy[1], key,
        PLATE_TOKENS.accent, size * 0.026, oHouseLabels));
    }
  }

  // Longitude ticks: the perpendicular each body drops onto the
  // ecliptic — the number the chart is made of, shown as what it is.
  // A followed body's tick stays drawn at every t.
  for (const b of scene.bodies) {
    if (overlays && skipMean && b.id === "mean_node") continue;
    const held = follow !== undefined && b.id === follow;
    const o = held ? 1 : oTicks;
    if (o <= 0) continue;
    if (overlays) {
      const a = placeXY(bodyDir(b));
      const p = placeXY(eclDir(b.lon, 0));
      if (!inFrame(a) || !inFrame(p)) continue;
      els.push(<line key={`tick-${b.id}`} x1={a[0]} y1={a[1]} x2={p[0]} y2={p[1]}
        stroke={held ? PLATE_TOKENS.accent : PLATE_TOKENS.faintInk}
        strokeWidth={held ? 1 : 0.5} opacity={fix(o)} />);
    } else {
      const [x1, y1] = XY(bodyDir(b));
      const [x2, y2] = XY(eclDir(b.lon, 0));
      els.push(<line key={`tick-${b.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={held ? PLATE_TOKENS.accent : PLATE_TOKENS.faintInk}
        strokeWidth={held ? 1 : 0.5} opacity={fix(o)} />);
    }
  }

  // The four angles are intersections, not objects: rings at the
  // horizon–ecliptic and meridian–ecliptic crossings.
  if (oAngles > 0) {
    for (const [key, lon] of [["asc", scene.asc], ["mc", scene.mc]] as const) {
      if (overlays) {
        const xy = placeXY(eclDir(lon, 0));
        if (!inFrame(xy)) continue;
        els.push(<circle key={`angle-${key}`} cx={xy[0]} cy={xy[1]} r={6} fill="none"
          stroke={PLATE_TOKENS.accent} strokeWidth={1}
          opacity={fix(oAngles)} />);
      } else {
        const [x, y] = XY(eclDir(lon, 0));
        els.push(<circle key={`angle-${key}`} cx={x} cy={y} r={6} fill="none"
          stroke={PLATE_TOKENS.accent} strokeWidth={1}
          opacity={fix(oAngles)} />);
      }
    }
  }

  // The dressing: cusp spokes and aspect chords fade in at the end;
  // glyphs arrive with the real wheel at t = 1.
  if (oDress > 0) {
    const [cx0, cy0] = XY(neg(scene.eclToHor[2]));
    for (let k = 0; k < scene.cusps.length; k++) {
      const [x, y] = XY(eclDir(scene.cusps[k], 0));
      els.push(<line key={`cusp-${k}`} x1={cx0} y1={cy0} x2={x} y2={y}
        stroke={PLATE_TOKENS.rule} strokeWidth={0.75}
        opacity={fix(oDress)} />);
    }
    const at = new Map(scene.bodies.map((b) => [b.id, b]));
    scene.wheel.aspects.forEach((a, k) => {
      const pa = at.get(a.a);
      const pb = at.get(a.b);
      if (!pa || !pb) return;
      const [x1, y1] = XY(bodyDir(pa));
      const [x2, y2] = XY(bodyDir(pb));
      els.push(<line key={`aspect-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={PLATE_TOKENS.mutedInk} strokeWidth={0.5}
        opacity={fix(oDress * 0.8)} />);
    });
  }

  // Bodies. Without overlays: grey dots until the wheel dresses them;
  // below-horizon bodies are faint in the SKY view. With overlays:
  // glyphs and names for bodies in the frame, from t = 0.
  const whole = ramp(u, 0, 0.25);
  for (const b of scene.bodies) {
    if (overlays && skipMean && b.id === "mean_node") continue;
    const held = follow !== undefined && b.id === follow;
    if (overlays) {
      if (shape < 0 && b.altDeg < 0) continue;
      const xy = placeXY(bodyDir(b));
      if (!inFrame(xy)) continue;
      const glyph = GLYPHS[b.id] ?? b.id.slice(0, 2);
      const fill = held ? PLATE_TOKENS.accent : PLATE_TOKENS.ink;
      const right = xy[0] < size * 0.72;
      const pick = onPick ? { onClick: () => onPick(b.id) } : {};
      els.push(
        <g key={`body-${b.id}`} {...pick}>
          {oGlyphs > 0 && halo(`glyph-${b.id}`, xy[0], xy[1], glyph, fill, size * 0.042, oGlyphs)}
          {oNames > 0 && halo(`name-${b.id}`, xy[0], xy[1], bodyCaption(b.id),
            fill, size * 0.024, oNames, {
              anchor: right ? "start" : "end",
              dx: right ? size * 0.028 : -size * 0.028,
              dy: size * 0.004,
            })}
        </g>,
      );
    } else {
      const [x, y] = XY(bodyDir(b));
      const hidden = b.altDeg < 0 ? 0.25 + 0.75 * whole : 1;
      els.push(<circle key={`body-${b.id}`} cx={x} cy={y} r={held ? 4.5 : 3.5}
        fill={held ? PLATE_TOKENS.accent : PLATE_TOKENS.mutedInk}
        opacity={fix(hidden)}
        {...(onPick ? { onClick: () => onPick(b.id) } : {})} />);
    }
  }

  const figure = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: "transparent" }}>
      <defs>
        <clipPath id="derivation-frame">
          <rect x={0} y={0} width={size} height={size} />
        </clipPath>
      </defs>
      <g clipPath="url(#derivation-frame)"
        transform={rotate ? `rotate(${fix(rotate)} ${c} ${c})` : undefined}>
        {els}
      </g>
    </svg>
  );
  if (!overlays || oWheel <= 0) return figure;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ opacity: fix(1 - oWheel), height: "100%" }}>{figure}</div>
      <div style={{
        position: "absolute", inset: 0, opacity: fix(oWheel),
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <ChartWheel chart={scene.wheel} size={size} theme={theme ?? PLATE_THEME} />
      </div>
    </div>
  );
}

// The interactive widget (ChartDerivation) lives in
// derivation-widget.tsx: it calls hooks, and this module must stay
// importable from React Server Components (the plate render and the
// registry harness), so the client-only surface is its own subpath.
