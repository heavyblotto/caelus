/**
 * A corpus record: an original reading, bound to the
 * interpretation layer through a serializable selector vocabulary
 * (`./selectors.ts`, vendored from `caelus-delineations-pd`). Every entry
 * inherits the validation floor that vocabulary buys: the geometry a passage
 * attaches to is checked even while its prose is being refined.
 */
import type { SelectorSpec } from "./selectors.js";

export type { SelectorSpec };

/** The cell families of the content grid (proposal §6), batch-scheduled in
 *  build-plan §4. B1 families first; later batches extend this union. */
export type CellFamily =
  | "planet-in-sign"
  | "planet-in-house"
  | "aspect"
  | "rising-sign"
  | "mc-sign"
  | "angle-conjunction"
  | "dignity"
  | "pattern"
  | "signature"
  | "out-of-bounds"
  | "natal-retrograde"
  // B2: the moving sky against the natal chart.
  | "transit-aspect"
  | "transit-house"
  | "transit-station"
  // B4: the timing layer -- time-lords, lunations and eclipses, planetary
  // returns, and the solar-condition ladder.
  | "timelord-profection"
  | "timelord-zr"
  | "timelord-firdaria"
  | "timelord-dasha"
  | "lunation-house"
  | "eclipse"
  | "planetary-return"
  | "solar-phase"
  // B3: two charts against each other.
  | "synastry-aspect"
  | "synastry-overlay"
  | "composite-placement"
  | "composite-aspect"
  | "composite-house"
  // B7: the birth-time finder bank. Validated by the same harness but
  // compiled apart from the Reading sources (see index.ts): these entries
  // are questions the finder asks, not delineations the Reading shows.
  | "finder-rising-fit"
  | "finder-event-angle";

/** Families whose passages serve the birth-time finder, not the Reading. */
export const FINDER_FAMILIES: ReadonlySet<CellFamily> = new Set([
  "finder-rising-fit", "finder-event-angle",
] as CellFamily[]);

/** Length bands per family, in words. Major cells are essays (the Hand
 *  standard); condition chips run proportionally shorter. */
export const LENGTH_BANDS: Record<CellFamily, { min: number; max: number }> = {
  "planet-in-sign": { min: 300, max: 700 },
  "planet-in-house": { min: 300, max: 700 },
  aspect: { min: 300, max: 700 },
  "rising-sign": { min: 300, max: 700 },
  "mc-sign": { min: 250, max: 600 },
  "angle-conjunction": { min: 250, max: 600 },
  dignity: { min: 120, max: 350 },
  pattern: { min: 200, max: 500 },
  signature: { min: 120, max: 350 },
  "out-of-bounds": { min: 120, max: 350 },
  "natal-retrograde": { min: 150, max: 400 },
  "transit-aspect": { min: 300, max: 700 },
  "transit-house": { min: 250, max: 600 },
  "transit-station": { min: 150, max: 400 },
  // B4. Major period framings run essay-length; sub-period pairs and
  // condition chips run proportionally shorter.
  "timelord-profection": { min: 200, max: 550 },
  "timelord-zr": { min: 180, max: 450 },
  "timelord-firdaria": { min: 120, max: 450 },
  "timelord-dasha": { min: 120, max: 450 },
  "lunation-house": { min: 200, max: 500 },
  eclipse: { min: 180, max: 500 },
  "planetary-return": { min: 300, max: 700 },
  "solar-phase": { min: 120, max: 350 },
  // B3. Inter-chart aspects run essay-length like natal aspects; overlays
  // and composite placements sit a band below.
  "synastry-aspect": { min: 250, max: 650 },
  "synastry-overlay": { min: 200, max: 500 },
  "composite-placement": { min: 200, max: 500 },
  "composite-aspect": { min: 200, max: 500 },
  "composite-house": { min: 200, max: 500 },
  "finder-rising-fit": { min: 60, max: 180 },
  "finder-event-angle": { min: 40, max: 140 },
};

export interface Passage {
  /** Stable cell id, e.g. `natal:sun:sign:aries`. */
  id: string;
  family: CellFamily;
  when: SelectorSpec;
  /** Atom-id prefixes the text may cite (checked by the harness). */
  atomIds: string[];
  /** The delineation, second person, at the family's length band. */
  text: string;
  /** Optional ranking nudge relative to salience (default 1). */
  weight?: number;
  tags?: string[];
  /** Ids of entries this one contests, for reconcile(). */
  conflicts?: string[];
}

export interface PassageSet {
  /** One set per family slice, e.g. `house-natal-sun-signs`. */
  id: string;
  version: string;
  family: CellFamily;
  passages: Passage[];
}
