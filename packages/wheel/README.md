# caelus-wheel

React SVG chart wheel for [caelus](https://github.com/heavyblotto/caelus).
SSR-safe with zero runtime dependencies (`react` is a peer dependency), ~3 KB gzipped.

```bash
npm install caelus-wheel
```

```tsx
import { ChartWheel } from "caelus-wheel";

<ChartWheel
  chart={chart}            // caelus Chart object or caelus-mcp chart payload, as-is
  size={520}               // px, square
  showAspects={true}
  aspectTypes={["conjunction", "sextile", "square", "trine", "opposition"]}
  theme={{ axis: "#8a7fd4" }}  // Partial<WheelTheme>; dark default
/>
```

`chart` accepts either a `Chart` object from the `caelus` engine or a
`natal_chart` / `current_sky` response from `caelus-mcp`. The MCP payload's
`rx` retrograde flag is supported directly, and `signDeg` is derived from `lon`
when omitted so you can pass an MCP tool response straight to the component.

## What it draws

- **Zodiac ring**: sign glyphs, sign boundaries, and 1°/5°/10° tick marks.
- **House ring**: cusps from `chart.cusps` across all 12 supported house
  systems, house numbers, and emphasized AC/MC/DC/IC labels.
- **Planets**: glyphs, degree/minute labels, `℞` retrograde markers, and
  pointer ticks at exact longitudes. Bodies within ~6.5° fan out radially with
  connector lines back to their true positions so crowded stelliums stay readable.
- **Aspect lines**: chords in the inner circle colored by type (solid for hard
  aspects, dashed for soft) with opacity scaled by orb tightness.
- **Uncertainty arcs** (opt-in): swept longitude ranges for each body and angle
  across a time window. See below.

Uses standard Western orientation: Ascendant at 9 o'clock, longitudes increasing
counterclockwise.

## Uncertainty: showing a time window on the wheel

When a birth time or event time is approximate, pass the `uncertainty` prop to
plot a time range alongside the point-in-time chart. Each planet gets an arc
just inside the zodiac ring covering its range of longitudes, and the Ascendant
and Midheaven get arcs near the outer rim (with the Ascendant on the outermost
track).

```tsx
import { Engine, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel } from "caelus-wheel";

const engine = new Engine(embeddedData);
const jd = julianDay(1990, 6, 10, 18, 30);
const at = (minutes: number) =>
  engine.chartAt(jd + minutes / 1440, 27.95, -82.46);

export default function Wheel() {
  // an hour either way, sampled every half hour
  const samples = [-60, -30, 0, 30, 60].map(at);
  return <ChartWheel chart={at(0)} uncertainty={{ samples }} />;
}
```

Pass `samples` as chronologically ordered charts spanning the window, from start
to end. The overlay sums the shortest angular step between adjacent samples, so
two samples (start and end) are usually sufficient for planets. Because angles
complete a full rotation every ~24 hours, sample every 30 minutes across a
multi-hour window; over a full day, the angle arcs close into complete circles.

Arcs that cross a sign boundary render with a heavier stroke and a square marker
at the boundary. Over a typical birth-time window of a few hours, the angles
sweep across wide arcs while slower planets remain nearly stationary. Samples
without `angles` (charts computed without geographic coordinates) draw planet
arcs only. Arcs inherit the theme's `axis` color unless `uncertainty.color` is
specified.

You can also call `sweptArc(lons)` directly to compute the starting longitude,
angular span, and crossed sign boundaries from an array of longitudes. When
`uncertainty` is omitted, the wheel renders without these overlays.

## MultiWheel: stacked chart rings

Render up to four concentric chart rings around a single zodiac, such as
synastry bi-wheels or natal, progressed, and transit tri-wheels. Ring 0
(innermost) sets the wheel orientation and house cusps, and inter-chart aspects
are drawn in the center.

```tsx
import { MultiWheel } from "caelus-wheel";

<MultiWheel
  rings={[
    { chart: natal, label: "natal" },
    { chart: transits, label: "transits", color: "#dd6ba1" },
  ]}
  contacts={[
    { a: { ring: 0, body: "moon" }, b: { ring: 1, body: "saturn" },
      aspect: "opposition", orb: 1.2 },
  ]}
  size={520}
/>
```

Degree labels draw at one or two rings and drop at three or more, where
the bands get thin; glyph size scales with the ring count. `showAspects`
adds ring 0's own aspect lines under the contacts, and `showHouses={false}`
removes the cusp spokes.

## Notes

- `mean_node` is hidden by default (it sits ~1° from the true node and
  doubles the glyph); pass `bodies={Object.keys(chart.bodies)}` to show
  every body, or any subset to filter.
- Glyphs are Unicode astrological characters embedded as SVG text. If a
  host font lacks one, override per body: `glyphs={{ chiron: "Ch" }}`.
- Pure React render with no hooks or browser-only APIs: works in React Server
  Components, static exports, and `renderToStaticMarkup` (which is how the test
  suite verifies rendered output from real engine charts).

## The caelus packages

- [caelus](https://www.npmjs.com/package/caelus): core ephemeris and chart engine
- [caelus-birth](https://www.npmjs.com/package/caelus-birth): offline timezone and place resolution (local birth time to UT)
- `caelus-wheel`: this package
- [caelus-mcp](https://www.npmjs.com/package/caelus-mcp): MCP server providing thirty-seven chart tools over stdio
