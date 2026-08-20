# DS-01 disposition: audit findings versus the live design stream

2026-08-20 · design agent · assigned research from
`docs/product/visual-design-system-plan.md` ("The DS-01 question")

DS-01 is the pair of design documents written before the site's own
design stream existed: `Caelus Site - current.dc.html` (the audit) and
`Caelus Design System.dc.html` (the token-refactor proposal). Since
then five `design(site)` commits landed on the live site
(`8393753`, `d4d2b83`, `6942e9d`, `faf9a31`, `6320072`), documented in
`apps/web/DESIGN.md`. This report reads the audit's nine findings
against the current `apps/web/app/globals.css` (1,901 lines), says
which ones the live stream fixed, names what is worth keeping from the
proposal, and recommends a disposition. The disposition itself is the
maintainer's decision (open decision 7 in the visual design plan).

## Finding-by-finding status

| # | Severity | Finding | Status | Evidence |
|---|----------|---------|--------|----------|
| 01 | high | Twelve ad-hoc sizes below body | Stands | Thirteen distinct sub-body rem sizes in the current file: 0.64, 0.66, 0.68, 0.72, 0.78, 0.8, 0.8125, 0.82, 0.84, 0.85, 0.86, 0.88, 0.9. The `--fs-*` scale exists; components still pick their own. |
| 02 | high | One label idea, eight implementations | Partially fixed | Five sites now share `--fs-eyebrow` (`.feature-group__label`, `.cmp-caption`, `.site-footer__col h4`, `.docs-sidebar h5`, `.docs-toc h5`). Five remain ad-hoc: `.field__label` 0.64rem/0.1em, `.api-doc h2` 0.78/0.1, `.api-doc h4` 0.72/0.1, `.api-doc thead th` 0.68/0.07, `.search-kind` 0.66/0.05. Ten uppercase sites in all. |
| 03 | high | No spacing scale | Stands | Thirty-one distinct hand-chosen gap/padding rem values. |
| 04 | medium | Four surfaces inside fourteen hex points | Stands | `--bg-elev`, `--surface`, `--surface-2`, `--surface-3` all still declared and used; the light theme re-picks each by hand. |
| 05 | medium | Four interactive families, four conventions | Partially fixed | The inline `control` style object is retired and `.btn` / `.control` / `.seg` / `.tabs__tab` are the one vocabulary (DESIGN.md principle 3); all share `--radius-sm`. Sizes and paddings still differ per family (0.9 / 0.85 / 0.78 / 0.82rem), and no shared height landed. |
| 06 | medium | Peach blossom escapes its brief | Resolved, differently | The stream kept blossom on the logo sun and rewrote the brief to include it: the living layer covers sky markers, the logo's sun, and the interpretation surfaces (DESIGN.md; the `--peach-blossom` comment in `globals.css`). `faf9a31` reframed the hue as the extra-spectral one. |
| 07 | low | One header height, three magic numbers | Stands | `height: 56px` (line 1069), sidebar `top: 76px` with `max-height: calc(100vh - 88px)` (lines 1478–1479, 1524–1525), `scroll-margin-top: 84px` (line 1574). |
| 08 | medium | Light theme leaves the chart ink behind | Stands | The light block redefines only ring, sign, label, house, conj, and the moon/saturn lines (lines 1803–1811). The ten planet colors stay tuned for the dark ground and are drawn on `#faf9fd`. |
| 09 | low | Two widths, three layouts | Stands | `--maxw` 760 and `--maxw-wide` 1100 remain; the docs shell still builds its own `200px / 1fr / 200px` grid (line 1471); the comparison band still breaks out with `calc(50% - 50vw)` (lines 955–956). |

Tally: one finding resolved (06), two partially fixed (02, 05), six
standing (01, 03, 04, 07, 08, 09).

## What the live stream did that DS-01 does not have

- **A page grammar.** Every page follows eyebrow, `h1`, a lead of at
  most two sentences, sections, `PageClose`. DS-01 proposes tokens and
  components and has no page-level grammar.
- **A maintained design doc.** `apps/web/DESIGN.md` records the
  principles and the component vocabulary in six paragraphs. DS-01 is a
  frozen proposal; DESIGN.md has already absorbed two follow-up
  commits.
- **An affirmative blossom brief.** The live brief says what blossom
  is for (the living layer: actual-sky markers and interpretation
  surfaces) and gives the hue its extra-spectral rationale. DS-01's
  brief is a list of exclusions.
- **Show-then-tell ordering.** The worked example, the live sky, and
  the computed wheel lead the home page; enumeration became titled
  grid entries. DS-01's redesigned home keeps the hero-copy-first
  shape.
- **The footer Caelus mark.** The line drawing as a small signature at
  the foot of every page arrived with `d4d2b83`. DS-01 has no
  equivalent.
- **Shipped accessibility work.** The `:focus-visible` ring, the skip
  link, and the no-flash theme script are live. DS-01's control focus
  is a 1px iris border, a weaker keyboard signal than the shipped 2px
  outline.

## What the proposal is still worth carrying

The standing findings are real, and DS-01's fixes for them are the
right shape. The keepers, keyed to the findings they close:

1. **The eight-step type scale with one job per step** (closes 01,
   02). The load-bearing rules are that `small` is the only size below
   body and `label` is the only tracked uppercase. The current file
   has the scale tokens and not the discipline.
2. **The 4px spacing scale**, doubling with two half-steps from 4 to
   96 (closes 03).
3. **Three surfaces with semantic jobs and two line strengths**
   (closes 04). The proposal's names (sunken / canvas / raised) are
   optional; the structure is the keeper, including the rule that code
   sits on sunken and nowhere else.
4. **oklch twins so the light theme is derived, not re-guessed**
   (closes 08, and the whole class of bug). This is the proposal's
   most important structural idea. The plate theme's completeness rule
   on the Encyclopedia side is the same lesson: a theme is complete or
   it does not merge.
5. **One 32px interactive box at radius 4** shared by buttons, inputs,
   selects, and the segmented control (closes 05).
6. **A header-height token** so 56px is named once (closes 07).
7. **Component-level details:** evidence figures as hairline-divided
   cells, the filename bar inside the code block, no pill on inline
   code inside tables.

Not carried over:

- **Instrument Sans.** The live site loads Inter and the stream kept
  it. (The widgets plan's phrase "the site's Instrument Sans" names
  the proposal's font, not the shipped one.)
- **The blossom exclusion list.** DS-01 wanted blossom off the logo;
  the live brief includes the logo's sun, and the maintainer has
  recorded that peach blossom stays.
- **The 1px iris focus border.** Weaker than the shipped
  `:focus-visible` outline; keep the shipped one.
- **The 10px panel radius.** The site's 8px is fine; the churn is not
  justified on its own.

## Recommendation

**Absorb, then retire.** Apply the seven keepers as a series of small
commits to `globals.css`, each keyed to the finding it closes and
verifiable against the audit's evidence columns. Then mark DS-01
retired in `docs/design/README.md`, with this report as the record of
what was mined from it. Adopting DS-01 wholesale would overwrite the
live stream's vocabulary, which is the better of the two and is the
maintainer's stated inclination.

One consequence for the Encyclopedia stream: open decision 8 (token
sharing between the two sites) needs no shared infrastructure. The two
token sets have different grounds, different accents, and different
consumers. The only thing worth sharing is the discipline that a theme
is complete or it does not merge, which the plate theme already
enforces mechanically.
