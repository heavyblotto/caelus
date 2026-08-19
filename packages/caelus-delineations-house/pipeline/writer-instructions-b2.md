# B2 writer slice — instructions (transits)

You are writing one slice of the Caelus Free interpretation corpus
(`caelus-delineations-house`), batch B2: transit delineations at the
standard of Robert Hand's Planets in Transit. Everything in
`pipeline/writer-instructions.md` applies (read it first, along with
`pipeline/voice-sheet.md` and `editorial/editorial-voice.md`); this sheet
adds the rules specific to transit prose.

## What a transit entry is

A natal essay describes a lifelong tendency. A transit entry describes a
period: something moving in the present sky is touching a fixed point in
the reader's chart, it began, it peaks, and it ends. Write in second
person present tense about what this period tends to feel like and how
the reader can work with it while it lasts. The register is a season,
not a verdict.

## Family-specific rules

**transit-aspect** (300–700 words). The selector guarantees the
transiting body, the natal body, and the aspect. It does not guarantee
the natal body's sign or house, the current phase, or anything about
the reader's age or era.

- **Address the arc** (voice-sheet rule 9): the approach (applying) is
  when the theme builds and feels anticipatory; the exact pass is the
  peak; the separation is the settling. Say how this one tends to
  differ across that arc.
- **Address re-hits**: when the transiting body can retrograde
  (everything but the Sun), the transit may pass the point up to three
  times over an extended stretch. Write what the return passes tend to
  mean (the theme revisits, the second look, the final integration).
  For the Sun as the transiting body, skip re-hits: the Sun does not
  station, so say instead that the pass is quick and annual.
- **Tempo facts are safe**: the transiting body's own rhythm is
  guaranteed by the selector. Transiting Sun aspects last days and
  recur yearly; Mars visits run a week or two in a roughly two-year
  round; Saturn passes color months and return about every seven years
  in the waxing/waning square rhythm; an outer-planet pass can shade a
  year or more and may come once in a lifetime. Use the right tempo,
  in approximate plain words, never precise dates or day counts.
- The same pair at a different aspect is a different entry in your
  slice or someone else's: keep each aspect's character distinct
  (conjunction fuses, sextile offers, square forces, trine eases,
  opposition confronts).

**transit-house** (250–600 words). The selector guarantees the
transiting body and the natal house it moves through, nothing else.
The entry describes the life area under that body's weather while it
is there. Duration varies with the body and the house's size, so keep
tempo approximate ("a Saturn stretch of a couple of years", "a few
weeks of Mars"). Do not name the house's sign or its ruler.

**transit-station** (150–400 words). The selector guarantees the body
and the turn (retrograde or direct). The entry describes the station
week: the sky slowing, the pause, and what that body's turn tends to
mark. Retrograde stations open a review stretch; direct stations
release it. Do not claim the exact day; the entry fires for roughly
the week around the turn.

## Output and self-check

Same as B1: JSON array in brief order with exactly the keys
`id`, `family`, `when`, `atomIds`, `text` (verbatim from the brief
except `text`), then

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

until it prints `slice ok`. Report one line: slice name, entry count,
check passed, plus anything worth flagging.
