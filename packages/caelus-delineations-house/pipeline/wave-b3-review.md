# B3 review wave sheet — the adversarial pass over all 1,238 cells

Read this after `reviewer-instructions.md` (the four tests, what you may
fix, what you must not do) and `reviewer-instructions-b3.md` (the batch's
seven traps). Also read `voice-sheet.md` and `editorial/editorial-voice.md`
including its Caelus Free section. This sheet collects what every slice
in this wave shares so a per-slice prompt can be six lines. Nothing here
overrides the instruction sheets.

You are one of about thirty reviewers running concurrently over disjoint
files. **Edit only the files named in your prompt.** When a finding names
an entry in someone else's file, fix your side of it and leave theirs;
the other reviewer sees the same finding from their side. Two sentences
diverging from both ends is the outcome we want.

## What B3 is

Five families, all read on the People surface:

| family | cells | what the selector knows |
|---|---|---|
| synastry-aspect | 500 | your body, an aspect, their body — an **ordered** pair |
| synastry-overlay | 120 | your body, one of their houses |
| composite-aspect | 330 | two bodies in the composite chart, an **unordered** pair |
| composite-placement | 144 | one composite body, one sign |
| composite-house | 144 | one composite body, one house |

Nothing else. Not orbs, not signs on an aspect cell, not houses on a
placement cell, not who the two people are to each other.

## The three defects this pass exists to clear

These are additional to the four tests and the seven B3 traps. They are
what the last session found and could not fix in flight.

### 1. The near-duplicate backlog

`lintNearDuplicateSentences` scores two sentences by longest common
subsequence over words, so it catches the formula that survives a
one-word swap. It is writer-facing today and **not yet a corpus gate**,
because it reports 303 collisions in already-shipped content. Clearing
them is the point of this pass; the gate goes on afterwards.

Your worklist, for each of your files:

```
node pipeline/report-near-dupes.mjs --file <your-file.json>
```

The `--file` argument takes a bare name or a path, either way. It used to
take only a bare name and print `0 findings` for anything else, which reads
exactly like a clean file; a wave-1 reviewer caught that and it is fixed. A
name matching no file on disk now exits 2 with an error.

Every line naming one of your entries is yours to repair. Repair by
**rewriting the sentence to make a different move**, not by swapping
another word: two sentences at 79% similarity pass the lint and still
read as a template. If the two sentences say the same true thing about
different geometry, one of them is usually the one that has drifted off
its own cell — fix that one and it stops being generic.

### 2. Cross-family echoes

New this session: `lintCrossFamilyEchoes` compares a body's essays
across the families a reader meets **on one surface**. People shows a
body's synastry, overlay and composite essays on one page, so a formula
shared between two of those families was invisible to every family lint
and obvious to the reader. 83 findings across the corpus, and
`composite-aspect x synastry-aspect` is the largest pair, which makes
sense: the same two bodies written twice, once in each voice.

```
node pipeline/report-cross-family.mjs --file <your-file.json>
```

Repair on your side. A synastry entry and a composite entry about the
same body pair **should** differ, because one is about a contact between
two people and the other about a figure in a third chart — an echo
between them usually means one of the two has lost its own voice. That
is the fix: put it back in its family's voice, do not just reword.

### 3. Closer and hedge formulas

The families are full of near-identical disclaimer closers, and they are
the sentences the two lints above keep finding: "none of that cancels
the gift/value", "that is not a verdict on the connection/bond", "that
is not a flaw in the aspect/bond", "neither of you is optional to the
other". The hedge is required — contact is not compatibility — but the
hedge does not have to be a sentence bolted to the end. Prefer carrying
it inside the body of the essay, in that entry's own terms. Cut a closer
that only exists to hedge; if the essay has already refused to grade the
relationship, saying so again is filler.

## Rulings from wave 1 (binding on every wave after it)

Nine reviewers working blind to each other reported the same four things,
each of them as "this needs a decision above my slice". Here are the
decisions. They apply to every family in B3.

### The scope caveat: at most one per file

