/**
 * The Caelus corpus: 3,056 original readings, shipped as compiled
 * InterpretationSources with their own semver. Every entry is bound to a
 * fact the engine can produce, fired against a chart that carries that fact,
 * and linted as prose before it ships.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets, passages } from "./passages.js";

export type {
  Passage, PassageSet, CellFamily, SelectorSpec,
} from "./types.js";
export { LENGTH_BANDS } from "./types.js";
export { ruleFromPassage, compileCorpusSource } from "./compile.js";
export { selectorFromSpec } from "./selectors.js";
export { b1Grid, b2Grid, b3Grid, b4Grid, fullGrid, gridCoverage } from "./grid.js";
export type { GridCell } from "./grid.js";
// The last three are the lints the B3 waves added. They gated as
// writer-facing reports until the repair waves took the backlogs to zero
// (2026-08-19); `lintCorpus` runs them since then. Exported individually so
// the reports use the package API rather than reaching into `dist/`.
export {
  lintPassage, lintCorpus, lintDuplication, lintSharedSentences, lintSkeletons,
  lintNearDuplicateSentences, lintFormulaClusters, lintCrossFamilyEchoes,
  fkGrade, BANNED_PHRASES,
} from "./lint.js";
export type { LintFinding } from "./lint.js";
export { passageSets, passages };
export type { FamilyNote } from "./notes.js";
export { FAMILY_NOTES } from "./notes.js";

/** The corpus version, stamped into the distributed artifact. */
export const CORPUS_VERSION = "0.1.0";

/** The compiled Reading sources, one per passage set. */
export const sources: InterpretationSource[] = passageSets.map(compileCorpusSource);
