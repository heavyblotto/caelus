"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import {
  Engine, BODIES, EXTRA_BODIES, fmtLon, julianDay, detectPatternsIn,
  voidOfCourse, planetaryHour, transitAspects, progressedJd, solarArc,
  compileForm, stations, DEFAULT_ORBS,
  type BodyId, type Chart, type Constraint, type EngineData, type HouseSystem, type Zodiac,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT, type UTResult } from "caelus-birth";
import { ChartWheel, ChartSphere, Kundli } from "caelus-wheel";
import BiWheel, { type SynContact } from "../BiWheel";
import Aspectarian from "../Aspectarian";
import ChartControls from "../ChartControls";
import SkyViewTab from "../SkyViewTab";
import { WHEEL_THEME } from "../../lib/wheelTheme";
import { crossAspect } from "../../lib/chart-display";
import {
  type Share, type Tradition, type KundliStyle, type BirthShare,
  b64urlEncode, readUrlState, isBirthShare, isFormShare,
} from "../../lib/share";
import {
  fmtIso, isoFromJd, jdFromIso, birthShareOf, formShareOf, formAsWheel,
  directedChart, risingWindows, DEFAULT_FORM, extraBodyIds,
  playgroundChartParams,
  type DocKind, type FigureView, type ProgressMethod, type RailId,
} from "./util";
import {
  PlacementsPanel, VedicPanel, TimingPanel, ComposePanel, RectifyPanel,
  ComparePanel, ElectionalPanel, SyntheticPanel, JsonPanel,
  harmonicWheel, antisciaWheel, heliocentricWheel,
} from "./RailPanels";
import LocationalMap from "./LocationalMap";
import { loadDeepStars, loadExtraPacks } from "../../lib/loadExtraData";

const ReadingTab = dynamic(() => import("../ReadingTab"), {
  ssr: false,
  loading: () => <p className="dim small" style={{ marginTop: 0 }}>reading the chart…</p>,
});
const HouseComparatorSlot = dynamic(() => import("./widgets/HouseComparatorSlot"), { ssr: false });
const SectFlipSlot = dynamic(() => import("./widgets/SectFlipSlot"), { ssr: false });
const DerivationSlot = dynamic(() => import("./widgets/DerivationSlot"), { ssr: false });
const RetrogradeSlot = dynamic(() => import("./widgets/RetrogradeSlot"), { ssr: false });
const AspectDialSlot = dynamic(() => import("./widgets/AspectDialSlot"), { ssr: false });

const PATTERN_LABEL: Record<string, string> = {
  grand_cross: "Grand cross", mystic_rectangle: "Mystic rectangle", kite: "Kite",
  t_square: "T-square", grand_trine: "Grand trine", yod: "Yod",
  stellium_sign: "Stellium (sign)", stellium_house: "Stellium (house)",
};

