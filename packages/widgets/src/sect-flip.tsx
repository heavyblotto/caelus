/**
 * caelus-widgets — the sect-flip widget, scene and figure.
 *
 * Sect is one toggle: day chart or night chart. Flipping it flips the
 * Fortune and Spirit formulas — Fortune is ASC + Moon − Sun by day
 * and ASC + Sun − Moon by night, Spirit the reverse — and the two
 * lots move on the wheel. The plate rests at the chart's actual
 * sect; the toggle shows the counterfactual. Beneath, the sect
 * table reads each classical body's condition in both modes.
 *
 * Same split as the other kinds: `deriveSect` runs the engine once
 * (one chart, both lot sets, the sect table) and returns a
 * serializable scene; the figure is a pure function of (scene, mode)
 * — flipping modes selects precomputed longitudes, never widget-side
 * astronomy. The interactive widget lives in sect-flip-widget.tsx
 * behind the client boundary.
 */
import type { ReactElement } from "react";
import {
  hermeticLots, inSect, isDayChart, julianDay, planetarySect, VERSION,
  type Engine,
} from "caelus";
import {
  ChartWheel, GLYPHS, PLATE_THEME, PLATE_TOKENS, type WheelChart,
} from "caelus-wheel";
import { fmtZodiac } from "./format.js";
import { wheelPayload } from "./payload.js";
import type { SectFlipParams } from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** The lots the flip moves, with their glyphs. */
export const SECT_LOTS = [
  { id: "fortune", glyph: "⊕" },
  { id: "spirit", glyph: "⊗" },
] as const;

/** The bodies that carry sect: the seven classical planets. */
const SECT_BODIES = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
] as const;

// ------------------------------------------------------------------ scene

export interface SectRow {
  body: string;
  /** The body's own sect; Mercury belongs to neither and reads null. */
  sect: "diurnal" | "nocturnal" | null;
  /** In-sect under a day chart / a night chart; null when sectless. */
  inDay: boolean | null;
  inNight: boolean | null;
}

export interface SectScene {
  /** The finished chart under the reference house system. */
  wheel: WheelChart;
  /** The chart's actual sect at the stated instant and place. */
  day: boolean;
  asc: number;
  /** Fortune and Spirit longitudes under each mode. */
  lots: {
    day: { fortune: number; spirit: number };
    night: { fortune: number; spirit: number };
  };
  sectTable: SectRow[];
  engineVersion: string;
  params: SectFlipParams;
}

/** Run the engine once and capture the flip as serializable data. */
export function deriveSect(
  engine: Engine, params: SectFlipParams,
): SectScene {
  const { instant: i, place: p } = params;
  const jd = julianDay(i.y, i.mo, i.d, i.h, i.mi, i.s);
  const chart = engine.chart(
    i.y, i.mo, i.d, i.h, i.mi, i.s, p.latDeg, p.lonEastDeg,
    params.houseSystem ?? "placidus",
  );
  const need = (id: string): number => {
    const b = chart.bodies[id];
    if (!b) throw new Error(`sect-flip: chart has no ${id}`);
    return b.lon;
  };
  const asc = chart.angles.asc;
  const args = [
    need("sun"), need("moon"), need("mercury"), need("venus"),
    need("mars"), need("jupiter"), need("saturn"),
  ] as const;
  const lotsAt = (day: boolean) => {
    const l = hermeticLots(asc, day, ...args);
    return { fortune: l.fortune, spirit: l.spirit };
  };

  const sectTable: SectRow[] = SECT_BODIES.map((body) => ({
    body,
    sect: planetarySect(body),
    inDay: inSect(body, true),
    inNight: inSect(body, false),
  }));

  return {
    wheel: wheelPayload(chart),
    day: isDayChart(engine, jd, p.latDeg, p.lonEastDeg),
    asc,
    lots: { day: lotsAt(true), night: lotsAt(false) },
    sectTable,
    engineVersion: VERSION,
    params,
  };
}

// ------------------------------------------------------------------ datum

export type SectMode = "day" | "night";

