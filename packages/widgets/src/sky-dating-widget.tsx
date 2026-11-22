/**
 * caelus-widgets — the sky-dating instrument.
 *
 * Split from sky-dating.ts because this component calls hooks; a host with
 * React Server Components imports it across a client boundary.
 *
 * The layout is the Workbench instrument grammar (apps/web/DESIGN.md): a
 * title tile, then input, output, and the call side by side, then three
 * method tiles. The component emits Workbench class names and no styles of
 * its own, so the host supplies the stylesheet (apps/web/app/workbench.css)
 * and wraps the instrument in a `.wb` root.
 *
 * The host passes the engine. On the site that is the embedded tier, so the
 * search runs in the visitor's browser and nothing is sent to a server.
 *
 * A host that publishes the binary packs can also pass `packs`. The form then
 * offers the full packs as a second data tier: it lists the files the current
 * search needs and their size, downloads them when the reader runs the
 * search, and builds an engine on them. The widget stays framework-neutral:
 * the host supplies the manifest URL and the fetch.
 */
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  heliacalKindsFor, SIGNS, VERSION,
  type Engine, type HeliacalKind, type PackManifest, type Zodiac,
} from "caelus";
import { kindLabel, VISIBILITY_PLACES, VISIBILITY_TARGETS } from "./first-visibility.js";
import {
  buildConstraints, callSource, eraYear, jdOfYear, megabytes, packBytes,
  packsForQuery, PackStore, searchSky, signAbbr, signDegree, signsAt,
  SKY_BODIES, SKY_PHASES, SKY_PRESETS, SKY_WITHIN, stageText, stampOf,
  visibilityIssue, windowDates,
  type PackLoadProgress, type PackSource, type SkyBodyId, type SkyPhaseId,
  type SkyQuery, type SkySearch, type SkyTier, type SkyVisibilityQuery,
} from "./sky-dating.js";

/** The widest span the form accepts, in astronomical years. */
export const SKY_SPAN = { from: -2998, to: 2998 } as const;

const ZODIACS: Array<{ id: Zodiac; label: string }> = [
  { id: "tropical", label: "Tropical" },
  { id: "sidereal:fagan_bradley", label: "Sidereal, Fagan-Bradley" },
  { id: "sidereal:lahiri", label: "Sidereal, Lahiri" },
];
const PADS = [0, 3, 6, 10];
const MAX_ROWS = 40;
const MAX_PINS = 12;

export interface SkyDatingProps {
  engine: Engine;
  /** Preset to load and run on mount. Defaults to the Babylonian tablet. */
  initialPreset?: string;
  /** Where the host publishes the binary packs. With it the form offers the
   *  full packs as a data tier; without it the widget runs on `engine` only.
   *  Pass the same object on every render. */
  packs?: PackSource;
}

/** The place a visibility opens on when the block is switched on: Babylon. */
const OPENING_PLACE = VISIBILITY_PLACES.find((p) => p.id === "babylon") ?? VISIBILITY_PLACES[0];

function placeId(place: SkyVisibilityQuery["place"]): string {
  const hit = VISIBILITY_PLACES.find((p) => p.lat === place.lat && p.lonEast === place.lonEast);
  return hit ? hit.id : "custom";
}

function niceStep(range: number): number {
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]) {
    if (range / s <= 5) return s;
  }
  return 5000;
}

function Track({ spans, jd0, jd1 }: {
  spans: Array<[number, number]>; jd0: number; jd1: number;
}): ReactElement {
  const w = 1000;
  const k = w / (jd1 - jd0);
  return (
    <svg className="trk" viewBox={`0 0 ${w} 16`} preserveAspectRatio="none" aria-hidden="true">
      {spans.map(([s, e], i) => (
        <rect key={i} x={(s - jd0) * k} y={0} width={Math.max(1.2, (e - s) * k)} height={16} />
      ))}
    </svg>
  );
}

