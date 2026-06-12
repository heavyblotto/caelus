# caelus / ephemengine.com / mymagus — Architecture v0.1

## Naming & registries (verified available 2026-06-10)
- npm: `caelus` (engine), `caelus-mcp` (server), scope `@caelus` — all free.
- PyPI: `caelus` is taken (a CFD toolkit); use `caelus-engine` for the
  Python reference implementation & data-fitting toolchain.
- Domains: ephemengine.com (developer/engine property), mymagus.com
  (consumer app). Two properties on purpose — see Product strategy.

## Monorepo layout (this repo)
```
caelus/
  packages/caelus        TS engine (MIT). Zero deps, zero I/O in core.
  packages/caelus-mcp    MCP server: stdio bin + exportable buildServer()
  apps/web               Next.js 15 — seed for both properties
  MCP_SPEC.md            tool contract + rationale
  ARCHITECTURE.md        this file
```
Python reference (validation oracle + Chebyshev fitting pipeline) lives in
`python/` in this repo: it mints data and golden fixtures; it is not a
runtime dependency of anything. (`caelus-engine` on PyPI reserved for a
future standalone release.)

## The three-runtime story (one codebase)
The engine takes injected `EngineData` and never touches I/O, so identical
code serves:
1. **Browser** — `caelus/data-embedded` bundles ~85 KB gz; measured route
   JS in production Next build: 81.6 kB. Charts compute client-side in
   single-digit ms. Precise-moon tier (729 KB) lazy-loads on demand.
2. **Edge** — `/api/chart` runs on Vercel edge runtime (no fs, no cold
   ephemeris files — historically the #1 pain deploying Swiss Ephemeris
   to serverless).
3. **Node/MCP** — `caelus-mcp` over stdio locally, Streamable HTTP hosted.

## Durability decisions
- **Conformance suite as the spine.** Swiss Ephemeris validates Python;
  Python golden fixtures (1,438 checks) validate TS; CI keeps both green.
  Accuracy regressions are structurally impossible to ship silently.
- **Data as versioned artifacts.** The JSON coefficient files are build
  outputs of the Python pipeline with documented provenance (VSOP87,
  DE423, IAU 1980; Chiron fit from geometric JPL Horizons vectors).
  Ship them versioned (`caelus-data@2026.06`), so engine
  code and data evolve independently.
- **No framework coupling.** Engine is plain ESM + JSON. Next.js, Vercel,
  even MCP are replaceable shells around it.

## Agentic development workflow (recommendations)
- Golden fixtures are the agent guardrail: delegate ports/refactors/new
  features to coding agents with "suite must stay green" as the acceptance
  test. This already worked once (the TS port).
- New bodies (Ceres, Pallas, Juno, Vesta, Lilith) are agent-sized tasks:
  run fit pipeline → add body enum → regenerate fixtures → green.
- Keep PORTING-NOTES (mod() semantics, summation order) in-repo; they are
  written for agents as much as humans.
- For AI-assisted consumers: ship llms.txt + typed examples on
  ephemengine.com; the MCP server itself is the ultimate "docs" (models
  learn the API by calling it).

## Knowledge layer (the mymagus differentiator)
Pipeline mirrors tarotbook/mysteryschools: scan corpus (Hand, Forrest,
Hellenistic translations, esoteric traditions) → chunk + embed → KG.
The astrology-specific upgrade: **every KG node links to a machine-checkable
chart predicate** (e.g. `transit(saturn, square, natal.moon)`,
`natal(mars, house=8)`, `dignity(venus, domicile)`). caelus evaluates
predicates; retrieval = "passages whose predicates are TRUE for this
chart/now". Interpretations become *verified retrieval + synthesis with
citations to named authors* rather than vibes — a defensible quality moat
over generic LLM astrology, and the corpus's provenance (real lineages,
real authors) is the brand.

Feedback flywheel (proven on tarotbook): prompt users to date/verify
biographical events → store as (event, timestamp) pairs → correlate
against exact transit history via find_aspect_dates → (a) personal
pattern surfacing, (b) rectification evidence, (c) anonymized aggregate
research data nobody else has.

## Product strategy (free/paid split)
- **Free / open:** `caelus` npm package (MIT), stdio MCP server, docs,
  the conformance suite. This is the wedge: every developer and every
  AI model that touches astrology should hit caelus first.
- **Hosted (ephemengine.com):** managed MCP + REST, keys, rate limits,
  SLAs, precise-moon + extended-bodies data tiers, batch endpoints
  (10k charts/call for app developers). Pricing: generous free tier,
  usage-based above.
- **Consumer (mymagus.com):** the flagship demo that happens to be a
  product — readings powered by KG + caelus, journaling/verification
  loops, rectification sessions, pattern timelines. Feature-parity scan
  against incumbents (astro.com, Co-Star, TimePassages) is realistic:
  the engine already covers their computational core.
- tarotbook.ai swaps to caelus after mymagus ships (second integration
  proves the package's generality).

## Next build steps (suggested order)
1. Add the big-4 asteroids & Lilith (Chiron re-fit from Horizons: done);
   cut `caelus@0.1.0` + `caelus-mcp@0.1.0` to npm.
2. Streamable HTTP mount of buildServer() at ephemengine.com/api/mcp.
3. Docs site on ephemengine.com (the validation table IS the landing page).
4. KG ingestion pipeline for the scanned corpus + predicate schema.
5. mymagus.com app: natal onboarding → daily transits → journaling loop →
   rectification flow.
