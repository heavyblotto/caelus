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
  `/notes`) enable lazy loading in the web app. The grid enumerates 4,054
  cells: B1–B5 written (3,656 as of 2026-08-20; B5's 600 bindable cells
  across twelve families — lots, dispositors, receptions, stars via the
  curated `B5_STARS` 60, parallels, Moon nakshatras and padas, D9 vargas
  and framings, yogas — written and adversarially reviewed in seven
  waves; the `natal:lot|star|parallel|reception|dispositor:*` and
  `vedic:*` cell-id shapes parse through `parseCellId` since 2026-08-20
  (7ae3a3e; 599/602 — the Kemadruma and raja/dhana yoga cells return []
  for want of KB nodes). B6
  scaffolded 2026-08-20 (bb1a3ed): `b6Grid` adds the degree layer —
  `ten-degree-face` (36 cells, ids `natal:face:<sign>:<1-3>`) and
  `degree-symbol` (360 cells, ids `natal:degree:<sign>:<1-30>`), both
  binding `hasDegree`. Wave b6-01 (the pilot) landed 2026-08-20
  (372dd71): faces-01 + degree-symbols-aries, 42 entries written and
  adversarially reviewed — zero borrowed images, and the pilot's real
  catch was lint-invisible templates (binding scaffold in 10/30 symbol
  entries, nominalized caveat pivot in 10/30, ruler+image sentence in
  7/12 face entries), repaired in place. Twelve rulings recorded in
  `pipeline/wave-b6-01.md` bind the remaining 354 cells (scaffold/pivot/
  closing budgets, per-sign image quotas, shadow-shape quota, two-stage
  originality protocol, anaretic handling for degrees 28-30). Wave 2
  landed 2026-08-20: faces-02 + Taurus/Gemini/Cancer symbols (102
  entries, 144/396 B6 cells written), all four slices adversarially
  reviewed; Cancer and Taurus needed writer rework after review
  (scenario cluster + shadow-genus concentration; a Taurus-28 skeleton
  clone of Aries 28 rewritten). `pipeline/wave-b6-02.md` adds rulings
  13-19: ruling 10 recalibrated (excess-shadow genus at most a third
  of a slice, genus-counted, remainder across 3+ genera — the 2-3 cap
  was set from a surface-label count and never held), scenario typed
  by function+situation, explicit 28/29/30 cross-sign comparison,
  faces image-detail pivot budget, ruling 5 extended to harsh images
  regardless of ruler, sanctioned softening inventory, opener texture,
  flag records cite verified sources and budget self-reports carry
  entry IDs. Wave 3 landed 2026-08-21: faces-03 + Leo/Virgo/Libra/
  Scorpio symbols (132 entries, 276/396 B6 cells written), all five
  slices adversarially reviewed; Virgo and Leo needed writer rework
  (shadow-genus overstay undercounts, re-argued down to 9/30 each).
  `pipeline/wave-b6-03.md` adds rulings 20-29: censuses re-derived by
  second pass over finished text under ruling 13's two-clause genus
  definition (three slices undercounted the overstay clause the same
  way), dual-failure entries counted by lead failure, two new pivot/
  closer shapes folded into rulings 7 and 8, the "faculty here"
  binding capped, originality protocol amendments (name the text swept
  per set — the circulating compilation truncates at Weber; same-degree
  noun adjacency is a flag class; Henson keyword matches never fatal;
  near-misses reported with sources), scene-bound life stages
  sanctioned, sun-as-light gloss, degree-28 steering for the remaining
  signs, faces texture notes. Wave 4 landed 2026-08-21:
  Sagittarius/Capricorn/Aquarius/Pisces symbols (120 entries) —
  B6 complete at 396/396, the degree-symbol family at 360/360. All
  four slices reviewed; the wave's structural catch was the
  parallel-wave gap (ruling 30): writers working concurrently never
  saw each other's drafts, and three slices collided on concrete
  images (summit register twice, cairn, cornerstone box) with every
  gate green — Capricorn re-imaged three entries. `pipeline/
  wave-b6-04.md` adds rulings 30-38: same-wave collision surface,
  the caveat-pivot cap binds the shape not the noun list,
  carrier-frame class cap, corrective textures capped, grep-verified
  censuses, element-quota counting precedent (acted-on subject, not
  medium or setting), remainder-genus diversity notes, ordinal-
  locative policy, same-sign cross-degree scene adjacency. Source
  findings: the archive.org compilation PDF is complete through
  Cochrane (the circulating text truncates at Weber); Janduz labels
  in the extraction sit one behind the ordinal.
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

The private-library ingestion design (maintainer-scanned books → local
OCR → QA harness → KB/corpus/Encyclopedia consumers) lives at
`docs/product/library-ingestion-plan.md` (2026-08-20). Its "Text
mining" section (added 2026-08-20 at the maintainer's request) adds a
deterministic decomposition layer over the library, Encyclopedia, and
corpus: standoff annotations, a KB-gazetteer concept-occurrence table
(concept × document × page × count), corpus-linguistics statistics
with era/tradition columns in `library.csv`, and pattern-mined
relation/table attestations into review queues. Derivatives of
in-copyright text stay in the private store; committed artifacts are
aggregate features and reports.

The visual system has its own stream and dedicated agent as of
2026-08-20: `docs/product/visual-design-system-plan.md` extracts the
design work from the widgets and corpus build plans (Encyclopedia
page shell, parts inventory, fonts, non-computed figure apparatus),
records the token-boundary change protocol (plate token values are
the design agent's; a token change ships with `plates:scan` +
regenerated figure hashes in one commit), and assigns the DS-01
disposition research to the design agent (maintainer inclination:
supersede, after mining DS-01 and the live design(site) stream for
keepers; peach blossom stays). Three agents now write this file —
widget/engine, corpus/Encyclopedia, visual design; keep edits
additive.

Design stream, first landed artifact (2026-08-20, `feature/visual-design`
merged at 1fc36d1): `docs/design/ds-01-disposition.md` reads the nine
DS-01 audit findings against the five `design(site)` commits and the
current `globals.css` — one resolved (blossom brief, by redefinition),
two partial (labels, interactive families), six standing (sub-body type
sizes, spacing scale, four surfaces, header magic numbers, light-theme
chart ink, page widths). It names seven keepers from the DS-01 proposal
and recommends absorb-then-retire; the disposition is the maintainer's
decision (open decision 7). The design agent works on
`feature/visual-design` and merges through the verified ritual: build,
root test, `plates:scan --check`, widgets harness, push.

Design stream, Encyclopedia page shell (2026-08-20, `feature/visual-design`):
the app is split into two root layouts — site routes moved to
`apps/web/app/(site)/` (URLs unchanged; `app/layout.tsx` is gone), and
`apps/web/app/encyclopedia/` carries its own root layout, fonts (EB
Garamond + IBM Plex Mono via next/font, variables `--font-ency-serif` /
`--font-ency-mono`), and `encyclopedia.css` (the Plate tokens, the
eight-step type scale, the parts styles). The five seed entries migrated
from `content/encyclopedia/` to `app/encyclopedia/<slug>/page.mdx`
wrapped in `EntryShell` (kind mark, title, aka, marginal contents rail);
the registry scan read them unchanged at the new path (6 plates, `--check`
green). Parts live in `apps/web/components/encyclopedia/` (Masthead,
Colophon, EntryShell, EntryContents, EntryLink, KindMark, Infobox,
Notes/NoteRef/NoteItem, RevisionStamp) and are registered for MDX in
`mdx-components.tsx`. `apps/web/lib/encyclopedia.ts` reads the entry list
and plate counts at build time. Two findings worth knowing: the design
documents (`*.dc.html`, `support.js`) are excluded by `.git/info/exclude`
and exist only in the maintainer's working tree — the plan's "maintainer
commits them first" act is still pending; and `IntersectionObserver`
`rootMargin` accepts only px/percent, never rem (a rem value there
crashes production hydration while dev stays silent). Open decision 1
(font loading) now has a concrete edge: plate components hardcode the
literal family name `'IBM Plex Mono'`, which next/font's hashed families
never satisfy, so plate chrome renders in the fallback mono stack until
the decision lands.

Local pipeline work (embeddings, library ingestion, text mining over
the private store, Memorativa private fixtures) belongs to a fourth
agent track, Cursor, on the maintainer's machine as of 2026-08-20:
`docs/product/local-pipelines-plan.md`. The committed artifacts
(neighbors.json, echo report, library.csv columns, aggregate mining
reports, fixture manifests) are the interface; remote tracks consume
them and request refreshes. Five writers now share this file; keep
edits additive.

The Memorativa engine is a dedicated fifth agent track (maintainer
decision, 2026-08-20): the track owns `packages/memorativa`, the
public peer of `caelus`, and scaffolds against the committed
public-domain goldens (Agrippa kameas, Hebrew letter values). The
in-copyright oracle fixtures stay with the local pipeline track as
hash-pinned manifests; the widget track's kamea/number widgets and
the Encyclopedia's numerical figures are its consumers. Its doc of
record is `docs/product/memorativa-build-plan.md`.

Maintainer decisions of 2026-08-20: the Encyclopedia is the
Encyclopedia of Hermes (Western esoteric traditions; astrology is the
engine-backed core division, the corpus stays astrological), and the
arithmology module is the Memorativa engine (`packages/memorativa`,
planned: theosophical arithmetic, neutralization operators, kameas with
sigil tracing, gematria systems, lambdoma ratios; golden tests pinned
against the scanned tables). Memorativa ships public, peer to `caelus`
(MIT, npm provenance, 0.25.0 in the open draft); committed goldens pin
public-domain sources, in-copyright oracles stay in the private store.
Recorded in the build plan intro and streams G, H, J.

## User Defined Namespaces
- [Leave blank - user populates]

## Components

- `memorativa` (`packages/memorativa`, public peer of `caelus`, 0.25.0 in
  the open draft): the arithmology engine, pure functions. Theosophical
  arithmetic (`theosophicalReduce`, `theosophicalReduceSteps`,
  `theosophicalAdd`, `neutralize` for binaries/ternaries/quaternaries);
  the seven kameas (`KAMEAS`, `kamea`, `magicConstant`, `kameaTotal`,
  `cellOf`, `sigilTrace` with theosophic reduction into the square's
  range); gematria (`LETTER_SYSTEMS`: `hebrew` with finals at base value,
  the convention of Agrippa's ch. XXII name tables, `hebrew-finals` at
  500–900, `greek-isopsephy`, `greek-ordinal`, `latin-agrippa`;
  `gematria`, `letterValue`, `notarikon`, `atbash`, `albam`); the
  lambdoma (`ratio`, `lambdoma`). Committed goldens pin Agrippa Book II
  (J.F. 1651): the seven grids, the printed constants and totals, and the
  ch. XXII divine-name table as gematria anchors; the discrepant printed
  rows (Barzabel 325/326, Kedemel 157/175, Hasmodai 369/366, Asboga 8/24)
  are asserted at computed values with the printed figures in commentary.
  `src/version.ts` sits under `check-versions.mjs` as an independent row
  ("independent, open draft") until the maintainer cuts 0.25.0. Note: the
  repo's Agrippa text (`caelus-delineations-pd` sources) contains Book I
  only despite the manifest's "Book I–III" title; the kamea grids were
  verified against the 1651 J.F. printing at esotericarchives.com.
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
  handedness; `t = 1` renders the real `ChartWheel`. Console
  interactions (derivation-widget.tsx): follow-a-body (tap; datum line
  via `derivationDatum`, tick held at every t), clock nudge ±4m
  (`shiftInstant`; params in, scene out — needs the host's `getEngine`
  loader), latitude ±5° at SPHERE, free orbit (drag, release returns
  to the scrub camera), autoplay ▸ (host gates first-encounter play +
  reduced motion via the `autoplay` prop), optional station captions
  (`STATION_CAPTIONS`, `params.captions`). Wheel-anatomy
  widget: same scene/figure split (`deriveAnatomy`,
  `WheelAnatomyFigure(scene, layers)`); layer names
  `horizon · zodiac · houses · bodies · aspects` map onto the
  `ChartWheel` `layers` prop (caelus-wheel, all default on; `axes` =
  the four angles), all-on renders `ChartWheel` byte-identically.
  House-comparator widget (`/house-comparator`, `/-widget`): one birth
  through the twelve `HOUSE_SYSTEMS`; scene carries cusps + per-body
  house per system with the engine's polar fallback surfaced
  (`fellBack`, from `houseSystem !== houseSystemRequested`); figure =
  wheel with swapped cusps (bodies/angles fixed); `CuspTable` marks
  placements that change house; picker is the design's mono list with
  the current item in oxblood; latitude walk via `getEngine`. Harness
  hashes rest + one key per system. Shared console formatting in
  `src/format.ts` (`fmtZodiac`, `dm`). Registry `kb` values are real
  caelus-kb node ids (e.g. `chart-type:natal`, `house-system:whole-sign`
  — KB uses hyphens) and the scan asserts existence against
  `packages/kb/data/kb.json`; asc/mc have no KB node, so the ascendant
  plate carries none.
  Figure harness (`test/harness.test.tsx`) hashes every registry plate
  at rest + all five stations (derivation) or the cumulative layer
  build (wheel-anatomy) against `test/figure-hashes.json` and asserts
  stamp = computing `VERSION`; regenerate with
  `CAELUS_FIGURES_WRITE=1`. Widgets test files run individually in
  ci.yml and `check-test-wiring.mjs` now gates the package (root
  `npm test` does not include wheel/widgets).
- `zodiac-drift` and `aspect-dial` widgets (`packages/widgets/src/`,
  landed d778ba1 on `feature/house-corpus`, 2026-08-20): the third and
  fourth widget kinds. Zodiac-drift draws tropical + sidereal rings
  with the oxblood ayanamsa gap wedge; `deriveDrift(params)` is pure
  math over `ayanamsa()`/`julianDay()` (no `Engine` instance), so its
  client plate half (`ZodiacDriftPlate`) applies reader-chart overrides
  without loading a data tier. Console: ayanamsa picker
  (`DRIFT_MODES` = lahiri/fagan_bradley/raman/krishnamurti) and a
  century `PlateConsole` scrubber over a precomputed per-mode curve
  table (±100 y window, `DRIFT_WINDOW`). Aspect-dial draws aspect
  points from body a's place with shaded orb zones and the oxblood orb
  arc to body b; `deriveDial(engine, params)` computes the aspectarian
  via `aspectBetween` and the next exact hit via `scanExact` (coarse
  scan then bisection over engine longitudes — widget-side numerical
  plumbing the widgets plan flags as a candidate engine export).
  Console: drag body b to re-read, orb rail, aspectarian table.
  `src/format.ts` adds `ASPECT_GLYPHS` and `fmtDate`. Seed entries
  `zodiac.mdx` (lahiri) and `aspect.mdx` (venus–neptune, an applying
  trine at the seed instant) bring the registry to six plates; harness
  hashes drift at rest/per-mode/window-ends and the dial at rest and
  at exact opposition (41 hashes total).
- `retrograde-scrub` and `sect-flip` widgets (`packages/widgets/src/`,
  landed 0816e47 on `feature/house-corpus`, 2026-08-20): the fifth and
  sixth widget kinds. Retrograde-scrub is the graphic ephemeris
  through a station: `deriveRetro(engine, params)` brackets the loop
  nearest the instant (`stations()` scan ±450 d, pair SR→SD, containing
  loop else nearest midpoint), samples unwrapped geocentric longitude
  (continuous through 0° ♈) and speed (361 samples), and carries a
  121-point heliocentric track via `earthHeliocentric(engine.data, …)`
  + `vsopHeliocentric(engine.data.vsop[body], …)` over `jdTT` — the
  inset draws the Sun, both orbits, and the Earth→body sight line to
  the zodiac ring (the overtake that causes the loop). Bodies limited
  to the seven VSOP planets (`RETRO_BODIES`; Pluto's helio path is a
  separate export, not yet wired). `EphemerisGraph` gained declarative
  furniture props (`band`, `marks`, `cursor`, `accent`) — pure,
  SSR-safe, reused from caelus-wheel rather than overlayed widget-side.
  Sect-flip: `deriveSect` computes both hermetic lot sets
  (`hermeticLots(asc, day|night, …)`), the chart's actual sect
  (`isDayChart`), and the seven-classical-body sect table
  (`planetarySect`/`inSect`); the figure injects Fortune ⊕ and Spirit
  ⊗ onto the `ChartWheel` as extra bodies with the `glyphs` prop and
  oxblood `planetColors` (no wheel changes needed — `WheelChart.bodies`
  is an open record). The day/night picker flips formulas; the datum
  marks the counterfactual. Seed entries `retrograde.mdx` (mercury) and
  `sect.mdx` (`kb="technique:lots"`; no retrograde node exists in the
  KB) bring the registry to eight plates, 47 figure hashes.
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
