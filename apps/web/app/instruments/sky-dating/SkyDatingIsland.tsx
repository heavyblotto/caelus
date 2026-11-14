"use client";

import { useMemo } from "react";
import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import type { PackSource } from "caelus-widgets/sky-dating";
import { SkyDating } from "caelus-widgets/sky-dating-widget";

/**
 * Where this site publishes the binary packs (scripts/build-pack-manifest.mjs
 * writes them into public/data/packs at build time). The widget fetches the
 * manifest when a reader picks the full tier, and then only the packs a
 * search needs; each is checked against the manifest's SHA-256 before use.
 */
const PACKS: PackSource = {
  manifestUrl: "/data/packs/manifest.json",
  fetch: (url) => fetch(url),
};

/** Client boundary for the instrument: builds the embedded-tier engine in the
 *  browser and hands it to the widget, so the search never leaves the page. */
export default function SkyDatingIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  return <SkyDating engine={engine} packs={PACKS} />;
}
