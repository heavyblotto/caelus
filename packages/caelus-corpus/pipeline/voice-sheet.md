# The corpus voice — writer's sheet

The contract for every entry in `caelus-corpus`. It extends
[editorial/editorial-voice.md](../editorial/editorial-voice.md) (whose rules
all apply, including the Caelus Free product-copy section) with the rules
specific to delineation prose. The lints in `src/lint.ts` enforce the
mechanical half; the review pass judges the rest.

## The standard

The bar is Robert Hand's Para Research series (proposal §6): essay-length
entries that state a theme and then follow it through the life areas it
touches. An entry is a considered piece of writing about one configuration,
not a paragraph of keywords.

## Rules

1. **Second person, present tense.** The entry describes how the reader
   tends to experience the configuration. "You" appears early and often.
2. **Theme first, then life areas.** Open with the core dynamic in one or
   two sentences a stranger could understand. Then show how it plays out:
   work, love, family, inner life, whichever areas the configuration
   actually touches. End on how the reader grows with it, without a moral.
3. **Non-fatalistic, full weight.** Hard placements get their real
   difficulty in plain words, described as tendencies and pressures the
   reader can work with, never as verdicts. No doom language, no promises.
   Both halves matter: an entry that flatters is as wrong as one that
   condemns.
4. **No directives.** Never tell the reader to make a medical, financial,
   or legal decision. Describing a tendency ("you may hold on to money as
   a form of safety") is in scope; advising an action ("you should
   invest") is banned.
5. **Length bands** (enforced): essays (planet in sign/house, aspects,
   rising) run 300 to 700 words; condition entries (dignities, out of
   bounds, retrogrades, signature) run proportionally shorter. See
   `LENGTH_BANDS` in `src/types.ts`.
6. **Plain speech.** A sentence that would sound odd said aloud to a
   friend gets rewritten. Flesch-Kincaid grade 12 or lower per entry
   (enforced); most entries should land well under.
7. **No formula.** Entries in a family must not share sentence skeletons.
   The duplication lint caps 4-gram overlap between any two entries in a
   family at 20%. Do not open every essay the same way; do not close every
   essay with the same move.
8. **Astrology from the tradition, not from vibes.** Each entry distills
   what the well-trodden canon says about the cell (the research brief),
   then writes it fresh. No verbatim borrowing from in-copyright works. No
   invented doctrine: if the tradition is thin for a cell, say less,
   better.
9. **Keyed to the engine where it matters.** Transit entries (B2) address
   applying vs separating and retrograde re-hits; natal entries may
   mention house context only when the selector actually binds a house.
   The text must never claim a fact the selector does not guarantee.
10. **Banned phrases** (enforced): the model-cadence tells, genre filler,
    doom words, and directive-advice phrases in `BANNED_PHRASES`
    (`src/lint.ts`). Em dashes are banned in prose like everywhere else in
    the repo.

## Shape of a record

Every entry is a `Passage` (see `src/types.ts`): the cell id and
selector come from the grid (`src/grid.ts`), never invented, so binding is
correct by construction. Text is the essay. `weight` stays unset unless
the review pass decides a cell should outrank its salience.

## The pipeline

Research brief → write → validate (`npm run build && npm test`, which
runs binding, firing, and the lints) → adversarial review against this
sheet → ship in a versioned set. A cell that fails any pass does not
merge.
