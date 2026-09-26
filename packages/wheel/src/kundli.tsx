/**
 * North and South Indian kundli ( natal diamond / rasi square ), SSR-safe SVG.
 * Same WheelChart input and theme tokens as ChartWheel. No engine dependency.
 *
 * North Indian: houses fixed (house 1 at the top), signs rotate with the
 * Ascendant, planets sit in the house they occupy.
 * South Indian: signs fixed (Pisces top-left, Aries to its right), planets
 * move; Lagna is marked in its sign cell.
 */
import type { ReactElement } from "react";
import { GLYPHS, DARK_THEME, type WheelChart, type WheelTheme } from "./index.js";

const SIGN_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];

const mod = (a: number, n: number) => ((a % n) + n) % n;

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
  return { ...DARK_THEME, ...theme, aspectColors: { ...DARK_THEME.aspectColors, ...theme?.aspectColors } };
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
}

/** House-centre positions in a North Indian diamond, house 1 at the top. */
const NORTH_CENTRE: Array<[number, number]> = [
  [0.50, 0.20], // 1
  [0.80, 0.14], // 2
  [0.86, 0.38], // 3
  [0.80, 0.50], // 4
  [0.86, 0.62], // 5
  [0.80, 0.86], // 6
  [0.50, 0.80], // 7
  [0.20, 0.86], // 8
  [0.14, 0.62], // 9
  [0.20, 0.50], // 10
  [0.14, 0.38], // 11
  [0.20, 0.14], // 12
];

/**
 * South Indian 4×4: corners unused. Top row Pi Ar Ta Ge, right Cn Le Vi,
 * bottom (L→R) Sg Sc Li, wait: bottom is Sg Sc Li Vi-already-on-right.
 * Standard: top Pi(11) Ar(0) Ta(1) Ge(2); right Cn(3) Le(4) Vi(5);
 * bottom (left to right) Sg(8) Sc(7) Li(6); left (top to bottom) Aq(10) Cp(9)
 * — bottom row left-to-right is actually Sg, Sc, Li matching the clockwise signs.
 */
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
}: KundliProps): ReactElement {
  const T = mergeTheme(theme);
  const G = glyphs ?? GLYPHS;
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

  const el: ReactElement[] = [];
  el.push(
    <rect key="sq" x={0} y={0} width={s} height={s} fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} strokeWidth={1.5} />,
    <line key="d1" x1={0} y1={0} x2={s} y2={s} stroke={T.ring} strokeWidth={1} />,
    <line key="d2" x1={s} y1={0} x2={0} y2={s} stroke={T.ring} strokeWidth={1} />,
    <polygon key="dia" points={`${m},0 ${s},${m} ${m},${s} 0,${m}`} fill="none" stroke={T.ring} strokeWidth={1} />,
  );

  for (let h = 1; h <= 12; h++) {
    const [fx, fy] = NORTH_CENTRE[h - 1];
    const x = fx * s;
    const y = fy * s;
    const sign = (lagna + h - 1) % 12;
    el.push(
      <text key={`hn-${h}`} x={x} y={y - s * 0.055} fill={T.houseText} fontSize={s * 0.032}
        textAnchor="middle" fontFamily={T.fontFamily}>{h}</text>,
      <text key={`hs-${h}`} x={x} y={y - s * 0.022} fill={T.signText} fontSize={s * 0.028}
        textAnchor="middle" fontFamily={T.fontFamily}>{SIGN_ABBR[sign]}</text>,
    );
    const list = byHouse[h] ?? [];
    list.forEach((b, i) => {
      const p = chart.bodies[b]!;
      const retro = p.retrograde ?? p.rx ? " ℞" : "";
      const dy = i * s * 0.038;
      el.push(
        <text key={`p-${b}`} data-body={b} x={x} y={y + s * 0.02 + dy}
          fill={T.planetColors?.[b] ?? T.planetText} fontSize={s * 0.042}
          textAnchor="middle" dominantBaseline="central" fontFamily={T.fontFamily}>
          {(G[b] ?? b.slice(0, 2)) + retro}
        </text>,
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
}: KundliProps): ReactElement {
  const T = mergeTheme(theme);
  const G = glyphs ?? GLYPHS;
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

  const el: ReactElement[] = [];
  el.push(
    <rect key="sq" x={0} y={0} width={s} height={s} fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} strokeWidth={1.5} />,
  );
  for (let i = 1; i < 4; i++) {
    el.push(
      <line key={`v-${i}`} x1={i * cell} y1={0} x2={i * cell} y2={s} stroke={T.ring} strokeWidth={1} />,
      <line key={`h-${i}`} x1={0} y1={i * cell} x2={s} y2={i * cell} stroke={T.ring} strokeWidth={1} />,
    );
  }
  // unused corners: fill slightly so the 4×4 reading is obvious
  for (const [c, r] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
    el.push(
      <rect key={`u-${c}-${r}`} x={c * cell} y={r * cell} width={cell} height={cell}
        fill={T.background === "transparent" ? "none" : T.background} stroke={T.ring} opacity={0.35} />,
    );
  }

  for (let si = 0; si < 12; si++) {
    const { col, row } = SOUTH_CELL[si];
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell * 0.22;
    const isLagna = si === lagna;
    el.push(
      <text key={`sg-${si}`} x={col * cell + 6} y={row * cell + 14} fill={T.signText}
        fontSize={s * 0.032} fontFamily={T.fontFamily}>
        {SIGN_ABBR[si]}{isLagna ? " As" : ""}
      </text>,
    );
    if (isLagna) {
      el.push(
        <line key="lagna" x1={col * cell} y1={row * cell} x2={col * cell + cell} y2={row * cell + cell}
          stroke={T.axis} strokeWidth={1.5} />,
      );
    }
    const list = bySign[si] ?? [];
    list.forEach((b, i) => {
      const p = chart.bodies[b]!;
      const retro = p.retrograde ?? p.rx ? " ℞" : "";
      const colN = list.length > 2 ? i % 2 : 0;
      const rowN = list.length > 2 ? Math.floor(i / 2) : i;
      el.push(
        <text key={`p-${b}`} data-body={b}
          x={cx + (colN - 0.5) * cell * 0.28}
          y={cy + 18 + rowN * s * 0.045}
          fill={T.planetColors?.[b] ?? T.planetText} fontSize={s * 0.045}
          textAnchor="middle" dominantBaseline="central" fontFamily={T.fontFamily}>
          {(G[b] ?? b.slice(0, 2)) + retro}
        </text>,
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
