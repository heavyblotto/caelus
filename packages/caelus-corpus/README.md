# The Caelus corpus

An original corpus of astrological readings, the writing pipeline that produced
it, and the prose lints that gate it.

**3,056 essays. ~1.09 million words. Median 361 words each.** Every essay is
bound to a fact the engine can compute, fired against a chart that carries
that fact, and linted as prose before it ships. Coverage is a count against an
enumerated grid, not a claim.

Lives in the Caelus monorepo. The only dependency is the engine. Not published
to npm; the corpus is published as a versioned download on the Caelus site.

## Quick start

```bash
npm install          # pulls caelus >=0.25.0
npm run build        # tsc
npm test             # binding + firing + lints over all 3,056 entries
```

`npm test` is the harness. For each entry it proves four things: the entry
sits on a real grid cell, it compiles to a rule, it fires against a chart
carrying its fact, and it does *not* fire against a chart where that fact is
shifted. Then it runs the corpus lints over every family. A slice that fails
any of those does not merge.

## What is here

| Path | What it is |
|---|---|
| `data/passages/` | 246 JSON files, the 3,056 essays |
| `src/grid.ts` | the grid: 3,658 cells enumerated as a coverage contract (3,056 written) |
| `src/lint.ts` | the corpus lints, in order of subtlety |
| `src/selectors.ts` | serializable selector specs → live engine selectors |
| `src/compile.ts` | passages → rules → `InterpretationSource` |
| `src/passages.ts` | generated; regenerate with `npm run register` |
| `test/validation.test.ts` | the harness described above |
| `pipeline/` | the writing machinery: briefs, checks, instruction sheets, wave sheets |
| `editorial/` | the voice, the Vale styles, the prose gates |
| `backlog/` | the lint backlog worklists, all at zero since 2026-08-19 |

## The corpus

| Batch | Cells | Families | Review |
|---|---|---|---|
| B1 natal | 812 | sign, house, aspect, rising, MC, angle contact, dignity, pattern, signature, out-of-bounds, retrograde | complete |
| B2 transits | 738 | transit-aspect, transit-house, station | complete |
| B3 relationship | 1,238 | synastry-aspect, synastry-overlay, composite-aspect, composite-placement, composite-house | complete |
| B4 timing | 268 | profection, ZR, firdaria, dasha, lunation, eclipse, return, solar phase | complete |
| B5 conditions | 602 (600 bindable) | lot-sign, lot-house, dispositor, reception, star, star-contact, parallel, nakshatra-moon, nakshatra-pada, varga-d9, varga-frame, yoga | grid scaffolded, unwritten |

Two things to know about what "written" means here. A cell is written when it
passes the harness and the lints; it is *reviewed* when an adversarial pass
has read it against the instruction sheets. The two are tracked separately
because the review consistently finds what no lint can: cycle-length errors,
compatibility verdicts, conduct claims, essays that would serve as their own
mirror.

**Not written:** B5 (lots, fixed stars, receptions, parallels, nakshatras,
vargas, yogas — 600 bindable cells, grid and instruction sheets landed,
essays not started), B6 (decans and degree symbols, ~400 — the degree
symbols are original, written for this corpus), and B8 (site guides, ~180
pieces after the glossary moved to the Encyclopedia).

## The pipeline

The loop that produced 3,056 essays, in the order you run it:

```bash
node pipeline/gen-briefs.mjs                        # grid → per-slice work orders
#   … writers work a slice each, against the instruction + wave sheets …
node pipeline/check-slice.mjs <brief> <slice>       # your slice against its brief
node pipeline/check-family.mjs <slice>              # your slice against the whole family
node pipeline/register-sets.mjs                     # data/passages → src/passages.ts
npm run build && npm test                           # the harness
```

`pipeline/` also carries the sheets that make a writer prompt six lines
instead of a page: `voice-sheet.md` (the contract for every entry), five
`writer-instructions-*.md`, five `reviewer-instructions-*.md`, and the
`wave-*.md` sheets. **Write a new wave sheet per wave.** It is cheaper than
repeating yourself to twelve agents, and it is where a mid-wave discovery gets
recorded for the agents still to come.

Two rules the waves paid for:

- **One slice per first body per wave.** Same-body siblings never write blind
  against each other, and each wave checks against a larger shipped corpus
  than the last.
- **`check-slice` lints a slice against itself; `check-family` lints it
  against the corpus.** Parallel writers pass their own check and still
  collide. Both are required before merge.

## The lints, in order of subtlety

Each was added because a review pass caught by eye what the previous lint
could not see. That escalation is the most transferable thing in this bundle.

| Lint | Catches | In `lintCorpus`? |
|---|---|---|
| `lintPassage` | length band, banned phrases, reading level, second person | yes |
| `lintDuplication` | 4-gram overlap ratio between two entries | yes |
| `lintSharedSentences` | a whole sentence, verbatim, in two entries | yes |
| `lintSkeletons` | a third of a family sharing an opening or closing | yes |
| `lintNearDuplicateSentences` | the same sentence with a word swapped (LCS over words) | yes |
| `lintCrossFamilyEchoes` | a body's sign / house / aspect essays echoing each other | yes |
| `lintFormulaClusters` | a rhetorical *move* a family has converged on | yes |

The last three started as writer-facing reports because turning them on
would have failed already-shipped content. The repair waves of 2026-08-19
took that backlog to zero (from 320 / 49 / 444 findings at its peak), and
all three gate in `lintCorpus` since — every batch after B4 writes against
them from its first slice.

## The backlog (closed)

`backlog/` holds the three worklists, regenerated by
`node pipeline/report-backlog.mjs`, plus the semantic-echo report from the
embeddings pipeline. All sit at zero findings across the corpus since
2026-08-19: two repair waves (`pipeline/wave-b1b2-repair.md`,
`pipeline/wave-b3-review.md`) and their mop-ups cleared them, and the
lints now gating in `lintCorpus` keep them at zero.

## Dependencies

Only `caelus` (>=0.25.0). The engine supplies the selector factories the
corpus binds to and the `interpret()` the harness fires through.

`src/selectors.ts` is vendored from `caelus-delineations-pd` v0.1.6 so this
package no longer depends on it. See `PROVENANCE.md` for everything that
changed during extraction and how to reverse it.

The corpus needs the engine at **0.25.0 or later**. Several families bind to
fact kinds added in that cycle: `angleContact`, `transitHouse`, `station`,
`return`, `lunation`, `solarPhase`, `compositeAspect`, composite houses, node
aspects, and peregrine dignity. Against 0.24.x those families compile and
never fire, which the harness catches.

## Product copy

Product-copy linting is the host repo's job, not this package's: the live
extractor is `scripts/extract-web-prose.mjs` at the monorepo root, run by the
root `lint:prose`. The defective reference extractor this package once
carried (it scraped TypeScript as prose and skipped `.ts` modules) was
removed on 2026-08-19. The corpus lints are unaffected — different tool,
different job.
