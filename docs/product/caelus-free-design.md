# Caelus Free — application design

## 0. Definitions

Terms used with a fixed meaning throughout. Astrological terms a reader
meets are glossed in the product itself (§4.1); these are the ones this
document needs.

| Term | Meaning here |
|---|---|
| Hub | One of the five top-level destinations (§4.3) |
| View | A named surface inside a hub, separately addressable |
| Instrument | A rendering surface reused across hubs, holding its own selection |
| Mode | A global switch changing what several surfaces compute |
| Store | Client-side state outliving a navigation |
| Atom | One computed fact the engine emits, with an id a reading can cite |
| Reading | Prose fired from the corpus over a chart's atoms |
| Orb | How far from exact an aspect is, in degrees |
| Domain state | A condition of the data itself, not an error (§4.6) |
| Alive | The state of being current or exact, marked in peach (§4.8) |
| Simplified default / explanation / advanced | The three layers of §4.1 |
| Person | A saved birth record; the unit the people store holds |
| Artifact | Anything shareable: a chart, a reading, a window, an entry |

## 1. What this is for

Caelus Free is the consumer face of an astrology engine. It exists to
**prove the engine and to distribute it**. It is free, it has no paid tier,
it has no account, and it is not being sold. There is no conversion to
optimise and no revenue to grow.

That is not a softer goal than a commercial one. It is a harder one, because
it removes the usual instruments.

**What proving the engine means here.** The engine is already correct;
thousands of golden checks say so against two reference implementations.
What is unproven is that correctness is *reachable* — that a person can
arrive knowing only their birthday and come away with something true, and
that a person who knows the field can check the work and find it sound. An
engine nobody can reach proves nothing.

**What distributing it means here.** Every capability has a surface, every
artifact has an address, and everything is portable: a link, a file, a
prompt, an API, an MCP server. The product is a way for the engine to be
used by people and by their machines.

### 1.1 What success looks like, and why it cannot be measured

Success is that the product is **correct, reachable, honest and complete**.

- **Correct** — every figure traces to the engine, every sentence to the
  atoms under it, every convention named.
- **Reachable** — a stranger gets value in thirty seconds; an astrologer of
  twenty years finds the depth without being condescended to.
- **Honest** — what is unknown is said, what is a convention is labelled,
  and nothing is fabricated to fill a gap.
- **Complete** — every job in §3 has a path, and the depth that exists is
  exposed rather than hidden.

**None of that can be observed.** The privacy promise means no telemetry: no
funnels, no session recordings, no A/B tests, no retention curves. This
product cannot watch its users, and it should not want to.

**So quality is assured by construction, not by observation.** That is the
single most important consequence in this document, and it is why §14 is not
a formality:

| Ordinarily assured by | Here assured by |
|---|---|
| Funnel analytics | Flow tests walking every path in §12 |
| Session recordings | A person opening it, per §14.8 |
| A/B tests | A stated design rule (§4) that can be argued with before it ships |
| Bug reports from users | Gates that fail the build (§14.6) |
| Support tickets | Errors that name what still works (§20) |

A product that cannot measure itself has to be right on purpose. Everything
below follows from that.

## 2. Users

**The curious non-astrologer.** Knows their Sun sign. Has met the word
"rising." Does not know their birth time and is unsure it matters. Arrives
from a link or a search, on a phone. Gives the product about thirty seconds
to prove it is not a horoscope site. Wants something specific and true about
themselves, then about someone they know.

**The astrology-literate reader.** Knows houses and aspects. Has used
astro.com or Solar Fire. Arrives because someone said the math is good.
Wants depth, named conventions, and to check the work. Judges the product in
the same thirty seconds, on the opposite criterion: whether it is a toy.

**The maker.** Writer, worldbuilder, game designer, artist. Arrives for
Chart Lab and the Composer. Wants charts for things that are not people, and
provenance on every symbolic claim.

Neither of the first two is ranked above the other. They share one surface
with no separate mode, skin, or route. What differs is the default: the
non-astrologer's path is the default, and the literate reader changes it in
one action that is remembered. The maker enters through Chart Lab and
inherits the same chart surfaces.

**Out of scope: the professional with a client load.** Client management,
report generation, billing.

## 3. Jobs

| # | Job | Done when |
|---|---|---|
| 1 | Show me my chart | A drawn wheel and three true sentences, from a birth date alone |
| 2 | What does that mean | Any element on a chart explains itself in place |
| 3 | What is happening to me now | Today, personal, with start and end dates |
| 4 | What about me and them | Two charts, named dimensions, no score |
| 5 | What is coming this year | One timeline carrying transits, progressions, returns and time-lord periods |
| 6 | When is a good day | A date with the reason attached |
| 7 | I do not know my birth time | A narrowed window, honestly bounded |
| 8 | Where should I go | Cities, with what changes at each |
| 9 | Keep what I write | An entry that remembers the sky it was written under |
| 10 | Show me everything about X | One place gathering every fact, entry, person and event touching X |
| 11 | Cast a chart for something that is not a person | A chart from constraints, a fiction, or a sentence, with its provenance |
| 12 | Ask my AI about this | A deterministic prompt carrying real facts, and a way to check the answer |
| 13 | Check your math | Conventions named, sources cited, accuracy published |

Jobs 1–3 are first contact. 4–8 are the product. 9–13 are why it is not
replaceable.

**Coverage is measured by jobs with paths, not by capabilities with
surfaces.** A capability with no path into it from a job is not covered.

## 4. Design rules

### 4.1 One surface, three layers

