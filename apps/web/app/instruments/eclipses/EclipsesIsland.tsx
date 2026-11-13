"use client";

import { useMemo } from "react";
import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Eclipses } from "caelus-widgets/eclipses-widget";

/** Client boundary for the instrument: builds the embedded-tier engine in the
 *  browser and hands it to the widget, so the search never leaves the page. */
export default function EclipsesIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  return <Eclipses engine={engine} />;
}
