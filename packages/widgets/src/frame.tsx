/**
 * caelus-widgets — the plate frame.
 *
 * Every computed figure is a plate: numbered, captioned in apparatus
 * type, framed in a 1px mid rule on the plate ground, and stamped
 * with the engine version that computed it. A figure that cannot name
 * the engine version that drew it does not ship. The frame is the
 * resting render's chrome; hydration attaches the console beneath it
 * and never alters what is above.
 *
 * Pure render, SSR-safe: no hooks, no effects, no client-only APIs.
 */
import type { ReactElement, ReactNode } from "react";
import { PLATE_TOKENS } from "caelus-wheel";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface PlateFrameProps {
  /** Figure number within the entry ("Fig. 3"). */
  figure: number | string;
  /** Apparatus caption naming the configuration: instant, place,
   *  house system. */
  caption: string;
  /** The engine version that computed the figure, for the stamp. */
  engineVersion: string;
  /** Permalink that reproduces the figure (the serialized spec,
   *  openable in the Playground). Omitting it omits the affordance. */
  reproduceHref?: string;
  /** The figure itself (an SVG at canonical size). */
  children: ReactNode;
}

export function PlateFrame({
  figure, caption, engineVersion, reproduceHref, children,
}: PlateFrameProps): ReactElement {
  return (
    <figure
      style={{
        margin: 0,
        border: `1px solid ${PLATE_TOKENS.rule}`,
        background: PLATE_TOKENS.panel,
      }}
    >
      <div style={{ padding: "16px" }}>{children}</div>
      <figcaption
        style={{
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          padding: "8px 16px 10px",
          fontFamily: MONO,
          fontSize: "12px",
          lineHeight: 1.5,
          color: PLATE_TOKENS.mutedInk,
        }}
      >
        <span style={{ color: PLATE_TOKENS.ink }}>
          {typeof figure === "number" ? `Fig. ${figure}` : figure}
        </span>
        {" — "}
        {caption}
        <span
          style={{
            display: "block",
            marginTop: "2px",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: PLATE_TOKENS.faintInk,
          }}
        >
          {`Figures · caelus ${engineVersion}`}
          {reproduceHref && (
            <>
              {" · "}
              <a
                href={reproduceHref}
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                reproduce
              </a>
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
