/**
 * EphemerisGraph: a Tufte-grade graphic ephemeris -- one value per body over
 * time as line graphs, SSR-safe SVG with no runtime dependencies. Longitude
 * wraps 360 -> 0, so lines split at the wrap; declination and speed draw
 * straight with an automatic y = 0 reference line.
 *
 * Follows VDQI principles: C2 range-frame axes with precision-matched ticks,
 * calendar-date x-axis anchors, B4 direct endpoint labels with vertical
 * deconfliction (no detached legend), color-blind-safe default inks, top
 * annotation lane for event marks, optional C5 small-multiples mode, and
 * linked body selection/hover.
 */
import { DARK_THEME, type WheelTheme } from "./index.js";

export interface SeriesPoint { jd: number; value: number }

/** A vertical tick at a moment in time (a station, an ingress). */
export interface EphemerisMark {
  jd: number;
  /** Small mono label drawn in the top annotation lane ("SR"). */
  label?: string;
  /** Draw in the accent color instead of the label ink. */
  accent?: boolean;
}

/** A shaded time interval (a retrograde loop, a void-of-course span). */
export interface EphemerisBand { from: number; to: number }

export interface EphemerisGraphProps {
  series: Record<string, SeriesPoint[]>;
  width?: number;
  height?: number;
  /** Value-axis bounds. Defaults to [0, wrap] when wrap is set, else exact data range. */
  yMin?: number;
  yMax?: number;
  /** Split a line when the value jumps more than wrap/2 (use 360 for longitude). */
  wrap?: number;
  /** Value-axis tick spacing. */
  gridStep?: number;
  /** Explicit unit suffix for value-axis labels (defaults to "°" when wrap === 360). */
  yUnit?: string;
  /** Show calendar date ticks along the bottom x-axis range frame. Default true. */
  xLabels?: boolean;
  /** Show a hairline reference at y = 0 when the value range spans zero. Default true. */
  showZeroLine?: boolean;
  /** Render one aligned miniature panel per body (Tufte C5 small multiples). */
  smallMultiples?: boolean;
  colors?: Record<string, string>;
  theme?: Partial<WheelTheme>;
  /** Shaded interval over the plot, drawn under the lines. */
  band?: EphemerisBand;
  /** Vertical ticks at moments in time, drawn over the lines. */
  marks?: EphemerisMark[];
  /** A vertical line at this jd -- the scrub cursor. */
  cursor?: number;
  /** Cursor and accented-mark color; defaults to the theme's axis ink. */
  accent?: string;
  /** Currently selected body id for linked cross-highlighting. */
  selectedBody?: string | null;
  /** Currently hovered body id for linked cross-highlighting. */
  hoveredBody?: string | null;
  /** Called when a series or label is clicked. */
  onSelectBody?: (body: string | null) => void;
  /** Called when pointer/focus enters or leaves a series or label. */
  onHoverBody?: (body: string | null) => void;
}

// Color-blind-safe default inks (Okabe-Ito / blue-amber-violet-vermilion separation, avoiding red-green pairs).
const DEFAULT_COLORS: Record<string, string> = {
  sun: "#e69f00",
  moon: "#c8c8d0",
  mercury: "#a596ff",
  venus: "#56b4e9",
  mars: "#d55e00",
  jupiter: "#cc79a7",
  saturn: "#8d8a99",
  uranus: "#0072b2",
  neptune: "#7b8cde",
  pluto: "#b87fa8",
  chiron: "#b59b5c",
  true_node: "#9a93c4",
};
const PALETTE = ["#a596ff", "#e69f00", "#56b4e9", "#d55e00", "#cc79a7", "#0072b2"];

const bodyLabel = (b: string): string =>
  b.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Pure Gregorian/Julian calendar date from JD (Fliegel-Van Flandern, zero engine dep). */
