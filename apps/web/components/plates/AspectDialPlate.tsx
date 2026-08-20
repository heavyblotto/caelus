"use client";
/**
 * Client half of an aspect-dial plate. Same contract as the other
 * plates: the server rendered the article's scene; hydration attaches
 * the drag, the orb rail, and the aspectarian beneath it, and a
 * reader's chart swaps in a browser-computed scene. The embedded data
 * tier loads only when needed.
 */
import { useEffect, useState } from "react";
import type { Engine } from "caelus";
import { AspectDial } from "caelus-widgets/aspect-dial-widget";
import type { AspectDialScene } from "caelus-widgets/aspect-dial";
import { useReaderChart } from "../ReaderChartContext";

let enginePromise: Promise<Engine> | null = null;
function browserEngine(): Promise<Engine> {
  return (enginePromise ??= Promise.all([
    import("caelus"),
    import("caelus/data-embedded"),
  ]).then(([{ Engine: E }, { embeddedData }]) => new E(embeddedData)));
}

export default function AspectDialPlate({
  scene, size,
}: { scene: AspectDialScene; size?: number }) {
  const { params } = useReaderChart();
  const [override, setOverride] = useState<AspectDialScene | null>(null);

  useEffect(() => {
    if (!params) {
      setOverride(null);
      return;
    }
    let stale = false;
    Promise.all([browserEngine(), import("caelus-widgets/aspect-dial")])
      .then(([engine, { deriveDial }]) => {
        const s = deriveDial(engine, {
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

  return <AspectDial scene={override ?? scene} size={size} />;
}
