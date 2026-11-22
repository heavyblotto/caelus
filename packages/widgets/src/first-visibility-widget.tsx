/**
 * caelus-widgets — the first-visibility instrument.
 *
 * Split from first-visibility.ts because this component calls hooks; a host
 * with React Server Components imports it across a client boundary.
 *
 * The layout is the Workbench instrument grammar (apps/web/DESIGN.md): a
 * title tile, then input, output, and the call side by side, then three
 * method tiles. The component emits Workbench class names and no styles of
 * its own, so the host supplies the stylesheet (apps/web/app/globals.css).
 * The plots are inline SVG drawn from the engine's own numbers.
 *
 * The host passes the engine. On the site that is the embedded tier, so the
 * search runs in the visitor's browser and nothing is sent to a server.
 */
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { julianDay, VERSION, type Engine, type HeliacalEvent, type HeliacalKind } from "caelus";
import { eraYear, stampOf } from "./sky-dating.js";
import {
  crescentDays, dateText, defaultKind, isFirst, isMorning, kindLabel, kindsOf, longestAbsence, neverLost, pickEvent,
  searchVisibility, shortDate, twilightCurve, VISIBILITY_EXTINCTIONS,
  VISIBILITY_PLACES, VISIBILITY_PRESETS, VISIBILITY_SPAN, VISIBILITY_TARGETS,
  visibilityQueryOk, visibilityReturned, visibilitySource, windowText,
  YALLOP_ZONES,
  type CrescentDay, type TwilightCurve, type TwilightPoint, type VisibilityQuery,
  type VisibilitySearch, type VisibilityTargetId,
} from "./first-visibility.js";

