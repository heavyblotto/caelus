"use client";

import { useMemo, useState } from "react";
import { astrocartography, angularity, fmtLon, type Engine } from "caelus";
import type { AngleKind } from "caelus-wheel";
import CityPicker, { type City } from "../CityPicker";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../lib/wheelTheme";
import { MAP_ANGLES, MAP_BODIES, type MapAngle } from "./util";
import { InteractiveAstroMap } from "./VizBridge";

export default function LocationalMap({
  engine,
  natalJd,
  lat,
  lon,
  place,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
  onRelocate,
}: {
  engine: Engine;
  natalJd: number;
  lat: number;
  lon: number;
  place?: string;
  selectedBody?: string | null;
  hoveredBody?: string | null;
  onSelectBody?: (body: string | null) => void;
  onHoverBody?: (body: string | null) => void;
  onRelocate: (lat: number, lon: number, place?: string) => void;
}) {
  const [show, setShow] = useState<MapAngle[]>([...MAP_ANGLES]);
  const lines = useMemo(() => {
    try { return astrocartography(engine, natalJd, [...MAP_BODIES]); }
    catch { return null; }
  }, [engine, natalJd]);

  const relocated = useMemo(() => {
    try {
      const c = engine.chartAt(natalJd, lat, lon);
      const angular = Object.entries(c.bodies)
        .filter(([, p]) => p && angularity(p.house) === "angular")
        .map(([b]) => b);
      return { asc: c.angles.asc, mc: c.angles.mc, angular };
    } catch { return null; }
  }, [engine, natalJd, lat, lon]);

  function toggle(a: MapAngle) {
    setShow((cur) => {
      const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
      return next.length ? next : cur;
    });
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const svg = e.currentTarget.querySelector("svg");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const clickLon = Math.max(-180, Math.min(180, (x / r.width) * 360 - 180));
    const clickLat = Math.max(-90, Math.min(90, 90 - (y / r.height) * 180));
    onRelocate(Math.round(clickLat * 100) / 100, Math.round(clickLon * 100) / 100);
  }

  function onCity(c: City) {
    onRelocate(c.lat, c.lon, `${c.name}, ${c.country}`);
  }

  if (!lines) return <p className="dim small">Could not draw this map.</p>;

  return (
    <div className="stack--sm">
      <div className="row row--between row--wrap">
        <div className="seg" role="group" aria-label="Angle lines">
          {MAP_ANGLES.map((a) => (
            <button key={a} type="button" className="seg__btn" aria-pressed={show.includes(a)} onClick={() => toggle(a)}>
              {a.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="field field--place">
          <span className="field__label">relocate to</span>
          <CityPicker onSelect={onCity} placeholder="search city..." />
        </div>
      </div>
      <div className="locational-map__canvas" onClick={onClick} role="presentation">
        <InteractiveAstroMap
          lines={lines}
          width={720}
          height={360}
          show={show as AngleKind[]}
          theme={WHEEL_THEME}
          colors={WHEEL_LINE_COLORS}
          observer={{ lat, lonEast: lon, label: place || undefined }}
          selectedBody={selectedBody}
          hoveredBody={hoveredBody}
          onSelectBody={onSelectBody}
          onHoverBody={onHoverBody}
        />
      </div>
      <p className="dim small">
        Click the map or pick a city to recast houses and angles at that place.
        {relocated && (
          <>
            {" "}ASC <span className="mono">{fmtLon(relocated.asc)}</span> · MC <span className="mono">{fmtLon(relocated.mc)}</span>
            {relocated.angular.length ? ` · angular ${relocated.angular.join(", ")}` : ""}.
          </>
        )}
      </p>
    </div>
  );
}
