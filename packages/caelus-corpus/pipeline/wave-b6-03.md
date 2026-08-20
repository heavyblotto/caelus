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
