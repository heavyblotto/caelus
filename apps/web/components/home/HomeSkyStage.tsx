"use client";

import { useEffect, useRef, useState } from "react";
import {
  DerivationFigure,
  HOME_DERIVATION_STATIONS,
} from "caelus-widgets/derivation";
import { PlateConsole } from "caelus-widgets/console";
import type { DerivationScene } from "caelus-widgets/derivation";
import type { WheelTheme } from "caelus-wheel";
import type { SkyPlate } from "./skyPlates";

const PLAY_MS = 11000;
const EPS = 0.001;

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

export default function HomeSkyStage({
  scene, openingAim, plate, t, onScrub, size = 560, theme, stamp,
}: {
  scene: DerivationScene;
  openingAim: { az: number; alt: number };
  plate?: SkyPlate;
  t: number;
  onScrub: (t: number) => void;
  size?: number;
  theme?: Partial<WheelTheme>;
  stamp: string;
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

  return (
    <div className="home-sky">
      <p className="eyebrow home-sky__stamp">{stamp}</p>
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
            datum={`${station.label.toLowerCase()} · t ${t.toFixed(2)}`}
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
