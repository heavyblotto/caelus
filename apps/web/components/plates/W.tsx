/**
 * `<W kind="..." params={{...}} />` — the one MDX entry point for
 * Encyclopedia widgets. A server component: it runs the engine at
 * build/request time and renders the plate (the widget's resting
 * render) inside the plate frame; the client half hydrates the console
 * beneath it and applies the reader's-chart override.
 *
 * Authoring contract (what the plate-registry scan reads):
 *   - `kind` and `params` are the serializable spec; `params` must be
 *     a JSON literal in the MDX source, so the scan — and any host —
 *     can reproduce the figure from the spec alone.
 *   - `caption` names the configuration the way the design system
 *     does: instant, place, house system.
 *   - `figure` is the figure number within the entry; the scan asserts
 *     it matches document order, so prose references ("Fig. 2") can't
 *     drift.
 *   - `kb` links the KB node the plate illustrates, when one exists.
 *   - `id` overrides the scan's default plate id (`<entry>-fig-<n>`).
 */
import type { ReactElement } from "react";
import {
  PlateFrame,
  type ChartParams, type DerivationParams, type HouseComparatorParams,
  type WheelAnatomyParams, type WidgetSpec,
} from "caelus-widgets";
import { deriveScene } from "caelus-widgets/derivation";
import { deriveAnatomy } from "caelus-widgets/wheel-anatomy";
import { deriveComparator } from "caelus-widgets/house-comparator";
import { sampleEngine } from "../../lib/sample-chart";
import { b64urlEncode, type Share } from "../../lib/share";
import DerivationPlate from "./DerivationPlate";
import WheelAnatomyPlate from "./WheelAnatomyPlate";
import HouseComparatorPlate from "./HouseComparatorPlate";

export interface WProps {
  kind: WidgetSpec["kind"];
  params: WidgetSpec["params"];
  figure: number;
  caption: string;
  /** caelus-kb node the plate illustrates ("chart-type:natal"). Read
   *  (and asserted to exist) by the registry scan; not rendered. */
  kb?: string;
  /** Explicit plate id for the registry scan; defaults there to
   *  `<entry>-fig-<n>`. Not rendered. */
  id?: string;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The reproduce permalink: the spec's chart as a Playground share,
 *  in the fragment so it never reaches the server. */
function reproduceHref(p: ChartParams): string {
  const { instant: i } = p;
  const share: Share = {
    v: 1,
    t: `${pad(i.y, 4)}-${pad(i.mo)}-${pad(i.d)}T${pad(i.h)}:${pad(i.mi)}`,
    la: String(p.place.latDeg),
    lo: String(p.place.lonEastDeg),
    h: p.houseSystem ?? "placidus",
    z: "tropical",
    ...(p.place.label ? { n: p.place.label } : {}),
  };
  return `/playground#c=${b64urlEncode(share)}`;
}

export default function W({
  kind, params, figure, caption,
}: WProps): ReactElement {
  // `kind` and `params` arrive as separate MDX attributes, so the cast
  // per case re-joins the union; the registry scan validated the
  // pairing at build time.
  switch (kind) {
    case "derivation": {
      const scene = deriveScene(sampleEngine, params as DerivationParams);
      return (
        <PlateFrame
          figure={figure}
          caption={caption}
          engineVersion={scene.engineVersion}
          reproduceHref={reproduceHref(params)}
        >
          <DerivationPlate scene={scene} />
        </PlateFrame>
      );
    }
    case "wheel-anatomy": {
      const scene = deriveAnatomy(sampleEngine, params as WheelAnatomyParams);
      return (
        <PlateFrame
          figure={figure}
          caption={caption}
          engineVersion={scene.engineVersion}
          reproduceHref={reproduceHref(params)}
        >
          <WheelAnatomyPlate scene={scene} />
        </PlateFrame>
      );
    }
    case "house-comparator": {
      const scene = deriveComparator(
        sampleEngine, params as HouseComparatorParams,
      );
      return (
        <PlateFrame
          figure={figure}
          caption={caption}
          engineVersion={scene.engineVersion}
          reproduceHref={reproduceHref(params)}
        >
          <HouseComparatorPlate scene={scene} />
        </PlateFrame>
      );
    }
  }
}
