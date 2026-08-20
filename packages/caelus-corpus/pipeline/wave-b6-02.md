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
