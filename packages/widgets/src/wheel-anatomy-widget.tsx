/**
 * caelus-widgets — the interactive wheel-anatomy widget.
 *
 * Split from the scene/figure module because this component calls
 * hooks: a host with React Server Components imports the scene module
 * server-side (the plate) and this module only across a client
 * boundary (the toggles).
 *
 * The figure plus a toggle rail beneath the frame, in apparatus style
 * (a 1px rule, mono small-caps labels, no fills). A layer that is on
 * prints in ink, off in faint ink with a strike — state shown as a
 * rule, not a fill. The server render at the resting layers is the
 * plate; hydration attaches the toggles and changes nothing above.
 */
import type { ReactElement } from "react";
import { useState } from "react";
import { PLATE_TOKENS } from "caelus-wheel";
import { ANATOMY_LAYERS, type AnatomyLayer } from "./spec.js";
import {
  WheelAnatomyFigure, type AnatomyScene,
} from "./wheel-anatomy.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface WheelAnatomyProps {
  scene: AnatomyScene;
  size?: number;
}

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
