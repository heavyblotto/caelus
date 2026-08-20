# Encyclopedia widgets and plates plan

2026-08-19

This plan covers interactive widgets and computed plates for the
Encyclopedia of Astrology and the Learning guides (B8): engine-driven
figures that demonstrate, animate, illustrate, and compute in service
of the text. It extends Stream G of
`docs/product/corpus-build-plan.md` and binds to the Encyclopedia
design system (direction 1a, "Plate", from `design-system.zip`,
unpacked to `docs/design/` during the design phase). The derivation
widget, the primary widget, has its own section.

Decisions recorded here are owner decisions of 2026-08-19.

---

## Decisions

- **Plates and widgets are one system.** A plate is the widget's
  resting render: the SSR output of a widget at its initial
  parameters. The build-time figure, the no-JS fallback, the print
  version, and the widget at rest are the same artifact from the same
  code path.
- **Every widget is a pure function of a serializable spec.** One
  schema, `{ kind, params }`, works as an MDX prop, a URL query, an
  embed payload, and MCP `structuredContent`. Same spec, same output,
  on any host.
- **The instant is always explicit.** A widget never defaults to
  "now". The plate renders the article's stated instant. "Set to now"
  is an interaction. This keeps static rendering and hash testing
  trivial.
- **The engine version ships with the figure.** The design system
  states it: a figure that cannot name the engine version that drew it
  does not ship. The revision stamp carries `Figures · caelus 0.25.0`,
  and the harness verifies the stamped version equals the version that
  computed the hash.
- **The reader's chart context is site-wide.** One birth entry,
  stored in the URL hash or localStorage, never sent to a server (the
  Playground pattern). Every widget accepts the override. Anonymous
  readers get the article's example chart.
- **Articles link into the corpus; they do not quote it.** Structure
  and provenance live in the KB, meaning lives in the corpus,
  discourse lives in the Encyclopedia. Direction 1b's "In the
  delineation corpus" block is the surface: cell links, not excerpts.
- **Widget specs are authored inline in MDX and enumerated by an AST
  scan at compile time.** Authors write the component where the figure
  belongs; the scan builds the plate registry mechanically.
- **Engine work lands in the engine.** The 0.25.0 cycle is open on
  this branch for exactly this reason. Geometry or quantities a widget
  needs go into `caelus` first, with golden coverage, rather than
  being approximated widget-side. See "Engine work (0.25.0)".

---

## The plate contract

Every computed figure in the Encyclopedia is a plate: numbered
(`Fig. N`), captioned in apparatus type, framed in a 1px mid rule on
the plate ground, and stamped. The contract per plate:

1. A stable id and a `{ kind, params }` spec that reproduces it.
2. The engine version that computed it, printed in the stamp.
3. A caption that names the configuration (instant, place, house
   system) the way direction 1b does: "Chart for 10 June 1990,
   14:30 UT, Tampa (27.95° N, 82.46° W), Placidus houses."
4. A `reproduce` affordance: the serialized spec as a permalink,
   openable in the Playground (1b's caption link; 1c's
   "Cite · Permalink · JSON-LD").
5. The KB node it illustrates, when one exists, so search and the
   infobox link in both directions.

Interaction adds and never subtracts. Hydration attaches the console
beneath the frame; the resting render stays intact above it and is
what prints.

## The plate registry

