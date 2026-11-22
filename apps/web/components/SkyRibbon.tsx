/**
 * The current sky as an ecliptic ribbon, computed at render time from the
 * engine (the core does no I/O, so this is cheap and deterministic per load).
 * Glyphs sit at the real apparent longitudes for the given chart or "now" in UT.
 * Pure Workbench precision geometry: zero gradients, crisp 10/30 deg ticks,
 * range-frame degree anchors, and optional linked body selection/hover.
 */
import { Engine, BODIES, SIGNS, fmtLon, type Body, type Chart } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { GLYPHS } from "caelus-wheel";
import { WHEEL_PLANET_COLORS } from "../lib/wheelTheme";

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const W = 760;
const H = 122;
const PAD_X = 14;
const TRACK_W = W - PAD_X * 2;
const ECLIPTIC_Y = 82;
// nodes share a glyph; drawing both doubles it, so skip mean_node like the wheel
const SHOWN = BODIES.filter((b) => b !== "mean_node");

/** "true_node" -> "True node" for hover tooltips. */
const label = (body: string) =>
  body.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

type Placed = {
  body: Body;
  lon: number;
  retro: boolean;
  x: number;
  y: number;
};

function place(items: Array<{ body: Body; lon: number; retro: boolean }>): Placed[] {
  const sorted = [...items].sort((a, b) => a.lon - b.lon);
  const out: Placed[] = [];
  let lastX = -Infinity;
  let row = 0;
  for (const { body, lon, retro } of sorted) {
    const x = PAD_X + (lon / 360) * TRACK_W;
    if (x - lastX < 28) row = (row + 1) % 3;
    else row = 0;
    lastX = x;
    out.push({ body, lon, retro, x, y: ECLIPTIC_Y - 22 - row * 22 });
  }
  return out;
}

export interface SkyRibbonProps {
  chart?: Chart;
  stamp?: string;
  selectedBody?: string | null;
  hoveredBody?: string | null;
  onSelectBody?: (body: string | null) => void;
  onHoverBody?: (body: string | null) => void;
}

