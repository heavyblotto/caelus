/**
 * MultiWheel — concentric chart rings around one zodiac.
 *
 * Any chart in any ring: natal + partner (bi-wheel), natal + progressed +
 * transits (tri-wheel), up to four rings. Ring 0 is the innermost chart and
 * the frame of reference: the wheel is oriented to its Ascendant (9 o'clock,
 * zodiac counterclockwise, matching ChartWheel) and its house cusps span the
 * ring bands. Inter-chart contacts draw in the aspect core, so a synastry
 * grid or a transit hit list renders as geometry.
 *
 * Pure render, SSR-safe, zero runtime dependencies; react is a peer.
 */
import type { ReactElement } from "react";
import {
  DARK_THEME, GLYPHS, spreadAngles,
  type WheelChart, type WheelTheme,
} from "./index.js";

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓"];
const HARD_ASPECTS = new Set(["conjunction", "square", "opposition"]);
const MAX_ORB: Record<string, number> = {
  conjunction: 8, sextile: 4, square: 7, trine: 7, opposition: 8,
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

export interface WheelRing {
  /** The caelus Chart (or MCP payload) this ring draws. Ring 0's angles and
   *  cusps orient the whole wheel; outer rings contribute bodies only. */
  chart: WheelChart;
  /** Names this ring in the accessible label, e.g. "natal", "transits". */
  label?: string;
  /** Bodies to draw; defaults to every body except mean_node. */
  bodies?: string[];
  /** Glyph and tick color for the whole ring; overrides theme colors. */
  color?: string;
}

/** An aspect between bodies in (possibly different) rings, drawn as a line
 *  in the aspect core. Feed synastry inter-aspects or transit hits here. */
export interface RingContact {
  a: { ring: number; body: string };
  b: { ring: number; body: string };
  aspect: string;
  orb: number;
}

export interface MultiWheelProps {
  /** Innermost first. One ring renders like a plain wheel; four is the max
   *  before glyph bands get too thin to read. */
  rings: WheelRing[];
  /** Square size in px. */
  size?: number;
  /** Inter-ring (or intra-ring) aspect lines for the core. */
  contacts?: RingContact[];
  /** Also draw ring 0's own chart.aspects in the core (off by default:
   *  in a stacked wheel the contacts are usually the point). */
  showAspects?: boolean;
  aspectTypes?: string[];
  /** Ring 0's house cusps and numbers (on by default). */
  showHouses?: boolean;
  theme?: Partial<WheelTheme>;
  glyphs?: Record<string, string>;
}

export function MultiWheel({
  rings,
  size = 520,
  contacts = [],
  showAspects = false,
  aspectTypes = ["conjunction", "sextile", "square", "trine", "opposition"],
  showHouses = true,
  theme,
  glyphs,
}: MultiWheelProps): ReactElement {
  const T: WheelTheme = { ...DARK_THEME, ...theme,
    aspectColors: { ...DARK_THEME.aspectColors, ...(theme?.aspectColors ?? {}) },
    planetColors: { ...(DARK_THEME.planetColors ?? {}), ...(theme?.planetColors ?? {}) } };
  const G = { ...GLYPHS, ...glyphs };
  const n = rings.length;
  const base = rings[0]?.chart;
  const asc = base?.angles.asc ?? 0;
  const c = size / 2;
  const R = (size / 2) * 0.96;
  const pad = size * 0.07;

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

  const el: ReactElement[] = [];

  // frame: zodiac band and aspect core, as in ChartWheel
  const CORE = 0.50;
  const ZODIAC_IN = 0.84;
  for (const [r, key, w] of [[1.0, "outer", 1.5], [ZODIAC_IN, "zodiac-in", 1],
    [CORE, "core", 1]] as Array<[number, string, number]>) {
    el.push(<circle key={`ring-${key}`} cx={c} cy={c} r={fix(r * R)}
      fill="none" stroke={T.ring} strokeWidth={w} />);
  }
  for (let s = 0; s < 12; s++) {
    el.push(line(s * 30, ZODIAC_IN, 1.0, { stroke: T.ring, strokeWidth: 1 }, `sb-${s}`));
    el.push(text(s * 30 + 15, 0.92, SIGN_GLYPHS[s], size * 0.045, T.signText, `sg-${s}`));
  }
  for (let d = 0; d < 360; d += 5) {
    el.push(line(d, ZODIAC_IN, ZODIAC_IN + (d % 10 === 0 ? 0.03 : 0.02),
      { stroke: T.ring, strokeWidth: d % 10 === 0 ? 1 : 0.5 }, `tick-${d}`));
  }

  // ring bands between the core and the zodiac
  const h = (ZODIAC_IN - CORE) / Math.max(1, n);
  for (let i = 1; i < n; i++) {
    el.push(<circle key={`band-${i}`} cx={c} cy={c} r={fix((CORE + i * h) * R)}
      fill="none" stroke={T.ring} strokeWidth={0.75} opacity={0.7} />);
  }

  // houses and axes from ring 0
  if (base && showHouses) {
    const cusps = base.cusps;
    for (let i = 0; i < 12; i++) {
      el.push(line(cusps[i], CORE, ZODIAC_IN,
        { stroke: T.ring, strokeWidth: 1, opacity: 0.55 }, `cusp-${i}`));
      const arc = mod(cusps[(i + 1) % 12] - cusps[i], 360);
      el.push(text(cusps[i] + arc / 2, 0.455, String(i + 1),
        size * 0.024, T.houseText, `hn-${i}`));
    }
  }
  if (base) {
    const axes: Array<[number, string]> = [
      [asc, "AC"], [base.angles.mc, "MC"],
      [mod(asc + 180, 360), "DC"], [mod(base.angles.mc + 180, 360), "IC"],
    ];
    for (const [lon, label] of axes) {
      el.push(line(lon, CORE, 1.0, { stroke: T.axis, strokeWidth: 2 }, `axis-${label}`));
      el.push(text(lon, 1.045, label, size * 0.026, T.axis, `axl-${label}`));
    }
  }

  // ring 0's own aspects, when asked for
  if (base && showAspects) {
    const want = new Set(aspectTypes);
    for (const a of base.aspects) {
      const pa = base.bodies[a.a];
      const pb = base.bodies[a.b];
      if (!want.has(a.aspect) || !pa || !pb) continue;
      const [x1, y1] = pt(pa.lon, CORE);
      const [x2, y2] = pt(pb.lon, CORE);
      const tightness = Math.max(0, 1 - a.orb / (MAX_ORB[a.aspect] ?? 8));
      el.push(<line key={`asp-${a.a}-${a.aspect}-${a.b}`}
        x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)}
        stroke={T.aspectColors[a.aspect] ?? T.ring}
        strokeWidth={1 + tightness}
        strokeDasharray={HARD_ASPECTS.has(a.aspect) ? undefined : "4 3"}
        opacity={fix(0.25 + 0.65 * tightness)} />);
    }
  }

  // inter-ring contacts in the core
  for (const k of contacts) {
    const pa = rings[k.a.ring]?.chart.bodies[k.a.body];
    const pb = rings[k.b.ring]?.chart.bodies[k.b.body];
    if (!pa || !pb) continue;
    const [x1, y1] = pt(pa.lon, CORE);
    const [x2, y2] = pt(pb.lon, CORE);
    const tightness = Math.max(0, 1 - k.orb / (MAX_ORB[k.aspect] ?? 8));
    el.push(<line key={`c-${k.a.ring}.${k.a.body}-${k.aspect}-${k.b.ring}.${k.b.body}`}
      x1={fix(x1)} y1={fix(y1)} x2={fix(x2)} y2={fix(y2)}
      stroke={T.aspectColors[k.aspect] ?? T.ring}
      strokeWidth={1 + tightness}
      strokeDasharray={HARD_ASPECTS.has(k.aspect) ? undefined : "4 3"}
      opacity={fix(0.3 + 0.6 * tightness)} />);
  }

  // bodies, ring by ring: pointer tick at the band's outer edge on the true
  // longitude, glyph at a fanned angle, degree label when the band is tall
  // enough (one or two rings)
  const glyphSize = size * Math.max(0.032, 0.05 - 0.006 * (n - 1));
  rings.forEach((ring, i) => {
    const rIn = CORE + i * h;
    const rOut = rIn + h;
    const showLabel = n <= 2;
    const glyphR = rIn + h * (showLabel ? 0.62 : 0.52);
    const names = (ring.bodies ?? Object.keys(ring.chart.bodies).filter((b) => b !== "mean_node"))
      .filter((b) => ring.chart.bodies[b] !== undefined);
    const trueLons = names.map((b) => ring.chart.bodies[b]!.lon);
    // min separation so glyphs at this radius cannot overlap
    const minSep = (1.2 * glyphSize * 180) / (Math.PI * glyphR * R);
    const dispLons = spreadAngles(trueLons, minSep);
    const ringColor = ring.color
      ?? (i === 0 ? undefined : T.axis);

    names.forEach((b, j) => {
      const p = ring.chart.bodies[b]!;
      const disp = dispLons[j];
      const pColor = ringColor ?? T.planetColors?.[b] ?? T.planetText;
      el.push(line(p.lon, rOut - 0.025, rOut,
        { stroke: pColor, strokeWidth: 1.2 }, `r${i}-pt-${b}`));
      if (Math.abs(mod(disp - p.lon + 180, 360) - 180) > 0.75) {
        const [x1, y1] = pt(p.lon, rOut - 0.025);
        const [x2, y2] = pt(disp, glyphR + h * 0.18);
        el.push(<line key={`r${i}-conn-${b}`} x1={fix(x1)} y1={fix(y1)}
          x2={fix(x2)} y2={fix(y2)} stroke={T.labelText} strokeWidth={0.5} opacity={0.5} />);
      }
      el.push(text(disp, glyphR, G[b] ?? b.slice(0, 2).toUpperCase(),
        glyphSize, pColor, `r${i}-pg-${b}`));
      if (showLabel) {
        const signDeg = p.signDeg ?? mod(p.lon, 30);
        const retro = p.retrograde ?? p.rx ?? false;
        const deg = Math.floor(signDeg);
        const min = String(Math.floor(mod(signDeg, 1) * 60)).padStart(2, "0");
        el.push(text(disp, rIn + h * 0.24, `${deg}°${min}'${retro ? "℞" : ""}`,
          size * 0.022, T.labelText, `r${i}-pl-${b}`));
      }
    });
  });

  const ariaRings = rings.map((r, i) => r.label ?? `ring ${i}`).join(", ");
  return (
    <svg width={size} height={size}
      viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`}
      role="img" aria-label={`multi-ring chart wheel: ${ariaRings}`}
      style={{ background: T.background, display: "block" }}>
      {el}
    </svg>
  );
}
