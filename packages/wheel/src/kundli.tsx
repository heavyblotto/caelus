/**
 * North and South Indian kundli (natal diamond / rasi square), SSR-safe SVG.
 * Same WheelChart input, theme tokens, and interactive selection props as
 * ChartWheel. Zero runtime dependencies.
 *
 * North Indian: houses fixed (house 1 at the top), signs rotate with the
 * Ascendant, planets sit in the house they occupy.
 * South Indian: signs fixed (Pisces top-left, Aries to its right), planets
 * move; Lagna is marked in its sign cell.
 */
import type { ReactElement } from "react";
import { GLYPHS, DARK_THEME, type WheelChart, type WheelTheme } from "./index.js";

const SIGN_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];
const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const mod = (a: number, n: number) => ((a % n) + n) % n;
const r2 = (n: number) => Math.round(n * 100) / 100;
const bodyTitle = (b: string): string =>
  b.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function houseOf(cusps: number[], lon: number): number {
  for (let i = 0; i < 12; i++) {
    if (mod(lon - cusps[i], 360) < mod(cusps[(i + 1) % 12] - cusps[i], 360)) return i + 1;
  }
  return 12;
}

function signOf(lon: number): number {
  return Math.floor(mod(lon, 360) / 30) % 12;
}

function mergeTheme(theme?: Partial<WheelTheme>): WheelTheme {
  return {
    ...DARK_THEME,
    ...theme,
    aspectColors: { ...DARK_THEME.aspectColors, ...theme?.aspectColors },
    planetColors: { ...(DARK_THEME.planetColors ?? {}), ...(theme?.planetColors ?? {}) },
  };
}

function drawnBodies(chart: WheelChart, bodies?: string[]): string[] {
  const ids = bodies ?? Object.keys(chart.bodies).filter((b) => b !== "mean_node");
  return ids.filter((b) => chart.bodies[b]);
}

export interface KundliProps {
  chart: WheelChart;
  size?: number;
  theme?: Partial<WheelTheme>;
  bodies?: string[];
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

/** House-centre positions in a North Indian diamond, house 1 at the top. */
const NORTH_CENTRE: Array<[number, number]> = [
  [0.50, 0.22], // 1 (diamond)
  [0.75, 0.10], // 2 (top-right triangle)
  [0.90, 0.25], // 3 (right-top triangle)
  [0.76, 0.50], // 4 (diamond)
  [0.90, 0.75], // 5 (right-bottom triangle)
  [0.75, 0.90], // 6 (bottom-right triangle)
  [0.50, 0.78], // 7 (diamond)
  [0.25, 0.90], // 8 (bottom-left triangle)
  [0.10, 0.75], // 9 (left-bottom triangle)
  [0.24, 0.50], // 10 (diamond)
  [0.10, 0.25], // 11 (left-top triangle)
  [0.25, 0.10], // 12 (top-left triangle)
];

const SOUTH_CELL: Array<{ col: number; row: number }> = [
  { col: 1, row: 0 }, // Aries
  { col: 2, row: 0 }, // Taurus
  { col: 3, row: 0 }, // Gemini
  { col: 3, row: 1 }, // Cancer
  { col: 3, row: 2 }, // Leo
  { col: 3, row: 3 }, // Virgo
  { col: 2, row: 3 }, // Libra
  { col: 1, row: 3 }, // Scorpio
  { col: 0, row: 3 }, // Sagittarius
  { col: 0, row: 2 }, // Capricorn
  { col: 0, row: 1 }, // Aquarius
  { col: 0, row: 0 }, // Pisces
];

export function NorthIndianKundli({
  chart, size = 420, theme, bodies, glyphs,
  selectedBody, hoveredBody, onSelectBody, onHoverBody,
}: KundliProps): ReactElement {
  const T = mergeTheme(theme);
  const G = { ...GLYPHS, ...glyphs };
  const s = size;
  const m = s / 2;
  const ids = drawnBodies(chart, bodies);
  const lagna = signOf(chart.angles.asc);
  const byHouse: Record<number, string[]> = {};
  for (const b of ids) {
    const p = chart.bodies[b]!;
    const h = houseOf(chart.cusps, p.lon);
    (byHouse[h] ??= []).push(b);
  }

  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);

