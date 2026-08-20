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
import { useState } from "react";
import { VERSION, type Engine } from "caelus";
import {
  ChartWheel, PLATE_THEME, PLATE_TOKENS,
  type WheelChart, type WheelLayers,
} from "caelus-wheel";
import { wheelPayload } from "./payload.js";
import {
  ANATOMY_LAYERS, type AnatomyLayer, type WheelAnatomyParams,
} from "./spec.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

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

// ----------------------------------------------------------------- widget

export interface WheelAnatomyProps {
  scene: AnatomyScene;
  size?: number;
}

/**
 * The interactive widget: the figure plus a toggle rail beneath the
 * frame, in apparatus style (a 1px rule, mono small-caps labels, no
 * fills). A layer that is on prints in ink, off in faint ink with a
 * strike — state shown as a rule, not a fill. The server render at the
 * resting layers is the plate; hydration attaches the toggles and
 * changes nothing above.
 */
export function WheelAnatomy({
  scene, size,
}: WheelAnatomyProps): ReactElement {
  const [on, setOn] = useState<AnatomyLayer[]>(
    () => [...(scene.params.layers ?? ANATOMY_LAYERS)],
  );
  const has = new Set(on);
  const toggle = (l: AnatomyLayer) =>
    setOn(has.has(l) ? on.filter((x) => x !== l) : [...on, l]);
  return (
    <div>
      <WheelAnatomyFigure scene={scene} layers={on} size={size} />
      <div
        style={{
          marginTop: "8px",
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          paddingTop: "6px",
          fontFamily: MONO,
          userSelect: "none",
        }}
      >
        {ANATOMY_LAYERS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={has.has(l)}
            onClick={() => toggle(l)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginRight: "16px",
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: has.has(l) ? PLATE_TOKENS.ink : PLATE_TOKENS.faintInk,
              textDecoration: has.has(l) ? "none" : "line-through",
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
