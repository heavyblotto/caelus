"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Engine, BODIES, EXTRA_BODIES, fmtLon, julianDay, detectPatternsIn,
  voidOfCourse, planetaryHour, transitAspects, progressedJd, solarArc,
  compileForm, stations, DEFAULT_ORBS,
  type BodyId, type Chart, type Constraint, type EngineData, type HouseSystem, type Zodiac,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { toUT, type UTResult } from "caelus-birth";
import type { SynContact } from "../BiWheel";
import Aspectarian from "../Aspectarian";
import { crossAspect } from "../../lib/chart-display";
import {
  type Share, type Tradition, type KundliStyle,
  b64urlEncode, readUrlState, isBirthShare, isFormShare,
} from "../../lib/share";
import {
  fmtIso, isoFromJd, jdFromIso, birthShareOf, formShareOf, formAsWheel,
  directedChart, risingWindows, DEFAULT_FORM, extraBodyIds,
  playgroundChartParams,
  type CompanionView, type DocKind, type FigureView, type ProgressMethod, type RailId,
} from "./util";
import {
  PlacementsPanel, VedicPanel, TimingPanel, ComposePanel, RectifyPanel,
  ComparePanel, ElectionalPanel, SyntheticPanel, JsonPanel,
  harmonicWheel, antisciaWheel, heliocentricWheel,
} from "./RailPanels";
import { DEFAULT_PRESET_ID, PLAYGROUND_PRESETS, type PlaygroundPreset } from "./presets";
import { buildPlaygroundCode } from "./codeGen";
import { InteractiveSkyViewTab } from "./VizBridge";
import WorkspaceControls from "./WorkspaceControls";
import VizStage from "./VizStage";
import TimeScrubber from "./TimeScrubber";
import CodeCallDrawer from "./CodeCallDrawer";
import { loadDeepStars, loadExtraPacks } from "../../lib/loadExtraData";

const ReadingTab = dynamic(() => import("../ReadingTab"), {
  ssr: false,
  loading: () => <p className="dim small">Reading the chart...</p>,
});

const PATTERN_LABEL: Record<string, string> = {
  grand_cross: "Grand cross", mystic_rectangle: "Mystic rectangle", kite: "Kite",
  t_square: "T-square", grand_trine: "Grand trine", yod: "Yod",
  stellium_sign: "Stellium (sign)", stellium_house: "Stellium (house)",
};

const RAIL_LABEL: Record<RailId, string> = {
  reading: "Reading", placements: "Placements", aspects: "Aspects",
  timing: "Timing", compare: "Compare", compose: "Compose",
  sky: "Sky", rectify: "Rectify", vedic: "Vedic", json: "JSON",
  electional: "Electional", synthetic: "Synthetic",
};

