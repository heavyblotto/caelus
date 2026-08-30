"use client";

import { useMemo, useState } from "react";
import {
  BODIES, EXTRA_BODIES, SIGNS, VARGA_DIVISIONS, HERMETIC_LOTS,
  fmtLon, nakshatra, vimshottariActive, vimshottariDashas,
  yoginiDashas, yoginiActive, ashtottariDashas, ashtottariActive,
  varga, vargaChart, detectYogas, rajaYogas, dhanaYogas, kemadruma,
  lots, dignityScore, almuten, chartSignature, angularity, pheno, azAlt,
  detectPatterns, profectionAt, firdariaAt, zrAt, zrRelease, primaryDirections,
  mundaneDirections, returns, transitAspects, harmonicChart, antiscion, contraAntiscion,
  gauquelinSector, outOfBounds, declinationAspects, starParans,
  ephemeris, when, aspect, inSign, retrograde, allOf, anyOf, notOf,
  lunarPhases, stations, solarEclipses, lunarEclipses, crossings, riseSet,
  solarEclipseLocal, lunarEclipseLocal, solarEclipseWhere, solarEclipseLimits,
  compileForm, searchConfigurations, chartFeatures,
  synastryAspects, synastryOverlays, compositeLongitudes, compositePlacements,
  davisonParams, midpointLon, counterfactual,
  chartDigest, rankMoments, aspectBetween, voidOfCourse, solarPhase,
  planetaryHour, registerSyntheticSystem, DEFAULT_ORBS, findAspects,
  type BodyId, type Chart, type Constraint, type Engine, type HouseSystem, type Zodiac,
} from "caelus";
import { GLYPHS, ChartWheel, EphemerisGraph, Kundli, type WheelChart } from "caelus-wheel";
import BiWheel, { type SynContact } from "../BiWheel";
import DeclinationTab from "../DeclinationTab";
import StarsTab from "../StarsTab";
import InsightsTab from "../InsightsTab";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../lib/wheelTheme";
import { cell } from "../../lib/chart-display";
import {
  isoFromJd, jdFromIso, jdToUtc, CLASSICAL, HELIO_BODIES, PHENO_BODIES,
  extraBodyIds, hoursOfDay, type ProgressMethod,
} from "./util";
import type { BirthShare, Share } from "../../lib/share";

const PHASE_LABEL: Record<string, string> = {
  new: "New Moon", first_quarter: "First Quarter", full: "Full Moon", last_quarter: "Last Quarter",
};

type PlaceView = "longitudes" | "declinations" | "stars" | "lots" | "gauquelin" | "phenomena" | "heliocentric";

