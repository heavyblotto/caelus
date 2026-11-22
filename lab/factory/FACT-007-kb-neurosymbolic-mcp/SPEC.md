# FACT-007: Structured Knowledge Graph (`caelus-kb`) for Neuro-Symbolic MCP Discovery

- **Factory ID**: `FACT-007`
- **Status**: `queued` (**GATED** on R&D Lab ablation proving lift over flat MCP tool schemas)
- **Mined Prior Art**: `archive/feature/house-corpus` (`packages/kb/`: 604 typed nodes, 578 typed edges, `computedBy` MCP links, `parseAtomId`, `parseCellId`, `JSONLD_CONTEXT`, `wikidata.json`, `test/drift.test.ts`)

## 1. Objective and Razor Gate

`packages/kb` already established a strict structural boundary: zero
interpretive prose, typed concept IDs (`body:mars`, `house:7`, `aspect:square`,
`technique:zr`), deterministic parsers decomposing engine atom/cell IDs into
concept references (`parseAtomId`, `parseCellId`), and `computedBy` edges
linking concepts to exact `caelus-mcp` tool names.

Before shipping into the active monorepo or wiring a `caelus://kb` MCP
resource:
1. Run an R&D Lab experiment (`node lab/scripts/lab.mjs new exp kb-mcp-routing`)
   comparing:
   - `Control-Flat-MCP`: existing `caelus-mcp` tool descriptions + `caelus://glossary`
   - `Treatment-KB-Graph`: `caelus-kb` `computedBy` + `parseAtomId` / `parseCellId` lookup
2. Measure multi-step tool selection accuracy, citation fact decomposition
   coverage, and token overhead across 50 realistic agent queries.
3. Promote to Stage 1 only if `Treatment-KB-Graph` beats `Control-Flat-MCP` by
   `>= 15%` with zero drift against `packages/caelus-mcp/src/core.ts` (enforced
   by `drift.test.ts` + `check:mcp-surface`).

## 2. Engine Export Cleanup Identified in Prior Art

From `archive/feature/house-corpus:packages/kb/README.md`:
- Remove two vendored derivations in `kb/src/generate.ts` by exporting the
  Hermetic lot operand table from `packages/caelus/src/lots.ts` and a sign
  polarity table from `packages/caelus/src/chart.ts` if promoted.
- Keep `packages/caelus-mcp/src/core.ts` 100% Node-free (bundle static JSON
  read-only; zero `node:fs` reads).
