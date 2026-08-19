/**
 * The house corpus: 3,096 original delineations, shipped as compiled
 * InterpretationSources with their own semver. Every entry is bound to a
 * fact the engine can produce, fired against a chart that carries that fact,
 * and linted as prose before it ships.
 */
import type { InterpretationSource } from "caelus";
import { compileHouseSource } from "./compile.js";
import { passageSets, passages } from "./passages.js";
import { FINDER_FAMILIES } from "./types.js";

export type {
  HousePassage, HousePassageSet, CellFamily, SelectorSpec,
} from "./types.js";
export { LENGTH_BANDS, FINDER_FAMILIES } from "./types.js";
export { ruleFromHousePassage, compileHouseSource } from "./compile.js";
export { selectorFromSpec } from "./selectors.js";
export { b1Grid, b2Grid, b3Grid, b4Grid, b7Grid, fullGrid, gridCoverage } from "./grid.js";
export type { GridCell } from "./grid.js";
// The last three are the lints the B3 waves added. They are writer-facing
// only: `lintCorpus` does not run them yet, because they still report against
// shipped content (see backlog/). Exported so the reports and any future gate
// use the package API rather than reaching into `dist/`.
export {
  lintPassage, lintCorpus, lintDuplication, lintSharedSentences, lintSkeletons,
  lintNearDuplicateSentences, lintFormulaClusters, lintCrossFamilyEchoes,
  fkGrade, BANNED_PHRASES,
} from "./lint.js";
export type { LintFinding } from "./lint.js";
export { passageSets, passages };

/**
 * Family-level context notes (owner decision, 2026-08-16): where a whole
 * body of essays shares a caveat, the caveat lives here once instead of
 * being reworded inside each essay. Surfaces render the note a single time
 * beside any essay the predicate matches.
 */
export interface FamilyNote {
  id: string;
  /** True when a fired rule id belongs to this note's family. */
  appliesTo: (ruleId: string) => boolean;
  note: string;
}

export const FAMILY_NOTES: FamilyNote[] = [
  {
    id: "chiron-thin-tradition",
    appliesTo: (ruleId) => ruleId.includes("chiron"),
    note:
      "Astrologers have only written about Chiron since 1977, so the reading "
      + "here rests on decades of observation rather than centuries. These "
      + "essays keep to the patterns that body of writing agrees on.",
  },
];

/** The corpus version, stamped into prompt packs and portable objects. */
export const CORPUS_VERSION = "0.1.0";

/** The compiled Reading sources, one per passage set. Finder-bank sets
 *  (B7) are validated like every other family but stay out of the Reading:
 *  their entries are the birth-time finder's questions, exported as
 *  {@link finderSets} for that surface to consume directly. */
export const sources: InterpretationSource[] = passageSets
  .filter((s) => !FINDER_FAMILIES.has(s.family))
  .map(compileHouseSource);

/** The B7 finder bank, raw: rising-fit descriptions and event templates. */
export const finderSets = passageSets.filter((s) => FINDER_FAMILIES.has(s.family));