`ux-patterns.md` §3 and §10.3: **one wheel, layered three deep — simplified
default, tap-to-explain, advanced toggle. Beginners and experts share one
URL.** TimePassages is the named reference for tap-to-explain, and the
finding is explicit: one screen serves both *via tap, not modes*.

Two mechanisms, and they are not the same thing.

**Tap-to-explain** carries meaning. Any element — planet, house, aspect,
pattern, period, line on a map — opens a plain-language card in place. This
is always available to everyone and is never behind a setting.
`ux-patterns.md` §10.4 calls the general form of this — every number gets a
sentence, every sentence can show its numbers — the single biggest open
opportunity in the category.

**The advanced toggle** carries density, not meaning. A persistent settings
drawer (`websites.md` §c) controlling what is drawn and how precisely:
degrees and minutes rather than rounded degrees, minor aspects, the house
system and ayanamsa switchers, midpoints, declinations, harmonics, antiscia,
sectors, directions and their time keys, the deep star pack, heliocentric
and topocentric positions.

| Layer | Contains | Reached by |
|---|---|---|
| Simplified default | Big three, major aspects, plain-language reading | Arriving |
| Explanation | What any element means, named and glossed | Tapping it |
| Advanced | Precision, minor bodies, alternate conventions, research views | The settings drawer, which persists |

Rules:

1. Nothing requiring a birth time appears in the simplified default.
2. Explanation is never gated behind the advanced toggle. Meaning is not a
   power feature.
3. **Progressive precision** (`ux-patterns.md` §6): degrees round by default
   and are exact in advanced. The same number, not a different one.
4. A reader who has never opened the drawer can still reach every
   explanation in the product.

### 4.2 The honesty budget

One honesty statement per screen in the simplified default. The rest live in
explanations and in advanced. The one that survives in the default is the one
that changes what the reader should believe.

The two privacy lines are exempt and always in the default: "Computed here
on your screen." and "Written here, kept here."

### 4.3 Navigation

**Five hubs, predictable nouns, identical on web and mobile.**

> Today · Chart · People · Tools · Learn

Bottom tabs on mobile, top nav on web, same five words. The count and the
labels come from `research/ux-patterns.md` §2, whose finding is that hubs
must be predictable nouns: the CHANI case study records users unable to
re-find readings behind poetic labels.

**Chart is the workspace, not a page.** One engine, one form, every chart
type, reached by a type switcher inside Chart rather than by separate
routes: natal, transit, progressed, solar arc, return, composite, Davison,
relocated, harmonic, draconic, synthetic
(`research/websites.md` §d.1). The chart page is also the person hub
(`ux-patterns.md` §2).

Everything that was a hub and is not one of the five lives inside one:

| Was | Now |
|---|---|
| Times | Chart's timeline view, and the Timeline instrument on Today |
| Places | Chart's map view |
| Journal | Its own hub only if it earns one; otherwise Today's writing surface |
| Lab | A chart type inside Chart |
| Connect | Inside Learn, beside methods and validation |
| Graph | Reached from any node, not from the nav |

Every destination also has an entry point from the thing that raises the
question: the map from a chart's angles, an explanation from a square, the
timeline from a transit card.

### 4.4 State lives in the URL

Chart state is addressable. `research/websites.md` §c names this "the single
best pattern in the category." Every chart, every view, every setting that
changes what is shown is recoverable from the address, so any state can be
shared, bookmarked and reopened without an account.

### 4.5 Time is scrubbable

Computation is client-side, so the wheel recalculates and animates as a date
is dragged, rather than reloading a page. `research/websites.md` §d.2 names
live date-scrubbing as the category-first differentiator that client-side
computation buys and every incumbent lacks. `ux-patterns.md` §4 records the
same pattern on transit surfaces as the leading product's core innovation:
transits are periods you are inside, not daily fortune cookies.

The scrubber appears wherever time is a variable: Today, the timeline, the
wheel, the map.

### 4.6 Domain states

Unknown birth time, ambiguous or nonexistent local time, pre-1500 dates
where delta-T smears the angles, polar latitudes where Placidus falls back,
bodies outside their fitted range, and positions computed outside the
validated span. One component, one register, one placement.

A domain state is reported where its consequence lands, in plain words,
saying what remains true rather than what is missing. "Your rising sign
needs a birth time" sits where the rising sign would have been, not in a
list at the top of the page.

### 4.7 Value moment

A reader who knows only their birth date reaches a drawn chart with
something true said about it in under fifteen seconds, with no account and
no birth time.

### 4.8 Visual identity

**One lane: the almanac. Dark ground primary, light secondary.** One stock,
one ink, one accent, in two themes made of the same materials.

**Peach blossom is extraspectral, and that decides the ground.** No single
wavelength produces it; the eye constructs it from both ends of the spectrum
at once. That is why it marks what is alive, and it is why the value is not
tunable: darkening it until it passes a contrast ratio on cream keeps the
swatch and throws away the idea.

Measured: `#dd6ba1` is **5.82:1** on the dark stock and **2.78:1** on cream —
failing not only the 4.5 for text but the 3.0 for non-text marks. The cream
stock fights the one colour in the product that carries meaning. So the dark
ground is where this identity lives, and the light theme is the secondary
one.

| | Dark (primary) | Light |
|---|---|---|
| Peach | Carries text and marks alike | Marks only: border, tint, halo |
| Labels on an alive element | Peach | Ink |
| Everything else | Identical materials, inverted |

The rule this produces: **an alive element is colour, glow and tinted
surface — and on cream the colour is carried by the border and tint while
ink carries the words.** Never colour alone, and never colour illegibly.

