import { Engine, astrocartography, ephemeris, julianDay, type BodyId } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartSphere, AstroMap, EphemerisGraph } from "caelus-wheel";
import { Eyebrow, Lead, P, H2 } from "../../../components/Prose";
import CodeBlock from "../../../components/CodeBlock";
import { UncertaintyWheel } from "../../../components/docs/UncertaintyWheel";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../../lib/wheelTheme";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Visualizations",
  description:
    "SVG diagram components beyond the flat wheel: a 3D celestial sphere, astrocartography world map, graphic ephemeris, uncertainty arcs, and Sky View camera projections.",
  path: "/docs/visualizations",
});

const engine = new Engine(embeddedData);

// A fixed instant so this page renders deterministically at build time.
const SPHERE_DATE = { y: 2026, mo: 6, d: 13, h: 12, lat: 40.7128, lon: -74.006 };
const sphereChart = engine.chart(
  SPHERE_DATE.y, SPHERE_DATE.mo, SPHERE_DATE.d, SPHERE_DATE.h, 0, 0,
  SPHERE_DATE.lat, SPHERE_DATE.lon, "placidus",
);

const MAP_BODIES: BodyId[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
const mapJd = julianDay(2026, 6, 13, 12);
const mapLines = astrocartography(engine, mapJd, MAP_BODIES);

const GRAPH_BODIES: BodyId[] = ["mars", "jupiter", "saturn"];
const graphSeries = ephemeris(engine, GRAPH_BODIES, {
  start: julianDay(2026, 1, 1),
  end: julianDay(2028, 1, 1),
  step: 7,
  value: "longitude",
});

const SPHERE_CODE = `import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartSphere } from "caelus-wheel";

const engine = new Engine(embeddedData);
const chart = engine.chart(2026, 6, 13, 12, 0, 0, 40.71, -74.01, "placidus");

// The chart's bodies already carry ecliptic latitude, so the sphere can
// lift each planet off the ecliptic plane (a flat wheel collapses that to 0).
export function Sphere() {
  return <ChartSphere chart={chart} size={360} tilt={64} />;
}`;

const MAP_CODE = `import { Engine, astrocartography, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { AstroMap } from "caelus-wheel";

const engine = new Engine(embeddedData);
const jd = julianDay(2026, 6, 13, 12); // one instant, UT
const lines = astrocartography(engine, jd, ["sun", "moon", "venus", "mars", "jupiter"]);

// MC/IC are meridians; ASC/DSC are the curved rising and setting tracks.
// The basemap is a graticule; pass coastline paths as children to layer a map.
export function Map() {
  return <AstroMap lines={lines} width={680} height={340} />;
}`;

const GRAPH_CODE = `import { Engine, ephemeris, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { EphemerisGraph } from "caelus-wheel";

const engine = new Engine(embeddedData);
const series = ephemeris(engine, ["mars", "jupiter", "saturn"], {
  start: julianDay(2026, 1, 1),
  end: julianDay(2028, 1, 1),
  step: 7,            // weekly samples
  value: "longitude", // or latitude, declination, rightAscension, speed
});

// wrap=360 splits each line where longitude rolls 360 back to 0.
export function Graph() {
  return <EphemerisGraph series={series} width={680} height={340} wrap={360} />;
}`;

const figure: React.CSSProperties = {
  margin: "1rem 0 1.5rem",
  display: "flex",
  justifyContent: "center",
  overflowX: "auto",
};

const UNCERTAINTY_CODE = `import { Engine, julianDay } from "caelus";
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
}`;

export default function Visualizations() {
  return (
    <>
      <Eyebrow>Guides</Eyebrow>
      <h1>Visualizations</h1>
      <Lead>
        Beyond the traditional flat chart wheel, <code>caelus-wheel</code>{" "}
        provides three dependency-free SVG visualizations driven by engine
        outputs: a 3D celestial sphere, an astrocartography world map, and a
        graphic ephemeris. Every diagram below is server-rendered directly from
        the embedded dataset.
      </Lead>

      <H2>3D chart sphere</H2>
      <P>
        While a flat wheel projects every planet onto the ecliptic circle,{" "}
        <code>ChartSphere</code> preserves each body&rsquo;s true ecliptic
        latitude, showing where the Moon or Pluto rises above or dips below the
        ecliptic plane. Great-circle rings mark the ecliptic and celestial
        equator (solid in the foreground hemisphere, faded on the far side). To
        compute full 3D angular separation rather than ecliptic-longitude
        differences alone, call <code>angularSeparation3d</code> in{" "}
        <code>caelus</code>.
      </P>
      <div style={figure}>
        <ChartSphere chart={sphereChart} size={360} tilt={64} theme={WHEEL_THEME} />
      </div>
      <CodeBlock lang="tsx" label="ChartSphere.tsx" code={SPHERE_CODE} />

      <H2>Astrocartography map</H2>
      <P>
        Using each planet&rsquo;s right ascension, declination, and Greenwich
        sidereal time at a given timestamp, <code>astrocartography</code>{" "}
        computes four lines worldwide: straight MC and IC meridians alongside
        curved rising (ASC) and setting (DSC) tracks. <code>AstroMap</code>{" "}
        draws them over an equirectangular coordinate graticule, accepting custom
        continent or border SVG paths as <code>children</code>.
      </P>
      <div style={figure}>
        <AstroMap lines={mapLines} width={680} height={340} theme={WHEEL_THEME} colors={WHEEL_LINE_COLORS} />
      </div>
      <CodeBlock lang="tsx" label="AstroMap.tsx" code={MAP_CODE} />

      <H2>Graphic ephemeris</H2>
      <P>
        <code>ephemeris</code> samples longitude, latitude, declination, right
        ascension, or speed over time, and <code>EphemerisGraph</code> plots the
        resulting curves while splitting segments cleanly whenever wrapped
        longitudes roll past 360&deg; back to 0&deg;. Below is a two-year plot
        of Mars, Jupiter, and Saturn sampled at weekly intervals.
      </P>
      <div style={figure}>
        <EphemerisGraph series={graphSeries} width={680} height={340} wrap={360} theme={WHEEL_THEME} colors={WHEEL_LINE_COLORS} />
      </div>
      <CodeBlock lang="tsx" label="EphemerisGraph.tsx" code={GRAPH_CODE} />

      <H2>Uncertainty on the wheel</H2>
      <P>
        Pass an ordered array of sampled charts via the <code>uncertainty</code>{" "}
        prop on <code>ChartWheel</code> to display travel arcs across an
        uncertain time window. Body arcs render just inside the zodiac ring while
        Ascendant and Midheaven arcs follow the outer rim, thickening with a
        square cusp marker whenever a range crosses a sign boundary. Because
        angles move roughly 15&deg; per hour, sample every 30 minutes across
        multi-hour spans. See the{" "}
        <a href="/docs/uncertain-time">Uncertain Times</a> guide for details.
      </P>
      <UncertaintyWheel />
      <CodeBlock lang="tsx" label="ChartWheel.tsx" code={UNCERTAINTY_CODE} />

      <H2>Sky View</H2>
      <P>
        Sky View projects the observable night or twilight sky from a
        specific location, timestamp, compass aim (azimuth and altitude), and
        camera lens preset, generating exact pixel coordinates and a structured
        prompt for image-generation models. Output covers in-frame planets (with
        apparent size and magnitude cues), lunar phase and crescent tilt angle,
        twilight sky brightness and limiting magnitude, the local horizon, the
        Milky Way band, and naked-eye field stars, leaving pixel synthesis to
        your chosen image model.
      </P>
      <P>
        Optional coordinate overlays project the ecliptic, zodiac signs, house
        cusps, angles, and constellation stick figures at matching pixel
        coordinates. <code>skyViewSequence</code> steps the camera across time
        for time-lapse sequences, reporting celestial pole position and frame
        rotation per step. Explore interactive overlays and animation controls on
        the <a href="/playground">playground</a> Sky View tab.
      </P>

      <H2>Next steps</H2>
      <P>
        Every component above consumes standard outputs from{" "}
        <code>caelus</code> alongside the flat <code>ChartWheel</code> in{" "}
        <a href="/docs/architecture">Architecture</a>. Continue to{" "}
        <a href="/docs/recipes">Recipes</a> for <code>when()</code> time queries
        and event searches, or <a href="/docs/electional">Electional Search</a>{" "}
        for multi-day window ranking.
      </P>
    </>
  );
}
