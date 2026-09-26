/**
 * caelus-widgets — the wheel-anatomy widget.
 *
 * Layer toggles build the figure: the horizon cross, the zodiac ring,
 * the house cusps, the bodies, the aspect web. It opens tutorial one
 * before any astrology is taught, so the reader learns the diagram
 * before the doctrine. With every layer on, the figure is the ordinary
 * `ChartWheel` in the plate theme — the finished state is the standard
 * figure, not an imitation of it.
 *
 * Same split as the derivation widget: `deriveAnatomy` runs the engine
 * once and returns a serializable scene; `WheelAnatomyFigure` is a
 * pure function of (scene, layers), so the same scene renders on the
 * server (the plate), in the browser (the toggles), and in the figure
 * harness (the hash). The layer set is the whole widget state.
 */
import type { ReactElement } from "react";
import { VERSION, type Engine } from "caelus";
import {
  ChartWheel, PLATE_THEME,
  type WheelChart, type WheelLayers,
} from "caelus-wheel";
import { wheelPayload } from "./payload.js";
import {
  ANATOMY_LAYERS, type AnatomyLayer, type WheelAnatomyParams,
} from "./spec.js";

// ------------------------------------------------------------------ scene

export interface AnatomyScene {
  /** The finished chart, exactly what `ChartWheel` takes. */
  wheel: WheelChart;
  /** Engine version that computed the scene, for the stamp. */
  engineVersion: string;
  params: WheelAnatomyParams;
}

/** Run the engine once and capture the wheel payload as serializable
 *  data. The instant is explicit, per the spec contract; nothing here
 *  reads a clock. */
export function deriveAnatomy(
  engine: Engine, params: WheelAnatomyParams,
): AnatomyScene {
  const { instant: i, place: p } = params;
  const chart = engine.chart(
    i.y, i.mo, i.d, i.h, i.mi, i.s, p.latDeg, p.lonEastDeg,
    params.houseSystem ?? "placidus",
  );
  return { wheel: wheelPayload(chart), engineVersion: VERSION, params };
}

// ----------------------------------------------------------------- figure

/** Widget layer names onto the wheel's own layer switches. `horizon`
 *  is the horizon–meridian cross: the four angles. */
function wheelLayers(on: ReadonlySet<AnatomyLayer>): WheelLayers {
  return {
    axes: on.has("horizon"),
    zodiac: on.has("zodiac"),
    houses: on.has("houses"),
    bodies: on.has("bodies"),
    aspects: on.has("aspects"),
  };
}

export interface WheelAnatomyFigureProps {
  scene: AnatomyScene;
  /** Layers to draw; defaults to the scene's resting layers, then to
   *  all (the finished wheel). */
  layers?: readonly AnatomyLayer[];
  /** Square size in px. */
  size?: number;
}

/** Pure function of (scene, layers). All layers on renders the
 *  standard `ChartWheel` in the plate theme. */
export function WheelAnatomyFigure({
  scene, layers, size = 520,
}: WheelAnatomyFigureProps): ReactElement {
  const on = new Set<AnatomyLayer>(
    layers ?? scene.params.layers ?? ANATOMY_LAYERS,
  );
  return (
    <ChartWheel
      chart={scene.wheel}
      size={size}
      theme={PLATE_THEME}
      layers={wheelLayers(on)}
    />
  );
}

// The interactive widget (WheelAnatomy) lives in
// wheel-anatomy-widget.tsx: it calls hooks, and this module must stay
// importable from React Server Components (the plate render and the
// registry harness), so the client-only surface is its own subpath.