`ux-patterns.md` §12.7 is to pick one opinionated visual lane and systematize
it, with real light *and* dark themes, and §7 names the saturated genre
cliche precisely: *soft purples, cosmic blues, starry gradients plus a
high-contrast serif*. The two-lane scheme this product shipped had a
twilight lane built from `#0e0b22`, `#171233`, `#2c1e52` and `#4a3272` — a
purple gradient — under a serif display face. That is the cliche as
described, and it is the half of the identity that is not differentiated.

The almanac half is. Cream stock, ink, hairline rules, tabular numerals: the
printed ephemeris is the actual historical artifact this product descends
from, no one in the category owns it, and it is the visual argument for a
product whose differentiator is rigour. It reads as a reference work rather
than a horoscope, which is the positioning.

| | Light | Dark |
|---|---|---|
| Ground | Cream stock | Warm near-black, the same paper unlit |
| Ink | Near-black, warm | Cream |
| Rules | Warm grey hairlines | The same, inverted |
| Alive | Peach blossom, print weight | Peach blossom, screen weight |

The dark theme is the almanac at night, not a different genre. Nothing in
the chrome is purple.

**The sky is exempt, because it is data.** Where the product draws the
actual sky — the onboarding stage, the Planetarium, the dome and sphere
projections — it renders the real thing, and a real twilight is violet. That
is a measurement, not decoration. The rule applies to chrome, type, surfaces
and controls; it does not apply to a rendered sky.

**Aspect colour keeps classical semantics** (`ux-patterns.md` §7): red for
hard, blue for soft, element colours where elements are shown. Experts read
these fluently and the product should not invent its own.

**Glyphs are a custom thin-line set**, never a system font.

### 4.9 Provenance

Every symbolic claim carries its kind: documented correspondence, empirical
measure, or labeled invention. An invention is never presented as doctrine.
Every reading sentence resolves to the atoms it rests on.

## 5. Architecture

Four kinds of thing. Confusing them is what produces a flat nav in which a
mode, an instrument and a workspace sit as peers beside a hub.

- **Hubs and views** — the five hubs and the views inside them. §5.
- **Instruments** — reusable rendering surfaces appearing across hubs and
  holding their own selection state. §6.
- **Modes** — global switches that change what several surfaces compute and
  render, without moving the reader. §7.
- **Stores** — client-side state that outlives a navigation. §8.

### 5.1 Platform

The app installs to a home screen and runs offline. Every surface that renders
from a saved chart works with no network: the engine, the corpus and the
gazetteer are on the device. Surfaces needing a network say so before they
need it.

Calendars are subscribable, not only downloadable: void-of-course hours,
eclipses, retrogrades and a reader's own query windows publish as feeds a
calendar app can follow.

Every artifact has a stable address: a share link carrying the artifact
itself, a card image for it, and an open-graph image for the link.

## 6. Hubs and their views

Five hubs (§4.3). Everything else is a view inside one of them, reached by a
switcher, a tab, or the element that raises the question. Every view is
addressable (§4.4).

### 6.1 `/free` — the door

**No saved person:** the sky, and a headline completing as a birth date is
typed. Birth entry staged as the making of a chart rather than a form, three
to four steps, city autocomplete, no account (`ux-patterns.md` §1, §12.1).
The primary action draws the chart.

**A saved person:** Today for that person.

### 6.2 Today — the sky now

The mundane sky, readable with no birth data: transiting patterns, stations,
Moon phase and sign, void hours, planetary hour, solar conditions.

Then the personal stack: one transit per card, relevance-ranked, plain
headline, expandable to the geometry, each carrying a duration bar with orb
entry, exact passes including retrograde re-hits, and exit. A date scrubber
moves the whole stack backward and forward (§4.5).

The your-year strip: profection lord, active dasha, firdaria and releasing
periods. The coming-up feed: ingresses, stations, lunations, eclipses with
local visibility. The writing surface, if the Journal has not earned its own
hub.

### 6.3 Chart — the workspace and the person hub

One engine, one form, every chart type. The type switcher selects what is
cast; everything below adapts.

**Chart types:** natal · transit (bi-wheel) · progressed · solar arc ·
return (any body, any number) · composite · Davison · relocated · harmonic ·
draconic · synthetic and composed (from Lab).

**Views over whichever chart is cast:**

| View | Contains |
|---|---|
| Wheel | The wheel, tap-to-explain on every element, two-way highlight with the placements list, pattern badges, the paired sphere with its flatten |
| Reading | Salience-ranked, grouped, cited; every sentence resolves to its atoms |
| Data | Placements as a card index with a dense-table toggle; aspects as sentences sorted by strength; aspectarian; dignities with sect, score and almuten; lots; declinations and parallels; out-of-bounds; fixed stars and parans; midpoints |
| Timeline | Transit duration bars against natal points, progressed lanes, time-lord lanes, sky markers, the You lane, zoom and scrub |
| Map | Astrocartography lines with tap-for-meaning, the relocated chart beside them, offered cities in geographical order, parans, local space |
| Lab | Constraints to chart; fictional and mythic anchors; what-if; similar skies; the Composer with its hierarchy, time registry, grounding, residual and motif ephemeris; invented-sky systems |
| About | Conventions in force, capabilities, ranges, the chart digest, prompt packs, share and export |

Chart is also the person hub: the current person, their tags, and the
switcher live here.

### 6.4 People — relationships

