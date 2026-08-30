"use client";

import { useEffect, useRef } from "react";
import {
  DerivationFigure,
  HOME_DERIVATION_STATIONS,
} from "caelus-widgets/derivation";
import { PlateConsole } from "caelus-widgets/console";
import type { DerivationScene } from "caelus-widgets/derivation";
import type { WheelTheme } from "caelus-wheel";
import type { SkyPlate } from "./skyPlates";

const PLAY_MS = 8000;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, a: number, b: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

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
  const stop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  const play = () => {
    stop();
    if (typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onScrub(1);
      return;
    }
    const from = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - from) / PLAY_MS);
      onScrub(x);
      raf.current = x < 1 ? requestAnimationFrame(step) : null;
    };
    onScrub(0);
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onScrub(1);
    }
    return stop;
  }, []);

  const plateOpacity = 1 - ramp(t, 0, 0.2);
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
            style={{ opacity: plateOpacity }}
          />
        )}
        <div className="home-sky__morph">
          <DerivationFigure
            scene={scene}
            t={t}
            size={size}
            openingAim={openingAim}
            theme={theme}
          />
        </div>
      </div>
      <PlateConsole
        t={t}
        stations={HOME_DERIVATION_STATIONS}
        datum={`${station.label.toLowerCase()} · t ${t.toFixed(2)}`}
        onScrub={(x) => {
          stop();
          onScrub(x);
        }}
      />
      <div className="home-sky__play">
        <button type="button" onClick={play} aria-label="play the derivation">
          ▸
        </button>
      </div>
    </div>
  );
}
