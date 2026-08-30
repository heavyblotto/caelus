# B3 wave sheet — composite-aspect slices

Read this after `writer-instructions.md`, `writer-instructions-b3.md`
(whose **composite-aspect** section governs you), `voice-sheet.md`, and
`editorial/editorial-voice.md` including its Caelus Free section. This sheet
collects what every slice in this wave shares, so the per-slice prompt
can be short. Nothing here overrides the instruction sheets.

## What you are writing

One slice of the `composite-aspect` family: aspects **inside the
composite chart**, which is the midpoint chart of two people — not
either person's chart, and not one chart laid over the other. The
subject of every sentence is **the relationship as a third thing**.

Length: **200–500 words** per entry.

## The five hard rules of this family

1. **The composite voice.** "The relationship", "this bond", "what the
   two of them make together", "the pair". Never "you". Second person
   is the natal voice and it is wrong here. A sentence that could be
   pasted into a birth-chart essay unchanged is a defect.
2. **No phase, ever.** The engine reports no applying or separating on
   a composite aspect, because a midpoint composite is a static figure
   with no motion. Nothing in a composite is *building*, *tightening*,
   *coming to a head*, *approaching*, *wearing off*, or *fading*. Watch
   for these words; they arrive by reflex from the transit corpus.
3. **Contact is not compatibility.** A composite square does not mean
   the relationship is doomed; a composite trine does not mean it will
   last. No entry grades a relationship, scores it, or tells a reader to
   stay, leave, pursue, or avoid anyone. The chart cannot answer the
   question readers bring to it — whether this lasts — and pretending
   otherwise is the failure mode this whole batch exists to avoid.
4. **The pairs are unordered.** Composite Sun square composite Saturn is
   one entry with no reverse. Do not write "and the same in reverse",
   and do not write as though one body is the actor and the other the
   patient in a way that would flip.
5. **Assume nothing biographical.** Not romance, not cohabitation, not
   exclusivity, not marriage, not gender, not age, not orientation, not
   income, not children, not who leads. The pair may be siblings,
   friends, colleagues, a parent and a child. Where a body's tradition
   pulls toward one of these (Venus toward romance, Moon toward a shared
   home, Saturn toward marriage), write the meaning broadly enough that
   a reader looking at their sister's chart is not addressed as a
   spouse. No medical, financial, or legal counsel. Degender every
   reference to partners, parents, and caretakers.

## The one place the composite voice meets the lint

`lintPassage`'s `second-person` rule requires a `you` or `your` token in
every entry. It was written for the natal voice, where direct address is
the whole point, and it collides head-on with rule 1 above. Every writer
of the composite-placement slices hit this and resolved it the same way,
which is now the family's settled convention and what you should do:

- The grammatical subject stays the relationship, the pair, this bond,
  these two — everywhere, in every sentence that carries the claim.
- Each entry carries **exactly one** collective second-person
  construction — "what the two of you make together", "neither of you",
  "both of you" — which `writer-instructions-b3.md` already sanctions
  for this family. Vary which one, and vary where it sits.
- Never a singular or generic "you" as the subject of a claim. "You
  will find that the relationship..." is the natal voice wearing a hat,
  and it is the defect this rule exists to prevent.

Read one shipped placement file — `data/passages/b3-composite-sun.json`
— to see the convention in practice before you start.

## Keeping the five aspects distinct

Each pair appears five times in the grid, and the five entries must not
be one essay in five costumes. The engine's own distinction:

- **conjunction** — the two functions fuse; the pair cannot run one
  without the other, and neither is visible on its own.
- **sextile** — one function offers the other an opening the pair can
  take or ignore; nothing insists.
- **square** — the two functions force each other; the collision
  recurs, and it is also where the traction is.
- **trine** — the two run together easily, which is also how the pair
  stops noticing them, and how ease becomes inertia.
- **opposition** — the two face each other across the bond; the pair
  meets the tension as a pull between two poles it has to hold at once,
  and neither pole is livable on its own.

**A banned formula, and the general lesson behind it.** The first eleven
slices independently converged on one sentence for the opposition. All
eight of these shipped before anyone noticed:

