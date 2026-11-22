"use client";

import { useEffect, useRef, useState } from "react";
import {
  DerivationFigure,
  HOME_DERIVATION_STATIONS,
} from "caelus-widgets/derivation";
import { PlateConsole } from "caelus-widgets/console";
import type { DerivationScene } from "caelus-widgets/derivation";
import type { WheelTheme } from "caelus-wheel";
import { WORKBENCH_CONSOLE_TOKENS } from "../../lib/wheelTheme";
import type { SkyPlate } from "./skyPlates";

const PLAY_MS = 11000;
const EPS = 0.001;

const STATION_HINTS: Record<string, string> = {
  view: "Live local sky · press Play or drag to fold sky into chart wheel",
  ecliptic: "Ecliptic plane · apparent path of the Sun and zodiac longitudes",
  horizon: "Local horizon · intersection with the ecliptic marks the Ascendant",
  figures: "Constellation figures of date · precessed from J2000",
  zodiac: "Twelve 30° zodiac signs projected onto the ecliptic band",
  sky: "Topocentric dome · bodies below the horizon recede",
  sphere: "Full celestial sphere · true 3D ecliptic latitude revealed",
  wheel: "Flat natal wheel · latitude collapsed onto the ecliptic plane",
};

export interface SolarArcSample {
  /** Fractional hour offset from midnight local/UT in [0, 24]. */
  hour: number;
  /** Solar altitude in degrees. */
  altDeg: number;
}

export interface SolarArcData {
  samples: SolarArcSample[];
  currentHour: number;
  currentAltDeg: number;
  twilightLabel: string;
}

/** Previous / next named station on the home morph. */
function stepStation(t: number, dir: -1 | 1): number {
  const marks = HOME_DERIVATION_STATIONS.map((s) => s.t);
  if (dir < 0) {
    for (let i = marks.length - 1; i >= 0; i--) {
      if (marks[i] < t - EPS) return marks[i];
    }
    return 0;
  }
  for (const m of marks) {
    if (m > t + EPS) return m;
  }
  return 1;
}

/** Compact Tufte C10 sparkline showing the 24-hour solar altitude curve and twilight bands. */
function SolarAltitudeArc({ data }: { data: SolarArcData }) {
  const W = 560;
  const H = 64;
  const ml = 34;
  const mr = 10;
  const mt = 10;
  const mb = 16;
  const pw = W - ml - mr;
  const ph = H - mt - mb;

  const alts = data.samples.map((s) => s.altDeg);
  const lo = Math.min(-24, Math.floor(Math.min(...alts) / 10) * 10);
  const hi = Math.max(20, Math.ceil(Math.max(...alts) / 10) * 10);
  const span = hi - lo || 1;
  const px = (h: number) => ml + (h / 24) * pw;
  const py = (a: number) => mt + (1 - (a - lo) / span) * ph;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const path = "M" + data.samples
    .map((s) => `${r1(px(s.hour))} ${r1(py(s.altDeg))}`)
    .join(" L");
  const nowX = r1(px(data.currentHour));
  const nowY = r1(py(data.currentAltDeg));
  const y0 = r1(py(0));
  const yCiv = r1(py(-6));
  const yAst = r1(py(-18));
  const altSign = data.currentAltDeg >= 0 ? "+" : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`24-hour solar altitude curve, currently ${altSign}${data.currentAltDeg.toFixed(1)} degrees (${data.twilightLabel})`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Twilight band (-18 deg to 0 deg) */}
      <rect
        x={ml}
        y={y0}
        width={pw}
        height={Math.max(0, Math.min(mt + ph, yAst) - y0)}
        fill="var(--wheel-twilight, var(--panel2))"
        opacity={0.45}
      />
      {/* Horizon 0 deg and civil twilight -6 deg reference hairlines */}
      <line x1={ml} y1={y0} x2={ml + pw} y2={y0} stroke="var(--wheel-horizon, var(--line2))" strokeWidth={0.85} />
      {yCiv <= mt + ph && (
        <line x1={ml} y1={yCiv} x2={ml + pw} y2={yCiv} stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 3" />
      )}
      {/* Range-frame y-axis stubs */}
      <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="var(--line)" strokeWidth={0.75} />
      <g fontFamily="var(--mono, monospace)" fontSize={8.5} fill="var(--faint)" textAnchor="end" dominantBaseline="central">
        <text x={ml - 4} y={mt}>{`+${hi}°`}</text>
        <text x={ml - 4} y={y0}>0°</text>
        <text x={ml - 4} y={mt + ph}>{`${lo}°`}</text>
      </g>
      {/* 24-hour solar altitude curve */}
      <path d={path} fill="none" stroke="var(--wheel-planet-sun, var(--accent))" strokeWidth={1.5} />
      {/* Current instant vertical hairline + warm live marker */}
      <line x1={nowX} y1={mt} x2={nowX} y2={mt + ph} stroke="var(--warm)" strokeWidth={0.75} opacity={0.65} />
      <circle cx={nowX} cy={nowY} r={3.2} fill="var(--warm)" />
      {/* Direct x-axis time anchors + live readout */}
      <g fontFamily="var(--mono, monospace)" fontSize={8.5} fill="var(--faint)">
        <text x={ml} y={H - 3} textAnchor="start">00h</text>
        <text x={r1(px(6))} y={H - 3} textAnchor="middle">06h</text>
        <text x={r1(px(12))} y={H - 3} textAnchor="middle">12h</text>
        <text x={r1(px(18))} y={H - 3} textAnchor="middle">18h</text>
        <text x={ml + pw} y={H - 3} textAnchor="end">24h UT</text>
        <text
          x={nowX > W * 0.62 ? nowX - 7 : nowX + 7}
          y={nowY < mt + 14 ? nowY + 11 : nowY - 6}
          textAnchor={nowX > W * 0.62 ? "end" : "start"}
          fill="var(--text)"
          fontWeight={600}
        >
          {`Sun ${altSign}${data.currentAltDeg.toFixed(1)}° · ${data.twilightLabel}`}
        </text>
      </g>
    </svg>
  );
}

