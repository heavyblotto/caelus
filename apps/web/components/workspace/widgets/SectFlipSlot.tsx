"use client";

import { useMemo } from "react";
import type { Engine } from "caelus";
import { deriveSect } from "caelus-widgets/sect-flip";
import { SectFlip } from "caelus-widgets/sect-flip-widget";
import { WHEEL_THEME } from "../../../lib/wheelTheme";
import type { PlaygroundChartParams } from "../util";

export default function SectFlipSlot({
  engine, params,
}: { engine: Engine; params: PlaygroundChartParams }) {
  const scene = useMemo(() => deriveSect(engine, params), [engine, params]);
  return <SectFlip scene={scene} size={460} theme={WHEEL_THEME} />;
}