export default function SkyRibbon({
  chart: given,
  stamp: givenStamp,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
}: SkyRibbonProps = {}) {
  const now = new Date();
  const chart = given ?? new Engine(embeddedData).chart(
    now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
    now.getUTCHours(), now.getUTCMinutes(), 0, 0, 0, "whole_sign",
  );
  const placed = place(SHOWN.flatMap((body) => {
    const p = chart.bodies[body];
    return p ? [{ body, lon: p.lon, retro: !!p.retrograde }] : [];
  }));
  const sunLon = chart.bodies.sun ? fmtLon(chart.bodies.sun.lon) : "";
  const moonLon = chart.bodies.moon ? fmtLon(chart.bodies.moon.lon) : "";
  const stamp = givenStamp
    ?? `sky now · ${now.toISOString().slice(0, 16).replace("T", " ")} UT · sun ${sunLon} · moon ${moonLon}`;

  const activeBody = hoveredBody ?? selectedBody ?? null;
  const interactive = Boolean(onSelectBody || onHoverBody);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <figure className="sky-ribbon" aria-label="The current sky, computed by the engine">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Current planetary longitudes along the 360 degree ecliptic">
        {/* 10-degree decan micro-ticks */}
        {Array.from({ length: 37 }, (_, k) => {
          const x = r1(PAD_X + (k / 36) * TRACK_W);
          const isSign = k % 3 === 0;
          return (
            <line
              key={`tk-${k}`}
              x1={x}
              y1={isSign ? ECLIPTIC_Y - 6 : ECLIPTIC_Y - 3}
              x2={x}
              y2={isSign ? ECLIPTIC_Y + 6 : ECLIPTIC_Y + 3}
              stroke={isSign ? "var(--wheel-ring, var(--line2))" : "var(--wheel-ring-minor, var(--line))"}
              strokeWidth={isSign ? 1 : 0.6}
            />
          );
        })}

        {/* Sign dividers and glyphs */}
        {SIGNS.map((sign, i) => {
          const x = PAD_X + (i / 12) * TRACK_W;
          return (
            <g key={sign}>
              <title>{sign}</title>
              <text
                x={r1(x + TRACK_W / 24)}
                y={ECLIPTIC_Y + 22}
                textAnchor="middle"
                fontSize="15"
                fill="var(--wheel-sign, var(--dim))"
              >
                {SIGN_GLYPHS[i]}
              </text>
            </g>
          );
        })}

        {/* Range-frame longitude degree anchors */}
        {[0, 90, 180, 270, 360].map((deg) => (
          <text
            key={`deg-${deg}`}
            x={r1(PAD_X + (deg / 360) * TRACK_W)}
            y={H - 3}
            textAnchor={deg === 0 ? "start" : deg === 360 ? "end" : "middle"}
            fontSize="10"
            fontFamily="var(--mono, monospace)"
            fill="var(--faint)"
          >
            {`${deg}°`}
          </text>
        ))}

        {/* Clean solid ecliptic axis (zero gradients) */}
        <line
          x1={PAD_X}
          y1={ECLIPTIC_Y}
          x2={PAD_X + TRACK_W}
          y2={ECLIPTIC_Y}
          stroke="var(--wheel-ecliptic, var(--accent))"
          strokeWidth="1.5"
        />

        {/* Planet stems, dots, and glyphs */}
        {placed.map(({ body, lon, retro, x, y }) => {
          const isSelected = selectedBody === body;
          const isHovered = hoveredBody === body;
          const isHighlighted = isSelected || isHovered;
          const isDimmed = activeBody !== null && !isHighlighted;
          const color = WHEEL_PLANET_COLORS[body] ?? "var(--text)";
          const handlers = interactive
            ? {
                role: onSelectBody ? ("button" as const) : undefined,
                tabIndex: onSelectBody ? 0 : undefined,
                style: { cursor: onSelectBody ? "pointer" : undefined },
                onClick: onSelectBody ? () => onSelectBody(selectedBody === body ? null : body) : undefined,
                onMouseEnter: onHoverBody ? () => onHoverBody(body) : undefined,
                onMouseLeave: onHoverBody ? () => onHoverBody(null) : undefined,
                onFocus: onHoverBody ? () => onHoverBody(body) : undefined,
                onBlur: onHoverBody ? () => onHoverBody(null) : undefined,
              }
            : {};

          return (
            <g
              key={body}
              data-body={body}
              data-selected={isSelected ? "true" : undefined}
              data-highlighted={isHighlighted ? "true" : undefined}
              data-dimmed={isDimmed ? "true" : undefined}
              opacity={isDimmed ? 0.3 : 1}
              {...handlers}
            >
              <title>{`${label(body)} · ${fmtLon(lon)}${retro ? " (retrograde)" : ""}`}</title>
              <line
                x1={r1(x)}
                y1={ECLIPTIC_Y}
                x2={r1(x)}
                y2={r1(y + 10)}
                stroke={isHighlighted ? "var(--accent)" : "var(--wheel-ring, var(--line2))"}
                strokeWidth={isHighlighted ? 1.25 : 0.75}
                opacity={isHighlighted ? 1 : 0.8}
              />
              <circle
                cx={r1(x)}
                cy={ECLIPTIC_Y}
                r={isHighlighted ? 3.2 : 2.2}
                fill={isHighlighted ? "var(--accent)" : "var(--warm)"}
              />
              {isHighlighted && (
                <circle
                  cx={r1(x)}
                  cy={r1(y - 2)}
                  r={11.5}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.25"
                />
              )}
              <text
                x={r1(x)}
                y={r1(y + 2)}
                textAnchor="middle"
                fontSize="18"
                fill={color}
              >
                {GLYPHS[body] ?? body.slice(0, 2)}
              </text>
              {retro && (
                <text
                  x={r1(x + 10)}
                  y={r1(y - 5)}
                  textAnchor="start"
                  fontSize="9"
                  fontFamily="var(--mono, monospace)"
                  fill="var(--wheel-label, var(--dim))"
                >
                  ℞
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="eyebrow sky-ribbon__cap">
        {stamp}
      </figcaption>
    </figure>
  );
}
