# Caelus Free — build plan

2026-08-15

Companion documents: [proposal.md](./proposal.md) (vision, IA, content
strategy) · [feature-map.md](./feature-map.md) (every symbol → surface,
audited at 637/637) · [research/](./research/).

Launch is the whole scope: every surface in the proposal, every mapped
capability, the full content grid (≈ 4,100 entries at the Hand standard),
and the education library (≈ 375 pieces). The milestones below order the
work toward that one launch; none of them narrows it. Sizes are S/M/L
(days/week-scale/multi-week for one builder or one agent swarm); there are
no dates in this document.

---

## 1. Workstreams

Six streams run in parallel. Their internal order is driven by the
dependency facts in §2.

**A — Foundation.** The `/free` app shell in `apps/web/app/free/`: layout,
nav, route skeleton for the eight hubs, settings store (house system,
zodiac, orb profile, body set — global with per-chart overrides, persisted
locally), the people library (charts, tags, person context carried across
tools), share-codec extension to every artifact type, placeholder design
tokens pending the identity work. (M)

**B — Components.** The reusable pieces every hub consumes:
- `MultiWheel` lifted from `apps/web/components/BiWheel.tsx` into
  `packages/wheel` with a rings API (any chart in any ring). (M)
- The wheel interactivity layer in the app: hit-testing, tap-for-card,
  two-way highlight with the placements list, the layered
  simple/advanced disclosure. (M)
- The timeline library in `apps/web/lib/`: composes `find_aspect_dates`-
  style root-finding with `stations`, `crossings`, `ephemeris`, and the
  time-lord period functions into lanes with duration bars; zoom and
  scrub; the You lane hook for Journal sentiment. (L)
- Data-table kit: card-index default, dense data view toggle,
  aspectarian grid in a scrollable container, tabular numerals. (M)
- Calendar kit: month grids, chips, ICS export. (S)
- Map kit: `AstroMap` with a basemap layer, line tap-for-meaning,
  relocated-chart side panel. (M)
- Share-image renderer: story-ratio cards from wheel + big three, per
  wheel theme, generated from the canonical digest. (M)

**C — Hubs and surfaces.** Page work per hub, in the sequence of §3:
onboarding (the sky state machine from the proof of concept), Today,
Chart, People, Places, Times, Journal, Learn, Tools, Chart Lab with the
Composer, the settings and "about this computation" panels, prompt packs
on every artifact, the citation checker, the MCP connect and API pages.

**D — Content factory.** The corpus pipeline (research → voice → write →
validate → review → ship as a versioned source) and the batch schedule in
§4. Runs continuously from the first milestone to the last; the harness
from `caelus-delineations-pd` validates binding, the new lints validate
length bands, banned phrases, reading level, and duplication.

**E — New packages and stores.**
- `caelus-corpus`: compiled
  `InterpretationSource`s from agent-written `PassageRecord`s, its own
  semver.
- `caelus-composer`: versioned norm packs (concreteness,
  frequency, correspondence tables with named recensions), the
  word→coordinate mapper, SRL-to-constraint translation, the time
  registry, anchor promotion, the residual surface. Gated by the rights
  check in §6. (L)
- The Journal store: one entry store with sky-pins, the three lenses, the
  export format; then the NLP annotation layer (lexicon analyzers first,
  embeddings cached-on-device behind them), versioned by analyzer. (L)
- The graph store: nodes and edges over the existing stores, the
  documented edge vocabulary, wheel-radial layout, ego-graph queries,
  JSON-LD export. (L)

**F — Engine and platform backlog.** Reference-first engine additions and
platform work that no surface blocks on, run whenever convenient:
- Draconic transform; tertiary/minor progression rates; converse
  directions; local-space lines; persona-chart convenience over
  `returns()`; a possible `timeline()` helper if the app-side composition
  proves worth promoting. Each lands Python-reference-first with goldens,
  per the repo's rule. (each S)
- Wide-tier Moon pack lazy-fetch or hosted-tier fallback for pre-1920
  dates; range chips wired to `engineCapabilities()`. (M)
- PWA manifest and offline shell; OG image routes for `/free`;
  programmatic page generation from the corpus data; sitemap expansion.
  (M)

## 2. Dependency facts

These are the constraints the sequence in §3 is derived from. Everything
not listed here is order-free.

1. The app shell (A) precedes every hub page (C).
2. `MultiWheel` precedes the People and Times surfaces that render rings.
3. The wheel interactivity layer precedes the Chart hub's tap-to-explain
   and the onboarding translation scene.
4. The timeline library precedes Times and the Today duration bars.
5. The corpus pipeline precedes the first content batch; each reading
   surface needs its cell families written before that surface reads as
   finished (the batch schedule in §4 pairs them).
