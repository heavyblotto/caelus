# Caelus Free (ephemengine.com/free) — vision, mapping, content strategy

2026-08-15

Companion research: [`research/`](./research/) — [Caelus capability inventory](./research/caelus-capability-inventory.md) · [mobile apps](./research/mobile-apps.md) · [websites](./research/websites.md) · [pro software](./research/pro-software.md) · [UX patterns](./research/ux-patterns.md)

---

## 1. Executive summary

The astrology software market is a barbell. On one side: ugly-but-omnipotent
calculators (astro.com, astro-seek — ~10M monthly visits each) and $300–500
Windows desktop suites (Solar Fire, Sirius, Delphic Oracle, JHora) that own
every serious technique behind 1996–2010 interfaces. On the other: beautiful-
but-hollow consumer products (Co–Star, CHANI, The Pattern, astro-charts) that
paywall synastry, progressions, and full readings while offering ~1% of the
calculation surface. **Nobody serves both ends, and the middle of the barbell
is empty.**

Caelus already computes nearly everything the power end requires — the
predictive quartet (transits, progressions, solar arc, returns), the full
Hellenistic time-lord stack (profections, zodiacal releasing, firdaria,
primary directions, lots), a real Vedic layer (nakshatras, three dashas,
vargas, yogas), electional search, astrocartography, eclipses, parans,
pattern detection, dignities — validated against Swiss Ephemeris and JPL
Horizons, running entirely in the browser. What exists today at
ephemengine.com presents this as a developer proof-of-work. What's missing is
purely product: consumer surfaces, interpretation content at scale, and a
navigational structure built around people's questions instead of the
engine's modules.

**The proposal: ship a 100% free, no-login-wall, client-side astrology
app as its own section of ephemengine.com** that pairs astro-seek's breadth
with astro-charts' polish and adds whitespace features no one on the web
has: a unified multi-technique timeline, electional search with a timeline
UI, a guided birth-time finder, a journal whose entries are pinned to the
sky and mined as an annotated corpus, a personal knowledge graph joining
chart, people, places, events, and entries, and a Composer that turns text
into charts. It covers the entire interpretation surface with an
agent-written, machine-validated corpus, and makes every artifact
"AI-portable" via deterministic prompt generation and the already-hosted
MCP server.

## 2. The market read (what the research says)

Five findings drive everything below:

1. **Beautiful + deep is unclaimed.** Every review cycle repeats it: polished
   apps are shallow, deep tools are hostile. The bridge zone (TimePassages,
   astro-charts, Astro Future) is the most praised and least crowded.
2. **The single largest gap is the integrated timeline.** No web product —
   free or paid — overlays transits, progressions, and time-lord periods on
   one interactive, zoomable surface. Desktop pros pay $360 for Solar Fire's
   Time Map; Archetypal Explorer sells just the transit-waveform slice as a
   subscription; Honeycomb sells it as static PDF.
3. **The always-paywalled features are Caelus's cheapest surfaces.** Synastry
   depth, composite charts, progressions/returns, year-ahead readings,
   unlimited saved people — the whole consumer paywall catalog is engine work
   Caelus finished quarters ago.
4. **Trust is the category's open wound.** Dominant complaints across every
   competitor: dark-pattern billing, paywall creep, unexplained scores, black-
   box methods, fabricated positions from AI apps. Caelus's whole identity —
   validated math, published accuracy, cited facts, honest uncertainty — is
   the antidote, and it's already built.
5. **The credibility bar for serious users is a checklist Caelus mostly
   clears.** Of the pro-research "minimum bar" items, the engine covers
   accuracy, house systems, the predictive quartet, traditional basics,
   precise event times. The gaps are UI artifacts (bi/tri-wheels, orb
   profiles, chart library, export). The math is done.
6. **Journaling barely exists in the category.** CHANI alone offers
   prompted journaling, and nobody closes the loop the whole category's
   self-development framing implies: transit → prompt → entry →
   retrospective. The Journal (§5.5) is built on that open ground.

## 3. Vision

> **The whole of astrology in your browser for free.**
>
> You get your full birth chart with a real reading, compatibility with the
> people in your life, a picture of your year ahead, and good days to plan
> around. If you don't know your birth time, the app helps you narrow it
> down instead of guessing. The heavier tools that used to require
> expensive desktop software
> are here too, from transit timelines to maps of where in the world your
> chart changes. There's a journal, and every entry remembers the sky it
> was written under. You don't need an account, you can use it on your
> phone,
> and your birth data never leaves your device. When you want a deeper
> interpretation, copy your chart into ChatGPT or Claude and ask whatever
> you like.

The validation chain, the citations, and the clean-room math stay out of
the pitch. They live in the product's behavior and on the methods pages
for the small minority who go looking. Product copy follows
[docs/editorial-voice.md](../editorial-voice.md), including its Caelus Free
section, enforced by the prose lint.

### Product identity

The app is **Caelus Free** — the consumer face of the engine, featured in the
top nav, living at **`ephemengine.com/free`**. The name does double duty: it
carries the engine's name outward, and it states the positioning in one word.
It gets its own visual identity, designed for consumers (§8); the existing
playground remains the developer demo. A route scheme that fits: everything
hangs off `/free` (e.g. `/free/today`, `/free/chart`, `/free/places`,
`/free/times`, `/free/journal`), which also gives the programmatic SEO
pages a clean home (`/free/learn/...`, `/free/mars-in-aries`, etc.).

### Product principles

How each reads to a user is in quotes; the engineering stance behind it
follows. The quotes are the register all product copy uses.

1. **"It's free."** Every feature, chart type, reading, and export is
   free. There is no paid tier. (The product exists to prove and
   distribute the engine. It does not need to earn revenue.)
2. **"You don't need an account."** Charts save on your device. You can
   share anything with a link (`#c=` already works). If accounts ever
   exist, the obvious use is syncing saved charts.
3. **"Your birth data never leaves your device."** All computation happens
   in the browser. This is already true of the playground, and it becomes a
   headline promise.
4. **"You can check our math."** The methods and validation pages are one
   click away for the few who want them. Every convention (house system,
   ayanamsa, orbs) is named and switchable. This is trust infrastructure.
   It appears as a quiet footer link.
5. **"Tap a sentence to see where it comes from."** Every line of a reading
   links to the placement behind it.
6. **"Don't know your birth time? We'll help you find it."** Most people
   don't know theirs, so finding it is part of the product. A guided flow
   sweeps the possible rising signs across your birth day, asks which
   descriptions fit you, and checks major life events against the chart's
   angles, then proposes a time with a confidence window you can refine.
   Until the time is pinned down, readings lean on the parts of the chart
   that don't depend on the clock, and the app never fabricates a rising
   sign. DST oddities, polar house fallbacks, and missing bodies are
   explained in plain words when they happen.
