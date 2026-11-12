# Three visual directions for ephemengine.com

**Decision, 2026-11-11: the owner chose Workbench.** Planetarium and Almanac
stay here as the record of what was considered. The rules at the end of this
file were adopted into `apps/web/DESIGN.md` the same day, which is now the
copy to maintain. The site itself has not been restyled yet.

Exploration only. Nothing here is wired into `apps/web` or any package, and
nothing depends on Next.js or Astro. Each direction is two self-contained HTML
files (inline CSS, no build step, no external scripts, fonts from Google
Fonts) plus a dark-mode desktop screenshot of each.

| Direction | Home | Sky dating |
|-----------|------|------------|
| Planetarium | [home.html](planetarium/home.html) ([screenshot](planetarium/home.dark.png)) | [sky-dating.html](planetarium/sky-dating.html) ([screenshot](planetarium/sky-dating.dark.png)) |
| Almanac | [home.html](almanac/home.html) ([screenshot](almanac/home.dark.png)) | [sky-dating.html](almanac/sky-dating.html) ([screenshot](almanac/sky-dating.dark.png)) |
| Workbench | [home.html](workbench/home.html) ([screenshot](workbench/home.dark.png)) | [sky-dating.html](workbench/sky-dating.html) ([screenshot](workbench/sky-dating.dark.png)) |

Each page follows the system colour scheme and has a theme switch in its
header. Appending `#dark` or `#light` to the URL forces a scheme. All six
pages were checked at 1440px and 390px in both schemes, and none scrolls
sideways; wide tables and code blocks scroll inside their own box.

## Where the content comes from

All three directions show the same sky, the same chart and the same
sky-dating result, so the comparison is about design and not about content.

- **The sky and the chart** are New York at 2026-11-12 02:00 UT (11 November,
  21:00 EST), computed with the built caelus 0.25.0 engine: `engine.chart()`
  for the bodies, angles, cusps and aspects, and the HYG-derived star
  catalogue and constellation figures in `packages/caelus/data` for the star
  fields. Altitude and azimuth were derived from the chart's RA, Dec and MC.
  The drawings are static inline SVG.
- **Proof numbers** come from `apps/web/lib/facts-anchors.generated.ts`
  (3,440 golden checks, 0.61 nano-arcsecond, 35 MCP tools, 12 house systems,
  7 ayanamsas, 13 default bodies) and `packages/caelus/accuracy.json` (the
  per-body error table and the bounds). The "~153 KB gzipped" figure on the
  current home page is in neither file, so the mockups leave it out.
- **Sky-dating results are placeholders, and each page says so.** `dateSky()`
  does not exist yet. The windows shown came from a brute-force scan that
  called `engine.position()` for each body at 12:00 UT on 2,190,726 days. The
  query is tonight's sky by sign. Saturn in Aries holds in 405 windows, adding
  Jupiter in Leo leaves 107, Mars in Leo 34, the Sun in Scorpio 7, and Venus,
  Mercury and the Moon leave 3: 15 Nov 2801 BCE, 8 to 9 Nov 1409 CE, and
  10 to 12 Nov 2026 CE. The scan has not been checked against any published
  corpus, and the code beside the results is a proposed API shape.

Two things the scan turned up that the real feature will have to settle:

- The brief calls this a 5,000-year timeline. `engineCapabilities` reports
  the chained span as -2998 to 3000, which is 5,998 years, so the mockups say
  "3000 BCE to 3000 CE" and use 5,998 where a count is needed.
- `julianDay()` treats early dates as proleptic Gregorian. The mockups show
  dates before 15 October 1582 in the Julian calendar, converted outside the
  engine. The sky-dating API needs a stated calendar convention.

## Planetarium

The page is the sky. A full-bleed computed panorama fills the first screen,
with the claim, the install command and four proof figures set over its lower
edge, and each section after that is a wide scene with one idea. Type is a
light geometric sans (Manrope) with JetBrains Mono for figures, and the
palette is the current night purple and peach. It is going for the first
impression: a visitor understands in one look that this engine computes real
skies. It costs the most to build well. The hero needs the live sky renderer
running full-bleed on phones, text over imagery needs a scrim and contrast
work, and the look depends on gradients and one glass panel, which the
current `DESIGN.md` forbids. It is weakest away from the home page. Docs,
validation tables and dense instruments get little from the treatment, the
hero stays night in light mode so the two schemes look alike at the top, and
large light headlines over a starfield pull toward the landing-page register
that `docs/editorial-voice.md` rules out.

## Almanac

The site as a printed ephemeris. A serif (Newsreader) carries everything,
with IBM Plex Mono for code and labels, on paper and ink with one rubric
colour. The home page opens on Plate I, an all-sky chart drawn as line
engraving, beside the claim and a short table of proof figures whose sources
are footnotes. Figures and tables are numbered and captioned, and the
sky-dating form is a sentence with the signs as inline selects. It is going
for authority through restraint: attribution is built into the layout, which
suits an engine whose distinguishing property is that every number is
attributed. It is the cheapest to build, since it is mostly typography,
tables and rules, but it asks for editorial discipline on every page (numbered
figures, maintained footnotes). It is weakest where the site is heading. A
gallery of interactive instruments and games sits awkwardly in a print idiom,
the sentence form does not scale past a handful of inputs, and it departs
furthest from the current brand, so nothing existing carries over.

