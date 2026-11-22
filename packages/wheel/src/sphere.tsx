/**
 * ChartSphere: the chart as a tilted celestial sphere instead of a flat wheel,
 * SSR-safe SVG with no runtime dependencies. Planets sit at their true ecliptic
 * latitude (a flat wheel collapses that to zero), so you see the Moon ride above
 * the ecliptic and Pluto swing well off it. The ecliptic and equator are drawn
 * as great-circle rings, solid on the near hemisphere and faded on the far one;
 * a short stem drops each planet to the ecliptic plane to show its latitude.
 *
 * Supports linked selection/hover (`selectedBody`, `hoveredBody`, `onSelectBody`,
 * `onHoverBody`), smooth latitude flattening (`flatten` 0..1), declination
 * out-of-bounds cues, and optional 3D aspect chords.
 */
import { GLYPHS, DARK_THEME, type WheelAspect, type WheelTheme } from "./index.js";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const DEFAULT_OBLIQUITY = 23.4368; // mean obliquity, deg; for the equator ring
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓"];
const HARD_ASPECTS = new Set(["conjunction", "square", "opposition"]);

const bodyTitle = (b: string): string =>
  b.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export interface SpherePosition {
  lon: number;
  lat: number;
  retrograde?: boolean;
  rx?: boolean;
  /** Optional equatorial declination in degrees; derived from (lon, lat, obliquity) if omitted. */
  dec?: number;
}
export interface SphereChart {
  /** Bodies with ecliptic longitude AND latitude (the caelus chart's bodies
   *  satisfy this as-is). A body may be absent (e.g. Chiron outside its fitted
   *  range); the component filters these out before reading them. */
  bodies: Record<string, SpherePosition | undefined>;
  /** Optional aspects list for 3D chord overlay. */
  aspects?: WheelAspect[];
}

export interface ChartSphereProps {
  chart: SphereChart;
  /** Square size in px. */
  size?: number;
  /** Degrees the ecliptic pole tilts away from the viewer (0 = pole-on wheel,
   *  90 = edge-on). */
  tilt?: number;
  /** Degrees the sphere is spun about its pole (which longitude faces front). */
  turn?: number;
  /** Obliquity for the equator ring, degrees. */
  obliquity?: number;
  showEquator?: boolean;
  /** Highlight out-of-bounds declinations (|dec| > obliquity) and solstice tropics. Default true. */
  showDeclinationBands?: boolean;
  /** Flatten factor in [0, 1] collapsing ecliptic latitude onto the plane (0 = full 3D, 1 = flat). */
  flatten?: number;
  /** Draw 3D aspect chords inside the sphere (uses `aspects` prop or `chart.aspects`). */
  showAspects?: boolean;
  aspects?: WheelAspect[];
  bodies?: string[];
  theme?: Partial<WheelTheme>;
  glyphs?: Record<string, string>;
  /** Currently selected body id for linked cross-highlighting. */
  selectedBody?: string | null;
  /** Currently hovered body id for linked cross-highlighting. */
  hoveredBody?: string | null;
  /** Called when a body is clicked or activated by keyboard. */
  onSelectBody?: (body: string | null) => void;
  /** Called when pointer/focus enters or leaves a body. */
  onHoverBody?: (body: string | null) => void;
}

type V3 = [number, number, number];

const eclVec = (lonDeg: number, latDeg: number): V3 => {
  const l = lonDeg * D2R, b = latDeg * D2R, cb = Math.cos(b);
  return [cb * Math.cos(l), cb * Math.sin(l), Math.sin(b)];
};
const rotX = (v: V3, deg: number): V3 => {
  const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
};
const rotZ = (v: V3, deg: number): V3 => {
  const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};

/** Exact spherical conversion from ecliptic (lon, lat) to equatorial declination (deg). */
function declinationOf(lonDeg: number, latDeg: number, epsDeg: number): number {
  const l = lonDeg * D2R, b = latDeg * D2R, e = epsDeg * D2R;
  const sinD = Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l);
  return Math.asin(Math.max(-1, Math.min(1, sinD))) * R2D;
}

interface ChartSphereCtx { turn: number; tilt: number; R: number; c: number; }
interface P2 { x: number; y: number; front: boolean; depth: number; }

