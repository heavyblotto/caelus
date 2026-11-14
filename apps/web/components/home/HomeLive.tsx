"use client";

import { useMemo, useState } from "react";
import { Engine, fmtLon, pheno } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT } from "caelus-birth";
import { ChartWheel } from "caelus-wheel";
import { deriveScene } from "caelus-widgets/derivation";
import CodeBlock from "../CodeBlock";
import SkyRibbon from "../SkyRibbon";
import { A } from "../Prose";
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
      <section className="tile home-sky-tile" aria-label="The sky over New York now">
        <div className="tile__h">
          <b>SKY</b>
          <span>Computed in this browser</span>
          <i><span className="led led--live" aria-hidden />{stamp}</i>
        </div>
        <HomeSkyStage
          scene={scene}
          openingAim={aim}
          plate={plate}
          t={t}
          onScrub={setT}
          size={FIGURE}
          theme={WHEEL_THEME}
        />
      </section>

      <section className="tile s12" aria-label="Current ecliptic longitudes">
        <div className="tile__h">
          <b>NOW</b>
          <span>Current ecliptic longitudes</span>
        </div>
        <SkyRibbon chart={chart} stamp={ribbonStamp} />
      </section>

      <div className="band">
        <h2>Compute a chart</h2>
      </div>
      <section className="tile s4 half">
        <div className="tile__h">
          <b>CHART</b>
          <span>Placidus, tropical</span>
        </div>
        <div className="chart-fluid">
          <ChartWheel chart={chart} size={FIGURE} theme={WHEEL_THEME} />
        </div>
        <p className="note">Current event chart for New York.</p>
      </section>
      <section className="tile s8">
        <div className="tile__h">
          <b>TS</b>
          <span>Usage example</span>
        </div>
        <div className="tile__b">
          <p>
            Pass a UTC date and time, latitude, longitude, and house system to
            compute a chart object containing body longitudes, house cusps, and
            aspects. The example below produces the New York chart shown on the left.
          </p>
          <CodeBlock lang="bash" code="npm install caelus" />
          <CodeBlock lang="typescript" label="chart.ts" code={sample} />
          <p>
            Full walkthrough in the <A href="/docs/quickstart">Quickstart</A>, or try it live in the{" "}
            <A href="/playground">Playground</A>. For a complete app, the{" "}
            <A href={SITE.starter}>caelus-starter</A> template is a Next.js project with a
            birth form, timezone handling, and a chart wheel, deployable to Vercel in one click.
          </p>
        </div>
      </section>
    </>
  );
}
