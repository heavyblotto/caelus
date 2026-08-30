# B6 wave 1 sheet — the pilot (faces-01, degree-symbols-aries)

Read this after `writer-instructions.md` (the per-cell work, the hard
limits, the output shape), `writer-instructions-b6.md` (the batch's
rules), `voice-sheet.md`, and `editorial/editorial-voice.md`. This
sheet collects what the wave shares so a per-slice prompt can be six
lines. Nothing here overrides the instruction sheets.

## What this wave is

The pilot. Two slices land first, get adversarially reviewed, and the
rulings from that review bind every B6 wave after. If you are writing
in this wave, the family voice is yours to set; if you are writing in
a later wave, the rulings section below is required reading.

| slice | file | cells | band |
|---|---|---|---|
| faces-01 | `b6-faces-01.json` | 12 (Aries–Cancer faces) | 120–300 words |
| degree-symbols-aries | `b6-degree-symbols-aries.json` | 30 | 80–200 words |

## The two things B6 lives or dies by

1. **The selector never names the occupying point.** Any body, the
   Ascendant, or the Midheaven may sit in the degree or face. An essay
   that says "your Sun", "your rising degree", a house, or an aspect
   has overreached and fails review. The degree is the subject; the
   reader supplies the point.
2. **The symbols are original.** No Sabian borrowing, no lifted images
   from Charubel, Sepharial, La Volasfera, or any other set. The
   reviewer checks against the public degree books. When in doubt,
   change the image, not the words around it.

## Register anchors

For the short form, read `data/passages/b5-nakshatra-padas-01.json`:
the pada chips are the corpus's nearest existing form — one
distinguishing note per entry, no restating the parent essay. Degree
symbols run shorter still; the image does the work.

## Self-check, in this order

Do **not** run the package build or test; writers share one `dist`.
Run these from the package root (`packages/caelus-corpus`):

```
node pipeline/check-slice.mjs pipeline/briefs/<slice>.json data/passages/<out>.json
node pipeline/check-family.mjs data/passages/<out>.json
```

`check-slice` takes the brief path first and must print `slice ok`.
`check-family` prints `FAIL:` for findings naming your own entries
(yours to fix) and `note:` for other files' (not yours). Finish with
no FAILs.

## Report

One line: slice name, entry count, checks passed, plus anything worth
flagging (a degree where the image fought you, a doctrine judgment
call).

## Rulings from wave 1 (binding on every B6 wave after it)

The pilot's two reviewers found the same underlying defect in both
families: templates invisible to every lint because no two sentences
shared a 4-gram — a binding scaffold in 10 of 30 symbol entries, a
nominalized caveat pivot in 10 of 30, a ruler-plus-image sentence at
the same position in 7 of 12 face entries. All repaired in place. The
originality sweep found zero borrowed images. These rulings bind the
354 unwritten cells.

### Faces

1. **Ruler + image position budget.** At most a third of a slice may
   combine the ruler attribution and the image citation in one sentence
   at the same position. Vary it: ruler in the hook, image first, or
   two sentences.
2. **The image citation is a sanctioned family convention, not a
   skeleton.** The writer sheet mandates the traditional image; what
   must vary is phrasing and placement. Selective detail (dropping
   garments, complexions) and register softening are acceptable when
   traceable, with the omitted heat carried elsewhere in the essay.
3. **Faculty language in the sign's own terms is not overreach.**
   "Your mind" in a Gemini face reads the slice's character; only
   naming a body, angle, house, aspect, or sect fails.
4. **Maturation frames are not age claims.** "You grow into this face"
   passes; claims about the reader's age, decade, or generation fail.
5. **The malefic-face pattern.** Classical weight may be stated
   attributed to the books, then must be translated to tendency plus
   corrective (the Taurus 3 model). A verdict asserted of the reader
   fails.

### Degree symbols

6. **Binding-scaffold budget.** Any one image-to-reader binding shape
   ("whatever in you lives at this degree" and all cousins) at most
   twice per 30-degree slice. Sanctioned alternates: theme-first
   ("Bounded freedom is the fuel here"), degree-as-subject ("This
   degree's heat..."), infinitive ("To stand at this degree is..."),
   direct-you with locative.
7. **Caveat-pivot budget.** The nominalized "The [danger/risk/cost/
   catch/failure/excess] is X" sentence at most 3 per slice.
   Alternates: conditional, imperative, direct address.
8. **Closing-move budget.** "The [skill/art/work/lesson] is Y" at most
   2 per slice; "you learn" in any tense-frame at most 3, never twice
   in the same sentence shape.
9. **Image quotas per sign slice.** The sign's own element at most 3
   images; the sign's animal at most once; sport/contest-with-technique
   at most a third of the slice; any one scenario type at most 2. The
   family already has a lamb (Aries 25) and a ram (Aries 10) — later
   signs do not add lambs, and a sign's own animal is spent once used.
10. **Shadow-shape quota.** "The shadow is overdoing the degree's own
    gift" at most 2-3 per slice; the rest need other shadow shapes —
    misapplication, avoidance, rigidity, envy.
11. **Originality protocol (standing).** Per-degree check against
    Sabian, Charubel, and La Volasfera, then a keyword sweep of each
    image's core nouns across the remaining public sets in all signs
    (Kozminsky, Henson, Janduz, Carelli, Lonsdale). The pilot's only
    near-hit came from the sweep, not the per-degree check.
12. **Degrees 28-30.** Anaretic weight is allowed, anaretic verdicts
    are not; the pilot's tension/inspection/handoff handling is the
    reference.
