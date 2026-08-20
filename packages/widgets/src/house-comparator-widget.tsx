/**
 * caelus-widgets — the interactive house comparator.
 *
 * Split from the scene/figure module because this component calls
 * hooks; hosts with React Server Components import the scene module
 * server-side and this one across a client boundary.
 *
 * The console: a system picker as a mono list with the current item
 * in oxblood (the design's picker, and the accent's one meaning —
 * the reader's current selection), the cusp table against the
 * reference, and a latitude control that walks the birthplace north
 * or south until the quadrant systems fail. A system that is
 * undefined at the working latitude prints struck through, and
 * selecting it shows the engine's fallback in the table. Latitude is
 * params in, scene out through the host's `getEngine` loader — never
 * widget-side math.
 */
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { HOUSE_SYSTEMS, type Engine, type HouseSystem } from "caelus";
import { PLATE_TOKENS } from "caelus-wheel";
import {
  CuspTable, deriveComparator, HouseComparatorFigure,
  type HouseComparatorScene,
} from "./house-comparator.js";

const MONO =
  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** The latitude step; a few presses reach the polar circle. */
const NUDGE_LAT = 10;

export interface HouseComparatorProps {
  scene: HouseComparatorScene;
  size?: number;
  /** Async engine loader; enables the latitude walk. The tier loads
   *  on first use, not on render. */
  getEngine?: () => Promise<Engine>;
}

export function HouseComparator({
  scene, size, getEngine,
}: HouseComparatorProps): ReactElement {
  const [system, setSystem] = useState<HouseSystem>(
    scene.params.compare ?? scene.reference,
  );
  const [dLat, setDLat] = useState(0);
  const [live, setLive] = useState<HouseComparatorScene | null>(null);

  useEffect(() => {
    if (!getEngine || dLat === 0) {
      setLive(null);
      return;
    }
    let stale = false;
    getEngine()
      .then((eng) => {
        const p = scene.params;
        const lat = Math.max(-89.9, Math.min(89.9, p.place.latDeg + dLat));
        const s = deriveComparator(eng, {
          ...p,
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
  }, [dLat, getEngine, scene]);

  const base = live ?? scene;
  const lat = scene.params.place.latDeg + dLat;
  const failed = new Set(
    base.systems.filter((s) => s.fellBack).map((s) => s.id),
  );

  return (
    <div>
      <HouseComparatorFigure scene={base} system={system} size={size} />
      <div
        style={{
          marginTop: "8px",
          borderTop: `1px solid ${PLATE_TOKENS.rule}`,
          paddingTop: "6px",
          fontFamily: MONO,
          userSelect: "none",
        }}
      >
        {HOUSE_SYSTEMS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={system === s}
            onClick={() => setSystem(s)}
            title={failed.has(s)
              ? "undefined at this latitude; the engine falls back"
              : undefined}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginRight: "14px",
              fontFamily: MONO,
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: system === s
                ? PLATE_TOKENS.accent
                : failed.has(s)
                  ? PLATE_TOKENS.faintInk
                  : PLATE_TOKENS.mutedInk,
              textDecoration: failed.has(s) ? "line-through" : "none",
              cursor: "pointer",
            }}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      {getEngine && (
        <div
          style={{
            marginTop: "4px",
            fontFamily: MONO,
            fontSize: "11px",
            color: PLATE_TOKENS.mutedInk,
          }}
        >
          {"lat "}
          <button type="button" aria-label="walk south"
            onClick={() => setDLat((d) => d - NUDGE_LAT)}
            style={{
              background: "none", border: "none", padding: 0,
              fontFamily: MONO, fontSize: "11px",
              color: PLATE_TOKENS.mutedInk, cursor: "pointer",
            }}>
            −{NUDGE_LAT}°
          </button>
          {" / "}
          <button type="button" aria-label="walk north"
            onClick={() => setDLat((d) => d + NUDGE_LAT)}
            style={{
              background: "none", border: "none", padding: 0,
              fontFamily: MONO, fontSize: "11px",
              color: PLATE_TOKENS.mutedInk, cursor: "pointer",
            }}>
            +{NUDGE_LAT}°
          </button>
          {` · φ ${lat.toFixed(1)}°`}
        </div>
      )}
      <div style={{ marginTop: "8px" }}>
        <CuspTable scene={base} system={system} />
      </div>
    </div>
  );
}
