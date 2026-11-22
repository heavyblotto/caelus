# ephemengine.com design notes

Rules for the site's visual design and layout. The direction is **Workbench**:
the site is a precision astronomical instrument studio, and every page is a grid
of hairline-ruled tiles that show a computed result, its source, and the call
that produced it. The voice is factual and evidence-forward
(`docs/editorial-voice.md`); the design provides optical hierarchy, tabular
legibility, and instrument craft without decorative clutter.

**Status.** `apps/web/app/globals.css` carries the single unscoped design
system shared by both builds: Next.js in `apps/web` and Astro in `apps/site`.
Both themes (obsidian dark and archival vellum light) derive from calibrated
OKLCH tokens with complete surface, text, border, and chart-ink parity.

## Principles

1. **One page, one job.** Nothing appears on a page before that job is served.
   - Home orients and routes: what Caelus computes, proof it is verified, how to
     install it, and where to explore.
   - An instrument answers one astronomical or astrological question from a
     small input.
   - Playground demonstrates the working engine in the browser with paired
     visualizations, live telemetry, and reproducible code export.
   - Features inventories; Docs teach; Validation, Methods, Provenance, and
     Build Notes prove.
2. **Open on a computed thing.** The first tile on every page is output from
   the engine (a sky, a chart, a timeline, a table), stamped with the timestamp,
   observer coordinates, and engine version. On Home the claim, install
   commands, and proof figures sit beside the live sky stage on the first
   screen.
3. **Every number carries its unit and its source.** A figure is shown with a
   unit and a label, and it links to the page or file that produced it. Counts
   are read from the engine at build time (`lib/facts.ts`). All numeric
   readouts, tables, and counters use tabular figures (`tabular-nums`).
4. **The call sits beside the result.** An instrument page has three parts: the
   input, the output, and the code that produced the output. A reader can copy
   the call and get the same answer.
5. **State the status.** Each tile header states what the panel shows: live,
   next, planned, or placeholder. Placeholder data is labelled inside the tile
   that shows it, every time.
6. **Scan first, read second.** Tile headers, telemetry strips, badges, and
   table cells carry the scan and may be concise labels. Tile bodies use
   complete natural sentences.
7. **Figures are sized to their information.** A preview is a thumbnail in a
   narrow tile; the working figure on an instrument or playground page is large
   because it is the object of study. Every figure names what computed it.

## Layout

- **Bench (`.bench`).** A 12-column grid whose gaps are 1px rules (`--line`).
  Tiles span 2, 3, 4, 5, 6, 7, 8, 9, or 12 columns (`.s2` through `.s12`). At
  1100px tiles step to half or full width, and at 640px every tile is full
  width.
- **Tile (`.tile`).** A header strip (`.tile__h` with bold ID, span title,
  right-aligned status/source, and optional `.tile__actions`) over a body
  (`.tile__b` or `.tile__b--flush`) and optional footer (`.tile__f`). Accent
  modifiers `.tile--accent` and `.tile--live` mark primary or live-computed
  panels with a 2px top structural rule. `.tile--inset` uses the recessed
  `--panel-inset` ground for optical stages and wells.
- **Band (`.band`).** A full-width heading row with optional kicker, uppercase
  condensed heading, at most one lead sentence, and right-aligned metadata.
  Bands separate groups of tiles on a bench page.
- **Status bar (`.bar`).** Sticky top chrome at `--bar-h` (`44px`): wordmark,
  primary navigation, golden check status cell, GitHub link, version, MIT
  licence, and theme toggle. Below 900px navigation moves cleanly to a second
  row without overflow; below 640px optional telemetry cells drop out.
- **No sideways scroll.** `html` and `#content` clip horizontal overflow, all
  grid and flex items set `min-width: 0`, and wide tables or code blocks scroll
  inside their own `.table-scroll` or `.scroll` container.
- **Long-form pages.** Docs, Build Notes, and reading pages keep a 42rem prose
  measure (`--measure`) inside one full-width tile (`.page`). Pages open with
  `PageHero` and close with `PageClose`.

## Shared vocabulary

New UI reuses these semantic classes rather than inline style objects:

- **Visualizations (`.viz-stage`).** Recessed precision instrument frame with
  `.viz-stage--square`, `.viz-stage--wide`, and `.viz-stage--paired` (2-up
  synchronized 2D + 3D layout stacking below 960px), `.viz-stage__pane`,
  `.viz-stage__toolbar`, `.viz-stage__readout`, `.viz-toolbar`, `.viz-legend`,
  and `.viz-tooltip`. Interactive cross-highlighting between SVG figures and
  tables uses `[data-selected="true"]`, `[data-hovered="true"]`,
  `[data-highlighted="true"]`, and `[data-dimmed="true"]`.
- **Playground and instruments.** `.playground-bench`, `.preset-bar`,
  `.preset-chip`, `.chip`, `.scrubber-bar`, `.scrubber-steps`,
  `.scrubber-telemetry`, `.kbd`, `.data-table--interactive`, `.rail-list`,
  `.rail-stack`, `.reading-group`, `.reading-meta`, `.code-drawer`, `.drawer`,
  `.inst-grid`, `.inst-presets`, `.inst-meta`, and `.status-live`.
