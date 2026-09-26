/**
 * The B5 conditions batch (lots, dispositors, receptions, stars,
 * parallels, nakshatras, vargas, yogas), compiled. A subpath entry
 * (`caelus-corpus/conditions`) so a consumer can load one batch without
 * bundling the rest.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b5.js";

export const conditionSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
