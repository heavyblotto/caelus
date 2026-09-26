/**
 * caelus-widgets — the aspect-dial widget, scene and figure.
 *
 * Two bodies on a circle: the aspect marks radiate from the first
 * body's place, the orb zones shade around them, and the arc from the
 * nearest aspect point to the second body is the orb — the quantity
 * the Aspect article is about, in oxblood. Dragging the second body
 * re-reads the separation live; an orb slider adds and removes rows
 * from the aspectarian beneath; the console names the next exact hit
 * between the pair.
 *
 * Same split as the other kinds: `deriveDial` runs the engine once
 * (one chart, the pair scan, the aspectarian) and returns a
 * serializable scene; the figure is a pure function of (scene,
 * dragLon, ...) — the drag is arithmetic on scene data (separation,
 * distance to the aspect angles, phase from the engine's
 * `aspectPhase`), never widget-side astronomy. The interactive widget
 * lives in aspect-dial-widget.tsx behind the client boundary.
 */
import type { ReactElement } from "react";
import {
  ASPECTS, aspectBetween, aspectPhase, DEFAULT_ORBS, julianDay, separation,
  VERSION,
  type AspectPhase, type BodyId, type Engine,
} from "caelus";
import { GLYPHS, PLATE_TOKENS } from "caelus-wheel";
import { ASPECT_GLYPHS, dm, fmtDate, fmtZodiac } from "./format.js";
import type { AspectDialParams } from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** The aspectarian's ceiling: every pair whose tightest major aspect
 *  falls within this orb carries a row; the slider filters. Also the
 *  slider's maximum. */
export const ASPECTARIAN_ORB = 10;

/** The resting orb ceiling when the spec does not say. */
export const DEFAULT_DIAL_ORB = 6;

// ------------------------------------------------------------------ scene

export interface DialBody {
  id: string;
  lon: number;
  /** Longitude speed, degrees/day (negative in retrograde). */
  speed: number;
  retrograde: boolean;
}

export interface AspectRow {
  a: string;
  b: string;
  aspect: string;
  /** Signed distance from exact, degrees. */
  orb: number;
  phase: AspectPhase;
}

export interface AspectDialScene {
  bodies: DialBody[];
  /** The five major aspects, name → angle (the engine's table). */
  aspects: Record<string, number>;
  /** Engine orb per aspect, degrees — the shading widths. */
  orbs: Record<string, number>;
  pair: { a: string; b: string };
  /** Every pair within ASPECTARIAN_ORB, tightest aspect each, sorted
   *  by |orb|. */
  aspectarian: AspectRow[];
  /** The next exact hit between the pair, when the scan finds one. */
  nextExact: { aspect: string; jdUt: number } | null;
  /** The scan window, for the datum when nextExact is null. */
  windowDays: number;
  jdUt: number;
  engineVersion: string;
  params: AspectDialParams;
}

const wrap180 = (d: number): number => ((d + 180) % 360 + 360) % 360 - 180;

/** Scan for the next moment the pair is exactly at `alpha` degrees,
 *  in [jd0, jd1]: coarse scan for sign changes of the signed distance
 *  from exact, then bisection. A sign change can also come from the
 *  wrap at the antipode of the target angle, so a bracket is accepted
 *  only when the root is truly at zero. A near-tangent touch (the
 *  pair perfects while stationary, no sign change) is caught by the
 *  closest sample. Numerical plumbing over engine longitudes — the
 *  same coarse-scan-then-bisect pattern as the engine's `when`. */
