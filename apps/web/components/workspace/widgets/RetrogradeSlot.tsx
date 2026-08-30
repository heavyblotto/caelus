"use client";

import { useMemo, useState } from "react";
import type { Engine } from "caelus";
import { deriveRetro } from "caelus-widgets/retrograde-scrub";
import { RetrogradeScrub } from "caelus-widgets/retrograde-scrub-widget";
import { WHEEL_THEME } from "../../../lib/wheelTheme";
import type { PlaygroundChartParams } from "../util";

const RETRO_BODIES = [
  "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
] as const;

export default function RetrogradeSlot({
  engine, params,
}: { engine: Engine; params: PlaygroundChartParams }) {
  const [body, setBody] = useState<string>("mercury");
  const scene = useMemo(() => {
    try {
      return deriveRetro(engine, { ...params, body });
    } catch {
      return null;
    }
  }, [engine, params, body]);

  return (
    <div>
      <div className="field" style={{ marginBottom: "0.5rem" }}>
        <span className="field__label">body</span>
        <select
          className="control"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="retrograde body"
        >
          {RETRO_BODIES.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>
      {scene ? (
        <RetrogradeScrub scene={scene} size={460} theme={WHEEL_THEME} />
      ) : (
        <p className="dim small" style={{ marginTop: 0 }}>
          No {body} retrograde loop in the scan window around this instant.
        </p>
      )}
    </div>
  );
}