7. **"AI ready."** Copy your chart into ChatGPT or Claude and ask it
   anything. The prompt carries the correct chart facts, so the AI doesn't
   make them up. (Deterministic prompt packs plus the hosted MCP server.)

### Competitor features with no Caelus computation behind them

Live human readers, native app-store builds with push notifications (the
web app installs on a phone), meditations and audio libraries, dating and
social graphs, and tarot/palmistry content. Every *computational* feature
in the market is in scope, because Caelus already does it.

## 4. Product architecture (information architecture)

```
Caelus Free (/free)
├── Today     — the sky now, personalized: transit cards, cosmic weather,
│               moon phase & VoC, planetary hour, upcoming events
├── Chart     — the natal workspace: wheel + reading + every data layer
├── People    — the chart library; synastry, composite, Davison
├── Places    — astrocartography, relocation charts, local-sky parans,
│               "where in the world your chart changes"
├── Times     — the unified timeline: transits, progressions, returns,
│               time-lords; the year ahead; birthday; the date finder and
│               the calendars (eclipse, retrograde, ingress, VoC)
├── Journal   — the diary: entries pinned to the day's actual sky, prompts
│               drawn from the reader's current transits
├── Learn     — tutorials, guides, glossary (doubles as the programmatic
│               SEO surface)
└── Tools     — ephemeris, the Planetarium, Chart Lab, similar skies,
                counterfactuals, the public API and MCP pages
```

### Onboarding — the sky answers as you type

The sequence, proven in working code (the MyMagus proof of concept; that
brand is retired and the flow lives at `/free`):

1. **A headline that completes itself.** The opening line ends on "your
   sign," and the moment month and day are entered, the reader's Sun-sign
   glyph appears inside the sentence — before any button, four keystrokes
   in. Sun sign needs only month and day, so the response is instant and
   client-side. Near a cusp, the glyph waits for the year and the exact
   ingress decides it.
2. **The year turns the sky into their sky.** The twilight background
   deepens to the night field of the birth date — real stars, real
   constellation lines. "This is the sky you were born under."
3. **The time rotates the sky.** With an hour, the field turns to that
   hour and the planets fade in at their true places, the Moon at its
   correct phase. The "I don't know my birth time" path forks here into
   the birth-time finder (§5.1) — part of onboarding, and a dead end for
   no one.
4. **The place sets the horizon.** The field tilts to the birthplace's
   latitude and the horizon lands where it really was.
5. **The translation scene.** The final button turns the sky into the
   chart: bodies glide from their sky positions onto the zodiac ring,
   houses stamp in, aspect lines lace last. One animation that teaches
   what a chart is while delivering it.

The privacy promise appears beside the first button, in exactly these
words: **"Computed here on your screen."** The headline is "There is more
going on than your sign." with the brand carried by the eyebrow. The
buttons are "Show me my sky", then "Write it down". No account, ever, to
get everything.

Cross-cutting patterns (from the UX research):
- **One wheel, layered three deep:** simplified default (big three, major
  aspects) → tap anything for a plain-language card citing its atoms →
  Advanced toggle (degrees, minors, house-system/zodiac/orb controls, dense
  data view).
- **Every number gets a sentence; every sentence can show its numbers.** The
  interpretation layer's atom citations make this bidirectional link native.
- **State in the URL everywhere.** Extend the existing `#c=` share codec to
  every artifact (synastry pairs, timeline views, election results).
- **The graph underneath.** People, places, events, entries, placements,
  and symbols connect in one on-device graph (§5.6); any node's
  neighborhood is a navigation surface that cuts across the hubs.
- **The paired view.** Wheel and sphere side by side with one selection
  model, and an animated flattening between them: the sphere presses onto
  the ecliptic plane and becomes the wheel. It teaches what a horoscope
  is — a projection — and it makes latitude visible: out-of-bounds
  heights, parallels as shared rings, true 3-D separations, and the
  Composer's embodiment axis, where concrete words hug the plane and
  abstractions float above it. The onboarding translation scene is this
  same flattening run once; the paired view is its permanent home.
- **Everything you make is an object you can carry.** Any chart, reading,
  timeline, election result, journal volume, graph, or composed sky saves
  as one small documented object in plain JSON: what it is, the versions
  that made it, the chart fingerprint, and the data itself. The share link
  and the file carry the same object, so anything you can link you can
  save, send to a friend, feed to another program, or drop back in later
  and pick up whole — and the same chart produces the same object on any
  device. Every export path (file, link, ICS, prompt pack, API response)
  is a rendering of this one envelope.
- **Both themes.** Light and dark ship together, whatever identity is
  chosen.

## 5. Precise mapping: every Caelus capability → consumer surface

Everything in these tables is in the product. The ✓ mark means the feature
is in the product; the ∞ mark labels internal functions that power a
surface without being directly visible. Engine references are the
modules/tools from the
[capability inventory](./research/caelus-capability-inventory.md).

The tables in this section are the product-shaped view. **The exhaustive
symbol-level map — all 45 engine modules, every public export, all 14 Engine
methods, all 35 MCP tools + resources + prompts, and every wheel/birth/
delineations export, each assigned a surface — is
[feature-map.md](./feature-map.md).** Coverage there is checked at 100%;
anything not user-visible is explicitly tagged infrastructure with the
surface it powers.

### 5.1 Onboarding & chart creation

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `caelus-birth` `toUT` (historical tz/DST, ambiguous/nonexistent status) | Birth-data wizard; DST edge cases surfaced in plain language ("clocks changed that night — we used the earlier time; switch?") | ✓ |
| Offline gazetteer + `CityPicker`; `openMeteoGeocoder` fallback | Place step with autocomplete, no network required for common cities | ✓ |
| `rectification_grid` + `rectification_session` prompt + `primaryDirections`/`transitAspects`/`profectionAt` against the angles | **Birth-time finder**: a guided flow sweeps the day's possible rising signs, asks which descriptions fit, and checks major life events against angle hits, then proposes a time with a confidence window. No consumer app offers rectification | ✓ |
| Provenance layer: `realize`, certainty damping; `chart_facts` earliest/latest | While the time is still unknown, charts work anyway: readings lean on placements that don't depend on the clock, and time-sensitive parts are labeled until the finder pins it down | ✓ |
| `Chart.warnings`, `unavailable`, `houseSystemRequested` | Honesty chips on every chart ("Chiron unavailable before 1600", "Placidus fell back to whole-sign at this latitude") | ✓ |

