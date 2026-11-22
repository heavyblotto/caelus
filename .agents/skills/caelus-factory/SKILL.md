---
name: caelus-factory
description: >-
  Execute the Caelus 5-stage Feature Factory assembly line to turn a proved
  `lab/factory/FACT-*` spec or `ROADMAP.md` milestone into a validated,
  golden-pinned production feature across Python, TypeScript, MCP, widgets,
  and web/site documentation. Use when shipping production code into
  `python/`, `packages/`, `apps/`, or `docs/` with full repo gates and
  adversarial verification.
---

# Caelus Feature Factory Runbook

The Feature Factory moves validated specs from `lab/factory/FACT-NNN-<slug>/`
into production using Caelus's reference-first, zero-dependency, oracle-pinned
discipline. Every stage has explicit file ownership and a hard verification
gate before the next stage starts.

## The 5-Stage Assembly Line

```text
Stage 0: Spec & Branch Isolation
   |
   v
Stage 1: Reference-First Python + Golden Fixture      [gate: npm run test:python]
   |
   v
Stage 2: Zero-Dep TypeScript Port + Parity Benchmark  [gate: build + test -w caelus]
   |
   v
Stage 3: Node-Free MCP, Widgets, Docs & Claims Sync   [gate: check:mcp-surface, lint:*, test:mcp]
   |
   v
Stage 4: Adversarial Verifier + Full Preflight        [gate: npm run preflight]
```

## Stage 0: Spec, Gate Check, and Branch Isolation

1. Read `lab/factory/FACT-NNN-<slug>/SPEC.md` and `manifest.json`.
2. Verify all promotion gates listed in `manifest.json` (for example, an
   upstream `EXP-NNN` receipt with `"status": "pass"` in `lab/LEDGER.md`, or a
   `ROADMAP.md` dependency milestone). Do not start Stage 1 if a required R&D
   gate is still open.
3. Create an isolated feature branch off the target integration branch (never
   work directly on `main`):

   ```bash
   git checkout -b feat/<slug>
   ```

4. Partition file ownership before spawning swarm workers. Two agents must
   never edit the same file in parallel.
5. Set `"status": "active"` in `lab/factory/FACT-NNN-<slug>/manifest.json`.

## Stage 1: Reference-First Python and Golden Fixtures

Skip only for pure UI/widget or MCP-wrapper tracks that add no new engine math
(for example, `FACT-001` wrapping already-shipped `observe.ts`).

1. Implement the reference algorithm in `python/astroengine/<module>.py` using
   Python 3 standard library plus existing `astroengine` modules.
2. Add comprehensive unit and invariant tests in `python/test_<module>.py`.
   Validate against an independent external oracle (JPL Horizons, Swiss
   Ephemeris, or published worked tables) wherever applicable.
3. Write `python/export_<module>_golden.py` to generate frozen golden fixtures
   under `packages/caelus/test/<module>-golden.json`.
4. **Stage 1 Gate**:

   ```bash
   python3 python/test_<module>.py
   python3 python/export_<module>_golden.py
   npm run test:python
   ```

## Stage 2: Zero-Dependency TypeScript Port and Parity Suite

Skip only for pure UI/widget or MCP-wrapper tracks with no new `caelus` core
exports.

1. Port the reference algorithm to `packages/caelus/src/<module>.ts` and export
   its public API and types from `packages/caelus/src/index.ts`.
2. Core engine purity rules (hard requirements):
   - Zero runtime dependencies.
   - Zero `node:*` imports, zero `process` references, zero filesystem or
     network I/O. The same bundle must run in browsers, Cloudflare Workers, and
     Node.
   - Idiomatic camelCase TypeScript keys while preserving exact IEEE float64
     parity with the Python reference.
3. Add `packages/caelus/test/<module>-golden.test.ts` pinning TypeScript output
   to `<module>-golden.json` (state the exact maximum tolerance, typically
   `<= 1e-6`), plus an empirical benchmark / edge-case suite
   `packages/caelus/test/<module>.test.ts`.
4. **Stage 2 Gate**:

   ```bash
   npm run build -w caelus
   npm run test -w caelus
   ```

