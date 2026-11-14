# caelus-wheel

React SVG chart wheel for [caelus](https://github.com/heavyblotto/caelus).
SSR-safe, zero runtime dependencies (react is a peer), ~3.4 KB gzipped.

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

`chart` accepts either the `Chart` object from the caelus engine or a
`natal_chart` / `current_sky` response from caelus-mcp — the MCP payload's
`rx` retrograde flag is understood and `signDeg` is derived from `lon`
when absent. An MCP client can pipe a tool response straight in.

## What it draws

- **Zodiac ring** — sign glyphs, sign boundaries, 1°/5°/10° tick marks.
- **House ring** — cusps from `chart.cusps` (all four systems), house
  numbers, AC/MC/DC/IC emphasized and labeled.
- **Planets** — glyph, degree°minute label, ℞ retrograde mark, a pointer
  tick at the true longitude. Bodies within ~6.5° fan out radially with a
  thin connector back to the true position, preserving zodiacal order —
  stelliums stay readable.
- **Aspect lines** — chords in the inner circle, colored by type, solid
  for hard aspects / dashed for soft, opacity scaled by orb tightness.
- **Uncertainty arcs** (opt-in) — where each body and angle could be across
  a window of time. See below.

Orientation is the Western convention: ASC at 9 o'clock, longitudes
counterclockwise.

## Uncertainty: a window of time on the wheel

A chart is drawn for one instant, and the instant is often not known that
well. Pass `uncertainty` and the wheel draws the window as well as the
instant: an arc for each body just inside the zodiac ring, covering the
longitudes it passes through, and an arc for the Ascendant and the Midheaven
near the rim (the Ascendant's is the outer one).

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

`samples` are charts across the window in time order, the first at its start
and the last at its end. The layer adds up the steps between neighbours, each
taken the short way round, so two samples are enough for the bodies. The
angles turn once a day: for a window of hours give a sample every half hour
or so, and over a whole day their arcs close into full circles.

An arc that crosses a sign boundary is drawn heavier and carries a square on
the boundary. A planet that barely moves has an arc too short to see, which
is the reading the layer is for: over an uncertain birth time the planets
hold and the angles sweep. Samples without `angles` (a chart with no place)
draw the bodies only. Arcs take the theme's `axis` color unless
`uncertainty.color` is set.

`sweptArc(lons)` is the arithmetic on its own: the lowest longitude reached,
the degrees covered, and the sign boundaries inside. With the prop left out
the wheel renders exactly as it did before the layer existed.

## MultiWheel: stacked chart rings

Any chart in any ring: synastry bi-wheels, natal + progressed + transit
tri-wheels, up to four rings around one zodiac. Ring 0 (innermost) orients
the wheel and provides the house cusps; inter-chart aspects draw as lines
in the core.

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
- Pure render: no hooks, no client-only APIs — works in server components,
  static export, and `renderToStaticMarkup` (the test suite renders real
  engine charts exactly that way).

## The caelus packages

- [caelus](https://www.npmjs.com/package/caelus) — the engine
- [caelus-birth](https://www.npmjs.com/package/caelus-birth) — local birth time + place → UT
- caelus-wheel — this package
- [caelus-mcp](https://www.npmjs.com/package/caelus-mcp) — MCP server, thirty-eight chart tools over stdio
