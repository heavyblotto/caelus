# Design research: astrology product UX pattern library (2025–2026)

Agent-gathered web research, 2026-08-15. Built from design critiques (Pratt
IXD, DeMagSign), UX case studies (ScreensDesign, Mobbin flows, Noao CHANI
study, ijr.design Sanctuary design system, Fabien Cartal Co-Star IA
redesign), astrologer-written reviews, press, and product support pages.

**The landscape in one paragraph.** Three design cultures: editorial/
lifestyle apps (Co-Star, CHANI, The Pattern, Sanctuary) treat astrology as
content and identity — text-first, chart-second, brand voice, freemium.
Calculator sites (astro.com, astro-seek, Cafe Astrology) treat astrology as
computation — form → chart image → tables, utilitarian, SEO-dominant, free.
Bridge products (astro-charts, TimePassages) do real chart wheels PLUS
plain-language layered explanation with modern design — the least crowded and
most praised zone.

## 1. Onboarding & birth-data collection

- **One-question-per-screen wizard** (Co-Star, Pattern, CHANI): birth data
  collection IS the onboarding, reframed as "creating your chart."
- **Onboarding as ritual** (CHANI): data entry staged as "magical step-by-step
  creation of one's birth chart," animated collage transitions. The data-entry
  moment is the emotional peak of first-run.
- **Instant-result form, no account** (astro-charts, astro-seek,
  cafeastrology): single form → full chart immediately. astro.com: guests can
  calculate; free registration stores 100 birth datasets (account as
  save/sync, not gate).
- **Unknown birth time — the respect test:** cafeastrology/astro.com offer an
  explicit checkbox that suppresses ASC/houses rather than fabricating them;
  CHANI advises noon + flags reduced precision + educates + allows later
  correction; Co-Star effectively requires a time (criticized); Pattern
  requires exact time.
- **Progressive commitment:** value first, soft paywall later (CHANI).

Synthesis: 3–4 step conversational wizard, city autocomplete, first-class
"unknown birth time" path (noon chart + suppressed houses + explainer + easy
edit). Defer accounts until the user wants to save.

## 2. Information architecture

- Co-Star: Update feed / Friends / Your Chart — social-first; IA criticized
  (content buried under poetic labels).
- CHANI: Home (Today/Week/Year) / Me (chart) / Transits / Listen / Grow +
  journal. Case-study critique: hubs must be predictable nouns; users
  couldn't re-find readings.
- Pattern: Your Pattern / Bonds / Timing / World / Connect.
- Sanctuary: horoscope feed + reader marketplace (IA organized around booking
  a human).
- astro.com: portal mega-menu; power three clicks deep behind jargon.
- astro-seek: homepage as categorized sitemap of hundreds of calculators.
- astro-charts: small tool set, each a clean page; chart page = person hub.

**Canonical modern IA:** five predictable hubs — Today / My Chart /
People (compatibility) / Tools (explore) / Learn — chart page as person-hub;
bottom tabs on mobile, same five nouns as top nav on web.

## 3. Chart wheel presentation

