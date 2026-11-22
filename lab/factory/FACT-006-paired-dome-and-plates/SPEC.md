# FACT-006: Paired View, Live Reader-Chart Binding, and OKLCH Theme Completeness

- **Factory ID**: `FACT-006`
- **Status**: `queued`
- **Mined Prior Art**:
  - `feature/caelus-free`: commits `ae35c25` (paired wheel+sphere flattening), `378a3c6` (dome + sphere dual projection), `88163ce` (layered source overlays), `ae015d9` ("one dome, three skies"), and `docs/product/caelus-free-audit.md` (rendered-DOM & contrast audit)
  - `archive/feature/house-corpus`: `apps/web/lib/reader-chart.ts` (client-only site-wide chart binding) and `docs/design/ds-01-disposition.md` (8-step type scale, 4px spacing scale, OKLCH light-theme twins)
- **Target Surfaces**: `packages/wheel/`, `packages/widgets/`, `apps/web/`, `apps/site/`

## 1. Three Reusable Components

1. **Paired 2D + 3D View (`caelus-wheel` + `caelus-widgets`)**:
   - Shared selection model linking 2D projection (`ChartWheel` or Instrument
     I-05 shadow-compass dial) and 3D `ChartSphere` / local sky dome.
   - Smooth projection flattening transition showing ecliptic latitude,
     out-of-bounds declinations, and true 3D angular separation honestly.
   - Layer toggle model ("layers, not modes") allowing independent visibility
     of real sky, synthetic/ephemeris overlays, and horizon/shadow vectors.
2. **Client-Only Reader Location / Chart Binding**:
   - Zero-server browser state (modeled on `reader-chart.ts` sharing the
     Playground `Share` codec) so visitors entering their coordinates or birth
     chart once can populate Instruments I-01 through I-05 automatically.
3. **OKLCH Light/Dark Completeness and Token Cleanup**:
   - Apply the standing keepers from `ds-01-disposition.md`: 8-step type scale,
     4px spacing scale, 3 semantic surfaces, and OKLCH-derived light-theme ink
     twins so planet, shadow, and twilight plot lines remain legible on light
     backgrounds.

## 2. Hard Verification Gate (Learned From `caelus-free-audit.md`)

Unit tests and typechecks alone are insufficient for UI tracks. Stage 4
requires a real browser render verification confirming:
- Every instrument and paired-view route renders non-zero live `<svg>` nodes.
- Interactive controls update SVG geometry visibly without console errors.
- Both dark and light themes meet WCAG AA contrast across text, buttons, and
  SVG ink, and pass `tufte-critique` visual review.