export default function Workspace() {
  const engineRef = useRef<Engine | null>(null);
  const benchRef = useRef<HTMLDivElement | null>(null);
  const railTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const railBaseId = useId();

  const defaultPreset = PLAYGROUND_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ?? PLAYGROUND_PRESETS[0];

  const [activePreset, setActivePreset] = useState<string | null>(defaultPreset.id);
  const [iso, setIso] = useState(defaultPreset.iso);
  const [lat, setLat] = useState(defaultPreset.lat);
  const [lon, setLon] = useState(defaultPreset.lon);
  const [sys, setSys] = useState<HouseSystem>(defaultPreset.sys);
  const [zodiac, setZodiac] = useState<Zodiac>(defaultPreset.zodiac);
  const [userHouses, setUserHouses] = useState(false);
  const [userZodiac, setUserZodiac] = useState(false);
  const [tzMode, setTzMode] = useState<"utc" | "local">("utc");
  const [place, setPlace] = useState(defaultPreset.place);
  const [label, setLabel] = useState(defaultPreset.label);
  const [docKind, setDocKind] = useState<DocKind>("birth");
  const [tradition, setTradition] = useState<Tradition>(defaultPreset.tradition);
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

  const [rail, setRail] = useState<RailId>(defaultPreset.rail ?? "reading");
  const [figure, setFigure] = useState<FigureView>(defaultPreset.figure ?? "natal");
  const [paired, setPaired] = useState(false);
  const [companion, setCompanion] = useState<CompanionView>("sphere");
  const [focus, setFocus] = useState<{ key: string; bodies: string[] } | null>(null);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [hoveredBody, setHoveredBody] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [collectionCopied, setCollectionCopied] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [set, setSet] = useState<Share[]>([]);
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

  const announce = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((cur) => (cur === msg ? "" : cur));
    }, 2600);
  }, []);

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
    }).catch(() => { /* pack fetch optional */ });
    return () => { cancelled = true; };
  }, [extras, rebuildEngine]);

  useEffect(() => {
    if (rail !== "sky" && !(paired && companion === "sky")) return;
    if (extraDataRef.current.deepStars) return;
    let cancelled = false;
    loadDeepStars().then((deepStars) => {
      if (cancelled) return;
      extraDataRef.current = { ...extraDataRef.current, deepStars };
      rebuildEngine();
    }).catch(() => { /* deep field optional */ });
    return () => { cancelled = true; };
  }, [rail, paired, companion, rebuildEngine]);

  const setSysTracked = useCallback((v: HouseSystem) => {
    setUserHouses(true);
    setSys(v);
    setActivePreset(null);
  }, []);

  const setZodiacTracked = useCallback((v: Zodiac) => {
    setUserZodiac(true);
    setZodiac(v);
    setActivePreset(null);
  }, []);

  const switchTradition = useCallback((t: Tradition) => {
    setTradition(t);
    if (!userHouses) setSys(t === "vedic" ? "whole_sign" : "placidus");
    if (!userZodiac) setZodiac(t === "vedic" ? "sidereal:lahiri" : "tropical");
    if (t === "vedic") setRail("vedic");
    setActivePreset(null);
  }, [userHouses, userZodiac]);

  const applyPreset = useCallback((p: PlaygroundPreset) => {
    const nowIso = new Date().toISOString().slice(0, 16);
    setActivePreset(p.id);
    setDocKind("birth");
    setIso(p.liveNow ? nowIso : p.iso);
    setLat(p.lat);
    setLon(p.lon);
    setPlace(p.place);
    setLabel(p.label);
    setSys(p.sys);
    setZodiac(p.zodiac);
    setTradition(p.tradition);
    setUserHouses(false);
    setUserZodiac(false);
    setTzMode("utc");
    setRelocated(false);
    setPreviewJd(null);
    setTimeUnknown(Boolean(p.timeUnknown));
    if (p.kundliStyle) setKundliStyle(p.kundliStyle);
    if (p.advanced !== undefined) setAdvanced(p.advanced);
    if (p.figure) setFigure(p.figure);
    setPaired(Boolean(p.paired));
    if (p.companion) setCompanion(p.companion);
    if (p.rail) setRail(p.rail);
    if (p.seedSet) setSet(p.seedSet);
    setTargetIso(p.targetIso ?? nowIso);
    setSelectedBody(null);
    setHoveredBody(null);
    setFocus(null);
    announce(`Loaded preset: ${p.label}.`);
  }, [announce]);

  const jumpNow = useCallback(() => {
    const nowIso = new Date().toISOString().slice(0, 16);
    setActivePreset("now");
    setDocKind("birth");
    setIso(nowIso);
    setTargetIso(nowIso);
    setTzMode("utc");
    setTimeUnknown(false);
    setPreviewJd(null);
    setLabel("Live sky");
    announce("Jumped to live UTC sky.");
  }, [announce]);

  const loadShare = useCallback((s: Share) => {
    setActivePreset(null);
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
    setSelectedBody(null);
    setFocus(null);
  }, []);

  useEffect(() => {
    const { set: urlSet, single } = readUrlState();
    const nowIso = new Date().toISOString().slice(0, 16);
    if (urlSet && urlSet.length) {
      setSet(urlSet);
      loadShare(urlSet[0]);
    } else if (single) {
      loadShare(single);
    }
    setTargetIso(nowIso);
    setReady(true);
  }, [loadShare]);

  useEffect(() => {
    const onHash = () => {
      const { set: urlSet, single } = readUrlState();
      if (urlSet && urlSet.length) {
        setSet(urlSet);
        loadShare(urlSet[0]);
      } else if (single) {
        loadShare(single);
      }
      benchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadShare]);

  const { chart, ms, error, utIso, tzStatus, natalJd } = useMemo(() => {
    const none = {
      chart: null as Chart | null, ms: 0, error: null as string | null,
      utIso: iso, tzStatus: "" as UTResult["status"] | "", natalJd: null as number | null,
    };
    if (!ready || !iso || docKind === "form") return none;
    const la = Number(lat);
    const lo = Number(lon);
    const d = new Date(iso + ":00Z");
    if (!Number.isFinite(la) || la < -90 || la > 90) return { ...none, error: "Latitude must be in [-90, 90]." };
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) return { ...none, error: "Longitude must be in [-180, 180], east positive." };
    if (Number.isNaN(d.getTime())) return { ...none, error: "Invalid date." };

    let y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, day = d.getUTCDate();
    let hh = d.getUTCHours(), mm = d.getUTCMinutes();
    if (timeUnknown) { hh = 12; mm = 0; }
    let status: UTResult["status"] | "" = "";
    if (tzMode === "local" && !timeUnknown) {
      try {
        const t = toUT({ year: y, month: mo, day, hour: hh, minute: mm, lat: la, lon: lo });
        ({ year: y, month: mo, day, hour: hh, minute: mm } = t.utc);
        status = t.status;
      } catch {
        return { ...none, error: "Could not resolve a time zone for this place." };
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
        tzStatus: status,
        natalJd: julianDay(y, mo, day, hh, mm, 0),
      };
    } catch {
      return { ...none, error: "Could not compute a chart for this instant." };
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
      const patterns = detectPatternsIn(bodies).slice(0, 2);
      const hits = chart && natalJd != null && Math.abs(jd - natalJd) > 0.25
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

  useEffect(() => {
    setFocus(null);
    setSelectedBody(null);
    setHoveredBody(null);
  }, [chart]);

  const withAspectsOf = useCallback((b: string): string[] => {
    const s = new Set<string>([b]);
    if (chart) {
      for (const a of chart.aspects) {
        if (a.a === b) s.add(a.b);
        if (a.b === b) s.add(a.a);
      }
    }
    return [...s];
  }, [chart]);

  const handleSelectBody = useCallback((body: string | null) => {
    setSelectedBody(body);
    if (!body) {
      setFocus(null);
    } else {
      setFocus({ key: `b-${body}`, bodies: withAspectsOf(body) });
    }
  }, [withAspectsOf]);

  const toggleFocus = useCallback((key: string, bodies: string[]) => {
    setFocus((f) => {
      if (f?.key === key) {
        setSelectedBody(null);
        return null;
      }
      if (key.startsWith("b-")) setSelectedBody(key.slice(2));
      else setSelectedBody(bodies[0] ?? null);
      return { key, bodies };
    });
    setFigure("natal");
  }, []);

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
      announce("Shareable URL copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      announce("Shareable URL written to address bar.");
    });
  }

  function copyJson() {
    if (!chart) return;
    navigator.clipboard?.writeText(JSON.stringify(chart, null, 2)).then(() => {
      setJsonCopied(true);
      announce("Chart JSON copied to clipboard.");
      setTimeout(() => setJsonCopied(false), 2000);
    }).catch(() => {
      announce("Clipboard unavailable.");
    });
  }

  function addToSet() {
    setSet((prev) => [...prev, currentPayload()]);
    announce("Added chart to My charts.");
  }

  function shareSet() {
    if (!set.length) return;
    const url = `${window.location.origin}${window.location.pathname}#s=${b64urlEncode({ v: 1, c: set })}`;
    window.history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url).then(() => {
      setCollectionCopied(true);
      announce("Chart set link copied.");
      setTimeout(() => setCollectionCopied(false), 2000);
    }).catch(() => {
      announce("Chart set link written to address bar.");
    });
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
    if (set.filter(isBirthShare).length >= 1) r.push("compare");
    r.push("compose");
    return r;
  }, [docKind, timeUnknown, tradition, set]);

  const advRails: RailId[] = [
    "reading", "placements", "aspects", "timing", "compare", "compose",
    "sky", "rectify", "vedic", "electional", "synthetic", "json",
  ];

  const rails = advanced
    ? advRails.filter((id) => {
        if (id === "vedic" && tradition !== "vedic") return false;
        if (id === "sky" && docKind !== "birth") return false;
        return true;
      })
    : casualRails;

  useEffect(() => {
    if (!rails.includes(rail)) setRail(rails[0] ?? "reading");
  }, [rails, rail]);

  useEffect(() => {
    if (!advanced && docKind === "form") {
      setDocKind("birth");
      setRail("reading");
    }
  }, [advanced, docKind]);

  const figureOpts = useMemo((): Array<[FigureView, string]> => {
    const natal: [FigureView, string] = tradition === "vedic" ? ["natal", "Kundli"] : ["natal", "Wheel"];
    const casual: Array<[FigureView, string]> = [natal, ["transits", "Transits"]];
    if (docKind === "birth") {
      casual.push(["sphere", "Sphere"], ["houses", "Houses"]);
      if (tradition === "western") casual.push(["derive", "Derive"], ["sect", "Sect"]);
    }
    const extra: Array<[FigureView, string]> = advanced
      ? [
          ["tri", "Tri-wheel"], ["map", "Map"], ["ephemeris", "Ephemeris"],
          ["harmonic", "Harmonic"], ["antiscia", "Antiscia"], ["heliocentric", "Heliocentric"],
          ["retrograde", "Retrograde"], ["dial", "Dial"],
        ]
      : [];
    return [...casual, ...extra];
  }, [tradition, advanced, docKind]);

  useEffect(() => {
    if (!figureOpts.some(([id]) => id === figure)) setFigure("natal");
  }, [figure, figureOpts]);

  const selectRailTab = (next: RailId) => {
    setRail(next);
    railTabRefs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onRailTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % rails.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + rails.length) % rails.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = rails.length - 1;
    if (nextIdx != null) {
      e.preventDefault();
      const id = rails[nextIdx];
      selectRailTab(id);
      railTabRefs.current[id]?.focus();
    }
  };

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
    if (figure === "ephemeris") return "Ephemeris graph";
    if (figure === "heliocentric") return "Heliocentric";
    if (figure === "houses") return "House systems";
    if (figure === "derive") return "Sky to wheel";
    if (figure === "sect") return "Sect";
    if (figure === "retrograde") return "Retrograde";
    if (figure === "dial") return "Aspect dial";
    if (figure === "antiscia" || figure === "harmonic") {
      return figure === "harmonic" ? `Harmonic ${harmonicN}` : "Antiscia";
    }
    const base = place || [lat, lon].filter(Boolean).join(", ");
    return [base, `${utIso.replace("T", " ")} UT`].filter(Boolean).join(" · ");
  })();

  const generatedCode = useMemo(
    () =>
      buildPlaygroundCode({
        docKind,
        utIso,
        targetIso: targetIso || utIso,
        lat: la,
        lon: lo,
        sys,
        zodiac,
        tradition,
        figure,
        rail,
        advanced,
        topocentric,
        spatial,
        orbOverride,
        harmonicN,
        selectedBody,
        constraints,
      }),
    [
      docKind, utIso, targetIso, la, lo, sys, zodiac, tradition, figure, rail,
      advanced, topocentric, spatial, orbOverride, harmonicN, selectedBody, constraints,
    ],
  );

  const skyExtraBodies = useMemo(
    () => [
      ...(syntheticId ? [syntheticId] : []),
      ...(extras ? extraBodyIds(engine()).filter((id) => id !== syntheticId) : []),
    ],
    [syntheticId, extras, engineTick],
  );

  if (!ready) {
    return (
      <div className="bench playground-bench" ref={benchRef}>
        <div className="tile s12">
          <div className="tile__h"><b>DOC</b><span>Loading playground</span></div>
          <div className="tile__b">
            <p className="dim small">Initializing local ephemeris engine...</p>
          </div>
        </div>
      </div>
    );
  }

  const railSpan = paired && docKind === "birth" ? "tile s12" : "tile s5";

  return (
    <div className="bench playground-bench" ref={benchRef}>
      <WorkspaceControls
        activePreset={activePreset}
        onSelectPreset={applyPreset}
        onJumpNow={jumpNow}
        tradition={tradition}
        onSwitchTradition={switchTradition}
        kundliStyle={kundliStyle}
        setKundliStyle={setKundliStyle}
        advanced={advanced}
        setAdvanced={setAdvanced}
        docKind={docKind}
        onSwitchDocKind={(kind) => {
          setDocKind(kind);
          setRail(kind === "form" ? "compose" : "reading");
        }}
        iso={iso}
        setIso={(v) => { setIso(v); setActivePreset(null); }}
        lat={lat}
        setLat={(v) => { setLat(v); setRelocated(false); setActivePreset(null); }}
        lon={lon}
        setLon={(v) => { setLon(v); setRelocated(false); setActivePreset(null); }}
        sys={sys}
        setSys={setSysTracked}
        zodiac={zodiac}
        setZodiac={setZodiacTracked}
        tzMode={tzMode}
        setTzMode={setTzMode}
        place={place}
        setPlace={setPlace}
        label={label}
        setLabel={setLabel}
        timeUnknown={timeUnknown}
        setTimeUnknown={(v) => {
          setTimeUnknown(v);
          setPreviewJd(null);
          if (v) setRail("rectify");
        }}
        topocentric={topocentric}
        setTopocentric={setTopocentric}
        extras={extras}
        setExtras={setExtras}
        spatial={spatial}
        setSpatial={setSpatial}
        orbOverride={orbOverride}
        setOrbOverride={setOrbOverride}
        set={set}
        hasChart={!!chart}
        copied={copied}
        jsonCopied={jsonCopied}
        collectionCopied={collectionCopied}
        codeOpen={codeOpen}
        onToggleCode={() => setCodeOpen((o) => !o)}
        onShare={share}
        onCopyJson={copyJson}
        onAddToSet={addToSet}
        onShareSet={shareSet}
        onLoadShare={loadShare}
        onRemoveFromSet={(i) => setSet((prev) => prev.filter((_, j) => j !== i))}
        statusMessage={statusMessage}
      />

      {(error || tzStatus === "ambiguous" || tzStatus === "nonexistent" || (chart && chart.unavailable.length > 0)) && (
        <div className="tile s12">
          <div className="tile__b stack--sm">
            {error && <p className="callout callout--bad">{error}</p>}
            {tzStatus === "ambiguous" && (
              <p className="callout callout--warm">
                This local time fell in a fall-back hour that occurred twice; the earlier instant was used.
              </p>
            )}
            {tzStatus === "nonexistent" && (
              <p className="callout callout--warm">
                This local time fell in a spring-forward gap; it was shifted forward per the zone rules.
              </p>
            )}
            {chart && chart.unavailable.length > 0 && (
              <p className="dim small">Omitted (outside fitted range): {chart.unavailable.join(", ")}.</p>
            )}
          </div>
        </div>
      )}

      {(chart || formWheel) && (
        <>
          <VizStage
            engine={engine()}
            docKind={docKind}
            tradition={tradition}
            kundliStyle={kundliStyle}
            advanced={advanced}
            chart={chart}
            formWheel={formWheel}
            figureChart={figureChart}
            figure={figure}
            setFigure={setFigure}
            figureOpts={figureOpts}
            paired={paired}
            setPaired={setPaired}
            companion={companion}
            setCompanion={setCompanion}
            harmonicN={harmonicN}
            setHarmonicN={setHarmonicN}
            natalJd={natalJd}
            targetJd={targetJd}
            lat={la}
            lon={lo}
            place={place}
            zodiac={zodiac}
            extraBodies={skyExtraBodies}
            widgetParams={widgetParams}
            transit={transit}
            progressed={progressed}
            focusBodies={focus?.bodies}
            selectedBody={selectedBody}
            hoveredBody={hoveredBody}
            onSelectBody={handleSelectBody}
            onHoverBody={setHoveredBody}
            onRelocate={(nlat, nlon, name) => {
              setLat(String(nlat));
              setLon(String(nlon));
              setRelocated(true);
              if (name) setPlace(name);
            }}
            onJumpToCode={() => setCodeOpen(true)}
            stamp={stamp}
            ms={ms}
          />

          <section className={railSpan} aria-label="Chart inspector rail">
            <div className="tile__h">
              <b>RAIL</b>
              <span>{RAIL_LABEL[rail]}</span>
              {selectedBody && (
                <i>
                  <span className="badge badge--accent mono">{selectedBody}</span>
                </i>
              )}
            </div>
            <div className="tile__b stack--sm">
              <div
                className="tabs__list tabs__list--scroll"
                role="tablist"
                aria-label="Inspector technique"
              >
                {rails.map((id, i) => (
                  <button
                    key={id}
                    ref={(el) => { railTabRefs.current[id] = el; }}
                    id={`${railBaseId}-${id}`}
                    type="button"
                    role="tab"
                    className="tabs__tab"
                    aria-selected={rail === id}
                    tabIndex={rail === id ? 0 : -1}
                    onClick={() => selectRailTab(id)}
                    onKeyDown={(e) => onRailTabKeyDown(e, i)}
                  >
                    {RAIL_LABEL[id]}
                  </button>
                ))}
              </div>

              <div
                role="tabpanel"
                aria-labelledby={`${railBaseId}-${rail}`}
                className="workspace__rail-panel"
              >
                {rail === "reading" && chart && readingInputs && (
                  <ReadingTab
                    chart={chart}
                    engine={engine()}
                    lat={la}
                    lonEast={lo}
                    zodiac={zodiac}
                    stars={readingInputs.stars}
                    lots={readingInputs.lots}
                    selectedBody={selectedBody}
                  />
                )}
                {rail === "reading" && docKind === "form" && compiled && (
                  <p className="dim small">
                    A form has no natal reading. Fit {compiled.residual.toFixed(2)}°
                    {compiled.impossible ? "; these constraints cannot be met" : ""}.
                  </p>
                )}
                {rail === "placements" && chart && (
                  <PlacementsPanel
                    chart={chart}
                    engine={engine()}
                    lat={la}
                    lon={lo}
                    zodiac={zodiac}
                    advanced={advanced}
                    extras={extras}
                    focus={focus}
                    selectedBody={selectedBody}
                    hoveredBody={hoveredBody}
                    onHoverBody={setHoveredBody}
                    onToggle={toggleFocus}
                    withAspectsOf={withAspectsOf}
                  />
                )}
                {rail === "aspects" && chart && (
                  <Aspectarian
                    chart={chart}
                    onIsolate={(bodies) => toggleFocus(bodies.join("-"), bodies)}
                  />
                )}
                {rail === "timing" && chart && natalJd != null && targetJd != null && (
                  <TimingPanel
                    engine={engine()}
                    natal={chart}
                    natalJd={natalJd}
                    targetJd={targetJd}
                    lat={la}
                    lon={lo}
                    zodiac={zodiac}
                    advanced={advanced}
                    sys={sys}
                    method={method}
                    setMethod={setMethod}
                    onSetTarget={setTargetIso}
                  />
                )}
                {rail === "compose" && (
                  <ComposePanel
                    engine={engine()}
                    natal={chart}
                    natalJd={natalJd}
                    lat={la}
                    lon={lo}
                    zodiac={zodiac}
                    constraints={constraints}
                    setConstraints={setConstraints}
                    formName={label}
                  />
                )}
                {rail === "sky" && chart && (
                  <InteractiveSkyViewTab
                    engine={engine()}
                    jdUt={targetJd ?? chart.jdUt}
                    lat={la}
                    lonEast={lo}
                    extraBodies={skyExtraBodies}
                    selectedBody={selectedBody}
                    hoveredBody={hoveredBody}
                    onSelectBody={handleSelectBody}
                    onHoverBody={setHoveredBody}
                  />
                )}
                {rail === "rectify" && (
                  <RectifyPanel
                    windows={windows}
                    knownRising={knownRising}
                    setKnownRising={setKnownRising}
                    stepMin={stepMin}
                    setStepMin={setStepMin}
                    win0={win0}
                    setWin0={setWin0}
                    win1={win1}
                    setWin1={setWin1}
                    previewSign={
                      previewJd == null
                        ? null
                        : windows.find((w) => Math.abs(w.midJd - previewJd) < 1e-6)?.sign ?? null
                    }
                    onPreview={(w) => {
                      setPreviewJd(w.midJd);
                      setFigure("natal");
                    }}
                    onApply={(w) => {
                      setIso(isoFromJd(w.midJd));
                      setTzMode("utc");
                      setPreviewJd(null);
                      setTimeUnknown(true);
                    }}
                    events={rectifyEvents}
                    setEvents={setRectifyEvents}
                    engine={engine()}
                    lat={la}
                    lon={lo}
                    zodiac={zodiac}
                    advanced={advanced}
                  />
                )}
                {rail === "vedic" && chart && natalJd != null && (
                  <VedicPanel
                    engine={engine()}
                    chart={chart}
                    natalJd={natalJd}
                    targetJd={targetJd ?? natalJd}
                    zodiac={zodiac}
                    advanced={advanced}
                    lat={la}
                    lon={lo}
                  />
                )}
                {rail === "compare" && chart && (
                  <ComparePanel
                    engine={engine()}
                    natal={chart}
                    set={set}
                    loadShare={loadShare}
                    advanced={advanced}
                    lat={la}
                    lon={lo}
                    sys={sys}
                    zodiac={zodiac}
                  />
                )}
                {rail === "electional" && targetJd != null && (
                  <ElectionalPanel
                    engine={engine()}
                    targetJd={targetJd}
                    lat={la}
                    lon={lo}
                    zodiac={zodiac}
                  />
                )}
                {rail === "synthetic" && natalJd != null && (
                  <SyntheticPanel
                    engine={engine()}
                    natalJd={natalJd}
                    onRegistered={setSyntheticId}
                  />
                )}
                {rail === "json" && chart && <JsonPanel chart={chart} advanced={advanced} />}
              </div>
            </div>
          </section>
        </>
      )}

      {docKind === "birth" && natalJd != null && targetJd != null && (
        <TimeScrubber
          engine={engine()}
          natalJd={natalJd}
          targetJd={targetJd}
          targetIso={targetIso}
          setTargetIso={setTargetIso}
          lat={la}
          lon={lo}
          zodiac={zodiac}
          chart={chart}
          selectedBody={selectedBody}
          onJumpNow={jumpNow}
        />
      )}

      {today && (
        <section className="tile s12" aria-label="Live sky telemetry">
          <div className="tile__h">
            <b>NOW</b>
            <span>Live sky against this chart</span>
            <i><span className="led led--live" aria-hidden="true" />client-side</i>
          </div>
          <div className="tile__b tile__b--compact">
            <div className="telemetry">
              <div className="telemetry__item">
                <span className="telemetry__label">Moon</span>
                <span className="telemetry__val mono num">{fmtLon(today.moon)}</span>
              </div>
              <div className="telemetry__item">
                <span className="telemetry__label">Course</span>
                <span className="telemetry__val mono">{today.voc.isVoid ? "VOC" : today.voc.sign}</span>
              </div>
              {today.hour && (
                <div className="telemetry__item">
                  <span className="telemetry__label">Hour</span>
                  <span className="telemetry__val mono">{today.hour.ruler}</span>
                </div>
              )}
              {today.hits.map((h, i) => (
                <div key={i} className="telemetry__item">
                  <span className="telemetry__label">Transit</span>
                  <span className="telemetry__val mono">{h.transit} {h.aspect} {h.natal}</span>
                </div>
              ))}
              {today.st.map((s, i) => (
                <div key={`st${i}`} className="telemetry__item">
                  <span className="telemetry__label">Station</span>
                  <span className="telemetry__val mono">{s.body} {s.dir}</span>
                </div>
              ))}
              {today.patterns.map((p, i) => (
                <div key={`p${i}`} className="telemetry__item">
                  <span className="telemetry__label">Pattern</span>
                  <span className="telemetry__val mono">{PATTERN_LABEL[p.kind] ?? p.kind}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <CodeCallDrawer
        code={generatedCode}
        chart={chart}
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        selectedBody={selectedBody}
      />
    </div>
  );
}
