# Caelus corpus build plan

2026-08-19

The Caelus corpus is an original interpretation corpus: one essay per
enumerated grid cell, bound to a fact the engine can compute, linted as
prose, compiled to `InterpretationSource`s. It is not
`caelus-delineations-pd` (public-domain text, already on npm). Done for
the package means every grid cell written and reviewed, the three
backlog lints gating in `lintCorpus`, the harness green, and a
versioned package a consumer can load. The live count is the coverage
table in `packages/caelus-corpus/README.md`.

The Encyclopedia of Hermes (the Encyclopedia) is articles on the
Western esoteric traditions: astrology, alchemy, natural and
ceremonial magic, kabbalah, number symbolism, and the natural
philosophy around them. It lives on ephemengine.com. Astrology is the
first and largest division and the one with an engine behind it. A
reader looks a topic up and reads. The standard is the Stanford
Encyclopedia of Philosophy and the 1911 Encyclopaedia Britannica. The
wiki at astro.com is the low bar; the scholarly peer for the wider
frame is Brill's Dictionary of Gnosis and Western Esotericism. The
Encyclopedia uses Caelus for charts, tables, searches, and plates,
and the Memorativa engine for the numerical figures. History,
schools, people, language, photographs, and other sources stay in
the articles. The corpus package and the Encyclopedia are different
work: different pipeline, grid, and voice. The corpus stays
astrological.

This branch (`feature/house-corpus`) carries the package. The engine on
the branch is the 0.25 code, still labeled 0.24.1. Official 0.25.0 is
cut from `engine/0.25.0`.

---

## Current state

**3,656 essays in.** About 1.26 million words. Median 351 words.
Harness and current lints are green for that set. `tsc` builds against
this workspace.

The corpus serves the engine and ephemengine.com only (owner decision,
2026-08-19). Content ported from the earlier test project that served
app features with no surface here (the birth-time finder bank, the
journal prompt bank, tool guides for the Planetarium, Chart Lab, date
finder, similar skies, and prompt packs) was removed or descoped. The
40 finder cells were deleted from the package; `b7Grid`, the finder
families, and the `finderSets` export are gone.


| Batch                                                            | Cells       | Written     | Reviewed                            |
| ---------------------------------------------------------------- | ----------- | ----------- | ----------------------------------- |
| B1 natal                                                         | 812         | yes         | yes                                 |
| B2 transits                                                      | 738         | yes         | yes                                 |
| B3 relationship                                                  | 1,238       | yes         | 500 of 1,238 (synastry-aspect only) |
| B4 timing                                                        | 268         | yes         | yes                                 |
| B5 lots, stars, receptions, parallels, nakshatras, vargas, yogas | 602 (600 bindable) | yes         | yes (seven waves, 2026-08-20)       |
| B6 ten-degree faces and degree symbols                           | ~400        | not started |                                     |
| B8 site guides                                                   | ~180 pieces | not started |                                     |


B8, rescoped to this repo's surfaces. The glossary moved to the
Encyclopedia (one canonical entry per term; the site links into it).
Tool guides cover the playground, the embed widget, the MCP server, and
the chart API, not tools from the other project.


| Family                  | Contents                                                                                                                                                                                                                                           | Count (≈) |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Reading the birth chart | Tutorial series: the wheel, the big three, planets, signs, houses, aspects, patterns, dignities, chart shape, putting a whole reading together                                                                                                     | ~40       |
| Casting charts          | Entering birth data, choosing house systems and zodiacs, orbs, relocating                                                                                                                                                                          | ~10       |
| Reading each chart type | One guide per artifact: transit chart, synastry, composite, Davison, solar return, lunar return, planetary returns (Saturn return in depth), progressions, solar arc, primary directions, harmonics, antiscia, draconic-parity charts as they land | ~30       |
| Timing techniques       | Profections, zodiacal releasing, firdaria, the three dashas, transits as periods, eclipses, retrogrades, planetary hours, void-of-course, electional basics                                                                                        | ~35       |
| Vedic path              | Sidereal vs tropical, nakshatras, vargas, dashas, yogas, reading the D9                                                                                                                                                                            | ~20       |
| Tool guides             | Playground, embed widget, MCP server, chart API, ephemeris                                                                                                                                                                                         | ~15       |
| FAQ + concepts          | Why a rising sign differs, house-system differences, tropical vs sidereal, orbs, why times matter                                                                                                                                                  | ~30       |
| **Site guides**         |                                                                                                                                                                                                                                                    | **≈ 180** |


