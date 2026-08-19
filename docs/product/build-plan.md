2026-08-15

Companion documents: [proposal.md](./proposal.md) (vision, IA, content
strategy) · [feature-map.md](./feature-map.md) (every symbol → surface,
audited at 637/637) · [research/](./research/).

Launch is  the full content grid (≈ 4,100 entries at the Hand standard),
and the education library (≈ 375 pieces). The milestones below order the
work toward that one launch; none of them narrows it. 

---

## Workstreams

**D — Content factory.** The corpus pipeline (research → voice → write →
validate → review → ship as a versioned source) and the batch schedule in
§4. Runs continuously from the first milestone to the last; the harness
from `caelus-delineations-pd` validates binding, the new lints validate
length bands, banned phrases, reading level, and duplication.

**E — New packages and stores.**
- `caelus-corpus`: compiled
  `InterpretationSource`s from agent-written `PassageRecord`s, its own
  semver.

## Content batches

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
| B6 | Decans, degree symbols (original symbols, written for the corpus) | ~400 | Chart hub advanced, programmatic pages (M6) |
| B7 | Birth-time finder question bank, journal prompt bank | ~160 | Onboarding (M2) and Journal (M5) |
| B8 | Education library: reading series, casting guides, per-chart-type guides, timing techniques, Vedic path, tool walkthroughs, glossary, FAQ | ~375 pieces | Learn, continuously; complete by M7 |

Post-launch, the per-entry feedback loop re-queues the worst-rated cells
each cycle, as the proposal specifies.

## 5. Verification


- **Content:** the corpus harness (binding, firing, citations) plus the
  new lints on every batch; the education coverage rule checked
  mechanically (artifact types × guides).
- **Prose:** `npm run lint:prose` across all product copy and corpus
  text, including the new consumer-register rules.


## Backlog index

Ticket-ready items, keyed to streams. Locations are where the work lands.

| # | Item | Stream | Size |

| 1 | Learn + programmatic page generator | C/F | L |
| 2 | Corpus pipeline + lints | D | M |
| 3 | Content batches B1–B8 | D | L (continuous) |
| 4 | Synthetic corpus package | E | M |
| 5 | Composer mapping package + norm packs | E | L |


| Symbol | Surface | Scope |
|---|---|---|
| `sources` / `publicDomainSources` / `sourceById` | The PD reading source, shipped alongside the synthetic corpus (tradition toggle: "classical voices" vs "Caelus voice") | ✓ |
| `passages`, `passageSets`, `publicDomainPassages`, `corpusManifest`, `manifestByLayer` | Source-bibliography page ("where the classical text comes from"); strict-PD passage subset | ✓ |
| `selectorFromSpec`, `ruleFromPassage`, `compileSource` | **The synthetic-corpus pipeline reuses this compiler + validation harness verbatim** | ∞ |
| `correspondences`, `correspondencesForBody`, `correspondencesForSign` | Liber 777 correspondence tables in Learn (crystals/plants/etc., clearly labeled) | ✓ |
| Types: `PassageRecord`, `SelectorSpec`, `PassageSet`, `SourceManifestEntry`, `CorpusLayer`, `CorpusRights`, `SourceStatus`, `FetchSpec`, `CorrespondenceEntry`, `CorrespondenceData` | The content-pipeline contract every agent-written entry is emitted against | ∞ |