The library: unlimited saved charts, tags, a persistent switcher carried
across every hub (`websites.md` §c). The relationship reading in named
dimensions, each expandable to the exact inter-aspects, with a named quality
and never a score (`ux-patterns.md` §5). Overlays both ways. The bi-wheel
one tap deeper. Composite and Davison open as chart types in Chart. The
what-if explorer for the pair.

### 6.5 Tools — instruments that are not about one chart

Date finder over a criteria builder, results on a timeline rather than in a
table (`websites.md` §d.7). Power query. Calendars for any year: retrogrades
paired station to station, ingresses, stations, lunations, void hours, each
exporting and subscribable. Eclipse catalogue with local circumstances and
path maps. Ephemeris tables. Visibility almanac. Gauquelin sectors. Horary
with its considerations before judgement. The Planetarium (§6).

### 6.6 Learn — explanation, trust, and portability

Glossary. Guides and reading series. One page per corpus cell, each a
calculator and an explainer deep-linking into the workspace with presets
(`websites.md` §c). Tool walkthroughs. Methods, validation, provenance and
published accuracy. Prompt packs, the citation checker, MCP setup and the
public API.

### 6.7 The graph

Not a hub. Reached from any node — a planet, a house, a person, an event, a
symbol — as "everything about this": placements, transits, entries, events,
people, symbols, tutorials. Drawn radially around the natal wheel. Computed
edges are facts; inferred edges are visibly suggestions until accepted.
Exports as JSON-LD.

### 6.8 The Journal

One entry store, many lenses. Every entry is text plus a timestamp plus an
automatic sky-pin: chart digest, active transits, Moon phase, profection
year, planetary hour. An entry written in any format appears in every lens.

Three formats: the commonplace book indexed by the natal wheel; the
sequential journal whose chapters run lunation to lunation and whose volumes
close at each birthday under their profection lord; the headless stream that
asks nothing and re-projects afterwards.

Over the store: prompts from the strongest current transit, behind a gentle
affordance and never a gate. Sealed eclipse letters. Marginalia attached to
atom ids. Retrospectives by transit recurrence and by sky similarity. A
People lens. The annotated corpus: an on-device track carrying sentiment,
topics, entities, style and embeddings, versioned by analyzer, giving
descriptive correlations that show their counts and never assert causation.

Whether this is a sixth hub or a surface inside Today is open (§13).

### 6.9 Cross-cutting

| Surface | Reached from |
|---|---|
| Person switcher | Every hub |
| Settings drawer | Every hub; persistent; presets Modern / Traditional / Vedic / Uranian, global with per-chart overrides |
| Birth-time finder | Where the rising sign would be, and from Chart |
| Share | Every artifact: a link carrying the state, a card image, a file |
## 7. Layouts

Wireframes in text. Each is the phone layout first, because that is where
the primary user arrives, with the wide variant noted after. `[ ]` is a
control, `( )` a computed region, `>` an affordance that opens something.

### 7.1 `/free`, no saved person

```
+------------------------------------------+
|  Caelus Free                         [=]  |   chrome: 56px, nav in [=]
+------------------------------------------+
|                                          |
|   There is more going on than your       |   display serif, 2 lines max
|   sign.                                  |
|                                          |
|   +----------------------------------+   |
|   |                                  |   |   the sky: 1:1 on phone,
|   |   ( live sky, drawn )            |   |   16:9 wide. Renders BEFORE
|   |                                  |   |   any input: stars, horizon.
|   +----------------------------------+   |
|                                          |
|   [MM] [DD] [YYYY]                       |   44px targets, no clipping
|                                          |
|   [ Show me my sky ]                     |   primary, full width phone
|   Computed here on your screen.          |   the one honesty line
+------------------------------------------+
```

The sky is drawn before the reader types. Its state responds as they do:
the Sun glyph resolves into the headline once the year is known. Nothing
below the fold on a 640px viewport.

Wide: the sky moves right, headline and inputs left, same order in the DOM.

### 7.2 Chart, populated, phone

```
+------------------------------------------+
|  < Ada Lovelace  v        [natal v]  [=] |   person switcher, type switcher
+------------------------------------------+
|   ( wheel, square, edge to edge )        |   tap anything -> 5A.4
|                                          |
|   Sun in Sagittarius  ·  10th            |   the big three, as chips
|   Moon in Aries  ·  1st                   |
|   Capricorn rising                       |
+------------------------------------------+
|  [Reading] [Data] [Time] [Map] [Lab]     |   view tabs, sticky
+------------------------------------------+
|   ( reading: sections, essays )          |
|   > see where this comes from            |   per essay
+------------------------------------------+
```

Wide: wheel left at 60%, the current view right at 40%, both scrolling
independently. The view tabs move to the top of the right column.

### 7.3 Today, phone

```
+------------------------------------------+
|  Today            Fri 16 Aug     [<->]   |   [<->] is the date scrubber
+------------------------------------------+
|   ( moon phase glyph )  Waxing crescent  |
|   Moon in Libra, void from 14:20         |
+------------------------------------------+
|   ( transit card )                       |   one transit per card,
|   Saturn square your Sun                 |   ranked by salience
|   |------====*=======-----|              |   duration bar: in, exact, out
|   3 Aug  ·  now  ·  2 Sep                |
|   > what this means                      |
+------------------------------------------+
|   ( next card )                          |
+------------------------------------------+
```

Dragging the scrubber recomputes every card and moves the now-marker on
every bar, without a page load (§4.5).

### 7.4 The explanation card

Opened by tapping any element anywhere in the product. The same component
every time.