  const el: ReactElement[] = [];
  el.push(
    <rect key="sq" x={0.75} y={0.75} width={s - 1.5} height={s - 1.5}
      fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} strokeWidth={1.5} />,
    <line key="d1" x1={0} y1={0} x2={s} y2={s} stroke={T.ring} strokeWidth={1} />,
    <line key="d2" x1={s} y1={0} x2={0} y2={s} stroke={T.ring} strokeWidth={1} />,
    <polygon key="dia" points={`${m},0 ${s},${m} ${m},${s} 0,${m}`} fill="none" stroke={T.ring} strokeWidth={1} />,
    // Subtle Lagna (House 1) apex accent mark
    <polyline key="lagna-mark" points={`${r2(m - s * 0.04)},${r2(s * 0.04)} ${m},0 ${r2(m + s * 0.04)},${r2(s * 0.04)}`}
      fill="none" stroke={T.axis} strokeWidth={1.75} />,
  );

  for (let h = 1; h <= 12; h++) {
    const [fx, fy] = NORTH_CENTRE[h - 1];
    const x = fx * s;
    const y = fy * s;
    const sign = (lagna + h - 1) % 12;
    const isLagna = h === 1;
    el.push(
      <text key={`hs-${h}`} x={r2(x)} y={r2(y - s * 0.048)} fill={isLagna ? T.axis : T.signText}
        fontSize={s * 0.027} fontWeight={isLagna ? 600 : 400}
        textAnchor="middle" fontFamily={T.fontFamily}>
        {`${h} ${SIGN_ABBR[sign]}${isLagna ? " As" : ""}`}
      </text>,
    );
    const list = byHouse[h] ?? [];
    const cols = list.length >= 3 ? 2 : 1;
    const colGap = s * 0.072;
    const rowGap = s * 0.042;
    list.forEach((b, i) => {
      const p = chart.bodies[b]!;
      const signDeg = p.signDeg ?? mod(p.lon, 30);
      const retro = (p.retrograde ?? p.rx) ? "℞" : "";
      const col = cols === 2 ? i % 2 : 0;
      const row = cols === 2 ? Math.floor(i / 2) : i;
      const px = x + (cols === 2 ? (col - 0.5) * colGap : 0);
      const py = y - s * 0.004 + row * rowGap;
      const isSelected = selectedBody === b;
      const isHovered = hoveredBody === b;
      const isHighlighted = isSelected || isHovered;
      const isDimmed = activeBody !== null && !isHighlighted;
      const pColor = T.planetColors?.[b] ?? T.planetText;
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
      el.push(
        <g key={`p-${b}`} data-body={b}
          data-selected={isSelected ? "true" : undefined}
          data-highlighted={isHighlighted ? "true" : undefined}
          data-dimmed={isDimmed ? "true" : undefined}
          opacity={isDimmed ? 0.3 : 1}
          {...handlers}>
          <title>{`${bodyTitle(b)} · ${Math.floor(signDeg)}° ${SIGN_NAMES[signOf(p.lon)]} (House ${h})${retro ? " retrograde" : ""}`}</title>
          {isHighlighted && (
            <circle cx={r2(px)} cy={r2(py)} r={r2(s * 0.03)} fill="none" stroke={T.axis} strokeWidth={1.25} />
          )}
          <text x={r2(px)} y={r2(py)}
            fill={pColor} fontSize={s * 0.04}
            textAnchor="middle" dominantBaseline="central" fontFamily={T.fontFamily}>
            {(G[b] ?? b.slice(0, 2)) + retro}
          </text>
        </g>,
      );
    });
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      role="img" aria-label="North Indian kundli"
      style={{ background: T.background, display: "block" }}>
      {el}
    </svg>
  );
}

