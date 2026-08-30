"use client";

import { useMemo, useState } from "react";
import { Engine, fmtLon, pheno } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT } from "caelus-birth";
import { ChartWheel } from "caelus-wheel";
import { deriveScene } from "caelus-widgets/derivation";
import CodeBlock from "../CodeBlock";
import SkyRibbon from "../SkyRibbon";
import { A, H2, P } from "../Prose";
import { WHEEL_THEME } from "../../lib/wheelTheme";
import { SITE } from "../../lib/site";
import { NYC, formatNycStamp, type NycCivil } from "../../lib/nycNow";
import { pickPlate } from "./skyPlates";
import { scenicAim } from "./scenicAim";
import HomeSkyStage from "./HomeSkyStage";

const FIGURE = 560;

export default function HomeLive({ civil }: { civil: NycCivil }) {
  const [t, setT] = useState(0);
  const engine = useMemo(() => new Engine(embeddedData), []);

  const ut = useMemo(() => toUT({
    year: civil.y, month: civil.mo, day: civil.d,
    hour: civil.h, minute: civil.mi,
    lat: NYC.lat, lon: NYC.lonEast, zone: "America/New_York",
  }), [civil]);

  const i = ut.utc;
  const params = useMemo(() => ({
    instant: { y: i.year, mo: i.month, d: i.day, h: i.hour, mi: i.minute, s: i.second },
    place: { latDeg: NYC.lat, lonEastDeg: NYC.lonEast, label: NYC.label },
    houseSystem: "placidus" as const,
  }), [i.year, i.month, i.day, i.hour, i.minute, i.second]);

  const scene = useMemo(() => deriveScene(engine, params), [engine, params]);
  const chart = useMemo(() => engine.chart(
    i.year, i.month, i.day, i.hour, i.minute, i.second,
    NYC.lat, NYC.lonEast, "placidus",
  ), [engine, i.year, i.month, i.day, i.hour, i.minute, i.second]);

  const aim = useMemo(() => scenicAim(scene), [scene]);
  const sun = scene.bodies.find((b) => b.id === "sun");
  const moon = scene.bodies.find((b) => b.id === "moon");
  const moonIllum = useMemo(() => pheno(engine, "moon", ut.jdUt).phase, [engine, ut.jdUt]);
  const plate = pickPlate(
    sun?.altDeg ?? 0,
    moon?.altDeg ?? -90,
    moonIllum,
    aim.az,
  );

  const stamp = formatNycStamp(civil);
  const sunLon = chart.bodies.sun ? fmtLon(chart.bodies.sun.lon) : "";
  const satRx = chart.bodies.saturn?.retrograde ?? false;
  const sample = `import { Engine, fmtLon } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const engine = new Engine(embeddedData);

const chart = engine.chart(
  ${i.year}, ${i.month}, ${i.day}, ${i.hour}, ${i.minute}, ${i.second},
  ${NYC.lat.toFixed(2)}, ${NYC.lonEast.toFixed(2)},
  "placidus",
);

fmtLon(chart.bodies.sun.lon);   // "${sunLon}"
chart.bodies.saturn.retrograde; // ${satRx}`;

  const ribbonStamp =
    `sky now · ${stamp} · sun ${sunLon}`
    + (chart.bodies.moon ? ` · moon ${fmtLon(chart.bodies.moon.lon)}` : "");

  return (
    <>
      <HomeSkyStage
        scene={scene}
        openingAim={aim}
        plate={plate}
        t={t}
        onScrub={setT}
        size={FIGURE}
        theme={WHEEL_THEME}
        stamp={stamp}
      />

      <figure className="home-sky__chart">
        {t < 0.995 && (
          <div className="chart-fluid">
            <ChartWheel chart={chart} size={FIGURE} theme={WHEEL_THEME} />
          </div>
        )}
        <figcaption className="dim small" style={{ marginTop: "0.5rem" }}>
          The event chart for this instant, Placidus houses, tropical zodiac.
        </figcaption>
      </figure>

      <div style={{ margin: "1.5rem 0 0.5rem" }}>
        <SkyRibbon chart={chart} stamp={ribbonStamp} />
      </div>

      <H2>Compute a chart</H2>
      <P>
        You pass a date, a UT time, a latitude, and a longitude, and the engine
        returns a chart object your app, API, or AI tool can read. The sample
        below is the New York instant drawn above.
      </P>
      <CodeBlock lang="bash" code="npm install caelus" />
      <CodeBlock lang="typescript" label="chart.ts" code={sample} />
      <P dim>
        Full walkthrough in the <A href="/docs/quickstart">Quickstart</A>, or try it live in the{" "}
        <A href="/playground">Playground</A>. For a complete app, the{" "}
        <A href={SITE.starter}>caelus-starter</A> template is a Next.js project with a
        birth form, timezone handling, and a chart wheel, deployable to Vercel in one click.
      </P>
    </>
  );
}
