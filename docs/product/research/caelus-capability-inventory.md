# Caelus monorepo — complete capability inventory (agent report)

Repo: /home/user/caelus · v0.24.1 (engine, MCP, birth, wheel lockstep; delineations 0.1.5) · MIT, clean-room, no Swiss Ephemeris, no ephemeris files.

## 1. packages/caelus — TypeScript engine

Entries: `caelus` (45 modules), `caelus/data-embedded` (~151 KB gz, browser/edge), `caelus/node` (fs loader), `caelus/accuracy.json`. Zero deps, no I/O in core. ~12,500 LOC.

### Core astronomy (core.ts)
- Timescales: julianDay, deltaT (IERS 1955–2025 + Espenak–Meeus), jdTT
- VSOP87D (4 tiers micro/embedded/high/full), IAU 1980 nutation, Vondrák 2011 precession
- Apparent-place pipeline (light-time, aberration, FK5, precession, nutation)
- Moon: Meeus ch.47 series + DE-derived Chebyshev precise tier
- Nodes/apogees: mean/true node, mean/true/interpolated Lilith (intp_apog)
- Pluto (Meeus ch.37 + Chebyshev), Chiron
- ChebSeries, KeplerOrbit (Uranians), equatorial(), topocentricEcl, ayanamsa()

### Chart API (chart.ts, Engine class)
- BODIES (13): sun..pluto, chiron, mean_node, true_node. EXTRA: mean/true lilith, intp_apog. Asteroids: ceres, pallas, juno, vesta, pholus. Uranian: cupido, hades, zeus, kronos, apollon, admetos, vulkanus, poseidon. Fixed stars: 319 catalog + 8,920 deep pack. Any string BodyId (synthetic seam). Vertex/east point are angles.
- Methods: bodies(), position() → {lon, speed, retrograde, sign, signDeg, lat, latSpeed, dist, ra, dec}, longitude(), ecliptic(), heliocentric(), chart(y,mo,d,h,mi,s,lat,lonEast,opts) [UT fields], chartAt(jdUt,...) [JD-first], fixedStar(), starNames(), starConjunctions(chart,{orb}), lots(chart), registerSource/registerRender (synthetic).
- Chart object: {jdUt, zodiac, houseSystem, houseSystemRequested, bodies (Position+house+dignities), unavailable[], warnings[] (outside_validated_range, delta_t_uncertain), angles{asc,mc,vertex,eastPoint}, cusps[12], aspects[]}
- Topocentric option; ecliptic + equatorial always filled.
- Zodiacs: tropical or sidereal:{lahiri, fagan_bradley, krishnamurti, raman, yukteshwar, galcent_0sag, true_citra} (7 ayanamsas)
- House systems (12): placidus, porphyry, equal, whole_sign, koch, regiomontanus, campanus, alcabitius, morinus, meridian, polich_page, vehlow. normalizeHouseSystem() forgiving. Polar fallback → whole_sign, reported.
- Aspects: 5 Ptolemaic majors default, orbs 8/4/7/7/8, custom angle tables + per-aspect orbs, separation "longitude"|"spatial" (3-D). Aspect: {a,b,aspect,orb,phase(applying/separating/exact),strength[0..1]}. findAspects standalone.
- Helpers: SIGNS, element(), modality(), quadrant(), DOMICILE, EXALTATION, dignities(), fmtLon.

### Houses (houses.ts): gmst, gast, angles(), vertexEastPoint(), one fn per system.

### Events (events.ts): riseSet (rise/set/mtransit/itransit, refraction, altitude, disc), crossings (any longitude → ingresses), lunarPhases, stations, gauquelinSector (1–36).

### Eclipses (eclipses.ts): lunarEclipses (type, magnitudes, contact times), solarEclipses (type, gamma), solarEclipseWhere (sub-shadow point), solarEclipseLocal (per-observer magnitude/obscuration/C1–C4), solarEclipseLimits (path), lunarEclipseLocal.

### Query (query.ts): when(engine, predicate, start, end) → intervals. Predicates aspect/inSign/retrograde/notRetrograde + allOf/anyOf/notOf.