```
+------------------------------------------+
|  Saturn square Sun                   [x] |
|                                          |
|  ( plain-language paragraph )            |   the corpus essay
|                                          |
|  Saturn 14 Cap 22  ·  Sun 12 Ari 09      |   the numbers behind it
|  Square, 2.2 degrees from exact          |
|                                          |
|  > why this matters   > see the geometry |
+------------------------------------------+
```

Phone: a sheet from the bottom, half height, draggable to full. Wide: a
panel in the right column, replacing the current view until dismissed.

**This is the single most-used component in the product** and every job
except 1 and 13 passes through it.

### 7.5 Empty states

The shape every empty state takes, per §11.2.

```
+------------------------------------------+
|   ( the instrument, drawn with the       |   NOT a blank panel: the map
|     sky or the world, but not yours )    |   draws, the timeline draws
|                                          |
|   Add a birth date and this becomes      |   one sentence, what it becomes
|   yours.                                 |
|   [MM] [DD] [YYYY]  [ Draw it ]          |   the action, in place
+------------------------------------------+
```

No empty state is a paragraph pointing at another screen.

### 7.6 Layout rules

1. The instrument is the first thing on the screen. No hub opens with a
   headline announcing which hub it is.
2. One primary action per screen, full width on a phone.
3. Touch targets 44px minimum; the birth-date fields sized to their content
   plus padding, never to the placeholder.
4. Anything wide — aspectarian, ephemeris, dense tables — scrolls inside its
   own container and never the page.
5. The wheel is square and sized to its container; labels collapse to glyphs
   below 360px.
6. The reading moves from the right column to below the wheel at the phone
   breakpoint, and its DOM order does not change.

## 8. Instruments

Reusable surfaces holding their own selection state, appearing across hubs.

| Instrument | Renders | Appears on |
|---|---|---|
| **Wheel** | Any chart, 12 house systems, aspect lines, pattern overlay | Chart (every view), People, Journal index |
| **Sphere** | The celestial sphere, tilted, turnable | Chart, Planetarium, Lab |
| **Paired view** | Wheel and sphere with one selection and a flatten animation | Chart, Lab, Composer |
| **Multi-wheel** | Up to four charts in rings, contacts in the core | Chart (transit, progressed, return types), People |
| **Timeline** | Lanes of spans and markers, zoom and scrub | Chart timeline, Today, Journal, Lab outline |
| **Map** | Astrocartography lines, parans, local space, tap for meaning | Chart map |
| **Planetarium** | The sky from where you stand, or the sphere from outside. Three sources as combinable layers with per-layer opacity: the real sky, imagined systems, the Composer sky. Lens presets, time scrub, twilight and limiting-magnitude physics, AI image prompts describing whatever mix is showing | Tools, Lab, Journal |
| **Graph** | Nodes and typed edges, wheel-radial layout, ego queries | Graph, Chart, People |
| **Data table** | Card index by default, dense table on toggle, tabular numerals | Chart data, Tools, Lab |
| **Share card** | Story-ratio image from a chart digest | Every artifact |

A selection made in one instrument is reflected in every instrument sharing
the surface.

## 9. Modes

Global switches. A mode changes what several surfaces compute and render; it
never moves the reader, and it is always named on screen.

| Mode | Values | Affects |
|---|---|---|
| **Zodiac** | Tropical, or sidereal with one of seven ayanamsas | Every chart, every reading, the corpus fired |
| **Vedic** | Off, or on | Sidereal zodiac, nakshatra cards with padas and lords, dasha timelines (Vimshottari, Yogini, Ashtottari) in the Chart timeline, divisional charts with D9 headline, yoga cards with their defining rule shown, and North or South Indian square chart rendering |
| **House system** | 12 | Every house-dependent reading; the polar fallback is surfaced |
| **Orb profile** | Preset or custom | Aspects, patterns, transit durations |
| **Body set** | Preset or custom | Every chart |
| **Advanced** | Off, or on | Precision, minor bodies, alternate conventions and research views on every surface (§4.1) |

Modes are global with per-chart overrides. Two surfaces rendering the same
chart use the same conventions, or they disagree silently.

## 10. Stores and data

All client-side. No network. No account.

| Key | Shape | Written by | Read by |
|---|---|---|---|
| `people` | `{v, people[{id, name, birth{t, la, lo, timeKnown}, tags}], currentId}` | Birth form, person switcher | Every surface |
| `settings` | Modes and per-chart overrides (§7) | Settings, disclosure control | Every reading surface |
| `journal` | `{v, entries[{id, text, at, skyPin, personId, houseFiling, annotations}]}` | Journal | Journal, Chart timeline, Graph |
| `graph` | Nodes and edges over the other stores, plus accepted suggestions | Graph | Graph, Chart, People |
| `lab` | Composed charts, synthetic systems, saved forms | Lab | Lab, Planetarium, Journal |

### 10.1 The chart's path

```
keystroke → birth form → toUT (tz, DST, ambiguous/nonexistent)
         → validate → person record → people store → currentId
         → every surface reads the store
```

Every screen that collects a birth writes through this path. Every screen
that needs a chart reads the store. No screen holds birth data in component
state across a navigation. There is one birth form with one implementation.

### 10.2 Privacy

No store leaves the device. No network request carries birth data, entry
text, or analysis output. Geocoding is served by the offline gazetteer;
the network geocoder is opt-in and attributed.

## 11. States

### 11.1 App states

| State | Meaning |
|---|---|
| `none` | No saved person |
| `one` | One saved person, current |
| `many` | Several saved people |
| `no-time` | Current person has no birth time |
| `partial` | Data entered, not yet valid |

### 11.2 Screen states

