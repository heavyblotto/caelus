# Date-range expansion (Tier A)

Tracking the work to widen Caelus's supported date range beyond the former
1900-2099 headline (now **1850-2150**, landed — see below), from the Swiss
Ephemeris feasibility analysis. The lever:
the published ceiling is not a theory limit (VSOP87 holds to about 1 arcsec
across +-4000 years for the inner planets, +-2000 years for Jupiter/Saturn),
it is set by two analytic shortcuts and by what we have measured.

The headline range only moves once the
edge accuracy is measured against JPL Horizons, never on the strength of a
theory's published envelope alone.

## What bounds the range today

| Body group | Source | Range |
|---|---|---|
| Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune | VSOP87D | theory good well past 2099; now measured over 1850-2150 |
| Pluto | Chebyshev pack (Horizons barycenter) | 1700-2212; superseded the Meeus ch.37 series (hard 1885-2099) |
| Moon (precise tier) | Chebyshev fit to DE | embedded 1920-2080, full 1850-2150 |
| Moon (fallback) | Meeus ch.47 abridged | book precision over the historical span |
| Chiron, Ceres, Pallas, Juno, Vesta, Pholus | Chebyshev fit to Horizons | packs fitted 1600-2484 (Horizons serves these bodies only over ~1600-2500); validated 1850-2150 |
| Uranian bodies | Kepler element pack | validated 1800-2149 |
| Nodes, mean Lilith | analytic | no range limit |

Pluto was the one hard cliff inside an otherwise much wider envelope; the
Chebyshev pack removed it.

## Landed (network-free, this change)

The engine half is wired and inert until data arrives, the same pattern as the
Moon's full precise tier:

- **Pluto prefers a Chebyshev pack when present, else the Meeus series.** In
  `chart.ts` (`ecliptic` and `heliocentric`) Pluto routes through the generic
  packed-body pipeline when `chebPacks.pluto` is loaded, otherwise it uses
  Meeus ch.37 exactly as before. Mirrored in the Python reference
  (`chart.py`, `_has_pluto_pack`). No behaviour change without a pack: the
  full 27-suite golden run stays at 0 failures.
- **`node-loader.ts` pre-wired.** `pluto_cheb.json` is loaded into
  `chebPacks.pluto` when the file exists (`existsSync`-guarded), so dropping
  the pack into the data dir is all the Node tier needs. The pack (with the
  asteroid and Uranian packs) now ships in the npm tarball — see
  `scripts/check-tarball.mjs` — so installed Node consumers get the wide
  range, not just repo checkouts. The browser tier imports JSON statically
  and cannot pre-wire a missing file, so the playground keeps Meeus
  until/unless an embedded tier is added.
- **`fit_pluto.py`** mints the pack from Horizons vectors (Pluto body 999,
  heliocentric ecliptic J2000, geometric), scanning segment length and degree
  for the smallest pack under a 5e-6 AU residual. Default window 1700-2200.

## Landed (the data-plus-claims half, with Horizons egress)

All five remaining steps ran locally against `ssd.jpl.nasa.gov` and shipped:

1. `python fit_pluto.py` minted `pluto_cheb.json` from the Pluto **barycenter**
   (Horizons body 9, not body 999): body 999 carries Charon's ~6.4-day wobble
   (~1.4e-5 AU) that floors any smooth Chebyshev fit, while the barycenter is
   smooth and has no 1800/2199 Horizons cliff. Window 1700-2212, fit residual
   4.1e-6 AU (~0.03″). Pack written to both data dirs.
2. The pack is a Node-tier artifact, loaded via `node-loader.ts`
   (`existsSync`-guarded) and shipped in the npm tarball; the browser
   playground keeps Meeus.
3. Golden suite regenerated (`export_golden.py`) and the TS replay re-pinned;
   full 27-suite + birth/wheel green. A `1 - 1e-9` edge guard was added to both
   astrocartography implementations to skip degenerate near-tangent points
   (`acos(±1)`) that otherwise diverged ~2e-7° across languages.
