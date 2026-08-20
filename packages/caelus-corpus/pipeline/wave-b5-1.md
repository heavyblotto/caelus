# B5 wave 1 — sheet

Read this after `writer-instructions.md`, `writer-instructions-b5.md`
(whose section for your family governs you), `voice-sheet.md`, and
`editorial/editorial-voice.md` including its Caelus Free section. This
sheet collects what every slice in this wave shares, so the per-slice
prompt can be short. Nothing here overrides the instruction sheets.

## The wave

B5 opens the condition layer: the first essays in twelve new families.
Wave 1 writes ten slices, one writer per slice, never two writers in
the same family at once:

| Slice | Family | Cells |
|---|---|---|
| lot-fortune-signs | lot-sign | 12 |
| lot-spirit-houses | lot-house | 12 |
| dispositors | dispositor | 10 |
| receptions | reception | 13 |
| stars-01, then stars-02 | star | 15 + 15 |
| parallels-01 | parallel | 14 |
| nakshatras-moon-01 | nakshatra-moon | 14 |
| varga-d9-sun | varga-d9 | 12 |
| varga-frames | varga-frame | 6 |
| yogas | yoga | 9 |

Your slice may be the first shipped file in its family, so the lints
have nothing to compare you against yet. That is not slack, it is the
opposite: whatever moves you settle into become the family's template,
and six more waves of writers will collide with them. Write as though
84 siblings already exist, because by wave 7 they will.

## What B5 essays open with

Most readers have never met a lot, a reception, a declination parallel,
or a navamsa. The first sentence or two may say plainly what the thing
is, in ordinary words, before the meaning starts. But the explainer is
the highest formula risk in this batch: the sentence "what a lot is"
has an obvious shape, and every sibling essay needs one. The B3 lesson
applies in full: `lintSharedSentences` only catches a sentence repeated
verbatim, so a formula survives the lint as long as each writer swaps
one word. The test for your own draft is not "is this sentence unique?"
but "would another competent writer, given this same cell and this same
sheet, have written this sentence?" If yes, cut it or say it through
this cell's particular content. Vary where the explainer sits, how long
it runs, and whether it exists at all: within one slice, essays 3 and 9
can assume slightly more than essay 1.

## One configuration, B5 edition

The selector guarantees exactly its fields, and the traps this wave are
new ones. The chart's sect is never known to a lot essay. A dispositor
essay knows no sign or house. A reception route cell names no planets;
a reception body cell names no partner and no signs. A star essay does
not know which body sits on the star and never names a zodiac sign
(precession: name the constellation). A parallel is not a conjunction.
The sidereal families (nakshatras, vargas, yogas) never make tropical
claims: never name the reader's tropical Moon sign, never claim the
rasi sign from a D9 placement. Doctrine pinned in
`writer-instructions-b5.md` (lot keepers, mansion lords and spans,
pada-navamsa mapping, varga subjects, yoga definitions) is guaranteed
and safe to state; everything else is not.

## Skeletons and shared sentences

The family lints fail a family whose entries share a whole sentence of
six words or more, or where more than a third opens or closes with the
same first six words. Your slice shares its family with slices still to
come. So: vary the opening sentence shape, not just its nouns; vary the
closing move; if a phrase in an instruction sheet reads well, that is a
reason not to lift it verbatim. Read one shipped B1 file
(`data/passages/b1-sun-signs.json`) for register before you start, and
do not copy its moves either.

## Output and self-check

A JSON array in brief order. Each object has exactly the keys `id`,
`family`, `when`, `atomIds`, `text`, the first four copied verbatim
from the brief, `text` your essay, one paragraph, no em dashes, plain
ASCII. Write it to `data/passages/<outFile>` from the brief.

Then, from `packages/caelus-corpus/`:

```
node pipeline/check-slice.mjs pipeline/briefs/<your-brief>.json data/passages/<your-outFile>.json
node pipeline/check-family.mjs data/passages/<your-outFile>.json
```

Fix and re-run until check-slice prints its ok line and check-family
reports no FAIL naming your own entries. A `note` line naming another
file's entry is not yours to fix.

Writers run in parallel against a shared `dist/`: do NOT run
`npm run build`, `npm test`, or `node pipeline/gen-briefs.mjs`. The
self-check scripts are the only validation you run. Do not commit. Do
not edit any file other than your own output. Report one line: slice
name, entry count, both checks passed, plus anything worth flagging.

## Mid-wave discoveries

(recorded here as they surface; agents launched later in the wave read
this section)
