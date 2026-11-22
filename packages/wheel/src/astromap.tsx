/**
 * AstroMap: astrocartography angle lines on an equirectangular world map,
 * SSR-safe SVG with no runtime dependencies. MC and IC are vertical meridians;
 * ASC and DSC are the curved rising/setting tracks, split where they cross the
 * date line. The basemap is a muted graticule with coordinate anchors (no
 * bundled geodata, to stay zero-dependency); pass coastline paths as children
 * to layer a map under the lines.
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

export interface AstroMapObserver {
  lat: number;
  lonEast: number;
  label?: string;
}

export interface AstroMapProps {
  lines: Record<string, MapLines>;
  width?: number;
  height?: number;
  /** Which angle lines to draw (default all four). */
  show?: AngleKind[];
  /** Per-body line colour; falls back to a color-blind-safe default palette. */
  colors?: Record<string, string>;
  graticule?: boolean;
  /** Optional observer pin drawn as a precision crosshair with direct label. */
  observer?: AstroMapObserver;
  theme?: Partial<WheelTheme>;
  children?: React.ReactNode;
  /** Currently selected body id for linked cross-highlighting. */
  selectedBody?: string | null;
  /** Currently hovered body id for linked cross-highlighting. */
  hoveredBody?: string | null;
  /** Called when a body's tracks or label are clicked. */
  onSelectBody?: (body: string | null) => void;
  /** Called when pointer/focus enters or leaves a body's tracks or label. */
  onHoverBody?: (body: string | null) => void;
}

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
const ALL: AngleKind[] = ["mc", "ic", "asc", "dsc"];

const bodyLabel = (b: string): string =>
  b.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const r1 = (n: number): number => Math.round(n * 10) / 10;

