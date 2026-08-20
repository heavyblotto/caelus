"use client";
/**
 * Client half of a retrograde-scrub plate. Same contract as the other
 * plates: the server rendered the article's scene; hydration attaches
 * the console scrubber beneath it, and a reader's chart swaps in a
 * browser-computed scene. The embedded data tier loads only when
 * needed.
 */
import { useEffect, useState } from "react";
import type { Engine } from "caelus";
import { RetrogradeScrub } from "caelus-widgets/retrograde-scrub-widget";
import type { RetrogradeScene } from "caelus-widgets/retrograde-scrub";
import { useReaderChart } from "../ReaderChartContext";

let enginePromise: Promise<Engine> | null = null;
function browserEngine(): Promise<Engine> {
  return (enginePromise ??= Promise.all([
    import("caelus"),
    import("caelus/data-embedded"),
  ]).then(([{ Engine: E }, { embeddedData }]) => new E(embeddedData)));
}

export default function RetrogradeScrubPlate({
  scene, size,
}: { scene: RetrogradeScene; size?: number }) {
  const { params } = useReaderChart();
  const [override, setOverride] = useState<RetrogradeScene | null>(null);

  useEffect(() => {
    if (!params) {
      setOverride(null);
      return;
    }
    let stale = false;
    Promise.all([browserEngine(), import("caelus-widgets/retrograde-scrub")])
      .then(([engine, { deriveRetro }]) => {
        const s = deriveRetro(engine, {
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

  return <RetrogradeScrub scene={override ?? scene} size={size} />;
}
