# Caelus Free — exhaustive feature map

Every public symbol in the monorepo, mapped to its consumer surface in
Caelus Free (`ephemengine.com/free`). Derived directly from the source
export manifests on 2026-08-15 (engine v0.24.1: `packages/caelus/src/index.ts`
re-exporting 46 modules; plus `caelus-mcp`, `caelus-birth`, `caelus-wheel`,
`caelus-delineations-pd`, and `apps/web`).

**Scope codes:** **✓** in the product — every feature and function ships.
**∞** infrastructure (powers surfaces; not itself user-visible; the row
names the surface it serves). Types/interfaces are listed per module as
contracts; they ship wherever their functions ship.

Companion: [proposal.md](./proposal.md) (vision + product architecture) ·
[research/](./research/).

---

## 1. `packages/caelus` — engine modules

### 1.0 Package entry points

| Symbol | What it is | Caelus Free surface | Scope |
|---|---|---|---|
| `embeddedData` (`caelus/data-embedded`) | The bundled compact coefficient set (~151 KB gz) | The client-side engine every page instantiates — the "your data never leaves the browser" promise | ∞ |
| `loadNodeData` (`caelus/node`) + types `VsopLevel`, `MoonTier` | Filesystem loader for the full packs with tier selection | Server-side fallback tier for out-of-browser-range dates; powers `/api/chart` and `/api/mcp` | ∞ |
| `caelus/accuracy.json` export | Machine-readable per-body accuracy | "About this computation" panel; build-time proof stats | ✓ |

### 1.1 `core` — astronomy foundation

| Symbol | What it is | Caelus Free surface | Scope |
|---|---|---|---|
| `julianDay` | Calendar → JD | Every chart computation; the date field of every form | ∞ |
| `deltaT`, `jdTT` | ΔT model, UT→TT | Every computation; surfaced in the "ΔT uncertain" honesty chip on ancient charts | ∞ |
| `mod`, `DEG`, `ARCSEC`, `J2000`, `LIGHT_TIME_AU`, `EARTH_RADIUS_AU` | Angle/units helpers & constants | All angle math app-side (the documented `%` hazard) | ∞ |
| `vsopHeliocentric`, `earthHeliocentric` | VSOP87D evaluation | All planet positions | ∞ |
| `nutation`, `meanObliquity`, `trueObliquity`, `precessEcliptic` | IAU 1980 nutation, obliquity, Vondrák precession | All positions; obliquity feeds OOB/declination surfaces | ∞ |
| `planetApparent`, `sunApparent` | Apparent-place pipeline | All chart positions | ∞ |
| `moonGeometric`, `moonApparentSeries`, `moonApparentPrecise` | Moon theories (compact + precise tiers) | Moon everywhere; tier surfaced in the range chip | ∞ |
| `meanNode`, `trueNodeSeries`, `trueNodePrecise` | Lunar nodes | Node placements/true-vs-mean setting in Advanced | ✓ |
| `meanLilith`, `oscApogeeSeries`, `oscApogeePrecise` | Mean/true/interpolated Lilith | Lilith body options in the body picker | ✓ |
| `plutoHeliocentric`, `plutoApparent`, `chironApparent` | Pluto & Chiron | Body set | ∞ |
| `ChebSeries`, `KeplerOrbit` | Chebyshev evaluator, Kepler propagator | Asteroids/Uranians/synthetic bodies | ∞ |
| `equatorial` | Ecliptic → RA/Dec | Data view equatorial columns; the Planetarium; parans | ✓ |
| `topocentricEcl` | Diurnal parallax | Topocentric toggle in Advanced settings | ✓ |
| `ayanamsa`, `AYANAMSA_J2000` | Sidereal offsets (7 systems) | Zodiac switcher (tropical + 7 ayanamsas) | ✓ |
| Types: `VsopSeries`, `MoonSeries`, `ChebData`, `KeplerElements`, `KeplerPack`, `XyzSource`, `EngineData` | Data-pack & source contracts | Data loading; synthetic-body seam (Chart Lab) | ∞ |

### 1.2 `houses`

