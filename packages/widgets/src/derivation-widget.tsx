/**
 * caelus-widgets — the interactive derivation widget.
 *
 * Split from the scene/figure module because this component calls
 * hooks: a host with React Server Components imports the scene module
 * server-side (the plate) and this module only across a client
 * boundary (the scrub). State is one number. The server render at
 * `initialT` is the plate; hydration attaches the scrub and changes
 * nothing above it.
 */
import type { ReactElement } from "react";
import { useState } from "react";
import { PlateConsole } from "./console.js";
import {
  DERIVATION_STATIONS, DerivationFigure, type DerivationScene,
} from "./derivation.js";

export interface ChartDerivationProps {
  scene: DerivationScene;
  size?: number;
  /** Resting scrub position; the plate renders here. Defaults to the
   *  scene's params, then to 1 (the finished wheel). */
  initialT?: number;
}

export function ChartDerivation({
  scene, size, initialT,
}: ChartDerivationProps): ReactElement {
  const [t, setT] = useState(initialT ?? scene.params.t ?? 1);
  const station = DERIVATION_STATIONS.reduce((best, s) =>
    Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best);
  return (
    <div>
      <DerivationFigure scene={scene} t={t} size={size}
        follow={scene.params.follow} />
      <PlateConsole
        t={t}
        stations={DERIVATION_STATIONS}
        datum={`${station.label.toLowerCase()} · t ${t.toFixed(2)}`}
        onScrub={setT}
      />
    </div>
  );
}
