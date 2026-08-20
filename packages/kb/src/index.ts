/**
 * caelus-kb: the concept graph of astrological structure behind the Caelus
 * engine. Nodes and edges load from the committed data/kb.json; the drift
 * test proves that file still matches what src/generate.ts derives from the
 * engine. This module has no runtime dependency on `caelus`: the graph is
 * usable without the ephemeris.
 */
import { readFileSync } from "node:fs";
import type { ConceptNode, ConceptEdge } from "./types.js";

export type { ConceptNode, ConceptEdge, NodeType, EdgeType } from "./types.js";
export { parseAtomId, parseCellId } from "./parse.js";
export { JSONLD_CONTEXT } from "./jsonld.js";
export { slug } from "./ids.js";

const kb = JSON.parse(
  readFileSync(new URL("../../data/kb.json", import.meta.url), "utf8"),
) as { version: string; nodes: ConceptNode[]; edges: ConceptEdge[] };

/** The committed graph's version (semver of the kb.json artifact). */
export const KB_VERSION: string = kb.version;

/** Every concept node, grouped by type in a stable order. */
export const nodes: ConceptNode[] = kb.nodes;

/** Every typed edge, flat, in a stable order. */
export const edges: ConceptEdge[] = kb.edges;

const byId = new Map(nodes.map((n) => [n.id, n]));
const byFrom = new Map<string, ConceptEdge[]>();
const byTo = new Map<string, ConceptEdge[]>();
for (const e of edges) {
  (byFrom.get(e.from) ?? byFrom.set(e.from, []).get(e.from)!).push(e);
  (byTo.get(e.to) ?? byTo.set(e.to, []).get(e.to)!).push(e);
}

/** The node with this concept id, or undefined. */
export function conceptById(id: string): ConceptNode | undefined {
  return byId.get(id);
}

/** Edges whose `from` is this concept id. */
export function edgesFrom(id: string): ConceptEdge[] {
  return byFrom.get(id) ?? [];
}

/** Edges whose `to` is this concept id. */
export function edgesTo(id: string): ConceptEdge[] {
  return byTo.get(id) ?? [];
}

/** The distinct neighbor nodes of a concept, over edges in both directions.
 *  External targets (tool names, Wikidata ids) have no node and are skipped. */
export function related(id: string): ConceptNode[] {
  const out: ConceptNode[] = [];
  const seen = new Set<string>([id]);
  for (const e of edgesFrom(id)) {
    if (!seen.has(e.to)) { seen.add(e.to); const n = byId.get(e.to); if (n) out.push(n); }
  }
  for (const e of edgesTo(id)) {
    if (!seen.has(e.from)) { seen.add(e.from); const n = byId.get(e.from); if (n) out.push(n); }
  }
  return out;
}