function scanExact(
  engine: Engine, a: string, b: string, alpha: number,
  jd0: number, jd1: number,
): number | null {
  const f = (t: number): number => wrap180(
    wrap180(engine.longitude(a as BodyId, t) - engine.longitude(b as BodyId, t))
      - alpha,
  );
  const steps = Math.max(64, Math.ceil((jd1 - jd0) / 0.25));
  const h = (jd1 - jd0) / steps;
  let prev = f(jd0);
  let bestT = jd0;
  let bestAbs = Math.abs(prev);
  for (let k = 1; k <= steps; k++) {
    const t = jd0 + h * k;
    const cur = f(t);
    if (Math.abs(cur) < bestAbs) {
      bestAbs = Math.abs(cur);
      bestT = t;
    }
    if ((prev < 0) !== (cur < 0)) {
      let lo = t - h;
      let hi = t;
      let flo = prev;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((flo < 0) === (fm < 0)) {
          lo = mid;
          flo = fm;
        } else {
          hi = mid;
        }
      }
      const root = (lo + hi) / 2;
      if (Math.abs(f(root)) < 0.01) return root;
    }
    prev = cur;
  }
  return bestAbs < 0.005 ? bestT : null;
}

/** Run the engine once and capture the dial as serializable data. */
export function deriveDial(
  engine: Engine, params: AspectDialParams,
): AspectDialScene {
  const { instant: i, place: p } = params;
  const jd = julianDay(i.y, i.mo, i.d, i.h, i.mi, i.s);
  const chart = engine.chart(
    i.y, i.mo, i.d, i.h, i.mi, i.s, p.latDeg, p.lonEastDeg,
    params.houseSystem ?? "placidus",
  );

  const bodies: DialBody[] = [];
  for (const [id, b] of Object.entries(chart.bodies)) {
    if (!b) continue;
    bodies.push({ id, lon: b.lon, speed: b.speed, retrograde: !!b.retrograde });
  }

  const a = params.a ?? "sun";
  const b = params.b ?? "moon";

  const ceiling: Record<string, number> = {};
  for (const name of Object.keys(ASPECTS)) ceiling[name] = ASPECTARIAN_ORB;
  const aspectarian: AspectRow[] = [];
  for (let x = 0; x < bodies.length; x++) {
    for (let y = x + 1; y < bodies.length; y++) {
      const m = aspectBetween(
        engine, bodies[x].id as BodyId, bodies[y].id as BodyId, jd,
        "tropical", ceiling,
      );
      if (m) {
        aspectarian.push({
          a: bodies[x].id, b: bodies[y].id, aspect: m.aspect, orb: m.orb,
          phase: m.phase,
        });
      }
    }
  }
  aspectarian.sort((r, s) => Math.abs(r.orb) - Math.abs(s.orb));

  // The next exact hit: the earliest perfection of any major aspect
  // between the pair. The window covers the worst-case travel to the
  // nearest aspect angle (30°) at the pair's relative speed, margined
  // and capped; slow pairs scan years, the Moon scans a month.
  const pa = engine.position(a as BodyId, jd);
  const pb = engine.position(b as BodyId, jd);
  const rel = Math.max(Math.abs(pa.speed - pb.speed), 0.005);
  const windowDays = Math.min(4000, Math.max(30, 1.25 * 30 / rel));
  let nextExact: AspectDialScene["nextExact"] = null;
  for (const [name, deg] of Object.entries(ASPECTS)) {
    const hit = scanExact(engine, a, b, deg, jd, jd + windowDays);
    if (hit !== null && (!nextExact || hit < nextExact.jdUt)) {
      nextExact = { aspect: name, jdUt: hit };
    }
  }

  return {
    bodies,
    aspects: { ...ASPECTS },
    orbs: { ...DEFAULT_ORBS },
    pair: { a, b },
    aspectarian,
    nextExact,
    windowDays,
    jdUt: jd,
    engineVersion: VERSION,
    params,
  };
}

// ----------------------------------------------------------------- datum

/** The dial readout for a working position of body b: separation,
 *  nearest aspect, signed orb, phase. Pure arithmetic on scene data. */