- **Telemetry and marketing.** `.telemetry`, `.stat-grid`, `.stat-cell`,
  `.badge` (`.badge--accent`, `.badge--warm`, `.badge--ok`, `.badge--bad`,
  `.badge--muted`), `.led` (`.led--live`, `.led--ok`, `.led--next`,
  `.led--bad`), `.install-tabs`, `.install-cmd`, `.track-grid`, `.track-tile`,
  `.code-compare`, `.docs-hub-grid`, `.callout`, `.kv-list`, `.stack`, and
  `.row`.
- **Controls.** Unified control height tokens (`--ctrl-h: 36px`,
  `--ctrl-h-sm: 28px`, `--ctrl-h-lg: 42px`) align `.btn`, `.control`, `.seg`,
  `.tabs__tab`, and `.chip` on shared optical baselines.

## Type and spacing scales

Three faces with fixed roles, and no others:

- **JetBrains Mono (`--mono`)**: data, telemetry, labels, tile headers, table
  cells, badges, controls, and code.
- **Barlow Condensed (`--cond`)**, uppercase, weight 600: page titles, band
  headings, and tile titles. Keep these concise.
- **Barlow (`--sans`)**: running prose and sentence-case body headings.

Eight-step type scale (`--fs-2xs` through `--fs-2xl`, with legacy aliases
`--fs-eyebrow` through `--fs-h1`) and a 4px spacing scale (`--sp-1` through
`--sp-12`). Sticky offsets (`--sticky-top`, `--scroll-offset`) derive from
`--bar-h`.

## Colour and OKLCH tokens

Everything derives from the OKLCH custom properties at the top of
`apps/web/app/globals.css`. Dark and light share the exact same token names,
follow the OS color scheme automatically via `<meta name="color-scheme">` even
before JavaScript runs, and meet WCAG AA contrast across text (including
`--faint` at >= 4.8:1), UI boundaries (`--line2` >= 3.0:1), and SVG chart inks.

| Token | Dark (OKLCH) | Light (OKLCH) | Use |
|-------|--------------|---------------|-----|
| `--bg` | `oklch(14% 0.009 264)` | `oklch(91.5% 0.007 85)` | page ground, bands |
| `--panel` | `oklch(18.2% 0.011 264)` | `oklch(98.6% 0.004 85)` | tile surface |
| `--panel2` | `oklch(22.5% 0.013 264)` | `oklch(94.5% 0.006 85)` | hover, shaded plot surface |
| `--panel-inset` | `oklch(11.8% 0.008 264)` | `oklch(93% 0.007 85)` | recessed code wells, stages, tracks |
| `--line` | `oklch(29% 0.015 264)` | `oklch(81% 0.008 85)` | 1px grid rule |
| `--line2` | `oklch(50% 0.018 264)` | `oklch(58% 0.014 264)` | strong rules, control borders (>= 3:1) |
| `--text` | `oklch(94.8% 0.006 264)` | `oklch(19.5% 0.012 264)` | primary text |
| `--dim` | `oklch(77.5% 0.012 264)` | `oklch(38% 0.016 264)` | prose and secondary text |
| `--faint` | `oklch(64.5% 0.014 264)` | `oklch(47.5% 0.015 264)` | labels, captions, telemetry keys (>= 4.8:1) |
| `--accent` | `oklch(73.5% 0.165 282)` | `oklch(44.5% 0.215 278)` | structural violet |
| `--warm` | `oklch(75% 0.165 352)` | `oklch(48% 0.195 352)` | peach blossom, the living layer |
| `--ok` | `oklch(81.5% 0.125 148)` | `oklch(44% 0.135 148)` | check status and gains |
| `--bad` | `oklch(73.5% 0.145 22)` | `oklch(47% 0.18 24)` | failures and losses |

Two accents, two meanings. Violet (`--accent`) is structural: navigation,
links, selected states, primary actions, and chart geometry. Peach blossom
(`--warm`) is reserved for the living layer: computed sky markers, result
matches, interpretation surfaces, and placeholder notices. Green (`--ok`) and
red (`--bad`) are reserved for check status and diffs. All 12 planetary inks
(`--wheel-planet-*`), aspect inks (`--wheel-aspect-*`), and celestial reference
curves (`--wheel-horizon`, `--wheel-ecliptic`, `--wheel-meridian`) define
calibrated dark and light OKLCH twins so figures remain sharp on both themes.

## What is not used

- No gradients, no blur or glass, no shadows, no background wash, and no
  rounded corners on chrome. Depth comes from crisp 1px rules and calibrated
  surface tiers. Data marks such as planet dots are exempt because they are
  figures, not chrome.
- No decorative motion. Interactive controls may use brief (`120ms`) color and
  border state transitions; figures play only when the visitor starts them.
  `prefers-reduced-motion: reduce` disables all transitions immediately.
- No emoji as UI and no icon font. Instrument icons are single-weight line SVG
  using `currentColor`.
- Native platform primitives where available: `<dialog>` with `showModal()` and
  light-dismiss for documentation search, `@media (forced-colors: active)`
  fallbacks for High Contrast Mode, and native `color-scheme` theming.
- No unverified statistic outside `lib/facts.ts`, and no em-dashes in prose.
