/**
 * The B2 transit batch, compiled. A subpath entry (`caelus-corpus/transits`)
 * so a consumer can load one batch without bundling the rest.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b2.js";

export const transitSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
