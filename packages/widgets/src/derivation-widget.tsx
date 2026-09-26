/**
 * caelus-widgets — the interactive derivation widget.
 *
 * Split from the scene/figure module because this component calls
 * hooks: a host with React Server Components imports the scene module
 * server-side (the plate) and this module only across a client
 * boundary. The server render at `initialT` is the plate; hydration
 * attaches the console and changes nothing above it.
 *
 * The console interactions, per the plan:
 * - Follow one body: tap a body; it holds its highlight through the
 *   morph, its projection tick stays drawn, and its datum line runs
 *   in the console. Tap again to release.
 * - The clock: a time nudge at every station (±4 minutes, the
 *   Ascendant's degree). A nudge is a params change recomputed
 *   through the engine — never a clock read — so determinism holds.
 * - The latitude drag: at SPHERE the birthplace can be pulled north
 *   or south; past the arctic circle the ecliptic–horizon
 *   intersection degenerates. Same mechanism: params in, scene out.
 * - Free orbit: drag the figure to orbit within constraints; release
 *   returns to the scrub-defined camera. The scrub owns the
 *   canonical view.
 * - Autoplay: a single mono ▸ runs the forward journey. The widget
 *   itself only plays when asked — the first-encounter autoplay and
 *   its `prefers-reduced-motion` gate belong to the host.
 * - Station captions: optional per instance (`params.captions`).
 *
 * The clock and latitude controls need an engine; they render only
 * when the host passes `getEngine`, and the data tier loads on first
 * use, not on render.
 */
