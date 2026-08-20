# caelus-kb

A knowledge base of astrological structure for the Caelus engine: typed
concept nodes, typed edges, and provenance, shipped as one committed
`data/kb.json`. 604 nodes, 578 edges at 0.1.0.

## Three layers

- **KB (this package): structure and provenance.** Mars rules Aries. The 7th
  house means partnership, per Lilly. Regulus sits in Leo. No prose.
- **Corpus (`caelus-corpus`): meaning.** Original readings bound to grid
  cells and atom ids.
- **Encyclopedia (planned): discourse.** Long-form articles. The KB reserves
  a `describedBy` edge per concept; it is empty until slugs exist.

## Derived, never duplicated

`src/generate.ts` derives everything the engine states from the `caelus`
package: bodies, signs, aspects and their default orbs, house systems,
domicile/exaltation and their opposites, Dorothean triplicities, Egyptian
terms, Chaldean faces, nakshatras and their Vimshottari lords, vargas, named
yogas, the star catalog, and the IAU constellation table. `npm run generate`
writes `data/kb.json`; the file is committed. The drift test
(`test/drift.test.ts`) re-derives from the installed engine and fails if the
committed file disagrees. If the engine changes, regenerate and commit; do
not edit `kb.json` by hand.

Curated facts live in small JSON files beside it and are hand-maintained:
`traditions.json`, `sources.json` (seeded from the
`caelus-delineations-pd` manifest), `house-topics.json` (Lilly's house
significations, each attested to a source id), `wikidata.json` (QIDs for the
10 planets and 12 signs only), and `mcp-tools.json` (concept to
`caelus-mcp` tool name). Liber 777 correspondences are not copied: the
generator reads `caelus-delineations-pd/data/correspondences.json` at build
time and emits `correspondsTo` edges for entries that name a chart body.

Two derivations are vendored because the engine does not export the tables:
the Hermetic lot operand pairs (inside `hermeticLots()` in
`packages/caelus/src/lots.ts`) and the sign-polarity parity rule (the engine
has no polarity table). Both are marked in `src/generate.ts` and should move
to engine exports when available. Yoga names are module-private too, but the
generator harvests them through the public `detectYogas()`.

## Id scheme

Concept ids extend the repo's existing style: `body:mars`, `sign:aries`,
`house:7`, `aspect:square`, `dignity:exaltation`, `lot:fortune`,
`star:regulus`, `constellation:leo`, `nakshatra:rohini`, `varga:d9`,
`yoga:gajakesari`, `technique:zr`, `chart-type:synastry`,
`tradition:hellenistic`, `person:william-lilly`, `source:liber-777`.
Engine body ids are kept verbatim (`body:true_node`); display names are
slugged (`nakshatra:purva-phalguni`). Time-lord systems use the
`technique:` prefix with node type `TimeLordSystem`.

Edges are flat records `{ type, from, to, ...qualifiers }`. `to` is a
concept id except on `computedBy` (an MCP tool name) and `sameAs`
(`wikidata:Q111`). Qualifiers carry the rest: `sect` on `triplicityRuler`,
`fromDeg`/`toDeg` on `termRuler`, `decan` on `faceRuler`, `role` on
`lotFormula` (the day formula is Asc + added - subtracted; night reverses),
`locus` on `correspondsTo`. `starNature` and `describedBy` are declared but
empty: the repo has no structured star-nature table and no encyclopedia
slugs yet.

## API

```ts
import {
  nodes, edges, conceptById, edgesFrom, edgesTo, related,
  parseAtomId, parseCellId, JSONLD_CONTEXT,
} from "caelus-kb";

conceptById("body:mars");            // { id, type: "Body", label: "Mars" }
edgesFrom("body:mars");              // rules, exaltedIn, termRuler, ...
parseAtomId("aspect:mars~saturn:square");
// ["body:mars", "body:saturn", "aspect:square"]
parseCellId("transit:saturn:house:7");
// ["chart-type:transit", "body:saturn", "house:7"]
```

The parsers decompose engine fact-atom ids
(`packages/caelus/src/interpretation.ts`) and corpus grid cell ids
(`packages/caelus-corpus/src/grid.ts`) into concept ids. They are pure
string decomposition and return `[]` for unknown formats. `JSONLD_CONTEXT`
maps nodes toward schema.org `DefinedTerm`/`DefinedTermSet`.

The module does not import `caelus` at runtime; only the generator and the
drift test do.

## Scripts

- `npm run build`: tsc.
- `npm run generate`: tsc, then rewrite `data/kb.json` from the engine and
  the curated files.
- `npm test`: drift test plus parser tests, plain node.
