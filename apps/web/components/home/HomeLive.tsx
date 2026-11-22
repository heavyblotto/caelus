"use client";

import { useMemo, useState } from "react";
import { Engine, azAlt, fmtLon, julianDay, pheno, twilightStage } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT } from "caelus-birth";
import { ChartWheel, GLYPHS } from "caelus-wheel";
import { deriveScene } from "caelus-widgets/derivation";
import CodeBlock from "../CodeBlock";
import SkyRibbon from "../SkyRibbon";
import { A } from "../Prose";
import { WHEEL_THEME } from "../../lib/wheelTheme";
import { SITE } from "../../lib/site";
import { NYC, formatNycStamp, type NycCivil } from "../../lib/nycNow";
import { pickPlate } from "./skyPlates";
import { scenicAim } from "./scenicAim";
import HomeSkyStage, { type SolarArcData } from "./HomeSkyStage";

const FIGURE = 560;

interface ObserverPreset {
  id: string;
  label: string;
  lat: number;
  lonEast: number;
  hasPlate?: boolean;
}

const OBSERVERS: ObserverPreset[] = [
  { id: "nyc", label: "New York", lat: NYC.lat, lonEast: NYC.lonEast, hasPlate: true },
  { id: "lon", label: "London", lat: 51.5074, lonEast: -0.1278 },
  { id: "tok", label: "Tokyo", lat: 35.6762, lonEast: 139.6503 },
  { id: "sfo", label: "San Francisco", lat: 37.7749, lonEast: -122.4194 },
  { id: "rek", label: "Reykjavik", lat: 64.1466, lonEast: -21.9426 },
  { id: "syd", label: "Sydney", lat: -33.8688, lonEast: 151.2093 },
];

const TIME_OFFSETS = [
  { hours: -6, label: "-6h" },
  { hours: 0, label: "Now" },
  { hours: 6, label: "+6h" },
  { hours: 12, label: "+12h" },
] as const;

const CLASSICAL = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

const TWILIGHT_NAMES: Record<string, string> = {
  day: "Daylight",
  civil: "Civil twilight",
  nautical: "Nautical twilight",
  astronomical: "Astronomical twilight",
  night: "Night",
};

function fmtCoord(lat: number, lonEast: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lonEast >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lonEast).toFixed(2)}° ${ew}`;
}

function fmtUtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UT`;
}

export interface HomeLiveProps {
  civil: NycCivil;
  /**
   * "full" (default): SKY stage + NOW SkyRibbon + Compute a chart band (ChartWheel + TS example).
   * "stage-only": SKY stage + NOW SkyRibbon (lets page.tsx own the code-comparison band).
   * "hero-only": SKY stage tile only.
   */
  variant?: "full" | "stage-only" | "hero-only";
}

