"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Engine, fmtLon, BODIES, compositeLongitudes,
  type BodyId, type Chart,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT } from "caelus-birth";
import { GLYPHS } from "caelus-wheel";
import CityPicker, { type City } from "./CityPicker";
import BiWheel, { type SynContact } from "./BiWheel";
import { ASPECT_GLYPH, aspectColor, crossAspect, ASPECTABLE_ORDER as GRID } from "../lib/chart-display";

const ReadingTab = dynamic(() => import("./ReadingTab"), {
  ssr: false,
  loading: () => <p className="dim small">Reading the charts...</p>,
});

const engine = new Engine(embeddedData);

// Both births live in the URL fragment (#s2=), never sent to a server.
function b64urlEncode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(raw: string): unknown {
  const bytes = Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

type Person = { iso: string; lat: string; lon: string; place: string; name: string };
const DEFAULTS: [Person, Person] = [
  { iso: "1990-06-10T14:30", lat: "27.95", lon: "-82.46", place: "Tampa, US", name: "A" },
  { iso: "1988-03-21T06:00", lat: "40.71", lon: "-74.01", place: "New York, US", name: "B" },
];

function personChart(p: Person): { chart: Chart; jd: number; zone: string } | null {
  const d = new Date(p.iso + ":00Z");
  const la = Number(p.lat);
  const lo = Number(p.lon);
  if (!Number.isFinite(la) || la < -90 || la > 90) return null;
  if (!Number.isFinite(lo) || lo < -180 || lo > 180) return null;
  if (Number.isNaN(d.getTime())) return null;
  try {
    const t = toUT({
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours(), minute: d.getUTCMinutes(), lat: la, lon: lo,
    });
    const chart = engine.chart(t.utc.year, t.utc.month, t.utc.day, t.utc.hour, t.utc.minute, 0, la, lo, "placidus");
    return { chart, jd: t.jdUt, zone: t.zone };
  } catch {
    return null;
  }
}

function PersonInputs({ p, legend, onChange }: { p: Person; legend: string; onChange: (p: Person) => void }) {
  const [datePart, timePart] = (p.iso || "1990-06-10T12:00").split("T");
  return (
    <div className="controls">
      <div className="field field--compact">
        <span className="field__label">{legend} · name</span>
        <input
          className="control"
          value={p.name}
          onChange={(e) => onChange({ ...p, name: e.target.value })}
          aria-label={`${legend} name`}
        />
      </div>
      <div className="field field--place">
        <span className="field__label">birthplace</span>
        <CityPicker
          placeholder={p.place || "search city..."}
          onSelect={(c: City) => onChange({ ...p, lat: String(c.lat), lon: String(c.lon), place: `${c.name}, ${c.country}` })}
        />
      </div>
      <div className="field field--date">
        <span className="field__label">local date</span>
        <input
          className="control"
          type="date"
          value={datePart ?? ""}
          onChange={(e) => {
            if (e.target.value) onChange({ ...p, iso: `${e.target.value}T${timePart || "12:00"}` });
          }}
          aria-label={`${legend} local birth date`}
        />
      </div>
      <div className="field field--time">
        <span className="field__label">local time</span>
        <input
          className="control"
          type="time"
          value={timePart ?? "12:00"}
          onChange={(e) => {
            if (e.target.value && datePart) onChange({ ...p, iso: `${datePart}T${e.target.value}` });
          }}
          aria-label={`${legend} local birth time`}
        />
      </div>
    </div>
  );
}

export default function SynastryPanel() {
  const [people, setPeople] = useState<[Person, Person]>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("s2");
      if (!raw) return;
      const d = b64urlDecode(raw) as { a?: Person; b?: Person };
      if (d?.a && d?.b) setPeople([{ ...DEFAULTS[0], ...d.a }, { ...DEFAULTS[1], ...d.b }]);
    } catch {
      /* ignore a malformed link */
    }
  }, []);

  function share() {
    const url = `${window.location.origin}${window.location.pathname}#s2=${b64urlEncode({ v: 1, a: people[0], b: people[1] })}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard blocked: the address bar still holds it */ });
  }

  const a = useMemo(() => personChart(people[0]), [people]);
  const b = useMemo(() => personChart(people[1]), [people]);
  const composite = useMemo(
    () => (a && b ? compositeLongitudes(engine, a.jd, b.jd, [...BODIES] as BodyId[]) : null),
    [a, b],
  );

  const readingInputs = useMemo(() => {
    if (!a) return null;
    try {
      return {
        stars: engine.starConjunctions(a.chart, { orb: 1 }),
        lots: engine.lots(a.chart),
      };
    } catch {
      return { stars: [], lots: [] };
    }
  }, [a]);

  const set = (i: 0 | 1) => (next: Person) =>
    setPeople((prev) => (i === 0 ? [next, prev[1]] : [prev[0], next]));

  const aPlanets = a ? GRID.filter((g) => a.chart.bodies[g]) : [];
  const bPlanets = b ? GRID.filter((g) => b.chart.bodies[g]) : [];
  const contacts: SynContact[] = [];
  if (a && b) {
    for (const ap of aPlanets) {
      for (const bp of bPlanets) {
        const asp = crossAspect(a.chart.bodies[ap]!.lon, b.chart.bodies[bp]!.lon);
        if (asp) contacts.push({ aBody: ap, bBody: bp, aspect: asp.aspect, orb: asp.orb });
      }
    }
  }

  return (
    <div className="bench">
      <section className="tile s12" aria-label="Synastry birth inputs">
        <div className="tile__h">
          <b>PAIR</b>
          <span>Two births</span>
          <div className="tile__actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={share}>
              {copied ? "Link copied" : "Copy share link"}
            </button>
          </div>
        </div>
        <div className="tile__b stack">
          <PersonInputs p={people[0]} legend="Person A" onChange={set(0)} />
          <PersonInputs p={people[1]} legend="Person B" onChange={set(1)} />
          {(!a || !b) ? (
            <p className="dim small">Enter two valid births to compare.</p>
          ) : (
            <p className="dim small">
              {people[0].name || "A"} ({a.zone}) and {people[1].name || "B"} ({b.zone}), computed client-side.
            </p>
          )}
        </div>
      </section>

      {a && b && (
        <>
          <section className="tile s6" aria-label="Synastry bi-wheel">
            <div className="tile__h">
              <b>FIG</b>
              <span>Bi-wheel</span>
              <i>{contacts.length} contacts</i>
            </div>
            <div className="tile__b stack--sm">
              <figure className="chart-fluid">
                <BiWheel
                  inner={a.chart}
                  outer={b.chart}
                  contacts={contacts}
                  size={420}
                  innerLabel={people[0].name || "A"}
                  outerLabel={people[1].name || "B"}
                />
                <figcaption className="dim small">
                  {people[0].name || "A"} inner · {people[1].name || "B"} outer · inter-chart aspect web
                </figcaption>
              </figure>
            </div>
          </section>

          <section className="tile s6" aria-label="Synastry grid and composite">
            <div className="tile__h">
              <b>GRID</b>
              <span>Inter-chart aspects &amp; composite</span>
            </div>
            <div className="tile__b stack">
              <div className="stack--sm">
                <p className="dim small">
                  Rows are {people[0].name || "A"}&rsquo;s planets; columns are {people[1].name || "B"}&rsquo;s.
                </p>
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Synastry cross-aspect grid">
                  <table className="mono data-table synastry-grid">
                    <thead>
                      <tr>
                        <th scope="col" aria-label="Body" />
                        {bPlanets.map((bp) => (
                          <th key={bp} scope="col" className="mute">
                            {GLYPHS[bp] ?? bp.slice(0, 2)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aPlanets.map((ap) => (
                        <tr key={ap}>
                          <th scope="row" className="mute">
                            {GLYPHS[ap] ?? ap.slice(0, 2)}
                          </th>
                          {bPlanets.map((bp) => {
                            const asp = crossAspect(a.chart.bodies[ap]!.lon, b.chart.bodies[bp]!.lon);
                            return (
                              <td
                                key={bp}
                                title={asp ? `${ap} ${asp.aspect} ${bp} · orb ${asp.orb}°` : `${ap} / ${bp}`}
                                data-aspect={asp?.aspect}
                                style={asp ? { color: aspectColor(asp.aspect) } : undefined}
                              >
                                {asp ? ASPECT_GLYPH[asp.aspect] ?? "" : ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {composite && (
                <div className="stack--sm">
                  <h3>Composite midpoints</h3>
                  <div className="table-scroll" tabIndex={0} role="region" aria-label="Composite midpoint longitudes">
                    <table className="mono data-table">
                      <thead>
                        <tr><th scope="col">Body</th><th scope="col">Midpoint</th></tr>
                      </thead>
                      <tbody>
                        {GRID.filter((g) => composite[g] !== undefined).map((g) => (
                          <tr key={g}>
                            <th scope="row" className="mute">{GLYPHS[g] ? `${GLYPHS[g]} ` : ""}{g}</th>
                            <td className="num">{fmtLon(composite[g])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          {readingInputs && (
            <section className="tile s12" aria-label="Synastry reading">
              <div className="tile__h">
                <b>READ</b>
                <span>Cited relationship reading</span>
                <i>{people[0].name || "A"} + {people[1].name || "B"}</i>
              </div>
              <div className="tile__b">
                <ReadingTab
                  chart={a.chart}
                  engine={engine}
                  lat={Number(people[0].lat)}
                  lonEast={Number(people[0].lon)}
                  zodiac="tropical"
                  stars={readingInputs.stars}
                  lots={readingInputs.lots}
                  partner={{ chart: b.chart, label: people[0].name || "A" }}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