### 5.2 Chart (the natal workspace)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `Engine.chart`/`chartAt`; 13 bodies + Liliths + asteroids + Uranians; 12 house systems; tropical + 7 ayanamsas | The chart workspace: interactive wheel, body-set picker, house/zodiac switcher with presets (Modern / Traditional / Vedic / Uranian) | ✓ |
| `caelus-wheel` `ChartWheel` (+ app-side interactivity layer) | Responsive SVG wheel; tap planet/house/aspect → explanation card; two-way highlight with the placements list | ✓ |
| Aspects with `phase`/`strength`; custom angle tables & orbs | Aspect list as sentences (applying/separating, strength bars), majors default, minors via settings; aspectarian grid in data view | ✓ |
| `detectPatterns` (8 kinds) | Pattern badges on the wheel + cards ("Your T-square, apex Mars") — the most-copied delighter in the category | ✓ |
| `chartSignature` | "Chart at a glance": element/modality balance bars, dominants, chart ruler, big three chips | ✓ |
| `dignityScore`/`almuten` (Lilly), `dignities`, sect | Dignities panel with plain-language framing + score table in data view | ✓ |
| `lots` (7 Hermetic) | Lots card (Fortune & Spirit up front) | ✓ |
| Declination aspects, `outOfBounds` | "Out of bounds" and parallels cards | ✓ |
| `starConjunctions` (319 stars), `starParans` | Fixed-star card ("Your Sun rises with Sirius") | ✓ |
| `ChartSphere` + `ChartWheel`, linked selection, flatten animation | **The paired view**: wheel and sphere together, tap anything and it lights in both; the sphere presses flat into the wheel on demand | ✓ |
| Topocentric option; `separation: "spatial"` (3-D aspects) | Advanced settings toggles (observer-true positions, spatial aspect mode) | ✓ |
| Vertex / East Point angles | Advanced angles on the wheel and in data view | ✓ |
| `heliocentric()` | Heliocentric view toggle | ✓ |
| Deep star pack (8,920 stars) | "Deep sky" star setting for power users | ✓ |
| `midpointLon` | Midpoints table in data view (pro staple) | ✓ |
| `interpretationContext` + `interpret` + `reconcile` + corpus | **The Reading**: salience-ranked, grouped, cited natal reading — the app's centerpiece (see §6) | ✓ |
| Canonical mode (`chartDigest`) | Stable chart fingerprint powering share images, permalinks, prompt determinism | ✓ |
| Share codec (`lib/share.ts`) + OG image route | Designed share cards (wheel + big three) per chart URL | ✓ |

### 5.3 Today (retention surface)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `cosmic_weather` (patterns among transiting planets, stations, void Moon) | "The sky today" header cards for everyone (no birth data needed) | ✓ |
| `transitAspects` (transit→natal with orb/phase/house) | Personalized transit card stack, relevance-ranked (salience), each expandable to the geometry | ✓ |
| `find_aspect_dates` (orb entry/exit via root-finding) | **Duration bars** on every transit card (starts / exact / ends) — The Pattern's best idea, with the astrology shown | ✓ |
| `lunarPhases`, `voidOfCourse`, `planetaryHour` | Moon strip: phase, sign, VoC window, current planetary hour | ✓ |
| `riseSet`, `crossings`, `stations`, eclipses (`sky_events`) | "Coming up" feed: ingresses, stations, lunations, eclipses (with local visibility via `solarEclipseLocal`) | ✓ |
| `profectionAt`, `vimshottariAt`, `firdariaAt`, `zrAt` | "Your year/period" chip (lord of the year, active dasha) contextualizing the day | ✓ |
| PWA + ICS feeds | Installable app; subscribe-to-calendar for VoC/eclipses/retrogrades (nobody offers ICS export — cheap and viral) | ✓ |

### 5.4 People (relationships)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| localStorage chart library (playground already saves sets) | People list: unlimited saved charts, tags, quick-switch person context across all tools (astro.com's best IA idea, modernized) | ✓ |
| `synastryAspects` + `synastryOverlays` + synastry atoms + brief | Relationship reading: named dimensions in prose (identity, communication, affection, friction), each expandable to the exact inter-aspects; **named quality verdicts, with no unexplained percentage scores** | ✓ |
| `BiWheel` (to be lifted into `caelus-wheel`) | Synastry bi-wheel one tap deeper, ring-swappable | ✓ |
| `compositeLongitudes` + `davisonParams` + composite atoms | Composite & Davison charts with readings | ✓ |
| `counterfactual`/`chartDiff` | "What if" explorer for a pair (e.g. relocated relationship) | ✓ |

### 5.5 Journal

The diary loop the research found nobody closes: transit → prompt → entry
→ retrospective. One entry store, many lenses: every entry, whatever
format it was written in, is the same object — text plus a timestamp plus
an automatic sky-pin (chart digest, active transits, moon phase,
profection year, planetary hour) — and the formats are views over that
store. An entry written anywhere appears in every lens. Future media
(voice, images) drop into the same store and inherit every lens.

Three formats at launch:

- **The commonplace book, mapped to the houses.** The index page is the
  natal wheel: tap a house to open its section. Each section header
  carries the chart's own statement about that life area (cusp sign,
  ruler and its condition, occupants) and what is transiting it now, so a
  thought filed under the 7th house sits beside the 7th-house reading and
  is stamped with the transit that was crossing it. Entries here can be
  collected things — quotes, passages, observations — in the commonplace
  tradition, with the houses as the filing system.
- **The sequential journal.** Dated pages on the sky's calendar: chapters
  run lunation to lunation, and a volume closes at each birthday, labeled
  by the profection year and its lord. Each page carries its day's data
  in the almanac's second ink — moon phase, strongest transit, the
  planetary hour it was written in. A closed volume exports as a designed
  book, free.
- **The headless stream.** Text in, nothing asked. The silent sky-pin
  makes this the deferred-structure format: the stream re-projects
  through any lens after the fact — by house, by lunation, by person, by
  transit.

