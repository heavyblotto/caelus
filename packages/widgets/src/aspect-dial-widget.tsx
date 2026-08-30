/**
 * caelus-widgets — the interactive aspect dial.
 *
 * Split from the scene/figure module because this component calls
 * hooks; hosts with React Server Components import the scene module
 * server-side and this one across a client boundary.
 *
 * The console: the datum line (pair, nearest aspect, signed orb,
 * phase, and at rest the next exact hit), the orb rail — a rule with
 * an oxblood index, the design's scrubber — and the live aspectarian
 * beneath it, rows added and removed as the rail moves. Dragging the
 * second body re-reads the dial from scene data; the drag is
 * interaction state, so even the dragged figure is deterministic and
 * shareable. No engine round-trip anywhere: the aspectarian filters
 * the scene's rows and the drag readout is arithmetic on the scene's
 * positions and speeds.
 */
import type { ReactElement } from "react";
import { useState } from "react";
import { GLYPHS, PLATE_TOKENS } from "caelus-wheel";
import { PlateConsole } from "./console.js";
import {
  ASPECTARIAN_ORB, AspectDialFigure, DEFAULT_DIAL_ORB, dialDatum,
  type AspectDialScene,
} from "./aspect-dial.js";
import { ASPECT_GLYPHS, dm } from "./format.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface AspectDialProps {
  scene: AspectDialScene;
  size?: number;
}

export function AspectDial({ scene, size }: AspectDialProps): ReactElement {
  const [dragLon, setDragLon] = useState<number | null>(null);
  const [orb, setOrb] = useState(scene.params.orb ?? DEFAULT_DIAL_ORB);

  const rows = scene.aspectarian.filter((r) => Math.abs(r.orb) <= orb);
  const [od, om] = dm(orb);

  const cell = {
    padding: "1px 10px 1px 0",
    textAlign: "left" as const,
    fontWeight: "normal" as const,
  };

  return (
    <div>
      <AspectDialFigure
        scene={scene}
        dragLonB={dragLon ?? undefined}
        size={size}
        onDrag={(lon) => setDragLon(lon)}
      />
      <div
        style={{
          marginTop: "8px",
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          paddingTop: "6px",
          fontFamily: MONO,
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: "11px", color: PLATE_TOKENS.mutedInk }}>
          {dialDatum(scene, dragLon ?? undefined)}
          {dragLon !== null && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setDragLon(null)}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontFamily: MONO, fontSize: "11px",
                  color: PLATE_TOKENS.mutedInk, cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                reset
              </button>
            </>
          )}
        </div>
        <div style={{ marginTop: "4px", fontSize: "10px",
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: PLATE_TOKENS.faintInk }}>
          {`orb ≤ ${od}°${om}′ · ${rows.length} of ${scene.aspectarian.length}`}
        </div>
        <PlateConsole
          t={orb / ASPECTARIAN_ORB}
          onScrub={(t) => setOrb(
            Math.round(t * ASPECTARIAN_ORB * 2) / 2,
          )}
        />
        <table style={{ borderCollapse: "collapse", marginTop: "4px" }}>
          <tbody style={{ color: PLATE_TOKENS.mutedInk, fontSize: "11px" }}>
            {rows.map((r) => {
              const [rd, rm] = dm(r.orb);
              return (
                <tr key={`${r.a}-${r.b}`}>
                  <td style={{ ...cell, color: PLATE_TOKENS.ink }}>
                    {`${GLYPHS[r.a] ?? r.a} ${ASPECT_GLYPHS[r.aspect] ?? r.aspect} ${GLYPHS[r.b] ?? r.b}`}
                  </td>
                  <td style={cell}>
                    {`${r.orb < 0 ? "−" : "+"}${rd}°${rm}′`}
                  </td>
                  <td style={{ ...cell, color: PLATE_TOKENS.faintInk }}>
                    {r.phase === "exact" ? "x" : r.phase === "applying" ? "a" : "s"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
