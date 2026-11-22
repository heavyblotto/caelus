/**
 * caelus-widgets — the eclipses instrument.
 *
 * Split from eclipses.ts because this component calls hooks; a host with
 * React Server Components imports it across a client boundary.
 *
 * The layout is the Workbench instrument grammar (apps/web/DESIGN.md): a
 * title tile, then input, output, and the call side by side, then three
 * method tiles. The component emits Workbench class names and no styles of
 * its own, so the host supplies the stylesheet (apps/web/app/globals.css).
 * The path plot is inline SVG drawn from the engine's own numbers: no map
 * tiles, no images, and no requests.
 *
 * The host passes the engine. On the site that is the embedded tier, so the
 * search runs in the visitor's browser and nothing is sent to a server.
 */
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VERSION, type Engine } from "caelus";
import { eraYear } from "./sky-dating.js";
import {
  clockText, contactsText, dateText, defaultEclipseQuery, ECLIPSE_PLACES,
  ECLIPSE_SPAN, eclipseQueryOk, eclipseReturned, eclipseSource, plotPath,
  searchEclipses, seenCount, seenText, tracePath,
  type EclipseKinds, type EclipseQuery, type EclipseRow, type EclipseSearch,
} from "./eclipses.js";

const MAX_ROWS = 80;
/** The opening year when the host gives none and before the clock is read. */
const FALLBACK_YEAR = 2026;

export interface EclipsesProps {
  engine: Engine;
  /** First year of the opening span. Left out, the component opens on a
   *  fixed year and moves to the current one once it is mounted, so the
   *  markup a server renders does not depend on the day it was built. */
  year?: number;
}

function placeId(place: EclipseQuery["place"]): string {
  const hit = ECLIPSE_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.id : "custom";
}

function placeName(place: EclipseQuery["place"]): string {
  const hit = ECLIPSE_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.label : `${place.lat}, ${place.lonEast}`;
}

/** One kind of eclipse across the span: a mark per eclipse, by type. */
function MarkTrack({ rows, jd0, jd1, picked, onPick }: {
  rows: EclipseRow[]; jd0: number; jd1: number;
  picked?: number | null; onPick?: (row: EclipseRow) => void;
}): ReactElement {
  return (
    <div className="etrk">
      {rows.map((r) => {
        const cls = `emark emark--${r.type}${r.local.seen === "seen" || r.local.seen === "partly" ? " emark--seen" : ""}${picked === r.tMax ? " emark--picked" : ""}`;
        const style = { left: `${((r.tMax - jd0) / (jd1 - jd0)) * 100}%` };
        const name = `${dateText(r.tMax)}, ${r.type} ${r.kind} eclipse`;
        // a solar mark draws its path when chosen; a lunar one is only a mark
        return onPick
          ? <button key={r.tMax} type="button" className={cls} style={style} title={name} aria-label={name} onClick={() => onPick(r)} />
          : <i key={r.tMax} className={cls} style={style} title={name} />;
      })}
    </div>
  );
}

