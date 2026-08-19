# Competitive research: consumer mobile astrology apps (2025–2026)

Agent-gathered web research, 2026-08-15. Findings from app-store listings (via
search), vendor sites/help centers, review sites, design critiques, and market
reports. Prices marked "reported" where sources conflict. Interpretation
content and marketing copy excluded by scope; this covers features, product
structure, business model, and design/layout.

**Market context.** CHANI was the highest-grossing US astrology app as of Q1
2026, followed by Co-Star. Top five global players by share: Astrotalk,
Co-Star, Nebula (OBRIO), The Pattern, AstroSage (~25% combined). Co-Star ~20M
downloads, ~$300–400K/month revenue; Nebula 8M+ downloads; Faladdin 50M+
downloads; Astrotalk >$120M annual revenue (India-centric).

---

## 1. Co–Star

**Positioning:** social-first "hyper-personalized real-time horoscopes from
NASA data" for Gen Z/millennials; astrology as a daily social ritual.

**Model:** Free — daily personalized horoscope ("Your Day", "At a glance:
power, trouble" lists), full natal chart, friends + daily relationship
readings, compatibility, push notifications. Paid — à-la-carte IAPs
$2.99–$11.99: "Advanced Readings" (~$8.99 each: love, year-ahead), charts for
non-users ($2.99), couples "Eros" content. Some 2025–26 sources report a
"Co-Star Plus" subscription (~$14.99/mo or $99.99/yr), not consistently
corroborated.

**Features:** natal chart with 10 planets + ASC/MC, houses (Porphyry default —
unusual; settings offer Placidus and "I Don't Care"), aspects; chart viewable
as table or wheel; daily transit-based horoscope; friends list (username
search/contact sync) with per-friend daily relationship readings; "note to
future self"; signature daily push notification. No journaling, no
progressions/returns, no astrocartography, no live astrologers, no moon
tooling, weak widgets.

**Design:** brutalist black-and-white, line-art planet glyphs, serif + mono
mix, enormous whitespace. Top-persistent nav (Update feed / chart / friends /
profile), not a bottom tab bar. Text-first; interpretations are short
aphoristic fragments. Onboarding: birth data + mandatory account + phone
number, contact-sync prompt. Signature: the cryptic/rude daily push as viral
growth channel — "a personality, not a utility."

**Complaints:** harsh notification tone; bot-only support; notification bugs;
poor signifiers around paid features (Pratt IXD critiques); AI-copy suspicion;
no synastry depth, no composite, no educational scaffolding.

## 2. The Pattern

**Positioning:** "personality insight" app that hides astrology behind
psychological language; depth-seekers and astrology-skeptics; dating angle.

**Model:** Free — "Your Pattern" personality analysis, daily updates for self
+ partner/friends, Bonds capped ~3/day, partial library, limited Connect
(dating). Paid — Go Deeper+ from $14.99/mo: unlimited Bonds (incl. celebrity
database), romantic timing cycles, full library, audios/360 meditations, full
Connect.

**Features:** natal-derived analysis as "Your Pattern"
(Foundational/Relational/Composite trait sections) — no glyphs, signs, or
planet names anywhere; "Your Timing" — personal transit cycles as life-phase
narratives with date ranges (transits never named); "World Timing" collective
cycles; Bonds = synastry engine outputting six labels (soulmate,
extraordinary, powerful, meaningful, complex, delicate/challenging); Connect =
astrological dating; friend graph; audio meditations. No visible chart wheel,
no houses/aspects exposed, no journaling, no moon tools.

**Design:** dark cosmic (deep navy gradients, thin light sans), card/panel
text UI. Bottom nav: Profile / Bonds / Timing / World / Connect. Onboarding:
birth data → immediate "scarily accurate" reading (the viral hook). Signature:
total translation of astrology into therapy-adjacent language; timeline
visualization of cycles (duration bars, V5 "Time Travel" date scrubbing).

**Complaints:** aggressive paywall migration (formerly free features moved
behind Go Deeper+); $14.99/mo seen as expensive; opacity of method; mixed
dating reception.

## 3. CHANI

**Positioning:** premium editorial astrology + mindfulness from Chani
Nicholas; queer-inclusive, ritual/self-care; skews female, slightly older.
Highest-grossing US astrology app (Q1 2026).

**Model:** Free — rising-sign daily horoscope, moon phase/sign readings, one
daily meditation, basic chart view ("very limited without paying"). Paid —
$11.99/mo or $107.99/yr single tier: full written birth-chart reading
placement by placement, Week Ahead (written + podcast audio), Year Ahead
workshops, quarterly sign readings with rituals/journal prompts, full
meditation library, planetary horoscopes, prompted journal.

**Features:** whole-sign natal chart as wheel + placement list (MC/IC/DC added
later); "Current Sky" transits; daily/weekly/yearly content; moon tracking;
guided meditations; journal with astrology-tied prompts; readings update on
sign ingresses. NO compatibility/synastry, no composite, no social layer, no
astrocartography, no dark mode.

**Design:** collage-art / zine identity — warm lilac/cream/gold, textured
paper-cut illustration, white-dominant. Home = stacked Today / This Week /
This Year. Onboarding praised as "magical" — data entry staged as chart
creation with animated transitions. Signature: audio-first content, ritual
framing, human-written long-form.

**Complaints:** nearly everything paywalled; ~$12/mo steep; Android bugs; no
dark mode; rising-sign-only personalization; no compatibility; no multiple
profiles.

## 4. Sanctuary

**Positioning:** "astrology as texting" — chat-based horoscopes + on-demand
marketplace of live astrologers/psychics/tarot readers.

**Model:** Free — daily horoscope as chat, basic birth chart with placement
explanations, chat-style education. Per-minute readings ~$2.99/min (intro
$4.99/5min), 100+ readers, 24/7. Sanctuary+ $19.99/mo or $199.99/yr: full
Explore library, 5-min reading credit, expanded horoscopes, unlimited
compatibility calculator.

**Features:** natal chart as cards/chat with tap-through explanations (wheel
de-emphasized); conversational daily horoscopes; compatibility calculator;
tarot/crystal content; live 1:1 readings; educational chat modules;
notifications. No progressions/returns, no journaling, no social graph, no
widgets.

**Design:** messenger metaphor throughout — horoscopes arrive as message
bubbles "bit by bit"; playful, colorful, meme-literate; conversational
onboarding via chat bot. Signature: conversational drip UI + human-marketplace
upsell in the chat. A design-system rebuild (ijr.design) reportedly lifted
conversions 120%.

**Complaints:** reader quality/suspected scripted responses; constant minute
upsells; refund denials; astrology as funnel to psychic marketplace.

## 5. Nebula (OBRIO)

**Positioning:** mass-market spiritual super-app (astrology + tarot +
palmistry + psychics), acquisition-funnel driven.

**Model:** $7.99/week (3-day trial), $24.99/mo, $29.99/3mo; psychic chat
~$3.99/min separately; heavy web-to-app quiz funnels; effectively no free
tier.

**Features:** natal wheel with transits; daily/weekly/monthly/yearly
horoscopes; synastry reports + couple guidance; tarot; palmistry via hand
photo; numerology; dream interpretation; biorhythms; article library;
community feed; 1000+ psychic advisors; AI-generated readings layered with
humans.

**Design:** dark cosmic purples/void black with electric blue; one-tab-per-
feature bottom nav; quiz-funnel onboarding ending at a paywall.

**Complaints:** widely reported dark-pattern billing (intro rolling into
expensive auto-renew), difficult cancellation, generic/AI-ish content.

## 6. AstroMatrix

**Positioning:** free, report-heavy "real astrology" workhorse for hobbyists.

**Model:** free ad-supported (nearly everything); ad-removal $9.99/6mo,
$14.99/yr (reported); some premium report add-ons.

**Features:** natal chart with full planet set PLUS asteroids (Chiron, Lilith,
Juno, Vesta, Pallas, Ceres, Pholus); house/aspect breakdowns; transit-based
daily horoscopes; transit forecasts to the minute; secondary progressions
report; synastry for saved profiles (10 free); 3-card tarot; widgets; website
mirrors app. No live readers, no social, no meditations, no journaling.

**Design:** dark mystic-purple but dated, busy, cluttered — dense menus,
hybrid/Cordova feel, banner ads. Maximal free depth, minimal polish.

**Complaints:** clunky UI, ad-load failures, navigation confusion.

## 7. TimePassages (Astrograph)

**Positioning:** the "learn real astrology" app (since 1995, Henry Seltzer)
for students and serious hobbyists.

**Model:** Free — full natal chart with tap-anything interpretations +
personalized daily horoscope. Paid — extra charts $0.99 each, or Pro $7.99/mo:
unlimited charts, transit bi-wheels, secondary progressions, solar arc,
synastry AND composite with interpretations. Desktop editions sold separately.

**Features:** full wheel — 12 houses, aspect lines color-coded by type and
thickness-coded by orb strength; optional Chiron, Lilith, asteroids, centaurs,
TNOs; house system + display options (glyph size, elemental color coding);
tap any placement/aspect for in-depth human-written interpretation (2,500+
paragraphs); "Current" live sky tab; "Learn" glossary tab; multiple chart
storage. No social, no live readers, weak notifications/widgets.

**Design:** classic astrology software modernized — colorful wheel front and
center, tab nav (Chart / Current / Learn / Settings). Signature: the
tap-to-interpret wheel as primary interface — the opposite of Co-Star/Pattern
text-first.

**Complaints:** post-rewrite glitches; utilitarian rather than lifestyle
branding; no social hooks.

## 8. Time Nomad

**Positioning:** free pro-grade calculation tool for practicing/technical
astrologers (electional work, planetary hours); iOS only.

**Model:** free core, no ads, no account; à-la-carte one-time IAPs: widgets,
fixed stars, event explorer, VoC Moon, node direction, lunar mansions,
synastry transits, progressed charts, extra planets/asteroids. No
subscription.

**Features:** high-precision charts any date within centuries; tropical AND
sidereal; natal/transit/synastry/progressed; chart animation with time
scrubbing (electional); planetary hours with alarms; extensive widget suite
(current sky, planetary hour, moon phase, nakshatra); fixed stars; event
explorer (upcoming aspects/ingresses). Minimal interpretation by design.

**Design:** utilitarian, data-dense; an instrument, not a lifestyle product.
Signature: home-screen widgets of the live sky + time-scrub animation.

**Complaints:** overwhelming for beginners; no guidance; iOS-only.

## 9. Moonly

**Positioning:** moon-calendar-led "cozy spiritual wellness" (Vedic-influenced)
blending lunar days, tarot, runes, meditations.

**Model:** free lunar basics, affirmations, tarot pulls, some meditations;
subscription ~$3.99/mo plus one-time purchases: birth chart $14.99, yearly
forecast $7.99, compatibility $7.99, runes course $49.99, rituals $49.99.

**Features:** moon phase + lunar day tracking with do/don't guidance (incl.
Vedic haircut/gardening calendars); nakshatra content; daily affirmation;
tarot + runes; meditations; mini-articles; natal chart and compatibility as
paid add-ons; moon notifications; moon-phase widgets. No transit engine, no
synastry depth, no social.

