"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { azAlt, fmtLon, voidOfCourse, type BodyId, type Chart, type Engine, type Zodiac } from "caelus";
import { formatDeltaJd, isoFromJd, speedRegime, twilightRegime } from "./util";

const SPEEDS: Array<{ id: string; label: string; daysPerTick: number }> = [
  { id: "1h", label: "1h/s", daysPerTick: 1 / 24 / 4 },
  { id: "1d", label: "1d/s", daysPerTick: 1 / 4 },
  { id: "7d", label: "7d/s", daysPerTick: 7 / 4 },
  { id: "30d", label: "30d/s", daysPerTick: 30 / 4 },
];

const STEPS: Array<{ label: string; days: number; title: string }> = [
  { label: "-1mo", days: -30, title: "Step back 30 days" },
  { label: "-1d", days: -1, title: "Step back 1 day (shortcut: [)" },
  { label: "-1h", days: -1 / 24, title: "Step back 1 hour (shortcut: Shift+[)" },
  { label: "+1h", days: 1 / 24, title: "Step forward 1 hour (shortcut: Shift+])" },
  { label: "+1d", days: 1, title: "Step forward 1 day (shortcut: ])" },
  { label: "+1mo", days: 30, title: "Step forward 30 days" },
];

const SLIDER_MIN = -365;
const SLIDER_MAX = 3650;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export default function TimeScrubber({
  engine,
  natalJd,
  targetJd,
  targetIso,
  setTargetIso,
  lat,
  lon,
  zodiac,
  chart,
  selectedBody,
  onJumpNow,
}: {
  engine: Engine;
  natalJd: number;
  targetJd: number;
  targetIso: string;
  setTargetIso: (iso: string) => void;
  lat: number;
  lon: number;
  zodiac: Zodiac;
  chart: Chart | null;
  selectedBody: string | null;
  onJumpNow: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [speedId, setSpeedId] = useState("1d");
  const [reduceMotion, setReduceMotion] = useState(false);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const targetJdRef = useRef(targetJd);
  targetJdRef.current = targetJd;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setReduceMotion(e.matches);
      if (e.matches) setPlaying(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const speed = SPEEDS.find((s) => s.id === speedId) ?? SPEEDS[1];

  const stepBy = useCallback((days: number) => {
    setTargetIso(isoFromJd(targetJdRef.current + days));
  }, [setTargetIso]);

  const resetToNatal = useCallback(() => {
    setPlaying(false);
    setTargetIso(isoFromJd(natalJd));
  }, [natalJd, setTargetIso]);

  // Playback loop (250ms ticks; disabled when prefers-reduced-motion is active).
  useEffect(() => {
    if (!playing || reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setTargetIso(isoFromJd(targetJdRef.current + speed.daysPerTick));
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, reduceMotion, speed.daysPerTick, setTargetIso]);

  // Global keyboard shortcuts: [ / ] step day (Shift for hour), Space play/pause, 0 reset to natal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "[") {
        e.preventDefault();
        stepBy(e.shiftKey ? -1 / 24 : -1);
      } else if (e.key === "]") {
        e.preventDefault();
        stepBy(e.shiftKey ? 1 / 24 : 1);
      } else if (e.key === " " && !reduceMotion) {
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "0") {
        e.preventDefault();
        if (e.shiftKey) onJumpNow();
        else resetToNatal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepBy, resetToNatal, onJumpNow, reduceMotion]);

  const deltaDays = targetJd - natalJd;
  const sliderVal = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Math.round(deltaDays)));

  // Sync CSS custom properties for range slider active-track styling (modern-web-guidance slider fallback).
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.style.setProperty("--attr-min", String(SLIDER_MIN));
    el.style.setProperty("--attr-max", String(SLIDER_MAX));
    el.style.setProperty("--control-value", String(sliderVal));
  }, [sliderVal]);

  // Toolbar arrow-key navigation fallback when focusgroup is unsupported.
  const onToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const bar = toolbarRef.current;
    if (!bar) return;
    const btns = Array.from(bar.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (idx + 1) % btns.length
        : e.key === "ArrowLeft"
          ? (idx - 1 + btns.length) % btns.length
          : e.key === "Home"
            ? 0
            : btns.length - 1;
    btns[next]?.focus();
  };

  // Live telemetry at targetJd: Sun altitude + twilight regime, Moon + VOC, and focused body speed.
  const telemetry = useMemo(() => {
    try {
      const sunLon = engine.longitude("sun", targetJd, { zodiac });
      const moonLon = engine.longitude("moon", targetJd, { zodiac });
      const voc = voidOfCourse(engine, targetJd, zodiac);
      let sunAlt: number | null = null;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const sunPos = engine.position("sun", targetJd);
        const [, alt] = azAlt(engine.data, sunPos.lon, sunPos.lat, targetJd, lat, lon);
        sunAlt = alt;
      }
      const trackedId = (selectedBody && chart?.bodies[selectedBody] ? selectedBody : "moon") as BodyId;
      const pNow = engine.position(trackedId, targetJd);
      const pNext = engine.position(trackedId, targetJd + 0.25);
      let dLon = pNext.lon - pNow.lon;
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      const dailySpeed = dLon * 4;
      return {
        sunLon,
        moonLon,
        voc,
        sunAlt,
        trackedId,
        dailySpeed,
        regime: speedRegime(dailySpeed, dailySpeed < 0),
      };
    } catch {
      return null;
    }
  }, [engine, targetJd, lat, lon, zodiac, selectedBody, chart]);

  const [datePart, timePart] = (targetIso || isoFromJd(targetJd)).split("T");

  return (
    <section className="tile s12" aria-label="Time scrubber">
      <div className="tile__h">
        <b>TIME</b>
        <span>Time scrubber</span>
        <i>
          <kbd className="kbd">[</kbd> <kbd className="kbd">]</kbd> step ·{" "}
          <kbd className="kbd">Space</kbd> play · <kbd className="kbd">0</kbd> natal
        </i>
      </div>
      <div className="tile__b scrubber-bar">
        <div className="scrubber-steps">
          <div
            ref={toolbarRef}
            className="row row--wrap"
            role="toolbar"
            aria-label="Time step controls"
            onKeyDown={onToolbarKeyDown}
            {...({ focusgroup: "toolbar wrap" } as Record<string, string>)}
          >
            <div className="row" role="group" aria-label="Playback">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-pressed={playing}
                aria-disabled={reduceMotion || undefined}
                title={reduceMotion ? "Auto-play disabled by prefers-reduced-motion" : "Play or pause time sweep (Space)"}
                onClick={() => {
                  if (!reduceMotion) setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <select
                className="control control--sm"
                value={speedId}
                onChange={(e) => setSpeedId(e.target.value)}
                aria-label="Playback speed"
              >
                {SPEEDS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="row" role="group" aria-label="Step backward">
              {STEPS.slice(0, 3).map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn btn-ghost btn-sm mono"
                  title={s.title}
                  onClick={() => stepBy(s.days)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="row" role="group" aria-label="Jump">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                title="Reset scrubber to natal instant (shortcut: 0)"
                onClick={resetToNatal}
              >
                Natal
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Jump target to current UTC instant (shortcut: Shift+0)"
                onClick={() => {
                  setPlaying(false);
                  setTargetIso(new Date().toISOString().slice(0, 16));
                }}
              >
                Now
              </button>
            </div>

            <div className="row" role="group" aria-label="Step forward">
              {STEPS.slice(3).map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn btn-ghost btn-sm mono"
                  title={s.title}
                  onClick={() => stepBy(s.days)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row row--wrap">
            <input
              className="control control--sm"
              type="date"
              value={datePart ?? ""}
              onChange={(e) => {
                if (e.target.value) setTargetIso(`${e.target.value}T${timePart || "12:00"}`);
              }}
              aria-label="Target UTC date"
            />
            <input
              className="control control--sm"
              type="time"
              value={timePart ?? "12:00"}
              onChange={(e) => {
                if (e.target.value && datePart) setTargetIso(`${datePart}T${e.target.value}`);
              }}
              aria-label="Target UTC time"
            />
          </div>
        </div>

        <div className="scrubber__track">
          <input
            ref={sliderRef}
            className="control"
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            value={sliderVal}
            aria-label="Days from natal instant"
            aria-valuetext={`${targetIso.replace("T", " ")} UT (${formatDeltaJd(deltaDays)})`}
            onChange={(e) => setTargetIso(isoFromJd(natalJd + Number(e.target.value)))}
          />
        </div>

        <div className="telemetry scrubber-telemetry" aria-label="Live timing telemetry">
          <div className="telemetry__item">
            <span className="telemetry__label">Target UT</span>
            <span className="telemetry__val mono num">{targetIso.replace("T", " ")}</span>
          </div>
          <div className="telemetry__item">
            <span className="telemetry__label">Offset</span>
            <span className="telemetry__val mono num">{formatDeltaJd(deltaDays)}</span>
          </div>
          {telemetry && telemetry.sunAlt != null && (
            <div className="telemetry__item">
              <span className="telemetry__label">Sky regime</span>
              <span className="telemetry__val mono num">
                {twilightRegime(telemetry.sunAlt)} (Sun {telemetry.sunAlt >= 0 ? "+" : ""}
                {telemetry.sunAlt.toFixed(1)}°)
              </span>
            </div>
          )}
          {telemetry && (
            <div className="telemetry__item">
              <span className="telemetry__label">Moon</span>
              <span className="telemetry__val mono num">
                {fmtLon(telemetry.moonLon)} · {telemetry.voc.isVoid ? "VOC" : telemetry.voc.sign}
              </span>
            </div>
          )}
          {telemetry && (
            <div className="telemetry__item">
              <span className="telemetry__label">{telemetry.trackedId} speed</span>
              <span className="telemetry__val mono num">
                {telemetry.dailySpeed >= 0 ? "+" : ""}
                {telemetry.dailySpeed.toFixed(2)}°/d · {telemetry.regime}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