| State | Rule |
|---|---|
| `empty` | Offers the action that fills it, in place. Never sends the reader to another screen. |
| `loading` | Says what it is computing, in plain words. |
| `error` | Says what failed and what still works. |
| `partial` | Renders what is known; domain states per §4.6. |
| `populated` | The full surface. |

### 11.3 Hubs and views by app state

| Surface | `none` | `no-time` |
|---|---|---|
| `/free` | Onboarding sky, birth entry | Today, clock-dependent cards suppressed |
| Today | Mundane sky, with an offer to personalise in place | Mundane plus non-clock personal cards |
| Chart / wheel | Birth form, in place | Wheel drawn; the finder offered where the rising sign would be |
| Chart / reading | Birth form, in place | Sign and aspect essays; house-dependent essays suppressed |
| Chart / data | Birth form, in place | Everything not house-dependent |
| Chart / timeline | An offer to enter a birth, over a live sky timeline | Transit lanes; time-lord lanes off, not guessed |
| Chart / map | A world map with an offer to place a birth on it | Map with angles from the known bodies |
| Chart / lab | Fully functional | Fully functional; grounding against a radix unavailable |
| People | The reader's own entry, then an offer to add a second | Contacts shown, overlays suppressed |
| Tools | Fully functional | Fully functional |
| Learn | Fully functional | Fully functional |
| Journal | An entry field. Writing works without a chart | Entries pinned to the mundane sky |
| Graph | The symbol graph alone | Sky and life graphs without house edges |

No surface in the `none` state consists of an instruction to go elsewhere.
The action that fills it is offered where it stands (§11.2).

## 12. Flows

Each flow: entry condition, numbered steps, branches, exit states. A step
that can fail names what happens when it does.

### 12.1 First run

**Entry:** `/free`, people store empty.
**Exit (success):** a drawn chart on screen and a person in the store.

| # | Step | Branch |
|---|---|---|
| 1 | The sky renders, before any input | Assets slow: horizon and gradient draw, stars arrive after |
| 2 | Reader types MM | Non-digit ignored; no error shown |
| 3 | Reader types DD | Day out of range for the month: field marked, entry kept |
| 4 | Reader types YYYY | Year outside the pack range: accepted, and the domain state names which bodies will be unavailable |
| 5 | On a valid date, the Sun glyph resolves into the headline | Date on a cusp: glyph waits for a time rather than guessing |
| 6 | Primary action enabled | — |
| 7 | Reader presses it | — |
| 8 | Chart computes with time unknown, noon UT, houses suppressed | Compute fails: error names what failed, the date is kept, the reader is not returned to an empty form |
| 9 | Wheel draws; three statements render | Corpus not loaded: the wheel and placements still draw, explanations report unavailable |
| 10 | Person written to store, `currentId` set | Storage blocked: the chart stays on screen and the reader is told nothing will persist, before they invest more |
| 11 | Two offers in place: add a birth time; name this person | Neither is required to continue |

**The three statements** in step 9 are the top three atoms by salience that
do not depend on a birth time, rendered from the corpus. Ranking is the
engine's; the constraint is that none may require houses or angles.

**Not in this flow:** an account, a paywall, a modal, a tour.

### 12.2 Returning reader

**Entry:** `/free`, people store non-empty.
**Exit:** Today for `currentId`.

| # | Step | Branch |
|---|---|---|
| 1 | Store read before first paint | Store unreadable: fall through to 10.1 and say so |
| 2 | `currentId` resolves to a person | Missing or dangling: use the most recently added |
| 3 | Today renders for that person | No birth time: clock-dependent cards suppressed in place (§4.6) |
| 4 | Person switcher shows who this is | One person only: the switcher is still present, offering to add |
| 5 | One action reaches their chart | — |

**The failure this flow exists to prevent:** `/free` showing first-run
onboarding to a reader whose chart is in storage.

### 12.3 Cross-door

**Entry:** any door. **Exit:** the reader is recognised at every other door.

| # | Step | Branch |
|---|---|---|
| 1 | A birth is entered at any surface carrying the birth form | — |
| 2 | The form writes through the single path in §10.1 | Validation fails: nothing is written and the entry is kept on screen |
| 3 | Every other surface reads the store on entry | — |
| 4 | Returning to `/free` enters 10.2, not 10.1 | — |

**Invariant:** there is one birth form, one writer, one store. A surface
that collects a birth and does not write here is a defect, and was the
defect (§10.1).

### 12.4 Add a second person, read the pair
Add from People or the person switcher. Same birth form, same store. The
pair reading renders. The switcher offers both.

### 12.5 Unknown birth time

**Entry:** a person exists with `timeKnown: false`.
**Exit (success):** a time window written to the person, or the time
deliberately left open. Both are successful exits.

| # | Step | Branch |
|---|---|---|
| 1 | Every clock-dependent element is suppressed where it would have sat, with one sentence saying why (§4.6) | — |
| 2 | Where the rising sign would be, the finder is offered | Reader ignores it: everything else keeps working, permanently. This is not a nag |
| 3 | Finder sweeps the birth day's Ascendant, bisecting to the minute at each sign change | Polar latitude: some signs never rise; those windows are named as impossible rather than omitted |
| 4 | Reader answers fit questions about each candidate rising sign | Reader answers none: skip to 5 with unweighted windows |
| 5 | Reader adds dated life events, optional | None given: proceed on fit answers alone, and say the confidence is lower for it |
| 6 | Slow movers are checked against each window's angles | — |
| 7 | A window is proposed with its confidence stated in plain words | Nothing separates the windows: say so, and propose nothing |
| 8 | Three exits offered, equally: accept the window, narrow further, keep the time open | — |
| 9 | Accepting writes the person and every surface updates | — |