6. The Journal store precedes its lenses; the lenses precede the NLP
   layer's visible features; entries and people must exist before the
   graph has anything to join, so the graph store follows the Journal
   store and people library.
7. The Composer package follows the norm-pack rights check; the Composer
   surface follows the Chart Lab shell; the Journal's second sky follows
   the Composer package.
8. Programmatic SEO pages are generated from corpus cells, so each page
   family follows its content batch.
9. The design identity leads the schedule: the twilight and almanac
   execution, the glyph set, and the wheel themes run from day one, ahead
   of and alongside M0. Surfaces that start before a token lands use
   placeholders and swap as tokens arrive.
10. Prompt packs need only `chartBrief` and exist per artifact as
    artifacts ship; the citation checker follows the prompt packs.
11. The onboarding state machine needs the Sun-position path (trivial),
    the star field from the packs, `pheno` for the Moon, and the wheel
    translation scene from (3); the birth-time finder path inside it
    needs `rectification_grid` surfaces and the finder question bank from
    batch B7.

## 3. Proposed sequence

Eight milestones, M0–M7. Content batches (§4) run beside them
continuously. Everything below ships before launch; the order exists so
each milestone hands the next one what it needs.

- **M0 — Ground.** The design identity work leads: twilight and almanac
  execution, glyph set, wheel themes, the token system — the vision made
  visible first. Foundation stream A completes beside it: shell, nav,
  settings, people library, share codec. Corpus pipeline stood up with
  the voice sheet and lints; batch B1 begins. Engine backlog stream F
  begins.
- **M1 — Components.** Stream B complete: MultiWheel published, wheel
  interactivity, timeline library, table/calendar/map/share kits.
- **M2 — The chart is alive.** Onboarding (full state machine, locked
  copy, privacy line, birth-time finder path), the Chart hub with the
  Reading (batch B1 cells live), settings and honesty chips,
  "about this computation," first prompt packs (full natal, career,
  love). First programmatic page family (natal cells).
- **M3 — The sky moves.** Today (transit stack with duration bars, moon
  strip, coming-up feed, cosmic weather) and Times (the unified timeline
  with transit, progression, return, and time-lord lanes; the birthday
  page; planetary returns). Batches B2 and B4 land with them. Today/this
  year prompt packs.
- **M4 — Other people, other places.** People (synastry with named
  verdicts, composite, Davison, bi-wheels) with batch B3; Places
  (astrocartography, relocation, parans) ; the calendars and the date
  finder in Times/Tools (eclipse pages, retrograde/ingress/VoC calendars,
  electional timeline UI); ICS export.
- **M5 — The inner life.** Journal complete: store, three formats,
  lunation chapters and profection volumes, prompts behind the gentle
  affordance, marginalia, eclipse letters, People lens, NLP annotation
  layer with the correlations surface and the You lane wired into Times;
  batch B7 (finder and journal banks) live. Vedic surfaces (sidereal
  mode, nakshatras, dashas, vargas, yogas) with batch B5.
- **M6 — The deep layer.** Chart Lab (archetypal designer, fictional
  charts, what-if explorer, similar skies) and the Composer (package,
  surfaces, name charts, seals, hierarchy, grounding, time registry,
  residual); the knowledge graph (store, wheel layout, ego-graph queries,
  neighborhood prompt pack, export); the Planetarium (three combinable source layers, dome and sphere projections, the paired wheel-and-sphere view with the flatten animation); citation checker;
  MCP connect and API pages. Batches B6 and B8 complete.
- **M7 — Whole.** Full grid verified complete against the content
  inventory; education library complete with the coverage rule checked
  (every artifact has its guide, every tool its walkthrough); the
  identity polish pass across all surfaces; PWA; both themes audited; the
  launch checks in §5. Launch.

## 4. Content batches

Every batch runs the six-pass pipeline and merges only when the harness
and lints pass and the adversarial review clears it against the Hand
standard. Counts are from the proposal's grid.

| Batch | Families | ≈ Entries | Paired surface |
|---|---|---|---|
| B1 | Planet in sign, planet in house, aspects, rising/MC, angle conjunctions, dignities, patterns, signature, out of bounds, natal retrogrades | ~800 | Chart hub (M2) |
| B2 | Transits by aspect and by house, stations | ~790 | Today and Times (M3) |
| B3 | Synastry aspects, house overlays, composite | ~870 | People (M4) |
| B4 | Time-lords, planetary returns, eclipses and lunations, solar phase | ~270 | Times (M3–M4) |
| B5 | Lots, fixed stars, receptions, parallels, nakshatras, vargas, yogas | ~600 | Traditional and Vedic surfaces (M5) |
| B6 | Decans, degree symbols (rights check first) | ~400 | Chart hub advanced, programmatic pages (M6) |
| B7 | Birth-time finder question bank, journal prompt bank | ~160 | Onboarding (M2) and Journal (M5) |
| B8 | Education library: reading series, casting guides, per-chart-type guides, timing techniques, Vedic path, tool walkthroughs, glossary, FAQ | ~375 pieces | Learn, continuously; complete by M7 |

