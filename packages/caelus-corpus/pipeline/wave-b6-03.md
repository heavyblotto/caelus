# B6 wave 3 sheet — faces-03, degree symbols Leo/Virgo/Libra/Scorpio

Read after the instruction sheets (`writer-instructions.md`,
`writer-instructions-b6.md`, `voice-sheet.md`,
`editorial/editorial-voice.md`). **`pipeline/wave-b6-01.md` and
`pipeline/wave-b6-02.md` are required reading: their nineteen rulings
bind this wave.** This sheet names the wave-3 assignments and what
changes now that the family has six shipped files.

| slice | file | cells | band |
|---|---|---|---|
| faces-03 | `b6-faces-03.json` | 12 (Sagittarius–Pisces faces) | 120–300 words |
| degree-symbols-leo | `b6-degree-symbols-leo.json` | 30 | 80–200 words |
| degree-symbols-virgo | `b6-degree-symbols-virgo.json` | 30 | 80–200 words |
| degree-symbols-libra | `b6-degree-symbols-libra.json` | 30 | 80–200 words |
| degree-symbols-scorpio | `b6-degree-symbols-scorpio.json` | 30 | 80–200 words |

## What changes after wave 2

- **The collision surface is bigger.** Faces writers are linted
  against faces-01 and faces-02; symbol writers against four shipped
  sign slices (Aries, Taurus, Gemini, Cancer). Read the shipped files
  in your family as anchors for depth and variety — and as what not
  to echo. `check-family` compares you against all of them.
- **Spent images.** The family has its lamb (Aries 25), ram (Aries
  10), bull (Taurus 11), twins (Gemini 10), and crab (Cancer 24).
  Those animals are spent family-wide; your own sign's animal may
  appear at most once in your slice (ruling 9).
- **Degrees 28-30: the cross-sign check is explicit now (ruling
  15).** Before writing your 28, 29, and 30, read all four shipped
  signs' entries at those degree numbers. The
  tension/inspection/handoff abstraction is sanctioned; any shared
  scenario, argument arc, or closer is a clone — Taurus 28 was
  rewritten for exactly this.
- **Budget self-reports carry entry IDs (ruling 19).** Your final
  report lists each budget count with the IDs you counted. Counts
  without IDs could not be spot-checked in wave 2, and three of them
  were undercounted.
- **Touch only your output file.** No other edits, no deletions, no
  doc updates, no commits. A wave-2 writer's side effects deleted
  ~200 committed briefs from the working tree; the restore cost the
  orchestrator a verification cycle.

## Faces-03 doctrine note

The Chaldean cycle completes: Sagittarius runs Mercury, Moon, Saturn;
Capricorn Jupiter, Mars, Sun; Aquarius Venus, Mercury, Moon; Pisces
Saturn, Jupiter, Mars. Saturn faces (Sagittarius 3, Pisces 1) and any
face whose classical image or meaning list runs harsh get the
attributed-weight-then-corrective pattern (rulings 5 and 17), with
softenings only from the sanctioned inventory.

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
self-report with entry IDs (ruling 19), then flags: originality
near-hits with the verified source (set, sign, degree), degrees that
fought you, judgment calls.

## Wave 3 outcome (landed 2026-08-21)

All five slices written, reviewed, and verified: faces-03 plus four
sign slices, 132 entries, bringing B6 to 276 of 396 cells. Harness
green (36/36 faces, 240/360 symbols firing). Originality clean across
all eight public sets for every slice; the Janduz sweep was recovered
from the archive.org compilation PDF where web texts truncate.

Reviews: faces-03 cleared with ten clause repairs across eight
entries (pivot echoes, the take-as corrective convergence, one
ruling-1 position repair). Scorpio cleared with one repair
(scorpio:29, caveat pivots 4 to cap). Libra cleared with six repairs,
two of them ruling-15 same-degree frame clones (libra:28's opener
against taurus:28; libra:30's closer against the virgo:30/scorpio:30
shape). Virgo cleared with one repair plus a writer rework (seven
shadow re-arguments; excess genus 16 to 9 across ten genera). Leo
cleared with zero repairs plus a writer rework (two shadow
re-arguments, leo:24 to rigidity and leo:27 to avoidance; two
re-types adjudicated by the orchestrator under ruling 21; excess
lands 9/30). One flag-record gap, recorded here per ruling 25:
scorpio:9's wasps' nest shares the noun "nest" at the same degree
with La Volasfera and Janduz Scorpio 9 (fallen bird nests); the image
is original and ships, but the writer's sweep did not flag it.

