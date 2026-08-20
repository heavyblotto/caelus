/**
 * caelus-widgets — the retrograde-scrub client widget.
 *
 * Hydration attaches the console: the rail scrubs the cursor through
 * the window (snapping to the SR and SD stations on release), the
 * graph's cursor line and the heliocentric inset follow, and the
 * datum reads date, longitude, speed, and state at the cursor. All
 * of it interpolates the scene — no engine calls on the interaction
 * path.
 */
"use client";
import { useState, type ReactElement } from "react";
import { PlateConsole, type ConsoleStation } from "./console.js";
import {
  restCursor, RetrogradeFigure, retroDatum, type RetrogradeScene,
} from "./retrograde-scrub.js";

export interface RetrogradeScrubProps {
  scene: RetrogradeScene;
  size?: number;
}

/** The snap stations on the rail: the loop's boundaries. */
export function retroStations(scene: RetrogradeScene): ConsoleStation[] {
  const span = scene.to - scene.from;
  return scene.stations.map((s) => ({
    id: `${s.kind}-${s.jdUt.toFixed(2)}`,
    label: s.kind === "retrograde" ? "SR" : "SD",
    t: (s.jdUt - scene.from) / span,
  }));
}

export function RetrogradeScrub({
  scene, size,
}: RetrogradeScrubProps): ReactElement {
  const [cursor, setCursor] = useState(restCursor(scene));
  const span = scene.to - scene.from;
  return (
    <div>
      <RetrogradeFigure scene={scene} cursor={cursor} size={size} />
      <PlateConsole
        t={(cursor - scene.from) / span}
        stations={retroStations(scene)}
        datum={retroDatum(scene, cursor)}
        onScrub={(t) => setCursor(scene.from + t * span)}
      />
    </div>
  );
}
