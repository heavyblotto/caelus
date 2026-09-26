/**
 * The B6 degree layer (ten-degree faces and degree symbols), compiled.
 * A subpath entry (`caelus-corpus/degrees`) so a consumer can load one
 * batch without bundling the rest.
 */
import type { InterpretationSource } from "caelus";
import { compileCorpusSource } from "./compile.js";
import { passageSets } from "./passages-b6.js";

export const degreeSources: InterpretationSource[] = passageSets.map(compileCorpusSource);
