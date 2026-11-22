"use client";

import { GLYPHS } from "caelus-wheel";

export interface VedicData {
  bodies: Array<{ body: string; nak: { name: string; pada: number }; d9: string; d10: string }>;
  dasha: { maha: string; antar: string | null; pratyantar: string | null } | null;
}

/** Sidereal layer: nakshatra, D9/D10 signs, and the active Vimshottari dasha. */
export default function VedicTab({ vedic }: { vedic: VedicData }) {
  return (
    <div className="stack--sm">
      <p className="dim small">Sidereal · Lahiri. Nakshatra, then the navamsa (D9) and dasamsa (D10) signs:</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Vedic nakshatra and varga table">
        <table className="mono data-table">
          <thead>
            <tr>
              <th scope="col">Body</th>
              <th scope="col">Nakshatra</th>
              <th scope="col">D9</th>
              <th scope="col">D10</th>
            </tr>
          </thead>
          <tbody>
            {vedic.bodies.map(({ body, nak, d9, d10 }) => (
              <tr key={body}>
                <th scope="row" className="mute">{GLYPHS[body] ? `${GLYPHS[body]} ` : ""}{body}</th>
                <td>{nak.name} <span className="mute">p{nak.pada}</span></td>
                <td className="mute">{d9}</td>
                <td className="mute">{d10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vedic.dasha && (
        <p className="dim small">
          Vimshottari dasha today:{" "}
          <strong>{vedic.dasha.maha}</strong>
          {vedic.dasha.antar && <> &gt; {vedic.dasha.antar}</>}
          {vedic.dasha.pratyantar && <> &gt; {vedic.dasha.pratyantar}</>}
        </p>
      )}
      <p className="dim small">
        Reading the chart as a birth moment. Also: Yogini and Ashtottari dashas, the vargas, and the yogas.
      </p>
    </div>
  );
}
