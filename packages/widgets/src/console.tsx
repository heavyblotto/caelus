/**
 * caelus-widgets — the plate console.
 *
 * The seventh recurring part of the plate system: the control rail
 * beneath the frame. A 1px rule carries the scrub index in oxblood
 * (the single interaction channel), station labels sit under it in
 * mono small caps, and the datum line prints beneath. Controls read
 * as apparatus: frames and rules only, no fills behind text, no
 * rounded corners, no shadows.
 *
 * Stateless and controlled: the scrub position is the state and it
 * belongs to the widget. Rendering is SSR-safe (no hooks, no
 * effects); the pointer handlers only ever fire in a browser. Free
 * scrub while dragging, snap to the nearest station on release.
 */
import type { PointerEvent, ReactElement } from "react";
import { PLATE_TOKENS } from "caelus-wheel";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface ConsoleStation {
  id: string;
  /** Small-caps label ("SKY"). */
  label: string;
  /** Scrub position of the station in [0, 1]. */
  t: number;
}

export interface PlateConsoleProps {
  /** Current scrub position in [0, 1]. */
  t: number;
  stations?: ConsoleStation[];
  /** Mono datum line ("alt +34° 12′ · az 158° · λ 19°27′ ♊"). */
  datum?: string;
  /** Present only when hydrated; without it the rail is inert. */
  onScrub?: (t: number) => void;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function PlateConsole({
  t, stations, datum, onScrub,
}: PlateConsoleProps): ReactElement {
  const pos = clamp01(t);
  const tFrom = (e: PointerEvent<HTMLDivElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / (r.width || 1));
  };
  const snap = (x: number): number => {
    if (!stations?.length) return x;
    let best = stations[0].t;
    for (const s of stations) {
      if (Math.abs(s.t - x) < Math.abs(best - x)) best = s.t;
    }
    return best;
  };
  const rail = onScrub
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onScrub(tFrom(e));
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
          if (e.buttons & 1) onScrub(tFrom(e));
        },
        onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
          onScrub(snap(tFrom(e)));
        },
        style: { cursor: "ew-resize" as const },
      }
    : { style: {} };

  return (
    <div style={{ fontFamily: MONO, userSelect: "none" }}>
      <div
        {...rail}
        style={{
          position: "relative",
          height: "24px",
          touchAction: "none",
          ...rail.style,
        }}
      >
        {/* the rule */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "11px",
            height: "1px",
            background: PLATE_TOKENS.rule,
          }}
        />
        {/* station ticks */}
        {stations?.map((s) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.t * 100}%`,
              top: "8px",
              width: "1px",
              height: "7px",
              background: PLATE_TOKENS.mutedInk,
            }}
          />
        ))}
        {/* the index: oxblood, the one interaction accent */}
        <div
          style={{
            position: "absolute",
            left: `${pos * 100}%`,
            top: "4px",
            width: "2px",
            height: "15px",
            marginLeft: "-1px",
            background: PLATE_TOKENS.accent,
          }}
        />
      </div>
      {stations && (
        <div style={{ position: "relative", height: "16px" }}>
          {stations.map((s) => (
            <span
              key={s.id}
              {...(onScrub
                ? { onClick: () => onScrub(s.t), role: "button" as const }
                : {})}
              style={{
                position: "absolute",
                left: `${s.t * 100}%`,
                transform:
                  s.t <= 0 ? "none"
                    : s.t >= 1 ? "translateX(-100%)"
                      : "translateX(-50%)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: PLATE_TOKENS.mutedInk,
                cursor: onScrub ? "pointer" : "default",
              }}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
      {datum && (
        <div
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: PLATE_TOKENS.mutedInk,
          }}
        >
          {datum}
        </div>
      )}
    </div>
  );
}
