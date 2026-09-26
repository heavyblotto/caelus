# The open backlog

Three lints find real defects in content that has already shipped and already
passed an adversarial review. They run writer-facing, in `check-slice` and
`check-family`, so nothing new lands carrying these defects. They are **not**
in `lintCorpus`, because turning them on today fails the build.

Clearing them and turning the gate on is the finish line for work that is
otherwise done.

| Worklist | Findings | Repairs owed | Concentrated in |
|---|---|---|---|
| [near-duplicates.md](./near-duplicates.md) | 320 | 158 collisions | transit-aspect, natal aspect |
| [cross-family-echoes.md](./cross-family-echoes.md) | 49 | 26 collisions | aspect × planet-in-house, composite-house × composite-placement |
| [formula-clusters.md](./formula-clusters.md) | 444 | 126 clusters | transit-aspect, synastry-aspect, natal aspect |

Regenerate after every wave:

```bash
npm run build && node pipeline/report-backlog.mjs
```

Each worklist carries a per-family summary, a per-file table that *is* the
reviewer assignment, and every finding grouped by file.

## Why these exist

The pattern repeated four times, once per batch. A wave of parallel writers
each passes every lint. The adversarial review then finds a defect that no
lint could see, because the defect is not in any single entry — it is in the
relationship between entries that were written blind against each other. A new
lint gets written to catch that class. Turning it on finds the same defect in
everything already shipped.

- **Near-duplicates.** `lintSharedSentences` only fires on a verbatim repeat,
  so a formula survives as long as each writer swaps one word. One wave
  produced eight variations on *"each pole supplies what the other lacks"*
  across eight slices; every one passed every lint.
- **Cross-family echoes.** The family lints group by family, so a body's house
  essays were never compared against its sign essays — and those are the two
  paragraphs a reader sees side by side in one column.
- **Formula clusters.** A rhetorical *move* a family converged on, where no two
  instances are near-duplicates. Nine essays opening "What you give them is X".
  Each reads fine alone; the set reads like a template, and a reader of two
  notices at once.

## How to run a repair wave

The sheets are written and ready: `pipeline/wave-b1b2-repair.md` for the B1
and B2 families, `pipeline/wave-b3-review.md` for the rest of B3.

About ten reviewers over disjoint files, one per file or per group of files
sharing a first body. Each takes its own rows from the tables above. **Edit
only the files in your own scope** — when a finding names an entry in someone
else's file, fix your side and leave theirs; the other reviewer sees the same
finding from their side, and two sentences diverging from both ends is the
outcome you want.

The repair is never a word swap. Two sentences at 79% similarity pass the lint
and still read as a template. If both say the same true thing about different
geometry, one of them has drifted off its own cell; fix that one and it stops
being generic.

## Evidence this works

One wave of ten reviewers over the 40 synastry-aspect files took that family's
near-duplicates from 145 collisions to zero, and the corpus total from 303 to
158. Along the way it found what the lints were never going to: duration and
compatibility verdicts that the batch forbids outright, conduct claims
concentrated in the Pluto and Saturn cells, mirror cells converged so far that
an essay would have served as its own reverse, and two factual errors — a
generational claim that is the opposite of the truth for anyone born after the
war, and a caveat inferring a birth gap from an aspect that carries no age
information at all.

Budget the waves accordingly. The lint worklist is the entry ticket, not the
job.

## Also outstanding, and not a lint finding

**B3's review pass is 500 of 1,238 cells done.** The synastry-aspect family is
reviewed; synastry-overlay (120), composite-placement (144), composite-aspect
(330) and composite-house (144) are written, green, and unreviewed. B1, B2 and
B4 are fully reviewed.

Two structural defects found by writers that no lint sees yet, both inherited
by whoever runs the remaining B3 waves:

1. **The composite-house caveat is a family-level skeleton.** The
   house-is-a-convention note is correct and required, but nearly all twelve
   files place it in houses **1, 10 and 12** — the cells where it genuinely
   bears. No lint sees a shared *placement* pattern, only shared words. A
   reader who opens two bodies' first-house essays meets the same move twice.
2. **Cross-family echoes are only linted within a body.** The lint groups by
   (scope, body), so echoes between different bodies' essays in the same
   family pair are still invisible.