**The annotated corpus.** The Journal sits on a text-mining layer that
gives every entry a second annotation track beside the sky-pin:
sentiment and emotion, topics and keyphrases, named people, linguistic
style, and text embeddings — all computed on the device, versioned by
analyzer so upgrades re-annotate, and included in the export format. Two
aligned annotation tracks over time make the diary a corpus, and the
product reads them against each other. Every statistic is descriptive
and shows its count; the app never asserts that the sky causes anything
— it shows what this reader's corpus does.

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `chartDigest` (canonical) + `current_sky` | Every entry pinned to the day's actual sky — reopen it and see what the sky looked like when you wrote it | ✓ |
| Natal houses + `transitAspects` per house | The commonplace book: wheel as index, house sections with live transit stamps | ✓ |
| `lunarPhases` + `profectionAt` | Lunation chapters and profection-year volumes; New Moon intention pages paired with Full Moon review pages | ✓ |
| Eclipse search per house | Sealed eclipse letters, opened when the next eclipse lands in the same house | ✓ |
| `transitAspects` + `interpretationContext` salience | Optional prompts drawn from the strongest current transit — behind a gentle affordance, never a gate | ✓ |
| `find_aspect_dates` | Retrospective: "this transit last ran in 2023 — here's what you wrote then"; search entries by active transit | ✓ |
| `chartFeatures` similarity | "When did I last feel this?" — find the entries written under the most similar sky | ✓ |
| Atom ids | Marginalia: annotate any reading sentence; the note attaches to the placement and resurfaces when that transit returns | ✓ |
| On-device NLP (sentiment/emotion, topics, entities, style, embeddings) × the sky-pin | **Your correlations, computed**: "entries while Mars aspects your Moon run hotter on anger words — 23 entries, here they are" | ✓ |
| Sentiment series + the Times timeline | **The You lane**: your emotional curve drawn under the transit lanes — a personal graphic ephemeris against the sky's | ✓ |
| Topic + entity extraction | The headless stream files itself: suggested house sections and People tags, one tap to accept | ✓ |
| Text embeddings + `chartFeatures`/`cosineSimilarity` | Retrospectives on two axes: match past entries by text similarity, sky similarity, or both jointly | ✓ |
| Corpus aggregates per volume | The birthday book closes with a computed epilogue: the year's themes, emotional arc, the people who appeared most | ✓ |
| Corpus aggregates → `chartBrief` template | A Journal prompt pack: your themes and sky states over a window as a deterministic prompt for your own AI | ✓ |
| The Composer (§5.10) + `chartFeatures` distance | **The second sky**: each entry can compose the chart its text describes, beside the sky it was written under — and the distance between the two becomes a corpus signal | ✓ |
| People tags | A People lens: private entries about a saved person beside the synastry | ✓ |
| The Planetarium's composed source (§5.8) | Watch your writing as a sky: the volume's composed bodies in the dome, one more lens over the entry store | ✓ |
| localStorage + export file | On the device, backed up by a file you hold; an entry can export with its sky card. The Journal's version of the onboarding promise, in exactly these words: **"Written here, kept here."** | ✓ |

### 5.6 The personal knowledge graph

Three graphs, joined, all on the device. Computed edges (aspects,
dispositors, transits, synastry) draw as facts; inferred edges (NLP
mentions, suggested filings) are visibly suggestions until accepted.

- **The sky graph — computed.** A chart is already a graph: bodies joined
  by aspects, dispositor chains as a directed tree, receptions, house
  rulerships, pattern memberships. Synastry is inter-chart edges between
  two people's graphs.
- **The life graph — lived.** People, places, life events, and journal
  entries. Each life event gets its own chart, connected to the natal by
  the transits that were running — a biography as a graph of skies. The
  birth-time finder's events enrich the graph; the graph's events become
  rectification evidence.
- **The symbol graph — inherited.** The Liber 777 correspondence table
  (already shipped in the delineations package), the glossary, and the
  Learn concepts: every node in the other two graphs reaches its symbolic
  neighborhood.

| Engine capability | Consumer surface | Scope |
|---|---|---|
| Chart aspects + `DispositorAtom`/`ReceptionAtom` + patterns + house lords | The sky graph, drawn from what the engine already emits as typed relations | ✓ |
| `synastryAspects` between saved charts | Inter-person edges; a person's node carries the synastry that ties them in | ✓ |
| `chartAt` per life event + `transitAspects` to natal | Event nodes with their own charts, dated into the biography | ✓ |
| NLP entities + house filings + two-axis similarity | Entry and topic edges, suggested until accepted | ✓ |
| `correspondences` + glossary + Learn | The symbol graph and its bridges into the other two | ✓ |
| Wheel geometry as layout | **The graph on the wheel**: nodes arranged radially around the natal chart by strongest zodiacal association — a life arranged around its chart | ✓ |
| Ego-graph queries | "Everything about X": tap a planet, house, or person and get its whole neighborhood — placements, transits, entries, events, people, symbols, tutorials | ✓ |
| Deterministic neighborhood serialization → `chartBrief` template | A graph-neighborhood prompt pack: "here is everything connected to my 10th house" for the reader's own AI | ✓ |
| Export (JSON-LD alongside corpus layers) | Text + annotations + graph in one documented format the reader owns | ✓ |

### 5.7 Times — timing (the flagship differentiator)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `ephemeris` series + `EphemerisGraph`; `find_aspect_dates`; `stations`/`crossings` | **The Timeline**: one zoomable surface — transit duration bars against natal points, station/ingress markers, eclipse flags. The #1 whitespace feature in the entire market | ✓ |
| `profection`, `firdaria`, `zrRelease` (L1–L4), `vimshottariDashas` | **Time-lord lanes** layered under the transit lanes (profection year, ZR chapters with loosing-of-the-bond, firdaria, dasha) — Solar Fire/Delphic Oracle capability, web-native for the first time | ✓ |
| `progressedLongitude`, `solarArc` | Progressions & solar arc: progressed positions, hit lists, progressed-to-natal lanes on the Timeline | ✓ |
| `solarReturn`/`lunarReturn` (relocatable) | **Birthday page**: solar-return chart (relocation option: "where should I spend my birthday"), year-ahead framing with profection lord; lunar-return month view | ✓ |
| `returns()` for ANY body | **Planetary returns**: Saturn return, Jupiter return, nodal return… — timing + return chart + reading. Enormous standing search demand ("Saturn return calculator") and pure engine surplus | ✓ |
| `primaryDirections` + `mundaneDirections` (Ptolemy/Naibod) | Primary directions table (age-sorted arcs) — power-user credibility feature | ✓ |
| Graphic ephemeris (45/90/360 modes via `wrap`) | Classic graphic-ephemeris view for pros | ✓ |
| `harmonicChart`, `antiscion` | Harmonics & antiscia views in Advanced | ✓ |