export default function Workspace() {
  const engineRef = useRef<Engine | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [iso, setIso] = useState("");
  const [lat, setLat] = useState("27.94");
  const [lon, setLon] = useState("-82.46");
  const [sys, setSys] = useState<HouseSystem>("placidus");
  const [zodiac, setZodiac] = useState<Zodiac>("tropical");
  const [userHouses, setUserHouses] = useState(false);
  const [userZodiac, setUserZodiac] = useState(false);
  const [tzMode, setTzMode] = useState<"utc" | "local">("utc");
  const [place, setPlace] = useState("");
  const [label, setLabel] = useState("");
  const [docKind, setDocKind] = useState<DocKind>("birth");
  const [tradition, setTradition] = useState<Tradition>("western");
  const [advanced, setAdvanced] = useState(false);
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [kundliStyle, setKundliStyle] = useState<KundliStyle>("north");
  const [topocentric, setTopocentric] = useState(false);
  const [extras, setExtras] = useState(false);
  const [spatial, setSpatial] = useState(false);
  const [orbOverride, setOrbOverride] = useState("");
  const [relocated, setRelocated] = useState(false);
  const [engineTick, setEngineTick] = useState(0);
  const extraDataRef = useRef<Partial<EngineData>>({});
  const [rail, setRail] = useState<RailId>("reading");
  const [figure, setFigure] = useState<FigureView>("natal");
  const [focus, setFocus] = useState<{ key: string; bodies: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [, setFromLink] = useState(false);
  const [set, setSet] = useState<Share[]>([]);
  const [collectionCopied, setCollectionCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [constraints, setConstraints] = useState<Constraint[]>(DEFAULT_FORM);
  const [targetIso, setTargetIso] = useState("");
  const [method, setMethod] = useState<ProgressMethod>("secondary");
  const [harmonicN, setHarmonicN] = useState(5);
  const [previewJd, setPreviewJd] = useState<number | null>(null);
  const [knownRising, setKnownRising] = useState<number | "">("");
  const [stepMin, setStepMin] = useState(20);
  const [win0, setWin0] = useState(0);
  const [win1, setWin1] = useState(24);
  const [rectifyEvents, setRectifyEvents] = useState<Array<{ date: string; note: string }>>([]);
  const [syntheticId, setSyntheticId] = useState<string | null>(null);

  const engine = () => (engineRef.current ??= new Engine(embeddedData));

  const rebuildEngine = useCallback(() => {
    engineRef.current = new Engine({
      ...embeddedData,
      ...extraDataRef.current,
      chebPacks: { ...embeddedData.chebPacks, ...extraDataRef.current.chebPacks },
    });
    setSyntheticId(null);
    setEngineTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!extras) return;
    let cancelled = false;
    loadExtraPacks().then((packs) => {
      if (cancelled) return;
      extraDataRef.current = {
        ...extraDataRef.current,
        ...packs,
        chebPacks: { ...extraDataRef.current.chebPacks, ...packs.chebPacks },
      };
      rebuildEngine();
    }).catch(() => { /* pack fetch failed; extras stay at mean/true lilith */ });
    return () => { cancelled = true; };
  }, [extras, rebuildEngine]);

  useEffect(() => {
    if (rail !== "sky") return;
    if (extraDataRef.current.deepStars) return;
    let cancelled = false;
    loadDeepStars().then((deepStars) => {
      if (cancelled) return;
      extraDataRef.current = { ...extraDataRef.current, deepStars };
      rebuildEngine();
    }).catch(() => { /* deep field optional */ });
    return () => { cancelled = true; };
  }, [rail, rebuildEngine]);

  const setSysTracked = useCallback((v: HouseSystem | ((p: HouseSystem) => HouseSystem)) => {
    setUserHouses(true);
    setSys(v);
  }, []);
  const setZodiacTracked = useCallback((v: Zodiac | ((p: Zodiac) => Zodiac)) => {
    setUserZodiac(true);
    setZodiac(v);
  }, []);

  const switchTradition = (t: Tradition) => {
    setTradition(t);
    if (!userHouses) setSys(t === "vedic" ? "whole_sign" : "placidus");
    if (!userZodiac) setZodiac(t === "vedic" ? "sidereal:lahiri" : "tropical");
  };

  const loadShare = useCallback((s: Share) => {
    if (isFormShare(s)) {
      setDocKind("form");
      setConstraints(s.constraints);
      setLabel(s.n ?? "");
      setRail("compose");
      setAdvanced(true);
      return;
    }
    if (!isBirthShare(s)) return;
    setDocKind("birth");
    setIso(s.t);
    setLat(s.la);
    setLon(s.lo);
    const trad = s.trad ?? "western";
    setTradition(trad);
    if (s.h) setSys(s.h);
    else setSys(trad === "vedic" ? "whole_sign" : "placidus");
    if (s.z) setZodiac(s.z);
    else setZodiac(trad === "vedic" ? "sidereal:lahiri" : "tropical");
    const defaultH = trad === "vedic" ? "whole_sign" : "placidus";
    const defaultZ = trad === "vedic" ? "sidereal:lahiri" : "tropical";
    setUserHouses(!!s.h && s.h !== defaultH);
    setUserZodiac(!!s.z && s.z !== defaultZ);
    setLabel(s.n ?? "");
    setPlace("");
    setTzMode("utc");
    setTimeUnknown(s.time === "unknown");
    setRelocated(false);
    if (s.kundli) setKundliStyle(s.kundli);
    setAdvanced(false);
    setRail(s.time === "unknown" ? "rectify" : "reading");
  }, []);

  useEffect(() => {
    const { set: urlSet, single } = readUrlState();
    if (urlSet && urlSet.length) {
      setSet(urlSet);
      loadShare(urlSet[0]);
      setFromLink(true);
    } else if (single) {
      loadShare(single);
      setFromLink(true);
    } else {
      setIso(new Date().toISOString().slice(0, 16));
    }
    setTargetIso(new Date().toISOString().slice(0, 16));
    setReady(true);
  }, [loadShare]);

  useEffect(() => {
    const onHash = () => {
      const { set: urlSet, single } = readUrlState();
      if (urlSet && urlSet.length) { setSet(urlSet); loadShare(urlSet[0]); setFromLink(true); }
      else if (single) { loadShare(single); setFromLink(true); }
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadShare]);

  const { chart, ms, error, utIso, zone, tzStatus, natalJd } = useMemo(() => {
    const none = {
      chart: null as Chart | null, ms: 0, error: null as string | null,
      utIso: iso, zone: "", tzStatus: "" as UTResult["status"] | "", natalJd: null as number | null,
    };
    if (!ready || !iso || docKind === "form") return none;
    const la = Number(lat);
    const lo = Number(lon);
    const d = new Date(iso + ":00Z");
    if (!Number.isFinite(la) || la < -90 || la > 90) return { ...none, error: "latitude must be in [-90, 90]" };
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) return { ...none, error: "longitude must be in [-180, 180], east positive" };
    if (Number.isNaN(d.getTime())) return { ...none, error: "invalid date" };

    let y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, day = d.getUTCDate();
    let hh = d.getUTCHours(), mm = d.getUTCMinutes();
    if (timeUnknown) { hh = 12; mm = 0; }
    let resolvedZone = "";
    let status: UTResult["status"] | "" = "";
    if (tzMode === "local" && !timeUnknown) {
      try {
        const t = toUT({ year: y, month: mo, day, hour: hh, minute: mm, lat: la, lon: lo });
        ({ year: y, month: mo, day, hour: hh, minute: mm } = t.utc);
        resolvedZone = t.zone;
        status = t.status;
      } catch {
        return { ...none, error: "could not resolve a time zone for this place" };
      }
    }

    const t0 = performance.now();
    try {
      const jd = previewJd ?? julianDay(y, mo, day, hh, mm, 0);
      const orbN = Number(orbOverride);
      const orbs = Number.isFinite(orbN) && orbN > 0
        ? Object.fromEntries((["conjunction", "sextile", "square", "trine", "opposition"] as const).map((k) => [k, orbN]))
        : undefined;
      const extra = advanced && extras
        ? [...new Set([...EXTRA_BODIES, ...extraBodyIds(engine())])]
        : undefined;
      const c = engine().chartAt(jd, la, lo, {
        houseSystem: sys,
        zodiac,
        topocentric: advanced && topocentric,
        observer: advanced && topocentric ? { lat: la, lonEast: lo } : undefined,
        bodies: extra,
        separation: spatial ? "spatial" : undefined,
        orbs: orbs as typeof DEFAULT_ORBS | undefined,
      });
      return {
        chart: c as Chart,
        ms: performance.now() - t0,
        error: null,
        utIso: fmtIso(y, mo, day, hh, mm),
        zone: resolvedZone,
        tzStatus: status,
        natalJd: julianDay(y, mo, day, hh, mm, 0),
      };
    } catch {
      return { ...none, error: "could not compute a chart for this instant" };
    }
  }, [ready, iso, lat, lon, sys, zodiac, tzMode, docKind, timeUnknown, previewJd, advanced, topocentric, extras, spatial, orbOverride, engineTick]);

  const compiled = useMemo(() => (docKind === "form" ? compileForm(constraints) : null), [docKind, constraints]);

  const targetJd = useMemo(() => {
    if (!targetIso) return natalJd;
    try { return jdFromIso(targetIso); }
    catch { return natalJd; }
  }, [targetIso, natalJd]);

  const today = useMemo(() => {
    const n = new Date();
    const jd = julianDay(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes());
    const e = engine();
    const la = Number(lat), lo = Number(lon);
    try {
      const moon = e.longitude("moon", jd, { zodiac });
      const voc = voidOfCourse(e, jd, zodiac);
      const hour = Number.isFinite(la) ? planetaryHour(e, jd, la, lo) : null;
      const bodies: Record<string, { lon: number }> = {};
      for (const b of BODIES) bodies[b] = { lon: e.longitude(b as BodyId, jd, { zodiac }) };
      const patterns = detectPatternsIn(bodies).slice(0, 3);
      const hits = chart && natalJd != null
        ? transitAspects(chart, e, jd, { zodiac, maxOrb: 2 }).slice(0, 2)
        : [];
      const st = ["mercury", "venus", "mars", "jupiter", "saturn"].flatMap((b) =>
        stations(e, b as BodyId, jd - 0.4, jd + 1.2, 1).map(([sjd, dir]) => ({ body: b, jd: sjd, dir })),
      );
      return { jd, moon, voc, hour, patterns, hits, st };
    } catch {
      return null;
    }
  }, [lat, lon, zodiac, chart, natalJd]);

  const readingInputs = useMemo(() => {
    if (!chart) return null;
    try {
      return { stars: engine().starConjunctions(chart, { orb: 1 }), lots: engine().lots(chart) };
    } catch {
      return { stars: [], lots: [] };
    }
  }, [chart]);

  const transit = useMemo(() => {
    if (!chart || (figure !== "transits" && figure !== "tri")) return null;
    const tjd = targetJd ?? julianDay(
      new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate(),
      new Date().getUTCHours(), new Date().getUTCMinutes(),
    );
    const tchart = engine().chartAt(tjd, Number(lat), Number(lon), { houseSystem: sys, zodiac });
    const contacts: SynContact[] = [];
    for (const nb of BODIES) {
      const np = chart.bodies[nb];
      if (!np) continue;
      for (const tb of BODIES) {
        const tp = tchart.bodies[tb];
        if (!tp) continue;
        const asp = crossAspect(np.lon, tp.lon);
        if (asp) contacts.push({ aBody: nb, bBody: tb, aspect: asp.aspect, orb: asp.orb });
      }
    }
    return { chart: tchart, contacts };
  }, [chart, figure, lat, lon, sys, zodiac, targetJd]);

  const progressed = useMemo(() => {
    if (!chart || natalJd == null || targetJd == null) return null;
    try {
      if (method === "solar-arc") {
        const arc = solarArc(engine(), natalJd, targetJd, undefined, zodiac);
        return { chart: directedChart(chart, arc), stamp: "directed" as const };
      }
      const pjd = progressedJd(natalJd, targetJd);
      return {
        chart: engine().chartAt(pjd, Number(lat), Number(lon), { houseSystem: sys, zodiac }),
        stamp: "progressed" as const,
      };
    } catch { return null; }
  }, [chart, natalJd, targetJd, method, lat, lon, sys, zodiac]);

  const windows = useMemo(() => {
    if (!timeUnknown || docKind !== "birth" || !iso) return [];
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return [];
    try { return risingWindows(engine(), iso, la, lo, stepMin, win0, win1); }
    catch { return []; }
  }, [timeUnknown, docKind, iso, lat, lon, stepMin, win0, win1]);

  useEffect(() => { setFocus(null); }, [chart]);

  const withAspectsOf = (b: string): string[] => {
    const s = new Set<string>([b]);
    if (chart) for (const a of chart.aspects) {
      if (a.a === b) s.add(a.b);
      if (a.b === b) s.add(a.a);
    }
    return [...s];
  };
  const toggleFocus = (key: string, bodies: string[]) => {
    setFocus((f) => (f?.key === key ? null : { key, bodies }));
    setFigure("natal");
  };

  function currentPayload(): Share {
    if (docKind === "form") return formShareOf(constraints, label);
    return birthShareOf({
      t: utIso, la: lat, lo: lon, h: sys, z: zodiac, n: label,
      trad: tradition, kundli: kundliStyle, timeUnknown,
    });
  }

  function share() {
    const payload = currentPayload();
    const url = `${window.location.origin}${window.location.pathname}#c=${b64urlEncode(payload)}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* address bar still holds it */ });
  }

  function addToSet() {
    setSet((prev) => [...prev, currentPayload()]);
  }

  function shareSet() {
    if (!set.length) return;
    const url = `${window.location.origin}${window.location.pathname}#s=${b64urlEncode({ v: 1, c: set })}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url).then(() => {
      setCollectionCopied(true);
      setTimeout(() => setCollectionCopied(false), 2000);
    }).catch(() => { /* address bar still holds it */ });
  }

  const la = Number(lat), lo = Number(lon);
  const formWheel = compiled ? formAsWheel(compiled.longitudes) : null;
  const widgetParams = useMemo(() => {
    if (!chart) return null;
    return playgroundChartParams(chart.jdUt, la, lo, sys, place || undefined);
  }, [chart, la, lo, sys, place]);

  const figureChart = useMemo(() => {
    if (docKind === "form" && formWheel) return formWheel;
    if (!chart) return null;
    if (figure === "harmonic") return harmonicWheel(engine(), natalJd ?? chart.jdUt, harmonicN, chart, zodiac);
    if (figure === "antiscia") return antisciaWheel(chart);
    if (figure === "heliocentric") return heliocentricWheel(engine(), natalJd ?? chart.jdUt);
    return chart;
  }, [docKind, formWheel, chart, figure, natalJd, harmonicN, zodiac, engineTick]);

  const casualRails: RailId[] = useMemo(() => {
    const r: RailId[] = ["reading"];
    if (docKind === "birth") r.push("placements", "aspects", "sky");
    if (timeUnknown) r.push("rectify");
    if (tradition === "vedic") r.push("vedic");
    r.push("compose");
    if (set.filter(isBirthShare).length >= 1) r.push("compare");
    return r;
  }, [docKind, timeUnknown, tradition, set]);

  const advRails: RailId[] = [
    "reading", "placements", "aspects", "timing", "compare", "compose",
    "sky", "rectify", "vedic", "electional", "synthetic", "json",
  ];
  const rails = advanced ? advRails.filter((id) => {
    if (id === "vedic" && tradition !== "vedic") return false;
    if (id === "sky" && docKind !== "birth") return false;
    return true;
  }) : casualRails;

  useEffect(() => {
    if (!rails.includes(rail)) setRail(rails[0] ?? "reading");
  }, [rails, rail]);

  useEffect(() => {
    if (!advanced && docKind === "form") {
      setDocKind("birth");
      setRail("reading");
    }
  }, [advanced, docKind]);

  const RAIL_LABEL: Record<RailId, string> = {
    reading: "Reading", placements: "Placements", aspects: "Aspects",
    timing: "Timing", compare: "Compare", compose: "Compose",
    sky: "Sky", rectify: "Rectify", vedic: "Vedic", json: "JSON",
    electional: "Electional", synthetic: "Synthetic",
  };

  const figureOpts = useMemo((): Array<[FigureView, string]> => {
    const natal: [FigureView, string] = tradition === "vedic" ? ["natal", "Kundli"] : ["natal", "Wheel"];
    const casual: Array<[FigureView, string]> = [natal, ["transits", "Transits"]];
    if (docKind === "birth") {
      casual.push(["houses", "Houses"]);
      if (tradition === "western") casual.push(["derive", "Derive"], ["sect", "Sect"]);
    }
    const extra: Array<[FigureView, string]> = advanced
      ? [["tri", "Tri-wheel"], ["sphere", "Sphere"], ["map", "Map"], ["harmonic", "Harmonic"], ["antiscia", "Antiscia"], ["heliocentric", "Heliocentric"], ["retrograde", "Retrograde"], ["dial", "Dial"]]
      : [];
    return [...casual, ...extra];
  }, [tradition, advanced, docKind]);

  useEffect(() => {
    if (!figureOpts.some(([id]) => id === figure)) setFigure("natal");
  }, [figure, figureOpts]);

  if (docKind === "form") {
    /* form only shows the compiled wheel */
  }

  const stamp = (() => {
    if (docKind === "form") {
      return compiled?.impossible
        ? "Archetypal form · geometrically impossible"
        : "Archetypal form · no instant, no houses";
    }
    if (syntheticId) return `${syntheticId} on the chart`;
    if (timeUnknown) {
      return previewJd
        ? `Time unknown · ${isoFromJd(previewJd).replace("T", " ")} UT`
        : "Time unknown";
    }
    if (relocated) return `Relocated · ${lat}, ${lon}`;
    if (figure === "map") return "Astrocartography";
    if (figure === "heliocentric") return "Heliocentric";
    if (figure === "houses") return "House systems";
    if (figure === "derive") return "Sky to wheel";
    if (figure === "sect") return "Sect";
    if (figure === "retrograde") return "Retrograde";
    if (figure === "dial") return "Aspect dial";
    if (figure === "antiscia" || figure === "harmonic") return figure === "harmonic" ? `Harmonic ${harmonicN}` : "Antiscia";
    if (place) return place;
    return [iso.replace("T", " "), lat, lon].filter(Boolean).join(" · ");
  })();

  return (
    <div className="card workspace" ref={cardRef}>
      {!ready ? (
        <p className="dim small" style={{ margin: 0 }}>loading…</p>
      ) : (
        <>
          <div className="workspace__chrome">
            {advanced && (
              <div className="seg" role="group" aria-label="Document">
                <button type="button" className="seg__btn" aria-pressed={docKind === "birth"} onClick={() => { setDocKind("birth"); setRail("reading"); }}>New Birth</button>
                <button type="button" className="seg__btn" aria-pressed={docKind === "form"} onClick={() => { setDocKind("form"); setRail("compose"); }}>New Form</button>
              </div>
            )}
            <div className="seg" role="group" aria-label="Tradition">
              <button type="button" className="seg__btn" aria-pressed={tradition === "western"} onClick={() => switchTradition("western")}>Western</button>
              <button type="button" className="seg__btn" aria-pressed={tradition === "vedic"} onClick={() => switchTradition("vedic")}>Vedic</button>
            </div>
            <label className="field">
              <span className="field__label">
                <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)}
                  style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
                Advanced
              </span>
            </label>
            {tradition === "vedic" && (
              <div className="seg" role="group" aria-label="Kundli style">
                <button type="button" className="seg__btn" aria-pressed={kundliStyle === "north"} onClick={() => setKundliStyle("north")}>North</button>
                <button type="button" className="seg__btn" aria-pressed={kundliStyle === "south"} onClick={() => setKundliStyle("south")}>South</button>
              </div>
            )}
            {advanced && docKind === "birth" && (
              <>
                <label className="field">
                  <span className="field__label">
                    <input type="checkbox" checked={topocentric} onChange={(e) => setTopocentric(e.target.checked)}
                      style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
                    topocentric
                  </span>
                </label>
                <label className="field">
                  <span className="field__label">
                    <input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)}
                      style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
                    extra bodies
                  </span>
                </label>
                <label className="field">
                  <span className="field__label">
                    <input type="checkbox" checked={spatial} onChange={(e) => setSpatial(e.target.checked)}
                      style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }} />
                    spatial aspects
                  </span>
                </label>
                <div className="field">
                  <span className="field__label">orb °</span>
                  <input className="control" style={{ width: "3.5rem" }} value={orbOverride}
                    onChange={(e) => setOrbOverride(e.target.value)} placeholder="def" aria-label="aspect orb override" />
                </div>
              </>
            )}
          </div>

          {docKind === "birth" && (
            <ChartControls
              iso={iso} setIso={setIso}
              lat={lat} setLat={(v: SetStateAction<string>) => { setLat(v); setRelocated(false); }}
              lon={lon} setLon={(v: SetStateAction<string>) => { setLon(v); setRelocated(false); }}
              sys={sys} setSys={setSysTracked}
              zodiac={zodiac} setZodiac={setZodiacTracked}
              tzMode={tzMode} setTzMode={setTzMode}
              label={label} setLabel={setLabel}
              setPlace={setPlace}
              set={set}
              hasChart={!!chart}
              copied={copied}
              collectionCopied={collectionCopied}
              onShare={share}
              onAddToSet={addToSet}
              onShareSet={shareSet}
              onLoadShare={loadShare}
              onRemoveFromSet={(i) => setSet((prev) => prev.filter((_, j) => j !== i))}
              showHouseZodiac
              timeUnknown={timeUnknown}
              setTimeUnknown={(v) => {
                const next = typeof v === "function" ? v(timeUnknown) : v;
                setTimeUnknown(next);
                setPreviewJd(null);
              }}
            />
          )}
          {docKind === "form" && (
            <div className="controls">
              <div className="field">
                <span className="field__label">name</span>
                <input className="control" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="optional" />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={share}>
                {copied ? "Link copied ✓" : "Copy link"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addToSet}>+ Add to my charts</button>
            </div>
          )}

          <p className="provenance-stamp">
            {stamp}
            {advanced && chart ? ` · ${ms.toFixed(1)} ms` : ""}
          </p>
          {tzStatus === "ambiguous" && (
            <p className="provenance-stamp">This local time fell in a fall-back hour that occurred twice; the earlier instant was used.</p>
          )}
          {tzStatus === "nonexistent" && (
            <p className="provenance-stamp">This local time fell in a spring-forward gap; it was shifted forward per the zone rules.</p>
          )}
          {chart && chart.unavailable.length > 0 && (
            <p className="provenance-stamp">Omitted (outside fitted range): {chart.unavailable.join(", ")}.</p>
          )}
          {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}

          {today && (
            <div className="today-strip" aria-label="Today">
              <span className="today-strip__item">Moon <strong>{fmtLon(today.moon)}</strong></span>
              <span className="today-strip__item">{today.voc.isVoid ? <strong>VOC</strong> : today.voc.sign}</span>
              {today.hour && <span className="today-strip__item">hour <strong>{today.hour.ruler}</strong></span>}
              {today.hits.map((h, i) => (
                <span key={i} className="today-strip__item">{h.transit} {h.aspect} {h.natal}</span>
              ))}
              {today.st.map((s, i) => (
                <span key={`st${i}`} className="today-strip__item">{s.body} {s.dir}</span>
              ))}
              {today.patterns.map((p, i) => (
                <span key={`p${i}`} className="today-strip__item">{PATTERN_LABEL[p.kind] ?? p.kind}</span>
              ))}
            </div>
          )}

          {(chart || formWheel) && (
            <div className="workspace__body">
              <div className="workspace__figure">
                {docKind === "birth" && (
                  <div className="seg" role="group" aria-label="Figure" style={{ marginBottom: "0.6rem" }}>
                    {figureOpts.map(([id, name]) => (
                      <button key={id} type="button" className="seg__btn" aria-pressed={figure === id} onClick={() => setFigure(id)}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {docKind === "form" && formWheel && (
                  <ChartWheel chart={formWheel} size={460} theme={WHEEL_THEME} />
                )}
                {docKind === "birth" && chart && figure === "natal" && tradition === "western" && figureChart && (
                  <ChartWheel chart={figureChart === chart ? chart : figureChart} size={460} bodies={focus?.bodies} theme={WHEEL_THEME} />
                )}
                {docKind === "birth" && chart && figure === "natal" && tradition === "vedic" && (
                  <>
                    <Kundli chart={chart} layout={kundliStyle} size={advanced ? 380 : 460} theme={WHEEL_THEME} bodies={focus?.bodies} />
                    {advanced && natalJd != null && (
                      <p className="dim small" style={{ margin: "0.4rem 0 0" }}>D1. Navamsa (D9) is listed on the Vedic rail.</p>
                    )}
                  </>
                )}
                {docKind === "birth" && chart && widgetParams && figure === "houses" && (
                  <HouseComparatorSlot engine={engine()} params={widgetParams} />
                )}
                {docKind === "birth" && chart && widgetParams && figure === "sect" && (
                  <SectFlipSlot engine={engine()} params={widgetParams} />
                )}
                {docKind === "birth" && chart && widgetParams && figure === "derive" && (
                  <DerivationSlot engine={engine()} params={widgetParams} />
                )}
                {docKind === "birth" && chart && widgetParams && figure === "retrograde" && (
                  <RetrogradeSlot engine={engine()} params={widgetParams} />
                )}
                {docKind === "birth" && chart && widgetParams && figure === "dial" && (
                  <AspectDialSlot engine={engine()} params={widgetParams} />
                )}
                {docKind === "birth" && chart && (figure === "harmonic" || figure === "antiscia" || figure === "heliocentric") && figureChart && (
                  <ChartWheel chart={figureChart} size={460} theme={WHEEL_THEME} />
                )}
                {figure === "harmonic" && advanced && (
                  <div className="field" style={{ marginTop: "0.4rem" }}>
                    <span className="field__label">n</span>
                    <input className="control" style={{ width: "4rem" }} type="number" min={2} max={12} value={harmonicN}
                      onChange={(e) => setHarmonicN(Number(e.target.value) || 5)} />
                  </div>
                )}
                {figure === "sphere" && chart && <ChartSphere chart={chart} size={460} theme={WHEEL_THEME} />}
                {figure === "map" && natalJd != null && (
                  <LocationalMap
                    engine={engine()}
                    natalJd={natalJd}
                    lat={la}
                    lon={lo}
                    onRelocate={(nlat, nlon, name) => {
                      setLat(String(nlat));
                      setLon(String(nlon));
                      setRelocated(true);
                      if (name) setPlace(name);
                    }}
                  />
                )}
                {figure === "transits" && transit && chart && (
                  <BiWheel inner={chart} outer={transit.chart} contacts={transit.contacts} size={460} innerLabel="natal" outerLabel="transit" />
                )}
                {figure === "tri" && transit && chart && progressed && (
                  <BiWheel inner={chart} mid={progressed.chart} outer={transit.chart} contacts={transit.contacts} size={460}
                    innerLabel="natal" midLabel={progressed.stamp} outerLabel="transit" />
                )}
              </div>
              <div className="workspace__rail">
                <div className="tabs__list" role="tablist" aria-label="Technique" style={{ marginBottom: "0.8rem" }}>
                  {rails.map((id) => (
                    <button key={id} type="button" role="tab" className="tabs__tab" aria-selected={rail === id} onClick={() => setRail(id)}>
                      {RAIL_LABEL[id]}
                    </button>
                  ))}
                </div>
                {rail === "reading" && chart && readingInputs && (
                  <ReadingTab chart={chart} engine={engine()} lat={la} lonEast={lo} zodiac={zodiac} stars={readingInputs.stars} lots={readingInputs.lots} />
                )}
                {rail === "reading" && docKind === "form" && compiled && (
                  <p className="dim small">A form has no natal reading. Fit {compiled.residual.toFixed(2)}°{compiled.impossible ? "; these constraints cannot be met" : ""}.</p>
                )}
                {rail === "placements" && chart && (
                  <PlacementsPanel chart={chart} engine={engine()} lat={la} lon={lo} zodiac={zodiac} advanced={advanced} extras={extras}
                    focus={focus} onToggle={toggleFocus} withAspectsOf={withAspectsOf} />
                )}
                {rail === "aspects" && chart && (
                  <Aspectarian chart={chart} onIsolate={(bodies) => toggleFocus(bodies.join("-"), bodies)} />
                )}
                {rail === "timing" && chart && natalJd != null && targetJd != null && (
                  <TimingPanel engine={engine()} natal={chart} natalJd={natalJd} targetJd={targetJd} lat={la} lon={lo}
                    zodiac={zodiac} advanced={advanced} sys={sys} method={method} setMethod={setMethod} onSetTarget={setTargetIso} />
                )}
                {rail === "compose" && (
                  <ComposePanel engine={engine()} natal={chart} natalJd={natalJd} lat={la} lon={lo} zodiac={zodiac}
                    constraints={constraints} setConstraints={setConstraints} formName={label} />
                )}
                {rail === "sky" && chart && (
                  <SkyViewTab engine={engine()} jdUt={targetJd ?? chart.jdUt} lat={la} lonEast={lo}
                    extraBodies={[
                      ...(syntheticId ? [syntheticId] : []),
                      ...(extras ? extraBodyIds(engine()).filter((id) => id !== syntheticId) : []),
                    ]} />
                )}
                {rail === "rectify" && (
                  <RectifyPanel
                    windows={windows} knownRising={knownRising} setKnownRising={setKnownRising}
                    stepMin={stepMin} setStepMin={setStepMin} win0={win0} setWin0={setWin0} win1={win1} setWin1={setWin1}
                    previewSign={previewJd == null ? null : windows.find((w) => Math.abs(w.midJd - previewJd) < 1e-6)?.sign ?? null}
                    onPreview={(w) => { setPreviewJd(w.midJd); setFigure("natal"); }}
                    onApply={(w) => {
                      setIso(isoFromJd(w.midJd));
                      setTzMode("utc");
                      setPreviewJd(null);
                      setTimeUnknown(true);
                    }}
                    events={rectifyEvents} setEvents={setRectifyEvents}
                    engine={engine()} lat={la} lon={lo} zodiac={zodiac} advanced={advanced}
                  />
                )}
                {rail === "vedic" && chart && natalJd != null && (
                  <VedicPanel engine={engine()} chart={chart} natalJd={natalJd} targetJd={targetJd ?? natalJd} zodiac={zodiac} advanced={advanced} lat={la} lon={lo} />
                )}
                {rail === "compare" && chart && (
                  <ComparePanel engine={engine()} natal={chart} set={set} loadShare={loadShare} advanced={advanced}
                    lat={la} lon={lo} sys={sys} zodiac={zodiac} />
                )}
                {rail === "electional" && targetJd != null && (
                  <ElectionalPanel engine={engine()} targetJd={targetJd} lat={la} lon={lo} zodiac={zodiac} />
                )}
                {rail === "synthetic" && natalJd != null && (
                  <SyntheticPanel engine={engine()} natalJd={natalJd} onRegistered={setSyntheticId} />
                )}
                {rail === "json" && chart && <JsonPanel chart={chart} advanced={advanced} />}
              </div>
            </div>
          )}

          {docKind === "birth" && natalJd != null && (
            <div className="scrubber">
              <span className="field__label">target date</span>
              <input className="control" type="datetime-local" value={targetIso}
                onChange={(e) => setTargetIso(e.target.value)} aria-label="timing target date" />
              <input className="control" type="range" min={-365} max={3650} step={1}
                value={targetJd != null ? Math.round(targetJd - natalJd) : 0}
                onChange={(e) => setTargetIso(isoFromJd(natalJd + Number(e.target.value)))}
                aria-label="days from natal" />
              <span className="mute small">{targetIso.replace("T", " ")} UT</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
