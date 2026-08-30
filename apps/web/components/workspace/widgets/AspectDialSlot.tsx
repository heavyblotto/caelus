"use client";

import { useMemo } from "react";
import type { Engine } from "caelus";
import { deriveDial } from "caelus-widgets/aspect-dial";
import { AspectDial } from "caelus-widgets/aspect-dial-widget";
import type { PlaygroundChartParams } from "../util";

export default function AspectDialSlot({
  engine, params,
}: { engine: Engine; params: PlaygroundChartParams }) {
  const scene = useMemo(() => deriveDial(engine, params), [engine, params]);
  return <AspectDial scene={scene} size={460} />;
}
