/**
 * caelus-widgets — the zodiac-drift widget, scene and figure.
 *
 * The tropical and sidereal zodiacs as two overlaid rings: the
 * tropical ring fixed, the sidereal ring rotated by the ayanamsa, so
 * the wedge between the two 0° ♈ marks is the gap the Zodiac article
 * is about. A century scrubber walks the working year and precession
 * widens the gap under the reader's hand; a picker swaps the ayanamsa
 * mode.
 *
 * The whole interaction space is one smooth curve per mode, so the
 * scene precomputes it: `deriveDrift` samples the engine's ayanamsa
 * at every year of a ±150-year window for all five modes, and the
 * figure and console are pure functions of (scene, mode, year) — no
 * engine round-trip, no ephemeris, no wall clock. The reader's-chart
 * override is a params change that recomputes the curve, still
 * without loading a data tier. The interactive widget lives in
 * zodiac-drift-widget.tsx behind the client boundary.
 */
import type { ReactElement } from "react";
import { ayanamsa, julianDay, VERSION } from "caelus";
import { PLATE_TOKENS } from "caelus-wheel";
import type { ConsoleStation } from "./console.js";
import { dm, SIGN_GLYPHS } from "./format.js";
import type { ZodiacDriftParams } from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** The ayanamsa modes the picker offers, in catalog order (the
 *  engine's AYANAMSA_J2000 set). */
export const DRIFT_MODES = [
  "lahiri", "fagan_bradley", "krishnamurti", "raman", "yukteshwar",
] as const;

/** Half the scrub window: the rail walks ±DRIFT_WINDOW years from the
 *  resting instant. */
export const DRIFT_WINDOW = 150;

// ------------------------------------------------------------------ scene

export interface ZodiacDriftScene {
  /** Integer sample years shared by every curve. */
  years: number[];
  /** Ayanamsa in degrees per mode, one mid-year sample per year. */
  curves: Record<string, number[]>;
  /** Decimal year of the resting instant. */
  restYear: number;
  engineVersion: string;
  params: ZodiacDriftParams;
}

/** Sample the ayanamsa curves over the window. No engine instance:
 *  the ayanamsa is a pure precession function of the epoch, which is
 *  what makes the whole scrubber a build-time constant. */
export function deriveDrift(params: ZodiacDriftParams): ZodiacDriftScene {
  const { instant: i } = params;
  const jd = julianDay(i.y, i.mo, i.d, i.h, i.mi, i.s);
  const jdOf = (y: number): number => julianDay(y, 1, 1, 0, 0, 0);
  const restYear = i.y + (jd - jdOf(i.y)) / (jdOf(i.y + 1) - jdOf(i.y));

  const base = Math.round(restYear);
  const years: number[] = [];
  for (let y = base - DRIFT_WINDOW; y <= base + DRIFT_WINDOW; y++) years.push(y);
  const curves: Record<string, number[]> = {};
  for (const mode of DRIFT_MODES) {
    // Mid-year samples; the ayanamsa takes JDE, and the UT/TT
    // difference moves it by less than a milliarcsecond — far under
    // the console's minute register.
    curves[mode] = years.map((y) => ayanamsa(julianDay(y, 7, 1, 0, 0, 0), mode));
  }
  return { years, curves, restYear, engineVersion: VERSION, params };
}

/** The gap (ayanamsa, degrees) at a working year, linear in the
 *  curve; the function is near-linear, so the interpolation error is
 *  under a milliarcsecond. */
export function driftGap(scene: ZodiacDriftScene, mode: string, year: number): number {
  const curve = scene.curves[mode] ?? scene.curves[DRIFT_MODES[0]];
  const ys = scene.years;
  if (year <= ys[0]) return curve[0];
  if (year >= ys[ys.length - 1]) return curve[curve.length - 1];
  const k = year - ys[0]; // consecutive integer years
  const i0 = Math.floor(k);
  const f = k - i0;
  return curve[i0] * (1 - f) + curve[i0 + 1] * f;
}

/** Precession rate at the working year, arcseconds per year, from a
 *  ±50-year central difference on the curve. */
export function driftRate(scene: ZodiacDriftScene, mode: string, year: number): number {
  return (driftGap(scene, mode, year + 50) - driftGap(scene, mode, year - 50))
    / 100 * 3600;
}

/** The console datum: `y 1990.44 · ayanamsa 24°13′ (lahiri) · Δ +50.3″/yr`. */
export function driftDatum(scene: ZodiacDriftScene, mode: string, year: number): string {
  const [d, m] = dm(driftGap(scene, mode, year));
  const rate = driftRate(scene, mode, year);
  const sign = rate < 0 ? "−" : "+";
  return `y ${year.toFixed(2)} · ayanamsa ${d}°${m}′ (${mode.replace(/_/g, " ")})`
    + ` · Δ ${sign}${Math.abs(rate).toFixed(1)}″/yr`;
}

/** Console stations: the century marks inside the window, plus the
 *  resting year, so release-snap can always return to the plate. */
export function driftStations(scene: ZodiacDriftScene): ConsoleStation[] {
  const ys = scene.years;
  const minY = ys[0];
  const maxY = ys[ys.length - 1];
  const span = maxY - minY;
  const out: ConsoleStation[] = [];
  for (const y of ys) {
    if (y % 100 === 0) {
      out.push({ id: `y${y}`, label: String(y), t: (y - minY) / span });
    }
  }
  const rest = Math.round(scene.restYear);
  out.push({
    id: "rest", label: String(rest), t: (rest - minY) / span,
  });
  return out.sort((a, b) => a.t - b.t);
}

// --------------------------------------------------------------- figure

export interface ZodiacDriftFigureProps {
  scene: ZodiacDriftScene;
  /** Ayanamsa mode drawn; defaults to the spec's, then lahiri. */
  mode?: string;
  /** Working year; defaults to the resting instant (the plate). */
  year?: number;
  /** Square size in px. */
  size?: number;
}

/** The two rings. Longitude increases counterclockwise from the top —
 *  the wheel's handedness, so the figure agrees with every wheel the
 *  reader has met. The sidereal ring's 0° ♈ sits at tropical
 *  longitude = the gap; the wedge between the zero marks is the
 *  ayanamsa, in oxblood (the one highlighted element). */
export function ZodiacDriftFigure({
  scene, mode, year, size = 520,
}: ZodiacDriftFigureProps): ReactElement {
  const m = mode ?? scene.params.ayanamsa ?? "lahiri";
  const y = year ?? scene.restYear;
  const gap = driftGap(scene, m, y);

  const DEG = Math.PI / 180;
  const c = size / 2;
  const fix = (v: number): number => Math.round(v * 100) / 100;
  const R1 = size * 0.36; // tropical ring
  const R2 = size * 0.26; // sidereal ring
  const G1 = size * 0.425; // tropical glyphs
  const G2 = size * 0.19; // sidereal glyphs
  const pt = (lon: number, r: number): [number, number] => [
    fix(c - r * Math.sin(lon * DEG)), fix(c - r * Math.cos(lon * DEG)),
  ];

  const els: ReactElement[] = [];

  // The rings: tropical in the heaviest ink (the reference), sidereal
  // in muted ink.
  els.push(<circle key="ring-tropical" cx={c} cy={c} r={R1} fill="none"
    stroke={PLATE_TOKENS.ink} strokeWidth={1.5} />);
  els.push(<circle key="ring-sidereal" cx={c} cy={c} r={R2} fill="none"
    stroke={PLATE_TOKENS.mutedInk} strokeWidth={1} />);

  // Division ticks and sign glyphs, each ring on its own longitude
  // origin: 0 for tropical, the gap for sidereal.
  for (let k = 0; k < 12; k++) {
    const heavy = k === 0;
    const [tx1, ty1] = pt(k * 30, R1 - (heavy ? 7 : 4));
    const [tx2, ty2] = pt(k * 30, R1 + (heavy ? 7 : 4));
    els.push(<line key={`tick-t-${k}`} x1={tx1} y1={ty1} x2={tx2} y2={ty2}
      stroke={PLATE_TOKENS.ink} strokeWidth={heavy ? 1.5 : 0.75} />);
    const [gx, gy] = pt(k * 30 + 15, G1);
    els.push(<text key={`glyph-t-${k}`} x={gx} y={gy} textAnchor="middle"
      dominantBaseline="central" fontSize={size * 0.045}
      fill={PLATE_TOKENS.ink}>{SIGN_GLYPHS[k]}</text>);

    const slon = gap + k * 30;
    const [sx1, sy1] = pt(slon, R2 - (heavy ? 6 : 3.5));
    const [sx2, sy2] = pt(slon, R2 + (heavy ? 6 : 3.5));
    els.push(<line key={`tick-s-${k}`} x1={sx1} y1={sy1} x2={sx2} y2={sy2}
      stroke={PLATE_TOKENS.mutedInk} strokeWidth={heavy ? 1.25 : 0.75} />);
    const [hx, hy] = pt(slon + 15, G2);
    els.push(<text key={`glyph-s-${k}`} x={hx} y={hy} textAnchor="middle"
      dominantBaseline="central" fontSize={size * 0.036}
      fill={PLATE_TOKENS.mutedInk}>{SIGN_GLYPHS[k]}</text>);
  }

  // The gap wedge: an arc across the annulus from the tropical zero to
  // the sidereal zero, with radial end-caps joining the rings.
  const RG = (R1 + R2) / 2;
  const [ax, ay] = pt(0, RG);
  const [bx, by] = pt(gap, RG);
  els.push(<path key="gap-arc"
    d={`M${ax} ${ay} A${RG} ${RG} 0 0 0 ${bx} ${by}`} fill="none"
    stroke={PLATE_TOKENS.accent} strokeWidth={1.5} />);
  for (const lon of [0, gap]) {
    const [cx1, cy1] = pt(lon, R2);
    const [cx2, cy2] = pt(lon, R1);
    els.push(<line key={`gap-cap-${lon}`} x1={cx1} y1={cy1} x2={cx2} y2={cy2}
      stroke={PLATE_TOKENS.accent} strokeWidth={1} />);
  }

  // Zero labels: the two starts of the zodiac, each on its ring.
  const [lt1x, lt1y] = pt(0, G1 + size * 0.028);
  els.push(<text key="zero-t" x={lt1x} y={lt1y} textAnchor="middle"
    dominantBaseline="central" fontFamily={MONO} fontSize={size * 0.02}
    letterSpacing="0.08em" fill={PLATE_TOKENS.ink}>0° ♈</text>);
  const [lt2x, lt2y] = pt(gap, R2 - size * 0.035);
  els.push(<text key="zero-s" x={lt2x} y={lt2y} textAnchor="middle"
    dominantBaseline="central" fontFamily={MONO} fontSize={size * 0.02}
    letterSpacing="0.08em" fill={PLATE_TOKENS.mutedInk}>0° ♈</text>);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: "transparent" }}>
      {els}
    </svg>
  );
}

// The interactive widget lives in zodiac-drift-widget.tsx: it calls
// hooks, and this module must stay importable from React Server
// Components (the plate render and the registry harness), so the
// client-only surface is its own subpath.