## Workbench

The site as a bench of instruments. Every page is a 12-column grid of
hairline-ruled tiles, and each tile has an ID, a title and a source or status
in its header. Data, labels and code are JetBrains Mono, titles are Barlow
Condensed capitals, prose is Barlow, and corners are square. The home page
opens on a sky tile (altitude against azimuth with the ecliptic strip under
it), with the claim and install command in the tile beside it, and the chart,
the readout and six sourced proof figures directly below. The sky-dating page
is input, output and code in three columns. It is going for a site that looks
like what the engine is: measured, labelled, and showing its working. It
costs a moderate amount. The existing vocabulary maps onto it (`.card`
becomes the tile, `.control` and `.field` become the constraint rows, the
mono face stays), and the new work is the bench grid, the tile header, the
readout table and one sky plot. It is weakest on first impression and on
phones. The opening is a plot and not a picture, so it is less inviting to a
visitor who is not a developer, the planet labels in the sky plot are small at
390px, the home page is about 6,400px tall once the tiles stack, and capitals
in a condensed face tire quickly if titles run long.

## Which one I would pick

Workbench. The site is about to become a gallery of instruments and small
games, and Workbench is the only direction where a new instrument is just
another tile: the home page, the gallery and an instrument page share one
grammar. It also makes the engine's actual properties visible in the layout
(every figure has a unit and a source, every result sits beside the call that
produced it, every status is stated), which is what "evidence over
adjectives" asks for. Planetarium wins the first five seconds and loses the
rest of the site. Almanac is the most distinctive and the best at
attribution, but it fights interactivity.

Two things are worth borrowing. Planetarium's panorama could replace the
alt/az plot inside the Workbench sky tile if the opening needs more pull, and
Almanac's numbered footnotes are a good pattern for long-form pages such as
Validation and Build Notes.

## Proposed rewrite of the rules in `apps/web/DESIGN.md`

These are written so that the Workbench mockups already follow every one of
them. Where the current file forbids something `globals.css` does anyway
(gradients, glass, the star-field wash), the rule below is the one to keep
and the CSS is what changes.

### Principles

1. **One page, one job.** Home orients and routes, an instrument answers one
   question, Docs teach, and Validation, Methods, Provenance and Notes prove.
   Nothing appears on a page before its job is served.
2. **Open on a computed thing.** The first tile on every page is output from
   the engine (a sky, a chart, a timeline, a table), stamped with the instant,
   the place and the engine version. On Home the claim and the install
   command sit in the tile beside it, on the first screen.
3. **Every number carries its unit and its source.** A figure is shown with a
   unit and a label, and it links to the page or file that produced it.
   Counts are read from the engine at build time. A number with no source
   does not ship.
4. **The call sits beside the result.** An instrument page is three parts:
   the input, the output, and the code that produced the output. A reader can
   copy the call and get the same answer.
5. **State the status.** Each tile header says what the thing is: live, next,
   planned, or placeholder. Placeholder data is labelled inside the tile that
   shows it, in the page, every time.
6. **Scan first, read second.** Tile headers, labels and table cells carry
   the scan and may be fragments. Tile bodies are full sentences in the
   register of `docs/editorial-voice.md`.

### Layout

- The page is a **bench**: a 12-column grid whose gaps are 1px rules. Tiles
  span 3, 4, 5, 6, 7, 8 or 12 columns. At 1100px, tiles go to half or full
  width, and at 640px every tile is full width.
- A **tile** is a header strip (ID, title, optional source or status at the
  right) and a body. A new widget is a new tile, not a new page template.
- A **band** is a full-width heading row with one sentence. Bands separate
  groups of tiles and are the only section headings on a bench page.
- The **status bar** is the only site chrome: wordmark, primary navigation,
  check count, version, licence, theme.
- The page never scrolls sideways. A table or code block that is wider than
  its tile scrolls inside the tile.
- Long-form pages (Docs, Notes) keep a single reading column of about 42rem
  inside one full-width tile.

### Type

Three faces with fixed roles, and no others.

- **JetBrains Mono**: data, labels, tile headers, table cells, code.
- **Barlow Condensed**, capitals, weight 600: page titles, band headings and
  tile titles. Keep these under about six words.
- **Barlow**: running prose.

### Colour

- Surfaces, rules and text tiers are tokens, and dark and light are the same
  tokens with different values. Every page works in both.
- Two accents with two meanings, as now. **Violet** is structural: links,
  selection, primary actions, chart geometry. **Peach blossom** is the living
  layer: markers of the computed sky, matches in a result, and placeholder
  notices. Green and red are reserved for check status and diffs.
- No third accent, and no per-tradition colourways. Tradition changes the
  figure, not the chrome.

### What is not used

- No gradients, no blur or glass, no shadows, no background wash, and no
  rounded corners. Depth comes from the 1px rule and two surface tones.
- No decorative motion. A control may change state, and the home sky may play
  when the visitor starts it. Honour `prefers-reduced-motion` by jumping to
  the end state.
- No emoji as UI and no icon font. Instrument icons are single-weight line
  SVG in the accent colour.
- No statistic that is not in the facts files, and no adjective standing in
  for a number.
