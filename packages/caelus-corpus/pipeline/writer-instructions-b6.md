# B6 writer slice — instructions (ten-degree faces, degree symbols)

You are writing one slice of the Caelus interpretation corpus
(`caelus-corpus`), batch B6: the degree layer — the thirty-six
ten-degree faces and the three hundred sixty degree symbols.
Everything in `pipeline/writer-instructions.md` applies (read it first,
along with `pipeline/voice-sheet.md` and `editorial/editorial-voice.md`);
this sheet adds the rules specific to these families.

## What a B6 entry is

B1 read placements, B2 the moving sky, B3 two charts, B4 time, B5 the
condition layer. A B6 entry reads **one slice of the zodiac itself**: a
third of a sign (a face), or a single ordinal degree. The selector fires
when any body, the Ascendant, or the Midheaven occupies that slice — the
essay never learns which point carries it. The degree is the subject;
the reader supplies the point. Write the slice's character and what it
lends to whatever function of the chart holds it.

## Family-specific rules

**ten-degree-face** (120–300 words). A sign's third: the 1st through
10th degree, the 11th through 20th, or the 21st through 30th, counted
ordinally. The face's Chaldean ruler is fixed doctrine and safe to
state: the faces follow the Chaldean order (Saturn, Jupiter, Mars, Sun,
Venus, Mercury, Moon), anchored at Mars for the first face of Aries and
cycling continuously around the zodiac — Aries runs Mars, Sun, Venus;
Taurus Mercury, Moon, Saturn; and so on. The tradition's face images
(the Picatrix and Agrippa figures) are researched, then written fresh —
never lifted. Guaranteed: the sign, the face, and that some point of
the chart occupies it. Not guaranteed: which point, the house, or the
exact degree within the face. A face is a color on whatever carries it,
not an event: write what the third of the sign is like and what it
lends, in the sign's own terms.

**degree-symbol** (80–200 words). One ordinal degree of one sign: the
15th degree of Aries spans 14°00′ to 14°59′. The symbols are original,
written for this corpus — no Sabian borrowing, no lifted images from
any existing set. Each entry gives the degree its own image — a
concrete scene, object, or gesture in the sign's terms — and a short
reading of what it colors. Guaranteed: the sign and the ordinal degree,
and that some body or angle occupies it. Not guaranteed: which one.
Never name a body, a house, an aspect, or the chart's sect. With 360
siblings this is the corpus's highest skeleton risk by a distance: no
two entries open with the same move, the image does the work rather
than a formula, and the near-duplicate lint gates corpus-wide.

## Facts you may rely on (and no others)

The doctrine stated above (the ordinal-degree convention, the face
spans, the Chaldean face order anchored at Mars) is guaranteed. The
selector guarantees exactly its fields. It never guarantees: which
point occupies the degree or face, the house, any aspect, the sect of
the chart, or the reader's age, era, gender, family shape, occupation,
or means. Hedge biography; degender partners and caretakers; no
promises, no financial or medical directives.

## Output and self-check

Same as B1: JSON array in brief order with exactly the keys
`id`, `family`, `when`, `atomIds`, `text` (verbatim from the brief
except `text`), then

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

until it prints `slice ok`, then `node pipeline/check-family.mjs
<your-output-path>`. Report one line: slice name, entry count, checks
passed, plus anything worth flagging.