export default function HomeLive({ civil, variant = "full" }: HomeLiveProps) {
  const [t, setT] = useState(0);
  const [observerId, setObserverId] = useState<string>("nyc");
  const [offsetHours, setOffsetHours] = useState<number>(0);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [hoveredBody, setHoveredBody] = useState<string | null>(null);

  const engine = useMemo(() => new Engine(embeddedData), []);
  const observer = useMemo(
    () => OBSERVERS.find((o) => o.id === observerId) ?? OBSERVERS[0],
    [observerId],
  );

  const baseUt = useMemo(() => toUT({
    year: civil.y, month: civil.mo, day: civil.d,
    hour: civil.h, minute: civil.mi,
    lat: NYC.lat, lon: NYC.lonEast, zone: "America/New_York",
  }), [civil]);

  const instantDate = useMemo(() => {
    const u = baseUt.utc;
    return new Date(Date.UTC(u.year, u.month - 1, u.day, u.hour + offsetHours, u.minute, u.second));
  }, [baseUt.utc, offsetHours]);

  const i = useMemo(() => ({
    year: instantDate.getUTCFullYear(),
    month: instantDate.getUTCMonth() + 1,
    day: instantDate.getUTCDate(),
    hour: instantDate.getUTCHours(),
    minute: instantDate.getUTCMinutes(),
    second: instantDate.getUTCSeconds(),
  }), [instantDate]);

  const jdUt = useMemo(
    () => julianDay(i.year, i.month, i.day, i.hour, i.minute, i.second),
    [i.year, i.month, i.day, i.hour, i.minute, i.second],
  );

  const computed = useMemo(() => {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const params = {
      instant: { y: i.year, mo: i.month, d: i.day, h: i.hour, mi: i.minute, s: i.second },
      place: { latDeg: observer.lat, lonEastDeg: observer.lonEast, label: observer.label },
      houseSystem: "placidus" as const,
    };
    const scene = deriveScene(engine, params);
    const chart = engine.chart(
      i.year, i.month, i.day, i.hour, i.minute, i.second,
      observer.lat, observer.lonEast, "placidus",
    );
    const moonIllum = pheno(engine, "moon", jdUt).phase;

    // 24-hour UT solar altitude arc (25 samples, < 0.3 ms)
    const jdDayStart = julianDay(i.year, i.month, i.day, 0, 0, 0);
    const arcSamples: SolarArcData["samples"] = [];
    for (let h = 0; h <= 24; h++) {
      const jdH = jdDayStart + h / 24;
      const sunPos = engine.position("sun", jdH);
      const [, altDeg] = azAlt(engine.data, sunPos.lon, sunPos.lat, jdH, observer.lat, observer.lonEast);
      arcSamples.push({ hour: h, altDeg });
    }
    const elapsedMs = typeof performance !== "undefined" ? Math.max(0.1, performance.now() - t0) : 0.4;
    return { scene, chart, moonIllum, arcSamples, elapsedMs };
  }, [engine, i, jdUt, observer.lat, observer.lonEast, observer.label]);

  const { scene, chart, moonIllum, arcSamples, elapsedMs } = computed;
  const aim = useMemo(() => scenicAim(scene), [scene]);
  const sun = scene.bodies.find((b) => b.id === "sun");
  const moon = scene.bodies.find((b) => b.id === "moon");
  const sunAlt = sun?.altDeg ?? 0;
  const twilight = twilightStage(sunAlt);
  const twilightLabel = TWILIGHT_NAMES[twilight] ?? twilight;

  const plate = observer.hasPlate
    ? pickPlate(sunAlt, moon?.altDeg ?? -90, moonIllum, aim.az)
    : undefined;

  const solarArc: SolarArcData = {
    samples: arcSamples,
    currentHour: i.hour + i.minute / 60,
    currentAltDeg: sunAlt,
    twilightLabel,
  };

  const aboveHorizon = scene.bodies.filter((b) => CLASSICAL.includes(b.id) && b.altDeg > 0);
  const activeBodyId = hoveredBody ?? selectedBody;
  const activeBodyScene = activeBodyId ? scene.bodies.find((b) => b.id === activeBodyId) : null;

  const stamp = observer.id === "nyc" && offsetHours === 0
    ? formatNycStamp(civil)
    : `${observer.label} · ${fmtUtStamp(instantDate)}`;

  const sunLon = chart.bodies.sun ? fmtLon(chart.bodies.sun.lon) : "";
  const satRx = chart.bodies.saturn?.retrograde ?? false;
  const sample = `import { Engine, fmtLon } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const engine = new Engine(embeddedData);

const chart = engine.chart(
  ${i.year}, ${i.month}, ${i.day}, ${i.hour}, ${i.minute}, ${i.second},
  ${observer.lat.toFixed(2)}, ${observer.lonEast.toFixed(2)},
  "placidus",
);

fmtLon(chart.bodies.sun.lon);   // "${sunLon}"
chart.bodies.saturn.retrograde; // ${satRx}`;

  const ribbonStamp = activeBodyScene
    ? `${activeBodyScene.id.replace(/_/g, " ")} · ${fmtLon(activeBodyScene.lon)} · alt ${activeBodyScene.altDeg >= 0 ? "+" : ""}${activeBodyScene.altDeg.toFixed(1)}° · az ${Math.round(activeBodyScene.azDeg)}°`
    : `sky now · ${stamp} · sun ${sunLon}`
      + (chart.bodies.moon ? ` · moon ${fmtLon(chart.bodies.moon.lon)}` : "");

  return (
    <>
      <section className="tile home-sky-tile" aria-label={`The sky over ${observer.label}`}>
        <div className="tile__h">
          <b>SKY</b>
          <span>Computed in this browser</span>
          <i><span className="led led--live" aria-hidden />{stamp}</i>
        </div>

        {/* Live observer & time switcher right on the first screen */}
        <div className="viz-toolbar row row--between row--wrap">
          <div className="preset-bar" role="group" aria-label="Observer location">
            {OBSERVERS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                aria-pressed={observer.id === o.id}
                onClick={() => setObserverId(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="preset-bar" role="group" aria-label="Time offset">
            {TIME_OFFSETS.map((o) => (
              <button
                key={o.label}
                type="button"
                className="chip"
                aria-pressed={offsetHours === o.hours}
                onClick={() => setOffsetHours(o.hours)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <HomeSkyStage
          scene={scene}
          openingAim={aim}
          plate={plate}
          solarArc={solarArc}
          t={t}
          onScrub={setT}
          size={FIGURE}
          theme={WHEEL_THEME}
        />

        {/* Real-time topocentric telemetry strip */}
        <div className="telemetry" aria-label="Live topocentric sky telemetry">
          <div className="telemetry__item">
            <span className="telemetry__label">Coords</span>
            <span className="telemetry__val">{fmtCoord(observer.lat, observer.lonEast)}</span>
          </div>
          <div className="telemetry__item">
            <span className="telemetry__label">Sun</span>
            <span className="telemetry__val">
              {`${sunAlt >= 0 ? "+" : ""}${sunAlt.toFixed(1)}° alt · ${Math.round(sun?.azDeg ?? 0)}° az`}
            </span>
          </div>
          <div className="telemetry__item">
            <span className="telemetry__label">Moon</span>
            <span className="telemetry__val">
              {`${Math.round(moonIllum * 100)}% lit · ${(moon?.altDeg ?? 0) >= 0 ? "+" : ""}${(moon?.altDeg ?? 0).toFixed(1)}°`}
            </span>
          </div>
          <div className="telemetry__item">
            <span className="telemetry__label">Above horizon</span>
            <span className="telemetry__val">
              {aboveHorizon.length > 0
                ? `${aboveHorizon.length} (${aboveHorizon.map((b) => GLYPHS[b.id] ?? b.id).join(" ")})`
                : "0 classical"}
            </span>
          </div>
          <div className="telemetry__item">
            <span className="telemetry__label">Local compute</span>
            <span className="telemetry__val">{elapsedMs.toFixed(1)} ms</span>
          </div>
        </div>
      </section>

      {variant !== "hero-only" && (
        <section className="tile s12" aria-label="Current ecliptic longitudes">
          <div className="tile__h">
            <b>NOW</b>
            <span>Current ecliptic longitudes</span>
            <i>{activeBodyScene ? "linked selection active" : "hover or click a body"}</i>
          </div>
          <SkyRibbon
            chart={chart}
            stamp={ribbonStamp}
            selectedBody={selectedBody}
            hoveredBody={hoveredBody}
            onSelectBody={setSelectedBody}
            onHoverBody={setHoveredBody}
          />
        </section>
      )}

      {variant === "full" && (
        <>
          <div className="band">
            <h2>Compute a chart</h2>
          </div>
          <section className="tile s4 half">
            <div className="tile__h">
              <b>CHART</b>
              <span>Placidus, tropical</span>
              <i>{observer.label}</i>
            </div>
            <div className="chart-fluid viz-stage viz-stage--square">
              <ChartWheel
                chart={chart}
                size={FIGURE}
                theme={WHEEL_THEME}
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={setSelectedBody}
                onHoverBody={setHoveredBody}
              />
            </div>
            <p className="note">
              {activeBodyScene
                ? `${activeBodyScene.id.replace(/_/g, " ")} at ${fmtLon(activeBodyScene.lon)} (alt ${activeBodyScene.altDeg.toFixed(1)}°, az ${Math.round(activeBodyScene.azDeg)}°). Click again to clear.`
                : `Current event chart for ${observer.label}. Click any planet to cross-highlight aspects and longitude.`}
            </p>
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
                aspects. The example below produces the {observer.label} chart shown on the left.
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
      )}
    </>
  );
}
