# B1/B2 repair wave sheet — clearing the backlog the new lints found

Read this after `reviewer-instructions.md` (the four tests, what you may
fix, what you must not do), then `reviewer-instructions-b2.md` if your
scope is transits, then `voice-sheet.md` and `editorial/editorial-voice.md`
including its Caelus Free section. Nothing here overrides those.

B1 and B2 shipped, and both cleared an adversarial review of their own.
This wave is not a re-review: it is the repair pass for three defects that
**no lint could see when those batches shipped**, and that three new lints
can see now. Do not re-litigate settled content. Fix what the reports name,
and the accuracy or safety problems you trip over on the way.

You are one of about ten reviewers over disjoint files. **Edit only the
files named in your prompt.** When a finding names an entry in someone
else's file, fix your side and leave theirs; two sentences diverging from
both ends is the outcome we want.

## The three reports, which are your worklist

Run all three for each of your files. Each takes a bare name or a path, and
a name matching no file exits with an error rather than reporting nothing.

```
node pipeline/report-near-dupes.mjs   --file <your-file.json>
node pipeline/report-cross-family.mjs --file <your-file.json>
node pipeline/report-formulas.mjs     --file <your-file.json>
```

### 1. Near-duplicate sentences

Two sentences that are the same sentence with a word swapped. Scored by
longest common subsequence over words, so the order matters and a synonym
does not save it. **Repair by making a different move, not by swapping
another word**: two sentences at 79% pass the lint and still read as a
template. If both say the same true thing about different geometry, one of
them has drifted off its own cell. Fix that one and it stops being generic.

### 2. Cross-family echoes

A body's essays compared across the families a reader meets **on one
surface**. The Chart hub's Reading puts a body's sign essay, its house
essay and its aspect essays in one column, so an echo between those was
invisible to every family-scoped lint and obvious to the reader. Repair on
your side, and remember what the two cells actually know: a sign essay may
not claim a house, a house essay may not claim a sign, an aspect essay may
claim neither.

### 3. Formula clusters

The one that needs the most judgement. A rhetorical *move* the family has
converged on, where no two instances are near-duplicates: nine essays
opening "What you give them is X", eleven closing on a hedge, a whole
slice of sextiles explaining that the failure mode is disuse. The lint
links sentences at a lower bar than a near-duplicate and reports the
connected component, so a finding tells you your sentence is one of nine.

**The repair is to break the set up, not to reword one member of it.**
Where the move is doing real work, keep it in the entries where it bears
hardest and cut it from the rest. Where it is scaffolding ("Your Saturn
squares their Mars, so..."), rewrite the opening so the essay starts
somewhere else. A cluster of four is worth one look; a cluster of
seventeen is a template and should end up much smaller.

Some clusters are legitimate and should survive. A family of twelve house
essays will say "the Nth house" twelve times and that is not a defect.
Judge whether a *reader who opened two of these* would see a pattern, and
say so in your report if you decide a cluster stays.

## What is settled and not up for revisiting

- The astrology. B1 and B2 were reviewed for accuracy against the canon;
  fix an error you find, do not re-argue doctrine.
- Cycle-claim rules from the B2 review, still binding: Venus and Sun soft
  aspects perfect roughly twice a year, Saturn's seven-year beat attaches
  to hard angles only, Uranus and node contacts happen once at most.
- The owner's B1 rulings: the astronomically impossible aspect cells stay,
  Neptune in Pisces is adult-voiced, the Moon-North Node motif stays
  hedged, Chiron's thin-tradition note lives in `FAMILY_NOTES` and not in
  the essays.

## Two rulings carried over from the B3 wave, which apply here too

- **Never state a birth-year gap or an orb width.** A cell may state what
  its own geometry entails and nothing more. An aspect cell does not know
  the orb; a transit cell does not know the reader's age.
- **The bolted-on hedge.** An essay that has already refused to predict or
  to grade does not need a closing sentence saying so. Cutting it is
  almost always an improvement.

## What a repair may not do

- Never touch `id`, `family`, `when`, or `atomIds`.
- Stay inside the family's length band (`LENGTH_BANDS` in `src/types.ts`),
  under FK grade 12, off `BANNED_PHRASES`, no em dashes.
- No wholesale rewrites, no deletions. If an entry needs a rewrite rather
  than a repair, leave it and report it.

## Self-check

Do **not** run the package build or test; the whole wave shares one
`dist`. From the package root:

```
node pipeline/check-texts.mjs data/passages/<your-file.json> [...]
node pipeline/check-family.mjs data/passages/<your-file.json> [...]
```

`check-texts` must print `texts ok`. `check-family` prints `FAIL` for
findings naming your own entries and `note` for other files'; only the
FAILs are yours, and there must be none left. Then re-run the three
reports and confirm the counts you started with have gone to zero, or say
why a survivor should survive.

## Report

Compact. Entries repaired (id + one clause), entries needing a judgment
call or a full rewrite (id + why), clusters you decided to keep and why,
and a one-line verdict per file. Start and end counts from all three
reports. No praise, no summary of the astrology.