export function SouthIndianKundli({
  chart, size = 420, theme, bodies, glyphs,
  selectedBody, hoveredBody, onSelectBody, onHoverBody,
}: KundliProps): ReactElement {
  const T = mergeTheme(theme);
  const G = { ...GLYPHS, ...glyphs };
  const s = size;
  const cell = s / 4;
  const ids = drawnBodies(chart, bodies);
  const lagna = signOf(chart.angles.asc);
  const bySign: Record<number, string[]> = {};
  for (const b of ids) {
    const p = chart.bodies[b]!;
    const si = signOf(p.lon);
    (bySign[si] ??= []).push(b);
  }

  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);

  const el: ReactElement[] = [];
  el.push(
    <rect key="sq" x={0.75} y={0.75} width={s - 1.5} height={s - 1.5}
      fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} strokeWidth={1.5} />,
  );
  for (let i = 1; i < 4; i++) {
    el.push(
      <line key={`v-${i}`} x1={r2(i * cell)} y1={0} x2={r2(i * cell)} y2={s} stroke={T.ring} strokeWidth={1} />,
      <line key={`h-${i}`} x1={0} y1={r2(i * cell)} x2={s} y2={r2(i * cell)} stroke={T.ring} strokeWidth={1} />,
    );
  }
  // Open center 2x2 void (traditional South Indian rasi layout)
  el.push(
    <rect key="center-void" x={r2(cell)} y={r2(cell)} width={r2(cell * 2)} height={r2(cell * 2)}
      fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} strokeWidth={1} />,
    <text key="center-label" x={r2(s / 2)} y={r2(s / 2)} fill={T.houseText} fontSize={s * 0.028}
      textAnchor="middle" dominantBaseline="central" fontFamily={T.fontFamily}>
      RASI
    </text>,
  );

  for (let si = 0; si < 12; si++) {
    const { col, row } = SOUTH_CELL[si];
    const x0 = col * cell;
    const y0 = row * cell;
    const isLagna = si === lagna;
    el.push(
      <text key={`sg-${si}`} x={r2(x0 + 6)} y={r2(y0 + 14)} fill={isLagna ? T.axis : T.signText}
        fontSize={s * 0.029} fontWeight={isLagna ? 600 : 400} fontFamily={T.fontFamily}>
        {SIGN_ABBR[si]}{isLagna ? " As" : ""}
      </text>,
    );
    if (isLagna) {
      // Traditional double corner slash marking Lagna without slicing through planets
      el.push(
        <line key="lagna-1" x1={r2(x0 + cell - 18)} y1={r2(y0)} x2={r2(x0 + cell)} y2={r2(y0 + 18)}
          stroke={T.axis} strokeWidth={1.5} />,
        <line key="lagna-2" x1={r2(x0 + cell - 11)} y1={r2(y0)} x2={r2(x0 + cell)} y2={r2(y0 + 11)}
          stroke={T.axis} strokeWidth={1} />,
      );
    }
    const list = bySign[si] ?? [];
    const cols = list.length > 2 ? 2 : 1;
    list.forEach((b, i) => {
      const p = chart.bodies[b]!;
      const signDeg = p.signDeg ?? mod(p.lon, 30);
      const retro = (p.retrograde ?? p.rx) ? "℞" : "";
      const colN = cols === 2 ? i % 2 : 0;
      const rowN = cols === 2 ? Math.floor(i / 2) : i;
      const px = x0 + (cols === 2 ? cell * (colN === 0 ? 0.3 : 0.72) : cell * 0.5);
      const py = y0 + cell * 0.42 + rowN * s * 0.048;
      const isSelected = selectedBody === b;
      const isHovered = hoveredBody === b;
      const isHighlighted = isSelected || isHovered;
      const isDimmed = activeBody !== null && !isHighlighted;
      const pColor = T.planetColors?.[b] ?? T.planetText;
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
      el.push(
        <g key={`p-${b}`} data-body={b}
          data-selected={isSelected ? "true" : undefined}
          data-highlighted={isHighlighted ? "true" : undefined}
          data-dimmed={isDimmed ? "true" : undefined}
          opacity={isDimmed ? 0.3 : 1}
          {...handlers}>
          <title>{`${bodyTitle(b)} · ${Math.floor(signDeg)}° ${SIGN_NAMES[si]}${retro ? " retrograde" : ""}`}</title>
          {isHighlighted && (
            <circle cx={r2(px)} cy={r2(py)} r={r2(s * 0.032)} fill="none" stroke={T.axis} strokeWidth={1.25} />
          )}
          <text x={r2(px)} y={r2(py)}
            fill={pColor} fontSize={s * 0.042}
            textAnchor="middle" dominantBaseline="central" fontFamily={T.fontFamily}>
            {(G[b] ?? b.slice(0, 2)) + retro}
          </text>
        </g>,
      );
    });
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      role="img" aria-label="South Indian kundli"
      style={{ background: T.background, display: "block" }}>
      {el}
    </svg>
  );
}

export type KundliStyle = "north" | "south";

export function Kundli({
  layout = "north", ...rest
}: KundliProps & { layout?: KundliStyle }): ReactElement {
  return layout === "south"
    ? <SouthIndianKundli {...rest} />
    : <NorthIndianKundli {...rest} />;
}