Coverage rule for B8: every artifact the site can produce ships with a
matching how-to-read guide, and every site surface ships with a
how-to-use guide.

B3 is fully written and reviewed. The 500 figure was the adversarial
review, run 2026-08-19 as eleven body-sliced reviewers over 60 files
(738 cells), followed by targeted mop-ups (overlay exchange pivots,
synastry formula clusters, B4 dasha near-dupe).

The three writer-facing backlogs now report **zero findings across the
whole corpus** (near-duplicate sentences, cross-family echoes, formula
clusters — down from 38 / 15 / 183 after the B1/B2 wave, and from
320 / 49 / 444 originally). The semantic-echo report is also empty at
its 0.88 cutoff after a final eight-essay rewrite pass. The repair
program is complete.

`backlog/` is regenerated by `node pipeline/report-backlog.mjs`. Sheets
for the repair and B3 review waves already exist
(`pipeline/wave-b1b2-repair.md`, `pipeline/wave-b3-review.md`).

B6 and B8 have no `CellFamily` members, no grid functions, and no
writer-instruction sheets. Those batches start with scaffolding, then
writing. B5 is fully written and reviewed (600/600 bindable cells,
seven waves, 2026-08-20; the two raja/dhana yoga cells stay
`bindable: false` until the engine detects them).

The quality bar is Robert Hand's Para Research series: essay-length
entries that state a theme and then follow it through the life areas it
touches. Major cells (placements, aspects, transits, synastry,
composite) run 300 to 700 words. Condition chips, ten-degree faces, and
degree symbols run shorter. Second person, present tense, non-fatalistic
with full weight. One configuration only: the text never claims a fact
the selector does not guarantee. Length bands for families that exist
are in `packages/caelus-corpus/src/types.ts`. Voice is
`pipeline/voice-sheet.md`.

---

## Unwritten inventory

Counts assume the 13-body default set. Written batches already have
live counts above; these rows are the remaining cells.

### B5 (written)

Written and reviewed 2026-08-20 (602 cells, 600 bindable). The table
below records the enumerated inventory as planned.


| Cell                             | Count (≈) | Engine / selector                                                                                                                                                      |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lots in sign and house           | ~170      | 7 Hermetic lots (Fortune, Spirit, Eros, Necessity, Courage, Victory, Nemesis) × 12 signs + 12 houses. `hasLot`                                                         |
| Reception and house-ruler chains | ~25       | `hasReception`, `hasDispositor`                                                                                                                                        |
| Fixed stars                      | ~120      | Curated ~60 stars × the bodies they actually conjunct. `hasStar`. Catalog is `packages/caelus/data/fixed_stars.json`; the 60 are not named yet                         |
| Parallels                        | 55        | Planet–planet pairs. `hasParallel`                                                                                                                                     |
| Nakshatras                       | 27–130    | 27 mansions (`NAKSHATRAS` in `packages/caelus/src/vedic.ts`): Moon first, then padas, then the other bodies. `hasNakshatra`                                            |
| Vargas                           | ~120      | D9 placements (9 × 12) plus per-varga framing. Engine divisions: D1, D3, D9, D10, D12 (`VARGA_DIVISIONS` also lists D2 and D30). `hasVarga`                            |
| Yogas                            | ~20       | Named set plus raja/dhana framing. Engine already detects Ruchaka, Bhadra, Hamsa, Malavya, Shasha, Gajakesari, Budha-Aditya, Chandra-Mangala, and Kemadruma. `hasYoga` |


### B6 (~400)


| Cell             | Count (≈)         |
| ---------------- | ----------------- |
| Ten-degree faces | 36 (12 signs × 3) |
| Degree symbols   | 360               |


Degree symbols are original, written for this corpus. The engine now
carries a `degree` fact kind (in the unreleased 0.25.0 set): one atom
per placed body plus the ASC and MC, stated ordinally the way degree
symbols count (14°30′ Aries is the 15th degree), each atom also
carrying the ten-degree face index (1–3), with a `hasDegree` selector.
Both B6 rows bind through it: degree-symbol essays select
`{ sign, degree }`, face essays select `{ sign, face }`. Dignity `face`
in the engine remains the essential-dignity *ruler* of a face — a
different fact, not these 36 essays. What B6 still needs is corpus-side
scaffolding: the `CellFamily` entries, `b6Grid()`, and length bands.

