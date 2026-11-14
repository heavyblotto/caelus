"use client";
import { useMemo } from "react";
import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { FirstVisibility } from "caelus-widgets/first-visibility-widget";

export default function FirstVisibilityIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  return <FirstVisibility engine={engine} />;
}