| Symbol | Surface | Scope |
|---|---|---|
| `angles` (ASC/MC), `vertexEastPoint` | Chart angles; Vertex/East Point in Advanced angles | ✓ |
| `housesPlacidus`, `housesWholeSign`, `housesEqual`, `housesPorphyry`, `housesKoch`, `housesRegiomontanus`, `housesCampanus`, `housesAlcabitius`, `housesMorinus`, `housesMeridian`, `housesPolichPage`, `housesVehlow` | The 12-entry house-system switcher; the "compare house systems" tool (cafeastrology's most-loved report, done live) | ✓ |
| `houseCusp`, `gmst`, `gast` | Cusp math, sidereal time | ∞ (house systems; planetary hours; parans) | ∞ |

### 1.3 `chart` — the Engine and chart model

| Symbol | Surface | Scope |
|---|---|---|
| `Engine` class | The computation core, instantiated client-side with embedded data | ∞ |
| `Engine.chart` / `Engine.chartAt` | Every chart cast anywhere in the app (natal, transit, return, relocation, Davison, synthetic realizations) | ✓ |
| `Engine.position` / `Engine.longitude` | Positions tables; ephemeris rows; timeline sampling | ✓ |
| `Engine.ecliptic`, `Engine.heliocentric` | Raw frames; heliocentric view toggle | ✓ |
| `Engine.bodies` | Body picker options = what the loaded data supports | ✓ |
| `Engine.fixedStar`, `Engine.starNames`, `Engine.starConjunctions` | Fixed-star card; star picker; deep-pack setting | ✓ |
| `Engine.lots` | Lots card | ✓ |
| `Engine.registerSource`, `Engine.registerRender`, `Engine.renderFor` | Chart Lab: invented bodies mixed into real charts/Sky View | ✓ |
| `BODIES`, `EXTRA_BODIES`, `NOT_ASPECTABLE` | Default 13-body set; Liliths; aspectability defaults in settings | ✓ |
| `SIGNS`, `element`, `modality`, `quadrant` | Sign chips, balance bars in "chart at a glance" | ✓ |
| `ASPECTS`, `DEFAULT_ORBS`, `findAspects` | Aspect engine; orb-profile presets (Modern/Traditional); custom aspect tables (minors) | ✓ |
| `HOUSE_SYSTEMS`, `normalizeHouseSystem` | House switcher; forgiving deep-link params (`?houses=whole sign`) | ✓ |
| `DOMICILE`, `EXALTATION`, `dignities` | Basic dignity chips on placements | ✓ |
| `fmtLon` | `19°27′ Gemini` formatting everywhere | ✓ |
| Types: `Body`, `BodyId`, `HouseSystem`, `Element`, `Modality`, `Ayanamsa`, `Zodiac`, `Observer`, `CalcOptions`, `ChartOptions`, `Position`, `ChartBody`, `PackedBody`, `AlwaysBody`, `ChartBodies`, `Aspect`, `Chart`, `ChartWarning`, `FindAspectsOptions` | The chart contract; `ChartWarning`/`unavailable` drive the honesty chips; `houseSystemRequested` drives the polar-fallback notice | ✓ |

### 1.4 `pheno` — phenomena

| Symbol | Surface | Scope |
|---|---|---|
| `pheno` (phase angle, illuminated fraction, elongation, apparent diameter, magnitude) | Moon strip (phase/illumination); visibility almanac (evening/morning star, brightness) | ✓ |
| `equationOfTime` | Almanac page detail | ✓ |
| `azAlt` | The Planetarium; parans; local visibility | ✓ |
| `refractTrueToApparent`, `refractApparentToTrue`, `airmass`, `extinctionMag` | Planetarium realism; rise/set precision | ∞ |
| `DIAMETER_KM`, type `Pheno` | Constants/contract | ∞ |

### 1.5 `events`

| Symbol | Surface | Scope |
|---|---|---|
| `riseSet` (rise/set/mtransit/itransit; refraction, altitude, disc options) | Today "coming up"; visibility almanac; planetary-hours math | ✓ |
| `crossings` | Ingress calendar; sign-change alerts; timeline markers; "next Mars ingress" answers | ✓ |
| `lunarPhases` | Moon strip; lunation calendar; Today feed | ✓ |
| `stations` | Retrograde/station calendar; timeline markers; "Mercury stations" cards | ✓ |
| `gauquelinSector` | Research data view | ✓ |
| Types: `RiseKind`, `RiseSetOptions`, `PhaseName` | Contracts | ∞ |

### 1.6 `stars`

| Symbol | Surface | Scope |
|---|---|---|
| `starApparent` | Star positions for conjunctions/parans/the Planetarium | ∞ |
| Types: `StarEntry`, `StarPack`, `ConstellationPack` | 319-star catalog + 8,920 deep pack + constellation figures (Planetarium overlays) | ✓ |

### 1.7 `eclipses`

| Symbol | Surface | Scope |
|---|---|---|
| `lunarEclipses`, `solarEclipses` | Eclipse catalog pages; Today/Timing eclipse flags | ✓ |
| `solarEclipseLocal` (magnitude, obscuration, C1–C4) | "Visible from your place?" local circumstances | ✓ |
| `solarEclipseWhere`, `solarEclipseLimits` | Eclipse path maps (central line, path width) | ✓ |
| `lunarEclipseLocal` | Lunar eclipse visibility at your place | ✓ |
| Types: `LunarEclipse`, `SolarEclipse`, `GeoPoint`, `SolarLocal`, `EclipsePath`, `LunarLocal` | Contracts | ∞ |

### 1.8 `query` — `when()` engine

| Symbol | Surface | Scope |
|---|---|---|
| `when` + `aspect`, `inSign`, `retrograde`, `notRetrograde`, `allOf`, `anyOf`, `notOf`, `QUERY_ASPECTS` | Power query UI ("Mars in Aries AND retrograde, 2026–2030" → intervals); also backs prewritten calendar pages | ✓ |
| Types: `Interval`, `Predicate`, `WhenOptions` | Contracts | ∞ |

### 1.9 `derived` — derived charts

| Symbol | Surface | Scope |
|---|---|---|
| `returns` (any body) | **Planetary returns**: Saturn/Jupiter/nodal return pages (timing + chart + reading) | ✓ |
| `solarReturn`, `lunarReturn` | Birthday page (relocatable solar return); lunar-return month view | ✓ |
| `progressedJd`, `progressedLongitude` | Secondary progressions: progressed positions, prog-to-natal hits, timeline lane | ✓ |
| `solarArc`, `directedLongitude` | Solar-arc directions: directed positions + hit list | ✓ |
| `compositeLongitudes`, `midpointLon` | Midpoint composite chart; midpoints table (data view) | ✓ |
| `davisonParams` | Davison chart (midpoint in time & space) | ✓ |
| `harmonicLongitude`, `harmonicChart` | Harmonic charts (advanced view) | ✓ |
| `antiscion`, `contraAntiscion` | Antiscia table/overlay (traditional view) | ✓ |
| `declinationAspect`, `declinationAspects` | Parallels/contraparallels card + declination data view | ✓ |
| `outOfBounds`, `outOfBoundsMargin` | Out-of-bounds card + chips | ✓ |
| `dignityOf`, `isDayChart`, `planetarySect`, `inSect` | Sect banner (day/night chart), in-sect chips, dignity plumbing | ✓ |
| `TROPICAL_YEAR` | Constant | ∞ |
| Types: `DeclinationKind`, `DeclinationPair` | Contracts | ∞ |

### 1.10 `turbo`

| Symbol | Surface | Scope |
|---|---|---|
| `Turbo` class (+ `TurboBody`, `TurboPack`) | Fast bulk scans behind calendars, electional search, similar-skies — keeps year-long scans instant in the browser | ∞ |

### 1.11 `electional`

| Symbol | Surface | Scope |
|---|---|---|
| `aspectBetween`, `aspectPhase`, `separation`, `signedElongation` | Applying/separating everywhere; date-finder criteria | ✓ |
| `solarPhase`, `solarElongation` + `CAZIMI_DEG`, `COMBUST_DEG`, `UNDER_BEAMS_DEG` | Cazimi/combust/under-beams condition chips (charts + date finder) | ✓ |
| `planetaryHour` | Planetary-hours panel (current hour, day ruler, 24-hour table); polar honesty (`available:false`) | ✓ |
| `voidOfCourse` | VoC state in Moon strip; VoC calendar; election penalty | ✓ |
| `houseOf`, `angularity` | House placement math; angularity criterion in date finder | ∞ |
| Types: `AspectPhase`, `AspectMatch`, `SolarPhase`, `PlanetaryHour`, `VoidOfCourse` | Contracts | ∞ |

### 1.12 `scan`

| Symbol | Surface | Scope |
|---|---|---|
| `rankMomentsAsync` | **Date finder** (electional search) — non-blocking in the browser | ✓ |
| `scan`, `rankMoments`, `sampleCount` | Same engine, batch contexts | ∞ |
| Types: `ScanOptions`, `RankOptions`, `RankedMoment` | Contracts | ∞ |

### 1.13 `spherical`

| Symbol | Surface | Scope |
|---|---|---|
| `angularSeparation3d`, `unitVector` (+ `Vec3`) | "Spatial (3-D) aspects" mode in Advanced settings | ✓ |

### 1.14 `ranges`

| Symbol | Surface | Scope |
|---|---|---|
| `HEADLINE`, `HEADLINE_LABEL`, `MEASURED`, `VSOP_BODIES`, `ANALYTIC_BODIES`, `validatedSpanFor`, `packSpan`, `jdYear` | Range chips ("validated 1000–3000; this browser tier: Moon 1920–2080"); date-picker guards | ✓ |
| `deltaTSigma` | Ancient-chart uncertainty notice (angle smear) | ✓ |
| Types: `BodySpan` | Contract | ∞ |

### 1.15 `capabilities`

| Symbol | Surface | Scope |
|---|---|---|
| `engineCapabilities` (+ `BodySource`, `BodyCapability`, `EngineCapabilities`) | "About this computation" panel: which source/tier computed each body — the transparency page per chart | ✓ |

### 1.16 `canonical`

| Symbol | Surface | Scope |
|---|---|---|
| `canonicalChart`, `chartDigest`, `canonicalDigest`, `sha256Hex` | Stable chart fingerprint: share permalinks, OG image cache keys, prompt-pack determinism stamps | ✓ |
| `canonicalEncode`, `canonicalTimeMs`, `canonicalTimesMs`, `roundHalfUp`, `quantizeUnit`, `ACCURACY_QUANTUM_ARCSEC` | Canonical plumbing | ∞ |
| `canonicalChartWithRemainders`, `composeRemainders`, `nearBoundary`, `doubleBitsHex`, `doubleFromBitsHex` | Precision-honest exports; "this placement is near a sign boundary" fragility notices (great for unknown-time honesty) | ✓ |
| Types: `CanonicalGrid`, `CanonicalOptions`, `CanonicalBody`, `CanonicalAspect`, `CanonicalChart`, `RemainderGrid`, `RefineRemainders`, `BitsRemainders`, `CanonicalRemainders`, `RemainderOptions`, `BoundaryFlag` | Contracts | ∞ |

### 1.17 `skyview`

| Symbol | Surface | Scope |
|---|---|---|
| `skyView` | **The Planetarium (real-sky source)**: the sky actually overhead — framed, pixel-placed bodies, Moon phase orientation, twilight; one of three combinable source layers (proposal §5.8) | ✓ |
| `skyViewSequence` | Time-scrub animation frames; night-sky timelapse | ✓ |
| `resolveLens`, `LENS_NAMES`, `skyPlacer` | Lens presets (ultrawide…supertele) in the Planetarium controls | ✓ |
| `twilightStage`, `limitingMag`, `skyBrightness` | Twilight/visibility readouts ("Venus visible to naked eye tonight") — feeds visibility almanac too | ✓ |
| `horizonAltAt` | Custom horizon profiles (mountains/skyline occlusion) | ✓ |
| `PROMPT_STYLES` | AI image-prompt styles (photoreal/illustration) for shareable sky renders | ✓ |
| Types: `SkyProjection`, `SkyLens`, `LensSpec`, `SkyPlacement`, `TwilightStage`, `SkyBrightnessCtx`, `HorizonPoint`, `SkyAim`, `SkyViewSpec`, `SkyViewOptions`, `SkyBody`, `SkyOffFrameBody`, `SkySummary`, `SkyOccludedBody`, `MilkyWay`, `CelestialPole`, `StarfieldSummary`, `SkyViewOverlaysRequest`, `OverlayMark`, `OverlayLine`, `SkyViewOverlays`, `RenderLayer`, `RenderPlan`, `SkyViewResult`, `PromptStyle`, `SkyViewSequenceSpec`, `SkyViewSequence` | Sky-view contract: lenses, aim, per-body placements, off-frame/occluded bodies, sky summary, Milky Way, celestial pole, starfield, overlays, render plans, prompt styles, sequences | ∞ |

### 1.18 `astrocartography`

| Symbol | Surface | Scope |
|---|---|---|
| `astrocartography`, `planetLines` (+ `AngleLines`) | Astrocartography map: MC/IC/ASC/DSC lines per body, tap-for-meaning; pairs with relocation tool | ✓ |

### 1.19 `ephemeris`

| Symbol | Surface | Scope |
|---|---|---|
| `ephemeris` (+ `EphemerisValue`, `EphemerisOptions`, `EphemerisPoint`) | Graphic-ephemeris data; timeline sampling; modern ephemeris tables | ✓ |

### 1.20 `features`

| Symbol | Surface | Scope |
|---|---|---|
| `chartFeatures`, `featureVector`, `cosineSimilarity`, `DEFAULT_BODIES` | Similar-skies + chart-similarity search substrate | ✓ |
| `configurationFit`, `searchConfigurations` | "When did the sky last look like this?" tool | ✓ |
| Types: `FeatureOptions`, `SearchConfigOptions` | Contracts | ∞ |

### 1.21 `compiler`

| Symbol | Surface | Scope |
|---|---|---|
| `compileForm` | Chart Lab: **archetypal chart designer** — constraints in, realized geometry (or honest "impossible") out | ✓ |
| `constraintLoss`, `formLoss`, `declinationOf`, `OBLIQUITY_J2000_DEG`, `DEFAULT_LAT_BOUND`, `BODY_LAT_BOUNDS` | Compiler internals; residual/impossibility display | ∞ |
| Types: `Constraint`, `BodyState`, `Positions`, `CompiledForm`, `CompileOptions` | Constraint vocabulary (aspect/sign/degree/declination/parallel/separation3d) exposed as the designer's building blocks | ✓ |

### 1.22 `synthetic`

| Symbol | Surface | Scope |
|---|---|---|
| `validateSyntheticSystem` | Chart Lab authoring: lint an invented sky system | ✓ |
| `syntheticPositions`, `syntheticEphemeris`, `bodySource`, `syntheticSources` | Positions/motion of invented bodies (incl. observer-vantage retrogrades) | ✓ |
| `registerSyntheticSystem` | Mix invented bodies into real charts | ✓ |
| `syntheticRender` | Render attrs (size/magnitude/color) for invented and composed bodies in the Planetarium | ✓ |
| Types: `SyntheticBody`, `SyntheticRender`, `SyntheticSystem`, `SyntheticPosition`, `SyntheticDiagnosis`, `BodyPositionSource`, `SourceRegistrar` | Authoring contract (placement/periodic/kepler) | ✓ |

### 1.23 `lots`

| Symbol | Surface | Scope |
|---|---|---|
| `lots`, `hermeticLots`, `lotFortune`, `lotSpirit`, `HERMETIC_LOTS` | Lots card (Fortune/Spirit lead, 7 total, sect-aware); lot atoms in readings | ✓ |
| Types: `HermeticLot`, `ChartLots` | Contracts | ∞ |

### 1.24 `profections`

| Symbol | Surface | Scope |
|---|---|---|
| `profection`, `profectionAt`, `profectedSign`, `signRuler`, `SIGN_RULERS` | Annual + monthly profections: "your year" panel, lord-of-the-year, Timing lane, Today context chip | ✓ |
| Types: `ProfectedSign`, `Profection` | Contracts | ∞ |

### 1.25 `firdaria`

| Symbol | Surface | Scope |
|---|---|---|
| `firdaria`, `firdariaActive`, `firdariaAt`, `firdariaSequence`, `FIRDARIA_ORDER`, `FIRDARIA_YEARS`, `NODE_PERIODS` | Firdaria timeline lane (75-yr, day/night, sub-periods) + active-lords panel | ✓ |
| Types: `FirdariaSub`, `FirdariaPeriod` | Contracts | ∞ |

### 1.26 `releasing`

| Symbol | Surface | Scope |
|---|---|---|
| `zrRelease`, `zrActive`, `zrAt`, `ZR_PERIODS`, `LEVEL_UNIT` | Zodiacal releasing: L1–L4 chapters from Spirit/Fortune, loosing-of-the-bond markers, Timing lanes | ✓ |
| Types: `ZrPeriod`, `ZrActive` | Contracts | ∞ |

### 1.27 `vedic`

| Symbol | Surface | Scope |
|---|---|---|
| `nakshatra`, `nakshatraAt`, `NAKSHATRAS`, `NAK_SPAN` | Nakshatra cards (+pada, lord) | ✓ |
| `vimshottariDashas`, `vimshottariActive`, `vimshottariAt`, `VIMSHOTTARI_ORDER`, `VIMSHOTTARI_YEARS`, `DASHA_YEAR` | Vimshottari timeline (maha/antar/pratyantar) + active lords | ✓ |
| Types: `Nakshatra`, `DashaSub`, `Dasha`, `DashaTimeline`, `DashaActive` | Contracts | ∞ |

### 1.28 `directions`

| Symbol | Surface | Scope |
|---|---|---|
| `primaryDirections`, `directionArcs`, `directionYears`, `KEYS`, `TRADITIONAL` | Primary directions table (planets→angles, Ptolemy/Naibod keys, age-sorted) | ✓ |
| `mundaneDirections`, `mundaneDirectionArc` | Planet-to-planet (mundane) directions block | ✓ |
| Types: `DirectionArcs`, `MundaneDirection`, `PrimaryDirection` | Contracts | ∞ |

### 1.29 `vargas`

| Symbol | Surface | Scope |
|---|---|---|
| `varga`, `vargaAt`, `vargaChart`, `VARGA_DIVISIONS` (+ `Varga`) | Divisional charts D1/D2/D3/D9/D10/D12/D30 (D9 headline at L) | ✓ |

### 1.30 `yogini`

| Symbol | Surface | Scope |
|---|---|---|
| `yoginiDashas`, `yoginiActive`, `yoginiAt`, `startingYogini`, `YOGINIS`, `YOGINI_LORDS`, `YOGINI_YEARS` | Yogini dasha timeline option | ✓ |
| Types: `YoginiSub`, `YoginiPeriod`, `YoginiTimeline`, `YoginiActive` | Contracts | ∞ |

### 1.31 `yogas`

| Symbol | Surface | Scope |
|---|---|---|
| `detectYogas`, `yogasAt`, `YOGA_PLANETS` | Yoga cards (Pancha Mahapurusha, Gajakesari, Budha-Aditya, Chandra-Mangala) with defining rules | ✓ |
| `kemadruma`, `kemadrumaAt` | Kemadruma flag (parameterized planet set) | ✓ |
| Types: `Yoga`, `Kemadruma` | Contracts | ∞ |

### 1.32 `ashtottari`

| Symbol | Surface | Scope |
|---|---|---|
| `ashtottariDashas`, `ashtottariActive`, `ashtottariAt`, `ashtottariLord`, `ASHTOTTARI_ORDER`, `ASHTOTTARI_YEARS` | Ashtottari dasha timeline option | ✓ |
| Types: `AshtottariSub`, `AshtottariPeriod`, `AshtottariTimeline`, `AshtottariActive` | Contracts | ∞ |

### 1.33 `rajayoga`

| Symbol | Surface | Scope |
|---|---|---|
| `rajaYogas`, `dhanaYogas`, `rajaYogasAt`, `dhanaYogasAt`, `yogakarakas` | Raja/dhana yoga + yogakaraka cards | ✓ |
| `signLord`, `houseSign`, `houseLord`, `houseFromAsc`, `aspectsSign`, `parivartana`, `associationType`, `DRISHTI`, `KENDRAS`, `TRIKONAS`, `DHANA_HOUSES` | Lordship/drishti plumbing; also powers Western house-ruler content pages ("ruler of your 10th in the 3rd") | ∞ |
| Types: `LordPairYoga` | Contract | ∞ |

### 1.34 `patterns`

| Symbol | Surface | Scope |
|---|---|---|
| `detectPatterns`, `detectPatternsIn`, `PATTERN_ANGLES`, `PATTERN_ORBS` | Pattern badges + cards (T-square, grand trine, grand cross, yod, kite, mystic rectangle, stelliums), wheel highlighting | ✓ |
| Types: `ChartPattern`, `PatternBody`, `PatternOptions` | Contracts | ∞ |

### 1.35 `signature`

| Symbol | Surface | Scope |
|---|---|---|
| `chartSignature`, `chartSignatureOf`, `ELEMENTS`, `MODALITIES` | "Chart at a glance": element/modality/quadrant/hemisphere balance bars, dominants, chart ruler | ✓ |
| Types: `ChartSignature`, `SignatureBody`, `SignatureOptions` | Contracts | ∞ |

### 1.36 `interpretation` — fact projection

| Symbol | Surface | Scope |
|---|---|---|
| `interpretationContext` | The atom projection behind every reading, facts panel, and prompt pack | ✓ |
| `DEFAULT_SALIENCE` (+ `SalienceWeights`) | Reading ranking; documented as an editorial convention with presets | ✓ |
| `ContextOptions` (stars/lots/transits/synastry/composite/timelords/vedic/provenance injection) | How every enriched surface feeds the reading | ∞ |
| Atom types: `FactKind`, `FactAtom`, `InterpretationContext`, `PlacementAtom`, `AspectAtom`, `PatternAtom`, `SignatureAtom`, `AngleAtom`, `AngleContactAtom`, `DispositorAtom`, `ReceptionAtom`, `StarAtom`, `LotAtom`, `TransitAtom`, `SynastryAtom`, `CompositeAtom`, `TimelordAtom`, `DignityAtom`, `NakshatraAtom`, `VargaAtom`, `YogaAtom`, `ParallelAtom`, `OutOfBoundsAtom` | The 17+-kind fact vocabulary = the content grid's coordinate system | ∞ |

### 1.37 `interpretation-enrich`

| Symbol | Surface | Scope |
|---|---|---|
| `enrichContextOptions` | One call to add transits + time-lords + Vedic atoms at a target instant (Today, year views, prompt packs) | ✓ |
| `enrichSynastryOptions` | Synastry + composite atoms for two charts (People readings) | ✓ |
| Types: `EnrichTarget`, `EnrichFlags` | Contracts | ∞ |

### 1.38 `interpret` — rules & matching

| Symbol | Surface | Scope |
|---|---|---|
| `interpret` | Runs the corpus over a chart → ranked cited reading | ✓ |
| `reconcile` | Groups entries by shared facts, dedupes, flags contested — the reading's section structure | ✓ |
| 20 selectors (`hasPlacement`, `hasAspect`, `hasPattern`, `hasSignature`, `hasAngle`, `hasAngleContact`, `hasDispositor`, `hasReception`, `hasStar`, `hasLot`, `hasTransit`, `hasSynastry`, `hasComposite`, `hasTimelord`, `hasDignityFine`, `hasNakshatra`, `hasVarga`, `hasParallel`, `hasOutOfBounds`, `hasYoga`) + combinators `matchAll`, `matchAny`, `matchNone` | The corpus compiler's target vocabulary — every synthetic content cell binds through these | ∞ |
| Types: `Match`, `Selector`, `Rule`, `InterpretationSource`, `ReadingEntry`, `Reading`, `ReadingGroup`, `ReconcileOptions` | Content contract | ∞ |

### 1.39 `relational`

| Symbol | Surface | Scope |
|---|---|---|
| `transitAspects` | Today's personalized transit stack; timeline hits | ✓ |
| `synastryAspects`, `synastryOverlays` | People: inter-aspect grid + house overlays both directions | ✓ |
| `compositePlacements` | Composite reading atoms | ✓ |
| Types: `TransitHit`, `SynastryAspectHit`, `SynastryOverlays`, `CompositePlacement` | Contracts | ∞ |

### 1.40 `brief`

| Symbol | Surface | Scope |
|---|---|---|
| `chartBrief`, `BRIEF_INSTRUCTIONS` | **Prompt packs**: deterministic themed LLM prompts from any artifact | ✓ |
| `realmFraming` | Provisional framing for uncertain/fictional charts in prompts | ✓ |
| `auditCitations` | "Check your AI's answer" verifier page | ✓ |
| Types: `BriefOptions`, `BriefFact`, `Brief`, `Claim`, `CitationAudit` | Contracts | ∞ |

### 1.41 `provenance`

| Symbol | Surface | Scope |
|---|---|---|
| `resolveTime`, `resolvePlace`, `isoToJd`, `parseOffset`, `isTimeAnchored`, `TIME_ANCHORED_REALMS` | Unknown-time mode (range anchors → certainty damping); Chart Lab narrative/relative anchors | ✓ |
| Types: `Realm` (9 realms), `TemporalAnchor`, `SpatialAnchor`, `GeoPlace`, `AnchorRegistry`, `Certainty`, `ResolvedTime`, `ResolvedPlace` | The uncertainty & fiction vocabulary | ✓ |

### 1.42 `anchored`

| Symbol | Surface | Scope |
|---|---|---|
| `realize` (+ `AnchoredChart`, `RealizedChart`) | Routes any anchored chart to ephemeris or compiler — the Chart Lab's spine and the unknown-time path | ✓ |

### 1.43 `counterfactual`

| Symbol | Surface | Scope |
|---|---|---|
| `counterfactual`, `chartDiff` | What-if explorer: shift time / move place / set longitudes → diff (sign/house changes, aspects gained/lost) | ✓ |
| Types: `CounterfactualEdit`, `BodyChange`, `AngleChange`, `ChartDiff`, `Counterfactual` | Contracts | ∞ |

### 1.44 `dignity-score`

| Symbol | Surface | Scope |
|---|---|---|
| `dignityScore`, `almuten` | Weighted dignity table (Lilly), almuten per degree; peregrine flags | ✓ |
| `termRuler`, `faceRuler`, `TERMS_EGYPTIAN`, `TRIPLICITY`, `FACE_CYCLE`, `DIGNITY_WEIGHTS`, `PLANETS` | Term/face/triplicity rows; decan (face) content pages | ✓ |
| Types: `Sect`, `DignityScore` | Contracts | ∞ |

### 1.45 `parans`

| Symbol | Surface | Scope |
|---|---|---|
| `parans`, `PARAN_ANGLES`, `DEFAULT_PARAN_BODIES` | Body-pair parans at your latitude | ✓ |
| `starParans`, `starAngleTimes` | Brady-style fixed-star parans card | ✓ |
| Types: `Paran`, `StarParan` | Contracts | ∞ |

### 1.46 `draconic`

| Symbol | Surface | Scope |
|---|---|---|
| `draconicLongitude`, `draconicLongitudes`, `nodeLongitude`, `draconicChart`, `NODE_BODY` | Chart hub's draconic view (zodiac re-zeroed at the lunar node; true/mean node option in Advanced) | ✓ |
| Types: `DraconicNode`, `DraconicChart` | Contracts | ∞ |

---

## 2. `caelus-mcp` — all 35 tools

Every tool maps twice: (a) its math backs an in-app surface via the engine
directly; (b) the hosted endpoint (`/api/mcp`) is itself the consumer
feature "Connect your AI" — agents compute real charts.

| # | Tool | In-app surface (tier) |
|---|---|---|
| 1 | `natal_chart` | My Chart |
| 2 | `current_sky` | Today header; "chart of this moment" |
| 3 | `sky_view` | The Planetarium |
| 4 | `sky_view_sequence` | Planetarium time scrub |
| 5 | `synthetic_validate` | Chart Lab authoring lint |
| 6 | `synthetic_positions` | Chart Lab invented-body positions |
| 7 | `synthetic_sky_view` | Chart Lab fictional sky renders |
| 8 | `transits` | Today transit stack |
| 9 | `synastry` | People reading (aspects + overlays + atoms + brief) |
| 10 | `find_aspect_dates` | Transit duration bars; timeline hits; "when is X exact" |
| 11 | `rectification_grid` | Birth-time finder |
| 12 | `sky_events` | Coming-up feed; calendars; eclipse local circumstances |
| 13 | `planetary_hours` | Planetary-hours panel |
| 14 | `void_of_course` | Moon strip + VoC calendar |
| 15 | `returns` | Birthday page + planetary returns |
| 16 | `progressions` | Progressions + solar arc surfaces |
| 17 | `composite` | Composite + Davison |
| 18 | `dignities` | Dignities panel |
| 19 | `lots` | Lots card |
| 20 | `profections` | Profections panel/lane |
| 21 | `firdaria` | Firdaria lane |
| 22 | `releasing` | ZR lanes |
| 23 | `directions` | Primary directions table |
| 24 | `nakshatras` | Nakshatra cards |
| 25 | `dasha` | Dasha timelines, 3 systems |
| 26 | `vargas` | Divisional charts |
| 27 | `yogas` | Yoga cards |
| 28 | `aspect_patterns` | Pattern badges |
| 29 | `parans` | Parans tool |
| 30 | `chart_signature` | Chart at a glance |
| 31 | `chart_facts` | Facts panel; prompt packs; unknown-time & Chart Lab paths |
| 32 | `counterfactual_chart` | What-if explorer |
| 33 | `similar_skies` | "Sky like this" search |
| 34 | `electional_search` | Date finder |
| 35 | `cosmic_weather` | Today mundane header |

MCP resources & prompts: `ui://widget/chart.html` → chart widget inside AI
hosts (shipped); `caelus://accuracy` → "about this computation" data;
`caelus://glossary` → Learn glossary seed; `rectification_session`
prompt → birth-time finder script; `natal_reading` prompt → the
grounded-reading procedure prompt packs adapt.

---

## 3. `caelus-birth`

| Symbol | Surface | Scope |
|---|---|---|
| `toUT` | Every birth-data entry: local→UT with historical tz/DST; `status` drives the ambiguous/nonexistent DST dialogs | ✓ |
| `localToChart` | One-call convenience path | ∞ |
| `openMeteoGeocoder` / `Geocoder` interface | Network place search fallback (with CC-BY attribution) beyond the offline gazetteer | ✓ |
| Types: `BirthInput`, `UTCandidate`, `UTResult`, `GeocodeResult` | Contracts | ∞ |

---

## 4. `caelus-wheel`

| Symbol | Surface | Scope |
|---|---|---|
| `ChartWheel` | Every wheel in the app (natal, return, composite, relocation, embeds, OG images — SSR-safe) | ✓ |
| `ChartWheelProps.bodies/aspectTypes/theme/glyphs/size/showAspects` | Wheel filtering (click-to-isolate), theming (light/share palettes), glyph overrides | ✓ |
| `spreadAngles` | Collision-free labels; reused by any custom ring | ∞ |
| `DARK_THEME`, `WheelTheme`, `GLYPHS` | Theme tokens; app adds light + share themes | ✓ |
| `ChartSphere` | 3-D sphere view | ✓ |
| `AstroMap` | Astrocartography map render (app supplies basemap children) | ✓ |
| `EphemerisGraph` | Graphic ephemeris + timeline lane rendering | ✓ |
| Types: `WheelPosition`, `WheelAspect`, `WheelChart`, `ChartWheelProps`, `SpherePosition`, `SphereChart`, `ChartSphereProps`, `MapLines`, `AngleKind`, `AstroMapProps`, `SeriesPoint`, `EphemerisGraphProps` | Contracts | ∞ |
| `MultiWheel` (rings API: any chart in any ring, contacts in the core; built at M1 from the `BiWheel` lift, `src/multiwheel.tsx`) | Synastry bi-wheels, transit and progressed rings, tri-wheels | ✓ |

---

## 5. `caelus-delineations-pd`

| Symbol | Surface | Scope |
|---|---|---|
| `sources` / `publicDomainSources` / `sourceById` | The PD reading source, shipped alongside the synthetic corpus (tradition toggle: "classical voices" vs "Caelus voice") | ✓ |
| `passages`, `passageSets`, `publicDomainPassages`, `corpusManifest`, `manifestByLayer` | Source-bibliography page ("where the classical text comes from"); strict-PD passage subset | ✓ |
| `selectorFromSpec`, `ruleFromPassage`, `compileSource` | **The synthetic-corpus pipeline reuses this compiler + validation harness verbatim** | ∞ |
| `correspondences`, `correspondencesForBody`, `correspondencesForSign` | Liber 777 correspondence tables in Learn (crystals/plants/etc., clearly labeled) | ✓ |
| Types: `PassageRecord`, `SelectorSpec`, `PassageSet`, `SourceManifestEntry`, `CorpusLayer`, `CorpusRights`, `SourceStatus`, `FetchSpec`, `CorrespondenceEntry`, `CorrespondenceData` | The content-pipeline contract every agent-written entry is emitted against | ∞ |

---

## 6. `apps/web` — existing assets to reuse

| Asset | Reuse in Caelus Free | Scope |
|---|---|---|
| Playground `ChartControls`, `CityPicker`, share codec (`lib/share.ts`) | Wizard + settings foundation; URL state | ✓ |
| `BiWheel.tsx` | Lift → `caelus-wheel` MultiWheel | ✓ |
| Tabs: `FactsTab`, `Aspectarian`, `DeclinationTab`, `StarsTab`, `InsightsTab`, `VedicTab`, `SkyViewTab`, `ReadingTab`, `SynastryPanel` | Direct ancestors of My Chart/People panels — restyle + rehome | ✓ |
| `SkyRibbon` | Today header ribbon (already server-rendered from the engine) | ✓ |
| Offline gazetteer + `build-gazetteer.mjs` | Place search | ✓ |
| `/api/chart` edge route | Public API + out-of-browser-range fallback | ✓ |
| `/api/mcp` hosted server | "Connect your AI" | ✓ |
| `/embed/chart` + widget bundle | AI-host chart widget; embeddable wheel for third parties | ✓ |
| Design tokens (`globals.css`), light/dark themes, `lib/facts.ts` build-time stats | Available machinery (token structure, theme plumbing, build-time stats). Caelus Free's visual identity is its own (proposal §8); these are reusable plumbing, and none of the developer site's look carries over by default | ✓ |
| SEO plumbing (sitemap, OG images, JSON-LD, search index) | Programmatic page infrastructure | ✓ |

---

## 7. Coverage check — mechanically audited

Audited 2026-08-15 by script: every export was extracted from
the source (`export function|class|const|interface|type|enum` declarations
plus `export { … }` blocks across `packages/caelus/src/*` including the
`data-embedded` and `node-loader` entry points, `packages/wheel/src/*`,
`packages/birth/src/*`, `packages/caelus-delineations-pd/src/*`), and every
extracted name was required to appear verbatim in this document.

- **Symbols extracted: 637. Missing from this map: 0** (strict
  exact-name check, no abbreviations).
- Engine modules: 45 of 45. Engine class methods: 14 of 14
  (`bodies`, `position`, `longitude`, `ecliptic`, `heliocentric`, `chart`,
  `chartAt`, `fixedStar`, `starNames`, `starConjunctions`, `lots`,
  `registerSource`, `registerRender`, `renderFor`).
- MCP tools: **35 of 35**, verified against the `registerTool` calls in
  `server.ts`, plus 3 resources and 2 prompts.
- Every symbol is either a user-visible surface (✓, all in the product) or
  explicitly infrastructure (∞) with the surface it powers named.

Reproduce the audit: extract exports with the regexes above and grep each
name against this file; any name that fails the check is a regression.

Known engine gaps for competitor parity (not export gaps — genuinely absent
math, see proposal §9): draconic transform, tertiary/minor progression
rates, converse directions, local-space lines, persona-chart convenience.
All small, reference-first additions; none blocks launch.
