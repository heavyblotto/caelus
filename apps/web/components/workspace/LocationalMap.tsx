"use client";

import { useMemo, useState } from "react";
import { astrocartography, angularity, fmtLon, type Engine } from "caelus";
import { AstroMap, type AngleKind } from "caelus-wheel";
import CityPicker, { type City } from "../CityPicker";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../lib/wheelTheme";
import { MAP_ANGLES, MAP_BODIES, type MapAngle } from "./util";

export default function LocationalMap({
  engine, natalJd, lat, lon, onRelocate,
}: {
  engine: Engine;
  natalJd: number;
  lat: number;
  lon: number;
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
    <div>
      <div className="seg" role="group" aria-label="Angle lines" style={{ marginBottom: "0.5rem" }}>
        {MAP_ANGLES.map((a) => (
          <button key={a} type="button" className="seg__btn" aria-pressed={show.includes(a)} onClick={() => toggle(a)}>
            {a.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginBottom: "0.5rem" }}>
        <span className="field__label">relocate to</span>
        <CityPicker onSelect={onCity} placeholder="city…" width="12rem" />
      </div>
      <div onClick={onClick} style={{ cursor: "crosshair" }} role="presentation">
        <AstroMap
          lines={lines}
          width={720}
          height={360}
          show={show as AngleKind[]}
          theme={WHEEL_THEME}
          colors={WHEEL_LINE_COLORS}
        />
      </div>
      <p className="dim small" style={{ margin: "0.4rem 0 0" }}>
        Click the map or pick a city to recast houses and angles at that place.
        {relocated && (
          <>
            {" "}ASC {fmtLon(relocated.asc)} · MC {fmtLon(relocated.mc)}
            {relocated.angular.length ? ` · angular ${relocated.angular.join(", ")}` : ""}.
          </>
        )}
      </p>
    </div>
  );
}
