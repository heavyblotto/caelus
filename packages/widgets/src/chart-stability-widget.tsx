/**
 * caelus-widgets — the uncertain-time instrument.
 *
 * Split from chart-stability.ts because this component calls hooks; a host
 * with React Server Components imports it across a client boundary.
 *
 * The layout is the Workbench instrument grammar (apps/web/DESIGN.md): a
 * title tile, then input, output, and the call side by side, then three
 * method tiles. The component emits Workbench class names and no styles of
 * its own, so the host supplies the stylesheet (apps/web/app/globals.css).
 *
 * The host passes the engine. On the site that is the embedded tier, so the
 * scan runs in the visitor's browser and nothing is sent to a server.
 */
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HOUSE_SYSTEMS, STABILITY_KINDS, VERSION,
  type Engine, type HouseSystem, type StabilityFact, type Zodiac,
} from "caelus";
import { ChartWheel, type WheelTheme } from "caelus-wheel";
import {
  changesOf, factLabel, halfWidthOf, kindLabel, queryOk, returnedSource,
  scanStability, STABILITY_DEFAULT, STABILITY_PLACES, STABILITY_WINDOWS,
  stabilitySource, statedText, subjectLabel, timeText, trackLabel, valueLabel,
  windowWheel,
  type StabilityQuery, type StabilityScan, type StabilityWindowId, type WindowWheel,
} from "./chart-stability.js";

const ZODIACS: Array<{ id: Zodiac; label: string }> = [
  { id: "tropical", label: "Tropical" },
  { id: "sidereal:fagan_bradley", label: "Sidereal, Fagan-Bradley" },
  { id: "sidereal:lahiri", label: "Sidereal, Lahiri" },
];
const MAX_TRACKS = 30;
const MAX_ROWS = 60;

export interface ChartStabilityProps {
  engine: Engine;
  /** The form's opening state, run on mount. Defaults to the Tampa birth
   *  from the guide, with the time good to an hour either way. */
  initial?: StabilityQuery;
  /** Colors for the wheel tile. The host passes its own so the wheel
   *  follows the page; left out, the wheel draws in its default dark inks. */
  wheelTheme?: Partial<WheelTheme>;
}