### Derived (derived.ts): returns()/solarReturn()/lunarReturn() (relocatable), progressedJd/progressedLongitude (secondary), solarArc/directedLongitude, compositeLongitudes (midpoint), davisonParams, midpointLon, harmonicLongitude/harmonicChart, antiscion/contraAntiscion, declinationAspect(s) (parallel/contraparallel), outOfBounds, dignityOf, isDayChart, planetarySect, inSect.

### Electional (electional.ts): aspectPhase, aspectBetween, solarPhase (cazimi/combust/under_beams), planetaryHour (Chaldean, polar-safe), voidOfCourse (Sun–Saturn set), houseOf, angularity.

### Search/scan: scan.ts (scan, rankMoments, rankMomentsAsync browser-safe), turbo.ts (Turbo Chebyshev bulk), features.ts (chartFeatures, cosineSimilarity, configurationFit, searchConfigurations), spherical.ts (angularSeparation3d).

### Patterns/signature/dignity: detectPatterns (T-square, grand trine, grand cross, yod, kite, mystic rectangle, stellium_sign, stellium_house; maximal; quincunx included), chartSignature (element/modality/angularity/quadrant/hemisphere counts, dominants, ruler), dignity-score.ts (Lilly weights 5/4/3/2/1/−5/−4, Egyptian terms, Dorothean triplicities, Chaldean faces, dignityScore, almuten, peregrine).

### Hellenistic: lots.ts (7 Hermetic lots, sect-aware), profections.ts (annual+monthly, lord of year), firdaria.ts (75-yr, day/night, subs), releasing.ts (ZR from Spirit/Fortune, L1–L4, loosing of the bond), directions.ts (primary directions Placidus semi-arc, Ptolemy/Naibod keys, planets→angles + mundane planet-to-planet).

### Vedic: vedic.ts (27 nakshatras + padas + lords; Vimshottari maha/antar/pratyantar), yogini.ts (36-yr), ashtottari.ts (108-yr JHora convention), vargas.ts (D1,D2,D3,D9,D10,D12,D30), yogas.ts (5 Pancha Mahapurusha, Gajakesari, Budha-Aditya, Chandra-Mangala, Kemadruma), rajayoga.ts (DRISHTI, house lords, parivartana, yogakarakas, rajaYogas, dhanaYogas).

### Parans/maps/ephemeris: parans.ts (co-angular pairs, starParans Brady-style), astrocartography.ts (planetLines MC/IC/ASC/DSC), ephemeris.ts (time series for graphic ephemeris), pheno.ts (phase, illum fraction, elongation, diameter, magnitude, equationOfTime, azAlt, refraction, airmass), stars.ts.

### Compiler/synthetic: compileForm (constraints: aspect/sign/degree/declination/parallel/separation3d → chart form, flags impossible), synthetic.ts (placement/periodic/kepler bodies, observer vantage, registerSyntheticSystem, syntheticRender).

### SkyView (skyview.ts, 1620 lines): skyView(engine, jdUt, view, opts) → pixel-placed bodies for AI image prompts. 7 lens presets, per-body {x,y,sizePx,magnitude,altitude,nakedEye}, Moon phase/limb clock, offFrame, occluded (horizonProfile), twilight/limitingMag/skyBrightness (Bortle+moonlight), overlays (ecliptic, signs, cusps, constellations), 3 prompt styles, renderPlan (layers+animation), skyViewSequence (frames).

### Interpretation layer: interpretationContext(chart, opts) → ranked fact atoms. FactKinds (17+): placement, aspect, pattern, signature, angle, dispositor, reception, star, lot, transit, synastry, composite, timelord, dignity, nakshatra, varga, yoga, parallel, outOfBounds. Atoms: stable id, kind, bodies, salience (DEFAULT_SALIENCE overridable: pattern 4, reception/star/lot/timelord 2, luminary/transit/parallel/oob 1.5...), plain text. Certainty damping for time-sensitive atoms (1.0/0.7/0.6/0.5). Selectors: hasPlacement/hasAspect/hasPattern/hasSignature/hasAngle/hasDispositor/hasReception/hasStar/hasLot/hasTransit/hasSynastry/hasComposite/hasTimelord/hasDignityFine/hasNakshatra/hasVarga/hasParallel/hasOutOfBounds/hasYoga + matchAll/Any/None. interpret(ctx, sources) → Reading with atomIds audit; reconcile (groups, dedupe, contested). enrichContextOptions (transits+timelords+vedic), enrichSynastryOptions. relational.ts (transitAspects, synastryAspects, synastryOverlays, compositePlacements). brief.ts (chartBrief → LLM prompt + facts; auditCitations flags invented facts).