### 5.8 Explore (tools)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `electional_search` / `rankMoments(Async)` + VoC penalty | **Date finder**: "find a good moment for X" → criteria builder (aspects wanted, Moon not void, body angular) → green/red timeline of ranked windows. Exists nowhere on the web | ✓ |
| `sky_events` + eclipse search + `solarEclipseLocal`/`Where`/`Limits` | Eclipse pages: catalog, local circumstances by place, path maps | ✓ |
| `crossings`/`stations` bulk (Turbo tier) | Retrograde, ingress, and station calendars (per year, per planet) | ✓ |
| `voidOfCourse` scans | VoC Moon calendar (timezone-aware, ICS export) | ✓ |
| `astrocartography` + `AstroMap` (+ basemap) | Astrocartography: interactive world map, tap a line for meaning, relocated chart side-by-side. Absent from every consumer app | ✓ |
| `parans` | Local-sky parans at your latitude (advanced astrocartography companion) | ✓ |
| `ephemeris` + positions | Modern ephemeris tables (monthly pages, filterable, copyable) | ✓ |
| `chartAt` anywhere | Relocation chart tool (side-by-side with natal; pairs with astrocartography) | ✓ |
| `pheno` (phase, illumination, elongation, magnitude) + `riseSet` | Visibility almanac: evening/morning star, elongations, brightness, rise/set times per body | ✓ |
| `solarPhase` (cazimi / combust / under beams) | Condition chips on charts and in the date finder | ✓ |
| `when()` query engine | Power query UI ("Mars in Aries AND retrograde, 2026–2030") | ✓ |
| `skyView`/`skyViewSequence`, lens presets, twilight and limiting-magnitude physics | **The Planetarium — the real sky**: current, any time, anywhere; scrub time, choose lenses, generate AI image prompts | ✓ |
| The same instrument fed by authored synthetic systems | **The Planetarium — imagined skies**: Chart Lab systems viewed in the same dome | ✓ |
| Composed charts registered through the synthetic seam (`registerSyntheticSystem`, `syntheticRender`) + the motif ephemeris | **The Planetarium — the Composer sky**: the journal's composed charts as a sky of their own; motifs are bodies placed by their composed coordinates, moving through narrative time as entries accumulate | ✓ |
| `registerSyntheticSystem` mixing sources into one projection; `renderPlan` layers | **The Planetarium — layers, not modes**: the three sources are toggles that combine in any mix — the Composer sky over tonight's real sky, an imagined system against the stars of a birth date. Each source renders as its own layer with its own opacity, and the AI image prompts describe whatever mix is showing | ✓ |
| `ChartSphere` | **The Planetarium — two projections**: the dome (the sky from where you stand, through `skyView`) and the sphere (the celestial sphere seen from outside, through the built-in 3-D `ChartSphere`). Any source or mix of sources renders in either projection — a natal chart, an imagined system, or the Composer sky as a tilted globe you turn in your hands | ✓ |
| `gauquelinSector` | Gauquelin sector table in research data view | ✓ |
| Horary helper (planetary hours + VoC + dignities + reception primitives) | Horary chart page with strictures checklist | ✓ |

### 5.9 Vedic

| Engine capability | Consumer surface | Scope |
|---|---|---|
| Sidereal zodiacs (7 ayanamsas), `nakshatra` (+pada, lords) | Vedic mode: sidereal chart, nakshatra cards (Moon first) | ✓ |
| `vimshottariDashas`/`yoginiDashas`/`ashtottariDashas` | Dasha timelines (maha→antar→pratyantar) in Times | ✓ |
| `vargaChart` (D1–D30 set) | Divisional charts (D9 navamsa headline) | ✓ |
| `detectYogas`, `rajaYogas`, `dhanaYogas`, `yogakarakas`, `kemadruma` | Yoga cards with defining-rule provenance | ✓ |
| North/South Indian chart styles (new render) | Square chart rendering option | ✓ |

### 5.10 Chart Lab — synthetic, archetypal & counterfactual charts