### B8 (~180)

Site guides table above. Write as guides (MDX), not as `PassageRecord`
JSON and not as `CellFamily` members. The glossary belongs to the
Encyclopedia; guides link into it rather than defining terms twice.

---

## How a delineation batch is written

This is the loop that produced B1–B4. B5 and B6 use it. B8 and the
Encyclopedia do not.

1. Enumerate the cells in `src/grid.ts` (`b5Grid` / `b6Grid`), add the
  families to `CellFamily` and `LENGTH_BANDS`, add the slice to
   `fullGrid()`, write `pipeline/writer-instructions-bN.md` and
   `pipeline/reviewer-instructions-bN.md`, write a `pipeline/wave-*.md`
   per wave.
2. `node pipeline/gen-briefs.mjs` — grid to per-slice work orders.
  One slice per first body per wave.
3. Research (silent) → write original essays against the brief. Copy
  `id`, `family`, `when`, `atomIds` verbatim from the cell.
4. `node pipeline/check-slice.mjs <brief> <slice>` then
  `node pipeline/check-family.mjs <slice>`.
5. `node pipeline/register-sets.mjs` then `npm run build && npm test`.
6. Adversarial review against the voice sheet (accuracy, voice, safety,
  depth, one configuration). A cell that fails any pass does not merge.

`check-slice` lints a slice against itself; `check-family` lints it
against the corpus. Both are required.

---

## Streams

**D. Content factory.** The loop under "How a delineation batch is
written." Parallel writers: one slice per first body per wave. A slice
that fails the harness or the lints does not merge. Repair waves clear
the three backlogs, then those lints move into `lintCorpus`. B8 is
guides, not that loop. Encyclopedia articles are a third loop.

**E. The package.** `packages/caelus-corpus` landed on this branch as
a workspace. Remaining landing work is below. Own semver, currently
0.1.0. `private: true` (not on npm). The essays live in the public
Caelus repo; a versioned download ships on the ephemengine site. Peer
on `caelus` is `>=0.25.0 <0.26`.

**F. Engine 0.25.0.** Cut from `engine/0.25.0`. The code is in good
shape; the remaining work is the release (version still 0.24.1,
changelog still under Unreleased). That cycle adds the eight fact kinds
the later corpus families bind to (`angleContact`, `transitHouse`,
`station`, `return`, `lunation`, `solarPhase`, `compositeAspect`,
`degree`), plus the classical era pack, `MultiWheel`, and a runtime
`VERSION` export (asserted against `package.json` by
`check-versions.mjs`) so Encyclopedia figure stamps never import
package metadata into browser bundles. Until the tag, this branch
already has those selectors under the 0.24.1 label.

**G. Encyclopedia of Hermes.** Pages on ephemengine.com. Articles at
the SEP / 1911 standard across the Western esoteric traditions, with
astrology as the engine-backed core division. Caelus supplies figures
and tables in the articles; Memorativa supplies the numerical figures.
The pages' visual system (the Plate direction's page-level
implementation) is its own stream:
`docs/product/visual-design-system-plan.md`.

**H. Knowledge base.** `packages/kb` (`caelus-kb`, private): a typed
concept graph of astrological structure plus the hermetic
correspondence web around it. Engine-derived edges (rulership,
exaltation, triplicity, terms, faces, aspect angles, nakshatra lords,
lot formulas, star catalog) are generated from `caelus` at build time
and gated by a drift test; curated files add what the engine does not
compute (traditions, people, source texts from the PD manifest and the
scanned library, variant dignity tables with attribution, house topics
with attestation, the Liber 777 correspondences and the correspondence
systems beyond it, number-symbolism attributions per author, Wikidata
ids). Under the Hermes frame the KB also grows curated subtrees the
engines do not reach: alchemy, kabbalah, tarot, the magical practices,
works, and persons. Ships `kb.json` with a JSON-LD
context plus a parser from atom ids and cell ids to concept ids. Feeds
Encyclopedia infoboxes, the glossary, Reading-tab links, page JSON-LD,
and an MCP define tool. Structure and provenance live in the KB; meaning
lives in the corpus; discourse lives in the Encyclopedia. Landed:
604 nodes and 578 edges, drift-tested against the engine and wired into
the root build/test/CI gates and the version check (same forward pin as
the corpus).

