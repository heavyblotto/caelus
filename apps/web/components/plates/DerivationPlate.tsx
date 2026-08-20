"use client";
/**
 * Client half of a derivation plate. The server rendered the article's
 * scene (the plate); hydration attaches the scrub console beneath it
 * and changes nothing above. When the reader has entered a chart, this
 * recomputes the scene in the browser from the embedded data tier and
 * swaps it in — the reader's chart is just params, so the swap is one
 * prop. The engine and its data load only when an override exists,
 * keeping the ~100 KB tier out of the article bundle for anonymous
 * readers.
 */
import { useEffect, useState } from "react";
import type { Engine } from "caelus";
import { ChartDerivation } from "caelus-widgets/derivation-widget";
import type { DerivationScene } from "caelus-widgets/derivation";
import { useReaderChart } from "../ReaderChartContext";

// One browser engine for every plate on the page.
let enginePromise: Promise<Engine> | null = null;
function browserEngine(): Promise<Engine> {
  return (enginePromise ??= Promise.all([
    import("caelus"),
    import("caelus/data-embedded"),
  ]).then(([{ Engine: E }, { embeddedData }]) => new E(embeddedData)));
}

export default function DerivationPlate({
  scene, size,
}: { scene: DerivationScene; size?: number }) {
  const { params } = useReaderChart();
  const [override, setOverride] = useState<DerivationScene | null>(null);

  useEffect(() => {
    if (!params) {
      setOverride(null);
      return;
    }
    let stale = false;
    Promise.all([browserEngine(), import("caelus-widgets/derivation")])
      .then(([engine, { deriveScene }]) => {
        const s = deriveScene(engine, {
          ...scene.params,
          instant: params.instant,
          place: params.place,
          houseSystem: params.houseSystem ?? scene.params.houseSystem,
        });
        if (!stale) setOverride(s);
      })
      .catch(() => {
        // Outside the engine's fitted range (or a load failure): keep
        // the article's scene rather than a broken figure.
        if (!stale) setOverride(null);
      });
    return () => {
      stale = true;
    };
  }, [params, scene]);

  // getEngine powers the clock and latitude controls; it is the same
  // lazy loader, so the tier still only downloads on first use.
  return (
    <ChartDerivation scene={override ?? scene} size={size}
      getEngine={browserEngine} />
  );
}
