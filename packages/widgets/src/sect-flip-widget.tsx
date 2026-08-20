/**
 * caelus-widgets — the interactive sect flip.
 *
 * Split from the scene/figure module because this component calls
 * hooks; hosts with React Server Components import the scene module
 * server-side and this one across a client boundary.
 *
 * The console: the day/night picker as a mono list with the current
 * mode in oxblood (the design's picker, and the accent's one
 * meaning), then the datum — mode, both lot positions, and the
 * formulas. Flipping selects precomputed scene longitudes, so the
 * widget never loads an engine or a data tier.
 */
import type { ReactElement } from "react";
import { useState } from "react";
import { PLATE_TOKENS } from "caelus-wheel";
import {
  restMode, sectDatum, SectFlipFigure, SectTable,
  type SectMode, type SectScene,
} from "./sect-flip.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface SectFlipProps {
  scene: SectScene;
  size?: number;
}

export function SectFlip({ scene, size }: SectFlipProps): ReactElement {
  const [mode, setMode] = useState<SectMode>(restMode(scene));
  const modes: SectMode[] = ["day", "night"];
  return (
    <div>
      <SectFlipFigure scene={scene} mode={mode} size={size} />
      <div
        style={{
          marginTop: "8px",
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          paddingTop: "6px",
          fontFamily: MONO,
          userSelect: "none",
        }}
      >
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginRight: "14px",
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: mode === m ? PLATE_TOKENS.accent : PLATE_TOKENS.mutedInk,
              cursor: "pointer",
            }}
          >
            {m}
          </button>
        ))}
        <div
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: PLATE_TOKENS.mutedInk,
          }}
        >
          {sectDatum(scene, mode)}
        </div>
      </div>
      <div style={{ marginTop: "8px" }}>
        <SectTable scene={scene} mode={mode} />
      </div>
    </div>
  );
}