export function SkyDating({ engine, initialPreset = "babylon", packs }: SkyDatingProps): ReactElement {
  const first = SKY_PRESETS.find((p) => p.id === initialPreset) ?? SKY_PRESETS[0];
  const [query, setQuery] = useState<SkyQuery>(first.query);
  const [presetId, setPresetId] = useState<string>(first.id);
  const [search, setSearch] = useState<SkySearch | null>(null);
  const [ran, setRan] = useState<SkyQuery | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const runId = useRef(0);

  // The data tier the form selects, and the one the shown result came from.
  const [tier, setTier] = useState<SkyTier>("embedded");
  const [ranTier, setRanTier] = useState<SkyTier>("embedded");
  const [ranEngine, setRanEngine] = useState<Engine>(engine);
  const [ranPacks, setRanPacks] = useState<{ files: number; bytes: number }>({ files: 0, bytes: 0 });
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [loading, setLoading] = useState<PackLoadProgress | null>(null);
  const [held, setHeld] = useState(0); // bumped when a download finishes
  const store = useMemo(() => (packs ? new PackStore(packs, engine.data) : null), [packs, engine]);

  const constraints = useMemo(() => buildConstraints(query), [query]);
  const spanOk = Number.isFinite(query.startYear) && Number.isFinite(query.endYear)
    && query.startYear >= SKY_SPAN.from && query.endYear <= SKY_SPAN.to
    && query.endYear >= query.startYear;
  const issue = spanOk ? visibilityIssue(query) : null;
  const canRun = constraints.length > 0 && spanOk && issue === null;

  const run = useCallback(async (q: SkyQuery, on: SkyTier = "embedded") => {
    const id = ++runId.current;
    setRunning(true);
    setSearch(null);
    setRan(q);
    setSeconds(null);
    setPackError(null);
    setFailed(null);

    // On the full tier, fetch what this query lacks before searching.
    let searchEngine = engine;
    let used = { files: 0, bytes: 0 };
    if (on === "full" && store) {
      try {
        const list = await store.manifest();
        const needed = packsForQuery(list, q);
        used = { files: needed.length, bytes: packBytes(needed) };
        searchEngine = await store.engineFor(list, needed, (p) => {
          if (runId.current === id) setLoading(p);
        });
        if (runId.current === id) setManifest(list);
      } catch (err) {
        if (runId.current !== id) return;
        setPackError(err instanceof Error ? err.message : String(err));
        setLoading(null);
        setRunning(false);
        setRan(null);
        return;
      } finally {
        setHeld((n) => n + 1);
      }
      if (runId.current !== id) return;
      setLoading(null);
    }

    setRanTier(on === "full" && store ? "full" : "embedded");
    setRanEngine(searchEngine);
    setRanPacks(used);
    const t0 = performance.now();
    let result: SkySearch;
    try {
      result = await searchSky(searchEngine, q, {
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
  }, [engine, store]);

  const stop = useCallback(() => {
    runId.current++;
    setRunning(false);
    setLoading(null);
  }, []);

  const chooseTier = (next: SkyTier): void => {
    setTier(next);
    setPackError(null);
    // Read the pack list when the reader first asks for the full tier, so the
    // form can say what a search would download before anything is fetched.
    if (next === "full" && store && !manifest) {
      store.manifest().then(setManifest, (err: unknown) => {
        setPackError(err instanceof Error ? err.message : String(err));
      });
    }
  };

  // What the current form would use on the full tier, and what is still to fetch.
  const needed = useMemo(
    () => (tier === "full" && manifest ? packsForQuery(manifest, query) : []),
    [tier, manifest, query],
  );
  const toFetch = useMemo(
    () => (store ? store.missing(needed) : []),
    // `held` changes when a download lands, which is when `missing` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, needed, held],
  );

  // Open on a computed result: run the first preset once on mount.
  useEffect(() => {
    void run(first.query);
    return () => { runId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePreset = (id: string): void => {
    setPresetId(id);
    if (id === "tonight") {
      const now = Date.now() / 86400000 + 2440587.5;
      setQuery({
        signs: signsAt(engine, now), phase: null, zodiac: "tropical", pad: 0,
        startYear: SKY_SPAN.from, endYear: SKY_SPAN.to,
      });
    } else if (id === "clear") {
      const rest = { ...query, signs: {}, phase: null };
      delete rest.visibility;
      setQuery(rest);
    } else {
      const p = SKY_PRESETS.find((x) => x.id === id);
      if (p) setQuery(p.query);
    }
  };

  const setSign = (body: SkyBodyId, value: string): void => {
    const signs = { ...query.signs };
    if (value === "") delete signs[body];
    else signs[body] = Number(value);
    setQuery({ ...query, signs });
    setPresetId("custom");
  };

  // The visibility block. Off is the absence of the key, so the queries of
  // the presets that have none compare equal before and after a round trip.
  const setVisibility = (v: SkyVisibilityQuery | undefined): void => {
    const rest = { ...query };
    delete rest.visibility;
    setQuery(v ? { ...rest, visibility: v } : rest);
    setPresetId("custom");
  };
  const chooseTarget = (id: string): void => {
    if (id === "") { setVisibility(undefined); return; }
    const kinds = heliacalKindsFor(engine, id);
    const cur = query.visibility;
    setVisibility({
      target: id,
      kind: cur && kinds.includes(cur.kind) ? cur.kind : kinds[0],
      place: cur?.place ?? { lat: OPENING_PLACE.lat, lonEast: OPENING_PLACE.lonEast },
      within: cur?.within ?? 0,
    });
  };
  const vis = query.visibility;
  const visKinds = useMemo(
    () => (vis ? heliacalKindsFor(engine, vis.target) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, vis?.target],
  );

  const preset = SKY_PRESETS.find((p) => p.id === presetId);
  const shown = ran ?? query;
  const jd0 = search?.jdStart ?? jdOfYear(shown.startYear);
  const jd1 = search?.jdEnd ?? jdOfYear(shown.endYear + 1);
  const windows = search?.windows ?? [];
  const stale = ran !== null
    && (JSON.stringify(ran) !== JSON.stringify(query) || (!running && ranTier !== tier));
  const progress = search ? (search.jdDone - jd0) / (jd1 - jd0) : 0;
  const years = shown.endYear - shown.startYear + 1;

  const ticks = useMemo(() => {
    // Round numbers in the era the reader sees: 400 BCE is astronomical
    // year -399, so BCE ticks sit one year off the multiples.
    const step = niceStep(shown.endYear - shown.startYear);
    const out: Array<{ year: number; pct: number }> = [];
    const add = (y: number): void => {
      if (y >= shown.startYear && y <= shown.endYear) {
        out.push({ year: y, pct: ((jdOfYear(y) - jd0) / (jd1 - jd0)) * 100 });
      }
    };
    for (let n = Math.ceil((1 - shown.endYear) / step) * step; 1 - n >= shown.startYear; n += step) {
      if (n >= step) add(1 - n);
    }
    for (let y = step; y <= shown.endYear; y += step) add(y);
    // mark the turn of the era when the span crosses it
    if (shown.startYear < -step / 2 && shown.endYear > step / 2) add(1);
    return out.sort((a, b) => a.year - b.year);
  }, [shown.startYear, shown.endYear, jd0, jd1]);

  const rows = useMemo(() => {
    const bodies = SKY_BODIES.filter((b) => shown.signs[b.id] !== undefined);
    return {
      bodies,
      list: windows.slice(0, MAX_ROWS).map(([s, e]) => {
        const mid = (s + e) / 2;
        return {
          start: s, end: e,
          lons: bodies.map((b) => ranEngine.longitude(b.id, mid, { zodiac: shown.zodiac })),
        };
      }),
    };
  }, [windows, shown, ranEngine]);

  const source = useMemo(
    () => callSource(query, tier, packs?.manifestUrl),
    [query, tier, packs],
  );
  const copy = (): void => {
    void navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const returned = useMemo(() => {
    const head = windows.slice(0, 3).map(([s, e]) =>
      `  { start: ${s.toFixed(5)}, end: ${e.toFixed(5)} },`);
    const more = windows.length > 3 ? [`  // ${windows.length - 3} more`] : [];
    return ["[", ...head, ...more, "]"].join("\n");
  }, [windows]);

  const loadFraction = loading && loading.bytesTotal > 0 ? loading.bytesDone / loading.bytesTotal : 0;
  const status = loading
    ? `loading packs, ${megabytes(loading.bytesDone)} of ${megabytes(loading.bytesTotal)}`
    : running
    ? `searching, ${Math.round(progress * 100)}%`
    : seconds !== null
      ? `${years.toLocaleString("en-US")} years in ${seconds.toFixed(1)} s, in this browser`
      : "";

  return (
    <div className="bench">
      <div className="head">
        <div>
          <span className="lab"><span className="led led--live" />Instrument I-01</span>
          <h1>Sky dating</h1>
        </div>
        <div>
          <p>
            Search historical dates for intervals matching a partial sky
            description. For example, you can date an undated horoscope or
            literary passage by matching planetary signs, lunar phases, or
            first and last visibility events from a specific location across up
            to 6,000 years.
          </p>
        </div>
      </div>

      <div className="app">
        <form className="tile" onSubmit={(e) => { e.preventDefault(); if (canRun) void run(query, tier); }}>
          <div className="tile__h"><b>IN</b><span>Constraints</span><i>{constraints.length} set</i></div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="sd-preset">Start from</label>
            <select id="sd-preset" value={presetId} onChange={(e) => choosePreset(e.target.value)}>
              {SKY_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="tonight">The sky right now</option>
              <option value="clear">Nothing set</option>
              {presetId === "custom" && <option value="custom">Your own</option>}
            </select>
          </div>
          {SKY_BODIES.map((b) => (
            <div className="fld" key={b.id}>
              <span aria-hidden="true">{b.glyph}</span>
              <label htmlFor={`sd-${b.id}`}>{b.label}</label>
              <select
                id={`sd-${b.id}`}
                value={query.signs[b.id] ?? ""}
                onChange={(e) => setSign(b.id, e.target.value)}
              >
                <option value="">Any sign</option>
                {SIGNS.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select>
            </div>
          ))}
          <div className="fld fld--opt">
            <span aria-hidden="true">◐</span>
            <label htmlFor="sd-phase">Phase</label>
            <select
              id="sd-phase"
              value={query.phase ?? ""}
              onChange={(e) => {
                setQuery({ ...query, phase: (e.target.value || null) as SkyPhaseId | null });
                setPresetId("custom");
              }}
            >
              <option value="">Any phase</option>
              {SKY_PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="fld fld--opt">
            <span aria-hidden="true">✶</span>
            <label htmlFor="sd-vis">Visibility</label>
            <select id="sd-vis" value={vis?.target ?? ""} onChange={(e) => chooseTarget(e.target.value)}>
              <option value="">No first or last visibility</option>
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
          {vis && (
            <>
              <div className="fld fld--opt">
                <span />
                <label htmlFor="sd-vis-kind">Event</label>
                <select
                  id="sd-vis-kind" value={vis.kind}
                  onChange={(e) => setVisibility({ ...vis, kind: e.target.value as HeliacalKind })}
                >
                  {visKinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
                </select>
              </div>
              <div className="fld fld--opt">
                <span />
                <label htmlFor="sd-vis-place">Seen from</label>
                <select
                  id="sd-vis-place" value={placeId(vis.place)}
                  onChange={(e) => {
                    const p = VISIBILITY_PLACES.find((x) => x.id === e.target.value);
                    if (p) setVisibility({ ...vis, place: { lat: p.lat, lonEast: p.lonEast } });
                  }}
                >
                  {VISIBILITY_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  {placeId(vis.place) === "custom" && <option value="custom">Your own</option>}
                </select>
              </div>
              <div className="fld fld--opt fld--pair">
                <span />
                <label htmlFor="sd-vis-lat">Lat, lon</label>
                <input
                  id="sd-vis-lat" type="number" inputMode="decimal" step="any" aria-label="Latitude, north positive"
                  min={-90} max={90} value={vis.place.lat}
                  onChange={(e) => setVisibility({ ...vis, place: { ...vis.place, lat: Number(e.target.value) } })}
                />
                <input
                  type="number" inputMode="decimal" step="any" aria-label="Longitude, east positive"
                  min={-180} max={180} value={vis.place.lonEast}
                  onChange={(e) => setVisibility({ ...vis, place: { ...vis.place, lonEast: Number(e.target.value) } })}
                />
              </div>
              <div className="fld fld--opt">
                <span />
                <label htmlFor="sd-vis-within">Within</label>
                <select
                  id="sd-vis-within" value={vis.within}
                  onChange={(e) => setVisibility({ ...vis, within: Number(e.target.value) })}
                >
                  {SKY_WITHIN.map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? "0 days, exact" : `${d} ${d === 1 ? "day" : "days"} each side`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="fld fld--opt">
            <span />
            <label htmlFor="sd-pad">Widen by</label>
            <select
              id="sd-pad"
              value={query.pad}
              onChange={(e) => { setQuery({ ...query, pad: Number(e.target.value) }); setPresetId("custom"); }}
            >
              {PADS.map((p) => <option key={p} value={p}>{p === 0 ? "0°, exact signs" : `${p}° each side`}</option>)}
            </select>
          </div>
          <div className="fld fld--opt">
            <span />
            <label htmlFor="sd-zodiac">Zodiac</label>
            <select
              id="sd-zodiac"
              value={query.zodiac}
              onChange={(e) => { setQuery({ ...query, zodiac: e.target.value as Zodiac }); setPresetId("custom"); }}
            >
              {ZODIACS.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </div>
          <div className="fld fld--opt fld--pair">
            <span />
            <label htmlFor="sd-from">Years</label>
            <input
              id="sd-from" type="number" inputMode="numeric" aria-label="First year"
              min={SKY_SPAN.from} max={SKY_SPAN.to} value={query.startYear}
              onChange={(e) => { setQuery({ ...query, startYear: Math.trunc(Number(e.target.value)) }); setPresetId("custom"); }}
            />
            <input
              type="number" inputMode="numeric" aria-label="Last year"
              min={SKY_SPAN.from} max={SKY_SPAN.to} value={query.endYear}
              onChange={(e) => { setQuery({ ...query, endYear: Math.trunc(Number(e.target.value)) }); setPresetId("custom"); }}
            />
          </div>
          {packs && (
            <div className="fld fld--opt">
              <span />
              <label htmlFor="sd-tier">Data</label>
              <select id="sd-tier" value={tier} onChange={(e) => chooseTier(e.target.value as SkyTier)}>
                <option value="embedded">Embedded tier, in this page</option>
                <option value="full">Full packs, downloaded</option>
              </select>
            </div>
          )}
          {running
            ? <button className="run" type="button" onClick={stop}>Stop</button>
            : (
              <button className="run run--go" type="submit" disabled={!canRun}>
                {tier === "full" && toFetch.length > 0
                  ? `Download ${megabytes(packBytes(toFetch))} and run`
                  : "Run search"}
              </button>
            )}
          {tier === "full" && (
            <p className="note" role="status">
              {packError
                ? `Could not load ephemeris packs, so the search did not run. ${packError}`
                : !manifest
                  ? "Loading pack manifest..."
                  : needed.length === 0
                    ? "Select at least one constraint to calculate which ephemeris packs are required."
                    : `This query uses ${needed.length} ephemeris ${needed.length === 1 ? "pack" : "packs"} (${megabytes(packBytes(needed))}). `
                      + (toFetch.length === 0
                        ? "All required packs are already cached locally."
                        : `${megabytes(packBytes(toFetch))} will download when you run the search.`)}
            </p>
          )}
          <p className="note">
            {spanOk
              ? `Span: ${eraYear(query.startYear)} to ${eraYear(query.endYear)}. Years use astronomical numbering (0 = 1 BCE, -409 = 410 BCE).`
              : `Enter a range between ${SKY_SPAN.from} and ${SKY_SPAN.to} with start year first.`}
            {issue ? ` ${issue}` : ""}
            {vis && !issue
              ? " Visibility constraints run last and locate events sequentially, so broad positional windows take longer to scan. Use Stop to cancel a running query."
              : ""}
            {preset ? ` ${preset.note}` : ""}
          </p>
        </form>

        <div className="col">
          <section className="tile">
            <div className="tile__h"><b>OUT</b><span>Windows that fit</span><i>{status}</i></div>
            <div className="meter"><i style={{ width: `${(loading ? loadFraction : running ? progress : search ? 1 : 0) * 100}%` }} /></div>
            <div className="count">
              <b>{windows.length.toLocaleString("en-US")}</b>
              <span>{windows.length === 1 ? "window fits" : "windows fit"}</span>
              <i>
                {eraYear(shown.startYear)} to {eraYear(shown.endYear)}<br />
                {stale
                  ? "inputs changed since this run"
                  : `caelus ${VERSION}, ${ranTier === "full" ? "full packs" : "embedded tier"}`}
              </i>
            </div>
            <div className="tl tl--narrow">
              {(search?.stages ?? []).map((st, i, all) => (
                <div className={`tl__row${i === all.length - 1 ? " tl__row--hit" : ""}`} key={st.constraint}>
                  <div className="tl__lab">
                    <span>{i > 0 ? "+ " : ""}<b>{stageText(st, shown)}</b></span>
                    <i>{st.spans.length.toLocaleString("en-US")}</i>
                  </div>
                  <Track spans={st.spans} jd0={jd0} jd1={jd1} />
                </div>
              ))}
              <div className="tl__row">
                <div />
                <div className="tl__plot">
                  {!running && windows.length <= MAX_PINS && windows.map(([s], i) => (
                    <div className="pin" key={s} style={{ left: `${((s - jd0) / (jd1 - jd0)) * 100}%` }}>
                      <b>{i + 1}</b>
                    </div>
                  ))}
                  <div className="tl__axis">
                    {ticks.map((t) => (
                      <span key={t.year} style={{ left: `${t.pct}%` }}>{eraYear(t.year)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="tile">
            <div className="tile__h">
              <b>TBL</b><span>Matches</span>
              <i>positions at the middle of each window</i>
            </div>
            {rows.list.length === 0
              ? <p className="empty">{failed ? `The search stopped: ${failed}.` : loading ? "Loading packs." : running ? "Searching." : "No window fits every constraint in this span."}</p>
              : (
                <div className="scroll">
                  <table className="rd">
                    <thead>
                      <tr>
                        <th>#</th><th>Window</th><th>Opens, UT</th>
                        {rows.bodies.map((b) => (
                          <th className="r" key={b.id}>{b.glyph} {signAbbr(shown.signs[b.id]!)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.list.map((r, i) => {
                        const a = stampOf(r.start);
                        const days = r.end - r.start;
                        return (
                          <tr key={r.start}>
                            <td className="up">{i + 1}</td>
                            <td className="em">
                              {windowDates(r.start, r.end, shown)}
                              <small>
                                {a.calendar === "julian" ? "Julian" : "Gregorian"},{" "}
                                {days < 1 ? `${(days * 24).toFixed(1)} hours` : `${days.toFixed(1)} days`}
                                {shown.visibility ? ", local days" : ""}
                              </small>
                            </td>
                            <td>{a.ut}</td>
                            {r.lons.map((lon, j) => (
                              <td className="r" key={rows.bodies[j].id}>
                                {signDegree(lon)} {signAbbr(Math.floor(lon / 30) % 12)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {windows.length > MAX_ROWS && (
              <p className="note">Showing the first {MAX_ROWS} of {windows.length.toLocaleString("en-US")} windows.</p>
            )}
          </section>

          <section className="tile">
            <div className="tile__h"><b>CUT</b><span>Filter funnel by constraint</span><i>slowest body first</i></div>
            <div className="scroll">
              <table className="rd">
                <thead><tr><th>Constraint</th><th className="r">Windows</th><th className="r">Days</th></tr></thead>
                <tbody>
                  {(search?.stages ?? []).map((st, i) => (
                    <tr key={st.constraint}>
                      <td className="em">{i > 0 ? "+ " : ""}{stageText(st, shown, true, VISIBILITY_PLACES)}</td>
                      <td className="r">{st.spans.length.toLocaleString("en-US")}</td>
                      <td className="r">{Math.round(st.days).toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <div className="tile__h"><b>M-1</b><span>Search order and pruning</span></div>
        <div className="tile__b prose">
          <p>
            The solver evaluates constraints from the slowest-moving body to
            the fastest. It first identifies windows where Saturn occupies its
            target sign, searches only those intervals for Jupiter, and
            continues down to the Moon. Each row in the funnel shows the
            candidates remaining after applying that filter. Because first and
            last visibility constraints are discrete events rather than
            continuous curves, they run last inside each surviving window. Use
            the{" "}
            <a href="/instruments/first-visibility">First Visibility instrument</a>{" "}
            to inspect individual events in detail, or read{" "}
            <a href="/docs/heliacal">First and last visibility</a> for the
            underlying atmospheric model.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>Ephemeris tier</span></div>
        <div className="tile__b prose">
          {ranTier === "full" ? (
            <p>
              These results use the full ephemeris packs (JPL Horizons fits for
              each constrained planet plus Earth), totaling {ranPacks.files}{" "}
              {ranPacks.files === 1 ? "file" : "files"} ({megabytes(ranPacks.bytes)}).
              Every downloaded pack is verified against its manifest SHA-256
              checksum before decoding, matching the Node.js loader used by the
              test suite.
            </p>
          ) : (
            <p>
              These results run client-side on the bundled embedded tier. It
              agrees with the full ephemeris packs within 0.02° after 1 CE and
              within 0.09° back to 1000 BCE (at 3000 BCE Saturn differs by up to
              0.7°). For both horoscope presets, this finds the exact same date
              windows, with boundary edges shifted by about 6 minutes for the
              Babylonian tablet and 27 minutes for Hadrian&apos;s horoscope.{" "}
              {packs
                ? "Switch Data to Full packs to download exact JPL fits in the browser."
                : "Use the full Node packs when exact boundary timestamps are critical."}
            </p>
          )}
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Calendars and scope</span></div>
        <div className="tile__b prose">
          <p>
            Dates before October 15, 1582 use the Julian calendar. Each output
            window marks a continuous interval of Universal Time during which
            all constraints hold simultaneously, so queries including the Moon
            typically span two or three days. Visibility constraints span whole
            local calendar days at the observer&apos;s location, running from
            the clearer-sky earliest date through the hazier-sky latest date.
            When a visibility constraint is active, the Window column displays
            local calendar days at that location while Opens shows the
            corresponding Universal Time. Signs for the two horoscope presets
            reflect standard secondary translations rather than newly verified
            critical editions.
          </p>
        </div>
      </section>
    </div>
  );
}
