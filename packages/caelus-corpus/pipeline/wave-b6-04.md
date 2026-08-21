# B6 wave 4 sheet — degree symbols Sagittarius/Capricorn/Aquarius/Pisces

Read after the instruction sheets (`writer-instructions.md`,
`writer-instructions-b6.md`, `voice-sheet.md`,
`editorial/editorial-voice.md`). **`pipeline/wave-b6-01.md`,
`pipeline/wave-b6-02.md`, and `pipeline/wave-b6-03.md` are required
reading: their twenty-nine rulings bind this wave.** This sheet names
the wave-4 assignments and what changes now that the family has eight
shipped sign slices. This is the final B6 write wave: landing it
completes the degree-symbol family (360/360) and the batch (396/396).

| slice | file | cells | band |
|---|---|---|---|
| degree-symbols-sagittarius | `b6-degree-symbols-sagittarius.json` | 30 | 80–200 words |
| degree-symbols-capricorn | `b6-degree-symbols-capricorn.json` | 30 | 80–200 words |
| degree-symbols-aquarius | `b6-degree-symbols-aquarius.json` | 30 | 80–200 words |
| degree-symbols-pisces | `b6-degree-symbols-pisces.json` | 30 | 80–200 words |

## What changes after wave 3

- **The collision surface is eight shipped sign slices.** Read
  Aries through Scorpio as anchors for depth and variety — and as
  what not to echo. `check-family` compares you against all of them.
- **Spent family animals.** Lamb (Aries 25), ram (Aries 10), bull
  (Taurus 11), twins (Gemini 10), crab (Cancer 24), lion (Leo 23),
  scorpion (Scorpio 10) are spent family-wide. Your own sign's figure
  may appear at most once in your slice (ruling 9): the archer or
  centaur (Sagittarius), the goat or sea-goat (Capricorn), the
  water-bearer (Aquarius), the fish (Pisces). Virgo shipped without
  its maiden — a sign's figure is a budget, not an obligation.
- **Element quotas.** Images of your sign's own element at most 3 per
  slice: fire for Sagittarius, earth objects for Capricorn, air for
  Aquarius, water for Pisces. The literal sun counts as light, not
  fire (ruling 27). Aquarius note: the water-bearer pours water but
  the sign is air — a poured-water image counts toward water
  vocabulary, not air; keep both textures rare.
- **Degree-28 steering (ruling 28).** Four signs already ship
  "verification extended past purpose" as the 28-shadow (Aries,
  Gemini, Virgo, Libra), and three share near-identical "not a
  verdict" disclaimer wording. Your 28 finds a different late-degree
  failure, and any anaretic disclaimer is phrased in your image's own
  terms. The 28/29/30 cross-sign check (ruling 15) now runs against
  all eight shipped signs at each degree number.
- **Census methodology (ruling 20) — read this before writing, not
  after.** Budget counts are derived by a second pass over your
  finished slice, never tracked while drafting. The shadow census
  applies ruling 13's two-clause genus definition in full: the gift
  in excess OR kept past its term. Three wave-3 slices undercounted
  by missing the overstay clause. Worked example: "the patter that
  cannot stop" (leo:14) and "rank kept on too long" (leo:24) are
  overstay shapes even though nothing is overdone; "held for its own
  sake, sung at the audience" (leo:29) is counted by its lead
  failure — the one the corrective addresses — which is display, so
  misapplication (ruling 21).
- **New caps from wave 3.** "The [image-noun] can [transform-verb]"
  shadow pivot at most 3 per slice (ruling 22). The "...is not X. It
  is [just] Y." closer at most 2 per slice (ruling 23). The
  "[theme-noun] is the [faculty] here/of this degree" binding at most
  5 per slice (ruling 24).
- **Originality protocol amendments (ruling 25).** Name the actual
  text you swept per set. The circulating "360 symbolic degrees"
  compilation truncates at Weber despite its table of contents —
  Janduz, Bardon, Cochrane, Lonsdale, and its Sabian section are
  absent from it. Janduz is recoverable from the archive.org
  compilation PDF (pages 648-702) with `pdftotext`; Lonsdale from the
  complete Inside Degrees text. If you proxy a set, report it as
  proxied. Same-degree noun adjacency is a flag class of its own: a
  core noun shared with a public set at the same degree number gets
  flagged even when the image clearly survives. Henson is a keyword
  set; keyword-only matches are noted, never fatal. Your sweep report
  lists near-misses examined with their sources, not only the swaps
  you acted on.
- **Scene-bound life stages (ruling 26).** A scene may imply a life
  stage (a retirement dinner, a twenty-year marriage) provided the
  binding sentence is stage-neutral.
- **Touch only your output file.** No other edits, no deletions, no
  doc updates, no commits.

## Self-check, in this order

Do **not** run the package build or test; writers share one `dist`.
From the package root:

```
node pipeline/check-slice.mjs pipeline/briefs/<slice>.json data/passages/<out>.json
node pipeline/check-family.mjs data/passages/<out>.json
```

`check-slice` must print `slice ok`; finish with no `FAIL:` lines
naming your entries.

## Report

One line — slice, entry count, checks passed — then your budget
self-report derived by second pass over the finished text, with entry
IDs (rulings 19 and 20), then flags: originality near-misses with the
verified source (set, sign, degree, and the actual text swept),
degrees that fought you, judgment calls.