function jdToIsoDate(jd: number): string {
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const yStr = year < 0 ? `-${String(-year).padStart(4, "0")}` : String(year).padStart(4, "0");
  return `${yStr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Choose a clean decimal step for a linear span (1, 2, 5 x 10^k). */
function niceStep(span: number, targetTicks = 5): number {
  const raw = span / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const norm = raw / mag;
  const nice = norm <= 1.2 ? 1 : norm <= 2.5 ? 2 : norm <= 5.5 ? 5 : 10;
  return nice * mag;
}

/** Format a tick value with significant precision matching the axis step. */
function formatTick(v: number, step: number, unit: string): string {
  const cleaned = Math.abs(v) < 1e-9 ? 0 : v;
  const decimals = step < 0.05 ? 3 : step < 0.2 ? 2 : step < 1 ? 1 : 0;
  const s = decimals === 0 ? String(Math.round(cleaned)) : cleaned.toFixed(decimals);
  return unit ? `${s}${unit}` : s;
}

export function EphemerisGraph({
  series,
  width = 720,
  height = 360,
  yMin,
  yMax,
  wrap,
  gridStep,
  yUnit,
  xLabels = true,
  showZeroLine = true,
  smallMultiples = false,
  colors,
  theme,
  band,
  marks,
  cursor,
  accent,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: EphemerisGraphProps) {
  const th: WheelTheme = { ...DARK_THEME, ...theme };
  const ac = accent ?? th.axis;
  const unit = yUnit ?? (wrap === 360 ? "°" : "");
  const bodies = Object.keys(series).filter((b) => series[b]?.length);
  const all = bodies.flatMap((b) => series[b]);
  const jds = all.map((p) => p.jd);
  const j0 = jds.length ? Math.min(...jds) : 0;
  const j1 = jds.length ? Math.max(...jds) : 1;

  const vs = all.map((p) => p.value);
  const dataMin = vs.length ? Math.min(...vs) : 0;
  const dataMax = vs.length ? Math.max(...vs) : 1;

  let lo = yMin, hi = yMax;
  if (lo === undefined || hi === undefined) {
    if (wrap !== undefined) { lo = 0; hi = wrap; }
    else {
      lo = dataMin;
      hi = dataMax === dataMin ? dataMin + 1 : dataMax;
    }
  }
  const span = hi - lo || 1;
  const r1 = (n: number): number => Math.round(n * 10) / 10;

  const colorOf = (b: string, i: number): string =>
    colors?.[b] ?? DEFAULT_COLORS[b] ?? PALETTE[i % PALETTE.length];

  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);

  // Small-multiples mode (Tufte C5): one aligned miniature panel per body
  if (smallMultiples && bodies.length > 1) {
    const cols = bodies.length >= 6 ? 3 : 2;
    const rows = Math.ceil(bodies.length / cols);
    const padX = 18, padY = 18;
    const cellW = (width - padX * (cols - 1)) / cols;
    const cellH = (height - padY * (rows - 1)) / rows;
    const step = gridStep ?? (wrap ? wrap / 4 : niceStep(span, 3));
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
        xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphic ephemeris small multiples"
        style={{ background: th.background, display: "block" }}>
        {bodies.map((b, idx) => {
          const colIdx = idx % cols;
          const rowIdx = Math.floor(idx / cols);
          const ox = colIdx * (cellW + padX);
          const oy = rowIdx * (cellH + padY);
          const ml = idx === 0 ? 40 : 12;
          const mr = 10, mt = 18, mb = xLabels && rowIdx === rows - 1 ? 20 : 8;
          const pw = Math.max(20, cellW - ml - mr);
          const ph = Math.max(20, cellH - mt - mb);
          const px = (jd: number) => ox + ml + ((jd - j0) / (j1 - j0 || 1)) * pw;
          const py = (v: number) => oy + mt + (1 - (v - lo) / span) * ph;
          const pts = series[b];
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
          const col = colorOf(b, idx);
          const isSelected = selectedBody === b;
          const isHighlighted = activeBody === b;
          const isDimmed = activeBody !== null && !isHighlighted;

          return (
            <g key={b} data-body={b}
              data-selected={isSelected ? "true" : undefined}
              data-highlighted={isHighlighted ? "true" : undefined}
              data-dimmed={isDimmed ? "true" : undefined}
              opacity={isDimmed ? 0.35 : 1}>
              <text x={r1(ox + ml)} y={r1(oy + 11)} fontSize={10} fontFamily={th.fontFamily}
                fill={col} fontWeight={600}>{bodyLabel(b)}</text>
              {/* trimmed range-frame axes */}
              <line x1={r1(ox + ml)} y1={r1(oy + mt)} x2={r1(ox + ml)} y2={r1(oy + mt + ph)}
                stroke={th.ring} strokeWidth={0.75} />
              <line x1={r1(ox + ml)} y1={r1(oy + mt + ph)} x2={r1(ox + ml + pw)} y2={r1(oy + mt + ph)}
                stroke={th.ring} strokeWidth={0.75} />
              {showZeroLine && lo < 0 && hi > 0 && (
                <line x1={r1(ox + ml)} y1={r1(py(0))} x2={r1(ox + ml + pw)} y2={r1(py(0))}
                  stroke={th.ring} strokeWidth={0.5} opacity={0.45} />
              )}
              {idx === 0 && (
                <g fontFamily={th.fontFamily} fontSize={9} fill={th.labelText} textAnchor="end" dominantBaseline="central">
                  <text x={r1(ox + ml - 4)} y={r1(oy + mt)}>{formatTick(hi, step, unit)}</text>
                  <text x={r1(ox + ml - 4)} y={r1(oy + mt + ph)}>{formatTick(lo, step, unit)}</text>
                </g>
              )}
              {segs.map((d, k) => (
                <path key={k} d={d} fill="none" stroke={col} strokeWidth={isHighlighted ? 2 : 1.4} />
              ))}
              {cursor !== undefined && cursor >= j0 && cursor <= j1 && (
                <line x1={r1(px(cursor))} y1={r1(oy + mt)} x2={r1(px(cursor))} y2={r1(oy + mt + ph)}
                  stroke={ac} strokeWidth={1.25} />
              )}
              {xLabels && rowIdx === rows - 1 && (
                <g fontFamily={th.fontFamily} fontSize={9} fill={th.labelText}>
                  <text x={r1(ox + ml)} y={r1(oy + mt + ph + 13)} textAnchor="start">{jdToIsoDate(j0)}</text>
                  <text x={r1(ox + ml + pw)} y={r1(oy + mt + ph + 13)} textAnchor="end">{jdToIsoDate(j1)}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  const hasMarkLabels = Boolean(marks?.some((mk) => mk.label));
  const m = { l: 50, r: 84, t: hasMarkLabels ? 24 : 14, b: xLabels ? 28 : 14 };
  const pw = width - m.l - m.r, ph = height - m.t - m.b;
  const px = (jd: number): number => m.l + ((jd - j0) / (j1 - j0 || 1)) * pw;
  const py = (v: number): number => m.t + (1 - (v - lo) / span) * ph;

  const step = gridStep ?? (wrap ? wrap / 6 : niceStep(span, 5));
  const tickVals: number[] = [];
  const firstTick = Math.ceil((lo - 1e-9) / step) * step;
  for (let v = firstTick; v <= hi + 1e-9; v += step) {
    tickVals.push(v);
  }
  // Anchor exact range-frame endpoints if not already within 0.25*step of a nice tick
  if (tickVals.length === 0 || Math.abs(tickVals[0] - lo) > step * 0.25) tickVals.unshift(lo);
  if (Math.abs(tickVals[tickVals.length - 1] - hi) > step * 0.25) tickVals.push(hi);

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

  // Direct endpoint labels (B4) with greedy vertical deconfliction
  const endLabels = bodies.map((b, i) => {
    const pts = series[b];
    const last = pts[pts.length - 1];
    const rawY = py(last.value);
    return { b, i, col: colorOf(b, i), rawY, y: rawY, lastJd: last.jd, lastVal: last.value };
  }).sort((a, b) => a.rawY - b.rawY);

  const minLabelGap = 13;
  for (let k = 1; k < endLabels.length; k++) {
    if (endLabels[k].y - endLabels[k - 1].y < minLabelGap) {
      endLabels[k].y = endLabels[k - 1].y + minLabelGap;
    }
  }
  // Keep bottom-most label within plot bounds by nudging upward if needed
  const maxLabelY = m.t + ph;
  if (endLabels.length && endLabels[endLabels.length - 1].y > maxLabelY) {
    endLabels[endLabels.length - 1].y = maxLabelY;
    for (let k = endLabels.length - 2; k >= 0; k--) {
      if (endLabels[k + 1].y - endLabels[k].y < minLabelGap) {
        endLabels[k].y = Math.max(m.t, endLabels[k + 1].y - minLabelGap);
      }
    }
  }
  const labelYByBody = new Map(endLabels.map((e) => [e.b, e.y]));

  // Stagger mark labels horizontally in the dedicated top annotation lane
  const visibleMarks = (marks ?? [])
    .map((mk) => ({ ...mk, x: r1(px(mk.jd)) }))
    .filter((mk) => mk.x >= m.l - 0.5 && mk.x <= m.l + pw + 0.5)
    .sort((a, b) => a.x - b.x);
  const placedMarkLabelX: number[] = [];
  const markLabelY = visibleMarks.map((mk) => {
    if (!mk.label) return m.t - 8;
    const close = placedMarkLabelX.some((prev) => Math.abs(prev - mk.x) < 24);
    placedMarkLabelX.push(mk.x);
    return close ? m.t - 15 : m.t - 7;
  });

  // Range-frame span on y-axis (exact observed data span within [lo, hi])
  const rfYTop = r1(py(Math.min(hi, dataMax)));
  const rfYBot = r1(py(Math.max(lo, dataMin)));

  // X-axis range-frame ticks: start, midpoint (if wide enough), and end
  const xTicks = xLabels && j1 > j0
    ? pw >= 340
      ? [
          { jd: j0, anchor: "start" as const },
          { jd: (j0 + j1) / 2, anchor: "middle" as const },
          { jd: j1, anchor: "end" as const },
        ]
      : [
          { jd: j0, anchor: "start" as const },
          { jd: j1, anchor: "end" as const },
        ]
    : [];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphic ephemeris"
      style={{ background: th.background, display: "block" }}>
      {th.background !== "transparent" && (
        <rect x={0} y={0} width={width} height={height} fill={th.background} />
      )}

      {/* C2 Range-frame y-axis + precision-formatted tick stubs (no 4-sided box or dreaded grid) */}
      <g fontFamily={th.fontFamily} fontSize={10} fill={th.labelText}>
        <line x1={m.l} y1={rfYTop} x2={m.l} y2={rfYBot} stroke={th.ring} strokeWidth={1} />
        {tickVals.map((v) => {
          const y = r1(py(v));
          return (
            <g key={v.toFixed(6)}>
              <line x1={m.l - 4} y1={y} x2={m.l} y2={y} stroke={th.ring} strokeWidth={0.75} />
              <text x={m.l - 7} y={y} textAnchor="end" dominantBaseline="central">
                {formatTick(v, step, unit)}
              </text>
            </g>
          );
        })}
      </g>

      {/* C2 Range-frame x-axis + calendar date anchors */}
      <g fontFamily={th.fontFamily} fontSize={10} fill={th.labelText}>
        <line x1={m.l} y1={m.t + ph} x2={m.l + pw} y2={m.t + ph} stroke={th.ring} strokeWidth={1} />
        {xTicks.map((xt) => {
          const x = r1(px(xt.jd));
          return (
            <g key={xt.jd.toFixed(3)}>
              <line x1={x} y1={m.t + ph} x2={x} y2={m.t + ph + 4} stroke={th.ring} strokeWidth={0.75} />
              <text x={x} y={m.t + ph + 16} textAnchor={xt.anchor}>
                {jdToIsoDate(xt.jd)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Subtle zero reference line when values cross zero (declination / retrograde speed) */}
      {showZeroLine && lo < 0 && hi > 0 && (
        <line x1={m.l} y1={r1(py(0))} x2={m.l + pw} y2={r1(py(0))}
          stroke={th.ring} strokeWidth={0.75} opacity={0.55} />
      )}

      {/* shaded interval, under the lines */}
      {band && (
        <rect
          x={r1(Math.max(m.l, px(Math.max(band.from, j0))))}
          y={m.t}
          width={r1(Math.max(0, Math.min(m.l + pw, px(Math.min(band.to, j1)))
            - Math.max(m.l, px(Math.max(band.from, j0)))))}
          height={ph}
          fill={th.ring}
          opacity={0.28}
        />
      )}

      {/* per-body curves + direct endpoint labels (B4) */}
      {bodies.map((b, i) => {
        const col = colorOf(b, i);
        const pts = series[b];
        const last = pts[pts.length - 1];
        const endX = r1(px(last.jd));
        const endY = r1(py(last.value));
        const labelY = r1(labelYByBody.get(b) ?? endY);
        const isSelected = selectedBody === b;
        const isHighlighted = activeBody === b;
        const isDimmed = activeBody !== null && !isHighlighted;
        const handlers = interactive
          ? {
              role: onSelectBody ? ("button" as const) : undefined,
              tabIndex: onSelectBody ? 0 : undefined,
              style: { cursor: onSelectBody ? "pointer" : undefined },
              onClick: onSelectBody ? () => onSelectBody(selectedBody === b ? null : b) : undefined,
              onMouseEnter: onHoverBody ? () => onHoverBody(b) : undefined,
              onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
              onFocus: onHoverBody ? () => onHoverBody(b) : undefined,
              onBlur: onHoverBody ? () => onHoverBody(null) : undefined,
            }
          : {};

        return (
          <g key={b} data-body={b}
            data-selected={isSelected ? "true" : undefined}
            data-highlighted={isHighlighted ? "true" : undefined}
            data-dimmed={isDimmed ? "true" : undefined}
            stroke={col} fill={col}
            opacity={isDimmed ? 0.24 : 1}
            {...handlers}>
            <title>{`${bodyLabel(b)} (end ${formatTick(last.value, step, unit)})`}</title>
            {line(pts).map((d, k) => (
              <path key={k} d={d} fill="none" strokeWidth={isHighlighted ? 2.2 : 1.5} />
            ))}
            {Math.abs(labelY - endY) > 2 && (
              <line x1={endX + 2} y1={endY} x2={m.l + pw + 6} y2={labelY}
                strokeWidth={0.5} opacity={0.55} />
            )}
            <text x={m.l + pw + 8} y={labelY} fontSize={11}
              fontWeight={isHighlighted ? 600 : 400}
              stroke="none" fontFamily={th.fontFamily} dominantBaseline="central">
              {bodyLabel(b)}
            </text>
          </g>
        );
      })}

      {/* moment ticks, over the lines, with labels in dedicated top lane */}
      {visibleMarks.map((mk, idx) => {
        const col = mk.accent ? ac : th.labelText;
        return (
          <g key={`${mk.jd}-${mk.label ?? ""}`} stroke={col} fill={col}>
            <line x1={mk.x} y1={m.t} x2={mk.x} y2={m.t + ph}
              strokeWidth={mk.accent ? 1.1 : 0.75}
              strokeDasharray={mk.accent ? undefined : "2 3"} opacity={0.8} />
            {mk.label && (
              <text x={mk.x} y={markLabelY[idx]} fontSize={9.5} textAnchor="middle"
                stroke="none" fontFamily={th.fontFamily}
                dominantBaseline="central">{mk.label}</text>
            )}
          </g>
        );
      })}

      {/* the scrub cursor */}
      {cursor !== undefined && cursor >= j0 && cursor <= j1 && (
        <line x1={r1(px(cursor))} y1={m.t} x2={r1(px(cursor))} y2={m.t + ph}
          stroke={ac} strokeWidth={1.5} />
      )}
    </svg>
  );
}
