/**
 * caelus-wheel — React SVG chart wheel.
 *
 * Pure render, SSR-safe (no client-only APIs, no hooks, no effects).
 * Zero runtime dependencies; react is a peer.
 *
 * Orientation follows Western convention: ASC at 9 o'clock, zodiac
 * counterclockwise. Glyphs are Unicode astrological characters embedded as
 * SVG text — if a host font lacks one, the two-letter fallback in GLYPHS
 * can be substituted via the `glyphs` prop.
 */
import type { ReactElement } from "react";

// minimal structural types: accept the caelus Chart object — or a caelus-mcp
// natal_chart / current_sky payload — as-is, without a runtime dependency on
// the engine. The MCP payload flags retrograde as `rx` and omits `signDeg`
// (derived from lon when absent).
export interface WheelPosition {
  lon: number;
  retrograde?: boolean;
  rx?: boolean;
  signDeg?: number;
}
export interface WheelAspect { a: string; b: string; aspect: string; orb: number }
export interface WheelChart {
  // A body may be absent (e.g. Chiron outside its fitted range on a historical
  // chart); the component filters these out before reading them.
  bodies: Record<string, WheelPosition | undefined>;
  angles: { asc: number; mc: number };
  cusps: number[];
  aspects: WheelAspect[];
}

export interface WheelTheme {
  background: string;
  ring: string;
  axis: string;
  signText: string;
  planetText: string;
  /** Optional per-body glyph color, keyed by body name ("sun","moon","mars",…).
   *  Falls back to planetText for any body not listed. */
  planetColors?: Record<string, string>;
  labelText: string;
  houseText: string;
  aspectColors: Record<string, string>;
  fontFamily: string;
}

