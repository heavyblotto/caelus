"use client";

import type { StarParan } from "caelus";
import { GLYPHS } from "caelus-wheel";

export interface StarsData {
  conjunctions: Array<{ body: string; star: string; orb: number }>;
  parans: StarParan[];
}

/** Fixed-star longitude conjunctions and Brady parans for the chart. */
export default function StarsTab({ stars }: { stars: StarsData }) {
  return (
    <div className="stack--sm">
      <p className="dim small">Bright fixed stars (mag ≤ 2.5) within 1° of a body, by longitude:</p>
      {stars.conjunctions.length === 0 ? (
        <p className="dim small">No close conjunctions.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Fixed star conjunctions">
          <table className="mono data-table">
            <thead>
              <tr>
                <th scope="col">Body</th>
                <th scope="col">Star</th>
                <th scope="col">Orb</th>
              </tr>
            </thead>
            <tbody>
              {stars.conjunctions.map((h, i) => (
                <tr key={i}>
                  <th scope="row" className="mute">{GLYPHS[h.body] ? `${GLYPHS[h.body]} ` : ""}{h.body}</th>
                  <td>{h.star}</td>
                  <td className="mute num">{h.orb}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim small">
        Parans (Brady): a bright star and a body on the angles at once, this day and latitude (tightest, within 12 min):
      </p>
      {stars.parans.length === 0 ? (
        <p className="dim small">No parans.</p>
      ) : (
        <ul className="mono rail-list">
          {stars.parans.map((p, i) => (
            <li key={i}>
              {p.star} <span className="mute">({p.star_angle})</span> {GLYPHS[p.body] ?? p.body}{" "}
              <span className="mute">({p.body_angle}) · {Math.round(p.gap_min)}m</span>
            </li>
          ))}
        </ul>
      )}
      <p className="dim small">From the 319-star HYG catalogue in the embedded data pack.</p>
    </div>
  );
}
