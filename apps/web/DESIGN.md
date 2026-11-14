# ephemengine.com design notes

Rules for the site's visual design and layout. The direction is **Workbench**:
the site is a bench of instruments, and every page is a grid of labelled tiles
that show a computed result, its source, and the call that produced it. The
voice is factual and evidence-forward (`docs/editorial-voice.md`); the
design's job is hierarchy and legibility, not persuasion.

**Status.** The owner chose this direction on 2026-11-11, and the site was
restyled to it in one change the same day. `app/globals.css` carries the
rules below unscoped, and both builds (Next in `apps/web`, Astro in
`apps/site`) render from it. The reference mockups are
`design/directions/workbench/home.html` and
`design/directions/workbench/sky-dating.html`. The "Migration" section at the
end records what was removed and what is left.

## Principles

1. **One page, one job.** Nothing appears on a page before that job is served.
   - Home orients and routes: what this is, proof it is real, where to go.
   - An instrument answers one question from a small input.
   - Playground demonstrates the working engine in the browser.
   - Features inventories; Docs teach; Validation, Methods, Provenance, and
     Notes prove.
2. **Open on a computed thing.** The first tile on every page is output from
   the engine (a sky, a chart, a timeline, a table), stamped with the instant,
   the place, and the engine version. On Home the claim and the install
   command sit in the tile beside it, on the first screen.
3. **Every number carries its unit and its source.** A figure is shown with a
   unit and a label, and it links to the page or file that produced it.
   Counts are read from the engine at build time (`lib/facts.ts`). A number
   with no source does not ship.
4. **The call sits beside the result.** An instrument page has three parts:
   the input, the output, and the code that produced the output. A reader can
   copy the call and get the same answer.
5. **State the status.** Each tile header says what the thing is: live, next,
   planned, or placeholder. Placeholder data is labelled inside the tile that
   shows it, every time.
6. **Scan first, read second.** Tile headers, labels, and table cells carry
   the scan and may be fragments. Tile bodies are full sentences. Prose
   paragraphs are for reasoning, not for enumerations.
7. **Figures are sized to their information.** A preview is a thumbnail in a
   narrow tile; the working figure on an instrument page is large because it
   is the object of study. Every figure says what computed it.

## Layout

- **Bench.** The page is a 12-column grid whose gaps are 1px rules. Tiles span
  3, 4, 5, 6, 7, 8, or 12 columns. At 1100px tiles go to half or full width,
  and at 640px every tile is full width.
- **Tile.** A header strip (ID, title, and an optional source or status at the
  right) over a body. A new widget is a new tile, not a new page template and
  not a second kind of card.
- **Band.** A full-width heading row with at most one sentence. Bands separate
  groups of tiles and are the only section headings on a bench page.
- **Status bar.** The only site chrome: wordmark, primary navigation, check
  count, version, licence, theme. Below 900px the navigation moves to a
  second row of the bar, and below 640px the check count, GitHub, and licence
  cells drop out.
- **No sideways scroll.** A table or code block wider than its tile scrolls
  inside the tile.
- **Long-form pages.** Docs, Notes, and other reading pages keep a single
  column of about 42rem inside one full-width tile (`.page`). They use
  sentence-case `h2` headings in the prose flow. A page opens with its title
  tile (`PageHero`: label and title at the left, lead and actions at the
  right) and closes with the install band (`PageClose`). Features and the
  Playground add `.page--bench`, which turns their section headings into
  bands.

## Instrument grammar

An instrument page is a title tile, then three columns that stack on small
screens:

- **Input.** One row per constraint or parameter: glyph, label, control.
  Fixed parameters (zodiac, span) are shown as read-only rows so the reader
  can see every input the call receives.
- **Output.** The count or headline result first, then the figure, then the
  table of results, then a table showing how the result was reached.
- **Code.** The call, then the shape it returns. Proposed or unreleased API
  is marked in the tile header.

Method and limits follow as three short prose tiles. The Playground follows
the same grammar: its document bar, provenance stamp, today strip, figure,
rail, and scrubber are tiles on the bench. Casual and Advanced share the
chrome, and Advanced shows more tiles.

The existing vocabulary carries over and is restyled, not replaced:

- `.card` is a tile outside the bench grid; `.grid`, `.feature-grid`, and
  `.feature-stats` lay cards out with shared 1px rules.
- `.control` and `.field` become the input rows.
- `.btn` keeps its variants; the primary action is the violet fill.
- `.tabs__tab` and `.seg` remain the only tab and switcher styles.
- `.capability-grid` entries become narrow tiles.
- Timelines (dashas, zodiacal releasing, sky dating) are stacked tracks with
  the label and count at the left of each track.
