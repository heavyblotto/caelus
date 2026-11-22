# FACT-001 Tufte VDQI Critique and Visual Specification (Instrument I-05)

- **Factory Track**: `FACT-001` (`Instrument I-05: Field Verifier and Chronolocator`, `/instruments/field-verifier`)
- **Rubric Source**: Edward R. Tufte, *The Visual Display of Quantitative Information* (2nd ed., 2001), operationalized via local skills `tufte-critique` (9-criterion weighted rubric: Integrity 3x, Proportionality 2x, Data-ink 2x, Redundant ink 1x, Data density 1x, Integration 1x, Context 1x, Clarity 1x, Typography 0.5x; total weight 12.5) and `tufte-chart`.
- **Scope**:
  1. Source-grounded 9-criterion VDQI critique of `packages/wheel/src/ephemerisgraph.tsx` (`EphemerisGraph`).
  2. Source-grounded 9-criterion VDQI critique of `packages/widgets/src/sky-dating-widget.tsx` (`SkyDating` and `Track`).
  3. Concrete VDQI visual rules for Instrument I-05 (`Verify`, `Chronolocate`, and `Geolocate` figures and tables) aligned with `apps/web/DESIGN.md`.

---

## 1. Critique: `packages/wheel/src/ephemerisgraph.tsx` (`EphemerisGraph`)

Context: Standalone SSR-safe SVG graphic ephemeris plotting one or more planetary series (ecliptic longitude wrapped at 360 deg, declination, or daily speed) over Julian Days, with optional shaded interval band (`band`), event ticks (`marks`), and scrub cursor (`cursor`). Audience: developers and astronomy/astrology readers inspecting multi-body motion in Caelus widgets or docs.

### Scores

