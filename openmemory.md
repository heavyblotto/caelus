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

## Session plan

The maintainer's working plan for the corpus/Encyclopedia build lives
at `~/.cursor/plans/corpus_scope_and_wiring_72c4cd8e.plan.md`. Read it
at session start and after any context compaction; keep its todo
statuses current. Maintainer decisions on record there: releases
belong to the maintainer; agents do not write rules, scope, phases, or
normative language into project docs.

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
- Engine runtime `VERSION` export (`packages/caelus/src/version.ts`,
  unreleased 0.25.0): string constant equal to `package.json` version,
  asserted by `scripts/check-versions.mjs`. Exists so Encyclopedia figure
  stamps can name the engine without importing package metadata into
  browser bundles. The check fails unless a version bump lands in both
  files.
- Embeddings pipeline (`packages/caelus-corpus/pipeline/embeddings/`): uv
  project, BGE-M3 1024-d on MPS, ~200 s for the full corpus. Outputs:
  gitignored `artifacts/embeddings/essays.parquet`, tracked
  `neighbors.json` (8 per essay) and `backlog/semantic-echoes.md` (cosine
  cutoff 0.88). The echo report excludes sibling pairs (same family +
  first body) and same-family mirror pairs (same unordered body pair +
  aspect): mirrors describe one sky event from swapped roles and repair
  on both sides does not move their similarity.

- Encyclopedia widgets plan (`docs/product/encyclopedia-widgets-plan.md`,
  2026-08-19): engine-driven interactive widgets and computed plates for
  the Encyclopedia and Learning guides. Core commitments: a plate is a
  widget's resting SSR render; every widget is a pure function of a
  serializable `{ kind, params }` spec; instants always explicit; engine
  version stamped on every figure and verified by a figure harness
  (canonical-mode SVG hashes, CI-gated); plate registry built from an MDX
  AST scan; site-wide reader's-chart context; `packages/widgets`
  (caelus-widgets) layering hooks over hook-free `caelus-wheel`; plate
  theme (ink on warm paper, oxblood single accent, per design direction
  1a). Primary widget: `ChartDerivation`, a scrubbed sky-to-wheel morph
  (stations `SKY · SPHERE · ECLIPTIC · HORIZON · WHEEL`) built on
  `skyView` camera math. Engine-side additions ride the open 0.25.0
  cycle (vector-mode projection exports, fisheye-to-orthographic radial
  family, star-field quantities).
- SkyView vector mode (`packages/caelus/src/skyview.ts`, unreleased
  0.25.0): `skyCamera` (no-roll basis, zenith fallback), exported
  `dirFromAzAlt`, `radialScale(shape)` (one-parameter azimuthal family:
  -1 gnomonic, -0.5 stereographic, 0 equidistant, +0.5 equal-area,
  +1 orthographic; `k·tan(θ/k)` / `k·sin(θ/k)` branches, continuous at
  0), and `skyProjector` (refraction-free normalized coordinates,
  az/alt or Vec3 in). Python mirrors `sky_camera` / `radial_scale` /
  `sky_project`; the skyview golden pins a shape×theta grid and six
  projector cases. `skyPlacer` now builds on `skyCamera` (behavior
  unchanged, goldens prove it).
- `caelus-wheel` plate theme (`packages/wheel/src/index.tsx`):
  `PLATE_TOKENS` (paper `#f7f3e9`, panel `#fdfbf5`, ink `#22201c`,
  oxblood accent `#8c2f2a`), `PLATE_THEME` (complete `WheelTheme`, all
  13 bodies named; hard aspects full ink, soft muted), and
  `PLATE_BODY_INKS` (muted earth tints for AstroMap/EphemerisGraph
  `colors` prop; Mars deliberately not oxblood). `render.test.tsx`
  asserts completeness over `GLYPHS` and that oxblood appears in no
  base token.
- `caelus-widgets` (`packages/widgets`, private): the Encyclopedia
  widget system. Root subpath = shared system (`WidgetSpec` union in
  `spec.ts`, registry types in `registry.ts`, `PlateFrame`,
  `PlateConsole`); one subpath per widget kind
  (`caelus-widgets/derivation`, `/wheel-anatomy`). Derivation widget
  splits engine from render: `deriveScene(engine, params)` →
  serializable scene (bodies in both frames, `eclToHor` rotation from
  `azAlt` on the ecliptic basis, wheel payload via shared
  `src/payload.ts`), `DerivationFigure(scene, t)` pure; positions
  always `eclToHor · unitVector(λ, β·(1−s))` so the coordinate handoff
  is exact; settle aims at the ecliptic south pole for wheel
  handedness; `t = 1` renders the real `ChartWheel`. Wheel-anatomy
  widget: same scene/figure split (`deriveAnatomy`,
  `WheelAnatomyFigure(scene, layers)`); layer names
  `horizon · zodiac · houses · bodies · aspects` map onto the
  `ChartWheel` `layers` prop (caelus-wheel, all default on; `axes` =
  the four angles), all-on renders `ChartWheel` byte-identically.
  Figure harness (`test/harness.test.tsx`) hashes every registry plate
  at rest + all five stations (derivation) or the cumulative layer
  build (wheel-anatomy) against `test/figure-hashes.json` and asserts
  stamp = computing `VERSION`; regenerate with
  `CAELUS_FIGURES_WRITE=1`. Widgets test files run individually in
  ci.yml and `check-test-wiring.mjs` now gates the package (root
  `npm test` does not include wheel/widgets).
