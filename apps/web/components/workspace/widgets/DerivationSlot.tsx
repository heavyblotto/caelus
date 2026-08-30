"use client";

import { useMemo } from "react";
import type { Engine } from "caelus";
import { deriveScene } from "caelus-widgets/derivation";
import { ChartDerivation } from "caelus-widgets/derivation-widget";
import { WHEEL_THEME } from "../../../lib/wheelTheme";
import type { PlaygroundChartParams } from "../util";

export default function DerivationSlot({
  engine, params,
}: { engine: Engine; params: PlaygroundChartParams }) {
  const scene = useMemo(() => deriveScene(engine, params), [engine, params]);
  return (
    <ChartDerivation
      scene={scene}
      size={460}
      initialT={0}
      theme={WHEEL_THEME}
      getEngine={() => Promise.resolve(engine)}
    />
  );
}
