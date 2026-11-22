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
 * More than six stations stack on two rows. Within a row a label sits
 * under its tick, and where the rail is too narrow for that it is pushed
 * right until it clears the label before it, so labels do not collide at
 * any width. The push is plain CSS (`max()`), so it needs no measuring and
 * the render stays the same on the server and in the browser.
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

export interface ConsoleTokens {
  rule?: string;
  mutedInk?: string;
  ink?: string;
  accent?: string;
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
  /** Optional colour token overrides (defaults to PLATE_TOKENS for cream paper). */
  tokens?: ConsoleTokens;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

// A station label is 10px mono with 0.06em tracking: about 6.8px a character
// in the faces the stack can resolve to. GAP is the least space between two
// labels on one row.
const LABEL_CH = 6.8;
const LABEL_GAP = 8;

/**
 * The CSS `left` of each station label. A label wants to be centred under
 * its tick. Its left edge is the larger of that position and the right edge
 * of the label before it on the same row, plus a gap. Since that edge is
 * itself such a maximum, the value is one `max()` over a term per earlier
 * label on the row. A station at the end of the rail is anchored to the
 * right edge and takes no part in the chain.
 */
export function labelLefts(stations: ConsoleStation[], rowOf: (i: number) => number): string[] {
  const rows = new Map<number, Array<{ pct: number; px: number }>>();
  return stations.map((s, i) => {
    if (s.t >= 1) return "100%";
    const w = s.label.length * LABEL_CH;
    const natural = s.t <= 0 ? { pct: 0, px: 0 } : { pct: s.t * 100, px: -w / 2 };
    const terms = [natural, ...(rows.get(rowOf(i)) ?? [])];
    rows.set(rowOf(i), terms.map((t) => ({ pct: t.pct, px: t.px + w + LABEL_GAP })));
    const css = terms.map((t) => `calc(${Number(t.pct.toFixed(3))}% + ${Number(t.px.toFixed(1))}px)`);
    return css.length === 1 ? css[0] : `max(${css.join(", ")})`;
  });
}

export function PlateConsole({
  t, stations, datum, onScrub, snapOnRelease = true, tokens,
}: PlateConsoleProps): ReactElement {
  const tok = {
    rule: tokens?.rule ?? PLATE_TOKENS.rule,
    mutedInk: tokens?.mutedInk ?? PLATE_TOKENS.mutedInk,
    ink: tokens?.ink ?? PLATE_TOKENS.ink,
    accent: tokens?.accent ?? PLATE_TOKENS.accent,
  };
  const pos = clamp01(t);
  const nearestIdx = stations?.length
    ? stations.reduce((best, s, idx) =>
        Math.abs(s.t - pos) < Math.abs(stations[best].t - pos) ? idx : best, 0)
    : -1;
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
        tabIndex: 0,
        onKeyDown: (e: { key: string; preventDefault: () => void }) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onScrub(clamp01(pos - 0.05));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            onScrub(clamp01(pos + 0.05));
          } else if (e.key === "Home") {
            e.preventDefault();
            onScrub(0);
          } else if (e.key === "End") {
            e.preventDefault();
            onScrub(1);
          }
        },
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
  const rowOf = (i: number): number => (twoRow && i % 2 === 1 ? 1 : 0);
  const lefts = stations ? labelLefts(stations, rowOf) : [];

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
            background: tok.rule,
            pointerEvents: "none",
          }}
        />
        {/* station ticks */}
        {stations?.map((s, idx) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.t * 100}%`,
              top: "18px",
              width: "1px",
              height: "7px",
              background: idx === nearestIdx ? tok.ink : tok.mutedInk,
              pointerEvents: "none",
            }}
          />
        ))}
        {/* the index: single interaction accent */}
        <div
          style={{
            position: "absolute",
            left: `${pos * 100}%`,
            top: "14px",
            width: "2px",
            height: "15px",
            marginLeft: "-1px",
            background: tok.accent,
            pointerEvents: "none",
          }}
        />
      </div>
      {stations && (
        <div style={{ position: "relative", height: twoRow ? "32px" : "16px" }}>
          {stations.map((s, i) => {
            const active = i === nearestIdx;
            return (
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
                  left: lefts[i],
                  top: rowOf(i) === 1 ? "16px" : "0",
                  transform: s.t >= 1 ? "translateX(-100%)" : "none",
                  fontSize: "10px",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color: active ? tok.ink : tok.mutedInk,
                  cursor: onScrub ? "pointer" : "default",
                  userSelect: "none",
                }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      )}
      {datum && (
        <div
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: tok.mutedInk,
          }}
        >
          {datum}
        </div>
      )}
    </div>
  );
}