The 0.18–0.23 layers (provenance, compiler, synthetic ephemeris) are a
product area no competitor has any equivalent of — for the curious, and for
writers, worldbuilders, game designers, and artists. The engine work is
done and MCP-surfaced; the cost is UI.

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `compileForm` (constraints → chart form; impossible flagged) | **Archetypal chart designer**: describe a chart ("Venus conjunct Moon in Taurus, both trine Mars") → the geometry realized as a wheel + reading, or an honest "impossible" verdict | ✓ |
| Provenance realms + anchors + `realize`; `chart_facts` range/constraints/narrative modes | **Fictional & mythic charts**: charts for story characters and events with narrative/relative anchors ("three days after the coronation"), readings framed provisionally by certainty | ✓ |
| `counterfactual` + `chartDiff` | **What-if explorer**: "born 6 hours later / in Tokyo" → what changes (signs, houses, aspects gained/lost) | ✓ |
| `searchConfigurations` / `similar_skies` | **"When did the sky last look like this?"** — search history for a configuration; highly shareable | ✓ |
| Text→chart mapping packs (versioned norms: Brysbaert 2014 concreteness → latitude; 12-fold semantic category / documented onomantic reduction → longitude; SUBTLEX frequency → distance) + `compileForm` | **The Composer**: write a sentence, get its chart — predicate as anchor, arguments as bodies, relations as aspects and 3D separations. The compiler's constraint vocabulary (aspect, sign, degree, declination, parallel, separation3d) already accepts everything the mapping emits. Every mapping carries a provenance tag: documented correspondence, empirical measure, or labeled invention — never an invention dressed as doctrine. English-first (the norms are English); rights check on norms redistribution | ✓ |
| Rule-based SRL/dependency + TIMEX extraction + provenance realms | Grammar selects the realm: witnessed text composes time-anchored charts, fictional and hypothetical text composes into compiled realms — the compiler chooses the latitudes because the text has no sky | ✓ |
| Anchor promotion up the outline | **The hierarchy**: phrase → body (head-weighted blend), sentence → chart; each level's chart carries only its immediate children's anchors (sentence anchors promote into the paragraph chart, and so on up) — a tree of bounded charts, with an outline view that zooms like the Times timeline | ✓ |
| Dispositor chains, `varga`, `antiscion`, aspects and parallels as the edge vocabulary | **Typed part–whole edges from documented structures**: containment as dispositorship (the tradition's own dependency graph), domain sub-charts as vargas, mirror relations as antiscia, correlations as aspects and parallels — the same vocabulary feeds the knowledge graph | ✓ |
| `compositeLongitudes`/`davisonParams` between any two units | Comparison operators between text units at any level, beside synastry | ✓ |
| Author radix + `transitAspects`/`synastryAspects`/progressions against it | **Grounding**: the writer's own chart is the observer standpoint, and composed charts read against it with the tradition's documented apparatus. Mapping parameters tune on one corpus partition and validate on a held-out partition; an uncertain radix gets a recorded decision policy (date variant, no-time convention) stamped as provenance | ✓ |
| `realize()` per temporal reference | **The time registry**: a text carries many times, and realm logic applies per entry — historical dates compose against the real sky, mythic and remembered ones into compiled realms. The Journal exercises this boundary daily | ✓ |
| `compileForm` residual and `impossible` flag | **The residual**: realizing a composed chart against the actual sky of its writing reports a distance — how much the text exceeds its moment. The compiler already emits the number; the surface just shows it | ✓ |
| The paired view (§4) on composed charts | **Latitude made visible**: on the wheel two words in one sign look identical; on the sphere the concrete word sits on the ecliptic and the abstract one floats toward the pole. The flatten animation performs the thesis — ideas pressed into manifestation — and the residual draws as the gap between the compiled form and the reachable sky | ✓ |
| `synastryAspects` between unit charts | **Cross-references as synastry**: anaphora, citations, repeated names, links — typed by their strongest inter-chart aspect; cohesion reported as an aspect count | ✓ |
| `ephemeris` + `EphemerisGraph` over narrative time | **The motif ephemeris**: a recurring word's path across successive unit charts, drawn as a graphic ephemeris; a doubling-back path is the motif running retrograde (labeled invention) | ✓ |
| `detectPatternsIn` + `chartFeatures`/`cosineSimilarity` over composed charts | Thematic stelliums in a paragraph; structural search — the paragraph most like this one, the synastry of two whole books; a Journal volume's composed chart compared to the composite of its real sky-pins | ✓ |
| Onomancy (documented mod-24 stoicheia reduction) + share cards | **The chart of your name**: a shareable, provenance-tagged artifact; a programmatic-page family | ✓ |
| Geomancy-style bit encoding | Seal generator: a deterministic glyph for an entry or intent, with documented correspondences | ✓ |
| Synthetic ephemeris (placement/periodic/kepler bodies, observer vantage) + `synthetic_validate`/`synthetic_positions` | **Invented-sky systems**: author imaginary bodies with real orbital motion, cast charts in fictional skies | ✓ |
| `registerSyntheticSystem` + `syntheticRender` + `synthetic_sky_view` | Mix invented bodies into the real sky; fictional sky renders + AI image prompts for worldbuilders | ✓ |
| `chartFeatures` / `cosineSimilarity` | Chart-similarity search ("famous charts most like mine", once a public-figure chart set exists) | ✓ |

### 5.11 AI portability (see §7)

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `chartBrief` + `BRIEF_INSTRUCTIONS` + kind filters + salience caps | **Prompt packs**: deterministic themed prompts (career, love, year ahead, birthday, today) generated from any artifact; copy-and-paste to any AI | ✓ |
| `auditCitations` | "Check your AI's answer" — paste a response, we verify every cited fact resolves. A trust feature with no equal anywhere | ✓ |
| Hosted MCP (`/api/mcp`, 35 tools) + MCP App widget | "Connect your AI" page: one-click MCP setup for Claude/ChatGPT; your agent computes real charts | ✓ |
| `/api/chart` edge API | Free documented public API (expand endpoints over time) — developer moat | ✓ |
| Canonical mode + share codec + JSON-serializable engine outputs | **Portable objects (§4)**: every artifact exports as one versioned JSON envelope — kind, engine and corpus versions, chart digest, payload — the same object behind the file, the link, and the API; any of them imports back whole | ✓ |

### 5.12 Learn & SEO

| Engine capability | Consumer surface | Scope |
|---|---|---|
| `caelus://glossary` resource + corpus | Glossary pages (signs, planets, houses, aspects, techniques) | ✓ |
| Interpretation corpus cells (§6) | **Programmatic pages**: every planet-in-sign, planet-in-house, aspect pair, transit, pattern gets an indexable page = calculator + explainer, deep-linking into the app with presets. The astro-seek/cafeastrology traffic playbook with astro-charts' clothes | ✓ |
| Validation/methods/provenance pages (exist) | "Why trust this" — linked from every chart footer | ✓ |

## 6. Content strategy — the synthetic corpus

Interpretations, tutorials, and general astrology content are **in scope,
at launch, at scale**. All of it is written new by frontier models, which
already carry the astrological tradition in their training, guided by deep
research into the well-known, well-trodden interpretation canon. The
public-domain corpus in `caelus-delineations-pd` is not the basis, the
seed, or the ceiling of this content: it ships alongside as an optional
"classical voices" source, and every cell below is written fresh whether
or not a century-old text happens to cover it. Imperfect at first is
accepted; refinement is continuous.

### The quality bar

The bar is Robert Hand's Para Research series. Planets in Transit is the
standard for the transit cells, Planets in Composite for the composite
cells, and the series' depth (Pelletier's Planets in Aspect and Planets in
Houses for natal aspects and placements) sets the model for the whole
grid. Concretely, that means:

- **Essay-length entries, not blurbs.** Major cells — transits, natal
  aspects, placements, synastry, composite — run 300–700 words: a
  statement of the theme, then how it plays out across the life areas it
  touches. Short cells (condition chips, decans, degree symbols) run
  proportionally.
- **Second person, psychological, non-fatalistic.** A transit describes a
  climate the reader is living in. Hard transits get their real weight
  without doom language.
- **Keyed to the engine's precision.** Entries account for applying vs
  separating, retrograde re-hits (the three-pass transit), house context,
  and orb strength — details the engine computes natively (`phase`,
  `strength`, `find_aspect_dates`), so the text can address them exactly
  where the generic books hedge.
- **Written new.** The tradition these books defined lives in frontier
  training and the open literature; the research pass distills it and the
  write pass produces original text. No copying.

### Why Caelus is built for synthetic content

The interpretation layer makes content a **finite, enumerable, machine-
checkable grid**:

1. **The terminal space is closed.** 17+ atom kinds with stable ids; every
   cell a rule can target is known in advance.
2. **The binding is validated even when the prose is young.** The
   delineations pipeline (`PassageRecord` → `SelectorSpec` → compiled rule)
   ships with a test harness proving every rule binds to a legal atom, fires
   only for its condition, and cites only real facts. Agent-written content
   inherits this floor: *the geometry a sentence attaches to is never wrong,
   even if the sentence itself needs editing.*
3. **Provenance is native.** Every entry carries source/tradition tags. The
   synthetic corpus ships as its own tagged source with its own semver;
   `reconcile()` already groups and flags conflicts between sources.
4. **Salience ranks the reading.** The atom ranking decides what leads, so
   a reading is never a 200-paragraph dump.

### The interpretation grid (written new, every cell)

Counts assume the 13-body default set.