export function PlacementsPanel({
  chart, engine, lat, lon, zodiac, advanced, extras,
  focus, onToggle, withAspectsOf,
}: {
  chart: Chart; engine: Engine; lat: number; lon: number; zodiac: Zodiac;
  advanced: boolean; extras: boolean;
  focus: { key: string; bodies: string[] } | null;
  onToggle: (key: string, bodies: string[]) => void;
  withAspectsOf: (b: string) => string[];
}) {
  const [view, setView] = useState<PlaceView>("longitudes");
  const ids = useMemo(() => {
    const extra = extras
      ? [...new Set([...EXTRA_BODIES, ...extraBodyIds(engine)])]
      : [];
    return [...BODIES, ...extra].filter((b) => chart.bodies[b]);
  }, [chart, extras, engine]);

  const decl = useMemo(() => {
    if (view !== "declinations") return null;
    const bodies = ids.map((b) => {
      const p = chart.bodies[b]!;
      return { body: b, dec: p.dec, oob: outOfBounds(engine, b as BodyId, chart.jdUt) };
    });
    return { bodies, pairs: declinationAspects(engine, ids as BodyId[], chart.jdUt) };
  }, [chart, engine, ids, view]);

  const stars = useMemo(() => {
    if (view !== "stars" || !engine.data.fixedStars) return null;
    const catalog = engine.data.fixedStars.stars as Record<string, { mag: number }>;
    const bright = Object.entries(catalog).filter(([, s]) => s.mag <= 2.5).map(([n]) => n);
    const paran = Object.entries(catalog).filter(([, s]) => s.mag <= 1.5).map(([n]) => n);
    const starLons = bright.map((name) => ({ name, lon: engine.fixedStar(name, chart.jdUt).lon }));
    const hits: Array<{ body: string; star: string; orb: number }> = [];
    for (const b of ids) {
      const p = chart.bodies[b];
      if (!p) continue;
      for (const s of starLons) {
        const sep = Math.abs(((p.lon - s.lon + 180) % 360 + 360) % 360 - 180);
        if (sep <= 1) hits.push({ body: b, star: s.name, orb: Math.round(sep * 100) / 100 });
      }
    }
    const parans = starParans(engine, chart.jdUt, lat, paran, undefined, 12)
      .sort((x, y) => x.gap_min - y.gap_min).slice(0, 15);
    return { conjunctions: hits.sort((a, b) => a.orb - b.orb), parans };
  }, [chart, engine, ids, lat, view]);

  const lotTable = useMemo(() => {
    if (view !== "lots") return null;
    try { return lots(engine, chart.jdUt, lat, lon, zodiac); }
    catch { return null; }
  }, [chart, engine, lat, lon, zodiac, view]);

  const insights = useMemo(() => {
    const sun = chart.bodies.sun;
    const sect: "day" | "night" = sun && sun.house >= 7 ? "day" : "night";
    const dignities = CLASSICAL.flatMap((p) => {
      const b = chart.bodies[p];
      return b ? [dignityScore(p, b.lon, sect)] : [];
    });
    return {
      patterns: detectPatterns(chart),
      signature: chartSignature(chart),
      dignities,
      lots: lots(engine, chart.jdUt, lat, lon, zodiac),
      profection: profectionAt(engine, chart.jdUt, chart.jdUt, lat, lon, zodiac),
      sect,
      almuten: almuten(chart.angles.asc, sect),
    };
  }, [chart, engine, lat, lon, zodiac]);

  const gaq = useMemo(() => {
    if (view !== "gauquelin") return null;
    return ids.map((b) => ({
      body: b,
      sector: gauquelinSector(engine, b as BodyId, chart.jdUt, lat, lon),
    }));
  }, [chart, engine, ids, lat, lon, view]);

  const phenoRows = useMemo(() => {
    if (view !== "phenomena") return null;
    return PHENO_BODIES.flatMap((b) => {
      const p = chart.bodies[b];
      if (!p) return [];
      try {
        const ph = pheno(engine, b as BodyId, chart.jdUt);
        const [az, alt] = azAlt(engine.data, p.lon, p.lat, chart.jdUt, lat, lon);
        return [{ body: b, ph, az, alt }];
      } catch { return []; }
    });
  }, [view, chart, engine, lat, lon]);

  const helioRows = useMemo(() => {
    if (view !== "heliocentric") return null;
    return HELIO_BODIES.flatMap((b) => {
      try {
        const p = engine.heliocentric(b, chart.jdUt);
        return [{ body: b, ...p }];
      } catch { return []; }
    });
  }, [view, chart, engine]);

  const tabs = advanced
    ? (["longitudes", "declinations", "stars", "lots", "gauquelin", "phenomena", "heliocentric"] as const)
    : (["longitudes", "declinations", "stars"] as const);

  return (
    <div className="workspace__panel">
      <div className="seg" role="group" aria-label="Placement view" style={{ marginBottom: "0.7rem" }}>
        {tabs.map((v) => (
          <button key={v} type="button" className="seg__btn" aria-pressed={view === v} onClick={() => setView(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {view === "longitudes" && (
        <>
          <table className="mono" style={{ fontSize: "0.82rem" }}>
            <tbody>
              {ids.map((b) => {
                const p = chart.bodies[b];
                const active = focus?.key === `b-${b}`;
                return (
                  <tr key={b}
                    onClick={p ? () => onToggle(`b-${b}`, withAspectsOf(b)) : undefined}
                    style={p ? { cursor: "pointer", background: active ? "var(--surface-2)" : undefined } : undefined}>
                    <td className="mute" style={cell}>{GLYPHS[b] ? `${GLYPHS[b]} ` : ""}{b}</td>
                    {p ? (
                      <>
                        <td style={cell}>{fmtLon(p.lon)}{p.retrograde ? " ℞" : ""}</td>
                        <td className="mute" style={cell}>h{p.house} {angularity(p.house)}</td>
                      </>
                    ) : (
                      <td className="mute" style={cell} colSpan={2}>n/a</td>
                    )}
                  </tr>
                );
              })}
              <tr><td className="mute" style={cell}>ASC</td><td style={cell}>{fmtLon(chart.angles.asc)}</td><td /></tr>
              <tr><td className="mute" style={cell}>MC</td><td style={cell}>{fmtLon(chart.angles.mc)}</td><td /></tr>
              <tr><td className="mute" style={cell}>Vertex</td><td style={cell}>{fmtLon(chart.angles.vertex)}</td><td /></tr>
              <tr><td className="mute" style={cell}>East Point</td><td style={cell}>{fmtLon(chart.angles.eastPoint)}</td><td /></tr>
            </tbody>
          </table>
          <p className="dim small" style={{ margin: "0.5rem 0 0" }}>Click a planet to isolate it and its aspects on the figure.</p>
        </>
      )}
      {view === "declinations" && decl && <DeclinationTab decl={decl} />}
      {view === "stars" && stars && <StarsTab stars={stars} />}
      {view === "lots" && lotTable && (
        <table className="mono" style={{ fontSize: "0.82rem" }}>
          <tbody>
            {HERMETIC_LOTS.map((k) => (
              <tr key={k}>
                <td className="mute" style={cell}>{k}</td>
                <td style={cell}>{fmtLon(Number(lotTable[k]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {view === "gauquelin" && gaq && (
        <table className="mono" style={{ fontSize: "0.82rem" }}>
          <tbody>
            {gaq.map((r) => (
              <tr key={r.body}>
                <td className="mute" style={cell}>{r.body}</td>
                <td style={cell}>{r.sector == null ? "—" : r.sector.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {view === "phenomena" && phenoRows && (
        <table className="mono" style={{ fontSize: "0.82rem" }}>
          <thead>
            <tr className="mute">
              <td style={cell} /><td style={cell}>az</td><td style={cell}>alt</td>
              <td style={cell}>elong</td><td style={cell}>phase</td><td style={cell}>mag</td>
            </tr>
          </thead>
          <tbody>
            {phenoRows.map((r) => (
              <tr key={r.body}>
                <td className="mute" style={cell}>{r.body}</td>
                <td style={cell}>{r.az.toFixed(1)}°</td>
                <td style={cell}>{r.alt.toFixed(1)}°</td>
                <td style={cell}>{r.ph.elongation.toFixed(1)}°</td>
                <td style={cell}>{r.ph.phase.toFixed(2)}</td>
                <td style={cell}>{r.ph.magnitude.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {view === "heliocentric" && helioRows && (
        <table className="mono" style={{ fontSize: "0.82rem" }}>
          <thead>
            <tr className="mute">
              <td style={cell} /><td style={cell}>lon</td><td style={cell}>lat</td><td style={cell}>AU</td>
            </tr>
          </thead>
          <tbody>
            {helioRows.map((r) => (
              <tr key={r.body}>
                <td className="mute" style={cell}>{r.body}</td>
                <td style={cell}>{fmtLon(r.lon)}</td>
                <td style={cell}>{r.lat.toFixed(2)}°</td>
                <td style={cell}>{r.dist.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {insights && (
        <div style={{ marginTop: "1rem" }}>
          <InsightsTab insights={insights} focus={focus} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

export function VedicPanel({
  engine, chart, natalJd, targetJd, zodiac, advanced, lat, lon,
}: {
  engine: Engine; chart: Chart; natalJd: number; targetJd: number;
  zodiac: Zodiac; advanced: boolean; lat: number; lon: number;
}) {
  const sidZ: Zodiac = zodiac.startsWith("sidereal") ? zodiac : "sidereal:lahiri";
  const moonLon = engine.longitude("moon", natalJd, { zodiac: sidZ });
  const moonNak = nakshatra(moonLon);
  const dasha = vimshottariActive(moonLon, natalJd, targetJd);
  const vm = advanced ? vimshottariDashas(moonLon, natalJd, 2) : null;
  const yg = advanced ? yoginiDashas(moonLon, natalJd, 2) : null;
  const as = advanced ? ashtottariDashas(moonLon, natalJd, 2) : null;
  const yoginiNow = yoginiActive(moonLon, natalJd, targetJd);
  const ashtNow = ashtottariActive(moonLon, natalJd, targetJd);
  const signs: Record<string, number> = {};
  for (const b of CLASSICAL) {
    signs[b] = Math.floor(mod360(engine.longitude(b as BodyId, natalJd, { zodiac: sidZ })) / 30);
  }
  const sidAsc = Math.floor(mod360(
    engine.chartAt(natalJd, lat, lon, { houseSystem: "whole_sign", zodiac: sidZ }).angles.asc,
  ) / 30);
  const d9 = advanced ? vargaAsKundli(engine, natalJd, 9, lat, lon, sidZ) : null;
  const yogas = detectYogas(signs, sidAsc);
  const raja = rajaYogas(signs, sidAsc);
  const dhana = dhanaYogas(signs, sidAsc);
  const kema = kemadruma(signs);
  const vargas = advanced
    ? VARGA_DIVISIONS.map((n) => ({ n, chart: vargaChart(engine, natalJd, n, undefined, sidZ) }))
    : [{ n: 1 as const, chart: vargaChart(engine, natalJd, 1, undefined, sidZ) },
       { n: 9 as const, chart: vargaChart(engine, natalJd, 9, undefined, sidZ) }];

  return (
    <div className="workspace__panel">
      <p className="dim small" style={{ marginTop: 0 }}>
        Moon in {moonNak.name} pada {moonNak.pada}, lord {moonNak.lord}.
        {dasha && <> Vimshottari now: <strong>{dasha.maha}</strong>{dasha.antar && <> › {dasha.antar}</>}{dasha.pratyantar && <> › {dasha.pratyantar}</>}.</>}
      </p>
      {yoginiNow && <p className="dim small">Yogini: {yoginiNow.maha}{yoginiNow.antar && <> › {yoginiNow.antar}</>}</p>}
      {ashtNow && <p className="dim small">Ashtottari: {ashtNow.maha}{ashtNow.antar && <> › {ashtNow.antar}</>}</p>}
      {d9 && (
        <div style={{ margin: "0.7rem 0", maxWidth: 280 }}>
          <p className="dim small">Navamsa (D9)</p>
          <Kundli chart={d9} layout="north" size={280} theme={WHEEL_THEME} />
        </div>
      )}
      <p className="dim small">{yogas.length ? yogas.map((y) => y.yoga).join(", ") : "No listed yogas in this D1."}</p>
      <p className="dim small">
        Raja: {raja.length ? raja.map((y) => y.lords.join("–")).join(", ") : "none"}.
        {" "}Dhana: {dhana.length ? dhana.map((y) => y.lords.join("–")).join(", ") : "none"}.
        {" "}Kemadruma: {kema.present ? "present" : "absent"}.
      </p>
      <table className="mono" style={{ fontSize: "0.82rem" }}>
        <thead>
          <tr className="mute"><td style={cell} /><td style={cell}>nakshatra</td>{vargas.map((v) => <td key={v.n} style={cell}>D{v.n}</td>)}</tr>
        </thead>
        <tbody>
          {BODIES.filter((b) => chart.bodies[b] && b !== "mean_node").map((b) => {
            const lon = engine.longitude(b as BodyId, natalJd, { zodiac: sidZ });
            const nak = nakshatra(lon);
            return (
              <tr key={b}>
                <td className="mute" style={cell}>{GLYPHS[b] ? `${GLYPHS[b]} ` : ""}{b}</td>
                <td style={cell}>{nak.name} p{nak.pada}</td>
                {vargas.map((v) => (
                  <td key={v.n} className="mute" style={cell}>{v.chart[b]?.sign ?? varga(lon, v.n).sign}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {advanced && vm && (
        <DashaTree title="Vimshottari" periods={vm.dashas.map((d) => ({ lord: d.lord, start: d.start, end: d.end, sub: d.sub }))} />
      )}
      {advanced && yg && (
        <DashaTree title="Yogini" periods={yg.dashas.map((d) => ({ lord: d.yogini, start: d.start, end: d.end, sub: d.sub.map((s) => ({ lord: s.yogini, start: s.start, end: s.end })) }))} />
      )}
      {advanced && as && (
        <DashaTree title="Ashtottari" periods={as.dashas.map((d) => ({ lord: d.lord, start: d.start, end: d.end, sub: d.sub }))} />
      )}
    </div>
  );
}

function vargaAsKundli(
  engine: Engine, natalJd: number, n: number, lat: number, lon: number, zodiac: Zodiac,
): WheelChart {
  const sid = engine.chartAt(natalJd, lat, lon, { houseSystem: "whole_sign", zodiac });
  const vc = vargaChart(engine, natalJd, n, undefined, zodiac);
  const bodies: WheelChart["bodies"] = {};
  for (const [b, v] of Object.entries(vc)) bodies[b] = { lon: v.sign_index * 30 + 15 };
  const ascIdx = varga(sid.angles.asc, n).sign_index;
  return {
    bodies,
    angles: { asc: ascIdx * 30 + 15, mc: ((ascIdx + 9) % 12) * 30 + 15 },
    cusps: Array.from({ length: 12 }, (_, i) => ((ascIdx + i) % 12) * 30),
    aspects: [],
  };
}

function mod360(x: number) { return ((x % 360) + 360) % 360; }

function DashaTree({ title, periods }: {
  title: string;
  periods: Array<{ lord: string; start: number; end: number; sub: Array<{ lord: string; start: number; end: number }> }>;
}) {
  return (
    <div style={{ marginTop: "0.8rem" }}>
      <div className="dim small" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
      <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem", margin: "0.3rem 0 0" }}>
        {periods.slice(0, 12).map((d, i) => (
          <li key={i}>
            {d.lord} · {jdToUtc(d.start)} – {jdToUtc(d.end)}
            {d.sub?.length ? (
              <ul>
                {d.sub.slice(0, 3).map((s, j) => (
                  <li key={j}>{s.lord} · {jdToUtc(s.start)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TimingPanel({
  engine, natal, natalJd, targetJd, lat, lon, zodiac, advanced, sys,
  method, setMethod, onSetTarget,
}: {
  engine: Engine; natal: Chart; natalJd: number; targetJd: number;
  lat: number; lon: number; zodiac: Zodiac; advanced: boolean;
  sys: HouseSystem;
  method: ProgressMethod; setMethod: (m: ProgressMethod) => void;
  onSetTarget: (iso: string) => void;
}) {
  const [retBody, setRetBody] = useState<BodyId>("sun");
  const [retLat, setRetLat] = useState(String(lat));
  const [retLon, setRetLon] = useState(String(lon));
  const [whenBody, setWhenBody] = useState<BodyId>("venus");
  const [whenKind, setWhenKind] = useState<"aspect" | "sign" | "retrograde">("aspect");
  const [whenAsp, setWhenAsp] = useState("trine");
  const [whenOther, setWhenOther] = useState<BodyId>("jupiter");
  const [whenSign, setWhenSign] = useState("Taurus");
  const [combo, setCombo] = useState<"none" | "all" | "any" | "not">("none");
  const [zrLot, setZrLot] = useState<"spirit" | "fortune">("spirit");
  const [dirKey, setDirKey] = useState<"naibod" | "ptolemy">("naibod");
  const [showMundane, setShowMundane] = useState(false);
  const [crossBody, setCrossBody] = useState<BodyId>("saturn");
  const [crossNatal, setCrossNatal] = useState<BodyId>("sun");
  const hits = useMemo(() => transitAspects(natal, engine, targetJd, { zodiac }).slice(0, 24), [natal, engine, targetJd, zodiac]);
  const ret = useMemo(() => {
    try { return returns(engine, retBody, natalJd, targetJd - 40, targetJd + 400, zodiac).slice(0, 8); }
    catch { return []; }
  }, [engine, retBody, natalJd, targetJd, zodiac]);
  const retPlace = { lat: Number(retLat) || lat, lon: Number(retLon) || lon };
  const lords = useMemo(() => {
    if (!advanced) return null;
    try {
      const zr = zrAt(engine, natalJd, targetJd, lat, lon, zrLot, zodiac);
      const lotSign = SIGNS.indexOf(zr.lot_sign);
      const timeline = lotSign >= 0
        ? zrRelease(lotSign, natalJd, 4, Math.max(12, (targetJd - natalJd) / 360 + 8))
            .filter((p) => p.level <= 2 && p.start <= targetJd + 360 && p.end >= natalJd)
            .slice(0, 24)
        : [];
      return {
        prof: profectionAt(engine, natalJd, targetJd, lat, lon, zodiac),
        fir: firdariaAt(engine, natalJd, targetJd, lat, lon),
        zr, timeline,
        pd: primaryDirections(engine, natalJd, lat, lon, undefined, dirKey).slice(0, 20),
        mund: showMundane ? mundaneDirections(engine, natalJd, lat, lon, undefined, dirKey).slice(0, 12) : [],
      };
    } catch { return null; }
  }, [advanced, engine, natalJd, targetJd, lat, lon, zodiac, zrLot, dirKey, showMundane]);
  const eph = useMemo(() => {
    if (!advanced) return null;
    try {
      return ephemeris(engine, ["sun", "mercury", "venus", "mars", "jupiter", "saturn"], {
        start: targetJd - 60, end: targetJd + 60, step: 2, zodiac,
      });
    } catch { return null; }
  }, [advanced, engine, targetJd, zodiac]);
  const finder = useMemo(() => {
    if (!advanced) return null;
    try {
      const base = whenKind === "sign" ? inSign(whenBody, whenSign, zodiac)
        : whenKind === "retrograde" ? retrograde(whenBody, zodiac)
        : aspect(whenBody, whenAsp, whenOther, 1, zodiac);
      const pred = combo === "all" ? allOf(base, notOf(retrograde(whenBody, zodiac)))
        : combo === "any" ? anyOf(base, inSign(whenBody, whenSign, zodiac))
        : combo === "not" ? notOf(base)
        : base;
      return when(engine, pred, targetJd - 90, targetJd + 180).slice(0, 12);
    } catch { return []; }
  }, [advanced, engine, whenKind, whenBody, whenSign, whenAsp, whenOther, combo, targetJd, zodiac]);
  const exact = useMemo(() => {
    if (!advanced) return null;
    try {
      const natalLon = natal.bodies[crossNatal]?.lon;
      const crosses = natalLon == null ? []
        : crossings(engine, crossBody, natalLon, targetJd - 10, targetJd + 400, zodiac, 6);
      const toBody = when(engine, aspect(crossBody, "conjunction", crossNatal, 1, zodiac), targetJd - 10, targetJd + 400).slice(0, 6);
      return { crosses, toBody };
    } catch { return null; }
  }, [advanced, engine, natal, crossBody, crossNatal, targetJd, zodiac]);
  const sky = useMemo(() => {
    if (!advanced) return null;
    try {
      const rise = (body: BodyId, kind: "rise" | "set" | "mtransit") =>
        riseSet(engine, body, targetJd - 0.7, lat, lon, kind);
      const phases = lunarPhases(engine, targetJd - 10, targetJd + 80).slice(0, 6);
      const st = ["mercury", "venus", "mars"].flatMap((b) =>
        stations(engine, b as BodyId, targetJd - 40, targetJd + 80, 2).map(([jd, dir]) => ({ body: b, jd, dir })),
      );
      const sol = solarEclipses(engine, targetJd - 20, targetJd + 400).slice(0, 2).map((e) => {
        const local = solarEclipseLocal(engine, e.tMax, lat, lon);
        const where = solarEclipseWhere(engine, e.tMax);
        const path = solarEclipseLimits(engine, e.tMax);
        return { e, local, where, path };
      });
      const lun = lunarEclipses(engine, targetJd - 20, targetJd + 400).slice(0, 2).map((e) => ({
        e, local: lunarEclipseLocal(engine, e.tMax, lat, lon),
      }));
      return {
        sunRise: rise("sun", "rise"), sunSet: rise("sun", "set"), sunMer: rise("sun", "mtransit"),
        moonRise: rise("moon", "rise"), moonSet: rise("moon", "set"),
        phases, st, sol, lun,
      };
    } catch { return null; }
  }, [advanced, engine, targetJd, lat, lon]);

  return (
    <div className="workspace__panel">
      <div className="seg" role="group" aria-label="Progression method" style={{ marginBottom: "0.6rem" }}>
        {(["secondary", "solar-arc"] as const).map((m) => (
          <button key={m} type="button" className="seg__btn" aria-pressed={method === m} onClick={() => setMethod(m)}>
            {m === "secondary" ? "Secondary" : "Solar arc"}
          </button>
        ))}
      </div>
      <p className="dim small" style={{ marginTop: 0 }}>
        Secondary progressions follow the day-for-a-year key. Solar arc adds the progressed Sun's motion to every natal longitude.
      </p>
      <p className="dim small">Transits at the scrubber date:</p>
      <ul className="mono" style={{ fontSize: "0.82rem", paddingLeft: "1.1rem" }}>
        {hits.map((h, i) => (
          <li key={i}>{h.transit} {h.aspect} natal {h.natal} <span className="mute">(orb {h.orb}° {h.phase})</span></li>
        ))}
      </ul>
      <div className="controls" style={{ marginTop: "0.6rem" }}>
        <div className="field">
          <span className="field__label">returns of</span>
          <select className="control" value={retBody} onChange={(e) => setRetBody(e.target.value as BodyId)}>
            {BODIES.filter((b) => b !== "mean_node").map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field__label">return lat</span>
          <input className="control" style={{ width: "5.5rem" }} value={retLat} onChange={(e) => setRetLat(e.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">return lon</span>
          <input className="control" style={{ width: "5.5rem" }} value={retLon} onChange={(e) => setRetLon(e.target.value)} />
        </div>
      </div>
      <ul className="mono" style={{ fontSize: "0.82rem", paddingLeft: "1.1rem" }}>
        {ret.map((jd) => {
          let stamp = "";
          try {
            const c = engine.chartAt(jd, retPlace.lat, retPlace.lon, { houseSystem: sys, zodiac });
            stamp = ` · ASC ${fmtLon(c.angles.asc)}`;
          } catch { /* skip */ }
          return (
            <li key={jd}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSetTarget(isoFromJd(jd))}>
                {jdToUtc(jd)} UT
              </button>
              {stamp}
            </li>
          );
        })}
      </ul>
      {lords && (
        <div style={{ marginTop: "0.8rem" }}>
          <div className="seg" role="group" aria-label="Zodiacal releasing lot" style={{ marginBottom: "0.4rem" }}>
            {(["spirit", "fortune"] as const).map((lot) => (
              <button key={lot} type="button" className="seg__btn" aria-pressed={zrLot === lot} onClick={() => setZrLot(lot)}>
                ZR {lot}
              </button>
            ))}
          </div>
          <p className="dim small">
            Profection: annual {lords.prof.annual.sign} · month {lords.prof.monthly.sign}.
            Firdaria: {lords.fir.major}{lords.fir.sub && <> › {lords.fir.sub}</>}.
            ZR {lords.zr.lot}: {lords.zr.l1}{lords.zr.l2 && <> › {lords.zr.l2}</>}{lords.zr.l3 && <> › {lords.zr.l3}</>}{lords.zr.l4 && <> › {lords.zr.l4}</>}.
          </p>
          {lords.timeline.length > 0 && (
            <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
              {lords.timeline.map((p, i) => (
                <li key={i}>
                  L{p.level} {p.sign} {p.lord}{p.lb ? " · loosing the bond" : ""} · {jdToUtc(p.start)}
                </li>
              ))}
            </ul>
          )}
          <div className="controls" style={{ marginTop: "0.5rem" }}>
            <div className="field">
              <span className="field__label">direction key</span>
              <select className="control" value={dirKey} onChange={(e) => setDirKey(e.target.value as "naibod" | "ptolemy")}>
                <option value="naibod">Naibod</option>
                <option value="ptolemy">Ptolemy</option>
              </select>
            </div>
            <label className="field">
              <span className="field__label">
                <input type="checkbox" checked={showMundane} onChange={(e) => setShowMundane(e.target.checked)}
                  style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
                mundane
              </span>
            </label>
          </div>
          <p className="dim small">Primary directions ({dirKey}, years):</p>
          <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
            {lords.pd.map((d, i) => (
              <li key={i}>{d.body} to {d.angle} · {d.years.toFixed(1)}y · {jdToUtc(d.jd)}</li>
            ))}
          </ul>
          {showMundane && lords.mund.length > 0 && (
            <>
              <p className="dim small">Mundane directions:</p>
              <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
                {lords.mund.map((d, i) => (
                  <li key={i}>{d.promissor} → {d.significator} · {d.years.toFixed(1)}y · {jdToUtc(d.jd)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {advanced && (
        <>
          <div className="controls" style={{ marginTop: "0.7rem" }}>
            <div className="field">
              <span className="field__label">when</span>
              <select className="control" value={whenKind} onChange={(e) => setWhenKind(e.target.value as typeof whenKind)}>
                <option value="aspect">aspect</option>
                <option value="sign">sign</option>
                <option value="retrograde">retrograde</option>
              </select>
            </div>
            <div className="field">
              <span className="field__label">body</span>
              <select className="control" value={whenBody} onChange={(e) => setWhenBody(e.target.value as BodyId)}>
                {BODIES.slice(0, 10).map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            {whenKind === "aspect" && (
              <>
                <div className="field">
                  <span className="field__label">aspect</span>
                  <select className="control" value={whenAsp} onChange={(e) => setWhenAsp(e.target.value)}>
                    {["conjunction", "sextile", "square", "trine", "opposition"].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field">
                  <span className="field__label">to</span>
                  <select className="control" value={whenOther} onChange={(e) => setWhenOther(e.target.value as BodyId)}>
                    {BODIES.slice(0, 10).map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </>
            )}
            {whenKind === "sign" && (
              <div className="field">
                <span className="field__label">sign</span>
                <select className="control" value={whenSign} onChange={(e) => setWhenSign(e.target.value)}>
                  {SIGNS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <span className="field__label">combine</span>
              <select className="control" value={combo} onChange={(e) => setCombo(e.target.value as typeof combo)}>
                <option value="none">single</option>
                <option value="all">all of (and not retrograde)</option>
                <option value="any">any of (or in sign)</option>
                <option value="not">not</option>
              </select>
            </div>
          </div>
          {finder && (
            <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
              {finder.map(([a, b], i) => (
                <li key={i}>{jdToUtc(a)} → {jdToUtc(b)}</li>
              ))}
            </ul>
          )}
          <div className="controls" style={{ marginTop: "0.6rem" }}>
            <div className="field">
              <span className="field__label">transit</span>
              <select className="control" value={crossBody} onChange={(e) => setCrossBody(e.target.value as BodyId)}>
                {BODIES.slice(0, 10).map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="field__label">to natal</span>
              <select className="control" value={crossNatal} onChange={(e) => setCrossNatal(e.target.value as BodyId)}>
                {BODIES.slice(0, 10).map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          {exact && (
            <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
              {exact.crosses.map((jd) => (
                <li key={jd}>{crossBody} crosses natal {crossNatal} · {jdToUtc(jd)} UT</li>
              ))}
              {exact.toBody.map(([a], i) => (
                <li key={`w${i}`}>{crossBody} conjunct {crossNatal} · {jdToUtc(a)} UT</li>
              ))}
            </ul>
          )}
          {eph && (
            <div style={{ marginTop: "0.8rem" }}>
              <p className="dim small">Graphic ephemeris, ±60 days from the scrubber (longitude).</p>
              <EphemerisGraph series={eph} width={480} height={220} wrap={360} theme={WHEEL_THEME} colors={WHEEL_LINE_COLORS} />
            </div>
          )}
          {sky && (
            <div style={{ marginTop: "0.8rem" }}>
              <p className="dim small">Rise, set, and meridian at the birthplace:</p>
              <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
                {sky.sunRise && <li>Sun rise {jdToUtc(sky.sunRise)} UT</li>}
                {sky.sunMer && <li>Sun meridian {jdToUtc(sky.sunMer)} UT</li>}
                {sky.sunSet && <li>Sun set {jdToUtc(sky.sunSet)} UT</li>}
                {sky.moonRise && <li>Moon rise {jdToUtc(sky.moonRise)} UT</li>}
                {sky.moonSet && <li>Moon set {jdToUtc(sky.moonSet)} UT</li>}
              </ul>
              <p className="dim small">Sky events near the scrubber date:</p>
              <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
                {sky.phases.map(([jd, name], i) => (
                  <li key={`p${i}`}>{PHASE_LABEL[name] ?? name} · {jdToUtc(jd)} UT</li>
                ))}
                {sky.st.map((s, i) => (
                  <li key={`s${i}`}>{s.body} stations {s.dir} · {jdToUtc(s.jd)} UT</li>
                ))}
                {sky.sol.map((row, i) => (
                  <li key={`so${i}`}>
                    Solar eclipse {row.e.type} · {jdToUtc(row.e.tMax)} UT
                    {row.local.type !== "none" ? ` · here ${row.local.type} mag ${row.local.magnitude.toFixed(2)}` : " · not visible here"}
                    {row.where ? ` · greatest at ${row.where.lat.toFixed(1)}°, ${row.where.lonEast.toFixed(1)}°` : ""}
                    {row.path?.widthKm != null ? ` · path ${row.path.widthKm.toFixed(0)} km` : ""}
                  </li>
                ))}
                {sky.lun.map((row, i) => (
                  <li key={`lu${i}`}>
                    Lunar eclipse {row.e.type} · {jdToUtc(row.e.tMax)} UT
                    {row.local.visible ? ` · Moon altitude ${row.local.altitude.toFixed(0)}°` : " · Moon below the horizon"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ComposePanel({
  engine, natal, natalJd, lat, lon, zodiac, constraints, setConstraints, formName,
}: {
  engine: Engine; natal: Chart | null; natalJd: number | null; lat: number; lon: number;
  zodiac: Zodiac; constraints: Constraint[]; setConstraints: (c: Constraint[]) => void;
  formName?: string;
}) {
  const compiled = useMemo(() => compileForm(constraints), [constraints]);
  const similar = useMemo(() => {
    if (!natalJd) return null;
    try {
      const target = chartFeatures(engine, natalJd, { zodiac });
      return searchConfigurations(engine, target, {
        start: natalJd + 365, end: natalJd + 365 * 3, step: 10, limit: 6, zodiac,
      });
    } catch { return null; }
  }, [engine, natalJd, zodiac]);
  const [shiftH, setShiftH] = useState("1");
  const [cfLat, setCfLat] = useState(String(lat));
  const [cfLon, setCfLon] = useState(String(lon));
  const [moveBody, setMoveBody] = useState<BodyId>("mars");
  const [moveLon, setMoveLon] = useState("");
  const cf = useMemo(() => {
    if (!natal || natalJd == null) return null;
    try {
      const hours = Number(shiftH) || 0;
      const placeLat = Number(cfLat);
      const placeLon = Number(cfLon);
      const edit: Parameters<typeof counterfactual>[2] = {};
      if (hours) edit.shiftTime = `${hours}h`;
      if (Number.isFinite(placeLat) && Number.isFinite(placeLon)
          && (placeLat !== lat || placeLon !== lon)) {
        edit.place = { lat: placeLat, lonEast: placeLon };
      }
      const lonVal = Number(moveLon);
      if (Number.isFinite(lonVal) && moveLon.trim() !== "") {
        edit.setLongitudes = { [moveBody]: lonVal };
      }
      return counterfactual(engine, {
        realm: "counterfactual",
        when: { kind: "instant", utc: `${isoFromJd(natalJd)}:00Z` },
        where: { kind: "geo", lat, lonEast: lon },
      }, edit, {}, { zodiac });
    } catch { return null; }
  }, [engine, natal, natalJd, lat, lon, zodiac, shiftH, cfLat, cfLon, moveBody, moveLon]);
  const diff = cf?.diff ?? null;

  const add = (c: Constraint) => setConstraints([...constraints, c]);
  const remove = (i: number) => setConstraints(constraints.filter((_, j) => j !== i));

  return (
    <div className="workspace__panel">
      {formName && <p className="dim small" style={{ marginTop: 0 }}>{formName}</p>}
      <p className="dim small" style={{ marginTop: 0 }}>
        A form has no instant and no houses. Residual says how far the longitudes sit from the constraints.
      </p>
      <ul className="mono" style={{ fontSize: "0.82rem", paddingLeft: "1.1rem" }}>
        {constraints.map((c, i) => (
          <li key={i}>
            {c.kind === "sign" && `${c.body} in ${SIGNS[c.sign]}`}
            {c.kind === "aspect" && `${c.a} ${c.angle}° ${c.b}`}
            {c.kind === "degree" && `${c.body} at ${c.degree}°`}
            {c.kind === "declination" && `${c.body} decl ${c.degree}°`}
            {c.kind === "parallel" && `${c.a} ${c.contra ? "contra-" : ""}parallel ${c.b}`}
            {c.kind === "separation3d" && `${c.a} 3d ${c.angle}° ${c.b}`}
            {" "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(i)} aria-label="remove constraint">×</button>
          </li>
        ))}
      </ul>
      <div className="controls">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "sign", body: "sun", sign: 0 })}>Add sign</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "aspect", a: "venus", b: "mars", angle: 120 })}>Add aspect</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "degree", body: "moon", degree: 15 })}>Add degree</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "declination", body: "moon", degree: 0 })}>Add declination</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "parallel", a: "sun", b: "moon" })}>Add parallel</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add({ kind: "separation3d", a: "sun", b: "moon", angle: 90 })}>Add 3d separation</button>
      </div>
      <p className="dim small">
        Residual {compiled.residual.toFixed(2)}° · max constraint {compiled.maxConstraintLoss.toFixed(2)}°
        {compiled.impossible ? " · geometrically impossible" : ""}.
      </p>
      <table className="mono" style={{ fontSize: "0.82rem" }}>
        <tbody>
          {Object.entries(compiled.longitudes).map(([b, lon]) => (
            <tr key={b}><td className="mute" style={cell}>{b}</td><td style={cell}>{fmtLon(lon)}</td></tr>
          ))}
        </tbody>
      </table>
      {similar && similar.length > 0 && (
        <>
          <p className="dim small">Similar skies (feature match, two years after the birth, 10-day step):</p>
          <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
            {similar.map((m) => (
              <li key={m.jd}>{jdToUtc(m.jd)} UT · similarity {m.score.toFixed(3)}</li>
            ))}
          </ul>
        </>
      )}
      {natal && natalJd != null && (
        <>
          <p className="dim small" style={{ marginTop: "0.8rem" }}>What if: shift the hour, the place, or a longitude.</p>
          <div className="controls">
            <div className="field">
              <span className="field__label">hours</span>
              <input className="control" style={{ width: "5rem" }} value={shiftH} onChange={(e) => setShiftH(e.target.value)} />
            </div>
            <div className="field">
              <span className="field__label">place lat</span>
              <input className="control" style={{ width: "5.5rem" }} value={cfLat} onChange={(e) => setCfLat(e.target.value)} />
            </div>
            <div className="field">
              <span className="field__label">place lon</span>
              <input className="control" style={{ width: "5.5rem" }} value={cfLon} onChange={(e) => setCfLon(e.target.value)} />
            </div>
            <div className="field">
              <span className="field__label">move</span>
              <select className="control" value={moveBody} onChange={(e) => setMoveBody(e.target.value as BodyId)}>
                {BODIES.slice(0, 10).map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="field__label">to lon</span>
              <input className="control" style={{ width: "5rem" }} value={moveLon} onChange={(e) => setMoveLon(e.target.value)} placeholder="deg" />
            </div>
          </div>
          {diff && (
            <ul style={{ fontSize: "0.82rem", paddingLeft: "1.1rem" }}>
              {diff.bodies.map((b) => (
                <li key={b.body} className={b.houseTo !== b.houseFrom ? "diff-loss" : undefined}>
                  {b.body}: {b.signFrom} h{b.houseFrom} → {b.signTo} h{b.houseTo}
                </li>
              ))}
              {diff.aspectsGained.map((a, i) => (
                <li key={`g${i}`} className="diff-gain">gained {a.a} {a.aspect} {a.b}</li>
              ))}
              {diff.aspectsLost.map((a, i) => (
                <li key={`l${i}`} className="diff-loss">lost {a.a} {a.aspect} {a.b}</li>
              ))}
              {diff.angles.map((a, i) => (
                <li key={`a${i}`}>{a.angle}: {a.from} → {a.to}</li>
              ))}
              {diff.bodies.length + diff.aspectsGained.length + diff.aspectsLost.length + diff.angles.length === 0 && (
                <li className="dim">No sign, house, or aspect change.</li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function RectifyPanel({
  windows, knownRising, setKnownRising, stepMin, setStepMin,
  win0, setWin0, win1, setWin1, onPreview, onApply, previewSign,
  events, setEvents, engine, lat, lon, zodiac, advanced,
}: {
  windows: Array<{ sign: number; signName: string; startJd: number; endJd: number; midJd: number; ascMid: number; mcMid: number }>;
  knownRising: number | ""; setKnownRising: (v: number | "") => void;
  stepMin: number; setStepMin: (n: number) => void;
  win0: number; setWin0: (n: number) => void;
  win1: number; setWin1: (n: number) => void;
  onPreview: (w: (typeof windows)[0]) => void;
  onApply: (w: (typeof windows)[0]) => void;
  previewSign: number | null;
  events: Array<{ date: string; note: string }>;
  setEvents: (e: Array<{ date: string; note: string }>) => void;
  engine: Engine; lat: number; lon: number; zodiac: Zodiac; advanced: boolean;
}) {
  const shown = knownRising === "" ? windows : windows.filter((w) => w.sign === knownRising);
  return (
    <div className="workspace__panel">
      <p className="dim small" style={{ marginTop: 0 }}>
        Time unknown. Each chip is a rising-sign window for this date and place.
      </p>
      {advanced && (
        <div className="controls">
          <div className="field">
            <span className="field__label">step (min)</span>
            <input className="control" style={{ width: "4rem" }} type="number" value={stepMin}
              onChange={(e) => setStepMin(Number(e.target.value) || 20)} />
          </div>
          <div className="field">
            <span className="field__label">UTC hours</span>
            <input className="control" style={{ width: "3.5rem" }} type="number" value={win0} onChange={(e) => setWin0(Number(e.target.value))} />
            <span className="mute">–</span>
            <input className="control" style={{ width: "3.5rem" }} type="number" value={win1} onChange={(e) => setWin1(Number(e.target.value))} />
          </div>
        </div>
      )}
      <div className="field">
        <span className="field__label">known rising (optional)</span>
        <select className="control" value={knownRising === "" ? "" : String(knownRising)}
          onChange={(e) => setKnownRising(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">any</option>
          {SIGNS.map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select>
      </div>
      <div className="rising-chips" style={{ marginTop: "0.5rem" }}>
        {shown.map((w) => (
          <button key={w.sign + String(w.startJd)} type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={previewSign === w.sign}
            onClick={() => onPreview(w)}>
            {w.signName} · {jdToUtc(w.startJd).slice(11, 16)}–{jdToUtc(w.endJd).slice(11, 16)}
          </button>
        ))}
      </div>
      {previewSign != null && shown.find((w) => w.sign === previewSign) && (
        <p className="dim small">
          ASC {fmtLon(shown.find((w) => w.sign === previewSign)!.ascMid)} · MC {fmtLon(shown.find((w) => w.sign === previewSign)!.mcMid)} at window midpoint.
          {" "}
          <button type="button" className="btn btn-sm" onClick={() => onApply(shown.find((w) => w.sign === previewSign)!)}>
            Apply this time
          </button>
        </p>
      )}
      {advanced && (
        <>
          <p className="dim small">Dated events (optional). Hits to the candidate ASC/MC are listed; pick the window yourself.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEvents([...events, { date: "2010-01-01", note: "" }])}>
            Add event
          </button>
          {events.map((ev, i) => (
            <div key={i} className="controls">
              <input className="control" type="date" value={ev.date}
                onChange={(e) => setEvents(events.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
              <input className="control" placeholder="note" value={ev.note}
                onChange={(e) => setEvents(events.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
            </div>
          ))}
          {previewSign != null && events.length > 0 && (
            <EventHits engine={engine} windows={shown.filter((w) => w.sign === previewSign)} events={events} lat={lat} lon={lon} zodiac={zodiac} />
          )}
        </>
      )}
    </div>
  );
}

function EventHits({
  engine, windows, events, lat, lon, zodiac,
}: {
  engine: Engine; windows: Array<{ midJd: number; ascMid: number; mcMid: number; signName: string }>;
  events: Array<{ date: string }>; lat: number; lon: number; zodiac: Zodiac;
}) {
  const w = windows[0];
  if (!w) return null;
  const natal = engine.chartAt(w.midJd, lat, lon, { houseSystem: "whole_sign", zodiac });
  return (
    <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
      {events.map((ev, i) => {
        const jd = jdFromIso(ev.date + "T12:00");
        const hits = transitAspects(natal, engine, jd, { zodiac, maxOrb: 2 }).slice(0, 8);
        return (
          <li key={i}>
            {ev.date}: {hits.length ? hits.map((h) => `${h.transit} ${h.aspect} ${h.natal}`).join("; ") : "no tight hits"}
          </li>
        );
      })}
    </ul>
  );
}

export function ComparePanel({
  engine, natal, set, loadShare, advanced, lat, lon, sys, zodiac,
}: {
  engine: Engine; natal: Chart; set: Share[]; loadShare: (s: Share) => void;
  advanced: boolean; lat: number; lon: number; sys: string; zodiac: Zodiac;
}) {
  const births = set.filter((s): s is BirthShare => s.v !== 2 && "t" in s);
  const [idx, setIdx] = useState(0);
  const other = births[idx] ?? births[0];
  const bChart = useMemo(() => {
    if (!other) return null;
    try {
      const d = new Date(other.t + ":00Z");
      return engine.chart(
        d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(), 0,
        Number(other.la), Number(other.lo),
        { houseSystem: other.h, zodiac: other.z },
      );
    } catch { return null; }
  }, [engine, other]);
  const inter = useMemo(() => {
    if (!bChart) return [];
    return synastryAspects(natal, bChart).slice(0, 16);
  }, [natal, bChart]);
  const composite = useMemo(() => {
    if (!advanced || !bChart || !other) return null;
    try {
      const bodies = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as BodyId[];
      const places = compositePlacements(engine, natal.jdUt, bChart.jdUt, bodies, zodiac);
      const lons = compositeLongitudes(engine, natal.jdUt, bChart.jdUt, bodies, zodiac);
      const asc = midpointLon(natal.angles.asc, bChart.angles.asc);
      const mc = midpointLon(natal.angles.mc, bChart.angles.mc);
      const wheelBodies: WheelChart["bodies"] = {};
      for (const p of places) wheelBodies[p.body] = { lon: p.lon };
      const cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
      const aspects = findAspects(
        Object.fromEntries(Object.entries(wheelBodies).map(([k, v]) => [k, { lon: v!.lon }])) as Parameters<typeof findAspects>[0],
      );
      const wheel: WheelChart = { bodies: wheelBodies, angles: { asc, mc }, cusps, aspects };
      const [dJd, dLat, dLon] = davisonParams(natal.jdUt, bChart.jdUt, lat, lon, Number(other.la), Number(other.lo));
      const dav = engine.chartAt(dJd, dLat, dLon, { zodiac });
      return { lons, wheel, dav, dJd };
    } catch { return null; }
  }, [advanced, bChart, engine, natal, lat, lon, other, zodiac]);
  const overlays = useMemo(() => (bChart ? synastryOverlays(natal, bChart) : null), [natal, bChart]);
  const contacts: SynContact[] = inter.map((h) => ({ aBody: h.a, bBody: h.b, aspect: h.aspect, orb: h.orb }));

  if (births.length < 1) {
    return <p className="dim small">Add a second birth to My charts, then compare.</p>;
  }
  return (
    <div className="workspace__panel">
      <div className="field">
        <span className="field__label">other chart</span>
        <select className="control" value={String(idx)} onChange={(e) => setIdx(Number(e.target.value))}>
          {births.map((s, i) => <option key={i} value={i}>{s.n || `Chart ${i + 1}`}</option>)}
        </select>
      </div>
      <p className="dim small">
        {inter.slice(0, 4).map((h) => `${h.a} ${h.aspect} ${h.b}`).join(" · ") || "No tight inter-chart aspects."}
      </p>
      {advanced && bChart && (
        <>
          <BiWheel inner={natal} outer={bChart} contacts={contacts} size={380} innerLabel="natal" outerLabel="other" />
          {overlays && (
            <>
              <p className="dim small">Natal bodies in the other chart's houses:</p>
              <p className="mono small">{Object.entries(overlays.aInB).map(([b, h]) => `${b} h${h}`).join(" · ")}</p>
              <p className="dim small">Other bodies in the natal houses:</p>
              <p className="mono small">{Object.entries(overlays.bInA).map(([b, h]) => `${b} h${h}`).join(" · ")}</p>
            </>
          )}
          <p className="dim small">Inter-chart hits:</p>
          <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
            {inter.map((h, i) => <li key={i}>{h.a} {h.aspect} {h.b} (orb {h.orb}°)</li>)}
          </ul>
          {composite && (
            <>
              <p className="dim small">Composite (midpoint longitudes and angles):</p>
              <ChartWheel chart={composite.wheel} size={320} theme={WHEEL_THEME} />
              <p className="dim small">Davison {jdToUtc(composite.dJd)} UT · ASC {fmtLon(composite.dav.angles.asc)}</p>
              <ChartWheel chart={composite.dav} size={320} theme={WHEEL_THEME} />
            </>
          )}
        </>
      )}
      <p className="dim small">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadShare(other)}>Load the other birth</button>
      </p>
    </div>
  );
}

export function ElectionalPanel({
  engine, targetJd, lat, lon, zodiac,
}: {
  engine: Engine; targetJd: number; lat: number; lon: number; zodiac: Zodiac;
}) {
  const [a, setA] = useState<BodyId>("venus");
  const [b, setB] = useState<BodyId>("jupiter");
  const [wanted, setWanted] = useState("trine");
  const [vocPenalty, setVocPenalty] = useState(true);
  const prim = useMemo(() => {
    try {
      return {
        voc: voidOfCourse(engine, targetJd, zodiac),
        hour: planetaryHour(engine, targetJd, lat, lon),
        hours: hoursOfDay(engine, targetJd, lat, lon),
        phases: CLASSICAL.filter((p) => p !== "sun").map((p) => ({
          body: p, phase: solarPhase(engine, p, targetJd, zodiac),
        })).filter((x) => x.phase),
      };
    } catch { return null; }
  }, [engine, targetJd, lat, lon, zodiac]);
  const ranked = useMemo(() => {
    try {
      return rankMoments(
        { start: targetJd, end: targetJd + 7, step: 6 / 24, limit: 8 },
        (jd) => {
          let score = 0;
          const m = aspectBetween(engine, a, b, jd, zodiac);
          if (m && (m.aspect === wanted || (wanted === "soft" && (m.aspect === "trine" || m.aspect === "sextile" || m.aspect === "conjunction")))) {
            score += Math.max(0, 1 - Math.abs(m.orb) / (DEFAULT_ORBS[m.aspect] ?? 6));
            if (m.phase === "applying") score += 0.3;
          }
          if (vocPenalty && voidOfCourse(engine, jd, zodiac).isVoid) score -= 1;
          try {
            const c = engine.chartAt(jd, lat, lon, { zodiac });
            const moon = c.bodies.moon;
            if (moon && angularity(moon.house) === "angular") score += 0.4;
          } catch { /* skip */ }
          return score;
        },
      ).map((m) => {
        let ang = "";
        try {
          const c = engine.chartAt(m.jd, lat, lon, { zodiac });
          const moon = c.bodies.moon;
          if (moon) ang = angularity(moon.house);
        } catch { /* skip */ }
        return { ...m, ang };
      });
    } catch { return []; }
  }, [engine, targetJd, zodiac, a, b, wanted, vocPenalty, lat, lon]);

  return (
    <div className="workspace__panel">
      <p className="dim small" style={{ marginTop: 0 }}>
        Rank a week of instants for a wanted aspect. Void Moon is a penalty when checked; the Moon's house at each candidate is listed.
      </p>
      <div className="controls">
        <div className="field">
          <span className="field__label">wanted</span>
          <select className="control" value={a} onChange={(e) => setA(e.target.value as BodyId)}>
            {CLASSICAL.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field__label">aspect</span>
          <select className="control" value={wanted} onChange={(e) => setWanted(e.target.value)}>
            {["conjunction", "sextile", "square", "trine", "opposition"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field__label">to</span>
          <select className="control" value={b} onChange={(e) => setB(e.target.value as BodyId)}>
            {CLASSICAL.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <label className="field">
          <span className="field__label">
            <input type="checkbox" checked={vocPenalty} onChange={(e) => setVocPenalty(e.target.checked)}
              style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
            VOC penalty
          </span>
        </label>
      </div>
      {prim && (
        <>
          <p className="dim small">
            Hour: {prim.hour ? `${prim.hour.ruler} (${prim.hour.kind} ${prim.hour.hour})` : "n/a"}.
            Moon {prim.voc.isVoid ? "void of course" : `in ${prim.voc.sign}`}.
            {prim.phases.length ? " " + prim.phases.map((p) => `${p.body} ${p.phase}`).join(", ") + "." : ""}
          </p>
          {prim.hours.length > 0 && (
            <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem", columns: 2 }}>
              {prim.hours.map((h) => (
                <li key={h.hour}>{h.hour} {h.kind} {h.ruler} · {jdToUtc(h.start).slice(11, 16)}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <ul className="mono" style={{ fontSize: "0.78rem", paddingLeft: "1.1rem" }}>
        {ranked.map((m) => (
          <li key={m.jd}>{jdToUtc(m.jd)} UT · score {m.score.toFixed(2)}{m.ang ? ` · Moon ${m.ang}` : ""}</li>
        ))}
      </ul>
    </div>
  );
}

export function SyntheticPanel({
  engine, natalJd, onRegistered,
}: {
  engine: Engine; natalJd: number; onRegistered: (id: string) => void;
}) {
  const [id, setId] = useState("nemesis");
  const [period, setPeriod] = useState("365.25");
  const [msg, setMsg] = useState("");
  return (
    <div className="workspace__panel">
      <p className="dim small" style={{ marginTop: 0 }}>
        Register a periodic body. Sky View includes it once registered.
      </p>
      <div className="controls">
        <div className="field">
          <span className="field__label">id</span>
          <input className="control" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">period (days)</span>
          <input className="control" style={{ width: "6rem" }} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
          try {
            registerSyntheticSystem(engine, {
              id,
              bodies: [{ id, mode: "periodic", periodDays: Number(period) || 365.25, phaseDeg: 0, epoch: natalJd }],
            });
            onRegistered(id);
            setMsg(`Registered ${id}.`);
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}>Register</button>
      </div>
      {msg && <p className="dim small">{msg}</p>}
    </div>
  );
}

export function JsonPanel({ chart, advanced }: { chart: Chart; advanced: boolean }) {
  const digest = useMemo(() => {
    if (!advanced) return null;
    try { return chartDigest(chart); }
    catch { return null; }
  }, [chart, advanced]);
  return (
    <div className="workspace__panel">
      {digest && <p className="mono small">digest {digest}</p>}
      <pre style={{ fontSize: "0.72rem", margin: 0 }}>{JSON.stringify(chart, null, 2)}</pre>
    </div>
  );
}

export function HarmonicNote({ n }: { n: number }) {
  return <p className="dim small">Harmonic {n}: longitudes × {n}, Aries-fixed for the figure.</p>;
}

export function AntisciaNote() {
  return <p className="dim small">Antiscia across the Cancer–Capricorn axis; contra-antiscia across Aries–Libra. The figure shows antiscion longitudes.</p>;
}

export function heliocentricWheel(engine: Engine, jd: number): WheelChart {
  const bodies: WheelChart["bodies"] = {};
  for (const b of HELIO_BODIES) {
    try {
      const p = engine.heliocentric(b, jd);
      bodies[b] = { lon: p.lon };
    } catch { /* skip bodies without a heliocentric solution */ }
  }
  const aspects = findAspects(
    Object.fromEntries(Object.entries(bodies).map(([k, v]) => [k, { lon: v!.lon }])) as Parameters<typeof findAspects>[0],
  );
  return {
    bodies,
    angles: { asc: 0, mc: 90 },
    cusps: Array.from({ length: 12 }, (_, i) => i * 30),
    aspects,
  };
}

export function harmonicWheel(engine: Engine, jd: number, n: number, natal: Chart, zodiac: Zodiac) {
  const lons = harmonicChart(engine, jd, BODIES.filter((b) => natal.bodies[b]) as BodyId[], n, zodiac);
  const bodies = Object.fromEntries(Object.entries(lons).map(([k, lon]) => [k, { lon }]));
  return {
    bodies,
    angles: { asc: 0, mc: 90 },
    cusps: Array.from({ length: 12 }, (_, i) => i * 30),
    aspects: natal.aspects,
  };
}

export function antisciaWheel(natal: Chart, contra = false) {
  const fn = contra ? contraAntiscion : antiscion;
  const bodies = Object.fromEntries(
    Object.entries(natal.bodies).filter(([, p]) => p).map(([k, p]) => [k, { lon: fn(p!.lon) }]),
  );
  return {
    bodies,
    angles: { asc: fn(natal.angles.asc), mc: fn(natal.angles.mc) },
    cusps: natal.cusps.map(fn),
    aspects: natal.aspects,
  };
}
