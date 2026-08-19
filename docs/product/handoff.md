# Caelus Free — working handoff

Read this first, then the documents of record, then build.

## Documents of record (this directory)

- [proposal.md](./proposal.md) — vision, IA, all surfaces, content
  strategy at the Hand standard, Journal, knowledge graph, Composer.
- [feature-map.md](./feature-map.md) — every public symbol mapped to a
  surface, audited 637/637; the coverage re-audit at launch walks this.
- [build-plan.md](./build-plan.md) — workstreams, dependency facts, the
  M0–M7 sequence, content batches B1–B8, backlog, §6 decisions (all
  made).
- [design-direction.html](./design-direction.html) — v0.1.1, approved.
  The twilight and almanac lanes, tokens, glyph stroke, wheel themes,
  onboarding frames, type direction.
- [research/](./research/) — the competitive research and the Caelus
  capability inventory.

## Working rules (owner-set, binding)

1. **The owner decides.** Scope, priorities, phases, concessions, and
   naming are the owner's calls. Nothing gets deferred, tiered, or
   dropped by an agent; build order follows build-plan §3 and everything
   in the documents ships. When a genuine decision appears that the
   documents don't answer, ask the owner; propose options, decide
   nothing silently.
2. **Voice.** All copy follows `docs/editorial-voice.md`, including its
   Caelus Free product-copy section, and passes the prose lint. Locked
   copy, verbatim: headline "There is more going on than your sign.";
   buttons "Show me my sky" then "Write it down"; privacy lines
   "Computed here on your screen." and "Written here, kept here."
3. **Design.** The two lanes of design-direction.html. Peach blossom
   `#dd6ba1` under the one law: peach marks what is alive — rendered as
   color plus glow plus a tinted surface, never color alone. Structure
   and chrome never wear it.
4. **Engine boundary.** The MIT core stays interpretation-free and
   reference-first; engine additions land with goldens or not at all.
   Journal, graph, and Composer are app and package layers (proposal
   §5.5, §5.6, §5.10). New packages: `caelus-delineations-house` and
   `caelus-composer`.
5. **Content.** Written new from frontier-model knowledge at the Hand
   standard (proposal §6): essay-length major cells, second person,
   non-fatalistic, keyed to the engine's phase/strength/re-hit data,
   validated by the harness and lints, adversarially reviewed. The
   public-domain corpus is an optional side source, never the basis.
6. **Sessions hand off; they do not compact.** When context runs long,
   update this file with the current state, commit, push, and spawn a
   successor session with the same mandate.
7. **Docs follow the engine, in the same commit** (owner directive,
   2026-08-16). Every engine addition updates, alongside the code: the
   `## Unreleased` section of `CHANGELOG.md` (the website's /changelog
   renders it live, so it is already public), `docs/interpretation-layer.md`,
   the public `/docs/interpretation` page, and any other site surface that
   states what the engine can do — `/features` and `llms.txt` (both copies)
   are the ones that drift most, and `/docs/derived` for a new derived
   chart. `npm run check:docs` gates the fact-kind and selector lists in
   CI; it exists because those lists were wrong for a release and a half
   and nothing noticed. It cannot check prose, so a new capability still
   needs a human sentence. **Run any code example you put in the docs
   before committing it** — the first draft of the draconic example
   invented a signature the function does not have.

## State

M0, M1, and batch B1 are done on `feature/caelus-free`. Landed and
pushed:

- **B1 content: complete and reviewed.** All 812 grid cells written
  and validated: planet-in-sign 144, planet-in-house 144, aspects 330,
  rising 12, MC signs 12, angle-conjunction 48 (unblocked by the
  engine work below), dignities 50, patterns 28, signature 26,
  out-of-bounds 9, natal retrogrades 9. Writer agents ran 9-15 essays
  per slice against `pipeline/voice-sheet.md` + briefs generated from
  the grid (verbatim ids/selectors, so binding is correct by
  construction); every slice self-checked before merge; the package
  harness gates the whole corpus. The adversarial review pass
  (proposal §6 pass 5) ran as nine reviewer agents over every entry;
  ~60 wording-level repairs landed (hedging biography, degendering
  caretakers, removing era claims and promises, breaking shared
  sentence skeletons); all scopes cleared. The whole pipeline
  (briefs, checks, writer and reviewer instruction sheets) now lives
  in `packages/caelus-delineations-house/pipeline/` for B2-B8.
- **Engine: angleContact atoms.** `interpretationContext` emits
  planet-on-angle contacts (ASC/DSC/MC/IC, `angleOrb` option, default
  8°), StarAtom-shaped (body/angle/orb, no phase). New
  `hasAngleContact` selector; pd `SelectorSpec` grew an `angleContact`
  kind; grid cells flipped bindable; golden test recomputes the contact
  set from the chart's own angles.
