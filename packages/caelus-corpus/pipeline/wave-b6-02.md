# B6 wave 2 sheet — faces-02, degree symbols Taurus/Gemini/Cancer

Read after the instruction sheets (`writer-instructions.md`,
`writer-instructions-b6.md`, `voice-sheet.md`,
`editorial/editorial-voice.md`). **`pipeline/wave-b6-01.md` is required
reading: its twelve wave-1 rulings bind this wave.** This sheet names
the wave-2 assignments and what changes now that the family has shipped
entries.

| slice | file | cells | band |
|---|---|---|---|
| faces-02 | `b6-faces-02.json` | 12 (Leo–Scorpio faces) | 120–300 words |
| degree-symbols-taurus | `b6-degree-symbols-taurus.json` | 30 | 80–200 words |
| degree-symbols-gemini | `b6-degree-symbols-gemini.json` | 30 | 80–200 words |
| degree-symbols-cancer | `b6-degree-symbols-cancer.json` | 30 | 80–200 words |

## What changes after the pilot

- **The family has its own anchors.** Degree-symbol writers read
  `data/passages/b6-degree-symbols-aries.json` as the register anchor;
  the faces writer reads `data/passages/b6-faces-01.json`. Match depth
  and variety; do not copy sentences, opening moves, images, or binding
  scaffolds. `check-family` lints you against them.
- **Spent images.** The family already has its lamb (Aries 25) and its
  ram (Aries 10). Later signs do not add lambs; your own sign's animal
  may appear at most once (ruling 9). Aries spent five fire images;
  your sign's own element is capped at three.
- **The budgets are yours to spend, not stretch.** Scaffold shapes at
  most twice a slice, nominalized caveat pivots at most 3, "The
  [art/skill/work] is..." closers at most 2 (rulings 6-8). The pilot
  hit those walls at 10, 10, and 6 and paid for it in review.

## Faces-02 doctrine note

The Chaldean cycle continues: Leo runs Saturn, Jupiter, Mars; Virgo
Sun, Venus, Mercury; Libra Moon, Saturn, Jupiter; Scorpio Mars, Sun,
Venus. The malefic-face pattern (ruling 5) applies to Leo 1 (Saturn)
and Libra 2 (Saturn): weight attributed to the books, then tendency
plus corrective.

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

One line: slice name, entry count, checks passed, plus anything worth
flagging.

## Rulings from wave 2 (binding on every B6 wave after it)

Wave 2's four reviews found the wave-1 budgets holding — three of four
slices shipped zero binding scaffolds — and surfaced calibration
questions. These amend and extend `wave-b6-01.md`'s twelve. Two slices
needed writer rework after review: Cancer (a provisioning-scenario
cluster and a shadow-genus concentration, both fixed) and Taurus (a
full skeleton clone of Aries 28 at the same degree number, rewritten,
plus a shadow-genus reduction).

13. **Ruling 10 recalibrated: the shadow-genus quota.** The wave-1 cap
    (2-3 per slice) was set from a surface-label count of the pilot.
    Counted by argument genus — the shadow is the gift in excess or
    kept past its term, whatever the surface label — the pilot itself
    ships ~9, and wave-2 slices ran 10 (Gemini), 10 reworked to 3
    (Cancer), 18 reworked down (Taurus). The binding rule: the excess
    genus at most a third of a slice, counted by genus, with the
    remainder spread across at least three other genera
    (misapplication, avoidance, rigidity, envy, martyrdom, timing).
    Self-audits report the census with entry IDs per genus.
14. **Scenario typing (defines ruling 9's unit).** A scenario type is
    function plus situation, not props: a preserving jar, a cordwood
    pile, and a hope chest are one scenario (provisioning against
    scarcity). A shared setting or state alone does not type a
    scenario — a marbles swap, cat's cradle, and double dutch share a
    playground but differ in action and argument; a dozing bull, a
    kneading cat, and a sleeping child share rest but differ in
    function. The cap of 2 applies per typed scenario. Element quotas
    count the image's object, not its working substance: an antenna is
    a device, not an air image.
15. **Same-degree cross-sign check for 28-30.** Ruling 12's
    tension/inspection/handoff reference invites cloning the pilot's
    handling at the same degree number — Taurus 28 cloned Aries 28's
    essay wholesale, Gemini 28 echoed its phrase. Writers and reviewers
    compare 28-vs-28, 29-vs-29, 30-vs-30 across every shipped sign
    explicitly. The abstraction is sanctioned; the essay is not.
16. **Image-detail pivot budget (faces).** "The [image detail]
    is/says/means [the lesson]" at most a third of a face slice, with
    sub-shapes varied — it ran 12 of 12 in faces-02, invisible to the
    4-gram lint.
17. **Ruling 5 extended, and the softening inventory.** The
    attributed-weight-then-corrective pattern applies to any
    classically harsh face image, whatever the ruler (the Virgo 3
    precedent: harsh image under Mercury). Sanctioned softenings, each
    only with the image kept traceable and the omitted heat carried
    elsewhere in the essay: complexion to garment or dropped; blow to
    threat; lust to appetite; fornication to lust.
18. **Opener texture.** Ruler-first openers in faces and "The"-led
    image openers in symbols each sit near a third of a slice — the
    pilot's texture — not half or two-thirds.
19. **Flag records and self-reports.** A flag names the verified
    source — set, sign, and degree actually checked (two wave-2 flags
    attributed images to the wrong public set; the adjacencies
    survived, the records did not). Budget self-reports carry entry
    IDs: the counts reported with IDs checked out exactly; three
    reported without were undercounted.
