/**
 * caelus-widgets — the retrograde-scrub widget, scene and figure.
 *
 * The graphic ephemeris through a station: the body's longitude line
 * dips into the shaded retrograde loop between the SR and SD marks,
 * and the scrub cursor walks the moment through it. Beneath, the
 * heliocentric inset shows why: the Sun at center, Earth and the body
 * on their orbits, and the sight line from Earth to the body extended
 * to the zodiac ring — the geocentric longitude is where the line
 * lands, and it runs backward while Earth overtakes.
 *
 * Same split as the other kinds: `deriveRetro` runs the engine once
 * (station scan, the longitude and speed series, the heliocentric
 * track) and returns a serializable scene; the figure is a pure
 * function of (scene, cursor). Scrubbing interpolates scene arrays —
 * no engine calls on the interaction path. The interactive widget
 * lives in retrograde-scrub-widget.tsx behind the client boundary.
 */
import type { ReactElement } from "react";
import {
  earthHeliocentric, jdTT, julianDay, stations, vsopHeliocentric,
  VERSION,
  type BodyId, type Engine,
} from "caelus";
import {
  EphemerisGraph, GLYPHS, PLATE_BODY_INKS, PLATE_THEME, PLATE_TOKENS,
  type WheelTheme,
} from "caelus-wheel";
import { fmtDate, fmtZodiac } from "./format.js";
import type { RetrogradeScrubParams } from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** Bodies the inset can draw: the seven with VSOP series in the
 *  engine data pack (Pluto's heliocentric path is a separate export
 *  and can join later). */
export const RETRO_BODIES = [
  "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
] as const;

/** Samples across the window for the longitude and speed series. */
const N_SAMPLES = 361;
/** Samples for the heliocentric track (the inset interpolates). */
const N_HELIO = 121;
/** Half-width of the station scan, days: wide enough that even a
 *  Mars window (~780 days between loops) contains a full loop. */
const SCAN_HALF = 450;
/** |speed| under this reads as stationary, degrees/day. */
const STATIONARY_EPS = 0.03;

// ------------------------------------------------------------------ scene

export interface RetroStation {
  jdUt: number;
  kind: "retrograde" | "direct";
}

/** One heliocentric snapshot: longitudes in degrees, distances in AU. */
export interface HelioPoint {
  jd: number;
  eL: number;
  eR: number;
  bL: number;
  bR: number;
}

