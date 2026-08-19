# Caelus corpus — build plan

2026-08-15

The corpus is complete at the full content grid (≈ 4,100 entries at the Hand
standard) and the education library (≈ 375 pieces). The batches below order
the writing toward that one completion; none of them narrows it. The package
publishes as a versioned download on the Caelus site. 

---

## Workstreams

**D — Content factory.** The corpus pipeline (research → voice → write →
validate → review → ship as a versioned source) and the batch schedule below.
Runs continuously from the first batch to the last; the package harness
validates binding and firing, the lints validate length bands, banned
phrases, reading level, and duplication.

**E — The package.** Landed on this branch.
- `caelus-corpus`: compiled
  `InterpretationSource`s from agent-written `Passage`s, its own
  semver.

## Content batches

Every batch runs the six-pass pipeline and merges only when the harness
and lints pass and the adversarial review clears it against the Hand
standard.

| Batch | Families | ≈ Entries |
|---|---|---|
| B1 | Planet in sign, planet in house, aspects, rising/MC, angle conjunctions, dignities, patterns, signature, out of bounds, natal retrogrades | ~800 |
| B2 | Transits by aspect and by house, stations | ~790 |
| B3 | Synastry aspects, house overlays, composite | ~870 |
| B4 | Time-lords, planetary returns, eclipses and lunations, solar phase | ~270 |
| B5 | Lots, fixed stars, receptions, parallels, nakshatras, vargas, yogas | ~600 |
| B6 | Decans, degree symbols (original symbols, written for the corpus) | ~400 |
| B7 | Birth-time finder question bank, journal prompt bank | ~160 |
| B8 | Education library: reading series, casting guides, per-chart-type guides, timing techniques, Vedic path, tool walkthroughs, glossary, FAQ | ~375 pieces |

Status: B1, B2, B4, and the B7 finder bank are written; B3 is partial (500
of 1,238); B5, B6, B8, and the B7 journal prompts are not started. The
package README's coverage table is the live count.

## Verification

- **Content:** the corpus harness (binding, firing, citations) plus the
  lints on every batch; the education coverage rule checked
  mechanically (artifact types × guides).
- **Prose:** the corpus lints gate corpus text; `npm run lint:prose` covers
  repo prose.


## Backlog index

Ticket-ready items, keyed to streams. Locations are where the work lands.

| # | Item | Stream | Size |
|---|---|---|---|
| 1 | Content batches B3 (remainder), B5, B6, B8 | D | L (continuous) |
| 2 | Composer mapping package + norm packs | E | L |

## Reused from `caelus-delineations-pd`

| Symbol | Use |
|---|---|
| `selectorFromSpec`, `ruleFromPassage`, `compileSource` | The corpus pipeline descends from this compiler and validation harness; the selector vocabulary is vendored in `caelus-corpus/src/selectors.ts` |
| Types: `PassageRecord`, `SelectorSpec`, `PassageSet`, `SourceManifestEntry`, `CorpusLayer`, `CorpusRights`, `SourceStatus`, `FetchSpec` | The content-pipeline contract every agent-written entry is emitted against |