1. **Integrity (3x): 6.0/10.** The x and y scales are linear and longitude wrap-splitting (`Math.abs(pts[i].value - pts[i - 1].value) > wrap / 2`, line 96) prevents false vertical cliff artifacts across 360 to 0 deg. Two concrete integrity failures pull the score down: (a) when `wrap` and `gridStep` are unset, `step = span / 6` (line 84) produces fractional steps while line 117 renders `Math.round(v)`, collapsing distinct gridlines onto duplicate integer labels (for example, planetary speed from `-0.4` to `+1.4` deg/day produces six ticks labeled `0, 0, 0, 1, 1, 1` placed at fractional coordinates); (b) the horizontal axis carries zero date or JD tick labels, violating VDQI Integrity Principle 2 (p. 77) because neither span nor rate of change can be verified from the graphic itself.
2. **Proportionality (2x): 8.0/10.** All 1-D values map to 1-D vertical position on one common scale with uniform `strokeWidth={1.5}` (geometric lie factor 1.00, within Tufte's 0.95 to 1.05 target, p. 57). Deduction solely for the `±5%` outward y-padding (line 70) and rounded tick-label offset on non-integer `span / 6` steps, which decouple printed tick numbers from their exact vertical positions.
3. **Data-ink ratio (2x): 6.0/10.** Clean flat strokes with no shadows, gradients, or 3-D debris. However, the graphic encloses the plot in a full 4-sided bounding `<rect>` (line 122), draws 6 to 7 full-width horizontal gridlines (line 114), and spends a 96 px right sidebar on detached swatch lines (lines 142 to 145). Trimming the box to range-frame axes (B2), erasing interior gridlines (B5), and moving labels onto endpoints (B4) removes roughly 35% to 45% of non-data ink without losing any datum (cf. VDQI pp. 95, 136).
4. **Redundant ink (1x): 6.0/10.** Each legend row repeats color on both a line swatch and colored text, and vertical full-height `marks` intersect every horizontal gridline, adding visual crossings with zero extra data. Duplicate `Math.round(v)` labels on narrow-range series are also pure redundant ink.
5. **Data density (1x): 7.0/10.** Multi-body daily time series pack high numerical density into `580 x 324` px (well above the 0.15 numbers/in^2 "overwrought" floor, VDQI p. 162), though the 96 px legend gutter and empty 24 px bottom margin leave roughly 19% of the SVG area carrying chrome or blank space.
6. **Integration (1x): 4.0/10.** Detached right-column legend (lines 142 to 145) forces repeated eye jumps between curves and key, especially when multiple close violet/blue hues appear together (`mercury #9a93c4`, `saturn #8d8a99`, `uranus #4f8fc0`, `neptune #5a6fc0`).
7. **Context (1x): 4.0/10.** Standalone SVG omits x-axis start/end dates (or JDs), y-axis units (`deg`, `deg/day`), and any distinct `y = 0` reference baseline for signed quantities (declination or retrograde speed sign-flips). Violates VDQI Integrity Principle 6 (p. 77).
8. **Clarity (1x): 5.0/10.** Three clarity issues: (a) plotting 5 or more bodies on wrapped longitude produces tangled crossings; (b) `DEFAULT_COLORS` mixes red-green pairs (`mars #c0564f` against `venus #4fb09a` and `chiron #7a9a5a`), failing VDQI Part H color-deficiency guidance for 5% to 10% of viewers (p. 183); (c) `marks` place labels at fixed `y = m.t + 8` (line 160), causing label overlaps on closely spaced events and collisions with curves near `yMax`.
9. **Typography (0.5x): 5.0/10.** All text runs left-to-right (good), and monospace digits align cleanly, but body labels print raw lowercase keys (`sun`, `mercury`, line 145) and cryptic 2-letter mark codes (`SR`, line 14) instead of spelled-out mixed-case labels (VDQI p. 183).

### Chartjunk species present

- **Dreaded grid (mild):** Full-width horizontal rules plus a 4-sided enclosing frame (`th.ring`) compete with pale series (`saturn #8d8a99`, `moon #c8c8d0`) and create grid intersections against dashed vertical `marks` (resembling Marey's "active" grid critique, VDQI p. 115, partially mitigated by `opacity={0.5}`).
- **Decoration (mild):** Top and right frame borders and detached swatch dashes carry zero data beyond what range-frame axes and direct endpoint labels convey.
- **Moire:** None.
- **Duck:** None.

### Distortion check

- **Lie factor:** `1.00` geometrically on linear coordinates; however, unformatted `Math.round(v)` labels on `span / 6` steps create numerical mislabeling on sub-unit spans (such as speed or lunar latitude).
- **Resembles:** No close analogue to 2-D/3-D area inflation cases (such as TIME 1979 oil barrels, lie factor 59.4); aligns with incomplete-labeling and missing-context failures (VDQI Principles 2 and 6, p. 77).

### Genres considered (ranked)

1. **C5 Small multiples (VDQI pp. 42, 170, 175):** Shared-time miniature panels (one per body or grouped inner vs outer) eliminate overplotting, detached legends, and color-deficiency collisions whenever 4 or more bodies are shown.
2. **C10 Time-series with C2 range-frame axes and B4 direct labels (VDQI pp. 28 to 30, 130 to 132):** Best when comparing 1 to 3 bodies whose crossings (conjunctions, stations) must be read on a single shared vertical coordinate.
3. **C6 Supertable (VDQI pp. 56, 178):** Superior when the reader needs exact coordinates for 20 or fewer discrete timestamps (ingresses, stations).

- **Chosen:** C5 Small multiples for `K >= 4` bodies; C10 + C2 range frame for `1 <= K <= 3` bodies.
- **Default-challenge:** For multi-body views (`K >= 4`), switching to C5 small multiples is a second-line VDQI move that beats the default overplotted line chart. For `1 to 3` bodies, C10 + C2 is justified because small multiples lose exact visual intersection alignment between two curves.
- **Multi-render trigger:** Many series of one x -> C5 small multiples + overplotted C10 with direct right-end labels.

### Overall: 6.0/10

Honest linear geometry with clean wrap-splitting, held back by fractional tick rounding bugs, absent x-axis and unit labels, a boxed frame with interior grid, and a detached legend.

### Fixes (highest impact first)

1. **[B1, B2, C10, emulate Playfair p. 34]** Format y-axis ticks with significant precision matching `step` (never `Math.round(v)` on fractional `span / 6`), render exact data min/max endpoints on a trimmed C2 range-frame y-axis, and add x-axis start/end date (or JD) labels plus explicit y-axis units and a faint `y = 0` reference line for signed series.
2. **[B4, Part H]** Delete the right-hand legend sidebar and place mixed-case body labels (`Sun`, `Mars`) directly at each curve's right-most endpoint with simple vertical deconfliction; replace red-green pairs (`#c0564f` vs `#4fb09a` / `#7a9a5a`) with a color-blind-safe palette (e.g., Okabe-Ito / Workbench violet-peach-slate-ochre).
3. **[B5, D-Grid]** Erase the top and right edges of `<rect x={m.l} y={m.t} ...>` and drop horizontal gridlines (or reduce to 1 to 2 faint hairlines at meaningful domain landmarks such as 0 deg and 180 deg).
4. **[B3, C5, emulate McRae et al. LA Air Pollutants]** Provide a small-multiples mode when `bodies.length >= 4` with invariant scales and end-labels printed only on the first panel.
5. **[B4, Clarity]** Place `marks` labels in a dedicated top annotation lane above `m.t` (never inside the curve area at `m.t + 8`) with horizontal stagger when two marks fall within 24 px.

---

## 2. Critique: `packages/widgets/src/sky-dating-widget.tsx` (`SkyDating` and `Track`)

Context: Interactive Workbench Instrument `I-01` (`/instruments/sky-dating`) showing progressive constraint pruning across up to 6,000 years via stacked horizontal interval tracks (`Track`, lines 75 to 87), numbered `.pin` hit markers (lines 575 to 579), a results table (`TBL`, lines 590 to 639), and a filter-funnel table (`CUT`, lines 641 to 657). Styled by `apps/web/app/globals.css` (lines 2440 to 2510).

### Scores

1. **Integrity (3x): 7.5/10.** Linear Julian Day projection (`k = w / (jd1 - jd0)`), explicit Julian vs Gregorian labels, honest stale-input alert, and documented embedded-tier accuracy bounds (`M-2`, `M-3`). Deduction for `width={Math.max(1.2, (e - s) * k)}` (line 83): across a 6,000-year span (`2,191,500` days), `1.2 / 1000` units equals `2,630` days (`7.2` years), so a 2.5-day lunar match renders as the same filled duration rectangle as a 900-day Saturn interval without visually distinguishing a point marker from a scaled duration span.
2. **Proportionality (2x): 6.5/10.** Multi-decade spans scale honestly (lie factor 1.00), but sub-pixel windows clamped to `1.2` units inflate visual width by roughly 1,050x relative to a 2.5-day true duration and compress a 360:1 duration ratio (900 days vs 2.5 days) to 1:1. Additionally, `.tl__row--hit .trk` expands track height from `16px` to `22px` (+37.5%, `globals.css:2448`) solely for visual emphasis rather than a second variable (mild dimensionality excess, VDQI p. 71).
3. **Data-ink ratio (2x): 7.5/10.** Strong Workbench restraint (zero gradients, drop shadows, rounded-card bloat, or background washes; see `apps/web/DESIGN.md`). Deductions for enclosing every single track in a full 4-sided box (`border: 1px solid var(--line)`, `globals.css:2445`) and leaving the `.meter` progress bar painted at 100% solid width in `--warm` after completion (line 551: `search ? 1 : 0`), which adds permanent non-data chrome once the search is idle.
4. **Redundant ink (1x): 7.0/10.** Window counts repeat between the left rail of `OUT` (`.tl__lab i`) and `CUT`, and the final hit track is triple-encoded via color change (`--accent` to `--warm`), height increase (`16px` to `22px`), and `.pin` callouts. The `CUT` table earns its keep by adding cumulative matching days.
5. **Data density (1x): 8.5/10.** High information yield: up to 8 aligned constraint stages over 6,000 years, paired directly with a compact 40-row tabular ephemeris (`TBL`) and pruning funnel (`CUT`).
6. **Integration (1x): 8.5/10.** Exemplary inline labeling: each track carries its own constraint label and count on the left, numbered `.pin` markers cross-reference row numbers in `TBL`, and no detached color legend is needed.
7. **Context (1x): 9.0/10.** Strongest dimension: displays era span, engine version, ephemeris tier, exact browser execution time, calendar system, and error bounds in `M-1` through `M-3`. Minor gap: axis ticks show `niceStep` round years without anchoring the exact `startYear` and `endYear` bounds when those are non-round (for example, `410 BCE` to `2026 CE`).
8. **Clarity (1x): 7.5/10.** Clear top-to-bottom pruning narrative from slowest planet to Moon. Edge-case flaw: `.pin` badges (`position: absolute`, lines 575 to 578) have no horizontal deconfliction, so two matches separated by 20 years on a 6,000-year span (`0.33%` apart) collide and mask each other's number.
9. **Typography (0.5x): 6.5/10.** Crisp tabular JetBrains Mono works well for numeric alignment in `TBL` and `CUT`, but `.tl__lab` forces `text-transform: uppercase` (`globals.css:2442`), which reduces scanning speed relative to upper-and-lower-case labels (VDQI p. 183, quoting Albers).

### Chartjunk species present

- **Decoration (minor):** Full 4-sided borders on every `.trk` strip and a permanently filled 100% `.meter` bar after completion carry no post-search data.
- **Moire / Dreaded grid / Duck:** None.

### Distortion check

- **Lie factor:** `1.00` for spans wider than `0.12%` of total range; severe clamping distortion (up to ~1,050x width inflation on a 2.5-day match across 6,000 years) when short windows hit the `1.2`-unit minimum floor while retaining the same filled-bar idiom as true-width intervals.
- **Resembles:** Closer to an accidental scale floor than an intentional area lie (not comparable to TIME 1979 oil barrels, 59.4); still merits explicit point-vs-interval differentiation so readers never read clamped ticks as multi-year intervals.

### Genres considered (ranked)

1. **C5 Small-multiples stacked timeline + C6 Supertable (`TBL` + `CUT`):** Already close to the right VDQI architecture, pairing visual pruning overview with high-precision tabulation.
2. **C6 Supertable with inline funnel sparkbars:** Works when a query returns fewer than 20 windows and span distribution is secondary.
3. **C10 Time-series (continuous planetary elongation curves):** Overkill for boolean constraint intersections; loses crisp pruning readability.

- **Chosen:** C5 stacked tracks + C6 supertables (retain and refine).
- **Default-challenge:** Stacked aligned tracks plus a paired supertable is already a second-line VDQI composition rather than a generic bar or pie chart.
- **Multi-render trigger:** None; single canonical composition fits the domain cleanly.

### Overall: 7.5/10

A disciplined, honest Workbench instrument that already embodies small-multiples alignment and table-graphic pairing; tightening sub-pixel hit markers, track borders, pin collisions, and idle meter ink brings it cleanly above 8.5/10.

### Fixes (highest impact first)

1. **[B1, Clarity]** Separate sub-pixel hits from true-duration intervals in `Track`: when `(e - s) * k < 2` SVG units, draw a crisp 1 px vertical tick stem (or tiny diamond apex) rather than widening a filled bar to `1.2` units, and note the resolution threshold when clamped ticks appear.
2. **[B5, B6]** Erase the 4-sided `.trk` borders (`border: 1px solid var(--line)`) in favor of a single thin 1 px horizontal baseline (`border-bottom`) spanning `startYear..endYear` (range-frame rail), keep all tracks at uniform `16px` height (rely on `--warm` color alone for the hit row), and hide or collapse `.meter` once `running === false && !loading`.
3. **[B2, Context]** Anchor the timeline axis with exact `startYear` and `endYear` range-frame end ticks alongside interior `niceStep` ticks.
4. **[B4, Clarity]** Add simple greedy horizontal deconfliction (`minGapPct`) to `.pin` badges with diagonal leader hairlines when two matches cluster closely.
5. **[Part H, Typography]** Remove `text-transform: uppercase` from `.tl__lab` so constraint names render in mixed case (`Saturn in Leo`) for faster scanning.

---

## 3. Concrete VDQI Visual Rules for Instrument I-05 (`FACT-001`)

Instrument I-05 (`/instruments/field-verifier`) introduces three inline SVG figures plus structured tables inside the Workbench grammar (`apps/web/DESIGN.md`). Apply these rules during `packages/widgets/src/field-verifier.ts` and `field-verifier-widget.tsx` implementation so every figure clears a `>= 8.0/10` VDQI critique on first build.

### Global I-05 Visual Rules (All 3 Modes)

1. **Inert, deterministic SVG only.** No `<script>`, no SMIL `<animate>`, no inline event handlers, no `<foreignObject>`. Round every emitted SVG coordinate to `0.1` (matching `ephemerisgraph.tsx:82`) for cross-architecture byte determinism and clean SSR.
2. **Workbench token discipline with color-blind safety (Part H).** Use `--accent` (violet) for physical engine predictions/geometry and `--warm` (peach) for user-claimed or observed measurements, paired with distinct stroke patterns (solid predicted vs dashed/wedge observed). Never use red vs green as the sole encoding between two plotted vectors; reserve `--ok` and `--bad` for check status labels paired with explicit words (`consistent`, `inconsistent`, `impossible`).
3. **Mixed-case SVG labels, zero detached legends (B4, Part H).** Label every vector, marker, and threshold directly on the figure in upper-and-lower case (`Sun`, `Predicted shadow`, `Horizon 0 deg`). Delete separate legend boxes.
4. **Honest table-first precision (C6, 20-number rule, VDQI p. 56).** Every mode produces 2 to 15 structured numerical checks or candidate fixes. Treat the breakdown table as a first-class C6 supertable with right-aligned tabular numbers, explicit units in column headers (`deg`, `ratio`, `km`, `min`), and zero decorative chrome.
5. **No idle progress chrome and zero em-dashes.** Collapse loading meters once computation completes. Keep all figure labels, captions, and method tiles free of em-dashes (`npm run lint:emdash`).

### Mode 1: Verify (`verifyObservation`): Figure 1 (Compass and Shadow Dial) and Residual Table

- **Prevent shadow-ratio lie factor (B1, VDQI p. 71):** Because `lengthRatio = cot(sunAltitude)` diverges toward infinity near the horizon (`alt -> 0`), never scale a ray linearly without a calibrated scale or silently clip it to the dial radius. Two clean designs (choose one and keep it invariant):
  - *Recommended (separate 1-D channels):* Keep the circular compass dial purely angular (unit azimuth ring for Sun azimuth, predicted shadow bearing, observed shadow bearing + tolerance sector, and Moon bright-limb orientation) and pair it directly beside a compact 1-D horizontal range-frame bar for `lengthRatio` (`0` baseline to `max(obs, pred, tolHi)`, with explicit `>6.0x` break chevron near horizon). Zero geometric distortion at any solar altitude.
  - *Alternative (calibrated radial scale):* If shadow length is drawn radially inside the dial, calibrate radial distance linearly from `0` to `4.0` (`r = min(ratio, 4) / 4 * R_max`), label the outer ring `L/H = 4.0`, and draw an explicit double-slash break tick when `ratio > 4.0`. Never scale marker area or arrowhead size by score or residual.
- **Minimal dial ink (B5, D-Duck):** Do not draw compass-rose stars, concentric bullseye grids, or decorative degree bezels. Draw one thin outer ring (`1px`, `--line2`), four minimal cardinal ticks (`N`, `E`, `S`, `W`), a thin center cross, the Sun rim tick + direct label, the predicted shadow vector (solid `--accent`), the observed tolerance wedge (translucent `--warm` at `opacity <= 0.2`, no cross-hatching), and the Moon bright-limb arrow only when Moon altitude `> 0`.
- **Table-graphic residual column (C6, emulate Consumer Reports, VDQI p. 178):** In the per-check table (`field`, `observed`, `predicted`, `residual`, `tolerance`, `status`), include a compact inline 1-D tolerance gauge showing `|residual| / tolerance` on a `0..2x` bar with a vertical `1.0x` threshold hairline so the viewer instantly identifies which physical constraint broke the claim.

### Mode 2: Chronolocate (`chronolocate`): Figure 2 (Timeline Track and Solar-Altitude Envelope)

- **Fix the sub-pixel clamping flaw inherited from `sky-dating-widget.tsx` (B1):** When a matching window renders narrower than `2 px` across the search span (up to 370 days), draw a crisp 1 px hairline stem with a top marker tick rather than expanding a filled `<rect>` into a multi-day block. Note `Marks < 2 px wide denote short windows` in the figure caption whenever clamping occurs.
- **Range-frame rails and solar-altitude context (B2, B5, C10):** Replace 4-sided `.trk` boxes with open horizontal range-frame rails anchored at exact `startUtc` and `endUtc`. Draw the solar-altitude envelope as a single thin curve (`1px`, `--line2`) over a labeled `Horizon 0 deg` reference line with range-frame y-axis endpoints (`minAlt..maxAlt`, exact degrees). Do not add a 6-line vertical/horizontal background grid.
- **Horizontal aspect and deconflicted peak labels (Part G, B4):** Target an aspect ratio around `2.5:1` to `3.5:1` (wider than tall, VDQI p. 190). Direct-label the top peak (`Peak: YYYY-MM-DD HH:MM UT`) above the track with horizontal collision staggering if multiple windows cluster.

### Mode 3: Geolocate (`geolocate`): Figure 3 (Equirectangular Fix Plot)

- **Prevent latitude area distortion (B1, Integrity):** On an equirectangular `(lon, lat)` plane, one degree of longitude shrinks physically by `cos(lat)`, so drawing a constant-degree circle for an uncertainty radius `r_km` introduces a `1 / cos(lat)` east-west lie factor (2x at 60 deg, 4x at 75 deg). Project the true spherical equal-distance contour (`d_sphere(lat, lon) = r_km`) onto the `(lon, lat)` canvas so the uncertainty contour stretches realistically east-west at high latitudes, and note `Equirectangular grid (distance contours projected spherically)` beneath the figure.
- **Antimeridian-safe splitting and muted graticule (B5, D-Grid):** Split any contour or band segment crossing `lon = +/-180 deg` (same wrap-split rule as `ephemerisgraph.tsx:96`) so no horizontal scratch shoots across the globe. Mute graticule lines to `60 deg` longitude / `30 deg` latitude hairlines (`0.5px`, `opacity <= 0.35`, strictly lighter than fix markers and sub-solar/sub-lunar tracks), and erase the heavy 4-sided `.pp-frame` box in favor of range-frame degree anchors (`-180..+180`, `-90..+90`, or exact zoomed bounds for `compact`/`point` fixes).
- **Emulate Snow (1854) direct spatial labeling (B4, Part F):** Directly label `Sub-solar`, `Sub-lunar` (Path B only), and `Fix #1` on the plot using short leader ticks if points are close, and carry exact `(lat, lonEast)`, `score`, `uncertaintyKm`, and `regionKind` in the paired C6 candidate table directly below.

### Stage 4 Pre-Merge Acceptance Gate

Before `FACT-001` passes Stage 4 verification, run `tufte-critique` against the rendered SVGs of all three modes (`nyc-summer-authentic`, `tz-shift-spoof`, `hemisphere-moon-spoof`, a multi-window `chronolocate` run, and both Path A and Path B `geolocate` runs). Target:
- Weighted overall score `>= 8.0 / 10` per figure.
- Integrity `>= 8.5 / 10` and Proportionality `>= 8.5 / 10` (zero unflagged lie factors outside `0.95..1.05`).
- Zero active SVG elements and zero em-dashes in all SVG text and captions.
