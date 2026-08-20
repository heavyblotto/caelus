/**
 * The concept-graph schema: node and edge types the KB is allowed to state.
 *
 * A node is a concept the engine or the corpus can address (a body, a sign,
 * a house, a technique). An edge is a typed, flat record between two concept
 * ids, optionally qualified (a term ruler carries its degree range, a
 * triplicity ruler its sect). Meaning lives in the corpus; discourse lives in
 * the encyclopedia; this package states structure and provenance only.
 */

export type NodeType =
  | "Body"
  | "Sign"
  | "House"
  | "HouseSystem"
  | "AspectType"
  | "Element"
  | "Modality"
  | "Polarity"
  | "Sect"
  | "DignityType"
  | "Lot"
  | "FixedStar"
  | "Constellation"
  | "Nakshatra"
  | "Varga"
  | "Yoga"
  | "TimeLordSystem"
  | "ChartType"
  | "Technique"
  | "Tradition"
  | "Person"
  | "SourceText";

export type EdgeType =
  | "rules"
  | "exaltedIn"
  | "detrimentIn"
  | "fallIn"
  | "triplicityRuler"
  | "termRuler"
  | "faceRuler"
  | "hasElement"
  | "hasModality"
  | "hasPolarity"
  | "opposite"
  | "nakshatraLord"
  | "inConstellation"
  | "starNature"
  | "lotFormula"
  | "correspondsTo"
  | "attestedIn"
  | "computedBy"
  | "describedBy"
  | "sameAs";

export interface ConceptNode {
  /** Concept id in the repo's id style, e.g. `body:mars`, `house:7`. */
  id: string;
  type: NodeType;
  label: string;
  /** Structured facts carried on the node itself (an aspect's angle and
   *  default orb, a house's traditional topics, a star's catalog data). */
  data?: Record<string, unknown>;
}

/** A typed edge in the flat edge array. `from` is always a concept id.
 *  `to` is a concept id except on `computedBy` (an MCP tool name) and
 *  `sameAs` (`wikidata:QID`). Extra keys are qualifiers, e.g. `sect` on
 *  a triplicity ruler or `fromDeg`/`toDeg` on a term ruler. */
export interface ConceptEdge {
  type: EdgeType;
  from: string;
  to: string;
  [qualifier: string]: unknown;
}