export function dialReadout(
  scene: AspectDialScene, lonB: number,
): { sep: number; aspect: string; orb: number; phase: AspectPhase } | null {
  const a = scene.bodies.find((x) => x.id === scene.pair.a);
  if (!a) return null;
  const b = scene.bodies.find((x) => x.id === scene.pair.b);
  const sep = separation(a.lon, lonB);
  let best: { aspect: string; orb: number } | null = null;
  for (const [name, deg] of Object.entries(scene.aspects)) {
    const orb = sep - deg;
    if (!best || Math.abs(orb) < Math.abs(best.orb)) best = { aspect: name, orb };
  }
  if (!best) return null;
  return {
    sep,
    aspect: best.aspect,
    orb: best.orb,
    phase: aspectPhase(
      a.lon, a.speed, lonB, b?.speed ?? 0, scene.aspects[best.aspect],
    ),
  };
}

/** The console datum at rest: `☉—☽ △ +2°14′ applying · exact 1990-06-17`.
 *  Dragging swaps the second half for the dragged longitude. */
export function dialDatum(scene: AspectDialScene, dragLon?: number): string {
  const { a, b } = scene.pair;
  const ga = GLYPHS[a] ?? a;
  const gb = GLYPHS[b] ?? b;
  const body = scene.bodies.find((x) => x.id === b);
  const lonB = dragLon ?? body?.lon ?? 0;
  const r = dialReadout(scene, lonB);
  if (!r) return `${ga}—${gb}`;
  const [od, om] = dm(r.orb);
  const sign = r.orb < 0 ? "−" : "+";
  const head = `${ga}—${gb} ${ASPECT_GLYPHS[r.aspect] ?? r.aspect} `
    + `${sign}${od}°${om}′ ${r.phase}`;
  if (dragLon !== undefined) {
    return `${head} · λ ${fmtZodiac(lonB)} (dragged)`;
  }
  return `${head} · ${nextExactDatum(scene)}`;
}

/** The next-exact clause: `exact 1990-06-17` or the empty window. */
export function nextExactDatum(scene: AspectDialScene): string {
  if (scene.nextExact) {
    const g = ASPECT_GLYPHS[scene.nextExact.aspect] ?? scene.nextExact.aspect;
    return `exact ${g} ${fmtDate(scene.nextExact.jdUt)}`;
  }
  const years = Math.round(scene.windowDays / 365.25);
  return `no exact hit within ${years} y`;
}

// --------------------------------------------------------------- figure

export interface AspectDialFigureProps {
  scene: AspectDialScene;
  /** Dragged longitude for body b; absent at rest (the plate). */
  dragLonB?: number;
  /** Square size in px. */
  size?: number;
  /** Pointer callback for the drag; attaches only when provided, so
   *  the server render (and the figure harness) is byte-identical
   *  without it. */
  onDrag?: (lon: number) => void;
}

/** The dial. Longitude increases counterclockwise from the top — the
 *  wheel's handedness, shared with the drift figure. */