**Rule:** the product never fabricates a rising sign, and "keep the time
open" is offered at every step, never buried.

### 12.6 Ambiguous local time
The birth form reports a clock change in plain words, names which reading it
used, and offers the other.

### 12.7 Tap a sentence to its source
Any reading sentence discloses the atoms behind it, and each atom discloses
the geometry.

### 12.8 Change a convention
Settings from anywhere. The change updates every open reading and is scoped
globally or to one chart, stated at the point of change.

### 12.9 Turn on Vedic
One switch. Zodiac goes sidereal, nakshatra cards appear on Chart, dasha
lanes appear in the Chart timeline, vargas and yogas appear, rendering offers the
square styles. The reader does not move.

### 12.10 Write an entry
Write anywhere. The sky-pin attaches silently. The entry appears in every
lens. Filing is suggested, never required.

### 12.11 Everything about X
From any planet, house, person or symbol, open its neighbourhood: placements,
transits, entries, events, people, symbols, tutorials. Export it as a prompt.

### 12.12 Compose a chart from text
Write a sentence in Lab. It composes to a chart with provenance per mapping.
The paired view shows latitude. The residual reports the distance between the
composed form and the sky of its writing.

### 12.13 Ask an AI, then check it
Generate a prompt pack from any artifact. Paste the answer into the citation
checker. Every cited fact resolves or is flagged.

### 12.14 Share
Any artifact offers a share action producing a link and a card. Opening the
link renders the artifact without a saved person and offers to save it.

### 12.15 Turn on advanced
One control in a persistent settings drawer. Every surface gains precision,
minor bodies and alternate conventions from then on, and the setting
persists. Explanations are unaffected: they were never behind it.

## 13. Runtime dependencies

```
people store ──┬─→ /free            known-reader state
               ├─→ Today            personal stack
               ├─→ Chart            writer and reader; every view
               ├─→ People           needs two
               ├─→ Journal          person pin, house filing
               ├─→ Graph            person and event nodes
               └─→ Chart / lab      grounding radix

settings store ─→ every surface that renders a chart. Conventions must agree
                  across Today, Chart and People, or two surfaces disagree
                  silently.

journal store ──┬─→ Journal
                ├─→ Chart timeline  the You lane
                └─→ Graph           entry and topic edges

lab store ──────┬─→ Chart / lab
                ├─→ Planetarium     composed source layer
                └─→ Journal         the second sky

url ────────────→ every surface. State is addressable (§4.4), so a surface
                  restores from the address before any store is read.

engine ─────────→ every surface. Engine, corpus, star packs, gazetteer and
                  NLP models load behind the surface that needs them. First
                  paint of /free needs none of them.
```

A surface that reads a store renders its `empty` state when the store is
empty. No surface assumes a store is populated.

## 14. Tests

### 14.1 Flows
One browser walk per flow in §10, asserting the observable outcome rather
than the absence of exceptions.

### 14.2 Surfaces by state
Every surface in §11.3 against every state in §11.1. A surface rendering under
100 words with no interactive control fails.

### 14.3 Modes
Every mode in §7 switched on and off, asserting that the surfaces it affects
change and the rest do not.

### 14.4 Instruments
Every instrument in §6 rendered on every surface that carries it, with
selection propagating across instruments sharing a surface.

### 14.5 Addressability
Every view in §5 restores from its URL alone, in a fresh browser with empty
stores (§4.4).

### 14.6 Standing gates
- Computed contrast on every text node, both lanes, both themes, WCAG AA.
- No surface throws. No surface renders zero interactive content.
- No network request carries birth data, entry text, or analysis output.
- Product copy contains no implementation vocabulary: draw, render,
  instrument, lane, surface, engine, projection, atom, corpus.
- The copy extractor feeding the prose lint reads rendered copy, not source.
- Every reading sentence resolves to atoms that exist.
- Every symbolic claim in Lab carries a provenance kind.

### 14.7 Manual
The first-run flow (§12.1) on a physical phone, once per milestone.

### 14.8 Definition of done
A view, flow, instrument or mode is done when a person has opened it and
used it. Passing types, unit tests and lints are necessary and not
sufficient.

## 15. Traceability

Every job in §3 resolves to a surface, and every surface answers a job. A
surface answering no job is out of scope; a job with no surface is a gap.

| Job | Surface | Flow | Test |
|---|---|---|---|
| 1 Show me my chart | `/free`, Chart / wheel | §12.1 | §14.1 |
| 2 What does that mean | Tap-to-explain, everywhere (§4.1) | §12.7 | §14.1, §14.6 |
| 3 What is happening now | Today | §12.2 | §14.1 |
| 4 Me and them | People | §12.4 | §14.1 |
| 5 The year ahead | Chart / timeline | §12.2 | §14.2 |
| 6 A good day | Tools / date finder | — | §14.2 |
| 7 Unknown birth time | Birth-time finder | §12.5 | §14.1 |
| 8 Where should I go | Chart / map | — | §14.2 |
| 9 Keep what I write | Journal | §12.10 | §14.2 |
| 10 Everything about X | The graph | §12.11 | §14.2 |
| 11 A chart for a non-person | Chart / lab | §12.12 | §14.2 |
| 12 Ask my AI | Learn / prompt packs and checker | §12.13 | §14.2 |
| 13 Check your math | Learn / methods; About on every chart | — | §14.6 |

Jobs 6, 8 and 13 have no flow written. That is a gap in this document, not
a decision.