Plates are first-class objects in the design system: they carry their
own kind mark beside article, glossary, person, and source; they
appear as search results in their own right ("Fig. 1 · The horizon
axis", located "In Ascendant §1"); and the home page counts them
("468 computed plates"). None of that works from inline MDX alone, so
a registry is built at compile time from the MDX AST scan:

| Field | Contents |
| --------------- | ---------------------------------------------------- |
| `id` | Stable plate id |
| `spec` | `{ kind, params }`, JSON-serializable |
| `caption` | Apparatus text |
| `entry` | Owning entry and section locator |
| `kb` | KB node illustrated, when one exists |
| `engineVersion` | Version stamped at build |

The registry feeds the search index, the plate count, the figure
harness, and the `reproduce` permalinks.

---

## Design system integration

Direction 1a governs. The parts of it that bind widgets:

- **Oxblood is the only interaction channel.** The brief assigns it
  the reader's current place and the highlighted element in a plate.
  A scrubber is a rule with an oxblood index, a picker is a mono list
  with the current item in oxblood, and a selected aspect line is
  oxblood, so the accent keeps a single meaning across every widget.
- **No hover cards, no shadows, no rounded corners, no fills behind
  text.** Notes resolve below the rule. Widget controls read as
  apparatus: IBM Plex Mono labels, frames and rules only.
- **The plate console.** Controls sit beneath the plate frame where a
  caption block sits, as a seventh recurring part of the system: a 1px
  rule carrying the scrub index, mono small-caps station or state
  labels, datum lines in mono (`alt +34° 12′ · az 158° · λ 19°27′ ♊`).
- **The horizon and the ecliptic own the strongest marks.** In any
  plate that shows both, one takes the accent and the other takes the
  heaviest ink line, consistently across every widget.

### Plate theme for `caelus-wheel`

The Encyclopedia shares nothing visually with the developer site: EB
Garamond on warm paper (`#f7f3e9` / `#fdfbf5`), ink `#22201c`, oxblood
`#8c2f2a`, against the site's Instrument Sans on dark with iris and
blossom. Every wheel, sphere, graph, map, and band a widget draws
needs an ink-on-paper theme delivered as tokens, covering all thirteen
default bodies plus points. The developer-site audit's finding 08 (the
light theme redefines seven chart colors and strands the other ten)
is the failure mode this avoids: a theme is complete or it does not
merge. The plate theme is also what the static plates need, so it
precedes nothing and serves everything.

---

## Architecture

- **Package.** `packages/widgets` (`caelus-widgets`, private), peer
  on `caelus`, `caelus-wheel`, and `react`. `caelus-wheel` stays pure
  and hook-free; widgets are the layer that adds state. One subpath
  export per widget kind, the corpus batch pattern, so an article
  loads only the widgets it uses.
- **MDX.** Widgets register globally in `apps/web/mdx-components.tsx`
  (doc pages currently import demos one by one; the Encyclopedia does
  not repeat that). Authors write
  `<W kind="house-comparator" params={{...}} />`.
- **Reader's chart context.** A site-wide provider. Birth data enters
  once, lives in the URL hash or localStorage, computes in the
  browser. Widgets take the reader's chart as a params override, so
  determinism holds: the reader's chart is just params.
- **Embed.** The chart-widget IIFE
  (`apps/web/widget/chart-widget.ts`) generalizes: the loader
  dispatches on `{ kind, params }` instead of assuming the wheel. MCP
  hosts and the iframe fallback get every widget through the channel
  that already ships the wheel.
- **Precision tier.** Browser widgets compute from the embedded data
  tier (~98 KB gzipped); the precise Moon Chebyshev pack stays
  server-side. One shared footnote component states the tier once per
  page instead of repeating the caveat in prose.

### Existing data contracts

The apparatus the Plate design asks for already exists as data
contracts in this repo. Widgets build against them from the start:

| Surface | Contract |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Infobox, node identity | `caelus-kb` node ids (`kb:angle/ascendant`); `parseAtomId` / `parseCellId` in `packages/kb/src/parse.ts` map engine atoms and corpus cell ids to concepts |
| Wikidata rows | `packages/kb/data/wikidata.json` |
| Page JSON-LD | `packages/kb/src/jsonld.ts` |
| Nearest-entries rail | `packages/caelus-corpus/artifacts/embeddings/neighbors.json`: 8 nearest essays per cell id, BGE-M3 cosine, the 1c "Nearest entries" display |
| Corpus cell links | Direction 1b's "In the delineation corpus" block resolves through `parseCellId` |
| Widget parts inventory | The "Parts" section of the Plate design document: entry link, kind marks, note marker, infobox, plate, revision stamp; the plate console joins as the seventh |

