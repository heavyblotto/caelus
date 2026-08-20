/**
 * caelus-widgets — the house-comparator widget, scene and figure.
 *
 * One birth through the twelve house systems: the same bodies and
 * angles, twelve sets of cusps. The figure is the ordinary wheel with
 * the selected system's cusps; the cusp table beneath sets the
 * selected system against the reference and marks the placements that
 * change house. Pulled north, the quadrant systems walk into polar
 * failure: the engine falls back to whole sign above the polar
 * circles and records what was asked for, and the comparator surfaces
 * that rather than hiding it.
 *
 * Same split as the other kinds: `deriveComparator` runs the engine
 * once (twelve charts, one instant) and returns a serializable scene;
 * the figure and table are pure functions of (scene, system). The
 * interactive widget (picker, latitude walk) lives in
 * house-comparator-widget.tsx behind the client boundary.
 */
import type { ReactElement } from "react";
import {
  HOUSE_SYSTEMS, VERSION, type Engine, type HouseSystem,
} from "caelus";
import {
  ChartWheel, GLYPHS, PLATE_THEME, PLATE_TOKENS, type WheelChart,
} from "caelus-wheel";
import { fmtZodiac } from "./format.js";
import { wheelPayload } from "./payload.js";
import type { HouseComparatorParams } from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

// ------------------------------------------------------------------ scene

export interface ComparatorSystem {
  id: HouseSystem;
  /** Cusps as computed. When the system is undefined at this latitude
   *  these are the fallback's cusps and `fellBack` names it. */
  cusps: number[];
  fellBack?: HouseSystem;
  /** House number per placed body under this system. */
  houses: Record<string, number>;
}

export interface HouseComparatorScene {
  /** The finished chart under the reference system. */
  wheel: WheelChart;
  reference: HouseSystem;
  systems: ComparatorSystem[];
  engineVersion: string;
  params: HouseComparatorParams;
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** House number (1–12) of a longitude against a cusp set. */
export function houseOf(cusps: number[], lon: number): number {
  for (let i = 0; i < 12; i++) {
    const arc = mod360(cusps[(i + 1) % 12] - cusps[i]);
    if (mod360(lon - cusps[i]) < arc) return i + 1;
  }
  return 12;
}

/** Run the engine once per system and capture the comparison as
 *  serializable data. The instant is explicit, per the spec contract. */
export function deriveComparator(
  engine: Engine, params: HouseComparatorParams,
): HouseComparatorScene {
  const { instant: i, place: p } = params;
  const reference = params.houseSystem ?? "placidus";
  const at = (sys: HouseSystem) => engine.chart(
    i.y, i.mo, i.d, i.h, i.mi, i.s, p.latDeg, p.lonEastDeg, sys,
  );

  const refChart = at(reference);
  const systems: ComparatorSystem[] = HOUSE_SYSTEMS.map((sys) => {
    const c = sys === reference ? refChart : at(sys);
    const houses: Record<string, number> = {};
    for (const [id, b] of Object.entries(c.bodies)) {
      if (b) houses[id] = houseOf(c.cusps, b.lon);
    }
    return {
      id: sys,
      cusps: c.cusps,
      ...(c.houseSystem !== c.houseSystemRequested
        ? { fellBack: c.houseSystem as HouseSystem }
        : {}),
      houses,
    };
  });

  return {
    wheel: wheelPayload(refChart),
    reference,
    systems,
    engineVersion: VERSION,
    params,
  };
}

// ----------------------------------------------------------------- figure

export interface HouseComparatorFigureProps {
  scene: HouseComparatorScene;
  /** System drawn; defaults to the spec's `compare`, then the
   *  reference (the plate at rest). */
  system?: HouseSystem;
  /** Square size in px. */
  size?: number;
}

/** The ordinary wheel with the selected system's cusps: bodies and
 *  angles never move, only the house furniture does. */
export function HouseComparatorFigure({
  scene, system, size = 520,
}: HouseComparatorFigureProps): ReactElement {
  const id = system ?? scene.params.compare ?? scene.reference;
  const sys = scene.systems.find((s) => s.id === id) ?? scene.systems[0];
  return (
    <ChartWheel
      chart={{ ...scene.wheel, cusps: sys.cusps }}
      size={size}
      theme={PLATE_THEME}
    />
  );
}

// ------------------------------------------------------------------ table

const label = (s: HouseSystem): string => s.replace(/_/g, " ");

export interface CuspTableProps {
  scene: HouseComparatorScene;
  system?: HouseSystem;
}

/** The cusp table: selected system against the reference, one row per
 *  house, with the placements that change house listed beneath
 *  (`☉ 10→9`). Pure and hook-free: the resting render is part of the
 *  plate's apparatus. */
export function CuspTable({ scene, system }: CuspTableProps): ReactElement {
  const id = system ?? scene.params.compare ?? scene.reference;
  const sel = scene.systems.find((s) => s.id === id) ?? scene.systems[0];
  const ref = scene.systems.find((s) => s.id === scene.reference)
    ?? scene.systems[0];
  const moves = Object.keys(sel.houses)
    .filter((b) => ref.houses[b] !== undefined
      && sel.houses[b] !== ref.houses[b])
    .map((b) => `${GLYPHS[b] ?? b} ${ref.houses[b]}→${sel.houses[b]}`);

  const cell = {
    padding: "1px 10px 1px 0",
    textAlign: "left" as const,
    fontWeight: "normal" as const,
  };
  return (
    <div style={{ fontFamily: MONO, fontSize: "11px", lineHeight: 1.6 }}>
      <table style={{ borderCollapse: "collapse" as const }}>
        <thead>
          <tr style={{ color: PLATE_TOKENS.faintInk }}>
            <th style={cell} scope="col">house</th>
            <th style={cell} scope="col">{label(sel.id)}</th>
            <th style={cell} scope="col">{label(ref.id)}</th>
          </tr>
        </thead>
        <tbody style={{ color: PLATE_TOKENS.mutedInk }}>
          {sel.cusps.map((c, k) => (
            <tr key={k}>
              <td style={cell}>{k + 1}</td>
              <td style={{ ...cell, color: PLATE_TOKENS.ink }}>
                {fmtZodiac(c)}
              </td>
              <td style={cell}>{fmtZodiac(ref.cusps[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: "2px", color: PLATE_TOKENS.mutedInk }}>
        {sel.fellBack
          ? `${label(sel.id)} is undefined at this latitude; the engine fell back to ${label(sel.fellBack)}`
          : moves.length
            ? `moves · ${moves.join(" · ")}`
            : "no placement changes house"}
      </div>
    </div>
  );
}
