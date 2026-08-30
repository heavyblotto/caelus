"use client";

import { useMemo } from "react";
import type { Engine } from "caelus";
import { deriveComparator } from "caelus-widgets/house-comparator";
import { HouseComparator } from "caelus-widgets/house-comparator-widget";
import { WHEEL_THEME } from "../../../lib/wheelTheme";
import type { PlaygroundChartParams } from "../util";

export default function HouseComparatorSlot({
  engine, params,
}: { engine: Engine; params: PlaygroundChartParams }) {
  const scene = useMemo(() => deriveComparator(engine, params), [engine, params]);
  return (
    <HouseComparator
      scene={scene}
      size={460}
      theme={WHEEL_THEME}
      getEngine={() => Promise.resolve(engine)}
    />
  );
}