### Figure harness

The corpus discipline extended to figures. The harness walks the plate
registry, SSR-renders every spec at its initial params in canonical
mode, hashes the SVG, and compares against committed hashes. It also
checks that the stamped engine version equals the version that
computed the render. A dependency bump that moves a cusp by an
arcsecond is a hash diff. The harness gates in CI beside the corpus
harness: a broken plate fails the build.

Scrub widgets hash at each named station (for the derivation widget,
`t` at `SKY`, `SPHERE`, `ECLIPTIC`, `HORIZON`, `WHEEL`), not only at
rest.

---

## Widget catalog

One widget kind per subject family, parameterized across many
articles, rather than one-off demos per paragraph. The derivation
widget is separate below.

| Kind | What it does | Serves |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `derivation` | Sky to sphere to wheel scrub; the primary widget | Chart, Ascendant, Zodiac, House, tutorials |
| `house-comparator` | One birth through the twelve systems; cusp table with changed placements marked; a latitude slider that walks quadrant systems into polar failure | Houses, house-system guides, FAQ |
| `zodiac-drift` | Tropical and sidereal rings overlaid; ayanamsa picker; century scrubber showing precession widen the gap | Zodiac, ayanamsa, precession |
| `aspect-dial` | Two bodies on a circle; drag the angle; orb shading; applying/separating; a scan for the next exact hit; an orb slider that adds and removes rows from a live aspectarian | Aspect, Orb, aspect tutorials |
| `retrograde-scrub` | `EphemerisGraph` through a station with a time scrubber; heliocentric inset showing the overtake that causes the loop | Retrograde, Station, ephemeris guide |
| `timelord-band` | Profections, releasing, firdaria, and dashas as horizontal bands; click a period for sub-periods; a date field answers which period holds a day | Time-lords, ZR, dasha articles, timing guides |
| `sect-flip` | Day/night toggle flips the Fortune formula and moves the lot on the wheel | Sect, Lot |
| `hours-strip` | A day as a strip colored by hour ruler; void-of-course and electional intervals as shaded bands | Planetary hours, VOC, electional guides |
| `eclipse-finder` | Next N syzygies from a date; the chart of each; 1999 as the canonical instance | Eclipse, Lunation |
| `ephemeris-table` | A printed-ephemeris month table for any month | Ephemerides, tool guides |
| `astro-map` | `AstroMap` for the example nativity or the reader's birth | Astrocartography |
| `star-field` | The sky around a named fixed star; conjunction and paran for a latitude | Fixed stars and parans |
| `degree-lookup` | Longitude in, ordinal degree, face index, sign, and bounds ruler out | Degree symbols, faces (B6 surface) |
| `conversions` | Date to JD and back; decimal to sign/degree/minute and back | Reference apparatus throughout |
| `wheel-anatomy` | Layer toggles build the figure: horizon, zodiac ring, cusps, bodies, aspects | First tutorial, Chart |
| `quiz` | "Click the ruler of the 7th house" on a live wheel; the engine computed the answer, so checking is fact lookup | Learning series checks |
| `shape-sandbox` | Drag bodies freely; the engine classifies bundle, bowl, seesaw live; positions are params, so even the sandbox is deterministic and shareable | Chart shape tutorial |
| `guided-tour` | A wheel that spotlights the element the surrounding prose discusses, by scroll or next button | "Putting a whole reading together" |

Learning-series notes: `wheel-anatomy` opens tutorial one before any
astrology is taught, so the reader learns the diagram before the
doctrine. `quiz` closes each tutorial with two or three checks against
the shared example chart, no answer key to maintain. The clock
interaction on `derivation` (below) is the demonstration that houses
and signs are different kinds of things: the houses spin while the
planets barely move.

---

## The derivation widget

One parameter `t` runs a continuous transformation from the sky at the
birthplace to the finished natal wheel. Scrub in either direction. The
widget explains what a chart is without words; captions are optional
per instance.

