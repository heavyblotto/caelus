/**
 * caelus-widgets — the interactive zodiac drift.
 *
 * Split from the scene/figure module because this component calls
 * hooks; hosts with React Server Components import the scene module
 * server-side and this one across a client boundary.
 *
 * The console: the ayanamsa picker as a mono list with the current
 * mode in oxblood (the design's picker, and the accent's one
 * meaning), then the century rail — free scrub while dragging, snap
 * to a century mark or the resting year on release. Both interactions
 * read the precomputed curves in the scene, so the widget never loads
 * an engine or a data tier.
 */
import type { ReactElement } from "react";
import { useState } from "react";
import { PLATE_TOKENS } from "caelus-wheel";
import { PlateConsole } from "./console.js";
import {
  DRIFT_MODES, driftDatum, driftStations, ZodiacDriftFigure,
  type ZodiacDriftScene,
} from "./zodiac-drift.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface ZodiacDriftProps {
  scene: ZodiacDriftScene;
  size?: number;
}

export function ZodiacDrift({ scene, size }: ZodiacDriftProps): ReactElement {
  const [mode, setMode] = useState(scene.params.ayanamsa ?? "lahiri");
  const [year, setYear] = useState(scene.restYear);

  const ys = scene.years;
  const minY = ys[0];
  const maxY = ys[ys.length - 1];
  const span = maxY - minY;

  return (
    <div>
      <ZodiacDriftFigure scene={scene} mode={mode} year={year} size={size} />
      <div
        style={{
          marginTop: "8px",
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          paddingTop: "6px",
          fontFamily: MONO,
          userSelect: "none",
        }}
      >
        {DRIFT_MODES.map((m) => (
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
            {m.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "4px" }}>
        <PlateConsole
          t={(year - minY) / span}
          stations={driftStations(scene)}
          datum={driftDatum(scene, mode, year)}
          onScrub={(t) => setYear(minY + t * span)}
        />
      </div>
    </div>
  );
}
