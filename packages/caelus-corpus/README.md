# The Caelus corpus

An original corpus of astrological readings, the writing pipeline that produced
it, and the prose lints that gate it.

**3,096 essays. ~1.09 million words. Median 360 words each.** Every essay is
bound to a fact the engine can compute, fired against a chart that carries
that fact, and linted as prose before it ships. Coverage is a count against an
enumerated grid, not a claim.

Lives in the Caelus monorepo. The only dependency is the engine. Not published
to npm; the corpus is published as a versioned download on the Caelus site.

## Quick start

```bash
npm install          # pulls caelus >=0.25.0
npm run build        # tsc
npm test             # binding + firing + lints over all 3,096 entries
```

`npm test` is the harness. For each entry it proves four things: the entry
sits on a real grid cell, it compiles to a rule, it fires against a chart
carrying its fact, and it does *not* fire against a chart where that fact is
shifted. Then it runs the corpus lints over every family. A slice that fails
any of those does not merge.

## What is here

| Path | What it is |
|---|---|
| `data/passages/` | 249 JSON files, the 3,096 essays |
| `src/grid.ts` | the grid: all 3,096 cells enumerated as a coverage contract |
| `src/lint.ts` | the corpus lints, in order of subtlety |
| `src/selectors.ts` | serializable selector specs → live engine selectors |
| `src/compile.ts` | passages → rules → `InterpretationSource` |
| `src/passages.ts` | generated; regenerate with `npm run register` |
| `test/validation.test.ts` | the harness described above |
| `pipeline/` | the writing machinery: briefs, checks, instruction sheets, wave sheets |
| `editorial/` | the voice, the Vale styles, the prose gates |
| `backlog/` | the three open lint backlogs, as worklists |

## The corpus

| Batch | Cells | Families | Review |
|---|---|---|---|
| B1 natal | 812 | sign, house, aspect, rising, MC, angle contact, dignity, pattern, signature, out-of-bounds, retrograde | complete |
| B2 transits | 738 | transit-aspect, transit-house, station | complete |
| B3 relationship | 1,238 | synastry-aspect, synastry-overlay, composite-aspect, composite-placement, composite-house | **500 of 1,238** |
| B4 timing | 268 | profection, ZR, firdaria, dasha, lunation, eclipse, return, solar phase | complete |
| B7 birth-time finder | 40 | rising-fit, event-angle | written |

Two things to know about what "written" means here. A cell is written when it
passes the harness and the lints; it is *reviewed* when an adversarial pass
has read it against the instruction sheets. The two are tracked separately
because the review consistently finds what no lint can: cycle-length errors,
compatibility verdicts, conduct claims, essays that would serve as their own
mirror.

**Not written:** B5 (lots, fixed stars, receptions, parallels, nakshatras,
vargas, yogas, ~600), B6 (decans and degree symbols, ~400 — do the rights
check on degree symbols first), B8 (the education library, ~375 pieces), and
the journal prompt bank that was scoped alongside B7 (~120).

## The pipeline

The loop that produced 3,096 essays, in the order you run it:

```bash
node pipeline/gen-briefs.mjs                        # grid → per-slice work orders
#   … writers work a slice each, against the instruction + wave sheets …
node pipeline/check-slice.mjs <brief> <slice>       # your slice against its brief
node pipeline/check-family.mjs <slice>              # your slice against the whole family
node pipeline/register-sets.mjs                     # data/passages → src/passages.ts
npm run build && npm test                           # the harness
```

`pipeline/` also carries the sheets that make a writer prompt six lines
instead of a page: `voice-sheet.md` (the contract for every entry), four
`writer-instructions-*.md`, four `reviewer-instructions-*.md`, and three
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
| `lintNearDuplicateSentences` | the same sentence with a word swapped (LCS over words) | **no** |
| `lintCrossFamilyEchoes` | a body's sign / house / aspect essays echoing each other | **no** |
| `lintFormulaClusters` | a rhetorical *move* a family has converged on | **no** |

The last three are writer-facing only. They run in `check-slice` and
`check-family`, and they are not in `lintCorpus`, because turning them on
today fails already-shipped content. That content is the backlog.

## The open backlog

`backlog/` holds the three worklists, regenerated by
`node pipeline/report-backlog.mjs`. Current state:

| Backlog | Findings | Repairs owed |
|---|---|---|
| Near-duplicate sentences | 320 | 158 collisions |
| Cross-family echoes | 49 | 26 collisions |
| Formula clusters | 444 | 126 clusters |

**The finish line: clear these, then move all three lints into `lintCorpus`.**
That is what makes the gate hold for every batch after. It is not an optional
tidy-up; it is the last step of the work that is already done.

The near-duplicate backlog was 303 collisions before one review wave of ten
agents cleared the synastry-aspect family to zero. The approach works; it just
has not been run over B1, B2 and the rest of B3. `pipeline/wave-b1b2-repair.md`
and `pipeline/wave-b3-review.md` are the sheets for exactly that.

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

## Known defect

`editorial/scripts/extract-web-prose.mjs` scrapes source files into the file
Vale grades, and it is scraping TypeScript along with the prose: about 18% of
the graded lines are `import(...)` statements and type declarations. It also
only walks `.tsx`, so copy that lives in `.ts` modules is never linted at all.
Until that is fixed the product-copy gate is theatre. The corpus lints are
unaffected — different tool, different job.
