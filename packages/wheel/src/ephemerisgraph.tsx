/**
 * EphemerisGraph: a graphic ephemeris -- one value per body over time as line
 * graphs, SSR-safe SVG with no runtime dependencies. Longitude wraps 360 -> 0,
 * so the lines are split at the wrap; declination and speed draw straight.
 * Feed it the output of the caelus engine's `ephemeris(...)`.
 */
import { DARK_THEME, type WheelTheme } from "./index.js";

export interface SeriesPoint { jd: number; value: number }

export interface EphemerisGraphProps {
  series: Record<string, SeriesPoint[]>;
  width?: number;
  height?: number;
  /** Value-axis bounds. Defaults to [0, wrap] when wrap is set, else the data
   *  range with a little padding. */
  yMin?: number;
  yMax?: number;
  /** Split a line when the value jumps more than wrap/2 (use 360 for longitude). */
  wrap?: number;
  /** Value-axis gridline spacing. */
  gridStep?: number;
  colors?: Record<string, string>;
  theme?: Partial<WheelTheme>;
}

const DEFAULT_COLORS: Record<string, string> = {
  sun: "#e0b020", moon: "#c8c8d0", mercury: "#9a93c4", venus: "#4fb09a",
  mars: "#c0564f", jupiter: "#c08a4f", saturn: "#8d8a99",
  uranus: "#4f8fc0", neptune: "#5a6fc0", pluto: "#a05a8a", chiron: "#7a9a5a",
};
const PALETTE = ["#8a7fd4", "#c0564f", "#4f8fc0", "#4fb09a", "#c08a4f", "#a05a8a"];

export function EphemerisGraph({
  series, width = 720, height = 360, yMin, yMax, wrap, gridStep,
  colors, theme,
}: EphemerisGraphProps) {
  const th: WheelTheme = { ...DARK_THEME, ...theme };
  const bodies = Object.keys(series).filter((b) => series[b]?.length);
  const all = bodies.flatMap((b) => series[b]);
  const jds = all.map((p) => p.jd);
  const j0 = Math.min(...jds), j1 = Math.max(...jds);

  let lo = yMin, hi = yMax;
  if (lo === undefined || hi === undefined) {
    if (wrap !== undefined) { lo = 0; hi = wrap; }
    else {
      const vs = all.map((p) => p.value);
      const min = Math.min(...vs), max = Math.max(...vs), pad = (max - min) * 0.05 || 1;
      lo = min - pad; hi = max + pad;
    }
  }
  const span = hi - lo || 1;

  const m = { l: 44, r: 96, t: 12, b: 24 };
  const pw = width - m.l - m.r, ph = height - m.t - m.b;
  const px = (jd: number): number => m.l + ((jd - j0) / (j1 - j0 || 1)) * pw;
  const py = (v: number): number => m.t + (1 - (v - lo) / span) * ph;

  const step = gridStep ?? (wrap ? wrap / 6 : span / 6);
  const gridVals: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) gridVals.push(v);

  const colorOf = (b: string, i: number): string =>
    colors?.[b] ?? DEFAULT_COLORS[b] ?? PALETTE[i % PALETTE.length];

  // A body's polyline, split where the value wraps.
  const line = (pts: SeriesPoint[]): string[] => {
    const segs: string[] = [];
    let cur: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (wrap !== undefined && i > 0 && Math.abs(pts[i].value - pts[i - 1].value) > wrap / 2) {
        if (cur.length > 1) segs.push("M" + cur.join(" L"));
        cur = [];
      }
      cur.push(`${px(pts[i].jd).toFixed(1)} ${py(pts[i].value).toFixed(1)}`);
    }
    if (cur.length > 1) segs.push("M" + cur.join(" L"));
    return segs;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphic ephemeris">
      <rect x={0} y={0} width={width} height={height} fill={th.background} />
      {/* value gridlines + labels */}
      <g fontFamily={th.fontFamily} fontSize={10} fill={th.labelText}>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={m.l} y1={py(v)} x2={m.l + pw} y2={py(v)}
              stroke={th.ring} strokeWidth={0.5} opacity={0.5} />
            <text x={m.l - 4} y={py(v)} textAnchor="end" dominantBaseline="central">
              {Math.round(v)}
            </text>
          </g>
        ))}
      </g>
      <rect x={m.l} y={m.t} width={pw} height={ph} fill="none"
        stroke={th.ring} strokeWidth={1} />
      {/* per-body lines + legend */}
      {bodies.map((b, i) => {
        const col = colorOf(b, i);
        return (
          <g key={b} stroke={col} fill={col} strokeWidth={1.5}>
            {line(series[b]).map((d, k) => <path key={k} d={d} fill="none" />)}
            <line x1={m.l + pw + 8} y1={m.t + 12 + i * 16}
              x2={m.l + pw + 22} y2={m.t + 12 + i * 16} />
            <text x={m.l + pw + 26} y={m.t + 12 + i * 16} fontSize={11}
              stroke="none" fontFamily={th.fontFamily} dominantBaseline="central">{b}</text>
          </g>
        );
      })}
    </svg>
  );
}
