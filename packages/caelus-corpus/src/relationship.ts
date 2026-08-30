/**
 * The B3 relationship batch (synastry and composite), compiled. A subpath
 * entry (`caelus-corpus/relationship`) so a consumer loads it only when
 * comparing two charts.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b3.js";

export const relationshipSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