## Stage 3: Node-Free MCP, Widgets, Docs, and Claims Sync

Execute the sub-tracks declared in `SPEC.md`:

### 3A. MCP Surface (`packages/caelus-mcp/` + `apps/web/app/api/mcp/route.ts`)

1. Register new tools in `packages/caelus-mcp/src/core.ts` with Zod input and
   output schemas exported in `OUTPUT_SCHEMAS`.
2. **Cloudflare Worker safety rule**: `packages/caelus-mcp/src/core.ts` MUST
   stay 100% free of `node:*` imports, `caelus/node`, `process.*`, `require()`,
   and `import.meta`. Anything touching the local filesystem belongs only in
   `packages/caelus-mcp/src/server.ts`.
3. Mirror every tool name, resource URI, and prompt name in the `TOOLS` /
   metadata arrays in `apps/web/app/api/mcp/route.ts`.
4. Update MCP oracle tests and frozen goldens:
   - `packages/caelus-mcp/verify_tools.mjs`
   - `packages/caelus-mcp/integration.test.mjs`
   - `packages/caelus-mcp/eval/run.mjs`
   - `node scripts/export-mcp-golden.mjs`
   - `MCP_SPEC.md` and `llms.txt`

### 3B. Workbench Widgets and Instruments (`packages/widgets/`, `apps/web/`, `apps/site/`)

Follow `apps/web/DESIGN.md` Workbench instrument grammar strictly:
1. Split pure deterministic logic (`packages/widgets/src/<slug>.ts`) from React
   hooks UI (`packages/widgets/src/<slug>-widget.tsx`) for clean React Server
   Component client boundaries.
2. Emit Workbench CSS classes (`.bench`, `.tile`, `.control`, `.field`, `.btn`,
   `.seg`, `.tabs__tab`) and inline SVG figures; avoid ad-hoc inline style
   objects.
3. Include the three-column instrument layout (Input, Output with headline
   result and figure, Copyable TypeScript Call) followed by three short Method
   tiles (M-1, M-2, M-3).
4. Add exports and test wiring in `packages/widgets/package.json` plus
   `packages/widgets/test/<slug>.test.ts`.
5. Register the instrument in `apps/web/lib/instruments.ts` (next sequential
   `I-NN` ID), add Next routes under `apps/web/app/instruments/<slug>/`, update
   `apps/web/app/sitemap.ts`, and mirror the Astro page and island loader in
   `apps/site/src/pages/instruments/<slug>.astro` and
   `apps/site/src/islands/registry.ts`.
