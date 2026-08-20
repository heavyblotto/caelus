/**
 * The B4 timing batch (time-lords, lunations, eclipses, returns, solar
 * phases), compiled. A subpath entry (`caelus-corpus/timing`) so a consumer
 * can load one batch without bundling the rest.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b4.js";

export const timingSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