### Stations

1. **`SKY`.** The view from the birthplace at the birth instant:
   horizon across the bottom, alt/az geometry, visible bodies,
   constellation lines faint. Some planets are absent: below the
   horizon. A daytime birth shows a day sky, nearly empty. That is the
   first lesson: the chart is not what you could see.
2. **`SPHERE`.** The camera pulls back through and out of the dome. The
   ground shrinks to a dot at the center; the hidden hemisphere swings
   into view. The whole celestial sphere, the horizon a great circle
   slicing it. The missing planets were there all along.
3. **`ECLIPTIC`.** The ecliptic band lights up: the Sun's road, every
   planet on or near it. The twelve sign boundaries draw onto the band
   in the sky, then each body drops a perpendicular tick onto the
   circle. That tick is ecliptic longitude, the number the chart is
   made of, shown as what it is.
4. **`HORIZON`.** The horizon and ecliptic circles cross at exactly two
   points. The eastern crossing pulses: the Ascendant is an
   intersection, not an object. The meridian circle joins and its
   crossing gives the MC. Three circles produce the four angles.
5. **`WHEEL`**, reached through a two-stop settle:
   - *Stop at the ecliptic.* Latitude collapses. Every body slides
     down its tick onto the ecliptic circle until everything lies on
     one great circle, still tilted in space at its true inclination
     to the horizon. The chart now exists, still an object in the sky.
   - *Stop at the horizon.* The disc pivots down to the page and
     rotates in-plane so the Ascendant lands at the left edge. East
     becomes the left side of the wheel, watched rather than asserted.

   Then the furniture: house cusps grow from the horizon and meridian
   points (quadrant systems visibly derived from the crossings,
   whole-sign from the sign boundaries), aspect chords fade in, glyphs
   replace dots, the degree ring labels itself. `t = 1` is the
   standard `ChartWheel`.

### The two characters

The horizon and the ecliptic persist through every frame and nothing
else does. The sky view is horizon-dominant with the ecliptic
implicit; the wheel is ecliptic-dominant with the horizon reduced to
one labeled axis; the morph is the trade between them. Per the design
system, one takes oxblood and the other the heaviest ink line, fixed
across all five stations. Bodies stay grey dots until the wheel
dresses them.

### Geometry

One pure function, `render(chart, t, options) → SVG`. `t` drives:

- a camera path: inside the dome at `t = 0`, orthographic exterior
  above the ecliptic north pole by the settle;
- a lens continuum for the pullback's first phase: the view widens
  through the documented `skyView` presets, rectilinear (gnomonic)
  giving way to equidistant fisheye past about 100°, exactly as the
  presets already encode; then the camera exits the sphere and the
  projection crosses to exterior orthographic;
- a flatten factor in ecliptic coordinates: each body at (λ, β)
  interpolates to (λ, 0);
- a page rotation carrying the Ascendant to the left edge;
- opacity ramps for furniture: stars out early, sign boundaries in at
  `ECLIPTIC`, houses, aspects, and glyphs in at the settle.

No wall-clock state anywhere: the scrub position is the state, easing
curves are functions of `t`, and `prefers-reduced-motion` costs
nothing because user-driven scrubbing is the primary mode; only
autoplay is gated.

Two geometric decisions, made deliberately:

1. **Handedness.** The sky view is from inside the sphere; the wheel
   reads as the exterior view above the ecliptic north pole, where
   longitude runs counterclockwise. The mirror flip (the celestial
   globe reversal) happens during the pullback, where the eye forgives
   it: the camera exits on the northern side of the ecliptic, the
   sphere renders as glass with the bodies visible through it, and the
   horizon disc anchors continuity. The settle then lands in standard
   wheel handedness with no late flip.
2. **The coordinate handoff.** The morph changes systems (horizontal
   to ecliptic) at `ECLIPTIC`. The camera reorientation rides on the
   tick-drop moment that motivates it, not before.

