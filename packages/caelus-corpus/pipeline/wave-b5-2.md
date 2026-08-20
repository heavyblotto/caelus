# B5 wave 2 — sheet

Everything in `wave-b5-1.md` applies (read it, along with the four
instruction sheets it names). This sheet adds wave 2's roster and what
the wave 1 review learned, which is now binding on you.

## The wave

| Slice | Family | Cells | Shipped siblings to read first |
|---|---|---|---|
| lot-eros-signs | lot-sign | 12 | `b5-lot-fortune-signs.json` |
| lot-necessity-houses | lot-house | 12 | `b5-lot-spirit-houses.json` |
| stars-03, then stars-04 | star | 15 + 15 | `b5-stars-01.json`, `b5-stars-02.json` |
| parallels-02 | parallel | 14 | `b5-parallels-01.json` |
| nakshatras-moon-02 | nakshatra-moon | 13 | `b5-nakshatras-moon-01.json` |
| nakshatra-padas-01 | nakshatra-pada | 16 | `b5-nakshatras-moon-01.json` (your mansions) |
| varga-d9-mars | varga-d9 | 12 | `b5-varga-d9-sun.json` |

Read every entry of your family's shipped siblings before writing.
The family lints compare you against them, and the review pass reads
you side by side with them. Do not reuse their opening moves, their
hinge sentences, or their closers.

## Rulings and bans from the wave 1 review

These were found by the adversarial pass across 132 shipped entries.
Each is now a named formula; writing another instance is a defect.

**All families.**
- The image-turned-maxim closer (the essay's central image compressed
  into a final aphorism). The star family converged on it 20 times.
  Close on growth in varied shapes instead: a consequence, a practice,
  an observation about time, a return to context.
- The labeled-cost pivot ("The shadow side is", "The price is", "The
  tax is", "The bill arrives as"). Let difficulty enter through a
  scene, a tendency verb, or a contrast inside a sentence, at
  different points in different essays.
- Uniform length is a template signal: wave 1's stars-02 landed all 15
  entries within a 17-word spread. Use the whole band.

**lot-sign / lot-house.** Fortune-signs converged on a four-beat
scaffold with fixed hinge sentences ("Livelihood favors...", "Your
body usually...", "The hazard is..."). Do not run one scaffold through
your slice; give each sign or house its own architecture. Never claim
an age or life stage.

**star.** Say a natal body "sits on" or "stands on" the star, never
"exactly" (the orb is tight, not exact). Get the constellation
geometry right (the review caught Scheat misplaced off the Great
Square). Do not open sibling entries with the same "X means Y"
etymology move.

**parallel.** State the relation as the same declination on the same
side of the celestial equator; "equally far north or south" also
describes a contraparallel and is wrong. Do not put the declination
gloss in the same slot of every essay; one or two essays may state
explicitly that the match holds whatever the zodiac distance.

**nakshatra-moon / nakshatra-pada.** The growth paragraph must not
open "You grow by..." (10 of 14 wave 1 entries did). Gloss every
Sanskrit term on first use, including "Jyotish" if you use it. Star
names tie to constellations, never zodiac signs. Pada writers: your
mansion's essay is shipped; the chip sharpens one quarter of it and
must not restate it. With 108 padas coming, vary the opening move and
the structure hard; each pada gets one concrete distinguishing note.

**varga-d9.** Two rulings. (1) You may name the body's classical
relation to the navamsa sign itself (exaltation, debilitation,
domicile), attributed as the tradition's label, because it follows
from the guaranteed body + navamsa sign; you may never grade the
planet's strength or import anything about D1. (2) The sun slice ran
one four-slot template through all 12 entries (navamsa explainer,
outer-versus-inner contrast, dharma paragraph, ripening close). Do not
inherit it: most of your entries should drop at least two of those
slots, the "Whatever your outer chart shows..." contrast clause is
used up, and "What ripens over time is..." closes are used up. The D9
explainer belongs in at most a third of your entries; `varga-frame:d9`
already explains the division at length.

## Known engine facts (do not write around them, just know them)

The engine computes dispositors and receptions over the seven
classical planets only, and reception routes include triplicity mixes
the grid does not enumerate. Wave 1's outer-planet dispositor and
reception-body essays are shipped but unreachable until a grid or
engine decision lands; that decision is the maintainer's, recorded in
the session notes. No wave 2 family is affected.

## Output and self-check

Exactly as `wave-b5-1.md`: JSON array in brief order to
`data/passages/<outFile>`, check-slice until "slice ok", check-family
until no FAIL naming your entries, no npm build/test, no commits, no
files touched beyond your output. Report one line.

## Mid-wave discoveries

(recorded here as they surface)