The slow-planet caveat ("Uranus barely moves, so if your births are close
this belongs to a cohort rather than to the two of you") is correct and
required by the accuracy test. It had also become a paragraph bolted to
thirteen, fifteen, eighteen entries of a single body's slice, reworded each
time so no lint saw it.

**The rule: a body's slice carries the caveat in at most one cell, plus the
same-body cells (your Uranus to their Uranus) where the birth gap is the
cell's actual content and is written distinctly anyway.** Cut it everywhere
else. The People surface states the convention once, in the page's own
words, so no single essay is load-bearing. Where you cut it, cut the whole
move rather than trimming it, and check the entry still says something.

### Never state a birth-year gap

Several entries computed the reader's age gap from the aspect. Do not. The
arithmetic was checked against the ephemeris for this ruling and it does not
survive: the Neptune to Pluto separation was 10 degrees in 1900, 63 degrees
in 1965, and 52 degrees in 2005. Which aspect two near-contemporaries get
therefore depends on the decade they were born in, and the cell cannot know
it. One wave-1 reviewer found four Neptune-Pluto entries asserting the
opposite of the truth for readers born after the war, and was right to
invert them.

What is safe to say: two people close in age have the outer planets at
nearly the same degrees, so an outer-to-outer contact between contemporaries
is shared with everyone born around then, and a contact that needs a wide
gap is two different cohorts meeting. Which is which, this cell does not
know. No years, no decades, no "about twelve years".

### The soft-aspect beat, and the bolted-on hedge

Two formulas the whole family converged on. "The failure mode of a sextile
is not conflict, it is disuse." "A trine asks nothing, so nothing gets
checked." Both are canon and both are required by the wave sheet's own
"ease that can also be inertia". They are still a template when ten sibling
essays make the move in ten rewordings.

**Make the point in the entry's own material terms.** The abstract version
may appear once per file. The same goes for the hedge closer: an essay that
has already refused to grade the relationship does not need a last sentence
saying so, and cutting that sentence is almost always an improvement.

### Orb language in an aspect cell

An aspect cell may state what the aspect *angle* entails, because the angle
is what the selector binds: two Suns in sextile are two signs apart, so the
birthdays are roughly two months apart. It may **not** state a width that
the orb sets, and the orb is exactly what the cell does not know. So a
conjunction cell must not say "inside the same two or three weeks".

### A new lint: `lintFormulaClusters`

Everything above except the arithmetic is now machine-visible.
`lintNearDuplicateSentences` scores *pairs*, so a move spread over nine
essays in nine wordings clears it one pair at a time. The new lint links
sentences at a lower bar and reports a connected *component*: no single edge
is damning, and nine sentences across nine essays is not an accident. It
runs in `check-slice` and `check-family`, and reporting the cluster rather
than the edge is also what makes it fixable, since the repair is to break
the set up.

```
node pipeline/report-formulas.mjs --file <your-file.json>
```

It finds 495 findings in shipped content, so like the near-duplicate lint it
is writer-facing first and a corpus gate once the backlog clears. Findings
naming your files are yours.

## The composite-house convention caveat

The composite chart's houses come from `compositeFrame()`, which builds
equal houses from the midpoint Ascendant and names itself
`equal-from-midpoint-asc`. That convention has to be visible to the
reader, and today it is carried by three of the twelve body files
(jupiter, neptune, pluto), all of them in houses 1, 4, 10 and 12 — the
same cells, in recognizably the same words. A reader who opens two
bodies' first-house essays sees the same move twice, and a reader of the
other nine bodies never sees it at all.

If composite-house is in your scope, your prompt names **which houses
your body carries the caveat in**. Carry it there, in that entry's own
terms, and remove it from your body's other cells. The page states the
convention too, so no single essay is load-bearing.

## What a repair may not do

- Never touch `id`, `family`, `when`, or `atomIds`.
- Stay inside the family's length band (`LENGTH_BANDS` in
  `src/types.ts`), under FK grade 12, off `BANNED_PHRASES`, no em dashes.
- No wholesale rewrites and no deletions. If an entry needs a rewrite
  rather than a repair, leave it and report it.

## Self-check, in this order

Do **not** run the package build or test; thirty reviewers share one
`dist`. Run these from the package root:

```
node pipeline/check-texts.mjs data/passages/<your-file.json> [...]
node pipeline/check-slice.mjs data/passages/<your-file.json> [...]
node pipeline/check-family.mjs data/passages/<your-file.json> [...]
```

`check-texts` must print `texts ok`. `check-family` prints `FAIL` for
findings naming your own entries and `note` for other files'; only the
FAILs are yours, and there must be none left when you finish. Expect a
few collisions to land between your run and someone else's; they get
repaired by hand after the wave.

## Report

Compact. Entries repaired (id + one clause on what), entries needing a
judgment call or a full rewrite (id + why), and a one-line verdict per
file. Also report the counts you started with and ended with from the
two report commands. No praise, no summary of the astrology.