export default function HomeSkyStage({
  scene,
  openingAim,
  plate,
  solarArc,
  t,
  onScrub,
  size = 560,
  theme,
}: {
  scene: DerivationScene;
  openingAim: { az: number; alt: number };
  plate?: SkyPlate;
  solarArc?: SolarArcData;
  t: number;
  onScrub: (t: number) => void;
  size?: number;
  theme?: Partial<WheelTheme>;
}) {
  const raf = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const halt = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  const stop = () => {
    halt();
    setPlaying(false);
  };
  const play = () => {
    if (playing) return;
    halt();
    if (typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onScrub(1);
      setPlaying(false);
      return;
    }
    const fromT = t >= 1 - EPS ? 0 : t;
    const start = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, fromT + (now - start) / PLAY_MS);
      onScrub(x);
      if (x < 1) raf.current = requestAnimationFrame(step);
      else {
        raf.current = null;
        setPlaying(false);
      }
    };
    if (fromT === 0) onScrub(0);
    setPlaying(true);
    raf.current = requestAnimationFrame(step);
  };
  const skip = (dir: -1 | 1) => {
    stop();
    onScrub(stepStation(t, dir));
  };
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onScrub(1);
    }
    return halt;
  }, []);

  const station = HOME_DERIVATION_STATIONS.reduce((best, s) =>
    Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best);
  const hint = STATION_HINTS[station.id] ?? `${station.label.toLowerCase()} · t ${t.toFixed(2)}`;

  return (
    <div className="home-sky">
      <div className="home-sky__stage">
        {plate && (
          <img
            className="home-sky__plate"
            src={plate.src}
            alt=""
          />
        )}
        <div className="home-sky__morph">
          <DerivationFigure
            scene={scene}
            t={t}
            size={size}
            openingAim={openingAim}
            overlays
            theme={theme}
          />
        </div>
      </div>

      {solarArc && (
        <div className="viz-stage__readout">
          <SolarAltitudeArc data={solarArc} />
        </div>
      )}

      <div className="home-sky__controls">
        <div className="home-sky__transport" role="group" aria-label="derivation playback">
          <button
            type="button"
            className="home-sky__skip"
            onClick={() => skip(-1)}
            aria-label="previous station"
            disabled={t <= EPS}
          >
            ◂◂
          </button>
          <button
            type="button"
            onClick={play}
            aria-label="play the derivation"
            aria-pressed={playing}
          >
            ▸
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label="pause the derivation"
            disabled={!playing}
          >
            <span className="home-sky__pause" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="home-sky__skip"
            onClick={() => skip(1)}
            aria-label="next station"
            disabled={t >= 1 - EPS}
          >
            ▸▸
          </button>
        </div>
        <div className="home-sky__console">
          <PlateConsole
            t={t}
            stations={HOME_DERIVATION_STATIONS}
            snapOnRelease={false}
            tokens={WORKBENCH_CONSOLE_TOKENS}
            datum={hint}
            onScrub={(x) => {
              stop();
              onScrub(x);
            }}
          />
        </div>
      </div>
    </div>
  );
}
