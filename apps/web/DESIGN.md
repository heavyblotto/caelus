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
   (`.capability-grid`) — the title carries the scan, one line carries the
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
capped to a readable measure by `.page-hero p`.

Section headings: sentence-case `h2` in prose flow; the monospace uppercase
group label (`.feature-group__label`) for grouped card sections. Don't mix the
two on one page for peer sections.

## Tokens

Everything derives from the variables at the top of `globals.css`: surfaces,
text tiers (`--text` → `--text-faint`), one accent family, the type scale,
and the two radii. A new color or font size should be a new token or, more
likely, an existing one.