Post-launch, the per-entry feedback loop re-queues the worst-rated cells
each cycle, as the proposal specifies.

## 5. Verification

- **Coverage:** re-run the feature-map audit against the shipped app — a
  script walks the map and checks each ✓ row names a live route or
  control. Any row without a surface is a launch blocker.
- **Content:** the corpus harness (binding, firing, citations) plus the
  new lints on every batch; the education coverage rule checked
  mechanically (artifact types × guides).
- **Prose:** `npm run lint:prose` across all product copy and corpus
  text, including the new consumer-register rules.
- **Math:** no new engine claims without goldens; the engine backlog
  items follow reference-first like everything before them.
- **Accessibility and themes:** keyboard paths on the wheel and timeline,
  WCAG contrast in both themes, reduced-motion variants of the onboarding
  and translation scenes.
- **Performance:** the engine is ~151 KB gzipped and computes client-side;
  budgets keep first-load lean (norm packs, star packs, NLP models, and
  the corpus all lazy-load behind their surfaces).
- **Privacy:** a check that no network request carries birth data, entry
  text, or analysis output; the two promises appear verbatim where
  specified.

## 6. Decisions (all made)

1. **Onboarding is coded fresh** in `apps/web`, against the shell. The
   MyMagus proof of concept is the behavioral spec, and none of its code
   carries over.
2. **Design leads.** The identity work runs first and early — the vision
   made visible outranks nearly everything else in the schedule. M0 and
   dependency fact 9 reflect this.

3. **Composer norm packs.** The rights check runs at M0. If the licenses
   allow redistribution, the packs ship in the package; if not, the app
   fetches the tables from their source on first use and caches them on
   the device, with attribution. No further decision needed.
4. **Package names.** `caelus-corpus` for the synthetic
   corpus and `caelus-composer` for the mapping package.
5. **Branch and deploy.** A long-lived feature branch off `dev` with
   preview deploys per milestone, merging to `dev` at stable points.
6. **Order.** The default sequence stands, and everything gets built.

## 7. Backlog index

Ticket-ready items, keyed to streams. Locations are where the work lands.

| # | Item | Stream | Size |
|---|---|---|---|
| 1 | `/free` shell, nav, route skeleton | A | M |
| 2 | Settings store with presets and per-chart overrides | A | M |
| 3 | People library with person context | A | M |
| 4 | Share codec for all artifact types | A | S |
| 5 | `MultiWheel` in `packages/wheel` (+ tests, publish) | B | M |
| 6 | Wheel interactivity layer | B | M |
| 7 | Timeline library (lanes, zoom, scrub) | B | L |
| 8 | Table kit + aspectarian | B | M |
| 9 | Calendar kit + ICS | B | S |
| 10 | Map kit basemap + relocation panel | B | M |
| 11 | Share-image renderer | B | M |
| 12 | Onboarding state machine + finder path | C | L |
| 13 | Chart hub + Reading + honesty chips | C | L |
| 14 | Today | C | M |
| 15 | Times (timeline surfaces, birthday, returns) | C | L |
| 16 | People (verdicts, composite, Davison) | C | L |
| 17 | Places | C | M |
| 18 | Calendars + date finder | C | M |
| 19 | Journal (store, lenses, NLP, correlations, You lane) | C/E | L |
| 20 | Vedic surfaces | C | M |
| 21 | Chart Lab + Composer surfaces | C | L |
| 22 | Knowledge graph (store, layout, queries, export) | E | L |
| 23 | The Planetarium (real, imagined, composed layers; dome + sphere projections; paired view) | C | M |
| 24 | Prompt packs + citation checker | C | M |
| 25 | Learn + programmatic page generator | C/F | L |
| 26 | Corpus pipeline + lints | D | M |
| 27 | Content batches B1–B8 | D | L (continuous) |
| 28 | Synthetic corpus package | E | M |
| 29 | Composer mapping package + norm packs | E | L |
| 30 | Engine parity backlog (5 items, reference-first) | F | M total |
| 31 | Moon wide-tier fallback + range chips | F | M |
| 32 | PWA, OG images, sitemap | F | M |
| 33 | Verification suite from §5 | F | M |