### Provenance: Realm (observed|reported|planned|forecast|counterfactual|archetypal|conceptual|mythic|fictional), TemporalAnchor (instant|range|relative|narrative|symbolic|none), SpatialAnchor, Certainty, AnchorRegistry, realize() → chartAt or compileForm. counterfactual() (shiftTime/place/setLongitudes) + chartDiff.

### Canonical mode: integer hashable output, grids (arcsec/milliarcsec/centideg/dms/accuracy), canonicalChart, chartDigest, remainder sets, 2,185 tolerance-free golden comparisons, TS digests byte-equal to Python.

### Ranges/capabilities: HEADLINE 1000–3000; pluto_meeus 1885–2099, uranian 1800–2149, small_bodies 1600–2484; embedded Moon 1920–2080. engineCapabilities() per-body source/validated/fitted.

### Accuracy: Sun–Saturn ≤1″, Uranus ≤1.9″, Neptune ≤4.6″, Moon precise ≤2.5″ (embedded ≤10″), Pluto ≤3.4″, angles ≤3.2″, rise/set ≤0.5 s, eclipse max ≤9 s. 3,397 golden checks TS↔Python.

## 2. packages/caelus-mcp — 35 tools

natal_chart, current_sky, sky_view, sky_view_sequence, synthetic_validate, synthetic_positions, synthetic_sky_view, transits, synastry (aspects+overlays+atoms+brief), find_aspect_dates (≤50 yr), rectification_grid, sky_events (≤370 d; incl. eclipses local+global), planetary_hours, void_of_course, returns (relocatable), progressions, composite (midpoint+Davison), dignities, lots, profections, firdaria, releasing, directions, nakshatras, dasha (Vimshottari/Yogini/Ashtottari), vargas, yogas, aspect_patterns, parans, chart_signature, chart_facts (realize-backed, provenance-aware, ranges/constraints), counterfactual_chart, similar_skies, electional_search, cosmic_weather.

Resources: ui://widget/chart.html (MCP App), caelus://accuracy, caelus://glossary. Prompts: rectification_session, natal_reading. Hosted Streamable HTTP at ephemengine.com/api/mcp, stateless, on MCP Registry.

## 3. packages/birth (caelus-birth)
toUT(local + lat/lon [+zone]) → UTC/jdUt/zone/offset/dst/status(ok|ambiguous|nonexistent)+candidates. Offline tz via tz-lookup; historical DST/wartime offsets via Intl/tzdb (Luxon). localToChart(). Geocode separate entry: Geocoder interface + openMeteoGeocoder (keyless, CC-BY attribution). Web app also ships offline gazetteer (~350 KB gz) for CityPicker.

## 4. packages/wheel (caelus-wheel)
SSR-safe, zero-dep React SVG. ChartWheel (accepts Chart or MCP payload; zodiac ring, house ring 12 systems, planets w/ collision fan-out via spreadAngles, aspect lines colored/dashed/opacity-by-orb; props: size, showAspects, aspectTypes, bodies filter, theme, glyphs; DARK_THEME; no built-in interactivity/light theme). ChartSphere (tilted celestial sphere). AstroMap (astrocartography lines on equirectangular; no coastlines bundled, children layer). EphemerisGraph (graphic ephemeris lines, wrap handling). No bi-wheel in package (web app hand-rolls BiWheel.tsx).

## 5. packages/caelus-delineations-pd
374 passages / 8 sources: heindel-aspects 129, george-signs 76 (gratis-not-pd, isolated), alan-leo-judge 63, brihat-nakshatras 27, alan-leo-key 20, robson-stars 20, alan-leo-signs 15, heindel-rising 12, saint-germain 12. Cells covered: planet-in-sign (partial), planet-in-house (84), aspects (116), rising (12), stars (20), parallels (13), Moon-nakshatra (27). NO content: dignities, lots, reception/dispositor, transit, synastry, composite, timelord, varga, yoga, out-of-bounds — selectors ready. Pipeline: manifest → text → extract → PassageRecord JSON (SelectorSpec + provenance) → compile → InterpretationSource. Validation test proves rules bind to legal atoms, fire only for condition, cite only existing atoms. publicDomainSources for strict PD.

