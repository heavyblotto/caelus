# OpenMemory Guide — Caelus

Living index of the Caelus monorepo for memory-assisted development.

## Overview

Caelus is an astrology engine monorepo: a validated ephemeris/chart engine
(`packages/caelus`, npm `caelus`), a public-domain starter interpretation
corpus (`packages/caelus-delineations-pd`), an original interpretation corpus
(`packages/caelus-corpus`, 3,056 essays, not yet published), and a Next.js
site (`apps/web`, ephemengine.com). `dev` is the canonical branch; `main` is
release-only. The corpus work happens on `feature/house-corpus`, which
carries the unreleased engine 0.25.0 source.

## Architecture

- **Engine** (`packages/caelus`): chart computation plus an interpretation
  seam — `interpretationContext()` projects a chart into typed fact atoms
  (`FactKind` union, 27 kinds as of unreleased 0.25.0); `interpret()` runs
  `InterpretationSource` rule corpora against it. Selectors (`hasPlacement`,
  `hasDegree`, ...) live in `src/interpret.ts`.
- **Corpus** (`packages/caelus-corpus`): JSON passages under
  `data/passages/`, registered into per-batch TS modules by
  `pipeline/register-sets.mjs`, compiled to `InterpretationSource`s. Subpath
  exports (`caelus-corpus/natal`, `/transits`, `/relationship`, `/timing`,
  `/notes`) enable lazy loading in the web app.
- **Web** (`apps/web`): Playground `ReadingTab` dynamically imports corpus
  batches per context. Prose gated by root `scripts/lint-prose.sh` (Vale +
  em-dash check); the extractor `scripts/extract-web-prose.mjs` names the
  page and component files it walks.
- **Gates**: root `npm run build` / `npm test` cover engine, PD package, and
  corpus. `scripts/check-test-wiring.mjs` asserts every test file runs in
  CI; `scripts/check-versions.mjs` allows the corpus's forward pin
  (`>=0.25.0 <0.26`); `scripts/check-docs.mjs` asserts the `FactKind` union
  and selector names against both doc pages.

## User Defined Namespaces
- [Leave blank - user populates]

## Components

- `degree` fact kind (engine, unreleased 0.25.0): one atom per placed body
  (mean node sits out when true node present) plus ASC and MC. Ordinal
  degree 1–30 (14°30′ Aries = 15th degree), face index 1–3 on the same
  atom. Ids `degree:<point>:<sign>:<n>`. Selector
  `hasDegree({ point, sign, degree, face })`. B6 essays bind through it.
- Corpus editorial kit (`packages/caelus-corpus/editorial/`): gates the
  editorial guides and writing sheets only; product-copy extraction is the
  host repo's job (the defective carried-over extractor was removed
  2026-08-19).
- `caelus-kb` (`packages/kb`, private): typed concept graph (604 nodes,
  578 edges) derived from engine tables plus curated provenance data;
  committed `kb.json`, drift test, `parseAtomId`/`parseCellId` mapping
  atom and grid-cell ids to concept ids. Forward-pins engine 0.25 like the
  corpus.
- Embeddings pipeline (`packages/caelus-corpus/pipeline/embeddings/`): uv
  project, BGE-M3 1024-d on MPS, ~200 s for the full corpus. Outputs:
  gitignored `artifacts/embeddings/essays.parquet`, tracked
  `neighbors.json` (8 per essay) and `backlog/semantic-echoes.md` (cosine
  cutoff 0.88). The echo report excludes sibling pairs (same family +
  first body) and same-family mirror pairs (same unordered body pair +
  aspect): mirrors describe one sky event from swapped roles and repair
  on both sides does not move their similarity.

## Patterns

- Engine `dist/` can go stale against `src/`; a failing golden that expects
  new fields (e.g. `epochSigma`) usually means rebuild (`npm run build -w
  caelus`), not a regression.
- New fact kinds need: union entry, atom interface, `FactAtom` union member,
  `SalienceWeights` field + default, emission block, selector, both doc
  pages' `kind` list (check-docs), CHANGELOG Unreleased, and a recompute
  golden in `test/golden.test.ts`.
- New astrology/technical vocabulary must be added to
  `styles/config/vocabularies/Caelus/accept.txt` or Vale fails the prose
  gate.
- Repair waves: disjoint file scopes per agent, text-only edits (never id,
  family, when, atomIds), per-file self-check via `check-texts.mjs` and
  `check-family.mjs`, agents never commit. Landing = regenerate backlog
  reports, `register-sets.mjs`, build, root test, re-run embeddings (they
  go stale the moment texts change), then commit to dev. The B1/B2 wave
  (2026-08-19, eleven agents, 119 files) cleared its scope to zero
  lexical findings.
- Semantic-echo repair (whole-essay paraphrase pairs from
  `backlog/semantic-echoes.md`): edit ONE side per pair, chosen so a shared
  member clears multiple pairs; re-anchor the edited essay in what is
  symbolically unique to its own bodies and tempo (e.g. Sun-Saturn =
  identity/authority vs Moon-Saturn = mood/containment; Pluto = multi-year,
  Mercury = days) and change the structural spine, not just wording.
  Sentence-level lints (formula-cluster, cross-family-echo) still apply to
  the new prose: avoid joining existing opener clusters ("Twice a year the
  transiting Sun ...") and reusing sentence shapes from other families.
