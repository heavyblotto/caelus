"use client";
/**
 * Client half of a wheel-anatomy plate. Same contract as
 * DerivationPlate: the server rendered the article's scene (the
 * plate); hydration attaches the layer toggles beneath it, and a
 * reader's chart swaps in a browser-computed scene — the reader's
 * chart is just params. The embedded data tier loads only when an
 * override exists.
 */
import { useEffect, useState } from "react";
import type { Engine } from "caelus";
import { WheelAnatomy } from "caelus-widgets/wheel-anatomy-widget";
import type { AnatomyScene } from "caelus-widgets/wheel-anatomy";
import { useReaderChart } from "../ReaderChartContext";

let enginePromise: Promise<Engine> | null = null;
function browserEngine(): Promise<Engine> {
  return (enginePromise ??= Promise.all([
    import("caelus"),
    import("caelus/data-embedded"),
  ]).then(([{ Engine: E }, { embeddedData }]) => new E(embeddedData)));
}

export default function WheelAnatomyPlate({
  scene, size,
}: { scene: AnatomyScene; size?: number }) {
  const { params } = useReaderChart();
  const [override, setOverride] = useState<AnatomyScene | null>(null);

  useEffect(() => {
    if (!params) {
      setOverride(null);
      return;
    }
    let stale = false;
    Promise.all([browserEngine(), import("caelus-widgets/wheel-anatomy")])
      .then(([engine, { deriveAnatomy }]) => {
        const s = deriveAnatomy(engine, {
          ...scene.params,
          instant: params.instant,
          place: params.place,
          houseSystem: params.houseSystem ?? scene.params.houseSystem,
        });
        if (!stale) setOverride(s);
      })
      .catch(() => {
        if (!stale) setOverride(null);
      });
    return () => {
      stale = true;
    };
  }, [params, scene]);

  return <WheelAnatomy scene={override ?? scene} size={size} />;
}