Three strategies:
- **No-wheel text-first** (Pattern, Sanctuary, Co-Star's primary surfaces):
  maximal accessibility, zero learnability — users can never graduate.
- **Wheel-as-artifact** (Co-Star): minimalist monochrome wheel as identity
  object; the placements list with tap-through is the real UI.
- **Interactive layered wheel** (TimePassages, astro-charts; CHANI between):
  TimePassages = reference for tap-to-explain (any planet/aspect → paragraph;
  one screen serves beginners and experts via tap, not modes). astro-charts =
  reference for layer control (toggle house systems, orbs, aspect sets,
  pattern highlighting; placements explained in plain language below).
- **Static image wheel** (astro.com, astro-seek, cafeastrology): precise,
  printable, non-interactive — exactly the exploited gap.
- Legends: modern products make the placements table BE the legend, with
  two-way hover/tap sync between table row and wheel element.

Synthesis: responsive SVG wheel where (a) tapping anything opens a
plain-language card, (b) default simplified view (big three highlighted,
major aspects only), (c) "advanced" toggle reveals degrees/minor aspects/
house-system switcher, (d) placements list doubles as legend with two-way
highlighting.

## 4. "Today" / transit surfaces

- Co-Star: "Day at a Glance" — daily thesis + transit sections + signature
  Do/Don't word lists; the cryptic daily push notification is the growth
  engine (meme genre; high risk/reward).
- CHANI: Today / This Week / This Year stacks; long-form warm readings tied
  to named transits, each linked to a practice (meditation, journal prompt) —
  the insight → action pipeline.
- Pattern: transits as named cycles with DURATION BARS (start/peak/end) and
  V5 "Time Travel" date scrubbing — transits as periods you are inside, not
  daily fortune cookies. Its core UX innovation.
- Sanctuary: daily horoscope as a chat thread.
- Calculator sites: on-demand calculators, zero ambient presence.

Synthesis: relevance-ranked card stack, one transit per card, plain headline,
expandable to the astrology (transit, orb, dates), duration bar; date
scrubber to look back/ahead; one daily quotable notification, opt-in.

## 5. Compatibility surfaces

- Co-Star: friend graph + named dimensions (Basic Identities, Intellect &
  Communication, Love & Pleasure, Philosophies of Life) side-by-side;
  criticized when reduced to an unexplained "73% compatible" score.
- Pattern (category leader): Bond types as named qualities (Soulmate /
  Extraordinary / Powerful / Meaningful / Complex / Delicate / Challenging) +
  themed prose dimensions + premium Bond Transits with date scrubbing. No
  bi-wheel, no glyphs.
- CHANI: deliberately none.
- astro-charts: the only line showing the real bi-wheel AND explaining every
  inter-aspect and overlay in plain English.
- astro.com/astro-seek: full calculators, raw and unexplained.

Synthesis: (1) named verdict as a quality, not a percentage; (2) 4–6 named
dimensions in prose; (3) provenance on demand — expand to see the synastry
aspects behind each dimension; (4) bi-wheel one tap deeper. Unexplained
scores are the most-criticized pattern in the category.

## 6. Data tables

- 1990s baseline (astro.com, astro-seek, cafeastrology): dense HTML tables to
  the arc-second; triangular aspect grids as images. Powerful, hostile to
  newcomers.
- Modern restyle (astro-charts, TimePassages, Co-Star, CHANI): row = card
  (glyph in circle, name, sign+degree, house chip, tappable); aspects as
  sentences sorted by strength, majors first, minors behind "show more";
  progressive precision (degrees rounded by default, exact in expert mode);
  chart ↔ table two-way highlighting.
- Unsolved on the web: a responsive aspect grid (wide by nature; modern
  products use a sorted list on mobile, grid desktop-only in a scrollable
  container).

Synthesis: keep astro.com's completeness, default to card-index
presentation, ship a "data view" toggle exposing the dense classical table.

## 7. Visual language

- **Co-Star — monochrome brutalism:** near-pure B/W, grotesque sans, hairline
  rules, fine-line etched celestial illustration; austerity as the brand;
  made astrology feel intellectual and ironic at once.
- **CHANI — warm mystic editorial:** sunrise gradients (gold/terracotta/
  plum), collage and texture, serif display over humanist sans, gold
  linework glyphs. Caution from case studies: beautiful but busy on small
  screens.
- **Pattern — clinical dark minimalism:** dark slate, geometric sans, zero
  zodiac iconography, abstract particle motion; proof astrology can be
  credible with no mystical signifiers.
- **Sanctuary — pop maximalism:** bright purple/pink, retro-70s type,
  chat-bubble UI; systematizing the brand (design system) reportedly lifted
  conversion 120%.
- **Moonly:** hand-drawn folk-art; AI-art drift now diluting the brand — a
  cautionary tale.
- Calculator sites keep the classical color semantics (red hard / blue soft
  aspects; element colors) — worth keeping, experts read it fluently.
- Norms: custom thin-line glyph sets (never system fonts); serif = mystical/
  editorial, geometric sans = tech/clinical; "soft purples, cosmic blues,
  starry gradients + high-contrast serif" is now the saturated genre cliché.

## 8. Web-specific patterns

- Tool-per-page SEO (astro-seek, cafeastrology, astro.com): every calculator/
  sign/aspect/chart-shape gets an indexable URL; calculator + educational
  copy on the same page. Why 20-year-old sites still own search.
- Shareable chart URLs (Co-Star `/natal-chart/{id}` permalinks with
  per-placement copy; astro-charts persistent links). Modern share object =
  designed OG/story image (wheel + big three), not a raw screenshot.
- Responsive wheels: SVG sized to container; labels collapse to glyphs at
  small sizes; interpretation layer moves from side panel (desktop) to
  below-wheel accordion (mobile); wide artifacts scroll in their own
  containers.
- Account-optional persistence: localStorage-first, account-later.
- App-first brands treat web as brochure — the web-product field is left to
  the calculators. That is the opportunity gap.

## 10 design principles for a new free astrology web app

1. Make birth-data entry the ritual, not the form (3–4 steps, autocomplete,
   animated payoff; no account until saving).
2. Treat unknown birth time as a first-class mode (noon chart, houses
   honestly suppressed, explainer, easy later edit; never fabricate a rising
   sign).
3. One wheel, layered three deep (simplified default → tap-to-explain →
   advanced toggle with degrees/minors/controls). Beginners and experts share
   one URL.
4. Every number gets a sentence; every sentence can show its numbers.
   Plain-language verdicts up front, underlying aspect/orb one expand away —
   the single biggest open opportunity in the category.
5. Today = relevance-ranked stack of transit cards with duration bars + a
   date scrubber.
6. Compatibility = named quality + dimensions + provenance, bi-wheel one tap
   deeper.
7. Pick one opinionated visual lane and systematize it (tokens, real light
   AND dark themes). Generic purple-cosmic is saturated.
8. Own a URL for everything (person-chart permalinks with designed OG images;
   indexable calculator + explainer pages resolving into one engine).
9. Draw everything as responsive SVG with a two-way legend; wide tables
   scroll in their own containers.
10. One quotable daily touchpoint in a consistent voice, opt-in, with
    substance underneath.

## 5 anti-patterns

1. The unexplained score (Co-Star's "73% compatible"). Black boxes get
   punished.
2. The jargon cliff (astro.com: choosing house systems before seeing a
   chart; arc-second tables with no interpretive layer).
3. The jargon void (Pattern: astrological vocabulary erased entirely; users
   can never learn, verify, or leave with transferable knowledge).
4. Beautiful chaos / unstable hubs (CHANI: gorgeous density users can't
   re-find; texture must never outrank scannability).
5. Manipulative ambience: fear-toned notifications, paywalls interrupting a
   reading in progress, hard account walls before any chart, AI-slop imagery
   diluting a handmade brand.