## 16. Non-functional requirements

| # | Requirement | Measure |
|---|---|---|
| N1 | First contact is usable on a mid-range phone over 4G | Value moment (§4.7) reached in under fifteen seconds |
| N2 | First paint of `/free` loads no engine, corpus, star pack, gazetteer or model | Byte count of the initial bundle |
| N3 | Every heavier asset loads behind the surface that needs it | No surface blocks on an asset it does not render |
| N4 | Recomputation on a scrub is perceptibly immediate | Frame budget on the wheel while dragging a date |
| N5 | Contrast meets WCAG 2.2 AA in both themes | §14.6, automated |
| N6 | Every interactive element is keyboard reachable and labelled | Automated plus manual |
| N7 | Reduced-motion honoured on every animation, including the flatten and the scrub | Automated |
| N8 | The product works offline once installed (§5.1) | A cold load with the network disabled |
| N9 | No request carries birth data, entry text or analysis output | §14.6, automated |
| N10 | Any view restores from its URL alone | §14.5 |
| N11 | Supported browsers: current and previous two of the major evergreens | CI matrix |

N1 through N4 have no numbers yet. Setting them requires a measurement pass
that has not happened; until then they are directions, not thresholds.

## 17. Assumptions and risks

**Assumptions.** Each is a belief this design rests on and none is verified.

| # | Assumption | If it is wrong |
|---|---|---|
| A1 | A stranger will type a birth date before being shown value | The value moment must precede data entry, and §5.1 inverts |
| A2 | One surface can serve both audiences via layering | The product splits, and §1.1 fails |
| A3 | Depth already built is nearly free to expose | The scope in §5 is unaffordable |
| A4 | Readers want the honesty (§4.2) rather than tolerating it | The differentiator is a tax |
| A5 | Client-side storage is acceptable persistence | See R1 |
| A6 | The corpus register suits both audiences with a short-form layer added | The 4,100 essays need rewriting, not supplementing |

**Risks.**

| # | Risk | Mitigation |
|---|---|---|
| R1 | A cleared browser destroys a library, a journal and a graph | Unsolved. §20 |
| R2 | Payload defeats N1 on a phone | Load budget per §14, enforced in CI |
| R3 | Scope is large enough that surfaces ship as shells | §14.8: done means a person used it. This is the risk that already materialised |
| R4 | Coverage returns as the measure of progress | §2: jobs with paths, not symbols with surfaces |
| R5 | The corpus outpaces the surfaces that render it | Content follows the surface that reads it, not the grid |
| R6 | Composer norm packs prove non-redistributable | Fetch-and-cache, which changes the privacy promise for that view |

## 18. Interface contracts

What each instrument (§6) requires and emits. A hub may not reach inside an
instrument, and an instrument may not read a store.

| Instrument | Requires | Emits |
|---|---|---|
| Wheel | A chart, a body set, an orb profile, a house system, a selection | Selection changed |
| Sphere | The same, plus a viewpoint | Selection changed, viewpoint changed |
| Paired view | A chart, a selection, a flatten position | Selection changed, flatten changed |
| Multi-wheel | One to four charts with ring order, a contact set | Selection changed |
| Timeline | Lanes of spans and markers, a window | Window changed, span selected |
| Map | A chart, line sets, a projection | Line selected, place selected |
| Planetarium | Source layers with opacities, an instant, a lens, a projection | Instant changed, body selected |
| Graph | Nodes, typed edges, a focus | Focus changed, edge accepted |
| Data table | Rows, a column set, a density | Row selected |
| Share card | An artifact and a theme | An image |

Selection is one shape across every instrument, so a selection made in one
is meaningful in all of them (§6).

## 19. Errors

Distinct from domain states (§4.6), which are conditions of the data. An
error is a failure.

| Kind | Example | The surface says |
|---|---|---|
| Input invalid | A date that does not exist | What is wrong, in place, without discarding the rest |
| Out of range | A birth before the pack's fitted span | Which bodies are unavailable and what still computes |
| Compute failed | A root-find that does not converge | That this figure could not be computed, and what remains |
| Asset failed | The corpus or a star pack did not load | That explanations are unavailable, while the chart still draws |
| Storage failed | Quota exceeded or storage blocked | That nothing will persist this session, before the reader writes |
| Import failed | A malformed shared link | That the link could not be read, with the raw value recoverable |

Rules: an error names what still works; it never discards entered data; it
never appears as a modal over a reading in progress.

## 20. Open questions

1. **Persistence.** A library of forty charts, a journal of four hundred
   entries and a graph are lost when a browser clears. Free and
   account-free are two different promises and this design treats them as
   one. Export-to-file is not an adequate answer for the Journal.
2. **Corpus register.** The essays are written at explanation depth. The
   simplified default needs shorter copy, which implies new short-form
   writing rather than a rewrite of the corpus.
3. **Load budget.** Engine, corpus, star packs, gazetteer and NLP models
   have no stated budget or ordering.
4. **Mobile.** No measurement of this design exists at phone widths.
5. **The Composer's norm packs** depend on the redistribution rights check;
   the fetch-and-cache path changes the privacy promise for that view.
6. **Whether the Journal is a sixth hub** (§6.8). Five predictable nouns is
   the researched pattern; the Journal is half the return loop and may
   warrant breaking it.
7. **The visual direction against the category.** `ux-patterns.md` §7 names
   "soft purples, cosmic blues, starry gradients + high-contrast serif" as
   the saturated genre cliche. The approved twilight lane is close to that
   description. Owner decision, recorded here because the research is
   explicit and the design predates it being read.