export function AstroMap({
  lines,
  width = 720,
  height = 360,
  show = ALL,
  colors,
  graticule = true,
  observer,
  theme,
  children,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: AstroMapProps) {
  const th: WheelTheme = { ...DARK_THEME, ...theme };
  const ringMinor = th.ringMinor ?? th.ring;
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

  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);

  // MC labels crowd into an unreadable run where meridians sit close in
  // longitude. Pack them into staggered rows so every "<Body> MC" tag stays legible.
  const mcLabels = show.includes("mc")
    ? Object.keys(lines)
        .map((body, i) => ({
          body,
          display: `${bodyLabel(body)} MC`,
          x: px(lines[body].mc),
          col: colorOf(body, i),
        }))
        .sort((a, b) => a.x - b.x)
    : [];
  const rowEnds: number[] = [];
  const placedLabels = mcLabels.map((l) => {
    const w = l.display.length * 6.4 + 4;
    const xClamped = Math.max(2, Math.min(width - w - 2, l.x + 2));
    let row = 0;
    while (row < rowEnds.length && rowEnds[row] > xClamped - 4) row++;
    rowEnds[row] = xClamped + w;
    return { ...l, lx: xClamped, y: 12 + row * 13, w };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Astrocartography map"
      style={{ background: th.background, display: "block" }}>
      {th.background !== "transparent" && (
        <rect x={0} y={0} width={width} height={height} fill={th.background} />
      )}
      {children}
      {graticule && (
        <g>
          <g stroke={ringMinor} strokeWidth={0.5} fill="none" opacity={0.35}>
            {[-120, -60, 0, 60, 120].map((lon) => (
              <line key={`m${lon}`} x1={r1(px(lon))} y1={0} x2={r1(px(lon))} y2={height}
                strokeWidth={lon === 0 ? 0.75 : 0.5} opacity={lon === 0 ? 0.55 : 0.35} />
            ))}
            {[-60, -30, 0, 30, 60].map((lat) => (
              <line key={`p${lat}`} x1={0} y1={r1(py(lat))} x2={width} y2={r1(py(lat))}
                strokeWidth={lat === 0 ? 0.9 : 0.5} opacity={lat === 0 ? 0.65 : 0.35} />
            ))}
          </g>
          <g fontFamily={th.fontFamily} fontSize={9} fill={th.houseText} opacity={0.75}>
            {[-60, -30, 0, 30, 60].map((lat) => (
              <text key={`pl${lat}`} x={4} y={r1(py(lat) - 3)}>
                {lat === 0 ? "0° Eq" : lat > 0 ? `${lat}°N` : `${-lat}°S`}
              </text>
            ))}
            {[-120, -60, 0, 60, 120].map((lon) => (
              <text key={`ml${lon}`} x={r1(px(lon))} y={height - 4} textAnchor="middle">
                {lon === 0 ? "0°" : lon > 0 ? `${lon}°E` : `${-lon}°W`}
              </text>
            ))}
          </g>
        </g>
      )}

      {Object.keys(lines).map((body, i) => {
        const L = lines[body];
        const col = colorOf(body, i);
        const isSelected = selectedBody === body;
        const isHighlighted = activeBody === body;
        const isDimmed = activeBody !== null && !isHighlighted;
        const sw = isHighlighted ? 2.2 : 1.45;
        const handlers = interactive
          ? {
              style: { cursor: onSelectBody ? "pointer" : undefined },
              onClick: onSelectBody ? () => onSelectBody(selectedBody === body ? null : body) : undefined,
              onMouseEnter: onHoverBody ? () => onHoverBody(body) : undefined,
              onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
            }
          : {};

        return (
          <g key={body} data-body={body}
            data-selected={isSelected ? "true" : undefined}
            data-highlighted={isHighlighted ? "true" : undefined}
            data-dimmed={isDimmed ? "true" : undefined}
            stroke={col} fill={col} strokeWidth={sw}
            opacity={isDimmed ? 0.2 : 1}
            {...handlers}>
            <title>{`${bodyLabel(body)} · MC ${L.mc.toFixed(1)}° · IC ${L.ic.toFixed(1)}°`}</title>
            {show.includes("mc") && (
              <line x1={r1(px(L.mc))} y1={0} x2={r1(px(L.mc))} y2={height} />
            )}
            {show.includes("ic") && (
              <line x1={r1(px(L.ic))} y1={0} x2={r1(px(L.ic))} y2={height}
                strokeDasharray="4 3" opacity={0.78} />
            )}
            {show.includes("asc") && track(L.asc).map((d, k) => (
              <path key={`a${k}`} d={d} fill="none" />
            ))}
            {show.includes("dsc") && track(L.dsc).map((d, k) => (
              <path key={`d${k}`} d={d} fill="none" strokeDasharray="4 3" opacity={0.78} />
            ))}
          </g>
        );
      })}

      {/* optional observer crosshair */}
      {observer && (
        <g data-observer="true">
          <line x1={r1(px(observer.lonEast) - 6)} y1={r1(py(observer.lat))}
            x2={r1(px(observer.lonEast) + 6)} y2={r1(py(observer.lat))}
            stroke={th.axis} strokeWidth={1.25} />
          <line x1={r1(px(observer.lonEast))} y1={r1(py(observer.lat) - 6)}
            x2={r1(px(observer.lonEast))} y2={r1(py(observer.lat) + 6)}
            stroke={th.axis} strokeWidth={1.25} />
          <circle cx={r1(px(observer.lonEast))} cy={r1(py(observer.lat))} r={3}
            fill="none" stroke={th.axis} strokeWidth={1.25} />
          {observer.label && (
            <text x={r1(px(observer.lonEast) + 8)} y={r1(py(observer.lat) + 3)}
              fontFamily={th.fontFamily} fontSize={10} fontWeight={600} fill={th.planetText}>
              {observer.label}
            </text>
          )}
        </g>
      )}

      {/* MC labels last, staggered into rows so close meridians stay legible */}
      <g fontFamily={th.fontFamily} fontSize={10.5}>
        {placedLabels.map((l) => {
          const isHighlighted = activeBody === l.body;
          const isDimmed = activeBody !== null && !isHighlighted;
          const handlers = interactive
            ? {
                style: { cursor: onSelectBody ? "pointer" : undefined },
                onClick: onSelectBody ? () => onSelectBody(selectedBody === l.body ? null : l.body) : undefined,
                onMouseEnter: onHoverBody ? () => onHoverBody(l.body) : undefined,
                onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
              }
            : {};
          return (
            <g key={l.body} opacity={isDimmed ? 0.25 : 1} {...handlers}>
              <text x={r1(l.lx)} y={r1(l.y)} fill={l.col} fontWeight={isHighlighted ? 600 : 400} stroke="none">
                {l.display}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