export function AspectDialFigure({
  scene, dragLonB, size = 520, onDrag,
}: AspectDialFigureProps): ReactElement {
  const DEG = Math.PI / 180;
  const c = size / 2;
  const fix = (v: number): number => Math.round(v * 100) / 100;
  const R = size * 0.34;
  const pt = (lon: number, r: number): [number, number] => [
    fix(c - r * Math.sin(lon * DEG)), fix(c - r * Math.cos(lon * DEG)),
  ];
  /** Arc along the dial from l0 to l1 (the short way), radius r. */
  const arc = (l0: number, l1: number, r: number): string => {
    const span = wrap180(l1 - l0);
    const [x0, y0] = pt(l0, r);
    const [x1, y1] = pt(l1, r);
    // Increasing longitude runs counterclockwise: SVG sweep 0.
    const sweep = span >= 0 ? 0 : 1;
    const large = Math.abs(span) > 180 ? 1 : 0;
    return `M${x0} ${y0} A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  };

  const a = scene.bodies.find((x) => x.id === scene.pair.a);
  const b = scene.bodies.find((x) => x.id === scene.pair.b);
  if (!a || !b) {
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} />;
  }
  const lonB = dragLonB ?? b.lon;
  const readout = dialReadout(scene, lonB);

  const els: ReactElement[] = [];

  // The dial circle and degree ticks: small every 10°, medium at the
  // sign boundaries.
  els.push(<circle key="dial" cx={c} cy={c} r={R} fill="none"
    stroke={PLATE_TOKENS.ink} strokeWidth={1.25} />);
  for (let k = 0; k < 36; k++) {
    const medium = k % 3 === 0;
    const [x1, y1] = pt(k * 10, R - (medium ? 5 : 3));
    const [x2, y2] = pt(k * 10, R + (medium ? 5 : 3));
    els.push(<line key={`tick-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={medium ? PLATE_TOKENS.mutedInk : PLATE_TOKENS.faintInk}
      strokeWidth={medium ? 0.75 : 0.5} />);
  }

  // Aspect furniture from a's place: each aspect point, both sides
  // (separation is unsigned), its orb zone shaded along the ring.
  for (const [name, deg] of Object.entries(scene.aspects)) {
    const marks = deg === 0 || deg === 180 ? [a.lon + deg]
      : [a.lon + deg, a.lon - deg];
    const orb = scene.orbs[name] ?? 0;
    for (const m of marks) {
      if (orb > 0) {
        els.push(<path key={`zone-${name}-${m}`}
          d={arc(m - orb, m + orb, R)} fill="none"
          stroke={PLATE_TOKENS.faintInk} strokeWidth={size * 0.028}
          opacity={0.35} />);
      }
      const [x1, y1] = pt(m, R - size * 0.016);
      const [x2, y2] = pt(m, R + size * 0.016);
      els.push(<line key={`mark-${name}-${m}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={PLATE_TOKENS.mutedInk} strokeWidth={1} />);
      const [gx, gy] = pt(m, R + size * 0.052);
      els.push(<text key={`glyph-${name}-${m}`} x={gx} y={gy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.026} fill={PLATE_TOKENS.mutedInk}>
        {ASPECT_GLYPHS[name] ?? name}
      </text>);
    }
  }

  // The separation arc, then the orb arc from the nearest aspect
  // point to body b — the highlighted element.
  els.push(<path key="sep" d={arc(a.lon, lonB, R)} fill="none"
    stroke={PLATE_TOKENS.ink} strokeWidth={1.25} />);
  if (readout && Math.abs(readout.orb) <= (scene.orbs[readout.aspect] ?? 0)) {
    const mark = a.lon + (wrap180(lonB - a.lon) >= 0 ? 1 : -1)
      * scene.aspects[readout.aspect];
    els.push(<path key="orb" d={arc(mark, lonB, R)} fill="none"
      stroke={PLATE_TOKENS.accent} strokeWidth={1.75} />);
  }

  // The pair: glyphs on the ring, a anchored, b draggable.
  const [ax, ay] = pt(a.lon, R);
  els.push(<text key="body-a" x={ax} y={ay} textAnchor="middle"
    dominantBaseline="central" fontSize={size * 0.04}
    fill={PLATE_TOKENS.ink}>{GLYPHS[a.id] ?? a.id}</text>);
  const [bx, by] = pt(lonB, R);
  els.push(<text key="body-b" x={bx} y={by} textAnchor="middle"
    dominantBaseline="central" fontSize={size * 0.04}
    fill={PLATE_TOKENS.ink}
    style={onDrag ? { cursor: "grab" } : undefined}>
    {GLYPHS[b.id] ?? b.id}
  </text>);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: "transparent", touchAction: "none" }}
      {...(onDrag
        ? {
            onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onDrag(pointerLon(e));
            },
            onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
              if (e.buttons & 1) onDrag(pointerLon(e));
            },
          }
        : {})}
    >
      {els}
    </svg>
  );

  /** Longitude of the pointer under the figure's own convention. */
  function pointerLon(e: React.PointerEvent<SVGSVGElement>): number {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) * (size / r.width);
    const y = (e.clientY - r.top) * (size / r.height);
    return ((Math.atan2(c - x, c - y) / DEG) + 360) % 360;
  }
}

// The interactive widget lives in aspect-dial-widget.tsx: it calls
// hooks, and this module must stay importable from React Server
// Components (the plate render and the registry harness), so the
// client-only surface is its own subpath.