### SkyView grounding

The engine already carries most of this widget (`docs/skyview.md`,
`packages/caelus/src/skyview.ts`, golden-pinned against the Python
reference):

- **The inside camera exists**: aim-to-camera basis with no-roll
  horizon handling and zenith fallback, gnomonic and equidistant
  fisheye projections, refraction, the horizon row.
- **Station `ECLIPTIC`'s furniture is engine output**: the `overlays`
  option returns the ecliptic line, the twelve sign divisions, house
  cusps and angles, and constellation figures, precessed, with the
  constellation pack bundled in the browser tier. The widget renders
  polylines the engine computed; its annotation layer is engine data.
- **The clock is built**: every result carries the celestial pole
  and the rotation rate (15.041°/hour about the pole);
  `skyViewSequence` steps time coherently; the Playground Sky View tab
  already has the play/scrub control. During the time drag the pole is
  the one point that does not move, worth its own mark.
- **Photometric honesty is available**: twilight state, limiting
  magnitude, the sky-brightness gradient, Moon bright-limb
  orientation. In the plate theme this reduces to engraving decisions
  (star marks present or absent, a twilight datum in the console); in
  the Playground's dark theme the sky tone can follow `skyBrightness`.

What the widget still needs from the engine is listed under "Engine
work (0.25.0)" below: vector-mode projection exports and the
fisheye-to-orthographic continuation.

### Console and interactions

The rail sits beneath the frame: a 1px rule with an oxblood index and
five ticks labeled `SKY · SPHERE · ECLIPTIC · HORIZON · WHEEL` in mono
small caps. Snap to station on release, free scrub while dragging,
autoplay as a single mono `▸`. Station captions in apparatus type are
optional per instance.

- **Follow one body.** Tap any body; it holds its highlight through
  the whole morph, its projection tick stays drawn, and its datum line
  runs in the console:
  `alt +34° 12′ · az 158° · λ 19°27′ ♊ · β +1°02′`. One planet
  followed from a dot above the horizon to 19°27′ Gemini in the
  eleventh is the explanation of what a chart coordinate is.
- **The clock.** A time nudge at every station. At `SKY` the dome
  rotates. At `HORIZON` the Ascendant crawls a degree every four
  minutes: the argument for birth-time accuracy, made kinetically. At
  `WHEEL` the houses spin while the planets barely move.
- **The latitude drag.** Pull the birthplace north at `SPHERE` and the
  horizon circle tilts; keep pulling and the ecliptic-horizon
  intersection degenerates above the arctic circle. The polar-failure
  passage in the Ascendant article takes its figure from this widget
  frozen mid-drag.
- **Free orbit.** Drag to orbit within constraints at any station;
  release returns to the scrub-defined camera. The scrub owns the
  canonical view.
- **Skyline (Playground layer).** `horizonProfile` renders the
  reader's actual obstructions at `SKY` with `occluded` bodies marked;
  the scrub then shows the chart never cared about the rooftops.

### As the default chart view

Resting state is the wheel at `t = 1` with the rail beneath it. The
wheel arrives with its derivation attached, one scrub away. First
encounter per session autoplays the forward journey once (gated by
`prefers-reduced-motion`), then rests at the wheel. Scrubbing left
unfolds the chart back into the sky. Every chart surface can carry it:
Playground, article figures, and the embed, since the spec
`{ kind: "derivation", chart, t, focus }` travels the existing
channel.

### One widget, many plates

Frozen stations are plates in the registry, differing only in `t` and
`focus`:

| Frozen at | Fig. 1 of |
| ------------------- | -------------------------------------- |
| `SKY` | The sky, Celestial sphere |
| `SPHERE` | Celestial sphere, Angularity |
| `ECLIPTIC` | Zodiac, Ecliptic, Sign |
| `HORIZON` | Ascendant, Midheaven, Angle |
| Settle, first stop | Obliquity, ecliptic inclination |
| `WHEEL` | House, Chart, the first tutorial |