export const DARK_THEME: WheelTheme = {
  background: "transparent",
  ring: "#3a3a44",
  axis: "#8a7fd4",
  signText: "#9a93c4",
  planetText: "#e8e6f0",
  labelText: "#8d8a99",
  houseText: "#6a6775",
  aspectColors: {
    conjunction: "#b8b4c8",
    opposition: "#c0564f",
    square: "#c0564f",
    trine: "#4f8fc0",
    sextile: "#4fb09a",
  },
  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

/**
 * The Encyclopedia's plate palette: warm paper, ink, and the oxblood
 * accent. Oxblood is the single interaction channel (the reader's
 * current place, the highlighted element); nothing in the base theme
 * uses it, so it keeps one meaning. Widget layers read it from here.
 */
export const PLATE_TOKENS = {
  /** Page paper. */
  paper: "#f7f3e9",
  /** Plate panel paper (figures sit on this). */
  panel: "#fdfbf5",
  /** Full ink. */
  ink: "#22201c",
  /** Secondary ink: labels, soft aspects. */
  mutedInk: "#6f695c",
  /** Tertiary ink: house numbers, de-emphasized furniture. */
  faintInk: "#9a927f",
  /** Hairline structural rules. */
  rule: "#c9c1af",
  /** Oxblood: the one interaction accent. */
  accent: "#8c2f2a",
} as const;

/**
 * Ink-on-paper theme for the Encyclopedia's figure plates. Glyphs and
 * axes take full ink; sign and house furniture recede into muted inks;
 * hard aspects carry full ink and soft aspects the secondary ink (the
 * engraving convention: weight, not hue). `planetColors` names all
 * thirteen default bodies explicitly so the theme is complete on its
 * own — merging it can never strand a body on another palette.
 */
export const PLATE_THEME: WheelTheme = {
  background: "transparent",
  ring: PLATE_TOKENS.rule,
  axis: PLATE_TOKENS.ink,
  signText: "#8a8272",
  planetText: PLATE_TOKENS.ink,
  planetColors: {
    sun: PLATE_TOKENS.ink, moon: PLATE_TOKENS.ink,
    mercury: PLATE_TOKENS.ink, venus: PLATE_TOKENS.ink,
    mars: PLATE_TOKENS.ink, jupiter: PLATE_TOKENS.ink,
    saturn: PLATE_TOKENS.ink, uranus: PLATE_TOKENS.ink,
    neptune: PLATE_TOKENS.ink, pluto: PLATE_TOKENS.ink,
    chiron: PLATE_TOKENS.ink,
    true_node: PLATE_TOKENS.mutedInk, mean_node: PLATE_TOKENS.mutedInk,
  },
  labelText: PLATE_TOKENS.mutedInk,
  houseText: PLATE_TOKENS.faintInk,
  aspectColors: {
    conjunction: PLATE_TOKENS.ink,
    opposition: PLATE_TOKENS.ink,
    square: PLATE_TOKENS.ink,
    trine: PLATE_TOKENS.mutedInk,
    sextile: PLATE_TOKENS.mutedInk,
  },
  fontFamily: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

/**
 * Per-body line inks for the drawing components (AstroMap,
 * EphemerisGraph), where many bodies draw at once and identical inks
 * would be unreadable. Muted earth tints — an engraver's tinted inks —
 * low-chroma so a plate still reads as ink at a glance, each dark
 * enough for the panel paper. Mars is deliberately not oxblood
 * (`PLATE_TOKENS.accent` keeps its one meaning). Pass as the `colors`
 * prop; complete over the thirteen default bodies plus the nodes.
 */
export const PLATE_BODY_INKS: Record<string, string> = {
  sun: "#8a6a1c", moon: "#6e6a5e", mercury: "#5b5370", venus: "#3f6d5a",
  mars: "#6d3524", jupiter: "#6b4f23", saturn: "#4a453c",
  uranus: "#3d5f70", neptune: "#3f4d75", pluto: "#5d4056",
  chiron: "#566044", true_node: "#6f695c", mean_node: "#6f695c",
};

export const GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀",
  mars: "♂", jupiter: "♃", saturn: "♄", uranus: "♅",
  neptune: "♆", pluto: "♇", chiron: "⚷",
  true_node: "☊", mean_node: "☊",
};
const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓"];
const HARD_ASPECTS = new Set(["conjunction", "square", "opposition"]);
const MAX_ORB: Record<string, number> = {
  conjunction: 8, sextile: 4, square: 7, trine: 7, opposition: 8,
};

/** Python-semantics modulo (result sign follows the divisor). */
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The wheel's anatomical layers, each independently drawable. All
 *  default on; a partial record turns parts of the figure off so a
 *  tutorial (the wheel-anatomy widget) can build the diagram up layer
 *  by layer. `axes` is the horizon–meridian cross (AC/MC/DC/IC). */
export interface WheelLayers {
  zodiac?: boolean;
  houses?: boolean;
  axes?: boolean;
  bodies?: boolean;
  aspects?: boolean;
}

/** One chart from a window of time, as much of it as the uncertainty layer
 *  reads. A caelus Chart object fits as it is. */
export interface WheelUncertaintySample {
  bodies: Record<string, { lon: number } | undefined>;
  /** Leave out for a chart with no place; the angle arcs then do not draw. */
  angles?: { asc: number; mc: number };
}

/**
 * A window of time to draw on the wheel, for a chart whose instant is not
 * known exactly. `samples` are charts across the window in time order, the
 * first at its start and the last at its end.
 *
 * Two samples are enough when nothing turns more than half the circle
 * between them, which holds for every body over any window up to a few
 * days. The angles turn once a day, so for a window of hours give a sample
 * every half hour or so; the layer adds up the steps between neighbours, and
 * a step of 180° or more cannot be told from one the other way round.
 */
export interface WheelUncertainty {
  samples: WheelUncertaintySample[];
  /** Arc color. Defaults to the theme's `axis` color: an arc is geometry of
   *  the chart over the window, drawn in the same ink as the angles. */
  color?: string;
}

/** The stretch of the zodiac a point covers across a window. */
export interface SweptArc {
  /** Lowest longitude reached, in [0, 360). */
  from: number;
  /** Degrees covered going forward from `from`, capped at 360. */
  sweep: number;
  /** Sign boundaries inside the stretch, as longitudes (multiples of 30).
   *  Empty when the point keeps its sign. */
  boundaries: number[];
}

/**
 * The arc a longitude sweeps across a run of samples in time order. Each
 * step between neighbours is taken the short way round, and the arc runs
 * from the lowest to the highest point reached, so a body that turns
 * retrograde inside the window is covered across its whole excursion.
 *
 * @example
 * ```ts
 * sweptArc([28.5, 29.4, 30.6]);
 * // { from: 28.5, sweep: 2.1, boundaries: [30] }
 * ```
 */
export function sweptArc(lons: number[]): SweptArc {
  if (lons.length === 0) return { from: 0, sweep: 0, boundaries: [] };
  let at = 0;
  let lo = 0;
  let hi = 0;
  for (let i = 1; i < lons.length; i++) {
    at += mod(lons[i] - lons[i - 1] + 180, 360) - 180;
    if (at < lo) lo = at;
    if (at > hi) hi = at;
  }
  const sweep = Math.min(360, hi - lo);
  const start = lons[0] + lo;
  const boundaries: number[] = [];
  if (sweep >= 360) {
    for (let s = 0; s < 12; s++) boundaries.push(s * 30);
  } else {
    // a boundary exactly at an end of the arc is touched, not crossed
    for (let b = Math.floor(start / 30) * 30 + 30; b < start + sweep; b += 30) {
      boundaries.push(mod(b, 360));
    }
  }
  return { from: mod(start, 360), sweep, boundaries };
}

export interface ChartWheelProps {
  /** The Chart object from caelus, or a caelus-mcp natal_chart /
   *  current_sky tool response, as-is. */
  chart: WheelChart;
  /** Square size in px. */
  size?: number;
  showAspects?: boolean;
  aspectTypes?: string[];
  /** Bodies to draw; defaults to every body in the chart except mean_node
   *  (true node is drawn; the two sit ~1° apart and double the glyph). */
  bodies?: string[];
  /** Layers to draw; omitted layers default on. */
  layers?: WheelLayers;
  theme?: Partial<WheelTheme>;
  glyphs?: Record<string, string>;
  /**
   * Draw a window of time on the wheel. For each body an arc just inside
   * the zodiac ring covers the longitudes it passes through, and for the
   * Ascendant and Midheaven an arc near the outer edge does the same (the
   * Ascendant's is the outer of the two). An arc that crosses a sign
   * boundary is drawn heavier and carries a square on the boundary. A
   * planet that barely moves has an arc too short to see, which is the
   * point: over an uncertain birth time the planets hold and the angles
   * sweep. With this prop left out the wheel renders exactly as before.
   */
  uncertainty?: WheelUncertainty;
}

/**
 * Fan out display angles so no two bodies sit closer than minSep degrees,
 * preserving zodiacal order. Circular: cut at the largest gap, cluster
 * linearly, spread each cluster around its midpoint, merge clusters that
 * collide after spreading, repeat until stable.
 */
export function spreadAngles(lons: number[], minSep: number): number[] {
  const n = lons.length;
  if (n <= 1) return [...lons];
  // cannot fit at all: shrink separation to what the circle allows
  const sep = Math.min(minSep, 360 / n);

  const order = lons.map((lon, i) => ({ lon: mod(lon, 360), i }))
    .sort((a, b) => a.lon - b.lon);
  // rotate so the largest gap is between the last and first element
  let cut = 0;
  let biggest = -1;
  for (let k = 0; k < n; k++) {
    const gap = mod(order[(k + 1) % n].lon - order[k].lon, 360);
    if (gap > biggest) { biggest = gap; cut = (k + 1) % n; }
  }
  const seq = [...order.slice(cut), ...order.slice(0, cut)];
  // unwrap to a monotonic line starting at the first element
  const line = seq.map((e) => e.lon);
  for (let k = 1; k < n; k++) {
    while (line[k] < line[k - 1]) line[k] += 360;
  }

  // clusters as [start, end) index ranges; spread each evenly around the
  // midpoint of its true positions, merge clusters that collide, repeat
  const spread = (cl: { s: number; e: number }): number[] => {
    const m = cl.e - cl.s;
    const mid = (line[cl.s] + line[cl.e - 1]) / 2;
    return Array.from({ length: m }, (_, j) => mid + (j - (m - 1) / 2) * sep);
  };
  let clusters = line.map((_, k) => ({ s: k, e: k + 1 }));
  let positions = clusters.map(spread);
  for (let pass = 0; pass < n; pass++) {
    let merged = false;
    const nc: typeof clusters = [];
    const np: number[][] = [];
    for (let k = 0; k < clusters.length; k++) {
      const prev = np[np.length - 1];
      if (prev && positions[k][0] - prev[prev.length - 1] < sep - 1e-9) {
        nc[nc.length - 1].e = clusters[k].e;
        np[np.length - 1] = spread(nc[nc.length - 1]);
        merged = true;
      } else {
        nc.push({ ...clusters[k] });
        np.push(positions[k]);
      }
    }
    clusters = nc;
    positions = np;
    if (!merged) break;
  }

  const out = new Array<number>(n);
  clusters.forEach((cl, k) => {
    for (let j = cl.s; j < cl.e; j++) out[seq[j].i] = mod(positions[k][j - cl.s], 360);
  });
  return out;
}

export function ChartWheel({
  chart,
  size = 520,
  showAspects = true,
  aspectTypes = ["conjunction", "sextile", "square", "trine", "opposition"],
  bodies,
  layers,
  theme,
  glyphs,
  uncertainty,
}: ChartWheelProps): ReactElement {
  const L: Required<WheelLayers> = {
    zodiac: true, houses: true, axes: true, bodies: true, aspects: true,
    ...layers,
  };
  const T: WheelTheme = { ...DARK_THEME, ...theme,
    aspectColors: { ...DARK_THEME.aspectColors, ...(theme?.aspectColors ?? {}) },
    planetColors: { ...(DARK_THEME.planetColors ?? {}), ...(theme?.planetColors ?? {}) } };
  const G = { ...GLYPHS, ...glyphs };
  const asc = chart.angles.asc;
  const c = size / 2;
  const R = (size / 2) * 0.96;
  // AC/MC/DC/IC labels sit at r=1.05 outside the outer ring; pad the viewBox
  // so they are not clipped when the SVG is rendered at exactly `size` px.
  const pad = size * 0.07;

  // ASC at 9 o'clock, longitudes counterclockwise
  const pt = (lon: number, r: number): [number, number] => {
    const a = ((lon - asc + 180) * Math.PI) / 180;
    return [c + r * R * Math.cos(a), c - r * R * Math.sin(a)];
  };
  const fix = (v: number) => Math.round(v * 100) / 100;
  const line = (lon: number, r0: number, r1: number, props: object, key: string) => {
    const [x1, y1] = pt(lon, r0);
    const [x2, y2] = pt(lon, r1);
    return <line key={key} x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)} {...props} />;
  };
  const text = (
    lon: number, r: number, content: string, fontSize: number,
    fill: string, key: string, extra: object = {},
  ) => {
    const [x, y] = pt(lon, r);
    return (
      <text key={key} x={fix(x)} y={fix(y)} fontSize={fontSize} fill={fill}
        textAnchor="middle" dominantBaseline="central"
        fontFamily={T.fontFamily} {...extra}>{content}</text>
    );
  };

  const names = (bodies ?? Object.keys(chart.bodies).filter((b) => b !== "mean_node"))
    .filter((b) => chart.bodies[b] !== undefined);
  const trueLons = names.map((b) => chart.bodies[b]!.lon);
  const dispLons = spreadAngles(trueLons, 6.5);

  const el: ReactElement[] = [];

  // ring circles: the outer circle is the plate's frame and always
  // draws; the inner circles belong to the layer whose band they bound
  const rings: Array<[number, string, boolean]> = [
    [1.0, "outer", true],
    [0.84, "zodiac-in", L.zodiac],
    [0.70, "house-in", L.houses],
    [0.50, "aspect", L.aspects],
  ];
  for (const [r, key, on] of rings) {
    if (!on) continue;
    el.push(<circle key={`ring-${key}`} cx={c} cy={c} r={fix(r * R)}
      fill="none" stroke={T.ring} strokeWidth={r === 1.0 ? 1.5 : 1} />);
  }

  // zodiac: sign boundaries, glyphs, ticks
  if (L.zodiac) {
    for (let s = 0; s < 12; s++) {
      el.push(line(s * 30, 0.84, 1.0, { stroke: T.ring, strokeWidth: 1 }, `sb-${s}`));
      el.push(text(s * 30 + 15, 0.92, SIGN_GLYPHS[s], size * 0.045, T.signText, `sg-${s}`));
    }
    for (let d = 0; d < 360; d++) {
      const len = d % 10 === 0 ? 0.035 : d % 5 === 0 ? 0.028 : 0.016;
      el.push(line(d, 0.84, 0.84 + len,
        { stroke: T.ring, strokeWidth: d % 5 === 0 ? 1 : 0.5 }, `tick-${d}`));
    }
  }

  // house cusps + numbers; axes emphasized
  const cusps = chart.cusps;
  const axes: Array<[number, string]> = [
    [asc, "AC"], [chart.angles.mc, "MC"],
    [mod(asc + 180, 360), "DC"], [mod(chart.angles.mc + 180, 360), "IC"],
  ];
  if (L.houses) {
    for (let i = 0; i < 12; i++) {
      el.push(line(cusps[i], 0.50, 0.84, { stroke: T.ring, strokeWidth: 1 }, `cusp-${i}`));
      const arc = mod(cusps[(i + 1) % 12] - cusps[i], 360);
      el.push(text(cusps[i] + arc / 2, 0.77, String(i + 1), size * 0.026, T.houseText, `hn-${i}`));
    }
  }
  if (L.axes) {
    for (const [lon, label] of axes) {
      el.push(line(lon, 0.50, 1.0, { stroke: T.axis, strokeWidth: 2 }, `axis-${label}`));
      el.push(text(lon, 1.045, label, size * 0.026, T.axis, `axl-${label}`));
    }
  }

  // the uncertainty layer: where each body and angle could be across a
  // window of time. Bodies draw just inside the zodiac ring, under their
  // pointer ticks; the angles draw near the outer edge, Ascendant outermost.
  if (uncertainty && uncertainty.samples.length >= 2) {
    const ink = uncertainty.color ?? T.axis;
    const arc = (r: number, a: SweptArc, key: string) => {
      const crosses = a.boundaries.length > 0;
      const width = crosses ? 3 : 1.5;
      if (a.sweep >= 360) {
        el.push(<circle key={key} cx={c} cy={c} r={fix(r * R)} fill="none"
          stroke={ink} strokeWidth={width} opacity={crosses ? 1 : 0.7} />);
      } else if (a.sweep >= 0.05) {
        const [x1, y1] = pt(a.from, r);
        const [x2, y2] = pt(a.from + a.sweep, r);
        el.push(<path key={key} fill="none" stroke={ink} strokeWidth={width}
          opacity={crosses ? 1 : 0.7}
          d={`M${fix(x1)} ${fix(y1)}A${fix(r * R)} ${fix(r * R)} 0 ${a.sweep > 180 ? 1 : 0} 0 ${fix(x2)} ${fix(y2)}`} />);
      }
      // a square on each sign boundary the arc crosses
      const h = size * 0.006;
      a.boundaries.forEach((b, i) => {
        const [x, y] = pt(b, r);
        el.push(<rect key={`${key}-b${i}`} x={fix(x - h)} y={fix(y - h)}
          width={fix(2 * h)} height={fix(2 * h)} fill={ink} />);
      });
    };
    const run = uncertainty.samples;
    if (L.bodies) {
      for (const b of names) {
        const lons = run.map((s) => s.bodies[b]?.lon);
        if (lons.some((v) => v === undefined)) continue;
        arc(0.8, sweptArc(lons as number[]), `unc-${b}`);
      }
    }
    if (L.axes && run.every((s) => s.angles !== undefined)) {
      arc(0.988, sweptArc(run.map((s) => s.angles!.asc)), "unc-asc");
      arc(0.968, sweptArc(run.map((s) => s.angles!.mc)), "unc-mc");
    }
  }

  // aspect lines (under the planet layer)
  if (showAspects && L.aspects) {
    const want = new Set(aspectTypes);
    const drawn = new Set(names);
    for (const a of chart.aspects) {
      if (!want.has(a.aspect) || !drawn.has(a.a) || !drawn.has(a.b)) continue;
      const [x1, y1] = pt(chart.bodies[a.a]!.lon, 0.50);
      const [x2, y2] = pt(chart.bodies[a.b]!.lon, 0.50);
      const tightness = Math.max(0, 1 - a.orb / (MAX_ORB[a.aspect] ?? 8));
      el.push(<line key={`asp-${a.a}-${a.aspect}-${a.b}`}
        x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)}
        stroke={T.aspectColors[a.aspect] ?? T.ring}
        strokeWidth={1 + tightness}
        strokeDasharray={HARD_ASPECTS.has(a.aspect) ? undefined : "4 3"}
        opacity={fix(0.25 + 0.65 * tightness)} />);
    }
  }

  // planets: pointer tick at true longitude, glyph + label at fanned angle
  if (L.bodies) names.forEach((b, i) => {
    const p = chart.bodies[b]!;
    const disp = dispLons[i];
    const pColor = T.planetColors?.[b] ?? T.planetText;
    el.push(line(p.lon, 0.815, 0.84, { stroke: pColor, strokeWidth: 1.2 }, `pt-${b}`));
    // connector when the glyph was displaced off its true longitude
    if (Math.abs(mod(disp - p.lon + 180, 360) - 180) > 0.75) {
      const [x1, y1] = pt(p.lon, 0.815);
      const [x2, y2] = pt(disp, 0.71);
      el.push(<line key={`conn-${b}`} x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)}
        stroke={T.labelText} strokeWidth={0.5} opacity={0.5} />);
    }
    el.push(text(disp, 0.655, G[b] ?? b.slice(0, 2).toUpperCase(),
      size * 0.05, pColor, `pg-${b}`));
    const signDeg = p.signDeg ?? mod(p.lon, 30);
    const retro = p.retrograde ?? p.rx ?? false;
    const deg = Math.floor(signDeg);
    const min = String(Math.floor(mod(signDeg, 1) * 60)).padStart(2, "0");
    el.push(text(disp, 0.585, `${deg}°${min}'${retro ? "℞" : ""}`,
      size * 0.024, T.labelText, `pl-${b}`));
  });

  return (
    <svg width={size} height={size}
      viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`}
      role="img" aria-label="astrological chart wheel"
      style={{ background: T.background, display: "block" }}>
      {el}
    </svg>
  );
}

export * from "./multiwheel.js";

export * from "./kundli.js";

export * from "./sphere.js";

export * from "./astromap.js";

export * from "./ephemerisgraph.js";