**I. Embeddings.** One vector per essay (`BAAI/bge-m3`, 1024-d,
sentence-transformers on MPS), built locally by a uv project at
`pipeline/embeddings/`, stored as Parquet under `artifacts/` (regenerable,
not in git). Three consumers: a semantic-echo report beside the lexical
lint reports, a committed top-k related-essays JSON for the site, and
evidence packs for Encyclopedia writing. No vector database; exact cosine
over ~3,000 vectors. Landed: all 3,056 essays embedded (~200 s on MPS);
the semantic-echo report (`backlog/semantic-echoes.md`, cutoff 0.88)
sits beside the lexical backlog reports as review-wave input, and
`neighbors.json` carries 8 neighbors per essay. The report excludes
sibling pairs and, since the repair wave proved them irreducible,
same-family mirror pairs (transit:saturn:trine:pluto vs
transit:pluto:trine:saturn describe one sky event from swapped roles).
After the B1/B2 wave, the B3 review wave, and their mop-ups the report
is empty at the 0.88 cutoff; the corpus-wide max sits just under it
(0.880 at display precision).

**J. Memorativa.** `packages/memorativa`: the arithmology engine,
named for the ars memorativa. A public peer of `caelus`, released the
same way: MIT, npm with provenance, versioned in the open 0.25.0
draft. Pure functions with golden tests: theosophical reduction and
addition, the neutralization operators for binaries, ternaries, and
quaternaries, the seven planetary kameas (construction, magic
constants, sigil tracing across the squares), gematria and notarikon
and temurah, lambdoma ratios. Caelus computes the sky, Memorativa
computes the numbers. The KB attributes meanings to numbers per author
with provenance; the Encyclopedia narrates. The scanned correspondence
tables (Agrippa, Skinner, Godwin, the tarot shelf) are the golden-test
oracle; committed goldens pin public-domain sources (Agrippa's kameas,
the Hebrew letter values), and oracles derived from in-copyright scans
stay in the private store as hash-pinned fixtures. Numerical figures in
the articles are Memorativa output and ride the figure harness the same
way engine figures do, stamped with the `memorativa` version.

---

## Remaining work

Task sequencing and status live in the working plan, not here. Two
facts bear on any ordering: the B3 "remainder" was review debt, not
unwritten prose (that review is now done), and B5 essays cannot be
written before the grid names the cells.

### 1. Repair and review of what is already written (done)

Done 2026-08-19. The three backlogs are clear, the B3 review (738
cells) is finished, and `lintNearDuplicateSentences`,
`lintCrossFamilyEchoes`, and `lintFormulaClusters` gate in
`lintCorpus`. New writing gates on them from the first slice.

### 2. Scaffold, then write the unwritten batches

**B5 and B6** are delineation essays. Enumerate the inventory tables
above in `src/grid.ts`, add families and length bands, write the
instruction sheets, then run the write loop. B5 completed that loop
(seven waves, 2026-08-20). B6's fact kind exists: the
engine's `degree` atoms (unreleased 0.25.0) bind both degree symbols
and faces via `hasDegree`; only the grid scaffolding remains.

**B8** is the site guides table. MDX guides, coverage rule
(artifact × how-to-read, surface × how-to-use). Not `CellFamily`. Not
the delineation harness.

### 3. Land the package (done, one follow-up)

Landed 2026-08-19. The package is in root `build` / `test`, CI,
`check-test-wiring.mjs`, and `check-versions.mjs`, so a broken corpus
fails the build. The playground Reading tab loads corpus sources
lazily per family; `caelus-delineations-pd` stays as the npm demo
package. One follow-up waits on the maintainer's tag: align
`devDependencies.caelus` (`^0.24.1`) with the peer
(`>=0.25.0 <0.26`) once 0.25.0 exists.

### 4. Encyclopedia of Hermes

Articles on ephemengine.com. Named the Encyclopedia of Hermes, or
the Encyclopedia. One article per subject, with structure, sources, and
finished prose. The wiki at astro.com does this job at a lower
standard for astrology; for the wider frame the peer is Brill's
Dictionary of Gnosis and Western Esotericism, and nothing open exists
at that standard.

