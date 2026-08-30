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

## Wave 4 outcome (landed 2026-08-21)

All four slices written, reviewed, and verified: the degree-symbol
family is complete at 360/360 and B6 at 396/396. Harness green; root
suite green. Originality clean across all eight public sets for every
slice. Two source findings held up by four independent sweeps: the
circulating plain-text conversion of the "360 symbolic degrees"
compilation truncates at Weber, while the archive.org compilation PDF
(and its complete djvu text layer) runs through Cochrane; and
Janduz's labels in that extraction sit one behind the ordinal ("N
Sign" = ordinal N+1), verified against his La Volasfera lineage.

Reviews: every slice cleared with fixes. Reviewer repairs — Pisces 9
(a binding scaffold, "this way at the Nth degree," at 8/30 against a
family norm of 0; a counted-failure-pair texture at 8/30 against a
family max of 4), Sagittarius 16 (frame-monoculture clusters:
"colors," "everywhere," "you learn," What-clefts), Aquarius 2 (both
same-wave echoes of Sagittarius entries, one a verbatim 5-gram at the
same degree), Capricorn 14 (a synonym-spread caveat-pivot skeleton,
17 nominalized pivots against a cap of 3). Writer reworks — Capricorn
re-imaged three entries that cloned same-wave siblings (cap:29's
summit register against sagittarius:30, cap:23's cairn against
sagittarius:11, cap:21's cornerstone box against aquarius:8 — the
four wave-4 writers worked in parallel and never saw each other's
drafts) and de-skied cap:20's corrective; Pisces re-imaged pisces:25
on an orchestrator-adjudicated element-quota call (the tide pool
counts as water; the peach ships). Orchestrator adjudications
recorded: pisces:1 holds as not-water (ink is the acted-on subject);
aq:8 stays, cap:21 moved (the later-written slice moves, and aq:8's
argument survives its vessel); Pisces's ordinal-locatives accepted
(13/30, all distinct) with the policy recorded as ruling 37. Flag
records completed for two writer omissions (scorpio:9-pattern):
aquarius:4's lightning rod vs La Volasfera Aquarius 4, and Charubel
Capricorn 25's grain field vs cap:25's winter wheat — both images
clearly survive; the flags are the remedy.

## Rulings from wave 4 (binding on every corpus wave after it)

Wave 4's reviews found the wave-3 census methodology working (three
of four writers' second-pass counts verified exact) and surfaced the
parallel-wave gap: every collision gate compared against shipped
slices only. These amend and extend rulings 1-29.

30. **The collision surface includes same-wave siblings (amends
    ruling 15).** Cross-sign checks, spent-image lists, and family
    lints run against same-wave drafts as they land, not only shipped
    slices. Three of wave 4's four slices collided on concrete images
    (summit register twice, cairn, cornerstone box) with every gate
    green. Reviewers check same-wave siblings before clearing; a
    writer whose slice lands late re-sweeps against any sibling that
    landed while it wrote.
31. **The caveat-pivot cap binds the shape, not the noun list
    (amends rulings 7 and 22).** The nominalized caveat pivot —
    "The [caveat-noun] is X" and its wh-cleft cousins ("What sours
    it is X") — is capped at 3 per slice whatever noun carries it:
    failure, shadow, trouble, risk, cost, snare, temptation, hazard,
    and synonyms. Synonym substitution is not compliance; Capricorn
    ran 17 pre-repair behind eight different nouns.
32. **The carrier-frame class cap (amends ruling 6).** Any single
    repeated binding-frame phrase is capped at 2 per slice — the
    family regenerates variants ("colors," "everywhere," "relation
    to," "lives here," "you toward") faster than named scaffolds.
    And the same-degree check extends to binding phrases at every
    degree, not only 28-30: aquarius:15's "you are in your element"
    collided verbatim with sagittarius:15 at degree 15.
33. **Corrective textures capped.** "The [image-noun] serves /
    exists to [purpose]" at most 3 per slice; counted-failure-pair
    announcements ("Watch the two failures," "It fails in two
    shapes") at most 4, the prior family max.
34. **Censuses are grep-verified (amends ruling 20).** Second-pass
    counts are verified mechanically, not manually — a reviewer's own
    manual census missed a "you learn" instance until grep-verified.
    Self-reports list same-degree adjacencies found and cleared, not
    only swaps acted on (one wave-4 report omitted Charubel Capricorn
    25's grain field; the reviewer found it independently).
35. **Element-quota counting precedent (amends rulings 14 and 27).**
    Count the image's acted-on subject, not its medium or setting:
    the antenna is a device, not air; the tide pool's departing sea
    is the subject, so water; the ink bloom's subject is the ink, so
    not water. A sign is never barred from its own landscape —
    Capricorn's mountains are setting, not earth objects.
36. **Remainder-genus diversity note (amends ruling 13).** A
    remainder genus past a third of the slice carries a sub-mechanism
    note in the census. Aquarius shipped misapplication at 12-13/30
    on genuinely diverse mechanisms (display, purpose-substitution,
    misread-of-evidence, displacement); the genus count alone did not
    capture that, and the note is what makes the call auditable.
37. **Ordinal-locative policy.** The family norm is deictic position
    reference ("this degree," "late in the sign"); spelled-out
    ordinal locatives ("at the twenty-second degree") are capped as
    texture under ruling 18's principle. Pisces ships 13/30, all
    distinct ordinals, grandfathered as the family's final slice.
38. **Same-sign cross-degree scene adjacency named (amends ruling
    25).** A shared defining scene with a public set at a different
    degree of the same sign (Kozminsky Pisces 1's river-into-sea
    against pisces:30) is a recordable flag class alongside
    same-degree noun adjacency.