function project(world: V3, ctx: ChartSphereCtx): P2 {
  const v = rotX(rotZ(world, ctx.turn), ctx.tilt);
  return { x: ctx.c + v[0] * ctx.R, y: ctx.c - v[1] * ctx.R, front: v[2] >= 0, depth: v[2] };
}

/** A great circle sampled and split into near (front) and far (back) polyline
 *  paths, so the near arc can be drawn solid over the far one. */
function ringPaths(points: V3[], ctx: ChartSphereCtx): { front: string; back: string } {
  const segs: Record<"front" | "back", string[]> = { front: [], back: [] };
  let run: P2[] = [];
  let runFront = true;
  const flush = () => {
    if (run.length < 2) { run = []; return; }
    const d = "M" + run.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L");
    segs[runFront ? "front" : "back"].push(d);
    run = [];
  };
  for (let i = 0; i <= points.length; i++) {
    const p = project(points[i % points.length], ctx);
    if (run.length && p.front !== runFront) { flush(); }
    if (!run.length) runFront = p.front;
    run.push(p);
  }
  flush();
  return { front: segs.front.join(" "), back: segs.back.join(" ") };
}

function circleSamples(make: (deg: number) => V3, n = 120): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) out.push(make((i / n) * 360));
  return out;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function ChartSphere({
  chart,
  size = 520,
  tilt = 64,
  turn = -90,
  obliquity = DEFAULT_OBLIQUITY,
  showEquator = true,
  showDeclinationBands = true,
  flatten = 0,
  showAspects = false,
  aspects,
  bodies,
  theme,
  glyphs,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: ChartSphereProps) {
  const th: WheelTheme = {
    ...DARK_THEME,
    ...theme,
    aspectColors: { ...DARK_THEME.aspectColors, ...(theme?.aspectColors ?? {}) },
    planetColors: { ...(DARK_THEME.planetColors ?? {}), ...(theme?.planetColors ?? {}) },
  };
  const gl = { ...GLYPHS, ...glyphs };
  const c = size / 2;
  const R = size * 0.42;
  const flat = Math.max(0, Math.min(1, flatten));
  const effTilt = tilt * (1 - flat * 0.85);
  const ctx: ChartSphereCtx = { turn, tilt: effTilt, R, c };

  const ecliptic = ringPaths(circleSamples((d) => eclVec(d, 0)), ctx);
  const equator = ringPaths(circleSamples((d) => rotX(eclVec(d, 0), obliquity)), ctx);
  const meridian = ringPaths(circleSamples((d) => [Math.cos(d * D2R), 0, Math.sin(d * D2R)]), ctx);
  const northPole = project([0, 0, 1], ctx);
  const southPole = project([0, 0, -1], ctx);

  // Subtle +/- obliquity declination circles (tropic limits for out-of-bounds reference)
  const tropicN = showDeclinationBands && showEquator
    ? ringPaths(circleSamples((d) => rotX(eclVec(d, obliquity), obliquity)), ctx)
    : null;
  const tropicS = showDeclinationBands && showEquator
    ? ringPaths(circleSamples((d) => rotX(eclVec(d, -obliquity), obliquity)), ctx)
    : null;

  const names = (bodies ?? Object.keys(chart.bodies).filter((b) => b !== "mean_node"))
    .filter((b) => chart.bodies[b]);
  const drawn = names.map((name) => {
    const pos = chart.bodies[name]!;
    const effLat = pos.lat * (1 - flat);
    const p = project(eclVec(pos.lon, effLat), ctx);
    const base = project(eclVec(pos.lon, 0), ctx); // foot on the ecliptic plane
    const dec = pos.dec ?? declinationOf(pos.lon, pos.lat, obliquity);
    const oob = Math.abs(dec) > obliquity;
    const retrograde = pos.retrograde ?? pos.rx ?? false;
    return { name, pos, p, base, dec, oob, retrograde };
  }).sort((a, b) => a.p.depth - b.p.depth); // far first (painter's order)

  const byName = new Map(drawn.map((d) => [d.name, d]));
  const activeBody = hoveredBody ?? selectedBody ?? null;
  const aspectList = showAspects ? (aspects ?? chart.aspects ?? []) : [];
  const connected = new Set<string>();
  if (activeBody) {
    connected.add(activeBody);
    for (const a of aspectList) {
      if (a.a === activeBody) connected.add(a.b);
      if (a.b === activeBody) connected.add(a.a);
    }
  }
  const hasFocus = activeBody !== null;
  const interactive = Boolean(onSelectBody || onHoverBody);
  const eclColor = th.ecliptic ?? th.signText;
  const eqColor = th.meridian ?? th.axis;
  const ringMinor = th.ringMinor ?? th.ring;

  // Direct rim labels for Ecliptic and Equator at clear front positions
  const eclLab = project(eclVec(180 - turn, 0), ctx);
  const eqLab = project(rotX(eclVec(90 - turn, 0), obliquity), ctx);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Astrological chart sphere"
      style={{ background: th.background, display: "block" }}>
      {/* outer celestial sphere boundary */}
      <circle cx={c} cy={c} r={R} fill="none" stroke={th.ring} strokeWidth={1.25} />

      {/* polar axis and meridian reference */}
      <g fill="none" stroke={ringMinor} strokeWidth={0.65}>
        <path d={meridian.back} opacity={0.18} strokeDasharray="2 3" />
        <path d={meridian.front} opacity={0.28} />
        <line x1={r2(northPole.x)} y1={r2(northPole.y)} x2={r2(southPole.x)} y2={r2(southPole.y)}
          strokeDasharray="2 3" opacity={0.35} />
      </g>
      <g fontFamily={th.fontFamily} fontSize={size * 0.02} fill={th.houseText}
        textAnchor="middle" dominantBaseline="central">
        <text x={r2(northPole.x)} y={r2(northPole.y - size * 0.02)} opacity={0.75}>N</text>
        <text x={r2(southPole.x)} y={r2(southPole.y + size * 0.02)} opacity={0.55}>S</text>
      </g>

      {/* optional solstice/out-of-bounds declination limit circles */}
      {tropicN && tropicS && (
        <g fill="none" stroke={eqColor} strokeWidth={0.6} strokeDasharray="2 4">
          <path d={tropicN.back} opacity={0.14} />
          <path d={tropicN.front} opacity={0.32} />
          <path d={tropicS.back} opacity={0.14} />
          <path d={tropicS.front} opacity={0.32} />
        </g>
      )}

      {showEquator && (
        <g fill="none" stroke={eqColor} strokeWidth={1}>
          <path d={equator.back} opacity={0.22} strokeDasharray="3 3" />
          <path d={equator.front} opacity={0.75} />
        </g>
      )}
      <g fill="none" stroke={eclColor} strokeWidth={1.35}>
        <path d={ecliptic.back} opacity={0.28} strokeDasharray="3 3" />
        <path d={ecliptic.front} opacity={0.92} />
      </g>

      {/* direct circle labels (no detached legend) */}
      <g fontFamily={th.fontFamily} fontSize={size * 0.019} textAnchor="start" dominantBaseline="central">
        <text x={r2(Math.min(size - 48, eclLab.x + 6))} y={r2(eclLab.y - 8)} fill={eclColor} opacity={0.8}>
          Ecliptic
        </text>
        {showEquator && (
          <text x={r2(Math.min(size - 48, eqLab.x + 6))} y={r2(eqLab.y + 8)} fill={eqColor} opacity={0.75}>
            Equator
          </text>
        )}
      </g>

      {/* zodiac sign marks at each 30 deg of ecliptic longitude */}
      <g fontFamily={th.fontFamily} fontSize={size * 0.028} fill={th.signText}
        textAnchor="middle" dominantBaseline="central">
        {SIGN_GLYPHS.map((g, i) => {
          const m = project(eclVec(i * 30, 0), ctx);
          return (
            <text key={i} x={r2(m.x)} y={r2(m.y)} opacity={m.front ? 0.85 : 0.28}>{g}</text>
          );
        })}
      </g>

      {/* optional 3D aspect chords */}
      {aspectList.length > 0 && (
        <g fill="none">
          {aspectList.map((a) => {
            const da = byName.get(a.a);
            const db = byName.get(a.b);
            if (!da || !db) return null;
            const highlighted = activeBody !== null && (a.a === activeBody || a.b === activeBody);
            const dimmed = hasFocus && !highlighted;
            return (
              <line key={`sasp-${a.a}-${a.aspect}-${a.b}`}
                x1={r2(da.p.x)} y1={r2(da.p.y)} x2={r2(db.p.x)} y2={r2(db.p.y)}
                stroke={th.aspectColors[a.aspect] ?? th.ring}
                strokeWidth={highlighted ? 1.5 : 0.9}
                strokeDasharray={HARD_ASPECTS.has(a.aspect) ? undefined : "3 3"}
                opacity={highlighted ? 0.92 : dimmed ? 0.1 : 0.42} />
            );
          })}
        </g>
      )}

      {/* planets at true latitude, with a stem to the ecliptic plane */}
      <g fontFamily={th.fontFamily}>
        {drawn.map(({ name, pos, p, base, dec, oob, retrograde }) => {
          const pColor = th.planetColors?.[name] ?? th.planetText;
          const isSelected = selectedBody === name;
          const isHovered = hoveredBody === name;
          const isHighlighted = isSelected || isHovered || (hasFocus && connected.has(name));
          const isDimmed = hasFocus && !isHighlighted;
          const baseOp = p.front ? 1 : 0.42;
          const op = isSelected || isHovered ? 1 : isDimmed ? 0.22 : baseOp;
          const handlers = interactive
            ? {
                role: onSelectBody ? ("button" as const) : undefined,
                tabIndex: onSelectBody ? 0 : undefined,
                style: { cursor: onSelectBody ? "pointer" : undefined },
                onClick: onSelectBody ? () => onSelectBody(selectedBody === name ? null : name) : undefined,
                onMouseEnter: onHoverBody ? () => onHoverBody(name) : undefined,
                onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
                onFocus: onHoverBody ? () => onHoverBody(name) : undefined,
                onBlur: onHoverBody ? () => onHoverBody(null) : undefined,
                onKeyDown: onSelectBody
                  ? (e: { key: string; preventDefault: () => void }) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectBody(selectedBody === name ? null : name);
                      }
                    }
                  : undefined,
              }
            : {};

          const latSign = pos.lat >= 0 ? "+" : "";
          const decSign = dec >= 0 ? "+" : "";
          const dR = size * 0.032;

          return (
            <g key={name} data-body={name}
              data-selected={isSelected ? "true" : undefined}
              data-highlighted={isHighlighted ? "true" : undefined}
              data-dimmed={isDimmed ? "true" : undefined}
              data-oob={oob ? "true" : undefined}
              opacity={op}
              {...handlers}>
              <title>
                {`${bodyTitle(name)} · lon ${pos.lon.toFixed(1)}° · lat ${latSign}${pos.lat.toFixed(2)}° · dec ${decSign}${dec.toFixed(2)}°${oob ? " (out of bounds)" : ""}${retrograde ? " · retrograde" : ""}`}
              </title>
              <line x1={r2(base.x)} y1={r2(base.y)} x2={r2(p.x)} y2={r2(p.y)}
                stroke={isSelected || isHovered ? th.axis : pColor}
                strokeWidth={isSelected || isHovered ? 1.5 : 1} opacity={0.68} />
              <circle cx={r2(base.x)} cy={r2(base.y)} r={1.6} fill={pColor} opacity={0.75} />
              {showDeclinationBands && oob && (
                <polygon
                  points={`${r2(p.x)},${r2(p.y - dR)} ${r2(p.x + dR)},${r2(p.y)} ${r2(p.x)},${r2(p.y + dR)} ${r2(p.x - dR)},${r2(p.y)}`}
                  fill="none" stroke={eclColor} strokeWidth={1} opacity={0.85} />
              )}
              {(isSelected || isHovered) && (
                <circle cx={r2(p.x)} cy={r2(p.y)} r={r2(size * 0.036)}
                  fill="none" stroke={th.axis} strokeWidth={isSelected ? 1.5 : 1} />
              )}
              <text x={r2(p.x)} y={r2(p.y)} fontSize={size * 0.044} fill={pColor}
                textAnchor="middle" dominantBaseline="central">{gl[name] ?? name.slice(0, 2)}</text>
              {retrograde && (
                <text x={r2(p.x + size * 0.03)} y={r2(p.y - size * 0.028)} fontSize={size * 0.021}
                  fill={th.labelText} textAnchor="middle">℞</text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
