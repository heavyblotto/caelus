/**
 * AstroMap: astrocartography angle lines on an equirectangular world map,
 * SSR-safe SVG with no runtime dependencies. MC and IC are vertical meridians;
 * ASC and DSC are the curved rising/setting tracks, split where they cross the
 * date line. The basemap is a graticule only (no bundled geodata, to stay
 * zero-dependency); pass your own coastline paths as children to layer a map
 * under the lines.
 *
 * Feed it the output of the caelus engine's `astrocartography(...)`.
 */
import { DARK_THEME, type WheelTheme } from "./index.js";

/** One body's four angle lines (matches the engine's AngleLines). */
export interface MapLines {
  mc: number;
  ic: number;
  asc: [number, number][];
  dsc: [number, number][];
}

export type AngleKind = "mc" | "ic" | "asc" | "dsc";

export interface AstroMapProps {
  lines: Record<string, MapLines>;
  width?: number;
  height?: number;
  /** Which angle lines to draw (default all four). */
  show?: AngleKind[];
  /** Per-body line colour; falls back to a default palette. */
  colors?: Record<string, string>;
  graticule?: boolean;
  theme?: Partial<WheelTheme>;
  children?: React.ReactNode;
}

const DEFAULT_COLORS: Record<string, string> = {
  sun: "#e0b020", moon: "#c8c8d0", mercury: "#9a93c4", venus: "#4fb09a",
  mars: "#c0564f", jupiter: "#c08a4f", saturn: "#8d8a99",
  uranus: "#4f8fc0", neptune: "#5a6fc0", pluto: "#a05a8a", chiron: "#7a9a5a",
};
const PALETTE = ["#8a7fd4", "#c0564f", "#4f8fc0", "#4fb09a", "#c08a4f", "#a05a8a"];
const ALL: AngleKind[] = ["mc", "ic", "asc", "dsc"];

export function AstroMap({
  lines, width = 720, height = 360, show = ALL, colors, graticule = true,
  theme, children,
}: AstroMapProps) {
  const th: WheelTheme = { ...DARK_THEME, ...theme };
  const px = (lon: number): number => ((lon + 180) / 360) * width;
  const py = (lat: number): number => ((90 - lat) / 180) * height;

  // ASC/DSC polyline, broken at the date-line wrap.
  const track = (pts: [number, number][]): string[] => {
    const segs: string[] = [];
    let cur: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [lon, lat] = pts[i];
      if (i > 0 && Math.abs(lon - pts[i - 1][0]) > 180) {
        if (cur.length > 1) segs.push("M" + cur.join(" L"));
        cur = [];
      }
      cur.push(`${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`);
    }
    if (cur.length > 1) segs.push("M" + cur.join(" L"));
    return segs;
  };

  const colorOf = (body: string, i: number): string =>
    colors?.[body] ?? DEFAULT_COLORS[body] ?? PALETTE[i % PALETTE.length];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Astrocartography map">
      <rect x={0} y={0} width={width} height={height} fill={th.background} />
      {children}
      {graticule && (
        <g stroke={th.ring} strokeWidth={0.5} fill="none" opacity={0.5}>
          {[-120, -60, 0, 60, 120].map((lon) => (
            <line key={`m${lon}`} x1={px(lon)} y1={0} x2={px(lon)} y2={height} />
          ))}
          {[-60, -30, 0, 30, 60].map((lat) => (
            <line key={`p${lat}`} x1={0} y1={py(lat)} x2={width} y2={py(lat)}
              strokeWidth={lat === 0 ? 1 : 0.5} opacity={lat === 0 ? 0.9 : 0.5} />
          ))}
        </g>
      )}

      {Object.keys(lines).map((body, i) => {
        const L = lines[body];
        const col = colorOf(body, i);
        return (
          <g key={body} stroke={col} fill={col} strokeWidth={1.5}>
            {show.includes("mc") && (
              <>
                <line x1={px(L.mc)} y1={0} x2={px(L.mc)} y2={height} />
                <text x={px(L.mc) + 2} y={12} fontSize={11} stroke="none"
                  fontFamily={th.fontFamily}>{body} MC</text>
              </>
            )}
            {show.includes("ic") && (
              <line x1={px(L.ic)} y1={0} x2={px(L.ic)} y2={height}
                strokeDasharray="4 3" opacity={0.8} />
            )}
            {show.includes("asc") && track(L.asc).map((d, k) => (
              <path key={`a${k}`} d={d} fill="none" />
            ))}
            {show.includes("dsc") && track(L.dsc).map((d, k) => (
              <path key={`d${k}`} d={d} fill="none" strokeDasharray="4 3" opacity={0.8} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