- Plate registry scan (`scripts/scan-plates.mjs`, `npm run
  plates:scan`): the MDX AST scan over the Encyclopedia sources
  (`apps/web/content/encyclopedia/*.mdx` now;
  `app/encyclopedia/*/page.mdx` when routes land). Reads `<W kind
  params figure caption kb id />` elements, requires params to be JSON
  literals, validates per-kind contracts, asserts figure = document
  order and unique ids, emits `packages/widgets/test/plate-registry.json`
  (the artifact the figure harness gates). CI runs `--check` as a
  drift gate. Growing the `WidgetSpec` union means growing the scan's
  `KINDS` table, the harness `renderPlate` switch, and the `W`
  dispatcher in `apps/web/components/plates/W.tsx`.
- Reader's-chart context (`apps/web/components/ReaderChartContext.tsx`
  + `lib/reader-chart.ts`): site-wide provider mounted in the root
  layout; record is the Playground `Share` shape, read from `#rc=`
  fragment or `caelus:reader-chart` localStorage, never sent to a
  server. `shareToChartParams` converts to widget `ChartParams`.
  `<W>` (registered globally in `mdx-components.tsx`) SSR-renders the
  plate in its frame; the client plate halves
  (`DerivationPlate`/`WheelAnatomyPlate`) lazy-load the embedded tier
  and swap in a browser-computed scene only when a reader chart
  exists. Plate captions now pass the prose gate (extractor pulls
  `caption="..."` before the JSX strip and walks the encyclopedia
  sources).
- Widget-system compatibility surface (hold stable from the kb/corpus
  side): `caelus-kb` node ids, `jsonld.ts` page export,
  `artifacts/embeddings/neighbors.json`, the engine `VERSION` export, and
  cell-id shapes as parsed by `parseCellId` (the plate registry and the
  corpus-link block both resolve through it). Changing grid cell-id shapes
  means updating `packages/kb/src/parse.ts` and the widget consumers
  together.

## Patterns

- Engine `dist/` can go stale against `src/`; a failing golden that expects
  new fields (e.g. `epochSigma`) usually means rebuild (`npm run build -w
  caelus`), not a regression.
- New fact kinds need: union entry, atom interface, `FactAtom` union member,
  `SalienceWeights` field + default, emission block, selector, both doc
  pages' `kind` list (check-docs), CHANGELOG Unreleased, and a recompute
  golden in `test/golden.test.ts`.
- Vale fails the prose gate on new astrology/technical vocabulary until
  it is added to `styles/config/vocabularies/Caelus/accept.txt`.
- Repair waves: disjoint file scopes per agent; edits touch text only
  (id, family, when, atomIds stay as they are); per-file self-check via
  `check-texts.mjs` and `check-family.mjs`; commits stay with the
  orchestrator. Landing = regenerate backlog
  reports, `register-sets.mjs`, build, root test, re-run embeddings (they
  go stale the moment texts change), then commit to dev. The B1/B2 wave
  (2026-08-19, eleven agents, 119 files) cleared its scope to zero
  lexical findings. The B3 review wave (2026-08-19, eleven body-sliced
  reviewers over 60 files / 738 cells) plus mop-ups took all three
  lexical backlogs to zero corpus-wide; a final eight-essay rewrite
  emptied the semantic-echo report at its 0.88 cutoff. Repair program
  complete.
- Encyclopedia article extent is KB-derived: every KB node resolves to
  a full article, a glossary entry, or an explicit not-written marker,
  gated by a coverage report (the Encyclopedia analog of the corpus
  backlog reports); synthesis articles (house division, tropical vs
  sidereal, sect, history) are hand-listed on top.
- Semantic-echo repair (whole-essay paraphrase pairs from
  `backlog/semantic-echoes.md`): edit ONE side per pair, chosen so a shared
  member clears multiple pairs; re-anchor the edited essay in what is
  symbolically unique to its own bodies and tempo (e.g. Sun-Saturn =
  identity/authority vs Moon-Saturn = mood/containment; Pluto = multi-year,
  Mercury = days) and change the structural spine, not just wording.
  Sentence-level lints (formula-cluster, cross-family-echo) still apply to
  the new prose: avoid joining existing opener clusters ("Twice a year the
  transiting Sun ...") and reusing sentence shapes from other families.
- B3 review wave rulings (binding, `pipeline/wave-b3-review.md`): outer-planet
  generational scope caveat in at most one cell per file, cut as a whole move
  elsewhere; the ruling bars birth-year gaps and planet-cycle year figures; the
  abstract soft-aspect beat ("a trine asks nothing") once per file, otherwise
  recast in the entry's own material terms; composite-house
  equal-from-midpoint-asc caveat lives in one prompt-named house per body
  (Uranus: house 11). `check-slice.mjs` takes `<brief.json> <slice.json>`
  with briefs in `pipeline/briefs/`.
- B3 composite-house convention caveat (equal-from-midpoint-asc): per the
  wave-b3 ruling each body's file carries the caveat in exactly one house
  cell named by the wave prompt (e.g. Chiron house 5, true node house 1,
  Venus house 7, Saturn house 2),
  written in that entry's own terms; the move is cut wholesale from the
  body's other house cells. Duration-disclaimer and soft-aspect hedges:
  abstract version at most once per file, otherwise concrete in the
  entry's own terms.