export interface FirstVisibilityProps {
  engine: Engine;
  /** Preset to load and run on mount. Defaults to Sirius at Memphis. */
  initialPreset?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const signed = (v: number, d: number): string => `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toFixed(d)}`;
const sameEvent = (a: HeliacalEvent | null, b: HeliacalEvent): boolean =>
  a !== null && a.kind === b.kind && a.jd === b.jd;

function placeId(place: VisibilityQuery["place"]): string {
  const hit = VISIBILITY_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.id : "custom";
}

function placeName(place: VisibilityQuery["place"]): string {
  const hit = VISIBILITY_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.label : `${place.lat}, ${place.lonEast}`;
}

const targetName = (id: VisibilityTargetId): string =>
  VISIBILITY_TARGETS.find((t) => t.id === id)!.label;

/** The twilight of one event: margin against time on the day of the event
 *  and on the day beside it, with the Sun's altitude along the axis. */
function TwilightPlot({ curve, ev }: { curve: TwilightCurve; ev: HeliacalEvent }): ReactElement {
  const W = 640;
  const H = 230;
  const lo = -3;
  const hi = 1.5;
  const span = curve.day[curve.day.length - 1].minutes;
  const x = (m: number): number => ((m + span) / (2 * span)) * W;
  const y = (v: number): number => ((hi - v) / (hi - lo)) * H;
  const lines = (pts: TwilightPoint[]): string[] => {
    const out: string[] = [];
    let run: string[] = [];
    for (const p of pts) {
      if (p.margin === null) {
        if (run.length > 1) out.push(run.join(" "));
        run = [];
      } else run.push(`${x(p.minutes).toFixed(1)},${y(p.margin).toFixed(1)}`);
    }
    if (run.length > 1) out.push(run.join(" "));
    return out;
  };
  const ticks = [-span, -span / 2, 0, span / 2, span];
  const at = (m: number): TwilightPoint =>
    curve.day.reduce((a, b) => (Math.abs(b.minutes - m) < Math.abs(a.minutes - m) ? b : a));
  return (
    <svg
      className="pathplot tw-plot" viewBox={`-38 -8 ${W + 46} ${H + 54}`} role="img"
      aria-label={`How far ${ev.target} clears the limit of visibility through the twilight of ${dateText(ev.jd)} and the day ${curve.besideIs}`}
    >
      <rect className="pp-frame" x={0} y={0} width={W} height={H} />
      {[-3, -2, -1, 1].map((v) => (
        <g key={v} className={v === -3 || v === -1 ? "tw-minor" : undefined}>
          <line className="pp-grid" x1={0} y1={y(v)} x2={W} y2={y(v)} />
          <text className="pp-lab" x={-5} y={y(v) + 3} textAnchor="end">{signed(v, 0)}</text>
        </g>
      ))}
      <line className="tw-zero" x1={0} y1={y(0)} x2={W} y2={y(0)} />
      <text className="pp-lab" x={-5} y={y(0) + 3} textAnchor="end">0</text>
      {ticks.map((m) => (
        <g key={m} className={Math.abs(m) === span / 2 ? "tw-minor" : undefined}>
          <line className="pp-grid" x1={x(m)} y1={0} x2={x(m)} y2={H} />
          <text className="pp-lab" x={x(m)} y={H + 17} textAnchor={m === -span ? "start" : m === span ? "end" : "middle"}>
            {stampOf(ev.jd + m / 1440).ut}
          </text>
          <text className="pp-lab" x={x(m)} y={H + 37} textAnchor={m === -span ? "start" : m === span ? "end" : "middle"}>
            Sun {signed(at(m).sunAltitude, 1)}°
          </text>
        </g>
      ))}
      {/* a nested svg clips the curves to the frame where they run off the scale */}
      <svg x={0} y={0} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {lines(curve.beside).map((d, i) => <polyline key={`b${i}`} className="tw-beside" points={d} />)}
        {lines(curve.day).map((d, i) => <polyline key={`d${i}`} className="tw-day" points={d} />)}
      </svg>
      {ev.margin !== undefined && ev.margin > lo && ev.margin < hi && (
        <rect className="pp-max" x={x(0) - 4} y={y(ev.margin) - 4} width={8} height={8} />
      )}
    </svg>
  );
}

/** Yallop's q for the evenings (or mornings) around one new Moon, against
 *  the zone thresholds. */
function CrescentPlot({ days, ev }: { days: CrescentDay[]; ev: HeliacalEvent }): ReactElement {
  const W = 640;
  const H = 230;
  const lo = -1;
  const hi = 1.2;
  const TOP = 18; // head room, so a bar that runs off the scale keeps its label
  const y = (v: number): number => TOP + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - TOP);
  const slot = W / days.length;
  return (
    <svg
      className="pathplot tw-plot" viewBox={`-24 -8 ${W + 32} ${H + 36}`} role="img"
      aria-label={`Yallop's q for each ${ev.kind === "evening_first" ? "evening" : "morning"} around the new Moon, against the zone thresholds`}
    >
      <rect className="pp-frame" x={0} y={0} width={W} height={H} />
      {YALLOP_ZONES.map((z) => (
        <g key={z.zone}>
          <line className={z.zone === "B" ? "tw-zero" : "pp-grid"} x1={0} y1={y(z.above)} x2={W} y2={y(z.above)} />
          {(z.zone === "A" || z.zone === "B") && (
            <text className="pp-lab" x={-7} y={y(z.above) + 4} textAnchor="end">{z.zone}</text>
          )}
        </g>
      ))}
      {days.map((d, i) => {
        const cx = slot * (i + 0.5);
        const hit = d.chosen;
        return (
          <g key={d.day}>
            {d.q !== null && (
              <rect
                className={hit ? "q-bar q-bar--hit" : d.q > -0.014 ? "q-bar q-bar--seen" : "q-bar"}
                x={cx - slot * 0.28} y={y(d.q)} width={slot * 0.56} height={Math.max(1, H - y(d.q))}
              />
            )}
            <text className="pp-lab" x={cx} y={d.q === null ? H - 8 : y(d.q) - 5} textAnchor="middle">
              {d.q === null ? "none" : `${d.zone} ${d.q > hi ? signed(d.q, 1) : signed(d.q, 2)}`}
            </text>
            <text className="pp-lab" x={cx} y={H + 18} textAnchor="middle">{shortDate(d.jd)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function FirstVisibility({ engine, initialPreset = "sirius" }: FirstVisibilityProps): ReactElement {
  const first = VISIBILITY_PRESETS.find((p) => p.id === initialPreset) ?? VISIBILITY_PRESETS[0];
  const [query, setQuery] = useState<VisibilityQuery>(first.query);
  const [presetId, setPresetId] = useState<string>(first.id);
  const [search, setSearch] = useState<VisibilitySearch | null>(null);
  const [ran, setRan] = useState<VisibilityQuery | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [picked, setPicked] = useState<HeliacalEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const runId = useRef(0);

  const ok = visibilityQueryOk(query);

  const run = useCallback(async (q: VisibilityQuery, preset: string) => {
    const id = ++runId.current;
    setRunning(true);
    setSearch(null);
    setRan(q);
    setSeconds(null);
    setPicked(null);
    setFailed(null);
    const t0 = performance.now();
    let result: VisibilitySearch;
    try {
      result = await searchVisibility(engine, q, {
        onProgress: (s) => { if (runId.current === id) setSearch(s); },
        cancelled: () => runId.current !== id,
      });
    } catch (err) {
      if (runId.current !== id) return;
      setFailed(err instanceof Error ? err.message : String(err));
      setRunning(false);
      return;
    }
    if (runId.current !== id) return;
    setSearch(result);
    setSeconds((performance.now() - t0) / 1000);
    setRunning(false);
    // open on an event: the preset's, or the first return to visibility
    const p = VISIBILITY_PRESETS.find((x) => x.id === preset);
    setPicked((p ? pickEvent(result.events, p.pick) : null)
      ?? result.events.find((e) => isFirst(e.kind)) ?? result.events[0] ?? null);
  }, [engine]);

  const stop = useCallback(() => {
    runId.current++;
    setRunning(false);
  }, []);

  // Open on a computed result: run the first preset once on mount.
  useEffect(() => {
    void run(first.query, first.id);
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = ran ?? query;
  const stale = ran !== null && JSON.stringify(ran) !== JSON.stringify(query);
  const events = search?.events ?? [];
  const jd0 = search?.jdStart ?? 0;
  const jd1 = search?.jdEnd ?? 1;
  const pct = (jd: number): number => Math.max(0, Math.min(100, ((jd - jd0) / (jd1 - jd0)) * 100));
  const moon = shown.target === "moon";
  const where = placeName(shown.place);
  const name = targetName(shown.target);
  const kinds = kindsOf(shown.target);
  const preset = VISIBILITY_PRESETS.find((p) => p.id === presetId);
  const longest = search ? longestAbsence(search, shown.place.lonEast) : null;
  const always = search !== null && search.done && search.gaps.length === 0
    && neverLost([...search.events, ...search.outside]);

  const curve = useMemo(
    () => (picked && picked.method !== "crescent" ? twilightCurve(engine, shown, picked) : null),
    [engine, shown, picked],
  );
  const crescent = useMemo(
    () => (picked && picked.method === "crescent" ? crescentDays(engine, shown, picked) : null),
    [engine, shown, picked],
  );

  const months = useMemo(() => {
    const cal = shown.year < 1583 ? "julian" as const : "gregorian" as const;
    return MONTHS.map((label, i) => ({ label, jd: julianDay(shown.year, i + 1, 1, 0, 0, 0, cal) }));
  }, [shown.year]);

  const sourceKind: HeliacalKind = picked && !stale ? picked.kind : defaultKind(query.target);
  const source = useMemo(() => visibilitySource(query, sourceKind), [query, sourceKind]);
  const returned = useMemo(() => visibilityReturned(picked), [picked]);
  const copy = (): void => {
    void navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const edit = (q: VisibilityQuery): void => {
    setQuery(q);
    setPresetId("custom");
  };
  const choosePreset = (id: string): void => {
    const p = VISIBILITY_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setQuery(p.query);
  };
  const choosePlace = (id: string): void => {
    const p = VISIBILITY_PLACES.find((x) => x.id === id);
    if (p) edit({ ...query, place: { lat: p.lat, lonEast: p.lonEast } });
  };

  const status = running
    ? `searching, ${Math.round((search?.progress ?? 0) * 100)}%`
    : seconds !== null
      ? `one year in ${seconds.toFixed(1)} s, in this browser`
      : "";

  return (
    <div className="bench">
      <div className="head">
        <div>
          <span className="lab"><span className="led led--live" />Instrument I-04</span>
          <h1>First visibility</h1>
        </div>
        <div>
          <p>
            When a star or planet passes near the Sun, solar glare hides it for
            days or months. Select a body, location, and year to compute every
            first and last visibility event across the year and inspect the
            twilight margin or crescent score behind each date.
          </p>
        </div>
      </div>

      <div className="app">
        <form className="tile" onSubmit={(e) => { e.preventDefault(); if (ok) void run(query, presetId); }}>
          <div className="tile__h"><b>IN</b><span>Body, place, year</span></div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="fv-preset">Start from</label>
            <select id="fv-preset" value={presetId} onChange={(e) => choosePreset(e.target.value)}>
              {VISIBILITY_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {presetId === "custom" && <option value="custom">Your own</option>}
            </select>
          </div>
          <div className="fld">
            <span aria-hidden="true">✶</span>
            <label htmlFor="fv-target">Body</label>
            <select
              id="fv-target" value={query.target}
              onChange={(e) => edit({ ...query, target: e.target.value as VisibilityTargetId })}
            >
              <optgroup label="Stars">
                {VISIBILITY_TARGETS.filter((t) => t.group === "star").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
              <optgroup label="Planets">
                {VISIBILITY_TARGETS.filter((t) => t.group === "planet").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
              <optgroup label="Moon">
                {VISIBILITY_TARGETS.filter((t) => t.group === "moon").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="fv-place">Place</label>
            <select id="fv-place" value={placeId(query.place)} onChange={(e) => choosePlace(e.target.value)}>
              {VISIBILITY_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {placeId(query.place) === "custom" && <option value="custom">Your own</option>}
            </select>
          </div>
          <div className="fld fld--opt fld--pair">
            <span />
            <label htmlFor="fv-lat">Lat, lon</label>
            <input
              id="fv-lat" type="number" inputMode="decimal" step="any" aria-label="Latitude, north positive"
              min={-90} max={90} value={query.place.lat}
              onChange={(e) => edit({ ...query, place: { ...query.place, lat: Number(e.target.value) } })}
            />
            <input
              type="number" inputMode="decimal" step="any" aria-label="Longitude, east positive"
              min={-180} max={180} value={query.place.lonEast}
              onChange={(e) => edit({ ...query, place: { ...query.place, lonEast: Number(e.target.value) } })}
            />
          </div>
          <div className="fld">
            <span />
            <label htmlFor="fv-year">Year</label>
            <input
              id="fv-year" type="number" inputMode="numeric"
              min={VISIBILITY_SPAN.from} max={VISIBILITY_SPAN.to} value={query.year}
              onChange={(e) => edit({ ...query, year: Math.trunc(Number(e.target.value)) })}
            />
          </div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="fv-ext">Extinction</label>
            <select
              id="fv-ext" value={query.extinction} disabled={query.target === "moon"}
              onChange={(e) => edit({ ...query, extinction: Number(e.target.value) })}
            >
              {VISIBILITY_EXTINCTIONS.map((k) => (
                <option key={k} value={k}>{k.toFixed(2)}{k === 0.25 ? ", default" : ""}</option>
              ))}
            </select>
          </div>
          {running
            ? <button className="run" type="button" onClick={stop}>Stop</button>
            : <button className="run run--go" type="submit" disabled={!ok}>Find the days</button>}
          <p className="note">
            {ok
              ? `${eraYear(query.year)}${query.year < 1583 ? " (Julian calendar)" : ""}. `
              : `Enter a year between ${VISIBILITY_SPAN.from} and ${VISIBILITY_SPAN.to} and valid geographic coordinates. `}
            Years use astronomical numbering (year 0 is 1 BCE), with east longitude positive.{" "}
            {query.target === "moon"
              ? "Lunar crescents are evaluated with Yallop's q test, which takes no extinction parameter."
              : "Extinction is V-band magnitude loss per unit air mass: 0.25 for a clear sea-level sky, around 0.15 at high desert sites, and 0.35 or higher in haze."}
            {preset ? ` ${preset.note}` : ""}
          </p>
        </form>

        <div className="col">
          <section className="tile">
            <div className="tile__h"><b>OUT</b><span>First and last visibility</span><i>{status}</i></div>
            <div className="meter"><i style={{ width: `${(running ? (search?.progress ?? 0) : search ? 1 : 0) * 100}%` }} /></div>
            <div className="count">
              <b>{events.length}</b>
              <span>{events.length === 1 ? "event" : "events"}</span>
              <i>
                {name} from {where}, {eraYear(shown.year)}
                {longest !== null && !running ? `, out of sight for up to ${longest} ${longest === 1 ? "day" : "days"}` : ""}<br />
                {stale ? "inputs changed since this run" : `caelus ${VERSION}, embedded tier`}
              </i>
            </div>
            <div className="tl tl--vis">
              <div className="tl__row">
                <div className="tl__lab"><span><b>Not seen</b></span><i>{search?.gaps.length ?? 0}</i></div>
                <div className="vtrk">
                  {(search?.gaps ?? []).map(([a, b]) => (
                    <i key={a} className="vgap" style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }} title={`not seen from ${shortDate(a)} to ${shortDate(b)}`} />
                  ))}
                </div>
              </div>
              {kinds.map((kind) => {
                const mine = events.filter((e) => e.kind === kind);
                return (
                  <div className="tl__row" key={kind}>
                    <div className="tl__lab"><span><b>{kindLabel(kind)}</b></span><i>{mine.length}</i></div>
                    <div className="vtrk">
                      {mine.map((e) => {
                        const a = e.earliest ?? e.jd;
                        const b = e.latest ?? e.jd;
                        return (
                          <i key={`w${e.jd}`} className="vwin" style={{ left: `${pct(Math.min(a, e.jd))}%`, width: `${Math.max(0, pct(Math.max(b, e.jd)) - pct(Math.min(a, e.jd)))}%` }} />
                        );
                      })}
                      {mine.map((e) => (
                        <button
                          key={e.jd} type="button"
                          className={`vmark${sameEvent(picked, e) ? " vmark--picked" : ""}`}
                          style={{ left: `${pct(e.jd)}%` }}
                          title={`${kindLabel(e.kind)}, ${dateText(e.jd)}`}
                          aria-label={`${kindLabel(e.kind)}, ${dateText(e.jd)}`}
                          onClick={() => setPicked(e)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="tl__row">
                <div />
                <div className="tl__plot">
                  <div className="tl__axis tl__axis--months">
                    {months.map((m) => <span key={m.label} style={{ left: `${pct(m.jd)}%` }}>{m.label}</span>)}
                  </div>
                </div>
              </div>
            </div>
            <p className="note">
              {failed ? `Search stopped: ${failed}. ` : ""}
              {search && events.length === 0 && !running && !failed
                ? `${name} has no first or last visibility events from ${where} in this year (circumpolar or never-rising bodies have none). `
                : ""}
              {always
                ? `From ${where}, morning reappearance occurs before evening disappearance, so ${name} remains visible in either the morning or evening sky all year with no invisibility gap. `
                : ""}
              Each marker shows a nominal event date, while the shaded band behind it spans the earliest (clearer sky) to latest (hazier sky) dates. The top row highlights intervals when the body is lost in solar glare.
            </p>
          </section>

          {!moon && (
            <section className="tile">
              <div className="tile__h">
                <b>TWL</b><span>Through the twilight</span>
                <i>{picked ? `${kindLabel(picked.kind)}, ${dateText(picked.jd)}` : "choose an event"}</i>
              </div>
              {!picked || !curve
                ? <p className="empty">{running || !search ? "Searching." : "Choose an event on the strip or in the table."}</p>
                : (
                  <>
                    <TwilightPlot curve={curve} ev={picked} />
                    <p className="note twkey">
                      <span><i className="twk twk--day" />{dateText(picked.jd)}, best margin {curve.best === null ? "none" : signed(curve.best, 2)}</span>
                      <span><i className="twk twk--beside" />the day {curve.besideIs}, best margin {curve.bestBeside === null ? "none" : signed(curve.bestBeside, 2)}</span>
                    </p>
                    <p className="note">
                      The curve plots how many magnitudes {name} sits above the naked-eye
                      detection threshold across twilight, sampled every two minutes. Values
                      above zero indicate visibility. On the day {curve.besideIs}, the curve
                      remains below zero throughout twilight, making {shortDate(picked.jd)} the{" "}
                      {isFirst(picked.kind) ? "first" : "last"} visible {isMorning(picked.kind) ? "morning" : "evening"}.
                      The square marks peak visibility, and the bottom axis shows solar altitude.
                    </p>
                  </>
                )}
            </section>
          )}

          {moon && (
            <section className="tile">
              <div className="tile__h">
                <b>Q</b><span>Yallop&apos;s test, {picked?.kind === "morning_last" ? "morning by morning" : "evening by evening"}</span>
                <i>{picked ? `${kindLabel(picked.kind)}, ${dateText(picked.jd)}` : "choose an event"}</i>
              </div>
              {!picked || !crescent
                ? <p className="empty">{running || !search ? "Searching." : "Choose an event on the strip or in the table."}</p>
                : (
                  <>
                    <CrescentPlot days={crescent} ev={picked} />
                    <p className="note">
                      Each bar shows Yallop&apos;s q score for one {picked.kind === "evening_first" ? "evening" : "morning"}{" "}
                      around conjunction. Scores above the B threshold (−0.014) are visible to
                      the unaided eye under clear conditions, and scores above the A threshold
                      (0.216) are easily visible. The selected event is the{" "}
                      {picked.kind === "evening_first" ? "first evening" : "last morning"} clearing
                      the B line: {dateText(picked.jd)} (zone {picked.zone}), with the Moon{" "}
                      {picked.kind === "evening_first" ? "setting" : "rising"}{" "}
                      {Math.round(picked.lagMinutes ?? 0)} minutes {picked.kind === "evening_first" ? "after" : "before"} the Sun.
                      Fainter lines mark zones C, D, and E; bars labeled &ldquo;none&rdquo; indicate
                      the Moon set before (or rose after) the Sun.
                    </p>
                  </>
                )}
            </section>
          )}

          <section className="tile">
            <div className="tile__h">
              <b>TBL</b><span>The events</span>
              <i>times in UT, at the moment of best visibility</i>
            </div>
            {events.length === 0
              ? <p className="empty">{running || !search ? "Searching." : "No event in this year."}</p>
              : (
                <div className="scroll">
                  <table className="rd">
                    <thead>
                      {moon
                        ? <tr><th>Date</th><th>UT</th><th>Event</th><th>Easily by</th><th className="r">q</th><th>Zone</th><th className="r">Lag</th></tr>
                        : <tr><th>Date</th><th>UT</th><th>Event</th><th>Window</th><th className="r">Alt</th><th className="r">Sun</th><th className="r">Margin</th><th className="r">Arcus</th></tr>}
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={`${e.kind}${e.jd}`} className={sameEvent(picked, e) ? "picked" : undefined}>
                          <td className="em">{dateText(e.jd)}</td>
                          <td>{stampOf(e.jd).ut}</td>
                          <td><button type="button" onClick={() => setPicked(e)}>{kindLabel(e.kind)}</button></td>
                          {moon ? (
                            <>
                              <td>{windowText(e)}</td>
                              <td className="r">{signed(e.q ?? 0, 3)}</td>
                              <td>{e.zone}</td>
                              <td className="r">{Math.round(e.lagMinutes ?? 0)} min</td>
                            </>
                          ) : (
                            <>
                              <td>{windowText(e)}</td>
                              <td className="r">{(e.altitude ?? 0).toFixed(1)}°</td>
                              <td className="r">{signed(e.sunAltitude ?? 0, 1)}°</td>
                              <td className="r">{signed(e.margin ?? 0, 2)}</td>
                              <td className="r">{(e.arcusVisionis ?? 0).toFixed(1)}°</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <p className="note">
              {moon
                ? "q is Yallop's empirical visibility score and Zone is its classification. Lag is minutes between sunset and moonset (or moonrise and sunrise). \"Easily by\" shows the first date reaching zone A."
                : "Alt and Sun give the body and solar altitudes at peak visibility. Margin is magnitudes above the visual threshold. Arcus is the implied arcus visionis (solar depression when the body crossed the horizon)."}
            </p>
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
        <div className="tile__h"><b>M-1</b><span>Visibility model</span></div>
        <div className="tile__b prose">
          <p>
            For each dawn or dusk, the solver steps every two minutes as the
            body clears or approaches the horizon and compares its extinguished
            magnitude against the naked-eye contrast threshold. Background sky
            brightness combines night-sky glow, twilight scattering, and
            moonlight using B. E. Schaefer&apos;s published equations. Lunar
            crescents use B. D. Yallop&apos;s empirical q criterion instead.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>Atmospheric window</span></div>
        <div className="tile__b prose">
          <p>
            Because local atmospheric haze on a historical date cannot be known
            exactly, each event is solved at the selected extinction and at
            ±0.05 magnitudes per air mass. The resulting window spans the
            clearer-sky and hazier-sky dates (typically two to three days for
            bright stars, and up to three weeks for slow Mars conjunctions).
            Downstream analysis should use the full window rather than a single
            nominal date.
          </p>
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Limits</span></div>
        <div className="tile__b prose">
          <p>
            Calculations assume unaided naked-eye vision over a flat horizon at
            the observer&apos;s elevation with uniform seasonal extinction.
            Real-world sightings vary by several days with weather and observer
            acuity. Before roughly 800 BCE, ΔT clock uncertainty can shift a
            marginal lunar crescent date by one day. Dates prior to 15 October
            1582 use the Julian calendar.
          </p>
        </div>
      </section>
    </div>
  );
}