export function Eclipses({ engine, year }: EclipsesProps): ReactElement {
  const [query, setQuery] = useState<EclipseQuery>(() => defaultEclipseQuery(year ?? FALLBACK_YEAR));
  const [search, setSearch] = useState<EclipseSearch | null>(null);
  const [ran, setRan] = useState<EclipseQuery | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const ok = eclipseQueryOk(query);

  const run = useCallback(async (q: EclipseQuery) => {
    const id = ++runId.current;
    setRunning(true);
    setSearch(null);
    setRan(q);
    setSeconds(null);
    setPicked(null);
    const t0 = performance.now();
    const result = await searchEclipses(engine, q, {
      onProgress: (s) => { if (runId.current === id) setSearch(s); },
      cancelled: () => runId.current !== id,
    });
    if (runId.current !== id) return;
    setSearch(result);
    setSeconds((performance.now() - t0) / 1000);
    setRunning(false);
    // open on a path: the first total solar eclipse found, or failing that
    // the first central one
    const central = result.rows.find((r) => r.kind === "solar" && r.type === "total")
      ?? result.rows.find((r) => r.kind === "solar" && r.type !== "partial");
    setPicked(central ? central.tMax : null);
  }, [engine]);

  const stop = useCallback(() => {
    runId.current++;
    setRunning(false);
  }, []);

  // Open on a computed result: the current year and the two after it.
  useEffect(() => {
    const q = year === undefined ? defaultEclipseQuery(new Date().getUTCFullYear()) : query;
    if (year === undefined) setQuery(q);
    void run(q);
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = ran ?? query;
  const stale = ran !== null && JSON.stringify(ran) !== JSON.stringify(query);
  const rows = search?.rows ?? [];
  const solar = useMemo(() => rows.filter((r) => r.kind === "solar"), [rows]);
  const lunar = useMemo(() => rows.filter((r) => r.kind === "lunar"), [rows]);
  const jd0 = search?.jdStart ?? 0;
  const jd1 = search?.jdEnd ?? 1;
  const progress = search ? (search.jdDone - jd0) / (jd1 - jd0) : 0;
  const years = shown.endYear - shown.startYear + 1;
  const where = placeName(shown.place);

  const pickedRow = rows.find((r) => r.tMax === picked && r.kind === "solar");
  const trace = useMemo(
    () => (pickedRow && pickedRow.kind === "solar" ? tracePath(engine, pickedRow.eclipse) : null),
    [engine, pickedRow],
  );
  const plot = useMemo(() => (trace ? plotPath(trace, shown.place) : null), [trace, shown.place]);

  const ticks = useMemo(() => {
    const span = shown.endYear - shown.startYear + 1;
    const step = [1, 2, 5, 10, 20, 25].find((s) => span / s <= 8) ?? 50;
    const out: Array<{ year: number; pct: number }> = [];
    for (let y = Math.ceil(shown.startYear / step) * step; y <= shown.endYear + 1; y += step) {
      out.push({ year: y, pct: ((y - shown.startYear) / span) * 100 });
    }
    if (out.length === 0 || out[0].pct > 0.01) out.unshift({ year: shown.startYear, pct: 0 });
    return out;
  }, [shown.startYear, shown.endYear]);

  const source = useMemo(() => eclipseSource(query), [query]);
  const returned = useMemo(() => eclipseReturned(rows), [rows]);
  const copy = (): void => {
    void navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const choosePlace = (id: string): void => {
    const p = ECLIPSE_PLACES.find((x) => x.id === id);
    if (p) setQuery({ ...query, place: { lat: p.lat, lonEast: p.lonEast } });
  };

  const status = running
    ? `searching, ${Math.round(progress * 100)}%`
    : seconds !== null
      ? `${years} ${years === 1 ? "year" : "years"} in ${seconds.toFixed(1)} s, in this browser`
      : "";

  return (
    <div className="bench">
      <div className="head">
        <div>
          <span className="lab"><span className="led led--live" />Instrument I-03</span>
          <h1>Eclipses</h1>
        </div>
        <div>
          <p>
            Browse solar and lunar eclipses over a range of years and inspect
            local visibility, magnitude, and contact times for any coordinates.
            Selecting a central solar eclipse plots its path of totality or
            annularity across Earth.
          </p>
        </div>
      </div>

      <div className="app">
        <form className="tile" onSubmit={(e) => { e.preventDefault(); if (ok) void run(query); }}>
          <div className="tile__h"><b>IN</b><span>Date range and observer coordinates</span></div>
          <div className="fld fld--pair">
            <span />
            <label htmlFor="ec-from">Years</label>
            <input
              id="ec-from" type="number" inputMode="numeric" aria-label="First year"
              min={ECLIPSE_SPAN.from} max={ECLIPSE_SPAN.to} value={query.startYear}
              onChange={(e) => setQuery({ ...query, startYear: Math.trunc(Number(e.target.value)) })}
            />
            <input
              type="number" inputMode="numeric" aria-label="Last year"
              min={ECLIPSE_SPAN.from} max={ECLIPSE_SPAN.to} value={query.endYear}
              onChange={(e) => setQuery({ ...query, endYear: Math.trunc(Number(e.target.value)) })}
            />
          </div>
          <div className="fld">
            <span aria-hidden="true">◐</span>
            <label htmlFor="ec-kinds">Eclipses</label>
            <select
              id="ec-kinds" value={query.kinds}
              onChange={(e) => setQuery({ ...query, kinds: e.target.value as EclipseKinds })}
            >
              <option value="both">Solar and lunar</option>
              <option value="solar">Solar only</option>
              <option value="lunar">Lunar only</option>
            </select>
          </div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="ec-place">Place</label>
            <select id="ec-place" value={placeId(query.place)} onChange={(e) => choosePlace(e.target.value)}>
              {ECLIPSE_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {placeId(query.place) === "custom" && <option value="custom">Your own</option>}
            </select>
          </div>
          <div className="fld fld--opt fld--pair">
            <span />
            <label htmlFor="ec-lat">Lat, lon</label>
            <input
              id="ec-lat" type="number" inputMode="decimal" step="any" aria-label="Latitude, north positive"
              min={-90} max={90} value={query.place.lat}
              onChange={(e) => setQuery({ ...query, place: { ...query.place, lat: Number(e.target.value) } })}
            />
            <input
              type="number" inputMode="decimal" step="any" aria-label="Longitude, east positive"
              min={-180} max={180} value={query.place.lonEast}
              onChange={(e) => setQuery({ ...query, place: { ...query.place, lonEast: Number(e.target.value) } })}
            />
          </div>
          {running
            ? <button className="run" type="button" onClick={stop}>Stop</button>
            : <button className="run run--go" type="submit" disabled={!ok}>Find eclipses</button>}
          <p className="note">
            {ok
              ? `Span: ${eraYear(query.startYear)} to ${eraYear(query.endYear)}. `
              : `Enter a range between ${ECLIPSE_SPAN.from} and ${ECLIPSE_SPAN.to} covering at most ${ECLIPSE_SPAN.maxYears} years. `}
            Years use astronomical numbering (0 = 1 BCE). Latitude is north-positive
            and longitude is east-positive (Madrid is -3.7).
          </p>
        </form>

        <div className="col">
          <section className="tile">
            <div className="tile__h"><b>OUT</b><span>Eclipses in the span</span><i>{status}</i></div>
            <div className="meter"><i style={{ width: `${(running ? progress : 0) * 100}%` }} /></div>
            <div className="count">
              <b>{rows.length}</b>
              <span>{rows.length === 1 ? "eclipse" : "eclipses"}</span>
              <i>
                {solar.length} solar, {lunar.length} lunar, {seenCount(rows)} seen from {where}<br />
                {stale ? "inputs changed since this run" : `caelus ${VERSION}, embedded tier`}
              </i>
            </div>
            <div className="tl tl--narrow">
              {shown.kinds !== "lunar" && (
                <div className="tl__row">
                  <div className="tl__lab"><span><b>Solar</b></span><i>{solar.length}</i></div>
                  <MarkTrack rows={solar} jd0={jd0} jd1={jd1} picked={picked} onPick={(r) => setPicked(r.tMax)} />
                </div>
              )}
              {shown.kinds !== "solar" && (
                <div className="tl__row">
                  <div className="tl__lab"><span><b>Lunar</b></span><i>{lunar.length}</i></div>
                  <MarkTrack rows={lunar} jd0={jd0} jd1={jd1} />
                </div>
              )}
              <div className="tl__row">
                <div />
                <div className="tl__plot">
                  <div className="tl__axis tl__axis--years">
                    {ticks.map((t) => (
                      <span key={t.year} style={{ left: `${t.pct}%` }}>{eraYear(t.year)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="note ekey">
              <span><i className="emark emark--total" />total</span>
              <span><i className="emark emark--annular" />annular or hybrid</span>
              <span><i className="emark emark--partial" />partial</span>
              <span><i className="emark emark--penumbral" />penumbral</span>
              <span><i className="emark emark--total emark--seen" />seen from {where}</span>
            </p>
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>TBL</b><span>Eclipses and local visibility at {where}</span>
              <i>times in UT</i>
            </div>
            {rows.length === 0
              ? <p className="empty">{running || !search ? "Searching." : "No eclipse of the chosen kind falls in this span."}</p>
              : (
                <div className="scroll">
                  <table className="rd">
                    <thead>
                      <tr><th>Date</th><th>UT</th><th>Eclipse</th><th>At {where}</th></tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, MAX_ROWS).map((r) => {
                        const got = r.local.seen === "seen" || r.local.seen === "partly";
                        const times = contactsText(r);
                        return (
                          <tr key={`${r.kind}${r.tMax}`} className={picked === r.tMax && r.kind === "solar" ? "picked" : undefined}>
                            <td className="em">{dateText(r.tMax)}</td>
                            <td>{clockText(r.tMax)}</td>
                            <td>
                              {r.kind === "solar"
                                ? <button type="button" onClick={() => setPicked(r.tMax)}>{r.type} solar</button>
                                : `${r.type} lunar`}
                            </td>
                            <td className={`wrap${got ? " up" : " dn"}`}>
                              {seenText(r)}
                              {times && <small>{times}</small>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {rows.length > MAX_ROWS && (
              <p className="note">Showing the first {MAX_ROWS} of {rows.length} eclipses.</p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>PATH</b><span>Central path</span>
              <i>{pickedRow ? `${pickedRow.type} solar, ${dateText(pickedRow.tMax)}` : "choose a solar eclipse"}</i>
            </div>
            {!pickedRow && (
              <p className="empty">
                {running || !search ? "Searching." : "Choose a solar eclipse in the table or on the track to draw its path."}
              </p>
            )}
            {pickedRow && !plot && (
              <p className="empty">
                This eclipse is partial everywhere on Earth, so it has no central path.
              </p>
            )}
            {pickedRow && plot && trace && (
              <>
                <svg
                  className="pathplot" viewBox={`-34 -8 ${plot.width + 42} ${plot.height + 28}`}
                  role="img"
                  aria-label={`Central path of the ${pickedRow.type} solar eclipse of ${dateText(pickedRow.tMax)}, plotted by latitude and longitude`}
                >
                  <rect className="pp-frame" x={0} y={0} width={plot.width} height={plot.height} />
                  {plot.meridians.map((m) => (
                    <g key={`m${m.x}`}>
                      <line className="pp-grid" x1={m.x} y1={0} x2={m.x} y2={plot.height} />
                      <text className="pp-lab" x={m.x} y={plot.height + 14} textAnchor="middle">{m.label}</text>
                    </g>
                  ))}
                  {plot.parallels.map((p) => (
                    <g key={`p${p.y}`}>
                      <line className="pp-grid" x1={0} y1={p.y} x2={plot.width} y2={p.y} />
                      <text className="pp-lab" x={-5} y={p.y + 3} textAnchor="end">{p.label}</text>
                    </g>
                  ))}
                  <polygon className="pp-band" points={plot.band} />
                  <polyline className="pp-limit" points={plot.north} />
                  <polyline className="pp-limit" points={plot.south} />
                  <polyline className="pp-center" points={plot.center} />
                  <rect className="pp-max" x={plot.greatest[0] - 4} y={plot.greatest[1] - 4} width={8} height={8} />
                  {plot.place && (
                    <path
                      className="pp-place"
                      d={`M${plot.place[0] - 6} ${plot.place[1]}h12M${plot.place[0]} ${plot.place[1] - 6}v12`}
                    />
                  )}
                </svg>
                <p className="note">
                  Central path spans {clockText(trace.points[0].jd)} to{" "}
                  {clockText(trace.points[trace.points.length - 1].jd)} UT.
                  {trace.widthAtMaxKm !== null
                    ? ` At greatest eclipse (square marker), path width is ${Math.round(trace.widthAtMaxKm)} km.`
                    : " The square marks greatest eclipse."}
                  {plot.place ? ` The cross marks ${where}.` : ` ${where} lies outside this plot region.`}{" "}
                  The shaded band indicates the northern and southern limits on a
                  simple latitude/longitude grid without coastlines.
                </p>
              </>
            )}
          </section>
        </div>

        <div className="col code">
          <section className="tile">
            <div className="tile__h">
              <b>TS</b><span>TypeScript example</span>
              <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="code">{source}</pre>
          </section>
          <section className="tile">
            <div className="tile__h"><b>RET</b><span>Return value</span><i>UT Julian Days</i></div>
            <pre className="code">{returned}</pre>
          </section>
        </div>
      </div>

      <section className="tile s4 half">
        <div className="tile__h"><b>M-1</b><span>Catalog and visibility scan</span></div>
        <div className="tile__b prose">
          <p>
            The search locates every new and full Moon across the date range
            and evaluates eclipse geometry using the same solar and lunar
            ephemerides as the chart API, running in two-year increments. For
            each solar eclipse, local circumstances are calculated at the
            selected coordinates and filtered by solar altitude to verify that
            the event occurs above the horizon.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>Accuracy</span></div>
        <div className="tile__b prose">
          <p>
            Greatest eclipse times agree with Swiss Ephemeris within 9 seconds,
            matching every eclipse classification from 1990 to 2030 (92 lunar
            and 89 solar). Contact times are typically accurate within 15
            seconds (wider for grazing paths), and central shadow coordinates
            stay within 10 km.
          </p>
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Limitations</span></div>
        <div className="tile__b prose">
          <p>
            These bounds reliably determine local visibility and approximate
            totality duration, though near the edge of a central track (where a
            single kilometer can decide totality) consult dedicated Besselian
            maps. Historical eclipses centuries in the past or future also carry
            ΔT clock uncertainty, and dates prior to October 15, 1582 use the
            Julian calendar.
          </p>
        </div>
      </section>
    </div>
  );
}
