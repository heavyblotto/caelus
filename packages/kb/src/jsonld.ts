/**
 * A JSON-LD context for the KB, toward schema.org. Nodes map to
 * DefinedTerm, node types to DefinedTermSet membership; edges with a clean
 * schema.org equivalent map onto it, the rest stay in the kb: namespace.
 * Wikidata alignment is on the `sameAs` edges, not asserted here.
 */
export const JSONLD_CONTEXT = {
  "@context": {
    "@version": 1.1,
    schema: "https://schema.org/",
    kb: "https://ephemengine.com/kb#",
    ConceptNode: "schema:DefinedTerm",
    NodeType: "schema:DefinedTermSet",
    id: "schema:termCode",
    label: "schema:name",
    type: { "@id": "schema:inDefinedTermSet", "@type": "@vocab" },
    data: "kb:data",
    nodes: "schema:hasDefinedTerm",
    edges: "kb:edges",
    from: { "@id": "kb:from", "@type": "@id" },
    to: { "@id": "kb:to", "@type": "@id" },
    sameAs: "schema:sameAs",
    describedBy: "schema:subjectOf",
    attestedIn: "schema:citation",
    correspondsTo: "schema:citation",
    rules: "kb:rules",
    exaltedIn: "kb:exaltedIn",
    detrimentIn: "kb:detrimentIn",
    fallIn: "kb:fallIn",
    triplicityRuler: "kb:triplicityRuler",
    termRuler: "kb:termRuler",
    faceRuler: "kb:faceRuler",
    hasElement: "kb:hasElement",
    hasModality: "kb:hasModality",
    hasPolarity: "kb:hasPolarity",
    opposite: "kb:opposite",
    nakshatraLord: "kb:nakshatraLord",
    inConstellation: "kb:inConstellation",
    starNature: "kb:starNature",
    lotFormula: "kb:lotFormula",
    computedBy: "kb:computedBy",
  },
} as const;