/** The mode the plate rests at: the spec's override, else the
 *  chart's own sect. */
export function restMode(scene: SectScene): SectMode {
  return scene.params.mode ?? (scene.day ? "day" : "night");
}

/** The console datum: `day chart · ⊕ 29°09′ ♍ · ⊗ 22°18′ ♓ · ⊕ = ASC + ☽ − ☉`. */
export function sectDatum(scene: SectScene, mode: SectMode): string {
  const lots = scene.lots[mode];
  const formula = mode === "day"
    ? "⊕ ASC+☽−☉ · ⊗ ASC+☉−☽"
    : "⊕ ASC+☉−☽ · ⊗ ASC+☽−☉";
  const actual = (mode === "day") === scene.day ? "" : " (counterfactual)";
  return `${mode} chart${actual} · ⊕ ${fmtZodiac(lots.fortune)} · `
    + `⊗ ${fmtZodiac(lots.spirit)} · ${formula}`;
}

// --------------------------------------------------------------- figure

export interface SectFlipFigureProps {
  scene: SectScene;
  /** The mode drawn; defaults to the rest mode (the plate). */
  mode?: SectMode;
  /** Square size in px. */
  size?: number;
}

/** The wheel with the two lots on it for the working mode, in
 *  oxblood: the highlighted elements the flip moves. */
export function SectFlipFigure({
  scene, mode, size = 520,
}: SectFlipFigureProps): ReactElement {
  const m = mode ?? restMode(scene);
  const lots = scene.lots[m];
  return (
    <ChartWheel
      chart={{
        ...scene.wheel,
        bodies: {
          ...scene.wheel.bodies,
          fortune: { lon: lots.fortune },
          spirit: { lon: lots.spirit },
        },
      }}
      size={size}
      theme={{
        ...PLATE_THEME,
        planetColors: {
          ...PLATE_THEME.planetColors,
          fortune: PLATE_TOKENS.accent,
          spirit: PLATE_TOKENS.accent,
        },
      }}
      glyphs={{ fortune: "⊕", spirit: "⊗" }}
    />
  );
}

// ------------------------------------------------------------------ table

export interface SectTableProps {
  scene: SectScene;
  mode?: SectMode;
}

/** The sect table: one row per classical body, its own sect, and its
 *  condition under each mode — the current mode's column in oxblood.
 *  Pure and hook-free: the resting render is part of the plate's
 *  apparatus. */
export function SectTable({ scene, mode }: SectTableProps): ReactElement {
  const m = mode ?? restMode(scene);
  const cell = {
    padding: "1px 12px 1px 0",
    textAlign: "left" as const,
    fontWeight: "normal" as const,
  };
  const word = (v: boolean | null): string =>
    v === null ? "—" : v ? "in sect" : "out";
  return (
    <div style={{ fontFamily: MONO, fontSize: "11px", lineHeight: 1.6 }}>
      <table style={{ borderCollapse: "collapse" as const }}>
        <thead>
          <tr style={{ color: PLATE_TOKENS.faintInk }}>
            <th style={cell} scope="col">body</th>
            <th style={cell} scope="col">sect</th>
            <th style={cell} scope="col">day</th>
            <th style={cell} scope="col">night</th>
          </tr>
        </thead>
        <tbody style={{ color: PLATE_TOKENS.mutedInk }}>
          {scene.sectTable.map((r) => (
            <tr key={r.body}>
              <td style={{ ...cell, color: PLATE_TOKENS.ink }}>
                {GLYPHS[r.body] ?? r.body} {r.body}
              </td>
              <td style={cell}>{r.sect ?? "—"}</td>
              <td style={m === "day"
                ? { ...cell, color: PLATE_TOKENS.accent }
                : cell}
              >
                {word(r.inDay)}
              </td>
              <td style={m === "night"
                ? { ...cell, color: PLATE_TOKENS.accent }
                : cell}
              >
                {word(r.inNight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The interactive widget lives in sect-flip-widget.tsx: it calls
// hooks, and this module must stay importable from React Server
// Components (the plate render and the registry harness), so the
// client-only surface is its own subpath.
