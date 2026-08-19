# B1 writer slice — instructions

You are writing one slice of the Caelus Free interpretation corpus
(`caelus-delineations-house`), batch B1. Original natal-astrology
delineations at the Robert Hand / Para Research standard.

## Read first (all of these, in this order)

1. `pipeline/voice-sheet.md` — the voice contract. Binding.
2. `editorial/editorial-voice.md` — the base register, including the Caelus Free product-copy section.
3. `data/passages/b1-sun-signs.json` — the exemplars. Match their depth, register, and variety. Do not copy their sentences or their opening moves.
4. Your brief file (path given in your task): `cells` is the exact list of entries to write. Copy `id`, `family`, `when`, `atomIds` **verbatim** from each cell. `title` names the configuration.

## The work, per cell

1. **Research pass (silent):** recall what the well-trodden Western canon
   (Hand, Pelletier, Greene, Sakoian/Acker, modern psychological astrology)
   commonly says about this configuration. Distill the consensus themes.
   If the tradition is thin for a cell (e.g. Chiron in signs, node in
   signs), say less, better; lean on the placement's core symbolism, and
   invent no doctrine.
2. **Write pass:** one original essay per cell, second person, present
   tense, theme first then the life areas it actually touches, ending on
   how the reader grows with it, without a moral. Non-fatalistic with full
   weight. No directives (medical, financial, legal). Plain speech: any
   sentence that would sound odd said aloud to a friend gets rewritten.
3. **The text must never claim a fact the selector does not guarantee.**
   A planet-in-sign essay knows nothing about houses or aspects. An aspect
   essay knows the two bodies and the aspect, not signs or houses. A
   dignity essay knows the body and its state (for domicile/exaltation etc.
   you may name the sign(s) the tradition assigns, since the state implies
   them). A pattern-with-apex essay knows the pattern kind and apex body
   only. A signature essay knows the dominant facet only.

## Hard limits (machine-enforced; a violation fails the build)

- Length band by family, in words: planet-in-sign / planet-in-house /
  aspect / rising-sign 300–700; mc-sign 250–600; pattern 200–500;
  natal-retrograde 150–400; dignity / signature / out-of-bounds 120–350.
  Target the middle of the band, never the edges.
- Flesch-Kincaid grade ≤ 12 per entry. Vary sentence length; keep the
  average sentence under ~22 words.
- No em dashes anywhere. Use commas, colons, or a second sentence.
- Second person: "you"/"your" must appear, early and often.
- Banned substrings (lowercase match), do not use any inflection of:
  delve, tapestry, testament to, multifaceted, unpack, beacon, resonate,
  pivotal, holistic, landscape of, embark on, journey of self, unlock
  your, harness the, dive into, navigate the, it's important to note, in
  conclusion, "ultimately,", "at its core,", vibrant, rich inner world,
  unique blend, powerful energy, cosmic dance, the universe has, the stars
  have plans, written in the stars, align with your true, doomed, cursed,
  you will never, you are destined to, there is nothing you can do,
  inevitable downfall, tragedy will, you should invest, stop taking, your
  medication, see a lawyer, you should divorce, quit your job, diagnosis.
- No formula: entries in the same family must not share sentence
  skeletons. 4-gram overlap between any two entries in a family is capped
  at 20%, and your slice shares a family with other writers' slices, so
  vary your opening moves (do not open every essay "With X in Y, you...").
  Vary your closings too.

## Output

Write a JSON array of records to the output path given in your task, one
record per brief cell, in the brief's cell order. Record shape (exactly
these keys, in this order):

```json
{
  "id": "<verbatim from brief>",
  "family": "<verbatim from brief>",
  "when": <verbatim from brief>,
  "atomIds": <verbatim from brief>,
  "text": "<your essay, one paragraph, no newlines needed>"
}
```

No `tags`, `weight`, or `conflicts`. Plain ASCII apostrophes are fine;
never an em dash.

## Self-check (required before you finish)

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

Fix every FAIL and re-run until it prints `slice ok`. Do not finish with a
failing check. Your final report: one line stating the slice name, entry
count, and that the check passed, plus anything you judged worth flagging
(a cell where the tradition is thin, a wording risk).

## The family check

`check-slice.mjs` lints your slice against itself. The package test's
`lintCorpus` lints per *family*, across every file in the corpus, so two
writers working in parallel can each pass their own check and still collide
on a shared sentence or a shared opening formula. After check-slice passes,
run

```
node pipeline/check-family.mjs <your-output-path>
```

and fix the `FAIL:` lines, which name your own entries. The `note:` lines are
collisions between other files and belong to whoever owns them.
