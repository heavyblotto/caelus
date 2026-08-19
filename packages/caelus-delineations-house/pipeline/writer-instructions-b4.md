# B4 writer slice — instructions (time-lords, lunations, returns, solar condition)

You are writing one slice of the Caelus Free interpretation corpus
(`caelus-delineations-house`), batch B4: the timing layer. Everything in
`pipeline/writer-instructions.md` applies (read it first, along with
`pipeline/voice-sheet.md` and `editorial/editorial-voice.md`); this sheet
adds the rules specific to period prose.

## What a B4 entry is

A transit entry describes a moving body touching a fixed point. A B4
entry describes a **chapter or a condition**: a stretch of time that has
a lord and a theme (time-lords), a monthly or half-yearly punctuation
mark in a life area (lunations, eclipses), a cycle closing and reopening
(returns), or a planet's standing next to the Sun (solar condition).
Second person, present tense, a season and never a verdict. The reader
may be meeting these techniques for the first time: the first sentence
or two may carry a plain statement of what the technique is, in ordinary
words, before the meaning starts.

## Family-specific rules

**timelord-profection** (200–550 words). Annual profections: each
birthday the year advances one house; the year takes its topics from
that house, and the ruler of the profected sign becomes lord of the
year. Year-house cells guarantee only the house (never the sign or the
lord — those differ per chart). Year-lord cells guarantee only the lord:
write the flavor a year under that planet's management tends to carry,
and note that the reader's own copy of that planet (its condition,
placements, transits this year) is where the year's story concentrates.
Month cells guarantee the house for roughly a month — lighter, quicker
prose than the year essays.

**timelord-zr** (180–450 words). Zodiacal releasing: life unfolds in
chapters (L1, years long — each sign's chapter has its classical length)
and sub-chapters (L2, months to a few years). The selector guarantees
the level and the sign. The chapter takes its tone from the sign and its
ruler's character. Do not claim which lot the releasing runs from, do
not claim peak or angularity, and do not give the sign's period length
in years (the reader's app shows the dates; your prose gives the
texture). L1 essays are chapter-scale ("a stretch of years"), L2
sub-chapter scale ("a shorter run inside the larger chapter").

**timelord-firdaria** (120–450 words). Firdaria: a fixed sequence of
planetary chapters covering seventy-five years, each planet governing a
stretch of years (the Sun a decade, Venus eight years, Mercury thirteen,
the Moon nine, Saturn eleven, Jupiter twelve, Mars seven, then the
North Node three and the South Node two), the order depending on whether
you were born by day or by night. Major cells (near the top of the
band): the chapter under that lord — what a decade-scale stretch managed
by that planet tends to be about. The node majors are shorter
punctuation chapters; write them as such. Sub cells (shorter, 120–300
words): the pair — the sub-lord's flavor working inside the major
lord's chapter; each major subdivides among the seven planets in
sequence, so a sub runs months to a couple of years. The same-lord sub
(a major's first sub is itself) is the chapter's opening stretch, its
theme undiluted. Never give exact sub-period lengths.

**timelord-dasha** (120–450 words). Vimshottari dasha, the Vedic
time-lord sequence: nine lords (the seven planets plus Rahu and Ketu,
the Moon's nodes) each govern a mahadasha of fixed years in a
120-year cycle, and each mahadasha subdivides into antardashas of every
lord in turn. Maha cells (near the top of the band): the chapter.
Antar cells (shorter): the pair — the antar lord's flavor inside the
maha lord's chapter; same-lord antars open the chapter. Use the Vedic
names (Rahu, Ketu, mahadasha, antardasha) with a plain-words gloss on
first use; do not pile on further Sanskrit terminology. Rahu leans
toward appetite, worldly reach, the unfamiliar; Ketu toward release,
interiority, the unfinished past — hedged as tendencies, never doom.

**lunation-house** (200–500 words). A New Moon or a Full Moon landing in
one of the reader's houses. New Moons open a monthly cycle in that life
area: beginnings, intentions, low light. Full Moons culminate one:
visibility, results, things coming to a head. Each house hosts a New
Moon about once a year, so the entry describes a recurring visitation,
not a rare event. The selector guarantees phase and house only — never
the sign, and never whether it is an eclipse (the eclipse cells say
that).

**eclipse** (180–500 words). An eclipse in a house is a lunation with
the volume turned up: eclipses arrive in seasons about twice a year and
revisit the same axis of houses for a year or two while the nodes move
through, so write the entry as part of a series — a chapter of
developments in that life area, not a single dramatic day. Non-fatalism
matters most here: no disaster forecasting, no "expect upheaval";
describe acceleration, exposure, doors closing and opening. The two
on-a-natal-planet cells are general (any planet of yours): write about
what it is like when the series touches a personal point — events that
feel aimed — without naming any specific planet.

**planetary-return** (300–700 words). A body has come back to the
degree it held when you were born, closing one full cycle and opening
another. Each cell names its body; Saturn's three are numbered (the
first return around the end of the twenties, the second near sixty, the
third near ninety — age framing at that resolution is guaranteed by the
cell and safe to use). Solar return: the birthday chart, the year's
reset. Lunar return: monthly, a quieter check-in. Mercury/Venus: yearly
rhythms of mind and affection. Mars: the two-year drive cycle. Jupiter:
the twelve-year growth round (the returns near twelve, twenty-four,
thirty-six...). Uranus: the once-a-lifetime return near eighty-four.
Chiron: the return near fifty. Nodal return: the ~18–19-year cycle of
direction. The entry fires while the return is in orb — days for fast
bodies, weeks to months for slow ones; keep tempo approximate.

**solar-phase** (120–350 words). A condition, not a period: the named
planet stands close enough to the Sun to change its working. Under the
beams (within about fifteen degrees): the planet works out of sight,
privately, its signals harder for others to see. Combust (within about
eight and a half): the planet's agenda is absorbed into the Sun's —
self-consciousness, the thing overshadowed by identity or by a
dominating concern. Cazimi (within a fraction of a degree): the brief
heart-of-the-Sun moment the tradition reads as the opposite — the
planet enthroned, singular clarity. These fire on a birth chart (a
lifelong signature) and on the moving sky (a passing condition) alike,
so write in terms that hold for both: "when this is your chart" /
"while this is in effect" framings are safe; "this week" is not.
Mercury and Venus hold these states often; Mars, Jupiter, and Saturn
about once a year for a few weeks.

## Facts you may rely on (and no others)

Cycle tempos stated above are guaranteed. The selector guarantees
exactly its fields. It never guarantees: the reader's age (except the
numbered Saturn returns), the sign or house of anything the selector
does not name, the reader's era, gender, family shape, occupation, or
means. Hedge biography; degender caretakers and partners; no promises,
no financial or medical directives.

## Output and self-check

Same as B1: JSON array in brief order with exactly the keys
`id`, `family`, `when`, `atomIds`, `text` (verbatim from the brief
except `text`), then

```
node pipeline/check-slice.mjs <your-brief-path> <your-output-path>
```

until it prints `slice ok`. Report one line: slice name, entry count,
check passed, plus anything worth flagging.
