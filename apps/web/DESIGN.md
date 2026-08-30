# ephemengine.com design notes

Principles for the site's visual design and layout, written down so pages stay
consistent as they change. The voice is factual and evidence-forward; the
design's job is hierarchy and legibility, not persuasion.

## Principles

1. **One page, one job.** Nothing appears on a page before that job is served.
   - Home orients and routes: what this is, proof it is real, where to go.
   - Playground demonstrates: the working engine, in the browser, immediately.
   - Features inventories: everything it computes, and how it compares.
   - Docs teach; Validation / Methods / Provenance / Notes prove.
2. **Show, then tell.** The code sample, the live wheel, and the computed sky
   are the strongest material on the site; they lead, and prose follows. An
   explanation that precedes the thing it explains becomes a wall of text.
3. **One vocabulary.** A single style each for form controls (`.control`,
   labelled with `.field`), small action buttons (`.btn` variants), data tabs
   (`.tabs__tab` underline), view switchers (`.seg`), cards (`.card`), and
   section labels. New UI reuses these classes; inline style objects are not
   the mechanism for anything a second component might want.
4. **Scan first, read second.** Capability lists are titled grid entries
   (`.capability-grid`): the title carries the scan, one line carries the
   detail, the link carries the depth. Prose paragraphs are for reasoning,
   not for enumerations.
5. **Figures are sized to their information.** A preview wheel is a thumbnail
   beside its caption (`.example-card`); the working wheel in the playground
   is large because it is the object of study. Every figure has a caption
   saying what computed it.
6. **Evidence over adjectives.** Numbers link to their proof (stats link to
   Validation, counts are read from the engine at build time). No marketing
   language; the facts are the pitch.

## Page grammar

Every page follows the same skeleton: eyebrow → `h1` → lead of at most two
sentences → sections → `PageClose`. Prose pages use the narrow `container`
(760px); tool and docs pages use `container-wide` (1100px), with hero copy
capped to a readable measure by `.page-hero p`. The playground uses
`container-workspace` (`--maxw-workspace`) so the working figure can stay large.

Section headings: sentence-case `h2` in prose flow; the monospace uppercase
group label (`.feature-group__label`) for grouped card sections. Don't mix the
two on one page for peer sections.

## Workspace grammar

The playground chart workspace is still ephemengine.com. It does not invent a
second palette, typeface, or product chrome. Tokens stay `--bg` through `--warm`,
Inter + JetBrains Mono, `.control` / `.field` / `.btn` / `.seg` / `.tabs__tab` /
`.card`. Peach blossom (`--warm`) is only the living layer: today-strip markers,
the provenance stamp, the reading panel, out-of-bounds.

Once the workspace is the object of the page, eyebrow → h1 → sections is the
hero only. After that, a `.workspace` column: document bar, provenance stamp,
today strip, figure | rail, scrubber full width. The rest of the site is
unchanged.

Playground width is `--maxw-workspace` (about 1360px), playground-only. The
figure column is ~420–480px (`.workspace__figure`). Advanced adds rail density;
it does not shrink the wheel.

New widgets reuse the existing vocabulary:

- `.workspace`: the grid, not a page template
- `.today-strip` / `.provenance-stamp` / `.scrubber` (range input as `.control`)
- `.rail` is `.tabs__tab` or `.seg`, not a second tab language
- Dasha / ZR timelines are compact stacked lists
- Counterfactual diff uses `--good` / `--bad` (`.diff-gain`, `.diff-loss`)
- Constraint editor is labelled `.field`s

Do not add a third accent, a playground-only typeface, glass, gradients,
decorative motion, a Vedic colorway, emoji as UI, or an icon font. Casual and
Advanced share the same chrome; Advanced shows more rail items. Kundli,
tri-wheel, ephemeris graph, and Sky Viewfinder consume `--wheel-*` and
`--accent`. Tradition changes the figure, not the chrome. Honor
`prefers-reduced-motion`: jump, don't play.

## Tokens

Everything derives from the variables at the top of `globals.css`: surfaces,
text tiers (`--text` → `--text-faint`), one accent family, the type scale,
and the two radii. A new color or font size should be a new token or, more
likely, an existing one.

Two accents, two meanings. The purple (`--accent`) is structural: navigation,
links, selected states, the geometry. Peach blossom (`--peach-blossom`, with
`--warm` as its semantic alias) is the single warm counterpoint. The hue is
the extra-spectral one: the old name for the color on the line of purples
that closes the spectrum into a wheel, matched by no wavelength and existing
only in perception, a fitting companion to charts that are themselves
constructed readings of the sky. It sits between red and the site's violet,
so the two accents are neighbors on the wheel rather than rivals. Reserved
for
the living layer: markers of the actual sky (the ribbon's planet dots, the
logo's sun) and the interpretation surfaces (reading panels, "read this
chart", civil-time and out-of-bounds notices). Don't use it for chrome, and
don't add a third accent.
