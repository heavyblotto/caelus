/**
 * caelus-widgets — widget specs.
 *
 * Every widget is a pure function of a serializable spec: one schema,
 * `{ kind, params }`, works as an MDX prop, a URL query, an embed
 * payload, and MCP structuredContent. Same spec, same output, on any
 * host. The instant is always explicit — a widget never defaults to
 * "now", so the resting render (the plate) is a build-time constant.
 *
 * The union grows one member per widget kind as kinds land (the
 * catalog lives in docs/product/encyclopedia-widgets-plan.md); it
 * starts with the derivation widget.
 */
import type { HouseSystem } from "caelus";

/** A civil instant, UT. Explicit by contract: no widget defaults to
 *  "now"; "set to now" is an interaction, never a spec value. */
export interface PlateInstant {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export interface PlatePlace {
  latDeg: number;
  lonEastDeg: number;
  /** Caption text for the place ("Tampa (27.95° N, 82.46° W)"). */
  label?: string;
}

/** The chart-defining params shared by every widget that draws a
 *  chart. The reader's chart context overrides these — a reader's
 *  chart is just params, so determinism holds. */
export interface ChartParams {
  instant: PlateInstant;
  place: PlatePlace;
  /** caelus house system name; defaults to placidus. */
  houseSystem?: HouseSystem;
}

/** Params for the derivation widget: sky to sphere to wheel. */
export interface DerivationParams extends ChartParams {
  /** Resting scrub position in [0, 1]; the plate renders here.
   *  Defaults to 1 (the finished wheel). */
  t?: number;
  /** Body id to follow through the morph, if any. */
  follow?: string;
  /** Draw the optional station captions. */
  captions?: boolean;
}

export interface DerivationSpec {
  kind: "derivation";
  params: DerivationParams;
}

/** The wheel's anatomical layers, in tutorial build order: the figure
 *  is learned before the doctrine, so the horizon cross comes first
 *  and the aspect web last. `horizon` is the horizon–meridian cross
 *  (the four angles); `houses` the cusp spokes and numbers. */
export const ANATOMY_LAYERS = [
  "horizon", "zodiac", "houses", "bodies", "aspects",
] as const;

export type AnatomyLayer = (typeof ANATOMY_LAYERS)[number];

/** Params for the wheel-anatomy widget: layer toggles build the figure. */
export interface WheelAnatomyParams extends ChartParams {
  /** Layers visible at rest; the plate renders these. Defaults to all
   *  (the finished figure). */
  layers?: AnatomyLayer[];
}

export interface WheelAnatomySpec {
  kind: "wheel-anatomy";
  params: WheelAnatomyParams;
}

/** Params for the house-comparator widget: one birth through the
 *  twelve systems. `houseSystem` is the reference; `compare` is the
 *  system the plate draws and tables against it at rest. */
export interface HouseComparatorParams extends ChartParams {
  compare?: HouseSystem;
}

export interface HouseComparatorSpec {
  kind: "house-comparator";
  params: HouseComparatorParams;
}

/** Params for the zodiac-drift widget: the tropical and sidereal
 *  rings overlaid, the ayanamsa gap under a century scrubber. The
 *  instant anchors the resting year; the place rides along for the
 *  uniform chart contract (the gap itself is global). */
export interface ZodiacDriftParams extends ChartParams {
  /** Sidereal mode at rest ("lahiri"); the picker offers all five. */
  ayanamsa?: string;
}

export interface ZodiacDriftSpec {
  kind: "zodiac-drift";
  params: ZodiacDriftParams;
}

/** Params for the aspect-dial widget: two bodies on a circle, the orb
 *  to the nearest aspect, and a live aspectarian under an orb slider. */
export interface AspectDialParams extends ChartParams {
  /** First body of the pair; defaults to the Sun. */
  a?: string;
  /** Second body of the pair (the one that drags); defaults to the Moon. */
  b?: string;
  /** Resting orb ceiling for the aspectarian, degrees; defaults to 6. */
  orb?: number;
}

export interface AspectDialSpec {
  kind: "aspect-dial";
  params: AspectDialParams;
}

/** The discriminated union over every widget kind. */
export type WidgetSpec =
  | DerivationSpec
  | WheelAnatomySpec
  | HouseComparatorSpec
  | ZodiacDriftSpec
  | AspectDialSpec;

export type WidgetKind = WidgetSpec["kind"];
