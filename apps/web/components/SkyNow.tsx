"use client";
import { useEffect, useState } from "react";
import { Engine, BODIES, fmtLon, type Chart } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const engine = new Engine(embeddedData);

export default function SkyNow() {
  const [chart, setChart] = useState<Chart | null>(null);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const d = new Date();
    const t0 = performance.now();
    const c = engine.chart(
      d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
      27.94, -82.46, "placidus",
    );
    setMs(performance.now() - t0);
    setChart(c);
  }, []);

  if (!chart) return <p>computing…</p>;
  return (
    <div>
      <table style={{ borderSpacing: "0.8rem 0.15rem" }}>
        <tbody>
          {BODIES.map((b) => (
            <tr key={b}>
              <td style={{ opacity: 0.6 }}>{b}</td>
              <td>{fmtLon(chart.bodies[b].lon)}{chart.bodies[b].retrograde ? " ℞" : ""}</td>
            </tr>
          ))}
          <tr><td style={{ opacity: 0.6 }}>ASC</td><td>{fmtLon(chart.angles.asc)}</td></tr>
          <tr><td style={{ opacity: 0.6 }}>MC</td><td>{fmtLon(chart.angles.mc)}</td></tr>
        </tbody>
      </table>
      <p style={{ opacity: 0.5, fontSize: "0.85em" }}>computed client-side in {ms.toFixed(1)} ms</p>
    </div>
  );
}
