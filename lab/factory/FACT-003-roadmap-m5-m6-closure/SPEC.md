# FACT-003: Roadmap Milestones 5 and 6 Closure

- **Factory ID**: `FACT-003`
- **Status**: `queued`
- **Roadmap Reference**: `ROADMAP.md` ("Next: deep time and measured uncertainty", Milestones 5 and 6)
- **Target Surfaces**: `python/astroengine/`, `packages/caelus/src/`, `packages/caelus-mcp/src/core.ts`, `apps/web/`, `.github/workflows/mint-body.yml`, `docs/`

## 1. Objective

Close the two explicit planned remainders recorded in `ROADMAP.md`:

1. **Milestone 5 remainder**: Add declarative heliacal visibility predicates to
   the `when()` query engine (`python/astroengine/query.py` and
   `packages/caelus/src/query.ts`) so callers can combine heliacal visibility
   with aspects, sign placements, and retrograde states using `allOf`, `anyOf`,
   and `not`.
2. **Milestone 6 remainder**: Expose a Node-free `minted_bodies` MCP tool in
   `packages/caelus-mcp/src/core.ts` that lists published minted asteroid packs,
   inspects their measured Horizons certificates (`MintCertificate`), and loads
   SHA-256-verified CPK1 packs on demand; also execute the first end-to-end
   dispatch of `.github/workflows/mint-body.yml` (starting with `433 Eros`) to
   verify the published artifact format.

## 2. Workstream A: `when()` Heliacal Predicate (Milestone 5)

### API Design

In `python/astroengine/query.py` and `packages/caelus/src/query.ts`:

```ts
export function heliacalVisible(
  target: BodyId | string,
  place: { lat: number; lonEast: number; altM?: number },
  opts?: {
    window?: "morning" | "evening" | "either";
    method?: "visibility" | "arcus";
    extinction?: number;
    arcusDeg?: number;
  },
): Predicate;
```

- **Continuous signed margin semantics**: Consistent with `when()` (`margin >= 0`
  iff predicate holds), `heliacalVisible` evaluates the daily best twilight
  visibility margin (in visual magnitudes above Schaefer's eye threshold for
  `method: "visibility"`, or solar depression minus `arcusDeg` for
  `method: "arcus"`).
- **Performance guard**: Heliacal visibility changes smoothly on a daily cycle,
  so `heliacalVisible` uses a daily-memoized envelope keyed by integer UT day
  (interpolating smoothly across day boundaries) to prevent redundant twilight
  root-finds during `when()` bisection.
- **Composition**: Returns a standard `Predicate` carrying `bodies = Set([target, "sun"])`
  so `allOf(heliacalVisible("venus", place, { window: "evening" }), inSign("venus", "Taurus"))`
  works without changing `when()`'s root finder.

### Reference-First Gates (Stages 1 and 2)

1. Implement in `python/astroengine/query.py` + `python/test_query.py`
   (invariants: visibility interval edges match `heliacal()` rising/setting
   dates within `<= 1` day; composition with `inSign` and `not` yields exact
   set intersection/complement).
2. Export golden fixture `packages/caelus/test/query-heliacal-golden.json`.
3. Port to `packages/caelus/src/query.ts`, re-export from
   `packages/caelus/src/index.ts`, and pin parity in
   `packages/caelus/test/query-heliacal-golden.test.ts` (`<= 1e-6`).

## 3. Workstream B: `minted_bodies` MCP Tool and First Workflow Run (Milestone 6)

### API Design (100% Node-Free in `packages/caelus-mcp/src/core.ts`)

Register tool `minted_bodies` with two modes:

- `action: "list"`: Returns the catalog of published minted certificates
  (ID, IAU number, JPL name, Horizons orbit solution, year span,
  `error.max_au`, `error.angle_bound_arcsec`, `pack.bytes`, `pack.sha256`,
  `minted` date). Uses `fetch` (Web standard, Cloudflare Worker safe) against
  the configured static manifest URL or bundled index, with zero `node:fs` or
  `process` access inside `core.ts`.
- `action: "inspect"` / `"position"`: Fetches and verifies the certificate via
  `checkMintCertificate`, downloads the CPK1 pack bytes via `fetch`, checks
  length and SHA-256 via `crypto.subtle` (`MintIntegrityError` on any mismatch
  before decoding a single byte), registers the body on a scoped `Engine`, and
  returns the verified position/certificate metadata at the requested `date`.

### Security and Purity Constraints

- Allowlist only HTTPS manifest origins configured by the server host (never
  allow arbitrary SSRF URLs from untrusted tool arguments).
- Enforce strict byte cap on fetched `.cpk` packs before hashing.
- Pass `node scripts/check-mcp-surface.mjs` (verifying `core.ts` stays Node-free
  and `apps/web/app/api/mcp/route.ts` mirrors `minted_bodies` in `TOOLS`).

### Workflow Verification

- Run `.github/workflows/mint-body.yml` via `workflow_dispatch` for asteroid
  `433` (`eros`) over `1900-2100`, verify the published certificate and `.cpk`
  checksums, and confirm both Python (`astroengine.minted`) and TypeScript
  (`packages/caelus/src/minted.ts`) decode identical longitudes against JPL
  Horizons validation epochs.

## 4. Acceptance Gates (Stages 3 and 4)

1. `npm run test:python` (all suites green including new heliacal query tests).
2. `npm run build -w caelus && npm run test -w caelus` (parity `<= 1e-6`).
3. Update `packages/caelus-mcp/verify_tools.mjs`, `integration.test.mjs`,
   `eval/run.mjs`, `scripts/export-mcp-golden.mjs`, `MCP_SPEC.md`, `llms.txt`,
   and `apps/web/app/docs/minted-bodies/page.mdx` + `apps/web/app/docs/heliacal/page.mdx`.
4. `npm run stats:golden && node scripts/sync-facts.mjs --write && npm run lint:claims`.
5. `npm run check:mcp-surface && npm run lint:emdash && npm run lint:prose`.
6. Independent `verifier` passes full `npm run preflight`.
7. Update Milestones 5 and 6 status rows in `ROADMAP.md`.
