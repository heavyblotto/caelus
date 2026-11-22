# FACT-001: Instrument I-05 (Field Verifier and Chronolocator)

- **Factory ID**: `FACT-001`
- **Instrument ID**: `I-05`
- **Route**: `/instruments/field-verifier`
- **Target Surfaces**: `packages/widgets/`, `apps/web/`, `apps/site/`
- **Engine Foundation**: `packages/caelus/src/observe.ts` (already shipped in Stages 1 and 2 on `feat/observe-and-release-rollup`; this track enters directly at Stage 3B and Stage 4)
- **Promotion Gate**: Clean `npm run preflight` on `feat/observe-and-release-rollup`

## 1. Objective

Add **Instrument I-05: Field verifier** alongside the four live Workbench
instruments in `apps/web/lib/instruments.ts`:
- `I-01`: Sky dating (`/instruments/sky-dating`)
- `I-02`: Uncertain time (`/instruments/uncertain-time`)
- `I-03`: Eclipses (`/instruments/eclipses`)
- `I-04`: First visibility (`/instruments/first-visibility`)
- `I-05`: Field verifier (`/instruments/field-verifier`)

The instrument runs 100% client-side in the visitor's browser using the
embedded ephemeris tier (`caelus/data-embedded`), sends zero user data to a
server, follows the Workbench instrument grammar in `apps/web/DESIGN.md`, and
displays the exact copyable TypeScript call beside every computed output.

## 2. Three Workbench Modes

One instrument exposes three focused tabs (`.tabs__tab` / `.seg`) over
`observe.ts`:

### Mode 1: Verify (`verifyObservation`)

- **Inputs**:
  - Preset selector (loaded from real verified scenarios in `EXP-003`):
    1. `nyc-summer-authentic`: NYC 2026-07-04 19:30 UTC, flat ground, matching shadow bearing + ratio (`consistent`)
    2. `tz-shift-spoof`: NYC scene claimed 4 hours earlier (`inconsistent` with `diagnostics.timeShift` recovering +240 min)
    3. `hemisphere-moon-spoof`: Southern Hemisphere crescent tilt claimed at Northern latitude (`inconsistent` with `diagnostics.hemisphereFlip`)
    4. `night-shadow-impossible`: Daytime shadow ratio claimed during astronomical night (`impossible`)
    5. `sloped-alpine`: 20-degree south-facing slope shadow verification
  - Claimed timestamp (UTC date + time), coordinates (lat, lonEast, optional
    elevation and ground slope), and time/place uncertainty tolerances.
  - Observed constraints (any subset): shadow bearing (deg), shadow length
    ratio, twilight stage, Sun visible, Moon visible, Moon bright-limb zenith
    angle (deg), Moon waxing flag, optional video shadow sweep
    (`dtMinutes`, `deltaBearingDeg`).
- **Outputs**:
  - Headline verdict badge (`consistent`, `marginal`, `inconsistent`,
    `impossible`, `unconstrained`) + `consistencyScore` + `chronosense.line`.
  - **Inline SVG Figure 1 (Compass and Shadow Dial)**: top-down compass rose
    showing predicted Sun azimuth, predicted cast shadow vector (length
    scaled to `lengthRatio`), observed shadow bearing wedge with tolerance arc,
    and Moon bright-limb orientation arrow when Moon is above the horizon.
  - Per-check breakdown table (`field`, `observed`, `predicted`, `residual`,
    `tolerance`, `status`).
  - Counterfactual Diagnostics tile (when verdict is `inconsistent` or
    `impossible`): displays `diagnostics.timeShift`, `diagnostics.hemisphereFlip`,
    and `diagnostics.dateShift` with one-click "Apply counterfactual" button to
    re-verify at the recovered time or hemisphere.

### Mode 2: Chronolocate (`chronolocate`)

- **Inputs**: Location (`lat`, `lonEast`, `elevationM`), UTC search window
  (clamped to `<= 370` days for responsive browser execution), and observed
  constraints (shadow bearing, shadow length ratio, twilight, Moon phase/tilt).
