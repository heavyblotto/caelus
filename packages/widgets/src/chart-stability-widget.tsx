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
import {
  changesOf, factLabel, halfWidthOf, kindLabel, queryOk, returnedSource,
  scanStability, STABILITY_DEFAULT, STABILITY_PLACES, STABILITY_WINDOWS,
  stabilitySource, statedText, subjectLabel, timeText, trackLabel, valueLabel,
  type StabilityQuery, type StabilityScan, type StabilityWindowId,
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

export function ChartStability({ engine, initial = STABILITY_DEFAULT }: ChartStabilityProps): ReactElement {
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
            A chart is computed for one instant, and the instant is often not
            known that well. This instrument takes a stated time and how far
            off it could be, and reports which facts of the chart hold across
            the whole window and when the others change.
          </p>
        </div>
      </div>

      <div className="app">
        <form className="tile" onSubmit={(e) => { e.preventDefault(); if (ok) void run(query); }}>
          <div className="tile__h"><b>IN</b><span>The stated time</span><i>UT</i></div>
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
              : "Enter a date, a time, and a place on the globe. "}
            {query.place
              ? "Latitude is north positive and longitude is east positive, so Tampa is -82.46."
              : "With no place the scan leaves out the angles, the houses, and the sect."}
          </p>
        </form>

        <div className="col">
          <section className="tile">
            <div className="tile__h"><b>OUT</b><span>Facts that hold</span><i>{status}</i></div>
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
                Showing {MAX_TRACKS} of {unstable.length} facts that change. The figure beside each
                label is the share of the window in which the fact has its stated value.
              </p>
            )}
            {unstable.length > 0 && unstable.length <= MAX_TRACKS && (
              <p className="note">
                One track for each fact that changes. The figure beside each label is the share
                of the window in which the fact has its stated value, and the line down the
                middle is the stated time.
              </p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>TBL</b><span>Changes in time order</span>
              <i>{changes.length} found, to about a second</i>
            </div>
            {changes.length === 0
              ? <p className="empty">{running || !scan ? "Scanning." : "Nothing changes inside this window."}</p>
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
              <p className="note">Showing the first {MAX_ROWS} of {changes.length} changes.</p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h"><b>HOLD</b><span>Stable facts by kind</span><i>value at the stated time</i></div>
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
              <b>TS</b><span>The call</span>
              <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="code">{source}</pre>
          </section>
          <section className="tile">
            <div className="tile__h"><b>RET</b><span>What it returns</span><i>UT Julian Days</i></div>
            <pre className="code">{returned}</pre>
          </section>
        </div>
      </div>

      <section className="tile s4 half">
        <div className="tile__h"><b>M-1</b><span>How the scan works</span></div>
        <div className="tile__b prose">
          <p>
            The scan computes the chart every two minutes across the window.
            Wherever a fact differs between two neighbouring samples it
            bisects for the instant of the change, to about a second. This
            page runs the window an hour at a time so the tracks fill in as it
            goes.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>What a fact is</span></div>
        <div className="tile__b prose">
          <p>
            A fact is one discrete statement the chart makes. There are six
            kinds: the sign on the Ascendant and the Midheaven, whether the
            chart is by day or by night, the sign of each body, its house,
            whether a planet is retrograde, and which aspect a pair of bodies
            is in.
          </p>
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Limits</span></div>
        <div className="tile__b prose">
          <p>
            A fact that changes and changes back inside two minutes is missed.
            The window is a window of time, so uncertainty in the place is not
            modelled. An aspect counts as present or absent at the engine's
            orbs, and a pair that stays in orb while the aspect tightens is
            stable. Dates here are Gregorian.
          </p>
        </div>
      </section>
    </div>
  );
}
