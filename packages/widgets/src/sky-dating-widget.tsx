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
import { SIGNS, VERSION, type Engine, type PackManifest, type Zodiac } from "caelus";
import {
  buildConstraints, callSource, eraYear, jdOfYear, megabytes, packBytes,
  packsForQuery, PackStore, searchSky, signAbbr, signDegree, signsAt,
  SKY_BODIES, SKY_PHASES, SKY_PRESETS, stampOf, windowText,
  type PackLoadProgress, type PackSource, type SkyBodyId, type SkyPhaseId,
  type SkyQuery, type SkySearch, type SkyTier,
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

/** A stage label for display: the engine's label with its first letter raised. */
function stageLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  const canRun = constraints.length > 0 && spanOk;

  const run = useCallback(async (q: SkyQuery, on: SkyTier = "embedded") => {
    const id = ++runId.current;
    setRunning(true);
    setSearch(null);
    setRan(q);
    setSeconds(null);
    setPackError(null);

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
    const result = await searchSky(searchEngine, q, {
      onProgress: (s) => { if (runId.current === id) setSearch(s); },
      cancelled: () => runId.current !== id,
    });
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
      setQuery({ ...query, signs: {}, phase: null });
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
            Sky dating takes a partial description of a sky and lists every
            date that fits it. A horoscope that names the sign of each planet
            and gives no year can be dated this way, by matching it against
            the computed sky across several thousand years.
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
                ? `The packs could not be loaded, so nothing was run. ${packError}`
                : !manifest
                  ? "Reading the list of packs."
                  : needed.length === 0
                    ? "Set a constraint to see which packs the search needs."
                    : `This search uses ${needed.length} pack ${needed.length === 1 ? "file" : "files"}, ${megabytes(packBytes(needed))}. `
                      + (toFetch.length === 0
                        ? "All of it is already loaded."
                        : `${megabytes(packBytes(toFetch))} is still to download, and nothing is fetched until you run the search.`)}
            </p>
          )}
          <p className="note">
            {spanOk
              ? `${eraYear(query.startYear)} to ${eraYear(query.endYear)}. Years are astronomical, so 0 is 1 BCE and -409 is 410 BCE.`
              : `Years must run from ${SKY_SPAN.from} to ${SKY_SPAN.to}, first before last.`}
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
                    <span>{i > 0 ? "+ " : ""}<b>{stageLabel(st.label)}</b></span>
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
              ? <p className="empty">{loading ? "Loading packs." : running ? "Searching." : "No window fits every constraint in this span."}</p>
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
                              {windowText(r.start, r.end)}
                              <small>
                                {a.calendar === "julian" ? "Julian" : "Gregorian"},{" "}
                                {days < 1 ? `${(days * 24).toFixed(1)} hours` : `${days.toFixed(1)} days`}
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
            <div className="tile__h"><b>CUT</b><span>What each constraint leaves</span><i>slowest body first</i></div>
            <div className="scroll">
              <table className="rd">
                <thead><tr><th>Constraint</th><th className="r">Windows</th><th className="r">Days</th></tr></thead>
                <tbody>
                  {(search?.stages ?? []).map((st, i) => (
                    <tr key={st.constraint}>
                      <td className="em">{i > 0 ? "+ " : ""}{stageLabel(st.label)}</td>
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
        <div className="tile__h"><b>M-1</b><span>How the search works</span></div>
        <div className="tile__b prose">
          <p>
            The search prunes from the slowest body to the fastest. It finds
            the windows in which Saturn is in its sign, looks for Jupiter only
            inside those, and continues down to the Moon. Each track above
            is what one constraint left standing.
          </p>
        </div>
      </section>
      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>What this page computes with</span></div>
        <div className="tile__b prose">
          {ranTier === "full" ? (
            <p>
              The result above was computed on the full packs: the JPL
              Horizons fits for the bodies in the search and for the Earth,
              {" "}{ranPacks.files} files and {megabytes(ranPacks.bytes)},
              fetched from this site. Each file was checked against its
              SHA-256 before it was decoded. They are the packs the Node
              loader reads, so the windows are the ones the engine's tests
              pin.
            </p>
          ) : (
            <p>
              The result above was computed on the embedded data tier, in
              your browser. Against the full packs it stays within 0.02° after
              1 CE and within 0.09° back to 1000 BCE; at 3000 BCE Saturn is up
              to 0.7° off. For the two presets it finds the same windows. Their
              edges differ by up to about 6 minutes for the Babylonian tablet
              and about 27 minutes for the horoscope of Hadrian.{" "}
              {packs
                ? "Set Data to the full packs to run the search on them here."
                : "Use the full packs in Node when an edge matters."}
            </p>
          )}
        </div>
      </section>
      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Calendar and limits</span></div>
        <div className="tile__b prose">
          <p>
            Dates before 15 October 1582 are in the Julian calendar. A window
            is a span of UT in which every constraint holds, so one with the
            Moon in it is two or three days long. The preset signs are the
            ones usually quoted for each text and have not been checked
            against the printed editions.
          </p>
        </div>
      </section>
    </div>
  );
}