1911 and SEP put maps, tables, and worked examples in the article. The
Features page already asks the engine for a figure at build time. The
Encyclopedia does the same kind of thing, and also photographs,
historical plates, and diagrams. Named instants, the present sky, and
other pictures are available as examples.

Wheel, sphere, ephemeris graph, map, and sky render at build time or on
the page, next to prose or next to other pictures. Shared example
charts keep figures consistent from article to article.


| Article                           | The engines can supply                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Houses                            | One birth through many systems. Cusps in a table. Polar cases. A wheel per system. A birth the reader typed.           |
| Magic square, sigil               | The kamea for a planet, its constant, a name traced letter by letter to its seal (Memorativa).                          |
| Number, tetraktys, gematria       | Theosophical reduction and addition, neutralization decompositions, letter values across the systems (Memorativa).      |
| Zodiac                            | Tropical and sidereal for one instant. Several ayanamsas. A body tracked across a year in both.                        |
| Aspect                            | Angle, orb, applying or separating. A pair in a wheel. A stack of aspects for one chart. A scan of the next exact hit. |
| Retrograde / station              | An ephemeris graph through the turn. Station times. A current or historical station. Speed in a table.                 |
| Eclipse / lunation                | Search results. A famous eclipse (1999 included). A classical-era eclipse. Path geometry. The chart of the syzygy.     |
| Time-lords                        | Profection, ZR, firdaria, dashas, with dates, for a nativity. The period that contains a given day.                    |
| Lots, sect, dignity               | Fortune, Spirit, day or night, essential dignity, for an example or for a chart the page is showing.                   |
| Fixed star                        | Catalog position, magnitude, conjunction, paran, the sky around it.                                                    |
| Returns, progressions, directions | The derived chart as a wheel and as a table of positions.                                                              |
| Astrocartography                  | The map for an example nativity, or for a birth the reader entered.                                                    |
| The sky                           | Sky View at a stated place and time. Constellation overlays. A named star.                                             |
| Election, VOC, hours              | Intervals for a day. A ranked window. Planetary hour at a clock time.                                                  |

**Extent.** The Encyclopedia's extent is the knowledge base, the way
corpus coverage is the grid: the KB nodes (bodies, signs, houses,
aspects, dignities, lots, nakshatras, vargas, yogas, the star catalog,
traditions, people, source texts, and the curated hermetic subtrees as
they land) each resolve to a full article, a glossary entry, or an
explicit not-written marker, and a coverage report over the KB shows
where that stands. Synthesis subjects that are not single nodes (house
division as a problem, the tropical–sidereal question, sect,
calculation and ephemerides, correspondences as a system, the
historical entries) are their own hand-listed articles. The
maintainer's library is the horizon of the historical and doctrinal
coverage: the Encyclopedia covers what the shelf covers, per
`docs/product/library-ingestion-plan.md`. Each article
is researched and cited individually: sources through the KB's
provenance edges to the PD manifest and the scanned library, figures
as plate specs, embeddings evidence packs.

### 5. Engine 0.25.0 release

Cut from `engine/0.25.0` by the maintainer, who is holding it open so
engine changes surfacing from this work (fact kinds, `VERSION`, skyview
exports) can ride it. Release mechanics are `docs/releasing.md`. The
corpus peer range already names the 0.25 line, and the `VERSION`
constant moves with the bump under `check-versions.mjs`.

### 6. Distribution (closed)

Give the corpus away. Stay off npm (`private: true`); convenience, not
lock-down. Essays live in the public Caelus repo. Consumers get a
versioned download on the ephemengine site, not `npm install caelus-corpus`. MIT stays. Revisit npm later if the install path is
worth it.

---

## Verification

- **Content:** corpus harness (grid membership, selector compile, fires
/ does not fire, citations) plus `lintCorpus` on every batch.
Education coverage (B8) is artifact types × guides, checked
mechanically once that grid exists.
- **Prose:** corpus lints gate corpus text. Root `npm run lint:prose`
gates repo docs and site copy.
- **Engine:** 0.25 golden suites and existing release gates. Several
corpus families compile and never fire against 0.24.x; the harness
catches that.