## Rulings from wave 3 (binding on every B6 wave after it)

Wave 3's five reviews found the same failure three times — the
shadow-genus census undercounted by writers who tracked surface
labels during drafting — plus two same-degree frame clones and one
pivot family the wave-1 wording did not name. These amend and extend
rulings 1-19.

20. **Census methodology (amends rulings 13 and 19).** Budget
    censuses are derived by a second pass over the finished slice,
    never tracked during writing, and the shadow census applies
    ruling 13's two-clause genus definition in full: the gift in
    excess OR kept past its term. Three symbol slices undercounted
    the same way — the overdoing clause counted, the overstay clause
    missed (Virgo reported 8, actual 16; Leo reported 9, actual
    11-13; Libra reported 8, actual 10-11) — and faces-03 missed a
    fifth pivot. A count that was not re-derived from the finished
    text is presumed wrong.
21. **Dual-failure entries count by lead failure (amends ruling
    13).** An entry carrying two shadow genera is counted by the
    failure its corrective sentence addresses. Duration flavor alone
    does not make an entry excess — the 29 slot is the held peak
    family-wide, so every 29 touches duration; leo:29's lead failure
    is display ("sung at the audience instead of given to the song"),
    counted as misapplication.
22. **"The [image-noun] can [transform-verb]" shadow pivot joins
    ruling 7's family, cap 3 per slice.** It ran 6 of 30 in Libra
    ("The grip can become armor," "The canvas can replace the
    sitter"), invisible to ruling 7's caveat-noun wording; repaired
    to 3 with varied verbs.
23. **The "...is not X. It is [just] Y." closer joins ruling 8's
    family, cap 2 per slice.**
24. **The "[theme-noun] is the [faculty] here/of this degree"
    binding is capped at 5 per slice.** It is a sanctioned ruling-6
    alternate, but at 11 of 30 (Libra) it stops being a texture and
    becomes the texture.
25. **Originality protocol amendments (amends rulings 11 and 19).**
    (a) Source inventory: a sweep names the actual text checked per
    set. The circulating "360 symbolic degrees" compilation is
    truncated at Weber despite its table of contents — Janduz,
    Bardon, Cochrane, Lonsdale, and the Sabian section are absent
    from it; Janduz is recoverable from the archive.org compilation
    PDF (pages 648-702) with `pdftotext`, and Lonsdale from the
    complete Inside Degrees text. A proxied set (Janduz via its La
    Volasfera lineage) is reported as proxied. (b) Same-degree noun
    adjacency is a distinct flag class: a core noun shared with a
    public set at the same degree number is flagged even when the
    image clearly survives (the scorpio:9 record above). (c) Henson
    is a keyword set, not an image set; keyword-only matches are
    noted, never fatal. (d) Sweep reports list near-misses examined
    with their sources, not only the swaps acted on — one wave-3
    writer's sweep missed seven adjacencies the reviewer's sweep
    found (all cleared).
26. **Scene-bound life stages sanctioned.** A symbol's scene may
    imply a life stage (a retirement dinner, a twenty-year marriage,
    "gray at the temples" on a cautionary figure) without violating
    the no-age-claims rule, provided the binding sentence is
    stage-neutral. This codifies the de facto standard since
    virgo:28.
27. **Sun-as-light gloss (amends ruling 14).** The literal sun,
    appearing as a visibility or tracking object, counts as light,
    not fire, for element quotas. Recorded so no future fire-sign
    slice re-adjudicates it.
28. **Degree-28 steering for the remaining signs.** Four of eight
    shipped signs carry "verification extended past purpose" as the
    28-shadow (Aries, Gemini, Virgo, Libra), and three share
    near-identical "not a verdict" disclaimer wording. Sagittarius
    through Pisces 28s find other late-degree failures, and any
    anaretic disclaimer is phrased in the image's own terms.
29. **Faces texture (from faces-03).** (a) "The shadow is [X]" as an
    opener joins ruling 18's texture list (faces-03 shipped 4 of 12
    pre-repair; faces-01 has 1, faces-02 none). (b) The
    "[Take/Read] X as the Y's Z, not as W" corrective is capped at
    one per slice — the mandated harsh-face pattern (rulings 5 and
    17) otherwise converges on one sentence shape (four instances in
    faces-03 pre-repair). (c) Ruling 16 stays counted by surface
    shape; counted by argument genus the family norm runs ~6-10 of
    12, so sub-shapes within the cap are expected to vary.
