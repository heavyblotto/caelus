# FACT-005: Portable Versioned JSON Envelopes

- **Factory ID**: `FACT-005`
- **Status**: `queued`
- **Mined Prior Art**: `feature/caelus-free` commit `99a4085` (`docs/product/proposal.md`, "Everything you make is an object you can carry")
- **Target Surfaces**: `python/astroengine/`, `packages/caelus/src/`, `packages/widgets/`, `apps/web/`, `packages/caelus-mcp/`

## 1. Objective

Define a single documented, zero-dependency JSON envelope format so any Caelus
artifact (chart, `observe` verification, chronolocation, geolocation, sky
dating result, chart stability report, or lab receipt) can be saved to disk,
embedded in a URL share link, returned over MCP, or re-imported into any
Workbench instrument with full provenance intact.

## 2. Envelope Contract

```json
{
  "format": "caelus-object",
  "version": 1,
  "kind": "observation-verification",
  "engine": {
    "name": "caelus",
    "version": "0.26.0",
    "tier": "embedded"
  },
  "digest": "sha256-or-chart-digest-hex",
  "created_at": "2026-11-22T15:00:00Z",
  "payload": {}
}
```

Key invariants:
- **Deterministic**: identical input parameters and engine version produce the
  same `digest` and byte-identical canonical JSON across Python and TypeScript.
- **Single source for all exports**: file download (`.caelus.json`), URL share
  codec, copyable API payload, and Instrument I-01..I-05 import dropzone all
  parse the same envelope.
- **Backwards compatible**: existing `caelus-mcp` `OUTPUT_SCHEMAS` remain
  stable; envelope wrapping is either additive metadata or explicit export
  helper (`toPortableObject` / `fromPortableObject`).

## 3. Stage Plan

1. **Stage 1 (Python Reference)**: `python/astroengine/envelope.py` + golden
   round-trip fixtures covering `chart`, `scene_geometry`, `verify_observation`,
   `chronolocate`, and `geolocate`.
2. **Stage 2 (TS Core)**: `packages/caelus/src/envelope.ts` (zero deps, zero
   `node:*`) pinned to golden fixtures.
3. **Stage 3 (Widgets & Instruments)**: unified "Export JSON / Copy Link /
   Import Object" bar across Instruments I-01 through I-05.
4. **Stage 4 (Verifier)**: full `npm run test:python && npm run build && npm run preflight`.