**Design:** signature illustrated aesthetic — warm dark "magical" hand-drawn
art (recently shifted to AI imagery, controversially); tabs: Calendar,
Practice, Healing, Wisdom. Signature: the illustrated daily lunar card ritual
loop.

**Complaints:** paywall creep; confusing one-time vs subscription stack;
cancellation difficulty; AI-art backlash.

## 10. Astro Future

**Positioning:** clean visual self-serve chart exploration ("positive
astrology"); one developer; 4.8 App Store rating.

**Model:** Free — full birth chart with detailed interpretations, transit
charts, daily horoscope, unlimited saved people, widgets. Paid ~$3.99/mo —
full transit interpretations, extended timeline (1900–2050) with special
events, unlimited synastry, interactive 3D solar system.

**Features:** natal wheel with tappable aspect lines → per-aspect
interpretation; configurable house systems and zodiac (incl. sidereal);
transit chart with scrollable past/future timeline; NASA-data solar system
view; synastry; daily horoscope in-app + widgets; unlimited profiles; annual
astro-dates lists; light/dark themes.

**Design:** modern, uncluttered, visual-first — wheel + timeline scrubber + 3D
planetarium as hero interactions. Signature: direct manipulation of time
instead of editorial daily content.

**Complaints:** few; requests for deeper interpretation/techniques.

## 11. Others

- **Astrotalk** (top global revenue, India): wallet + per-minute chat/call
  with 48,000+ astrologers; free kundli, matching, horoscopes, live streams;
  Vedic/KP/Nadi/tarot/numerology/palmistry/Vastu. Utility-commerce design.
- **Hint** ($29.99/mo after $1 trial; web funnel): AI + human astrologers,
  palmistry, soulmate sketches; recurring billing complaints.
- **Faladdin** (50M+ downloads): free tarot/coffee/palm readings, no ads,
  premium upsell; entertainment-oriented.
- **AstroSage** (India, Android-heavy): free Vedic kundli + astrologer
  marketplace.
- Adjacent: astrology.com Astrology+, psychic marketplaces (Purple Garden,
  Keen), AI-native readers.

---

## Synthesis

### (a) Feature matrix (F free, P paid, — absent)

| Feature | Co-Star | Pattern | CHANI | Sanctuary | Nebula | AstroMatrix | TimePassages | Time Nomad | Moonly | Astro Future |
|---|---|---|---|---|---|---|---|---|---|---|
| Natal chart wheel | F (wheel+table) | — (hidden) | F | F (cards) | P | F | F | F | P ($14.99) | F |
| Chart interpretation | F (short) | F/P (translated) | P (full) | F (basic) | P | F | F (tap) | — | P | F |
| Extra bodies (Chiron/asteroids) | — | n/a | — | — | — | F | P/opt | P (IAP) | — | — |
| Personalized daily (transits) | F | F | F (rising) | F | P | F | F | — | — | F |
| Synastry/compatibility | F (friends) | F capped / P | — | P | P | F | P | P (IAP) | P | P |
| Composite | — | P (timing) | — | — | — | — | P | — | — | — |
| Transit tracking | F | F/P (narrative) | F/P | — | P | F | P (bi-wheel) | F | — | F/P |
| Progressions/solar arc/returns | — | — | — | — | — | F (prog) | P | P (IAP) | — | — |
| Moon tracking | min | — | F | min | P | min | F | F+widgets | F (core) | F |
| Widgets | weak | weak | weak | — | some | some | — | strong | F | strong |
| Social/friends | F (core) | F + dating | — | — | feed | — | — | — | — | local profiles |
| Journaling | note-to-self | — | P (prompted) | — | — | — | — | — | — | — |
| Meditations/audio | — | P | P | — | — | — | — | — | F/P | — |
| Tarot etc. | — | — | — | P | P | F | — | — | F/P | — |
| Live readers | — | — | — | per-min | per-min | — | — | — | — | — |
| Birth-time rectification | — | — | — | — | — | — | — | — | — | — |
| Astrocartography | — | — | — | — | — | — | — | — | — | — |

### (b) Almost-always-paywalled features

1. Synastry beyond a teaser (everywhere except Co-Star friends and AstroMatrix)
2. Full written natal readings (placement-by-placement)
3. Advanced predictive techniques — progressions, solar arc, bi-wheels, composite
4. Charts for people not on the app / unlimited profiles
5. Audio libraries
6. Human time (always per-minute, on top of subscriptions)
7. Year-ahead / annual forecast reports

The universal free hook: daily personalized horoscope + basic chart display.

### (c) Recurring design patterns

- Two visual poles: stark editorial minimalism (Co-Star, Pattern) vs dark
  cosmic-purple mysticism (Nebula, AstroMatrix, Moonly); CHANI's warm collage
  and Sanctuary's chat UI are the third ways.
- Text-first vs wheel-first split; nobody has solved "beginner-legible wheel."
- Onboarding = birth data as theater ending in an instant "scarily accurate"
  payoff.
- Time-structured home feeds (Today/Week/Year; Your Day; Timing/World Timing).
- The daily push notification as retention engine.
- Single-tier subscription (CHANI, Pattern) vs à-la-carte (Co-Star, Moonly,
  Time Nomad) vs per-minute marketplaces (Sanctuary, Nebula, Astrotalk).

### (d) Market gaps

1. Astrocartography and birth-time rectification absent from every major
   consumer app.
2. Returns and electional tools for normal people — no consumer-friendly
   "pick a good date" product.
3. **Beautiful + deep is unclaimed**: polished apps are shallow (Co-Star,
   Pattern); deep apps are ugly or intimidating (AstroMatrix, Time Nomad,
   TimePassages). Astro Future is the closest bridge and is tiny.
4. Social + real astrology: no one combines a genuine synastry/composite
   engine with a social layer and chart sharing.
5. **Trustworthy monetization is a differentiator**: dominant complaints are
   dark-pattern billing and paywall creep; a transparent free tier is a
   positioning opening.
6. Underserved surfaces: widgets, dark mode (CHANI lacks it), Android parity.
7. Journaling/reflection loops barely exist (CHANI only); nobody closes
   "transit → prompt → entry → retrospective."
8. AI used for cost-cutting, not product; a well-scoped, ephemeris-grounded
   AI chart-chat remains open at the quality end.