> Each end supplies what the other lacks. / Each pole supplies what the
> other lacks. / Each pole supplies what the other is missing. / Each
> pole is what the other lacks. / Each end holds what the other lacks. /
> Each pole has what the other lacks. / Each side supplies what the
> other lacks. / Each end supplies what the other is missing.

Do not write any sentence of this shape. More important than the ban is
what it shows: `lintSharedSentences` only catches a sentence repeated
**verbatim**, so a formula survives the lint as long as each writer
swaps one word. Each of those entries reads fine alone; a reader who
opens two of them sees a template immediately.

So the test to apply to your own draft is not "is this sentence unique?"
but "would another competent writer, given this same cell and this same
sheet, have written this sentence?" If yes, it is a formula and it is
already in the corpus somewhere. This bites hardest on the geometric
glosses — the sentence explaining what an opposition or a conjunction
*is* — because that sentence has an obvious form. Explain the geometry
through the two bodies' actual content, or do not explain it at all;
the reader has the aspect named in the title.

Say what the fusion or the friction is *about* for these two bodies in
a relationship. "Composite Mercury trine composite Jupiter" is not "the
relationship communicates well": it is what the pair's talk does to the
pair's sense of scope — what conversations open up, what gets promised
in them, what never gets checked.

## The bodies, in one line each

| Body | What it is, in this voice |
|---|---|
| Sun | what the relationship is for, what it is recognized as |
| Moon | the bond's comfort, reflex, and settled mood |
| Mercury | how the pair talks as a pair |
| Venus | what the pair values, how regard is given |
| Mars | what the pair goes after, how it fights |
| Jupiter | what the bond enlarges, believes, permits |
| Saturn | what the bond takes seriously and is held to |
| Uranus | what the bond disrupts, frees, refuses |
| Neptune | what the bond idealizes, imagines, blurs |
| Pluto | what the bond intensifies and will not leave small |
| Chiron | the sore place in the bond, and where it teaches |
| North Node | the direction of growth for the pair |

Two notes on particular bodies. The **North Node** essays are written
once against `true_node` and mirrored to `mean_node` at compile time, so
never name "true node" or "mean node" in the prose; and the nodes attract
fate language, which this corpus does not have — no karma, no destined
meetings, no "meant to". **Chiron**'s thin tradition is handled once at
the family level by the package's `FAMILY_NOTES`, so do not write a
per-entry disclaimer about it; write the substantive claim.

## The outer-planet hedge, and how it goes wrong

Uranus, Neptune and Pluto move slowly enough that two people born within
a few years of each other share their signs, and their composite aspects
to each other are near-universal for a whole cohort. Where an aspect is
generational rather than particular to this pair, say so honestly. But
the B2 and B4 reviews both caught this hedge hardening into a formula
across sibling essays: the same sentence, or the same opening move, in
every outer-planet entry. Vary it, put it in different positions, and
leave it out where the aspect is genuinely particular.

## Skeletons and shared sentences

The corpus lints fail a family whose entries share a whole sentence of
six words or more, or where more than a third of a family opens with the
same first six words or closes the same way. Your slice is one of
twenty-six being written at the same time against this same sheet, which
is exactly how a template forms. So:

- Vary the opening sentence *shape*, not just its nouns. Do not open
  every entry with "The relationship..." or "In this bond...".
- Vary the closing move. Do not end every entry with a caution.
- Do not use a stock phrase as a chorus. If a phrase in this sheet
  reads well, that is a reason **not** to lift it verbatim.

## Output and self-check

A JSON array in brief order. Each object has exactly the keys `id`,
`family`, `when`, `atomIds`, `text` — the first four copied **verbatim**
from the brief, `text` your essay. Write it to the output path named in
your prompt (`data/passages/<outFile>` from the brief).

Then, from the repo root `/home/user/caelus`:

```
node pipeline/check-slice.mjs <brief-path> <output-path>
node pipeline/check-family.mjs <output-path>
```

`check-slice` lints your slice against itself; `check-family` lints it
against every other shipped file in the family, which is what catches
the parallel-writer collisions. Fix and re-run until check-slice prints
its ok line and check-family reports no FAIL naming your own entries.
A `note` line naming another file's entry is not yours to fix.

Do not commit anything. Report exactly one line: slice name, entry
count, both checks passed, plus anything worth flagging.
