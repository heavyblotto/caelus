/**
 * caelus-widgets — plate registry types.
 *
 * Plates are first-class objects: they carry their own kind mark,
 * appear as search results ("Fig. 1 · The horizon axis", located "In
 * Ascendant §1"), and the home page counts them. The registry is
 * built at compile time by an MDX AST scan over the Encyclopedia
 * sources; it feeds the search index, the plate count, the figure
 * harness, and the reproduce permalinks.
 */
import type { WidgetSpec } from "./spec.js";

/** Where a plate lives: the owning entry and a section locator. */
export interface PlateLocation {
  /** Entry slug ("ascendant"). */
  entry: string;
  /** Section anchor within the entry, when the scan can resolve one. */
  section?: string;
}

export interface PlateRecord {
  /** Stable plate id ("ascendant-fig-1"). */
  id: string;
  /** Figure number within its entry. */
  figure: number;
  /** The spec that reproduces the plate, JSON-serializable. */
  spec: WidgetSpec;
  /** Apparatus caption text. */
  caption: string;
  location: PlateLocation;
  /** KB node the plate illustrates ("kb:angle/ascendant"), when one
   *  exists, so search and the infobox link in both directions. */
  kb?: string;
  /** Engine version stamped at build. The figure harness asserts this
   *  equals the version that computed the render hash. */
  engineVersion: string;
}

/** The registry artifact the MDX scan emits. */
export interface PlateRegistry {
  engineVersion: string;
  plates: PlateRecord[];
}