export interface RetrogradeScene {
  body: string;
  /** Window bounds, jdUt. */
  from: number;
  to: number;
  /** Geocentric longitude samples, unwrapped to a continuous line so
   *  the loop draws whole (values may leave [0, 360)). */
  lon: { jd: number; value: number }[];
  /** Longitude speed samples, degrees/day (negative in retrograde). */
  speed: { jd: number; value: number }[];
  /** Stations inside the window. */
  stations: RetroStation[];
  /** The featured loop: the station-retrograde and station-direct
   *  bounding it. */
  loop: { sr: number; sd: number };
  /** Heliocentric track over the window. */
  helio: HelioPoint[];
  /** Mean heliocentric distances over the window (the inset's orbit
   *  circle radii before scaling). */
  meanR: { earth: number; body: number };
  jdUt: number;
  engineVersion: string;
  params: RetrogradeScrubParams;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;
const toDeg = (r: number): number => r * 180 / Math.PI;

/** Longitude speed by the same finite difference the engine's
 *  `stations` scan uses. */
function speedAt(engine: Engine, body: string, t: number): number {
  const h = 0.25;
  const l0 = engine.longitude(body as BodyId, t - h);
  const l1 = engine.longitude(body as BodyId, t + h);
  return (mod360(l1 - l0 + 540) - 180) / (2 * h);
}

/** Run the engine once and capture the loop as serializable data. */
export function deriveRetro(
  engine: Engine, params: RetrogradeScrubParams,
): RetrogradeScene {
  const { instant: i } = params;
  const body = params.body ?? "mercury";
  const jd = julianDay(i.y, i.mo, i.d, i.h, i.mi, i.s);

  // The featured loop: the retrograde interval containing the instant,
  // else the loop whose midpoint is nearest it.
  const raw = stations(engine, body as BodyId, jd - SCAN_HALF, jd + SCAN_HALF, 40);
  const found: RetroStation[] = raw.map(([jdUt, kind]) => ({ jdUt, kind }));
  const loops: { sr: number; sd: number }[] = [];
  for (let k = 0; k + 1 < found.length; k++) {
    if (found[k].kind === "retrograde" && found[k + 1].kind === "direct") {
      loops.push({ sr: found[k].jdUt, sd: found[k + 1].jdUt });
    }
  }
  if (!loops.length) {
    throw new Error(`retrograde-scrub: no ${body} loop within the scan window`);
  }
  const loop = loops.find((l) => jd >= l.sr && jd <= l.sd)
    ?? loops.reduce((best, l) =>
      Math.abs((l.sr + l.sd) / 2 - jd) < Math.abs((best.sr + best.sd) / 2 - jd)
        ? l
        : best);

  const span = loop.sd - loop.sr;
  const from = loop.sr - 0.35 * span;
  const to = loop.sd + 0.35 * span;

  // The longitude line, unwrapped so the loop draws continuously.
  const lon: { jd: number; value: number }[] = [];
  const speed: { jd: number; value: number }[] = [];
  let prev = NaN;
  let offset = 0;
  for (let k = 0; k < N_SAMPLES; k++) {
    const t = from + (to - from) * k / (N_SAMPLES - 1);
    const rawLon = engine.longitude(body as BodyId, t);
    if (Number.isNaN(prev)) {
      offset = 0;
    } else {
      offset += mod360(rawLon - prev + 540) - 180 - (rawLon - prev);
    }
    lon.push({ jd: t, value: rawLon + offset });
    speed.push({ jd: t, value: speedAt(engine, body, t) });
    prev = rawLon;
  }

  const helio: HelioPoint[] = [];
  let eSum = 0;
  let bSum = 0;
  const series = engine.data.vsop[body as keyof typeof engine.data.vsop];
  for (let k = 0; k < N_HELIO; k++) {
    const t = from + (to - from) * k / (N_HELIO - 1);
    const tt = jdTT(t);
    const e = earthHeliocentric(engine.data, tt);
    const b = vsopHeliocentric(series, tt);
    eSum += e[2];
    bSum += b[2];
    helio.push({
      jd: t,
      eL: mod360(toDeg(e[0])),
      eR: e[2],
      bL: mod360(toDeg(b[0])),
      bR: b[2],
    });
  }

  return {
    body,
    from,
    to,
    lon,
    speed,
    stations: found.filter((s) => s.jdUt >= from && s.jdUt <= to),
    loop,
    helio,
    meanR: { earth: eSum / N_HELIO, body: bSum / N_HELIO },
    jdUt: jd,
    engineVersion: VERSION,
    params,
  };
}

// ------------------------------------------------------------------ datum

/** Linear interpolation into a scene series. */
function interp(
  pts: { jd: number; value: number }[], jd: number,
): number {
  if (jd <= pts[0].jd) return pts[0].value;
  if (jd >= pts[pts.length - 1].jd) return pts[pts.length - 1].value;
  const span = pts[pts.length - 1].jd - pts[0].jd;
  const f = (jd - pts[0].jd) / span * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  return pts[k].value + (pts[k + 1].value - pts[k].value) * (f - k);
}

/** The heliocentric snapshot at a moment, interpolated. */
export function helioAt(scene: RetrogradeScene, jd: number): HelioPoint {
  const h = scene.helio;
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  if (jd <= h[0].jd) return h[0];
  if (jd >= h[h.length - 1].jd) return h[h.length - 1];
  const f = (jd - h[0].jd) / (h[h.length - 1].jd - h[0].jd) * (h.length - 1);
  const k = Math.min(h.length - 2, Math.floor(f));
  const u = f - k;
  // Longitudes interpolate on the circle.
  const lerpLon = (a: number, b: number) =>
    mod360(a + u * (mod360(b - a + 540) - 180));
  return {
    jd,
    eL: lerpLon(h[k].eL, h[k + 1].eL),
    eR: lerp(h[k].eR, h[k + 1].eR, u),
    bL: lerpLon(h[k].bL, h[k + 1].bL),
    bR: lerp(h[k].bR, h[k + 1].bR, u),
  };
}

/** The state word at a speed: stationary under the epsilon, else
 *  direct or retrograde by sign. */
export function retroState(speed: number): string {
  if (Math.abs(speed) < STATIONARY_EPS) return "stationary";
  return speed < 0 ? "retrograde" : "direct";
}

/** The console datum: `1990-05-01 · λ 14°52′ ♉ · −0.31°/day · retrograde`. */
export function retroDatum(scene: RetrogradeScene, cursor: number): string {
  const g = GLYPHS[scene.body] ?? scene.body;
  const lon = interp(scene.lon, cursor);
  const v = interp(scene.speed, cursor);
  const sign = v < 0 ? "−" : "+";
  return `${fmtDate(cursor)} · ${g} λ ${fmtZodiac(mod360(lon))} · `
    + `${sign}${Math.abs(v).toFixed(2)}°/day · ${retroState(v)}`;
}

// --------------------------------------------------------------- figure

export interface RetrogradeFigureProps {
  scene: RetrogradeScene;
  /** Cursor position, jdUt; defaults to the spec's instant clamped
   *  into the window (the plate at rest). */
  cursor?: number;
  /** Figure width in px. */
  size?: number;
  theme?: Partial<WheelTheme>;
}

const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

/** The resting cursor: the article's instant when it falls inside the
 *  window, else the nearer loop boundary. */
export function restCursor(scene: RetrogradeScene): number {
  return clamp(scene.jdUt, scene.from, scene.to);
}

/** The heliocentric inset: Sun at center, Earth and the body on their
 *  orbit circles, the sight line from Earth through the body to the
 *  zodiac ring — the oxblood tick is the geocentric longitude. */
export function HelioInset({
  scene, cursor, size,
}: { scene: RetrogradeScene; cursor: number; size: number }): ReactElement {
  const DEG = Math.PI / 180;
  const fix = (v: number): number => Math.round(v * 100) / 100;
  const c = size / 2;
  const ring = size * 0.44;
  const scale = size * 0.36 / Math.max(scene.meanR.earth, scene.meanR.body);
  // Longitude increases counterclockwise from the top, as on the dial
  // and the drift figure.
  const pt = (lon: number, r: number): [number, number] => [
    fix(c - r * Math.sin(lon * DEG)), fix(c - r * Math.cos(lon * DEG)),
  ];

  const h = helioAt(scene, cursor);
  const earth: [number, number] = pt(h.eL, h.eR * scale);
  const body: [number, number] = pt(h.bL, h.bR * scale);

  // The sight line from Earth through the body, solved against the
  // zodiac ring: |E + t·(B − E)| = ring, t > 1 (past the body).
  const dx = body[0] - earth[0];
  const dy = body[1] - earth[1];
  const qa = dx * dx + dy * dy;
  const qb = 2 * (earth[0] * dx + earth[1] * dy - c * dx - c * dy);
  const qc = (earth[0] - c) ** 2 + (earth[1] - c) ** 2 - ring * ring;
  const t = (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa);
  const sight: [number, number] = [fix(earth[0] + t * dx), fix(earth[1] + t * dy)];

  const els: ReactElement[] = [];
  els.push(<circle key="ring" cx={c} cy={c} r={ring} fill="none"
    stroke={PLATE_TOKENS.ink} strokeWidth={1} />);
  for (let k = 0; k < 12; k++) {
    const [x1, y1] = pt(k * 30, ring - 3);
    const [x2, y2] = pt(k * 30, ring + 3);
    els.push(<line key={`sign-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={PLATE_TOKENS.faintInk} strokeWidth={0.75} />);
  }
  for (const [id, r] of [["earth", scene.meanR.earth],
    ["body", scene.meanR.body]] as const) {
    els.push(<circle key={`orbit-${id}`} cx={c} cy={c} r={fix(r * scale)}
      fill="none" stroke={PLATE_TOKENS.rule} strokeWidth={0.75} />);
  }
  els.push(<line key="sight" x1={earth[0]} y1={earth[1]}
    x2={sight[0]} y2={sight[1]}
    stroke={PLATE_TOKENS.mutedInk} strokeWidth={0.75} />);
  els.push(<line key="sight-tick" x1={sight[0]} y1={sight[1]}
    x2={fix(sight[0] + (c - sight[0]) * 0.06)}
    y2={fix(sight[1] + (c - sight[1]) * 0.06)}
    stroke={PLATE_TOKENS.accent} strokeWidth={2} />);
  const [sx, sy] = pt(0, 0);
  els.push(<text key="sun" x={sx} y={sy} textAnchor="middle"
    dominantBaseline="central" fontSize={size * 0.075}
    fill={PLATE_TOKENS.ink}>☉</text>);
  els.push(<text key="earth" x={earth[0]} y={earth[1]} textAnchor="middle"
    dominantBaseline="central" fontSize={size * 0.06}
    fill={PLATE_TOKENS.ink}>♁</text>);
  els.push(<text key="body" x={body[0]} y={body[1]} textAnchor="middle"
    dominantBaseline="central" fontSize={size * 0.06}
    fill={PLATE_TOKENS.ink}>{GLYPHS[scene.body] ?? scene.body}</text>);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: "transparent" }}>
      {els}
    </svg>
  );
}

/** The figure: the ephemeris graph through the loop, then the inset
 *  and the loop's apparatus row beneath. */
export function RetrogradeFigure({
  scene, cursor, size = 520, theme,
}: RetrogradeFigureProps): ReactElement {
  const cur = cursor ?? restCursor(scene);
  const gH = Math.round(size * 0.56);
  const inset = Math.round(size * 0.4);
  const span = Math.max(...scene.lon.map((p) => p.value))
    - Math.min(...scene.lon.map((p) => p.value));
  const loopDeg = Math.abs(
    interp(scene.lon, scene.loop.sd) - interp(scene.lon, scene.loop.sr));
  const loopDays = Math.round(scene.loop.sd - scene.loop.sr);

  return (
    <div>
      <EphemerisGraph
        series={{ [scene.body]: scene.lon }}
        width={size}
        height={gH}
        gridStep={span <= 60 ? 10 : 30}
        colors={{ [scene.body]: PLATE_BODY_INKS[scene.body] ?? PLATE_TOKENS.ink }}
        theme={theme ?? PLATE_THEME}
        band={{ from: scene.loop.sr, to: scene.loop.sd }}
        marks={scene.stations.map((s) => ({
          jd: s.jdUt,
          label: s.kind === "retrograde" ? "SR" : "SD",
        }))}
        cursor={cur}
        accent={PLATE_TOKENS.accent}
      />
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <HelioInset scene={scene} cursor={cur} size={inset} />
        <div
          style={{
            fontFamily: MONO,
            fontSize: "11px",
            lineHeight: 1.7,
            color: PLATE_TOKENS.mutedInk,
            paddingTop: "8px",
          }}
        >
          <div>SR {fmtDate(scene.loop.sr)}</div>
          <div>SD {fmtDate(scene.loop.sd)}</div>
          <div>
            loop {loopDays} d · {loopDeg.toFixed(1)}°
          </div>
        </div>
      </div>
    </div>
  );
}

// The interactive widget lives in retrograde-scrub-widget.tsx: it calls
// hooks, and this module must stay importable from React Server
// Components (the plate render and the registry harness), so the
// client-only surface is its own subpath.