4. `validate_horizons.py` now measures banded edges (core 1900-2099, extended
   1850-2150, edges 1800/2200) and writes per-band bounds to
   `horizons-accuracy.json`. The engine holds across 1850-2150; majors and
   Pluto run wider still.
5. Headline widened to the measured **1850-2150** band: `accuracy.json`
   (range + Pluto ≤3.4″, Mean Lilith ≤1.6″, and the per-body maxes from a
   `validate_swiss.py` re-run over 1851-2149), the validation/provenance pages,
   the MCP spec + server prose, both `llms.txt` copies, and the package READMEs.

## Tier B: the wide tier (minted and measured -- the headline does NOT move)

The mint ran. The packs are real and shipped; the headline stays at
**1850-2150**, because the measurement said so. This section records what was
found, since a negative result that is written down is worth more than one
that gets rediscovered.

### What the packs cover

| pack | window | sampling | true error |
|---|---|---|---|
| Pluto (barycenter) | 1000-3000 | 1 day | 8.3e-7 AU (124 km, 0.005" at 33 AU) |
| Chiron, Pholus | 1600-2484 | 1 day | 3.6-3.8e-6 AU (0.04-0.05") |
| Ceres | 1600-2484 | 1 day | 4.9e-6 AU (0.36" at 2.8 AU) |
| Pallas, Juno, Vesta | 1600-2484 | **6 hours** | 2.6-4.5e-6 AU (0.20-0.33") |

Two source limits bound this, and neither is a fit limit:

- **Small bodies exist only over ~1600-2500 in Horizons.** Their SPK solutions
  integrate orbits fit to 19th-century-onward observations, so JPL publishes
  neither earlier nor later epochs ("No ephemeris for target '1 Ceres
  (A801 AA)' prior to A.D. 1599-DEC-11" / "after A.D. 2501-JAN-01"). Bisected
  per body; all six report the same window. Only the majors and the Pluto
  barycenter run on DE441 across 1000-3000. The fit window stops 16 years
  short of the ceiling because the fit samples one maximum segment past its
  end.
- **Sampling step, not the Chebyshev grid, floors a fast body.** The cache
  interpolates linearly between rows, so for Pallas/Juno/Vesta a 1-day step
  capped the achievable error near 1e-5 AU (~1400 km) no matter how fine the
  fit -- shorter segments and higher degrees made it slightly worse, not
  better. Sampling those three at 6 hours cut it ~4x, into the target.

### Why the headline does not move

`validate_horizons.py --wide` measures a "1000-3000 wide" band (40 epochs)
against JPL apparent RA/Dec. The packs hold across it. **The analytic
theories around them do not:**

| body | 1850-2150 | 1000-3000 wide | claim | mechanism (measured -- see below) |
|---|---|---|---|---|
| Mars | 0.18" | **10.75"** | 0.7" | VSOP87 source drift vs DE441, amplified at close oppositions |
| Uranus | 1.30" | **17.05"** | 1.9" | VSOP87 source drift vs DE441, phase-locked to its 84-yr orbit |
| Neptune | 2.35" | **15.41"** | 4.6" | VSOP87 source drift vs DE441, near-linear mean-longitude drift |
| Moon | 0.39" | **10.74"** | 2.5" | outside the precise tier (Meeus ch.47) |
| Saturn | 0.44" | 3.02" | 1.0" | VSOP87 source drift vs DE441 |
| Pluto | 0.35" | 3.39" | -- | oracle frame convention (pack contributes 0.005") |
| small bodies | 0.38-0.71" | 1.4-1.8" | -- | oracle frame convention (packs contribute <=0.36") |

(Historical numbers: before the annual-aberration LATITUDE term landed,
Pluto read 5.67" and Pallas 13.34" in the core band; before the aberration
FRAME fix below, Pluto read 1.03" core / 6.91" wide and the small bodies
2.6-3.6" wide.)

The packed bodies sit at the frame-convention floor (next section) because a
pack fit over the actual span holds over it. The VSOP87-sourced outer bodies
and the Moon fallback degrade by 6-59x. So the wide packs extend *reach* --
charts outside 1850-2150 compute, and Pluto no longer lands in
`Chart.unavailable` at 1650 -- but engine *accuracy* does not follow, and the
headline is an accuracy claim. `Chart.warnings` already states this per
chart, and `engineCapabilities` reports `fitted` separately from `validated`
for exactly this reason: a pack's span and a validated span are different
facts.

### What the wide-band error actually is (measured, three mechanisms)

An earlier revision of this file attributed the wide-band degradation to
"VSOP87D truncation" and concluded that raising the headline would take a
fuller VSOP87. **Both halves of that were wrong, and the refutation is
measured, not argued:**

1. **Truncation is worth ~0.1", not 15".** The shipped `full` tier is the
   complete VSOP87D series -- Earth's term counts match the
   canonical distribution file exactly -- and evaluating Mars, Saturn,
   Uranus, and Neptune across 1000-3000 on the `full` vs the `high` tier
   moves positions by **<= 0.13"**. The series has converged; more terms
   cannot close a 15" gap. "Fuller VSOP87" is a dead end.

2. **An aberration frame-mixing bug (found here, fixed).** The small-body
   and Pluto pipelines applied annual aberration (Meeus eq. 23.3, an
   of-date formula fed the of-date Sun longitude) to the **J2000**
   direction, before precession-to-date. The `sun_lon - lon` argument was
   off by the accumulated general precession (~1.4 deg/century),
   rotating the 20.5" aberration ellipse to the wrong phase: error ~=
   2k*sin(precession/2) -- ~0.5" inside 1850-2150, up to ~5" at the
   1000/3000 edges, phase-locked to the body's orbit (the per-epoch error
   showed peaks every ~160 sampled years, antisymmetric in time). The star
   path always had the order right; the small-body and Pluto paths now
   precess first and aberrate in the of-date frame, in both engines.
   Measured effect: Pluto 1.03" -> 0.35" core and 6.91" -> 3.39" wide;
   every asteroid under 1" in the 1850-2150 band (0.38-0.71").

3. **The residual pack-body wide error is the oracle's frame convention,
   not a position error.** Horizons' *apparent* RA/Dec keeps the IAU
   1976/1980 precession-nutation models (with frame bias); the engine
   precesses with Vondrak 2011 -- the same modern family Swiss Ephemeris
   uses. The two conventions place the equinox-of-date apart by an amount
   that grows to ~2-3.7" at the 1000/3000 edges. Reconstructing both
   chains and rotating each body's direction through them predicts the
   engine-vs-Horizons residual per epoch to within the noise (e.g. Pluto
   at 2965: predicted 3.59", measured 3.39"). Both sides agree where the
   body is in ICRF; they disagree where the ecliptic origin of date is,
   because they use different generations of precession theory. A future
   validator pass can eliminate this term by comparing frame-free
   quantities (Horizons astrometric J2000) instead of of-date apparent
   ones -- this is what `validate_horizons.py --astrometric` now does, and
   it confirms the diagnosis: on the frame-free basis every packed body
   drops to well under an arcsecond across 1000-3000 (Pluto 0.129",
   Chiron 0.144", Pholus 0.054", the asteroids 0.47-0.66"), while the
   VSOP planets stay large (Uranus 20.3", Neptune 17.6"). The frame term
   was most of the packed bodies' apparent-basis error and none of the
   planets'.

   One caveat before quoting that basis for the **Moon**: it reads ~20"
   there even in the core band, and the cause is the comparison, not the
   pack -- the pack matches Horizons' own geocentric vectors to 0.005-0.025".
   Horizons' astrometric RA/Dec is reproduced exactly (0.000") by its own
   `VEC_CORR=LT` vectors, and for a geocentric target that correction is
   dominated by the *observer's* displacement during light-time: Earth moves
   40.25 km in the Moon's 1.35 s, against a measured LT-vs-geometric shift of
   40.62 km (20.7"). The engine-side astrometric quantity applies the target's
   own light-time travel (0.67" for the Moon) but not that observer term, so
   the Moon's astrometric number is not yet a position claim. Distant bodies
   are unaffected -- the term is negligible against their own motion over a
   far longer light-time -- so every other body reads sub-arcsecond.

What remains after the fix is genuine **source drift**: VSOP87 represents
DE200 (1988, pre-Voyager outer-planet orbits) to 1" over its published
envelopes, and being 1" from DE200 is not being 1" from DE441 a millennium
out. The signatures match the history: Neptune's error is a near-linear
mean-longitude drift (-15" at 1005 -> +10" at 2965), Uranus's oscillates at
its 84-year orbital period, Mars's is sub-arcsecond except at close
oppositions where a small heliocentric error is amplified by proximity.

Raising the headline takes: Chebyshev packs fit to Horizons
(DE441) for Mars/Saturn/Uranus/Neptune over the wide span -- the exact
pattern already proven by the Pluto and small-body packs, more fitting, not
position theory -- plus a wider precise-Moon pack, plus the frame-free
validator pass above. Delta-T then bounds what "validated" can mean
for the Moon and the angles before ~1500 (sigma is minutes; the smear is
tens of arcseconds), so wide-band claims are per-body and TT-honest rather
than one headline number.

### A note on oracles

`accuracy.json` (Swiss Ephemeris, ecliptic longitude) and
`horizons-accuracy.json` (JPL Horizons, RA/Dec separation) measure different
things against different references, so their numbers do not compare directly.
Pluto reads 3.4" in the first (longitude, Swiss) and 1.03" in the second
(RA/Dec separation, JPL); the Pluto entry's own note says the Swiss bound is
"vs SE's own Moshier Pluto", which is itself an approximation that differs
from JPL. Both are true statements about different comparisons.

### The annual-aberration latitude term (found here, fixed)

Chasing an unexplained Pallas reading turned up a real engine bug rather than
a data problem. `smallbody_apparent` and the Pluto path applied annual
aberration to longitude only -- Meeus eq. 23.3's longitude component, divided
by cos(beta) -- and omitted the latitude component:

    dbeta = -k sin(beta) [ sin(sun_lon - lambda) - e sin(pi - lambda) ]

That term scales with `sin(beta)`, so it is invisible near the ecliptic and
first-order for an inclined body. Pallas (inclination 34.8 deg) reached
|beta| ~ 32 deg and read **13.34"** against JPL while its *longitude* was
under 1"; the error tracked the predicted dbeta to three decimals and vanished
at the epochs where Pallas crossed the ecliptic. The pack was never at fault:
it reproduces Horizons' own vectors to 27 km (0.02") at the worst epoch.

Adding the term to both engines (four call sites: small bodies and Pluto,
TS and Python) fixed every packed body:

| body | core band before | after |
|---|---|---|
| Pallas | 13.34" | 0.97" |
| Pholus | 8.02" | 0.96" |
| Pluto | 5.67" | 1.03" |
| Juno | 4.92" | 0.85" |
| Ceres | 3.74" | 0.90" |
| Chiron | 2.60" | 0.95" |
| Vesta | 2.35" | 0.66" |

`accuracy.json` is unchanged: it publishes ecliptic *longitude* bounds against
Swiss, and this was a latitude error. A re-run of `validate_swiss.py`
confirms the longitude figures still hold (Pluto 3.34" vs the published 3.4",
Neptune 4.56" vs 4.6"). The latitude axis is now measured by
`validate_horizons.py`, and `golden.test.ts` pins the term so it cannot
silently regress.

For the hellenistic / Hermetic era (first-fifth centuries): the same
machinery runs over any window DE441 covers, which is the majors and the
Pluto barycenter -- the small bodies stop at ~1600 and no fitting reaches
past a source that does not exist. Two things bound that era, and delta T is
only the second. The first is the measurement above: VSOP87's drift against
the modern ephemeris and the Moon fallback already miss by 10-17" at the
edges of 1000-3000, so positions there are computed, not validated. Then
delta-T sigma is minutes, which smears the angles and the Moon further while
the slow bodies read fine. `Chart.warnings` states both splits per chart, so
ancient charts remain usable rather than refused, with "usable" meaning
arcminutes, not arcseconds.

## Tier C: minted -- the wide band is uniform, and the Moon is the last blocker

Every planet plus Earth is now packed (fit_planet.py), and the wide band is
uniform. On the frame-free `--astrometric` basis, all are sub-0.17" across
1000-3000 CE:

    sun 0.027"  mercury 0.045"  venus 0.116"  mars 0.088"  jupiter 0.027"
    saturn 0.018"  uranus 0.017"  neptune 0.015"  pluto 0.015"
    chiron 0.051"  asteroids 0.04-0.16"

On the apparent of-date basis (what accuracy.json publishes) the same bodies
read a uniform ~3.3" -- that is the frame-convention term, IAU 1976/1980 vs
the engine's Vondrak 2011 precession, not position error (the astrometric
basis removes it and shows the sub-0.17" figures).

**The order of operations mattered, and Mars proved it.** Packing Mars alone
bought almost nothing (7.64" -> 6.75"), because Earth is the observer and its
own VSOP error (2763 km at 2965) is the floor under every geocentric body.
Packing Earth first is what moved Mars to 0.088". Earth is fit via command
399 (the center, matching VSOP's earth series), routed through
Vsop.heliocentric in Python and an earthHeliocentric helper over the six TS
call sites. Packing Earth then *worsened* Venus and Jupiter by removing an
accidental error-cancellation (their own VSOP drift, confirmed via their
heliocentric errors) -- so they got packs too, and Mercury with them.

Two more chord-floor fixes landed here: the inner planets needed 90-minute
sampling (the interpolation chord scales with h^2 and is amplified by their
small geocentric distances), and when Mercury and Jupiter STILL floored at
~180 km flat across every degree, the actual root cause surfaced -- the cache
interpolated linearly (np.interp), flooring every fit at ~(1/8)|a|h^2.
HorizonsCache.sample() now uses Catmull-Rom cubic interpolation (O(h^4)),
which dropped both floors to single-digit kilometres on the caches already on
disk, no refetch. Fitting-side only; the runtime pack evaluation (ChebSeries)
is untouched, so engine parity holds.

The Moon is now packed over 1000-3000 (fit_moon.py, seg=64 deg=36, ~90 km,
~48" at mean distance) -- the last body off the 1850-2150 tier. The headline
decision is gated on this: the planets measure sub-arcsecond, and the Moon's
wide figure is the remaining number to stand up before "1850-2150" can
widen. (Its ~21" on the astrometric basis is the observer-light-time
comparison artifact documented above, not a position error; on the apparent
basis the wide Moon reads 3.68".)

## Tier C runbook (the mint commands)

The table shows the planet packs measured on the frame-free `--astrometric` basis
over 1000-3000 (40 epochs), before and after:

| body | pack true error | size | wide before | wide after |
|---|---|---|---|---|
| Uranus | 136 km | 496 KB | 20.33" | **0.145"** |
| Neptune | 126 km | 497 KB | 17.61" | **0.118"** |
| Saturn | 115 km | 569 KB | 5.70" | **0.349"** |
| Mars | 49 km | 5.9 MB | 7.64" | 6.75" |

Uranus and Neptune were the engine's worst bodies anywhere; they are now
sub-0.15" across two millennia. That is the Tier C thesis confirmed: their
error was source drift (VSOP87 represents DE200), removable by fitting.

**Mars did not move, and the reason bounds the whole tier.** Its pack is the
most accurate of the four (49 km), yet it stayed at 6.75". The tell is that
the bodies with *no* pack -- Sun, Mercury, Venus, Jupiter -- all sit at a
common 3.6-4.3". Every geocentric direction is `body - earth`, and Earth
comes from VSOP87D:

| epoch | Earth vs DE441 | at 1 AU | at Mars perigee (0.37 AU) |
|---|---|---|---|
| 2000 | 63 km | 0.087" | 0.24" |
| 2500 | 1312 km | 1.81" | 4.89" |
| 2965 | 2763 km | 3.81" | 10.3" |

So the ~4" floor on unpacked bodies is Earth's error projected at ~1 AU, and
Mars's residual is that same error amplified by proximity (1/distance). No
target pack can remove it: an Earth pack is the single change that lifts
every geocentric body at once, and it is what unlocks Mars's 5.9 MB being
worth shipping. `fit_planet.py` does not cover Earth yet (`PLANETS` has no
`earth` entry, and `chart.py` routes Earth through VSOP unconditionally).

The runbook below still applies to any further body.

## Tier C runbook (the mint commands)

The engine half is done, network-free, in the same inert-until-data pattern
as the Pluto pack: `fit_planet.py` mints Horizons/DE441 Chebyshev packs for
Mars, Jupiter, Saturn, Uranus, and Neptune (their system barycenters -- the
same targets `validate_horizons.py` measures), and both engines route a
planet through the packed-body pipeline whenever `{body}_cheb.json` is on
disk (`node-loader.ts` / `chart.py`; `engineCapabilities` then reports
`chebyshev_pack` with the pack's fitted span). `fit_moon.py` mints a wider
`moon_cheb.full.json` in the exact shipped format, so the precise-Moon
tier, `true_node_precise`, true Lilith, and a subsequent `fit_intp_apog.py`
refit widen with it, all with no code change. Without the pack, behaviour is unchanged:
the full suite is pinned green in both states (the routing was exercised
against a synthetic pack and removed).

Run where `ssd.jpl.nasa.gov` is reachable:

    python3 fit_planet.py mars saturn uranus neptune   # the four that drift
    python3 fit_planet.py jupiter                      # optional: 1.23" wide today
    python3 fit_moon.py                                # the big one: ~2.9M rows

Then the doctrine loop: regenerate the goldens (positions move by up to the
drift the packs remove), re-run `validate_horizons.py --wide` and
`validate_swiss.py`, and move claims -- headline, accuracy.json,
claims-registry docs -- only on the measured numbers.

Sizes are measured at mint time, and shipping is a decision to make then:
the giants land in the hundreds of kilobytes (tarball-friendly, add them to
`check-tarball.mjs`), Mars in the megabytes, the wide Moon in the 10-20 MB
range (repo-only like today's full Moon tier, or an optional download).
Delta-T remains the honest ceiling for the Moon and the angles before
~1500: sigma is minutes, the smear is tens of arcseconds, so wide-band
claims are per-body and TT-honest rather than one headline number
(`Chart.warnings` already states both splits per chart).

## Notes and non-goals

- With the wide Pluto pack loaded, Pluto behaves like the other Chebyshev
  bodies: outside the pack's fitted range it is reported in
  `Chart.unavailable` rather than computed, and `PackedBody` covers it in
  the type model (`chart.bodies.pluto` is `ChartBody | undefined`).
- Full Swiss Ephemeris parity (the +-13,000-year range and 0.001 arcsec
  accuracy) remains a non-goal: arcsecond is already below astrological
  resolution, and for ancient dates the uncertainty in delta T dominates any
  position-theory error, so the input time is fuzzier than the engine.