## 6. apps/web — ephemengine.com
Routes: / (landing, proof stats, SkyRibbon, capability grid, FAQ), /playground, /features (comparison tables), /methods, /validation, /provenance, /notes, /how-it-was-built, /changelog, /privacy, /docs (+18 MDX guides + visualizations demos + TypeDoc API ref), /embed/chart (MCP App widget), /api/chart (Edge GET, 1920–2080 only, Placidus fixed), /api/mcp (hosted MCP), sitemap/robots/OG.

Playground (SkyNow.tsx, all client-side, no birth data leaves browser): ChartControls (ISO datetime, UTC/local toggle w/ DST warnings, CityPicker offline gazetteer, lat/lon, 12 house systems, 5 zodiac choices, nickname, share-link #c= base64url). Views: Wheel/Sphere/Map/Transits (BiWheel). 8 data tabs: Facts (ranked atoms), Positions (Longitudes w/ click-to-isolate, Declinations w/ OOB+parallels, Stars w/ conjunctions+parans), Aspects (triangular aspectarian), Synthesis (signature, patterns, dignity scores, lots, profection), Vedic (nakshatra+pada, D9/D10, Vimshottari active), Events (lunar phases 120 d), Sky View (live, lens presets, scrub), JSON. Reading panel (interpret+reconcile over publicDomainSources, cited). SynastryPanel (two births, aspect grid, overlays, composite, BiWheel, relational reading). 4 example charts.

Design (DESIGN.md + globals.css): dark-first; --bg #0c0a14, surfaces, text tiers; two accents: structural purple #8a7fd4, peach blossom #dd6ba1 (living layer: sky markers + interpretation surfaces only); --good/--bad; per-planet wheel palette; Inter + JetBrains Mono; 760px prose / 1100px wide; page grammar eyebrow→h1→lead→sections→PageClose; principles: one page one job, show then tell, one vocabulary, scan first, figures sized to information, evidence over adjectives. Prose gated by Vale + claim-drift scripts.

## 7. Roadmap status
Everything through Phase 4b done (0.24.1: canonical mode + 1000–3000 tier). Open: Apps-SDK directory registration, transit-density count, thin transit wrappers (cookbook recipes), kemadruma-bhanga, variant conventions.

## 8. Limitations for a consumer product
1. Zero delineation text in engine; PD corpus thin/dated (374 passages, 1647–1922 voice)
2. Corpus cell gaps: dignities, lots, reception, transit, synastry, composite, timelord, varga, yoga, OOB
3. 76 passages gratis-not-pd
4. Vedic corpus one chapter; stars 20 entries
5. Some sources needs-refetch
6. Browser/edge tier: Moon 1920–2080 (headline 1000–3000 is Node full packs); /api/chart rejects outside 1920–2080
7. Out-of-range bodies → Chart.unavailable; must surface
8. ΔT uncertainty before ~1500 smears angles; warnings present
9. Non-goals: ±13,000 yr, numbered-asteroid corpus, planetary moons, heliacal, 0.001″
10. Per-body accuracy contract; eclipse paths ~2 km
11. chart() takes UT fields; caelus-birth mandatory in practice
12. Longitude EAST-positive
13. Use mod() not %
14. Polar house fallback must be surfaced
15. Aspect searches must root-find ±angle
16. Geocoding: network (attribution) or 350 KB gazetteer
17. No minor aspects in default table (custom tables accepted; quincunx in patterns)
18. Flat per-aspect orbs (no luminary weighting)
19. Wheel: no interactivity/animation/light preset built in
20. No published bi-wheel component
21. No packaged transit timeline tool (buildable from find_aspect_dates + crossings + stations)
22. No tertiary/minor progressions, converse directions, solar-arc chart, local-space chart
23. No horary layer (primitives present)
24. VOC traditional set only; sky_events ≤370 d; find_aspect_dates ≤50 yr
25. Salience/dominance/orb policy are editorial choices the product owns