import type { PointerEvent, ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { Engine } from "caelus";
import { PLATE_TOKENS, type WheelTheme } from "caelus-wheel";
import { PlateConsole } from "./console.js";
import {
  DERIVATION_STATIONS, DerivationFigure, deriveScene, derivationDatum,
  shiftInstant, STATION_CAPTIONS, type DerivationScene,
} from "./derivation.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** One autoplay journey, ms. */
const PLAY_MS = 8000;
/** Orbit constraints, degrees. */
const ORBIT_AZ = 45;
const ORBIT_ALT = 30;
/** Orbit drag scale, degrees per pixel. */
const ORBIT_SCALE = 0.3;
/** The clock nudge: four minutes, one Ascendant degree. */
const NUDGE_MIN = 4;
/** The latitude step of the SPHERE-station drag control. */
const NUDGE_LAT = 5;

export interface ChartDerivationProps {
  scene: DerivationScene;
  size?: number;
  /** Resting scrub position; the plate renders here. Defaults to the
   *  scene's params, then to 1 (the finished wheel). */
  initialT?: number;
  /** Async engine loader. Enables the clock and latitude controls;
   *  the tier loads on first use. */
  getEngine?: () => Promise<Engine>;
  /** Run the forward journey once on mount. The host decides this
   *  (first encounter per session, gated by prefers-reduced-motion);
   *  the widget just obeys. */
  autoplay?: boolean;
  /** Wheel theme at t = 1; defaults to the plate theme. */
  theme?: Partial<WheelTheme>;
}

const mono = (extra: object = {}) => ({
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: MONO,
  fontSize: "11px",
  color: PLATE_TOKENS.mutedInk,
  cursor: "pointer",
  ...extra,
});

export function ChartDerivation({
  scene, size, initialT, getEngine, autoplay, theme,
}: ChartDerivationProps): ReactElement {
  const [t, setT] = useState(initialT ?? scene.params.t ?? 1);
  const [follow, setFollow] = useState(scene.params.follow);
  const [orbit, setOrbit] = useState<{ az: number; alt: number } | null>(null);
  const [nudge, setNudge] = useState({ min: 0, lat: 0 });
  const [live, setLive] = useState<DerivationScene | null>(null);

  // ---- autoplay: one rAF journey; any scrub interrupts it ----------
  const raf = useRef<number | null>(null);
  const stop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  const play = () => {
    stop();
    const from = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - from) / PLAY_MS);
      setT(x);
      raf.current = x < 1 ? requestAnimationFrame(step) : null;
    };
    setT(0);
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (autoplay) play();
    // mount-only by design: autoplay is a first-encounter behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- clock + latitude: params in, scene out ----------------------
  useEffect(() => {
    if (!getEngine || (nudge.min === 0 && nudge.lat === 0)) {
      setLive(null);
      return;
    }
    let stale = false;
    getEngine()
      .then((eng) => {
        const p = scene.params;
        const lat = Math.max(-89.9, Math.min(89.9, p.place.latDeg + nudge.lat));
        const s = deriveScene(eng, {
          ...p,
          instant: shiftInstant(p.instant, nudge.min),
          place: { ...p.place, latDeg: lat },
        });
        if (!stale) setLive(s);
      })
      .catch(() => {
        if (!stale) setLive(null);
      });
    return () => {
      stale = true;
    };
  }, [nudge, getEngine, scene]);

  // ---- free orbit: drag the figure; release returns ----------------
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const swallowPick = useRef(false);
  const orbitHandlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (t >= 1) return; // the finished wheel is the page, not a camera
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || !(e.buttons & 1)) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      d.moved = true;
      setOrbit({
        az: Math.max(-ORBIT_AZ, Math.min(ORBIT_AZ, -dx * ORBIT_SCALE)),
        alt: Math.max(-ORBIT_ALT, Math.min(ORBIT_ALT, dy * ORBIT_SCALE)),
      });
    },
    onPointerUp: () => {
      if (drag.current?.moved) swallowPick.current = true;
      drag.current = null;
      setOrbit(null);
    },
    onPointerLeave: () => {
      drag.current = null;
      setOrbit(null);
    },
  };
  const pick = (id: string) => {
    if (swallowPick.current) {
      swallowPick.current = false;
      return;
    }
    setFollow((f) => (f === id ? undefined : id));
  };

  // ---- console -------------------------------------------------------
  const base = live ?? scene;
  const station = DERIVATION_STATIONS.reduce((best, s) =>
    Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best);
  const followed = follow
    ? base.bodies.find((b) => b.id === follow)
    : undefined;
  let datum = followed
    ? `${followed.id} · ${derivationDatum(followed)}`
    : `${station.label.toLowerCase()} · t ${t.toFixed(2)}`;
  if (nudge.min !== 0) {
    datum += ` · Δt ${nudge.min > 0 ? "+" : "−"}${Math.abs(nudge.min)}m`;
  }
  if (nudge.lat !== 0) {
    datum += ` · φ ${(scene.params.place.latDeg + nudge.lat).toFixed(1)}°`;
  }

  return (
    <div>
      <div {...orbitHandlers} style={{ touchAction: "none" }}>
        <DerivationFigure scene={base} t={t} size={size}
          follow={follow} orbit={orbit ?? undefined} onPick={pick} theme={theme} />
      </div>
      <PlateConsole
        t={t}
        stations={DERIVATION_STATIONS}
        datum={datum}
        onScrub={(x) => {
          stop();
          setT(x);
        }}
      />
      <div
        style={{
          marginTop: "4px",
          fontFamily: MONO,
          fontSize: "11px",
          color: PLATE_TOKENS.mutedInk,
          display: "flex",
          gap: "14px",
          alignItems: "baseline",
        }}
      >
        <button type="button" onClick={play} aria-label="play the derivation"
          style={mono()}>
          ▸
        </button>
        {getEngine && (
          <span>
            {"clock "}
            <button type="button" style={mono()} aria-label="four minutes back"
              onClick={() => setNudge((n) => ({ ...n, min: n.min - NUDGE_MIN }))}>
              −{NUDGE_MIN}m
            </button>
            {" / "}
            <button type="button" style={mono()} aria-label="four minutes on"
              onClick={() => setNudge((n) => ({ ...n, min: n.min + NUDGE_MIN }))}>
              +{NUDGE_MIN}m
            </button>
          </span>
        )}
        {getEngine && station.id === "sphere" && (
          <span>
            {"lat "}
            <button type="button" style={mono()} aria-label="pull south"
              onClick={() => setNudge((n) => ({ ...n, lat: n.lat - NUDGE_LAT }))}>
              −{NUDGE_LAT}°
            </button>
            {" / "}
            <button type="button" style={mono()} aria-label="pull north"
              onClick={() => setNudge((n) => ({ ...n, lat: n.lat + NUDGE_LAT }))}>
              +{NUDGE_LAT}°
            </button>
          </span>
        )}
      </div>
      {scene.params.captions && (
        <div
          style={{
            marginTop: "6px",
            fontFamily: MONO,
            fontSize: "11px",
            lineHeight: 1.5,
            color: PLATE_TOKENS.mutedInk,
          }}
        >
          {STATION_CAPTIONS[station.id]}
        </div>
      )}
    </div>
  );
}
