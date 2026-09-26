/**
 * The B1 natal batch, compiled. A subpath entry (`caelus-corpus/natal`)
 * so a consumer can load one batch without bundling the rest.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b1.js";

export const natalSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