- Counterfactual diffs use `--good` and `--bad`.

New UI reuses these classes. Inline style objects are not the mechanism for
anything a second component might want.

## Type

Three faces with fixed roles, and no others.

- **JetBrains Mono**: data, labels, tile headers, table cells, code.
- **Barlow Condensed**, capitals, weight 600: page titles, band headings, and
  tile titles. Keep these under about six words.
- **Barlow**: running prose.

## Colour and tokens

Everything derives from the variables at the top of `globals.css`. Dark and
light are the same tokens with different values, and every page works in
both. A new colour or size should be an existing token or, rarely, a new one.

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--bg` | `#08090b` | `#deded9` | page ground, bands, code wells |
| `--panel` | `#0f1114` | `#fbfbf9` | tile surface |
| `--panel2` | `#15181c` | `#f0f0ec` | hover, shaded regions of a plot |
| `--line` | `#272b33` | `#c9c9c2` | the 1px grid rule |
| `--line2` | `#3d434e` | `#9d9d95` | stronger rules, figure outlines |
| `--text` | `#e7e9ec` | `#15171a` | primary text |
| `--dim` | `#a0a7b1` | `#4d5259` | prose and secondary text |
| `--faint` | `#6d7480` | `#7b8088` | labels and captions |
| `--accent` | `#a596ff` | `#4a3ecf` | structural violet |
| `--warm` | `#f283b3` | `#bf2f78` | peach blossom, the living layer |
| `--ok` | `#8fd694` | `#28773a` | check status |

Two accents, two meanings. Violet (`--accent`) is structural: navigation,
links, selected states, primary actions, chart geometry. Peach blossom
(`--warm`) is the single warm counterpoint, reserved for the living layer:
markers of the computed sky, matches in a result, interpretation surfaces,
and placeholder notices. Green and red are reserved for check status and
diffs. A window of uncertainty drawn on a wheel is
structural and takes violet: the arcs are geometry of the chart over a span
of time, the same kind of thing as the axes, and peach stays for what marks
the stated or current moment. Do not use peach for chrome, and do not add a third accent or a
per-tradition colourway. Tradition changes the figure, not the chrome.
Wheels, the kundli, the ephemeris graph, and the sky plots consume the
`--wheel-*` tokens and `--accent`.

## What is not used

- No gradients, no blur or glass, no shadows, no background wash, and no
  rounded corners. Depth comes from the 1px rule and two surface tones. Data
  marks such as a planet dot are exempt because they are figures, not chrome.
- No decorative motion. A control may change state, and a figure may play
  when the visitor starts it. Honor `prefers-reduced-motion`: jump, don't
  play.
- No emoji as UI and no icon font. Instrument icons are single-weight line
  SVG in the accent colour.
- No statistic that is not in the facts files, and no adjective standing in
  for a number.

## Migration

The restyle landed as one change. What the old stylesheet and layout carried,
and what `app/globals.css` holds after it, counted on 2026-11-11:

| Removed | Before | After |
|---------|--------|-------|
| Gradient declarations, including the star-field wash | 10 | 0 |
| `backdrop-filter` declarations | 4 | 0 |
| `box-shadow` declarations | 3 | 0 |
| `border-radius` declarations | 23 | 3, all `border-radius: 0` resets on native controls |
| `@keyframes` and the animations that used them | 2 | 0 |
| `transition` declarations | 14 | 0, apart from the reduced-motion override |
| Inter as `--font-sans` | loaded | replaced by Barlow, with Barlow Condensed as `--font-cond` |

The night-purple tokens are gone; the older token names (`--surface`,
`--border`, `--text-dim`, and the rest) remain as aliases of the Workbench
tokens so component rules and inline styles read one palette. The header and
footer are the status bar and a row of footer tiles. `workbench.css` and its
`.wb` scope are gone, and the instrument's rules sit in `globals.css` under
the class names `packages/widgets` emits.

Still to do, none of it blocking:

- Some components carry inline style objects for spacing and colour
  (`RailPanels.tsx`, the playground tabs). They read the aliased tokens, so
  they render correctly, but they are not the mechanism this file asks for.
- The Playground's parts have tile headers with IDs (DOC, NOW, FIG, RAIL,
  TIME) and sit between rules, but it is still one component with its own
  layout classes, not tiles on the bench grid.
- The guides under `app/docs` open with an inline-styled label `div` above
  their title. It renders as the label does elsewhere.
- The alias token names can be renamed away file by file.