The Learning series references stations of this one object instead of
introducing new diagrams, so the reader meets one figure repeatedly
rather than twelve unrelated figures once.

### Name

Component `ChartDerivation`; rail label `DERIVATION`; "the derivation
view" in prose. The register is an instrument label, not a brand.

---

## Engine work (0.25.0)

The 0.25.0 cycle is open on this branch and is the vehicle for
engine-side widget work, the same way it already carries the seven
fact kinds the later corpus families bind to. Additions follow the
existing release gates: CHANGELOG Unreleased entry, doc pages, golden
coverage, and, where the math sits in the skyview module, the Python
reference mirrored and pinned by the skyview-golden suite.

- **Runtime version export.** Done: `caelus` exports `VERSION` from
  `src/version.ts`, asserted equal to `package.json` by
  `check-versions.mjs`, so stamps never import package metadata into
  browser bundles. CHANGELOG carries the Unreleased entry.
- **Vector-mode projection API.** Export the camera-basis and
  projection functions from `skyview.ts` as public API: aim to camera
  basis, gnomonic and equidistant fisheye forward projections, and a
  resolution-independent output (normalized coordinates rather than
  pixels). `skyView` keeps its pixel API for image prompts; the
  widgets consume the same math underneath. Canonical mode already
  covers the module.
- **The radial projection family.** One parameterized family that
  continues equidistant fisheye through 180° to exterior orthographic,
  so the derivation widget's pullback interpolates a single variable
  through a tested engine function instead of blending projections
  widget-side. Both endpoints are radial projections; the family
  belongs beside them in the engine.
- **Ecliptic-frame helpers.** The flatten interpolation works in
  ecliptic coordinates (λ, β to λ, 0). Whatever conversion or
  great-circle helpers the widget needs beyond what `chart` and
  `skyView` already expose land as engine exports, not widget math.
- **Star-field quantities.** The Encyclopedia's fixed-star row asks
  for catalog position, magnitude, conjunction, paran, and the sky
  around a star. Anything in that list the engine does not yet expose
  publicly ships engine-side with reference coverage before the
  `star-field` widget draws it.
- **Anything else a widget kind surfaces.** The rule generalizes: a
  widget that wants a quantity is a request for an engine export. The
  widget layer contains projection state, interaction, and SVG, and no
  astronomy.

---

## Named instants and historical charts

Shared example charts keep figures consistent from article to article
(`apps/web/lib/sample-chart.ts` already fixes Tampa 1990-06-10
14:30 UT and a 2026-06-13 target). The widget system formalizes this
as a named-instant registry: the example nativity, the 1999 eclipse,
and other stated instants, each a fixed spec. "The sky now" is the
one non-fixed instant and is excluded from hashing.

The Valens set extends the registry with a historical stream, already
present in the design mockups: 130 of Valens' example charts
recomputed from his stated data, each openable as a plate, each
carrying its source citation (Neugebauer & van Hoesen, *Greek
Horoscopes*, for the dating) and the engine version stamp. Per-chart
source data lives beside the spec so the recomputation is auditable.

---

## Verification

- **Figure harness** (above): registry-driven canonical-mode hashes,
  stamp-version check, CI gate beside the corpus harness. Scrub
  widgets hash per station.
- **Registry counts** feed the site (plate count, per-entry plate
  lists) and are asserted in the harness, so a plate that falls out of
  the registry is a build failure, not a silent omission.
- **Prose**: captions and console labels pass the root prose gate
  (`npm run lint:prose`); new technical vocabulary lands in the Vale
  accept list.
- **Specs**: every `{ kind, params }` in the MDX corpus validates
  against the typed union at build time.
- **Engine**: widgets make no fact claims beyond engine output. New
  engine surface (the vector projection API, the radial family, any
  star-field quantities) lands in the open 0.25.0 cycle with golden
  coverage and, for skyview math, the Python reference mirror. The
  skyview-golden suite already pins the camera math the derivation
  widget reuses.