- **Outputs**:
  - Headline count of matching windows and peak window timestamp + score.
  - **Inline SVG Figure 2 (Timeline Track)**: matching UTC intervals along the
    search span with peak markers and solar-altitude envelope.
  - Results table listing each window's `startJdUt`, `peakJdUt`, `endJdUt`,
    duration, and peak score.

### Mode 3: Geolocate (`geolocate`)

- **Inputs**: Known UTC timestamp + observations (Sun azimuth/altitude or
  shadow bearing + length ratio for Path A analytical fix; Sun altitude + Moon
  altitude or shadow bearing + Moon bright-limb tilt for Path B spherical grid
  fix).
- **Outputs**:
  - Headline method (`analytical_sun_shadow`, `grid_search`) + top candidate
    `(lat, lonEast)` + uncertainty radius (km) or region kind (`point`,
    `compact`, `band`, `ring`, `scattered`).
  - **Inline SVG Figure 3 (Equirectangular Fix Plot)**: global outline grid
    showing the sub-solar point, sub-lunar point, candidate fix marker(s),
    error ellipse / bounding box, and antimeridian-safe wrap handling.
  - Candidate table with coordinates, score, uncertainty km, and region class.

## 3. Exact File Ownership Map

Follow the split pattern established by `packages/widgets/src/first-visibility.ts`
and `first-visibility-widget.tsx`:

1. **Pure logic module (zero React imports)**:
   - `packages/widgets/src/field-verifier.ts`
   - Exports: `FIELD_VERIFIER_PRESETS`, `FIELD_VERIFIER_PLACES`,
     `FieldVerifierQuery`, `FieldVerifierResult`, `runFieldVerifier(engine, query)`,
     `fieldVerifierSource(query)` (generates copyable TS snippet importing from
     `"caelus"`), SVG geometry helpers (`compassDialGeometry`, `timelineGeometry`,
     `fixMapGeometry`), and validation helpers.
2. **React client widget**:
   - `packages/widgets/src/field-verifier-widget.tsx`
   - Props: `{ engine: Engine; initialPreset?: string }`.
   - Emits Workbench layout classes (`.bench`, `.tile`, `.control`, `.field`,
     `.btn`, `.seg`, `.tabs__tab`) and zero ad-hoc inline style objects.
   - Includes 3 bottom method tiles (`M-1: Forward shadow and refraction model`,
     `M-2: Tolerance widening and counterfactual forensics`,
     `M-3: Embedded-tier browser limits`).
3. **Package exports and tests**:
   - `packages/widgets/package.json` (export `./field-verifier` and
     `./field-verifier-widget`; wire `node dist/test/field-verifier.test.js`
     into `scripts.test`).
   - `packages/widgets/test/field-verifier.test.ts` (tests every preset, all 3
     modes, generated TS source validity, antimeridian SVG math, and SSR
     rendering via `react-dom/server`).
4. **Next.js web app (`apps/web/`)**:
   - `apps/web/lib/instruments.ts` (append `I-05` entry).
   - `apps/web/app/instruments/field-verifier/FieldVerifierIsland.tsx`
   - `apps/web/app/instruments/field-verifier/page.tsx`
   - `apps/web/app/sitemap.ts` (register `/instruments/field-verifier`).
5. **Astro static site (`apps/site/`)**:
   - `apps/site/src/pages/instruments/field-verifier.astro`
   - `apps/site/src/islands/registry.ts` (add `FieldVerifier` lazy loader)
   - `apps/site/src/islands/web/` wrapper matching `FirstVisibility`.

## 4. Acceptance Gates (Stages 3 and 4)

All commands must pass with zero failures on branch `feat/instrument-i05-field-verifier`:

- `npm run build -w caelus-widgets && npm run test -w caelus-widgets`
- `npm run lint:emdash` (zero em-dashes in all new TSX/TS/MDX prose)
- `npm run lint:prose` (Vale editorial-voice compliance)
- `npm run check:docs && npm run facts:sync && npm run lint:claims`
- `npm run test:web`
- `npm run build:site && npm run smoke:site`
- `npm run preflight` (signed off by an independent read-only `verifier`)
