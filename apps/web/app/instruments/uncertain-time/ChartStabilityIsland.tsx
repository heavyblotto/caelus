"use client";

import { useMemo } from "react";
import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartStability } from "caelus-widgets/chart-stability-widget";

/** Client boundary for the instrument: builds the embedded-tier engine in the
 *  browser and hands it to the widget, so the scan never leaves the page. */
export default function ChartStabilityIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  return <ChartStability engine={engine} />;
}
