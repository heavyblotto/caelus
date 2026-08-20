"use client";
/**
 * Client half of a zodiac-drift plate. Same contract as the other
 * plates: the server rendered the article's scene; hydration attaches
 * the ayanamsa picker and the century rail, and a reader's chart
 * swaps in a recomputed scene. Uniquely among the plates, the drift
 * needs no engine and no data tier — the ayanamsa is a pure
 * precession function, so the override recomputes in place.
 */
import { useEffect, useState } from "react";
import { ZodiacDrift } from "caelus-widgets/zodiac-drift-widget";
import {
  deriveDrift, type ZodiacDriftScene,
} from "caelus-widgets/zodiac-drift";
import { useReaderChart } from "../ReaderChartContext";

export default function ZodiacDriftPlate({
  scene, size,
}: { scene: ZodiacDriftScene; size?: number }) {
  const { params } = useReaderChart();
  const [override, setOverride] = useState<ZodiacDriftScene | null>(null);

  useEffect(() => {
    if (!params) {
      setOverride(null);
      return;
    }
    setOverride(deriveDrift({
      ...scene.params,
      instant: params.instant,
      place: params.place,
    }));
  }, [params, scene]);

  return <ZodiacDrift scene={override ?? scene} size={size} />;
}