- **M1 stream B, done:**
  - `MultiWheel` in `packages/wheel` (rings API: any chart in any ring,
    up to four, ring 0 orients and provides houses, inter-ring contacts
    in the core; 24-check test in package test + CI). The playground's
    BiWheel was deleted; SynastryPanel and SkyNow render MultiWheel.
  - Timeline library `apps/web/lib/free/timeline.ts`: transit duration
    bars via root-finding (orb entry/exact/exit, retro re-hits),
    progression spans, profection/firdaria/ZR/dasha period lanes,
    station/ingress/lunation/eclipse markers, You-lane hook, zoom/pan/
    scrub view math. 73-check test.
  - Wheel interactivity: `lib/free/wheel-interact.ts` (hit-test
    geometry mirroring ChartWheel, selection model, atoms-for-selection,
    simple/advanced disclosure) + `components/free/InteractiveWheel.tsx`
    (keyboard-reachable targets, alive-style selection).
  - Calendar kit `lib/free/calendar.ts`: month grids, chips,
    deterministic RFC 5545 ICS export.
  - Table kit (DataTable, CardIndex, AspectarianGrid, ViewToggle), map
    kit (gazetteer-dot basemap generated by scripts/build-landdots.mjs,
    48 line meanings, AstroMapPanel with tap-for-meaning and the
    relocated-chart side slot), and the ShareCard story-ratio renderer
    (twilight and almanac lanes, literal hex, honest rising-unknown).
  - **The paired view** (owner spec, proposal §4): one selection model
    across ChartWheel and ChartSphere. `lib/free/sphere-interact.ts`
    mirrors the sphere projection and computes the flatten frames (at
    t=1 the sphere is the wheel's frame, test-verified);
    InteractiveSphere (alive selection, dashed rings on out-of-bounds
    bodies), PairedView (side-by-side, flatten/raise with reduced-
    motion jump cut). Chart hub / Planetarium / Composer mount it at
    M2/M6.
  - New unit-test lane for web lib code: `scripts/test-web-libs.mjs`
    (esbuild-transpiled `apps/web/lib/**/*.test.ts(x)`), wired into
    root `npm test` and CI.
- **Portable objects (owner spec, proposal §4 + §5.11).**
  `apps/web/lib/free/envelope.ts` is the one versioned JSON envelope
  every artifact serializes to: pv, kind, engine version (stamped from
  `lib/free/engine-version.ts`, drift-checked by check-versions),
  optional corpus version and canonical chart digest, payload.
  Deterministic (no clock): file = link = API response, and
  `parsePortable` imports a dropped file, a pasted link, or a bare
  fragment back whole, wrapping legacy pre-envelope `#a=` artifacts.
  **Binding for every later surface: save/share/export goes through
  seal()/toFile()/portableFragment(); ICS, prompt packs, journal and
  graph exports, and share cards are renderings of this envelope, not
  separate formats. The `/api/chart` response should adopt it when the
  API page lands.**
- **Fonts vendored.** next/font/google fails through the build
  environment's egress proxy, so the four faces load with
  next/font/local from committed Fontsource woff2 files
  (`apps/web/app/fonts/`, same CSS variables); `next build` verified
  offline.
- **Owner directive (2026-08-16), Journal scope:** the Journal is a kind
  of calendar, and should import and integrate a variety of existing
  calendars: liturgical, prayer, harvest and planting, esoteric, secular
  research, and other known existing typed durations. Build implication
  for M5: the Journal's entry store gains calendar layers as typed
  duration sources beside the sky-pins; the M1 calendar kit's ICS lane
  gives the import mechanism (RFC 5545 both ways), and bundled known
  calendars ship as data. Fold into the Journal design at M5; the
  proposal's §5.5 gets the addendum when that work starts.
- **Owner decisions (2026-08-16), settling the four B1 questions:**
  1. The ~11 astronomically impossible natal aspect cells stay in the
     grid; they fire on Chart Lab synthetic skies.
  2. Neptune-in-Pisces ships adult-voiced as written.
  3. The Moon-North Node "help arrives through women / nurturing
     figures" motif stays as written (hedged).
  4. Chiron thin-tradition disclaimers are handled at the family
     level: the 12 per-essay disclaimers were rewritten out (each
     essay keeps its substantive claim) and the package now exports
     `FAMILY_NOTES` with one Chiron note; the Reading renders it once
     beside Chiron essays.

Earlier M0 state (still true):

- **Tokens (design lead).** `apps/web/app/free/free.css` formalizes
  design-direction v0.1.1: twilight and almanac as `data-lane` scopes
  with semantic `--lane-*` variables, a night-almanac variant under
  `data-theme="dark"`, and the alive-state utilities (`.alive`,
  `.alive-mark`, `.alive-dot`) that always render peach as color + glow
  + tinted surface. Newsreader/Public Sans load in the free layout.
- **Stream A.** The `/free` shell with its own chrome (`ChromeGate`
  hides the developer site's header/footer), eight hub skeletons with
  locked copy, settings store with the four presets and per-chart
  overrides (`apps/web/lib/free/settings.ts`), people library with
  person context (`lib/free/people.ts`), artifact share codec `#a=`
  over the existing `#c=`/`#s=` (`lib/free/artifact-share.ts`).
- **Stream D.** `packages/caelus-delineations-house`: B1 grid enumerated
  as a coverage contract (`src/grid.ts`, 842 cells), corpus lints
  (length bands, banned phrases, FK grade, 4-gram duplication), writer
  voice sheet (`pipeline/voice-sheet.md`), validation harness (binding,
  firing, lints), first sets written and validated: Sun signs (the
  exemplars), Moon signs, rising signs. Coverage: planet-in-sign
  24/144, rising-sign 12/12, everything else 0. Writer agents work
  well against the voice sheet + exemplars; two agents ran
  concurrently and merged `src/passages.ts` additively without
  trouble. Wired into root build/test.
- **Stream F.** Draconic transform shipped reference-first (Python
  reference, 23-case golden, TS port, 34 suites green).
- **Rights check (§6.3).** Both norm packs are fetch-and-cache; Sabian
  symbols unresolved, write original degree symbols. See
  `docs/product/norms-rights.md`.
- **Prose lint.** vale runs offline from vendored styles; `/free` copy
  has its own extract lane with the insider-vocabulary gate. Everything
  passes `npm run lint:prose`.

Known gaps and decisions taken en route:

- **Angle-conjunction cells (48) are blocked**: the interpretation
  projection emits no planet-on-angle atoms. Engine follow-up: add them
  to `interpretationContext` (TS + tests), then flip `bindable` in
  `grid.ts`. (Done; kept for the record.)
- **77 more B1 cells cannot fire on any chart, real or synthetic**
  (found while auditing the projection for M2): 22 dignity cells
  (`dignities()` never emits "peregrine", and the outer planets have no
  classical dignities so their domicile/exaltation/detriment/fall cells
  never match) and 55 node-aspect cells (`findAspects` excludes both
  nodes via `NOT_ASPECTABLE`, so no node aspect ever reaches the
  projection). Unlike the impossible-aspect cells the owner kept
  (decision 1), these are engine-semantic gaps, the same shape as the
  angle-conjunction gap that B1 closed with engine work. Plan: follow
  that precedent reference-first — emit peregrine on classical planets
  from the essential-dignity tables, and node-aspect atoms from the
  projection (not `chart.aspects`), each with goldens. Outer-planet
  dignity cells (12 of the 22) have no doctrinal basis to fire and
  stay dead unless the owner says otherwise.
- Node placement essays are written once against `true_node` and
  mirrored to `mean_node` at compile time (`src/compile.ts`).
- The onboarding frame at `/free` is static locked copy; the state
  machine is M2 work.
- **Owner update (merged from the research branch, ae015d9 + 88163ce):**
  the Sky view surface is now **the Planetarium**: one viewing
  instrument, three sources rendered as combinable layers with per-layer
  opacity in a single `skyView` projection. Real sky
  (`skyView`/`skyViewSequence`, lenses, physics), imagined skies (Chart
  Lab synthetic systems), and the Composer sky (composed charts through
  `registerSyntheticSystem` + `syntheticRender`, moving through
  narrative time along the motif ephemeris). The Journal gains the
  composed-source lens. `renderPlan` and the AI image prompts describe
  whatever mix is showing. feature-map and build-plan references
  renamed; build the Planetarium in place of Sky view at M6.

## B2 complete + engine node/peregrine work (2026-08-16, session 3)

**B2 is done: written, reviewed, landed.** All 738 B2 cells are
registered and green: transit-aspect 600/600 (including the 50
node-target cells, unblocked by the engine work below), transit-house
120/120, transit-station 18/18. The full corpus is 1,606 cells across
B1+B2+B7, `passages.ts` regenerated at 121 sets, corpus harness, all 34
engine suites, pd, web-lib tests, prose and em-dash lints all pass.

- **Writer waves.** 25 slices this session (20 inner-body: sun/moon/
  mercury/venus/mars x 1-4; 5 node-target pair slices), ~10-15
  concurrent agents per wave, every slice check-slice green before
  merge. Node-target briefs are sliced under their own names
  (`transits-node-<pair>`, paired by tempo-adjacent transiting bodies)
  by gen-briefs, so slice numbering never collides with the per-body
  files.
- **The B2 adversarial review pass ran**: eleven reviewers (one per
  transiting body; node slices + stations as the eleventh) over all 56
  b2-* files against reviewer-instructions.md + reviewer-instructions-
  b2.md. ~100 wording repairs landed: cycle-claim corrections (Venus and
  Sun soft aspects perfect roughly twice a year; Saturn's seven-year
  beat attaches to hard angles only; Uranus/node contacts once-at-most),
  the Pluto and node "You grow..." closer formulas broken, the Mars
  house-file retrograde skeleton varied, doom and bounty verdicts
  hedged, two financial directives recast descriptive, a caretaker line
  degendered, Moon twice-monthly tempo fixes. Every file clears.
- **Engine (goldens in the caelus suite, all recompute-style):**
  - **Node aspects in the projection**: `interpretationContext` now
    computes node-to-body aspect atoms itself (true node preferred,
    mean node when it is the only one present; same aspect table,
    default orbs, and phase/strength arithmetic as chart aspects);
    `findAspects` and the engine boundary unchanged. The 55 B1 natal
    node-aspect essays now fire (verified end-to-end through the
    compiled corpus).
  - **Node as a natal transit target**: `transitAspects` admits one
    natal node as a target (transiting set unchanged), so
    `transit:<body>~natal_true_node:<aspect>` atoms exist and the 50
    node-target cells fire.
  - **Peregrine**: placement atoms carry `"peregrine"` in their
    dignities for a classical planet with none of the five essential
    dignities at its degree (Lilly, via the pinned `dignityScore`;
    sect-aware). Chart-level `Position.dignities` unchanged; the 10
    peregrine essays fire (verified). Outer-planet dignity cells stay
    dead per the owner's earlier ruling.
  - `mirrorNodeRules` in the house compile now mirrors natal-aspect and
    transit node cells to `mean_node`, not just placements.
- **Notes for the owner** (wording-level, non-blocking, from review):
  the same-body outer conjunction cells (Pluto conj Pluto, Neptune conj
  Neptune) are written addressed partly to a caregiver reading an
  infant's chart, which the People library supports; Venus is "she" in
  most files but "it" in b2-transits-venus-2 (file mostly avoids
  pronouns; left); a few Venus-Neptune entries keep lightly imperative
  canonical timing counsel ("put a day between the urge to buy and the
  buying") that a stricter safety reading might want descriptive.

## M2 + B2/B7 progress (2026-08-16 session)

M2 surfaces landed and pushed:

- **Chart hub live** (`/free/chart`): people library entry via BirthForm
  (toUT conversion, clock-change notes in plain words), PairedView with
  one selection across wheel, placements list, and Reading filter; the
  Reading (`lib/free/reading.ts`) fires the compiled corpus into
  sections (shape / angles / planets / aspects) ranked by strongest
  cited atom, simplified view by default, unknown-time suppression of
  clock-dependent families, FAMILY_NOTES rendered once (Chiron),
  "see where this comes from" per essay; honesty chips
  (`honestyChips`): unknown time, unavailable bodies, unvalidated
  range, delta-T, polar house fallback; prompt packs (full natal,
  career, love) as deterministic cited briefs stamped chart digest +
  engine + corpus, copy + save-as-file through the portable envelope;
  Conventions panel (presets + per-chart override) and About-this-
  computation (capabilities, conventions in force, digest). 88-check
  unit test (`lib/free/reading.test.ts`).
- **Onboarding live** (`/free`): the five scenes per proposal §4 with
  locked copy; Sun glyph in the headline four keystrokes in
  (`lib/free/onboarding.ts`, cusp waits for year, ingress day waits
  for time); SkyStage renders skyView star field + constellation
  figures + planets + horizon as SVG; translation scene runs the
  PairedView flatten and lands on /free/chart. Unknown-time path forks
  to TimeFinder: `lib/free/finder.ts` sweeps the day's ASC segments
  (minute-bisected), B7 fit questions weigh windows, dated life events
  check slow movers (Jupiter..Pluto, 2.5° orb, conj/square/opp)
  against each window's angles, proposal with plain confidence;
  "keep the time open" is always offered. 43-check test
  (`lib/free/finder.test.ts`).
- **Programmatic pages**: 812 natal cells at `/free/learn/[slug]`
  (`lib/free/cell-pages.ts`), grouped index on /free/learn, sitemap
  extended. Slugs like sun-in-aries, sun-conjunct-moon, aries-rising,
  north-node-in-aries.
- **Engine (goldens in caelus test suite)**: `transitHouse` atoms
  (transitHouses() in relational.ts) and `station` atoms
  (enrichContextOptions stations window, default ±5 days, editorial);
  hasTransitHouse/hasStation selectors; pd SelectorSpec grew both
  kinds.
- **Grid**: b2Grid (600 transit-aspect cells, 50 node-target
  bindable:false pending node-aspect projection; 120 transit-house; 18
  stations) + b7Grid (12 finder-rising-fit + 28 finder-event-angle,
  compiled apart from Reading sources as `finderSets`); fullGrid();
  gen-briefs walks the full grid; register-sets.mjs regenerates
  passages.ts from data/passages (use it for every wave).

**B2/B7 writer-wave state, end of session: registered and green.**
passages.ts is generated by `pipeline/register-sets.mjs` (96 sets) and
the corpus harness passes, including the family-wide duplication
lints. Complete: all of B7 (finder bank 40/40, exported as
`finderSets`), b2-stations 18/18, all transit-houses 120/120, and
transit-aspect 275/550: every slow mover (saturn, jupiter, uranus,
neptune, pluto × slices 1..4).

Remaining for B2:

1. **20 inner-body slices** (sun/moon/mercury/venus/mars × 1..4, 15
   cells each): same writer prompt pattern as this session (read
   writer-instructions-b2.md + base sheet + voice sheet; give the
   transiting body's tempo in the prompt: Sun days/annual and no
   re-hits, Moon hours/monthly and no re-hits worth naming, Mercury
   days to weeks with famous retrograde re-hits, Venus days to weeks
   with occasional retrograde, Mars a week or two with a roughly
   two-year round and occasional long retrograde stretches). Waves of
   ~6-12 concurrent; check-slice self-check; commit after each wave;
   `register-sets.mjs` + package test at the end. Repair prompts (run
   check-slice, fix FAILs) recover partial slices cheaply after agent
   deaths (session usage limits killed one wave this session).
2. **The B2 adversarial review pass**: reviewer agents per
   reviewer-instructions.md + the new reviewer-instructions-b2.md
   (register drift, the arc/re-hit rule, selector overreach, cycle
   claims, doom drift), over all b2-* files, check-texts per file.
3. **Node-aspect projection** (engine, reference-first): unblocks the
   50 node-target transit cells and the 55 natal node-aspect B1 cells;
   peregrine emission unblocks 10 dignity cells (see Known gaps).
   Then flip bindable, gen-briefs, write those cells.

## M3 complete + B4 (2026-08-16, session 4)

**M3 is built and B4 is written.** Today and Times are live, the engine
grew the three B4 atom kinds with goldens, and all 268 B4 cells are
registered. The corpus is now **1,858 cells** across B1+B2+B4+B7,
`passages.ts` at 149 sets.

- **Engine (recompute-style goldens in the caelus suite):**
  - **`return` atoms**: `activeReturns` in relational.ts reports a
    transiting body within orb of its own natal longitude, numbered by
    the mean-period count (exact whenever the body is actually in orb).
    Neptune and Pluto sit out (no human sees them return); one node
    joins per the transit node rule. Golden pins the first Saturn
    return against the `returns()` root-finder and recomputes the whole
    body set's orbs; a newborn chart reports nothing.
  - **`lunation` atoms**: `activeLunations` finds New/Full Moons in an
    editorial window (default ±3 days), locates each in the natal
    houses, flags eclipses through the pinned eclipse search, and lists
    natal bodies conjunct the syzygy. Golden checks the March 2025
    lunar and solar eclipses and a plain June Full Moon, recomputing
    house, sign, onNatal and timing.
  - **`solarPhase` atoms**: cazimi/combust/under-beams for the
    classical five, always computed from the chart's own longitudes at
    the pinned electional thresholds. Fires natally and on the moving
    sky alike.
  - **TimelordAtom** gained `house` (the profected house) and `under`
    (the enclosing period's lord: firdaria major over sub, maha over
    antar), so period *pairs* are addressable. `hasTimelord` matches
    both; new `hasReturn`/`hasLunation`/`hasSolarPhase` selectors; pd
    `SelectorSpec` and compiler extended. `enrichContextOptions`
    projects returns and lunations by default.
- **Today** (`/free/today`): the mundane header anyone can read without
  birth data (transiting patterns, stations in window, moon phase/sign/
  void with the next lunations, current solar conditions, planetary
  hour), then the personalized stack: cards fired from the B2/B4 corpus
  over the enriched projection, ranked by strongest cited atom, each
  with a duration bar from `transitSpans` (orb entry, exact passes with
  retro re-hits, exit) and a live now-marker. Your-year strip renders
  the time-lord periods in force; coming-up feed walks three weeks.
  Honesty chips and unknown-time suppression of house-anchored cards
  follow the Chart hub. `lib/free/today.ts` is the pure layer, 59-check
  test.
- **Times** (`/free/times`), three surfaces: **Timeline** (SVG lane
  surface: transit duration bars, progressed Moon, all four time-lord
  systems as period lanes, sky markers; wheel/drag/arrow-key zoom-pan
  through the pure view math; spans running today wear the alive style;
  Months / A year / A life presets and lane-group toggles),
  **Birthday** (solar return in force, its chart in PairedView, the
  profection year and lord that name it, the periods reading, the
  ten-city relocation comparison that ranks nothing, the lunar-return
  month), **Returns** (any of ten bodies over `returns()`, numbered, so
  the corpus's first/second/third Saturn essays fire correctly; each
  opens its return chart and reading). `lib/free/times.ts` is the pure
  layer, 314-check test. Time-lord lanes stay OFF without a birth time
  rather than releasing from a guessed Ascendant.
- **Prompt packs** gained the two diachronic recipes (`today`, `year`),
  which take a prebuilt enriched context via `BuildPackOptions.ctx`.
- **B4 content: 268/268 written and registered.** timelord-profection
  31, timelord-zr 24, timelord-firdaria 58 (9 majors + 49 pairs),
  timelord-dasha 90 (9 mahas + 81 pairs), lunation-house 24, eclipse
  14, planetary-return 12, solar-phase 15. Twenty-eight writer slices
  over three waves; `writer-instructions-b4.md` and
  `reviewer-instructions-b4.md` carry the family doctrine (which cycle
  lengths may be stated, which never; the selector-scope rules).
  The adversarial review pass ran as eight reviewers by family group.

**Two new corpus lints, from what the B4 review found.** The reviewers
kept catching a defect the harness could not: the duplication lint
measures 4-gram *overlap ratio* between two entries, which a single
shared sentence never moves in a 300-word essay, and which is blind to
sibling essays that all open or close the same way. Each entry reads
fine alone; the set reads like a template, and a reader of two notices
at once. So `lint.ts` gained `lintSharedSentences` (a whole sentence,
six words or longer, appearing verbatim in two entries of a family) and
`lintSkeletons` (more than a third of a family sharing a first-six-word
opening or a last-sentence closing). Both run in `lintCorpus`, so every
future batch is gated on them. Turning them on immediately found 19
real defects in shipped B1 and B2 content, all repaired.

**Still owed on Times** (proposal §5.7 rows not yet built; M3 built the
milestone's named scope, these are the surface's remaining rows and
belong to whoever picks up Times next): the fuller progressions surface
(progressed positions and hit lists, solar arc as its own lane beside
the progressed Moon lane that shipped), the primary-directions table
over `primaryDirections`/`mundaneDirections`, the graphic ephemeris
(45/90/360 modes via `wrap`), and the harmonics and antiscia views over
`harmonicChart`/`antiscion` in Advanced. All four are engine-complete;
none is blocked.

**Notes for the owner** (from the B4 writers, non-blocking): firdaria
sub-period and dasha antar doctrine is thin in the canon beyond "blend
the two lords," so those 130 pair essays work the pairing symbolically
rather than citing doctrine; the same lord pairs recur across the
firdaria and dasha systems, and reviewers broke cross-system echoes
where they found them. The Vedic entries gloss antardasha/Rahu/Ketu per
entry, which is nine near-synonymous glosses per slice, varied by hand.

## M4 in progress + B3 (2026-08-16, session 5)

**M4's four surfaces are built and B3 is more than half written.** People,
Places and Explore are live beside the M2/M3 surfaces; the engine closed the
composite-aspect gap; the B3 corpus grew from 764 cells to 1,094 and the
synastry-aspect family is complete.

- **Engine: composite aspects** (recompute-style golden in the caelus suite).
  `compositeAspects()` in relational.ts finds aspects among the midpoint
  chart's own bodies, using the same aspect table, orb policy and strength
  arithmetic as `findAspects`, and deliberately reports **no phase**: a
  midpoint composite is a static figure, so nothing in it applies or
  separates. One node is admitted per the transit node rule. New
  `compositeAspect` atom kind, `hasCompositeAspect` selector (positional
  a/b plus `between`, mirroring `hasAspect`), pd `SelectorSpec` kind, and
  `enrichSynastryOptions` supplies them beside the placements. The golden
  rebuilds the whole aspect set by brute force from the composite
  longitudes, checks every orb and strength, and verifies that a chart
  composited with itself returns its own natal aspect geometry.
- **Grid**: the `composite-aspect` family, 330 cells (66 unordered pairs of
  the 12 placement bodies x 5 aspects), mirrored to `mean_node` in the
  compile, sliced by gen-briefs at 15. **B3 is now 1,094 cells and the full
  grid is 2,952.** The body set matches the B1 natal aspect family, which is
  the same family read in the composite voice; that was a judgement call the
  documents left open (see the owner question below).
- **People** (`/free/people`) over `lib/free/relationship.ts` (140-check
  test): the saved-people library with a reader and an other; the
  relationship reading in **five named dimensions** (identity,
  communication, affection, friction, growth) that partition the
  inter-aspects by a documented body priority; **named verdicts with their
  reasons** (Quiet / Unforced / Charged / Fused / Busy both ways) and never
  a number; the contacts that earned each verdict listed with their orbs;
  the B3 essays under them. House overlays in both directions, built by
  running the reading from each chair, since the corpus is written for
  ordered pairs. The bi-wheel through MultiWheel with the inter-aspects as
  ring contacts. The composite chart's placements and its own aspects in
  the composite voice, with the honest note that it has no houses. The
  Davison chart, which does, with the natal Reading run over it. Chips for
  an unknown birth time and a missing body.
- **Places** (`/free/places`) over `lib/free/places.ts` (131-check test):
  astrocartography over the M1 map kit with the relocated chart in the side
  slot the kit left open; every offered city cast with what came to the
  angles and which bodies changed house, in geographical order because no
  honest method ranks places; parans at any latitude with the polar case
  admitted (bodies that never rise there are named). The page states the
  mechanism first: moving does not move the planets, it turns the wheel.
- **Explore** (`/free/tools`) over `lib/free/explore.ts` (424-check test):
  the **date finder** (criteria builder over `rankMomentsAsync`, three-hourly
  samples across two months, progress read-out, and a why-line per result
  because the score is a sum of criteria each in [0,1]); **calendars** for
  any year (retrograde spans paired station to station with open ends
  reported rather than clipped, stations, ingresses including a retrograde
  body's re-crossings, the moons, the void-of-course hours), each exporting
  as RFC 5545 through the M1 calendar kit; the **eclipse catalogue** with
  local circumstances on tap, where a solar row reports gamma rather than an
  observer's magnitude and "not visible from where you are" is shown as an
  answer; the **ephemeris** table; and the **visibility almanac**.
- **B3 content: synastry-aspect 500/500 and synastry-overlay 120/120,
  written and green.** Six writer waves of ~10 concurrent agents, 5-15 cells
  per slice. The composite families remain (see Next actions). Corpus total
  is now 2,494 cells across B1+B2+B3+B4+B7, `passages.ts` at 199 sets.
- **New pipeline check: `check-family.mjs`.** `check-slice` lints a slice
  against itself; `lintCorpus` lints per family across the corpus, so
  parallel writers pass their own check and still collide. This ran into
  reality twice in the B3 waves before the script existed. check-family
  prints FAIL for findings naming your own entries and note for other
  files', and both writer instruction sheets now require it. Writers caught
  and repaired dozens of cross-slice collisions with it; four more that
  landed between runs were repaired by hand.

**Owner ruling (2026-08-16), the composite grid's shape.** The question was
what the composite chart's content should cover, given that the proposal's
row read "Composite (planet in house + aspects)" and the engine gives
composite *signs* rather than houses. The owner's call: **add the 144 house
cells too, and the starting convention does not matter — refine or add
conventions later as needed.** Landed:

- `compositeFrame()` in the engine returns midpoint Ascendant and MC with
  equal houses from the Ascendant, and names itself
  `method: "equal-from-midpoint-asc"` so a reading can say which convention
  produced it and a second convention can be added beside it without
  breaking anything. `compositePlacements` takes the frame and carries a
  `house`; with no frame it carries none, which is the case whenever either
  birth time is unknown. Golden checks the convention, the recomputation of
  every house from the cusps, the frameless path, and the selector.
- `composite-house`, 144 cells, twelve briefs generated. **B3 is 1,238 cells
  and the full grid is 3,096.**
- Two consequences are stated on the page rather than hidden: the composite
  MC does not generally land on the tenth cusp, and another convention would
  place some bodies differently while the sign placements are unaffected.

The composite-aspect body set stayed at 12 (matching the natal aspect
family), which is the other half of the same question and was not contested.

## B3 written complete (2026-08-16, session 6)

**All of B3 is written: 1,238 cells.** composite-placement 144/144,
composite-aspect 330/330 and composite-house 144/144 landed this session
beside the synastry families from session 5. The corpus is **3,096 cells**,
`passages.ts` at 249 sets, and the full suite is green: engine goldens, pd,
the corpus harness, 15 web-lib test files, em-dash and vale.

- **Waves.** 12 placement slices in one wave, then the 330 aspect cells in
  three waves of 11 / 8 / 7, then the 12 house slices. The wave rule that
  worked: **one slice per first body per wave**, so same-body siblings never
  write blind against each other and each wave checks against a larger
  shipped corpus than the last.
- **`pipeline/wave-b3-composite-aspect.md`** is new: the shared sheet for a
  wave, so a per-slice prompt is six lines instead of a page. It carries the
  family's hard rules, the per-aspect distinctions, the body table, the
  self-check commands, and the two conventions below. The house wave used it
  unchanged. Write one of these per wave from now on; it is cheaper than
  repeating yourself to twelve agents and it is where a mid-wave discovery
  gets recorded for the agents still to come.
- **The composite voice versus the second-person lint.** `lintPassage`
  requires a `you` token in every entry; it was written for the natal voice
  and collides with "the subject is the relationship, never you". Every
  writer hit this independently. The settled convention, now in the wave
  sheet: the relationship is the grammatical subject of every claim, and
  each entry carries **exactly one** collective construction ("the two of
  you", "neither of you"), varied in form and position.

**A new lint, and a backlog it exposes.** `lintSharedSentences` only fires on
a sentence repeated word for word, so a formula survives it as long as each
writer swaps one word. This wave produced eight variations on *"each pole
supplies what the other lacks"* across eight slices written in parallel;
every one passed every lint. `lintNearDuplicateSentences` scores whole
sentences by longest common subsequence over words — order-aware, because the
defect is a reused sentence *shape*, and those two sentences share only five
words out of ten. It runs writer-facing in `check-slice` and `check-family`,
where it immediately started paying: writers in the later waves reported
catching and rewriting their own collisions rather than shipping them.

It is deliberately **not** in `lintCorpus` yet, because turning it on reports
**348 findings in already-shipped, already-reviewed content**, concentrated in
the families written by the widest parallel waves:

| family | entries | findings |
|---|---|---|
| synastry-aspect | 500 | 162 |
| transit-aspect | 600 | 86 |
| aspect (natal) | 330 | 41 |
| composite-placement | 144 | 10 |
| synastry-overlay | 120 | 8 |
| planet-in-house | 144 | 6 |

Composite-aspect's own 29 were repaired this session (three agents on
disjoint files, then a clean family run), so that family is at zero. The rest
are real defects of the same kind the B4 review found by eye — "this makes
you a natural advocate" / "…a natural confessor" — and they belong to the
batch review passes. **The gate goes on in `lintCorpus` once they are
repaired**; that is the finish line for this backlog, not an optional
tidy-up.

**Two structural defects the lints still cannot see**, both found by writers
and both inherited by the review pass:

1. **Cross-family echoes are unlinted.** `check-family` and `lintCorpus`
   group by family, so a body's house essays are never compared against its
   sign essays — and those are the two paragraphs a reader sees side by side
   on the same page. Several house writers hand-checked against their sign
   slice and rewrote two to five sentences each; nothing enforced it.
   Extending the lint to compare sibling families of the same body is the
   obvious follow-up.
2. **The composite-house caveat is a family-level skeleton.** The
   house-is-a-convention note is correct and required, but nearly all twelve
   files place it in houses **1, 10 and 12** — the same three cells, because
   those are the cells where it genuinely bears. No lint sees a shared
   *placement* pattern, only shared words. A reader who opens two bodies'
   1st-house essays sees the same move twice.

**A harness gap fixed.** The corpus test's synthetic composite atom never
carried a `house`, so all 144 composite-house cells compiled and none fired.
The negative case had the same hole: a composite-house cell names no sign, so
shifting the sign left the cell still firing and the "does not fire when
shifted" check passed vacuously. Both now shift whichever field the cell
actually selects on. Worth remembering as a shape: **a coverage family that
has a grid but no text yet cannot fail the firing test**, so the harness gap
surfaces only when the content lands.

**Note on concurrency.** Two sessions pushed to `feature/caelus-free` during
this one, so `git fetch` and rebase before every push, and rebuild
`caelus` → `caelus-delineations-pd` → `caelus-delineations-house` in that
order after taking someone else's engine change; a stale `dist` shows up as
mystifying type errors in `grid.ts`.

## Next actions

1. **The B3 adversarial review pass** (proposal §6 pass 5) — the front of the
   queue, and the batch is fully written and green, so nothing blocks it.
   Reviewers per `reviewer-instructions-b3.md`, grouped by family and by
   first body. The batch's own traps to hunt: compatibility verdicts sneaking
   back in, essays that would serve their own mirror, romance assumed where
   the cell does not name it, conduct claims in the Pluto and Saturn cells,
   and generational hedges hardened into a formula across the outer-planet
   slices. Add the three finds above to the reviewers' brief: the
   near-duplicate backlog in the synastry families, the unlinted cross-family
   echoes between a body's house/sign/aspect essays, and the 1/10/12 caveat
   placement in composite-house. B1, B2 and B4 all showed the review finds
   what no lint can.
2. **Turn `lintNearDuplicateSentences` on in `lintCorpus`** once the review
   pass has cleared the 348, so the gate holds for B5 onward.
3. **M4's remaining rows.** The Places surface still owes local-space lines
   (engine backlog). Explore still owes the `when()` power-query UI, the
   Gauquelin sector table, and the horary helper page with its strictures
   checklist. The "what if" explorer for a pair (`counterfactual`/
   `chartDiff`, proposal §5.4's last row) is not built.
4. **Then M5** (build-plan §3): the Journal complete, including the owner's
   calendar-layers directive above, and the Vedic surfaces with batch B5.
5. **Engine backlog** (reference-first, goldens): tertiary/minor progression
   rates, converse directions, local-space lines, persona charts over
   `returns()`. Draconic, angleContact, transitHouse, station, node-aspect,
   node-transit-target, peregrine, return, lunation, solarPhase,
   composite-aspect and compositeFrame (the composite house convention) are
   done.
6. **Still owed on Times** (unchanged from session 4): the fuller
   progressions surface, primary directions, the graphic ephemeris, and
   harmonics/antiscia in Advanced. All four are engine-complete.
7. **B8 education library** can start any time; the M3 and M4 surfaces now
   need walkthroughs too (People, Places, the date finder, the calendars).
8. At a stable point, merge to `dev` for a preview deploy (build-plan §6.5).

## Superseded next actions (session 4)

1. **M4 — other people, other places** (build-plan §3), now the front
   of the queue: People (synastry with named verdicts, composite,
   Davison, bi-wheels) with batch **B3**, whose grid is already built
   and ready to run: `b3Grid()` enumerates 764 cells (synastry-aspect
   500 as ordered pairs, synastry-overlay 120 written for the "your
   body in their house" direction, composite-placement 144),
   `gen-briefs` slices them into 62 briefs, and
   `writer-instructions-b3.md` / `reviewer-instructions-b3.md` carry
   the batch's governing rule: contact is not compatibility, and no
   entry grades a relationship or advises staying or leaving. The one
   engine gap is composite *aspects* (the projection emits composite
   placements but no aspects among them), which is what separates this
   764 from the proposal's ~870: add them reference-first with goldens,
   then extend the grid. Also Places
   (astrocartography, relocation, parans; the M1 map kit and
   `AstroMapPanel` are built); the calendars and the date finder in
   Times/Tools (eclipse pages, retrograde/ingress/VoC calendars,
   electional timeline UI); ICS export through the M1 calendar kit's
   RFC 5545 lane and the portable envelope.
2. **Engine backlog** (reference-first, goldens): tertiary/minor
   progression rates, converse directions, local-space lines, persona
   charts over `returns()`. Draconic, angleContact, transitHouse,
   station, node-aspect, node-transit-target, peregrine, return,
   lunation, and solarPhase are done.
3. **B8 education library** can start any time (Learn hub exists; the
   812 natal cell pages give the linking targets). The M3 surfaces now
   need their walkthroughs too (timeline, birthday, returns, Today).
4. At a stable point, merge to `dev` for a preview deploy
   (build-plan §6.5). The web build is network-independent.
5. **Polish follow-ups** (small, non-blocking): mount the
   aspectarian/data-view toggle from the table kit in the Chart hub's
   advanced disclosure; wire the ShareCard + `#a=` artifact link onto
   the chart page; programmatic page families for the B2/B4 cells
   (transits and periods) beside the 812 natal ones.

Environment notes for the next session: run `npm install` first; build
packages before typechecking the web app; vale installs from the GitHub
release tarball (v3.9.1) into /usr/local/bin and runs offline thanks to
the vendored styles (curl the release asset, untar, move to
/usr/local/bin). Web-lib unit tests run with
`node scripts/test-web-libs.mjs` (also in root `npm test` and CI); note
esbuild's classic JSX transform there means any `.tsx` pulled into a
test needs `import * as React from "react"`. Content batches: build the
package, run `node pipeline/gen-briefs.mjs` for briefs of unwritten
cells, spawn writer agents per brief against
`pipeline/writer-instructions.md`, wire sets into `src/passages.ts`,
then reviewer agents per `pipeline/reviewer-instructions.md`, then the
package test. Writer and reviewer agents both work well at ~10-15
entries per slice, up to ~12 concurrent.