| Cell | Count (≈) |
|---|---|
| Planet in sign (13×12) | 156 |
| Planet in house (13×12) | 156 |
| Aspect: planet–planet × 5 aspects (55 pairs, + Chiron/node pairs) | 275+ |
| Rising sign / MC in sign | 24 |
| Angle conjunctions (planet on ASC/MC/IC/DSC) | 52 |
| Dignities (10 planets × domicile/exalt/detriment/fall/peregrine) | 50 |
| Patterns (8 kinds, + per-apex-planet for T-square/yod) | ~30 |
| Signature (dominant/lacking element ×4, modality ×3, hemispheres, ruler ×10) | ~30 |
| Lots (7 lots × sign 12 + house 12) | ~170 |
| Reception / dispositor archetypes | ~25 |
| Fixed stars (curated ~60 stars × relevant bodies) | ~120 |
| Out of bounds (per body) | ~9 |
| Parallels (55 pairs) | 55 |
| Transits (10 transiting × 13 natal × 5 aspects) | ~650 |
| Transit through house (10×12) | 120 |
| Synastry (10×10 pairs × 5 aspects) | ~500 |
| House overlays (10 planets × 12 houses) | 120 |
| Composite (planet in house + aspects, composite voice) | ~250 |
| Time-lords (profection houses + year lords, ZR periods, firdaria lords + subs, dasha lords + antars) | ~205 |
| Nakshatras (27 × Moon + padas, then the other bodies) | 27–130 |
| Vargas (D9 placements 9×12 + per-varga framing) | ~120 |
| Yogas (named set + raja/dhana framing) | ~20 |
| Eclipse/lunation in house + on natal planet | ~37 |
| Retrograde natal + transit stations | 20 |
| Planetary-return framings (Saturn, Jupiter, nodal…) | ~12 |
| Birth-time finder question bank (rising-sign fit descriptions + life-event→angle templates) | ~42 |
| Journal prompt bank (keyed to transiting planet × natal point family, moon phases, year points) | ~120 |
| Solar phase (cazimi/combust/under-beams per planet) | ~15 |
| Decans | 36 |
| Sabian symbols (360 degrees; rights check on the 1925 Jones text, else write our own degree symbols) | 360 |
| **Full grid** | **≈ 4,100 entries** |

### The education library (written new, at launch)

Tutorials and guides get the same at-scale treatment as the delineations.
The coverage rule: **every artifact the app can produce ships with a
matching "how to read this" guide, and every tool ships with a "how to use
this" walkthrough.** A user is never handed a chart the Learn section
cannot teach them to read.

| Family | Contents | Count (≈) |
|---|---|---|
| Reading the birth chart | A full tutorial series: the wheel, the big three, planets, signs, houses, aspects, patterns, dignities, chart shape, putting a whole reading together | ~40 |
| Casting charts | Entering birth data, finding a birth time, choosing house systems and zodiacs, orbs, saving and sharing, relocating | ~15 |
| Reading each chart type | One guide per artifact: transit chart, synastry, composite, Davison, solar return, lunar return, planetary returns (Saturn return in depth), progressions, solar arc, primary directions, harmonics, antiscia, draconic-parity charts as they land | ~30 |
| Timing techniques | Profections, zodiacal releasing, firdaria, the three dashas, transits as periods, eclipses, retrogrades, planetary hours, void-of-course, electional basics | ~35 |
| Vedic path | Sidereal vs tropical, nakshatras, vargas, dashas, yogas, reading the D9 | ~20 |
| Tools walkthroughs | Date finder, astrocartography, timeline, birth-time finder, the Planetarium, Chart Lab, similar skies, ephemeris, calendars, AI prompt packs | ~25 |
| Glossary | Every sign, planet, body, house, aspect, dignity, technique, and term the app surfaces | ~180 |
| FAQ + concepts | "Why is my rising sign different here?", house-system differences, tropical vs sidereal, orbs, why times matter | ~30 |
| **Education library** | | **≈ 375 pieces** |

Programmatic-page framing copy is generated from the same grid and library
— one corpus, two renderings: in-app text and SEO page prose.

### The generation pipeline (agents, grounded, validated)

```
1. Research pass    — per cell family, agents distill what the tradition
                      commonly says into a theme brief per cell, from model
                      knowledge and deep research into the well-trodden
                      canon. No verbatim copying from in-copyright works.
2. Voice pass       — consumer register per docs/editorial-voice.md, plus
                      content-safety rules to settle: non-fatalistic
                      framing; no medical, financial, or legal directives.
3. Write pass       — agents emit PassageRecord JSON (text + SelectorSpec +
                      weight + tags + conflicts declarations) for grid
                      cells, and MDX for education pieces.
4. Validate pass    — the existing harness: legal atom binding, fires-only-
                      for-condition, citation integrity. Plus new lint:
                      length bands per cell family (essay-length for major
                      cells, per the quality bar), banned phrases, reading
                      level, duplication similarity.
5. Review pass      — second-model adversarial critique per entry: accuracy
                      against the tradition brief, voice, safety, and depth
                      against the quality bar. Sampled human spot-checks.
6. Ship as a source — its own package with its own semver and tagged
                      provenance.
```

Post-launch, per-entry feedback ("was this apt?") re-queues the
worst-rated cells for rewrite each cycle.

## 7. AI prompt handoff — deterministic prompts from artifacts

Every computed artifact can generate a deterministic, LLM-ready prompt the
user drops into ChatGPT, Claude, or Gemini for an enriched reading (career,
love, transits, birthday, year ahead). The machinery is already shipped in
the engine; this is a thin product layer over four existing pieces:

1. `interpretationContext(chart)` projects the artifact into ranked, id-
   tagged fact atoms — deterministically (same chart in, same atoms out).
2. `chartBrief(ctx, opts)` already renders those atoms into a ready LLM
   prompt with kind filters and caps, plus `BRIEF_INSTRUCTIONS` telling the
   model to write original prose and cite the `[id]` behind each claim.
3. Canonical mode gives the chart a stable digest — so a prompt can carry a
   fingerprint (`chart a1b2c3…, caelus 0.24.1, corpus 0.2.0`) making it
   *reproducibly* deterministic across sessions and devices.
4. `auditCitations(claims, ctx)` can verify any pasted-back AI answer against
   the facts — flagging every invented placement.

**Product design — "Prompt packs":** every artifact (natal, synastry,
composite, transit day, solar return, dasha period…) gets an "Ask your AI"
panel with theme chips. Each theme is a deterministic recipe:

| Theme | Atom selection (deterministic filters) | Extra context injected |
|---|---|---|
| Career | placements/aspects touching MC, 10th/6th/2nd houses, MC ruler, Saturn/Jupiter atoms, relevant dignities | profection lord if year-relevant |
| Love | Venus/Mars/Moon atoms, 5th/7th/8th houses, DSC ruler, relevant aspects | synastry atoms if a partner chart is attached |
| This year | transit atoms within the year, profection + lord, active ZR/firdaria/dasha, solar-return highlights | birthday date, age |
| Birthday | solar-return chart atoms + return-vs-natal contacts | relocation note |
| Today | transit atoms in orb now, lunar phase, VoC state | cosmic-weather patterns |
| Full natal | top-N by salience across all kinds | signature + patterns |
| My journal | corpus aggregates over a window (themes, emotion arc, top transits during writing) | profection year, volume label |
| Neighborhood | the graph neighborhood of a chosen planet, house, or person, serialized deterministically | active transits touching it |

Each recipe = fixed kind/body/house filters + salience cap + fixed template
(role, task, tone, length, citation instruction, guardrails: "positions are
provided and final — do not recompute or invent placements; if a fact you
need is absent, say so"). Same artifact + same theme + same versions →
byte-identical prompt. One-click copy; optional prefilled deep links where
consumer AIs accept URL-encoded prompts.

**The trust closer:** a "Check the reading" page — paste the
AI's answer back, `auditCitations` verifies every `[id]`, and we render
which claims rest on real facts vs invented ones. No product anywhere offers
verifiable AI astrology; this makes us the grounding layer for everyone
else's AI, which is exactly the engine's strategic posture (the hosted MCP
server is the same move for agents).

## 8. Design

Caelus Free has its own visual identity, designed for consumers. The
developer site's design system was built for documentation and proof
pages, which is a different audience and a different job, so none of it
carries over by default.

Two visual languages, each where it makes sense: **civil twilight** for
the sky surfaces (onboarding, Today, the Planetarium, Places — the chrome tracks
the real sky's light, driven by the engine's twilight and sky-brightness
math) and **the almanac** for the written-down surfaces (charts, tables,
calendars, ephemeris — two-ink discipline where live figures print in
peach blossom against black tables). The onboarding translation scene is
the bridge between them: the sky, written down. Peach blossom is the
fixed point across both, under one law — **peach marks what is alive**:
the current sky, the now-line, exact hits, the reader's own placements.
Structure and chrome never wear it.

The research input for the rest of the design work:

What the design research found:

- Three visual lanes have proven they can carry an astrology brand:
  stark monochrome (Co–Star), warm editorial serif and gradient (CHANI),
  and clinical dark minimalism (The Pattern). The generic
  purple-cosmic-gradient-with-gold-glyphs look is the saturated genre
  default and no longer differentiates.
- Whatever lane is chosen needs to be systematized into real tokens with
  honest light and dark themes — Sanctuary's conversion reportedly rose
  120% after its brand was rebuilt as a design system.
- The classical chart color semantics (red hard aspects, blue soft,
  element colors for signs) are worth keeping in the wheel because
  experienced readers already read them fluently.
- Custom thin-line glyph sets are the norm; system fonts for glyphs read
  as cheap.

Interface primitives the app needs designed regardless of identity:
reading cards that can cite their placements, transit duration bars,
timeline lanes, calendar chips, the wheel's light and share palettes, and
designed share images (wheel plus big three). The wheel's per-body colors
and theme hooks already exist in `caelus-wheel`, so any identity can drive
them.

## 9. Constraints & mitigations (from the capability inventory)

| Constraint | Impact | Mitigation |
|---|---|---|
| Embedded (browser) Moon tier valid 1920–2080; `/api/chart` rejects outside | Client-side charts for birthdates before 1920 lose Moon precision | Serve wide-tier packs on demand (lazy-fetch `moon_cheb` segments) or fall back to the hosted Node tier for out-of-range dates; always show the range chip. Covers virtually all living users at launch |
| Packed bodies absent for historical dates (`unavailable`) | Chiron missing pre-1600 etc. | Honesty chips (already designed into the engine's output) |
| No published bi-wheel component | Synastry/transit rings hand-rolled in app | Lift `BiWheel` into `caelus-wheel` as `MultiWheel` (rings API) — small, well-scoped package work |
| Wheel has no interactivity built in | Tap/hover layers needed | App-side overlay (playground already does click-to-isolate); consider upstreaming hit-test helpers |
| Default aspects = 5 majors; flat per-aspect orbs | Consumer expectation of minors + luminary orbs | Custom aspect tables are already supported; ship editorial orb profiles (Modern/Traditional presets) as app config — an *editorial* choice the product owns |
| No packaged transit-timeline tool | Timeline is composed client-side | Build from `find_aspect_dates` + `stations` + `crossings` + `ephemeris`; consider a `timeline()` engine helper later |
| MCP `sky_events` ≤370 d, `find_aspect_dates` ≤50 yr | Long-range views chunk requests | Client-side engine has no such caps; caps only bind the hosted API |
| Geocoding attribution (Open-Meteo/GeoNames CC-BY) | Footer credit required if used | Offline gazetteer first; attribution line when network geocode used |
| Salience/orb/dominance conventions are editorial | Users may disagree | Named, documented, switchable presets — turn the liability into the transparency brand |
| Interpretation safety | Astrology content risks fatalism/medical-adjacent advice | Voice sheet bans directive medical/financial/legal claims; deterministic guardrails in prompt packs; disclosure page |
| Engine parity gaps vs astro.com/astro-seek | Draconic charts, tertiary/minor progressions, converse directions, local-space lines, persona charts | Small engine backlog: draconic is a trivial node-offset transform; persona charts compose from `returns()`; tertiary/minor are rate variants of the shipped progression math; midpoint lists compose from `midpointLon`. None blocks launch; queue as reference-first engine additions |
| Composer norms (Brysbaert concreteness, SUBTLEX) are English-language and externally licensed | The Composer is English-first at launch | Verify redistribution terms before shipping the packs; the sound-symbolism scalar is the language-independent layer |
| On-device NLP must fit browser budgets | Corpus analysis stays on the device | Lexicon-based analyzers first; small embedding models downloaded once and cached; annotation layers versioned by analyzer so upgrades re-annotate |

## 10. Scope

The scope is the whole map and the product layers built on it: every
feature and function in [feature-map.md](./feature-map.md), the Journal
with its annotated corpus (§5.5), the personal knowledge graph (§5.6),
the Composer (§5.10), the full content grid (≈ 4,100 entries), and the
education library (≈ 375 pieces). Build order belongs to the build plan.

Ways to measure a free product: traffic and retention (return visits to
Today), journal entries per active reader and returning writers, share-link
and prompt-pack usage, programmatic-page search footprint, MCP/API
adoption, corpus feedback rates.