6. **Optional Visual Quality Audit (`tufte-critique`)**: If the machine-local
   `tufte-critique` skill (`~/.gemini/config/skills/tufte-critique/`, kept
   outside the repository to preserve Caelus's MIT license) is installed,
   review inline SVG figures and tables against its 9-criterion VDQI rubric
   (data-ink ratio, lie factor, direct labeling, small multiples) and apply any
   notes recorded in `lab/factory/FACT-NNN-<slug>/tufte-notes.md`.

### 3C. Docs, Editorial Voice, and Facts/Claims Sync

1. Write guides and copy strictly in Caelus's editorial voice
   (`docs/editorial-voice.md` and `docs/ai-slop-style-sheet.md`): direct
   developer prose, zero em-dashes (no U+2014 character or HTML em-dash
   entity), zero marketing hype, and runnable `ts run` examples in MDX docs.
2. Synchronize generated counts and claims:

   ```bash
   npm run build -w caelus
   npm run stats:golden
   node scripts/sync-facts.mjs --write
   ```

   Update `scripts/claims-registry.json` if any tracked capability count
   changed.

3. **Stage 3 Gate**:

   ```bash
   npm run build
   npm run check:mcp-surface
   npm run check:docs
   npm run facts:sync
   npm run lint:claims
   npm run lint:emdash
   npm run lint:prose
   npm run test:mcp
   npm run test -w caelus-widgets
   npm run test:docs-examples
   npm run test:web-libs
   ```

## Stage 4: Adversarial Verifier and Full Preflight

Never let the author of Stages 1 through 3 self-certify the final merge.

1. Hand off to an independent **Verifier** agent (read-only audit; does not
   edit code).
2. Freeze git commits while Verifier runs so the working tree stays stable.
3. Verifier executes the full repository gate list and reports exact counts:

   ```bash
   npm run test:python
   npm run build
   npm run preflight
   ```

   `npm run preflight` expands to:
   - `npm run check:versions`
   - `node scripts/check-tarball.mjs`
   - `node scripts/check-docs.mjs`
   - `node scripts/check-mcp-surface.mjs`
   - `npm run test` (core `caelus`, `delineations-pd`, `corpus`, `birth`,
     `test:wheel`, `caelus-widgets`, `test:mcp`)
   - `npm run lint:prose`
   - `npm run lint:emdash`
   - `npm run facts:sync`
   - `npm run lint:claims`
   - `node scripts/test-web-libs.mjs`
   - `npm run test:docs-examples`
   - `npm run test:web`

   If `apps/site/` was modified, Verifier also runs:

   ```bash
   npm run build:site
   npm run smoke:site
   ```

   For any UI/widget/instrument change, Verifier also confirms rendered DOM
   completeness (non-zero rendered SVG nodes for every instrument figure, live
   interactive state updates, and readable contrast in both dark and light
   themes; see the `caelus-free-audit.md` regression lesson recorded in
   `lab/BACKLOG.md`).

4. If Verifier reports any defect, route it back to the owning stage worker,
   fix it, and rerun Stage 4 until every check passes with zero failures.
5. Once Verifier posts `[done]` with a clean preflight receipt:
   - Update `lab/factory/FACT-NNN-<slug>/manifest.json` to `"status": "shipped"`
     (or `"proved"` while awaiting PR merge) and record the receipt in
     `results.json`.
   - Run `node lab/scripts/lab.mjs ledger`.
   - Commit cleanly on `feat/<slug>` and open the PR (never push without user
     request).

## Reusable Swarm Role Templates

Use these role definitions when executing a Factory track in `/swarm` mode:

| Role | Owns | Must Not Touch | Handoff Target |
|---|---|---|---|
| `python-ref` | `python/astroengine/<mod>.py`, `python/test_<mod>.py`, `python/export_<mod>_golden.py`, `packages/caelus/test/<mod>-golden.json` | `packages/caelus/src/`, `packages/caelus-mcp/`, `apps/`, `docs/` | `@ts-engine [done]` |
| `ts-engine` | `packages/caelus/src/<mod>.ts`, `packages/caelus/src/index.ts`, `packages/caelus/test/<mod>*.test.ts` | `python/`, `packages/caelus-mcp/`, `apps/`, `docs/` | `@mcp-and-docs` (or `@widget-builder`) `[done]` |
| `mcp-and-docs` | `packages/caelus-mcp/`, `apps/web/app/api/mcp/route.ts`, `apps/web/app/docs/`, `MCP_SPEC.md`, `llms.txt`, `scripts/claims-registry.json`, `packages/caelus/accuracy.json` | `python/`, `packages/caelus/src/`, `packages/widgets/` | `@verifier [done]` |
| `widget-builder` | `packages/widgets/src/<slug>*`, `packages/widgets/test/<slug>.test.ts`, `packages/widgets/package.json`, `apps/web/lib/instruments.ts`, `apps/web/app/instruments/<slug>/`, `apps/site/` | `python/`, `packages/caelus/src/`, `packages/caelus-mcp/` | `@verifier [done]` |
| `verifier` | Read-only audit across the entire workspace | Must not edit any file or run `git commit` | `@coordinator [done]` (or defects back to owning peer) |

## Branch Isolation Rules

- One Factory track per feature branch (`feat/<slug>`), or use git worktrees
  via `workspace: "share"` when running two independent Factory tracks in
  parallel.
- Never run `git commit`, `git checkout`, or `npm run build` inside the same
  working tree while `verifier` is executing `npm run preflight`.
- Keep R&D Lab experiments (`lab/experiments/`) out of production release
  commits unless explicitly intended; production PRs should stay focused on
  `python/`, `packages/`, `apps/`, `docs/`, and `scripts/` plus the updated
  Factory manifest/ledger.
