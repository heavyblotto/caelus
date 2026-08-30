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
 *   characters). Bodies stay grey dots until the wheel dresses them.
 */
import type { ReactElement } from "react";
import {
  azAlt, dirFromAzAlt, julianDay, skyProjector, unitVector,
  VERSION,
  type Engine, type Vec3,
} from "caelus";
import {
  ChartWheel, PLATE_THEME, PLATE_TOKENS, type WheelChart, type WheelTheme,
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

  return {
    bodies,
    asc: chart.angles.asc,
    mc: chart.angles.mc,
    cusps: chart.cusps,
    wheel: wheelPayload(chart),
    eclToHor: [horDir(0, 0), horDir(90, 0), horDir(0, 90)],
    ascAz: hor(chart.angles.asc, 0)[0],
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

/** Home-page console: VIEW plus the five derivation stations, remapped. */
export const HOME_DERIVATION_STATIONS: ConsoleStation[] = [
  { id: "view", label: "VIEW", t: 0 },
  { id: "sky", label: "SKY", t: VIEW_HANDOFF },
  { id: "sphere", label: "SPHERE", t: VIEW_HANDOFF + 0.25 * (1 - VIEW_HANDOFF) },
  { id: "ecliptic", label: "ECLIPTIC", t: VIEW_HANDOFF + 0.5 * (1 - VIEW_HANDOFF) },
  { id: "horizon", label: "HORIZON", t: VIEW_HANDOFF + 0.75 * (1 - VIEW_HANDOFF) },
  { id: "wheel", label: "WHEEL", t: 1 },
];

/** Optional per-station captions (params.captions draws them), in
 *  apparatus register: one sentence naming what the station shows. */
export const STATION_CAPTIONS: Record<string, string> = {
  view: "The sky as a photograph from this place, aimed at the Sun, the Moon, or south.",
  sky: "The sky from the birthplace at the birth instant; bodies below the horizon are faint. The chart is not what you could see.",
  sphere: "The whole celestial sphere. The horizon is a great circle, and the hidden hemisphere swings into view.",
  ecliptic: "The ecliptic lights up and each body drops a perpendicular tick onto it: ecliptic longitude, the number the chart is made of.",
  horizon: "Horizon and ecliptic cross at exactly two points. The eastern crossing is the Ascendant.",
  wheel: "Latitude collapses, the disc pivots to the page, the Ascendant lands at the left edge, and the furniture arrives.",
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

const DEG = Math.PI / 180;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** Smoothstep ramp of `t` across [a, b]. */
const ramp = (t: number, a: number, b: number): number => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
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
  scene, t: tRaw, size = 520, follow, openingAim, orbit, onPick, theme,
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
  const u = morphParameter(t, openingAim);
  const aimSky = dirFromAzAlt(scene.ascAz, 15);
  const aimSettle = neg(scene.eclToHor[2]);
  let aim0 = aimSky;
  if (openingAim) {
    aim0 = slerp(dirFromAzAlt(openingAim.az, openingAim.alt), aimSky, ramp(t, 0, VIEW_HANDOFF));
  }
  const aim = slerp(aim0, aimSettle, ramp(u, 0.875, 1));
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

  // Positions come from the ecliptic frame throughout; at s = 0 this
  // is the true sky direction (the handoff is free by construction).
  const s = ramp(u, 0.75, 0.875);
  const eclDir = (lon: number, lat: number): Vec3 =>
    mul(scene.eclToHor, unitVector(lon, lat));
  const bodyDir = (b: SceneBody): Vec3 => eclDir(b.lon, b.lat * (1 - s));

  // In-plane page rotation carrying the Ascendant to the left edge,
  // eased over the settle.
  const settle = ramp(u, 0.875, 1);
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
  // The two characters and the meridian, as great circles.
  const horizonPath = path((u) => dirFromAzAlt(u, 0));
  const eclipticPath = path((u) => eclDir(u, 0));
  const meridianPath = path((u) =>
    [0, Math.sin(u * DEG), Math.cos(u * DEG)] as Vec3);

  // --- opacity ramps ---------------------------------------------------
  const oEcl = ramp(u, 0.25, 0.4);          // the band lights up
  const oSigns = ramp(u, 0.375, 0.5);       // sign boundaries draw on
  const oTicks = ramp(u, 0.5, 0.625);       // each body drops its tick
  const oMeridian = ramp(u, 0.625, 0.75);   // the meridian joins
  const oAngles = ramp(u, 0.7, 0.8);        // the crossings mark
  const oDress = ramp(u, 0.95, 1);          // cusps and aspect chords

  const els: ReactElement[] = [];

  // Horizon: the heaviest ink line, present in every frame.
  els.push(<path key="horizon" d={horizonPath} fill="none"
    stroke={PLATE_TOKENS.ink} strokeWidth={1.75} />);

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
      const [x1, y1] = XY(eclDir(k * 30, -4));
      const [x2, y2] = XY(eclDir(k * 30, 4));
      els.push(<line key={`sign-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={PLATE_TOKENS.accent} strokeWidth={0.75}
        opacity={fix(oSigns)} />);
    }
  }

  // Longitude ticks: the perpendicular each body drops onto the
  // ecliptic — the number the chart is made of, shown as what it is.
  // A followed body's tick stays drawn at every t.
  for (const b of scene.bodies) {
    const held = follow !== undefined && b.id === follow;
    const o = held ? 1 : oTicks;
    if (o <= 0) continue;
    const [x1, y1] = XY(bodyDir(b));
    const [x2, y2] = XY(eclDir(b.lon, 0));
    els.push(<line key={`tick-${b.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={held ? PLATE_TOKENS.accent : PLATE_TOKENS.faintInk}
      strokeWidth={held ? 1 : 0.5} opacity={fix(o)} />);
  }

  // The four angles are intersections, not objects: rings at the
  // horizon–ecliptic and meridian–ecliptic crossings.
  if (oAngles > 0) {
    for (const [key, lon] of [["asc", scene.asc], ["mc", scene.mc]] as const) {
      const [x, y] = XY(eclDir(lon, 0));
      els.push(<circle key={`angle-${key}`} cx={x} cy={y} r={6} fill="none"
        stroke={PLATE_TOKENS.accent} strokeWidth={1}
        opacity={fix(oAngles)} />);
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

  // Bodies: grey dots until the wheel dresses them. Below-horizon
  // bodies are faint in the `SKY` view (the first lesson: the chart
  // is not what you could see) and solid once the sphere is whole.
  const whole = ramp(u, 0, 0.25);
  for (const b of scene.bodies) {
    const [x, y] = XY(bodyDir(b));
    const held = follow !== undefined && b.id === follow;
    const hidden = b.altDeg < 0 ? 0.25 + 0.75 * whole : 1;
    els.push(<circle key={`body-${b.id}`} cx={x} cy={y} r={held ? 4.5 : 3.5}
      fill={held ? PLATE_TOKENS.accent : PLATE_TOKENS.mutedInk}
      opacity={fix(hidden)}
      {...(onPick ? { onClick: () => onPick(b.id) } : {})} />);
  }

  return (
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
}

// The interactive widget (ChartDerivation) lives in
// derivation-widget.tsx: it calls hooks, and this module must stay
// importable from React Server Components (the plate render and the
// registry harness), so the client-only surface is its own subpath.