/** A list as prose: `the Moon`, `the Moon and Mercury`, `a, b, and c`. */
function listed(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** One sentence on what changes sign across the window. */
function crossingText(w: WindowWheel): string {
  const bodies = w.bodiesCrossing.map((b) => (b === "sun" || b === "moon" ? `the ${subjectLabel(b)}` : subjectLabel(b)));
  const head = bodies.length === 0
    ? "No body changes sign across this window"
    : `${listed(bodies).replace(/^t/, "T")} ${bodies.length === 1 ? "changes" : "change"} sign across this window`;
  if (!w.placed) return `${head}.`;
  const angles = w.anglesCrossing.map((a) => (a === "asc" ? "the Ascendant" : "the Midheaven"));
  if (angles.length === 0) return `${head}, and neither angle does.`;
  if (bodies.length === 0) return `${head}, and ${listed(angles)} ${angles.length === 1 ? "does" : "do"}.`;
  return `${head}, and so ${angles.length === 1 ? "does" : "do"} ${listed(angles)}.`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const houseLabel = (h: HouseSystem): string =>
  h.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** The preset a place matches, or `custom`. */
function placeId(place: StabilityQuery["place"]): string {
  if (!place) return "none";
  const hit = STABILITY_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.id : "custom";
}

/** One fact across the window: a run per value, labelled where it fits, with
 *  the stated instant marked at the middle. */
function FactTrack({ fact, from, to }: { fact: StabilityFact; from: number; to: number }): ReactElement {
  const width = to - from;
  return (
    <div className="strk">
      {fact.segments.map((s, i) => {
        const left = ((s.from - from) / width) * 100;
        const w = ((s.to - s.from) / width) * 100;
        const text = valueLabel(fact.kind, s.value);
        return (
          <span
            key={i}
            className={`strk__seg${s.value === fact.value ? " strk__seg--stated" : ""}`}
            style={{ left: `${left}%`, width: `${w}%` }}
            title={`${text}, ${timeText(s.from)} to ${timeText(s.to)} UT`}
          >
            {trackLabel(fact.kind, s.value)}
          </span>
        );
      })}
      <i className="strk__now" aria-hidden="true" />
    </div>
  );
}

export function ChartStability({ engine, initial = STABILITY_DEFAULT, wheelTheme }: ChartStabilityProps): ReactElement {
  const [query, setQuery] = useState<StabilityQuery>(initial);
  const [scan, setScan] = useState<StabilityScan | null>(null);
  const [ran, setRan] = useState<StabilityQuery | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const runId = useRef(0);

  const ok = queryOk(query);

  const run = useCallback(async (q: StabilityQuery) => {
    const id = ++runId.current;
    setRunning(true);
    setScan(null);
    setRan(q);
    setSeconds(null);
    const t0 = performance.now();
    const result = await scanStability(engine, q, {
      onProgress: (s) => { if (runId.current === id) setScan(s); },
      cancelled: () => runId.current !== id,
    });
    if (runId.current !== id) return;
    setScan(result);
    setSeconds((performance.now() - t0) / 1000);
    setRunning(false);
  }, [engine]);

  const stop = useCallback(() => {
    runId.current++;
    setRunning(false);
  }, []);

  // Open on a computed result: run the opening query once on mount.
  useEffect(() => {
    void run(initial);
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = ran ?? query;
  const stale = ran !== null && JSON.stringify(ran) !== JSON.stringify(query);
  const facts = scan?.facts ?? [];
  const unstable = useMemo(() => facts.filter((f) => !f.stable), [facts]);
  const changes = useMemo(() => changesOf(facts), [facts]);
  const progress = scan ? (scan.jdDone - scan.from) / (scan.to - scan.from) : 0;
  const wide = halfWidthOf(shown) > 3600;
  const windowLabel = STABILITY_WINDOWS.find((w) => w.id === shown.window)!.label;

  const stableGroups = useMemo(() => STABILITY_KINDS.map((kind) => ({
    kind,
    held: facts.filter((f) => f.kind === kind && f.stable),
    total: facts.filter((f) => f.kind === kind).length,
  })).filter((g) => g.total > 0), [facts]);

  // The wheel follows the form as it is edited, not the last run: it is a
  // handful of charts, cheap enough to redraw on every change.
  const wheel = useMemo(() => (ok ? windowWheel(engine, query) : null), [engine, query, ok]);
  const wheelWindow = STABILITY_WINDOWS.find((w) => w.id === query.window)!.label.replace("The whole day, ", "");

  const source = useMemo(() => stabilitySource(query), [query]);
  const returned = useMemo(() => returnedSource(scan), [scan]);
  const copy = (): void => {
    void navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const setDate = (value: string): void => {
    const m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(value);
    if (m) setQuery({ ...query, year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
  };
  const setTime = (value: string): void => {
    const m = /^(\d{2}):(\d{2})/.exec(value);
    if (m) setQuery({ ...query, hour: Number(m[1]), minute: Number(m[2]) });
  };
  const choosePlace = (id: string): void => {
    if (id === "none") setQuery({ ...query, place: null });
    else if (id === "custom") setQuery({ ...query, place: query.place ?? { lat: 0, lonEast: 0 } });
    else {
      const p = STABILITY_PLACES.find((x) => x.id === id)!;
      setQuery({ ...query, place: { lat: p.lat, lonEast: p.lonEast } });
    }
  };

  const status = running
    ? `scanning, ${Math.round(progress * 100)}%`
    : seconds !== null
      ? `${windowLabel.replace("The whole day, ", "")} in ${seconds.toFixed(1)} s, in this browser`
      : "";
  const mid = scan ? (scan.from + scan.to) / 2 : 0;

  return (
    <div className="bench">
      <div className="head">
        <div>
          <span className="lab"><span className="led led--live" />Instrument I-02</span>
          <h1>Uncertain time</h1>
        </div>
        <div>
          <p>
            Birth times are frequently approximate. Given a nominal date and
            time along with an uncertainty margin, this tool scans the full
            interval to show which chart placements hold steady and pinpoints
            when cusps, signs, or aspects change.
          </p>
        </div>
      </div>

      <div className="app">
        <form className="tile" onSubmit={(e) => { e.preventDefault(); if (ok) void run(query); }}>
          <div className="tile__h"><b>IN</b><span>Nominal chart inputs</span><i>UT</i></div>
          <div className="fld">
            <span />
            <label htmlFor="cs-date">Date</label>
            <input
              id="cs-date" type="date" required
              value={`${String(query.year).padStart(4, "0")}-${pad2(query.month)}-${pad2(query.day)}`}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="fld">
            <span />
            <label htmlFor="cs-time">Time, UT</label>
            <input
              id="cs-time" type="time" required
              value={`${pad2(query.hour)}:${pad2(query.minute)}`}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="fld">
            <span aria-hidden="true">±</span>
            <label htmlFor="cs-window">Good to</label>
            <select
              id="cs-window" value={query.window}
              onChange={(e) => setQuery({ ...query, window: e.target.value as StabilityWindowId })}
            >
              {STABILITY_WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="cs-place">Place</label>
            <select id="cs-place" value={placeId(query.place)} onChange={(e) => choosePlace(e.target.value)}>
              {STABILITY_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="custom">Your own</option>
              <option value="none">No place</option>
            </select>
          </div>
          {query.place && (
            <div className="fld fld--opt fld--pair">
              <span />
              <label htmlFor="cs-lat">Lat, lon</label>
              <input
                id="cs-lat" type="number" inputMode="decimal" step="any" aria-label="Latitude, north positive"
                min={-90} max={90} value={query.place.lat}
                onChange={(e) => setQuery({ ...query, place: { ...query.place!, lat: Number(e.target.value) } })}
              />
              <input
                type="number" inputMode="decimal" step="any" aria-label="Longitude, east positive"
                min={-180} max={180} value={query.place.lonEast}
                onChange={(e) => setQuery({ ...query, place: { ...query.place!, lonEast: Number(e.target.value) } })}
              />
            </div>
          )}
          {query.place && (
            <div className="fld fld--opt">
              <span />
              <label htmlFor="cs-houses">Houses</label>
              <select
                id="cs-houses" value={query.houseSystem}
                onChange={(e) => setQuery({ ...query, houseSystem: e.target.value as HouseSystem })}
              >
                {HOUSE_SYSTEMS.map((h) => <option key={h} value={h}>{houseLabel(h)}</option>)}
              </select>
            </div>
          )}
          <div className="fld fld--opt">
            <span />
            <label htmlFor="cs-zodiac">Zodiac</label>
            <select
              id="cs-zodiac" value={query.zodiac}
              onChange={(e) => setQuery({ ...query, zodiac: e.target.value as Zodiac })}
            >
              {ZODIACS.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </div>
          {running
            ? <button className="run" type="button" onClick={stop}>Stop</button>
            : <button className="run run--go" type="submit" disabled={!ok}>Run scan</button>}
          <p className="note">
            {ok
              ? `${statedText(query)}. `
              : "Enter a valid date, time, and coordinates. "}
            {query.place
              ? "Latitude is north-positive and longitude is east-positive (Tampa is -82.46)."
              : "Without observer coordinates, angles, house placements, and sect are omitted from the scan."}
          </p>
        </form>

        <div className="col">
          <section className="tile">
            <div className="tile__h"><b>OUT</b><span>Stable placements</span><i>{status}</i></div>
            <div className="meter"><i style={{ width: `${(running ? progress : scan ? 1 : 0) * 100}%` }} /></div>
            <div className="count">
              <b>{scan ? scan.summary.stable : 0}</b>
              <span>of {scan ? scan.summary.facts : 0} facts hold</span>
              <i>
                {statedText(shown)}, {windowLabel.replace("The whole day, ", "")}<br />
                {stale ? "inputs changed since this run" : `caelus ${VERSION}, embedded tier`}
              </i>
            </div>
            {scan && unstable.length === 0 && !running && (
              <p className="empty">Every fact of this chart holds across the whole window.</p>
            )}
            {scan && unstable.length > 0 && (
              <div className="tl tl--facts">
                {unstable.slice(0, MAX_TRACKS).map((f) => (
                  <div className="tl__row" key={`${f.kind}:${f.subject}`}>
                    <div className="tl__lab">
                      <span><b>{factLabel(f)}</b></span>
                      <i>{Math.round(f.share * 100)}%</i>
                    </div>
                    <FactTrack fact={f} from={scan.from} to={scan.to} />
                  </div>
                ))}
                <div className="tl__row">
                  <div />
                  <div className="tl__plot">
                    <div className="tl__axis">
                      <span style={{ left: "0%" }}>{timeText(scan.from, { withDate: wide })}</span>
                      <span style={{ left: "50%" }}>{timeText(mid, { withDate: wide })} stated</span>
                      <span style={{ left: "100%" }}>{timeText(scan.to, { withDate: wide })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {unstable.length > MAX_TRACKS && (
              <p className="note">
                Showing {MAX_TRACKS} of {unstable.length} changing facts. The percentage
                indicates how much of the window matches the nominal chart value.
              </p>
            )}
            {unstable.length > 0 && unstable.length <= MAX_TRACKS && (
              <p className="note">
                Each bar shows a changing placement over the window, with the
                nominal time marked at center and the percentage showing how
                long the nominal value holds.
              </p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>WHEEL</b><span>Chart over the time window</span>
              <i>{ok ? `${statedText(query)}, ${wheelWindow}` : ""}</i>
            </div>
            {!wheel && <p className="empty">Enter a valid date, time, and coordinates to render the wheel.</p>}
            {wheel && (
              <>
                <div className="chart-fluid">
                  <ChartWheel
                    chart={wheel.chart} size={460} theme={wheelTheme}
                    layers={wheel.placed ? undefined : { houses: false, axes: false }}
                    uncertainty={{ samples: wheel.samples }}
                  />
                </div>
                <p className="note">
                  {wheel.placed
                    ? "The wheel renders the nominal chart alongside uncertainty arcs: planetary ranges appear inside the zodiac ring, while the Ascendant (outer) and Midheaven (inner) arcs run along the rim. Heavier arcs with a square marker indicate sign crossings. "
                    : "With no place there is no Ascendant, Midheaven, or house cusps to draw, so the wheel aligns 0° Aries at the left to show planetary positions and aspects. Arcs inside the zodiac ring show each body's range across the window, marked heavier with a square when crossing into a new sign. "}
                  {crossingText(wheel)}
                </p>
              </>
            )}
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>TBL</b><span>Transition timeline</span>
              <i>{changes.length} transitions (to ~1 s)</i>
            </div>
            {changes.length === 0
              ? <p className="empty">{running || !scan ? "Scanning." : "No chart facts change within this window."}</p>
              : (
                <div className="scroll">
                  <table className="rd">
                    <thead><tr><th>UT</th><th>Fact</th><th>From</th><th>To</th></tr></thead>
                    <tbody>
                      {changes.slice(0, MAX_ROWS).map((c, i) => (
                        <tr key={i}>
                          <td className={c.jd < mid ? "dn" : "up"}>{timeText(c.jd, { seconds: true, withDate: wide })}</td>
                          <td className="em">{factLabel(c.fact)}</td>
                          <td>{valueLabel(c.fact.kind, c.from)}</td>
                          <td>{valueLabel(c.fact.kind, c.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            {changes.length > MAX_ROWS && (
              <p className="note">Showing the first {MAX_ROWS} of {changes.length} transitions.</p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h"><b>HOLD</b><span>Unchanged facts by category</span><i>nominal chart value</i></div>
            {stableGroups.length === 0
              ? <p className="empty">Scanning.</p>
              : (
                <div className="scroll">
                  <table className="rd">
                    <thead><tr><th>Kind</th><th className="r">Hold</th><th>Facts</th></tr></thead>
                    <tbody>
                      {stableGroups.map((g) => (
                        <tr key={g.kind}>
                          <td className="em">{kindLabel(g.kind)}</td>
                          <td className="r">{g.held.length} of {g.total}</td>
                          <td className="wrap">
                            {g.held.length === 0 ? "none" : g.held.map((f) => (
                              g.kind === "aspect"
                                ? `${f.subject.split("-").map(subjectLabel).join(" ")} ${valueLabel(f.kind, f.value)}`
                                : g.kind === "sect"
                                  ? valueLabel(f.kind, f.value)
                                  : `${subjectLabel(f.subject)} ${valueLabel(f.kind, f.value)}`
                            )).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
        <div className="tile__h"><b>M-1</b><span>Sampling and bisection</span></div>
        <div className="tile__b prose">
          <p>
            The scan samples the chart every two minutes across the window.
            Whenever a fact differs between consecutive samples, a bisection
            step narrows the transition timestamp to roughly one second. In
            this demo, the window runs in one-hour slices so results update
            incrementally.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>Tracked fact categories</span></div>
        <div className="tile__b prose">
          <p>
            Each tracked fact represents a discrete chart property across six
            categories: Ascendant and Midheaven signs, chart sect (day or night),
            each body&apos;s sign, house placement, retrograde state, and
            pairwise aspects.
          </p>
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Scope and limitations</span></div>
        <div className="tile__b prose">
          <p>
            Brief transitions that revert within two minutes can be missed by
            the initial grid, and geographic coordinate uncertainty is not
            modeled. Aspects are evaluated as binary states against standard orbs
            (an aspect whose orb tightens without breaking remains stable).
            All dates use the Gregorian calendar.
          </p>
        </div>
      </section>
    </div>
  );
}
