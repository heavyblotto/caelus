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
 * scrub while dragging; by default release snaps to the nearest
 * station. `snapOnRelease={false}` leaves the index where it dropped.
 * Pointer-down cancels the browser's selection gesture and listens on
 * `document`, so a path that leaves the 1px rule keeps scrubbing.
 * More than six stations stack on two rows so labels do not collide.
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
  /** Snap to the nearest station on pointer-up. Default true. Station
   *  labels still jump when clicked. */
  snapOnRelease?: boolean;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function PlateConsole({
  t, stations, datum, onScrub, snapOnRelease = true,
}: PlateConsoleProps): ReactElement {
  const pos = clamp01(t);
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
          // Cancel the browser's selection gesture. Capture alone is not
          // enough: a path that leaves the 1px rule otherwise starts
          // selecting figure labels and the datum line.
          e.preventDefault();
          const el = e.currentTarget;
          const id = e.pointerId;
          try { el.setPointerCapture(id); } catch { /* capture is best-effort */ }
          const read = (ev: { clientX: number }): number => {
            const r = el.getBoundingClientRect();
            return clamp01((ev.clientX - r.left) / (r.width || 1));
          };
          onScrub(read(e));
          const blockSel = (ev: Event) => ev.preventDefault();
          const onMove = (ev: globalThis.PointerEvent) => {
            if (ev.pointerId !== id) return;
            ev.preventDefault();
            onScrub(read(ev));
          };
          const onUp = (ev: globalThis.PointerEvent) => {
            if (ev.pointerId !== id) return;
            document.removeEventListener("selectstart", blockSel);
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
            try {
              if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
            } catch { /* already released */ }
            const x = read(ev);
            onScrub(snapOnRelease ? snap(x) : x);
          };
          document.addEventListener("selectstart", blockSel);
          document.addEventListener("pointermove", onMove, { passive: false });
          document.addEventListener("pointerup", onUp);
          document.addEventListener("pointercancel", onUp);
        },
        style: { cursor: "ew-resize" as const },
      }
    : { style: {} };
  const twoRow = (stations?.length ?? 0) > 6;

  return (
    <div style={{
      fontFamily: MONO,
      userSelect: "none",
      WebkitUserSelect: "none",
    }}>
      <div
        {...rail}
        style={{
          position: "relative",
          height: "44px",
          touchAction: "none",
          ...rail.style,
        }}
        {...(onScrub
          ? {
              role: "slider" as const,
              "aria-valuemin": 0,
              "aria-valuemax": 1,
              "aria-valuenow": Number(pos.toFixed(2)),
              "aria-label": "derivation",
            }
          : {})}
      >
        {/* the rule */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "21px",
            height: "1px",
            background: PLATE_TOKENS.rule,
            pointerEvents: "none",
          }}
        />
        {/* station ticks */}
        {stations?.map((s) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.t * 100}%`,
              top: "18px",
              width: "1px",
              height: "7px",
              background: PLATE_TOKENS.mutedInk,
              pointerEvents: "none",
            }}
          />
        ))}
        {/* the index: oxblood, the one interaction accent */}
        <div
          style={{
            position: "absolute",
            left: `${pos * 100}%`,
            top: "14px",
            width: "2px",
            height: "15px",
            marginLeft: "-1px",
            background: PLATE_TOKENS.accent,
            pointerEvents: "none",
          }}
        />
      </div>
      {stations && (
        <div style={{ position: "relative", height: twoRow ? "32px" : "16px" }}>
          {stations.map((s, i) => (
            <span
              key={s.id}
              {...(onScrub
                ? {
                    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onScrub(s.t);
                    },
                    role: "button" as const,
                  }
                : {})}
              style={{
                position: "absolute",
                left: `${s.t * 100}%`,
                top: twoRow && i % 2 === 1 ? "16px" : "0",
                transform:
                  s.t <= 0 ? "none"
                    : s.t >= 1 ? "translateX(-100%)"
                      : "translateX(-50%)",
                fontSize: "10px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: PLATE_TOKENS.mutedInk,
                cursor: onScrub ? "pointer" : "default",
                userSelect: "none",
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
