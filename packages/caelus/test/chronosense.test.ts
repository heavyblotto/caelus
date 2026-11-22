/**
 * Unit invariants, edge cases, polar safety, cursor auditing, stratified
 * memory compaction, source purity, and < 2 ms latency tests for
 * packages/caelus/src/chronosense.ts (FACT-002).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  Engine,
  julianDay,
  canonicalChart,
  canonicalDigest,
  sceneGeometry,
  CHRONOSENSE_VERSION,
  TWILIGHT_CLASSES,
  WAVEFRONT_QUADRANTS,
  AUDITABLE_NUMERIC_FACTS,
  AUDITABLE_DISCRETE_FACTS,
  chronosenseEnvelope,
  auditChronosenseCursor,
  photoperiodVector,
  phaseStratumKey,
  phaseCosineSimilarity,
  stratifiedSelect,
  type ChronosenseCursor,
  type StratifiedEntry,
} from "../src/index.js";
import { loadNodeData } from "../src/node-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

let checks = 0;
let failures = 0;

function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

function throws(fn: () => unknown, msg: string): void {
  checks++;
  try {
    fn();
  } catch {
    return;
  }
  failures++;
  console.error(`FAIL ${msg} (did not throw)`);
}

function assertAllFinite(obj: unknown, path = "root"): void {
  if (typeof obj === "number") {
    ok(Number.isFinite(obj), `${path} is finite (${obj})`);
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) assertAllFinite(obj[i], `${path}[${i}]`);
  } else if (obj !== null && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) assertAllFinite(v, `${path}.${k}`);
  }
}

const FORBIDDEN_ASTRO_WORDS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
  "zodiac", "horoscope", "ascendant", "midheaven", "retrograde",
  "trine", "sextile", "conjunction", "opposition", "cazimi", "combust",
  "chaldean", "planetary", "ruler", "house",
];

function checkHeaderHygiene(header: string, label: string): void {
  ok(
    header.startsWith("[CAELUS-CHRONO ") && header.endsWith("]"),
    `${label}: header bracketed properly (${header})`,
  );
  const low = header.toLowerCase();
  for (const word of FORBIDDEN_ASTRO_WORDS) {
    ok(
      !new RegExp(`\\b${word}\\b`).test(low),
      `${label}: zero astro word '${word}' in header`,
    );
  }
  ok(
    header.includes("night_crossed=true") || header.includes("night_crossed=false"),
    `${label}: explicit night_crossed=true|false in header`,
  );
  const approxTokens = header.length / 4.0;
  ok(
    approxTokens <= 55.0,
    `${label}: header <= 55 approx tokens (${approxTokens.toFixed(1)}, len=${header.length})`,
  );
  ok(
    header.split(/\s+/).length <= 15,
    `${label}: header <= 15 whitespace tokens (${header.split(/\s+/).length})`,
  );
}

// ================================================== 1. Runtime & source purity

const chronoSrc = readFileSync(join(here, "../../src/chronosense.ts"), "utf8");
ok(!/from\s+["']node:/.test(chronoSrc), "chronosense.ts has zero node:* imports");
ok(!/\bprocess\b/.test(chronoSrc), "chronosense.ts has zero process references");
ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|readFile|writeFile)\b/.test(chronoSrc),
  "chronosense.ts has zero filesystem or network I/O");
ok(!chronoSrc.includes("\u2014"), "chronosense.ts has zero em-dashes");

ok(CHRONOSENSE_VERSION === 1, "CHRONOSENSE_VERSION === 1");
ok(TWILIGHT_CLASSES.length === 5, "TWILIGHT_CLASSES has 5 classes");
ok(WAVEFRONT_QUADRANTS.length === 4, "WAVEFRONT_QUADRANTS has 4 quadrants");
ok(AUDITABLE_NUMERIC_FACTS.size === 9, "AUDITABLE_NUMERIC_FACTS has 9 entries");
ok(AUDITABLE_DISCRETE_FACTS.size === 13, "AUDITABLE_DISCRETE_FACTS has 13 entries");

// ================================================== 2. Core envelope invariants

const jdNyc = julianDay(2026, 11, 22, 14, 30, 0);
const envNyc = chronosenseEnvelope(eng, jdNyc, 40.7128, -74.006, {
  turn: 14,
  prevJdUt: jdNyc - 852.0 / 1440.0,
  deadlineJdUt: jdNyc + 42.0 / 1440.0,
  deadlineLabel: "noon_cutoff",
  genesisDigest: "0123456789abcdef",
});
assertAllFinite(envNyc, "envNyc");
checkHeaderHygiene(envNyc.header, "envNyc");

const refDigest = canonicalDigest(canonicalChart(eng.chartAt(jdNyc, 40.7128, -74.006)));
ok(envNyc.chartDigest === refDigest, "envNyc chartDigest exact match");
ok(envNyc.clockId === refDigest.slice(0, 8), "envNyc clockId === 8-char prefix");
ok(/^[0-9a-f]{8}$/.test(envNyc.clockId), "clockId is 8 lowercase hex chars");
ok(envNyc.genesisDigest === "0123456789abcdef", "genesisDigest preserved");
ok(envNyc.turn === 14, "turn preserved");
ok(envNyc.utcIso === "2026-11-22T14:30Z", `utcIso exact (${envNyc.utcIso})`);
ok(envNyc.twilight === "daylight", `NYC 14:30Z is daylight (${envNyc.twilight})`);
ok(envNyc.sunTrend === "rising", `NYC 14:30Z is rising (${envNyc.sunTrend})`);
ok(typeof envNyc.daySlot === "number" && envNyc.daySlot >= 1 && envNyc.daySlot <= 12,
  `NYC daySlot in 1..12 (${envNyc.daySlot})`);
ok(envNyc.nightCrossed === true, "NYC 852m span across local midnight crossed night");
ok(envNyc.deadlineState === "applying", "42m future deadline is applying");
ok(Math.abs(envNyc.deadlineEtaMin! - 42.0) < 1e-6, "deadlineEtaMin === 42.0");
ok(Math.abs(envNyc.dtPrevMin! - 852.0) < 1e-6, "dtPrevMin === 852.0");
ok(envNyc.moonLonDeg >= 0.0 && envNyc.moonLonDeg < 360.0, "moonLonDeg in [0, 360)");
ok(envNyc.moonIllumPct >= 0.0 && envNyc.moonIllumPct <= 100.0, "moonIllumPct in [0, 100]");
ok(envNyc.header.includes("deadline=noon_cutoff(applying_42m)"), "separated deadline token");
ok(envNyc.header.includes("dt_prev=+852m"), "dt_prev token in header");
ok(envNyc.header.includes("next_sky=sunset(in_"), "separated next_sky(in_Nm) token");

// Minimal envelope omits optional deadline & dt_prev
const envMinimal = chronosenseEnvelope(eng, jdNyc, 40.7128, -74.006);
checkHeaderHygiene(envMinimal.header, "envMinimal");
ok(envMinimal.deadlineState === "none", "minimal deadlineState === none");
ok(envMinimal.deadlineLabel === null && envMinimal.deadlineEtaMin === null,
  "minimal deadline fields null");
ok(envMinimal.dtPrevMin === null, "minimal dtPrevMin null");
ok(envMinimal.nightCrossed === false, "minimal nightCrossed false");
ok(!envMinimal.header.includes("deadline="), "deadline omitted when null");
ok(!envMinimal.header.includes("dt_prev="), "dt_prev omitted when null");
ok(envMinimal.header.includes("night_crossed=false"), "night_crossed=false always explicit");

// Label sanitization
const envLbl = chronosenseEnvelope(eng, jdNyc, 40.7128, -74.006, {
  deadlineJdUt: jdNyc + 10.0 / 1440.0,
  deadlineLabel: "  ship [v2](now)=ok  ",
});
ok(envLbl.deadlineLabel === "ship_v2nowok", `label sanitized (${envLbl.deadlineLabel})`);
ok(envLbl.header.includes("deadline=ship_v2nowok(applying_10m)"), "sanitized label in header");

const envEmptyLbl = chronosenseEnvelope(eng, jdNyc, 40.7128, -74.006, {
  deadlineJdUt: jdNyc + 10.0 / 1440.0,
  deadlineLabel: "  ()[]=  ",
});
ok(envEmptyLbl.deadlineLabel === "deadline", "empty sanitized label falls back to 'deadline'");

// ================================================== 3. Polar, global & UTC traps

const jdOsloWin = julianDay(2026, 12, 21, 11, 20, 0);
const envOsloWin = chronosenseEnvelope(eng, jdOsloWin, 59.9139, 10.7522, {
  turn: 3,
  prevJdUt: julianDay(2026, 12, 20, 19, 0, 0),
  deadlineJdUt: jdOsloWin + 180.0 / 1440.0,
  deadlineLabel: "sunset_cutoff",
});
assertAllFinite(envOsloWin, "osloWin");
checkHeaderHygiene(envOsloWin.header, "osloWin");
ok(envOsloWin.twilight === "daylight", "Oslo winter noon is daylight");
ok(envOsloWin.sunAltDeg > 5.0 && envOsloWin.sunAltDeg < 8.0, "Oslo winter noon ~6.8 deg");
ok(envOsloWin.sunTrend === "culminating", "Oslo winter noon culminating");
ok(envOsloWin.wavefrontQuadrant === "execute", "Oslo winter noon quadrant is execute");

const jdTromsoDay = julianDay(2026, 6, 21, 12, 0, 0);
const envTromsoDay = chronosenseEnvelope(eng, jdTromsoDay, 69.6492, 18.9553, { turn: 1 });
assertAllFinite(envTromsoDay, "tromsoDay");
checkHeaderHygiene(envTromsoDay.header, "tromsoDay");
ok(envTromsoDay.daySlot === "polar_day", "Tromso Jun 21 slot is polar_day");
ok(envTromsoDay.header.includes("slot=polar_day"), "header renders slot=polar_day");
ok(envTromsoDay.horizonEvent === null && envTromsoDay.horizonEtaMin === null,
  "Tromso Jun 21 has no twilight crossing");
ok(envTromsoDay.header.includes("next_sky=polar"), "header renders next_sky=polar");
ok(envTromsoDay.wavefrontQuadrant === "execute", "Tromso polar noon quadrant is execute");

const jdTromsoNadir = julianDay(2026, 6, 21, 23, 0, 0);
const envTromsoNadir = chronosenseEnvelope(eng, jdTromsoNadir, 69.6492, 18.9553, { turn: 2 });
ok(envTromsoNadir.daySlot === "polar_day", "Tromso midnight sun is polar_day");
ok(envTromsoNadir.sunAltDeg > 0.0, "Tromso midnight sun above horizon");
ok(envTromsoNadir.wavefrontQuadrant === "consolidate",
  "Tromso midnight sun nadir rotates to consolidate");

const jdTromsoNight = julianDay(2026, 12, 21, 11, 0, 0);
const envTromsoNight = chronosenseEnvelope(eng, jdTromsoNight, 69.6492, 18.9553, {
  turn: 2,
  prevJdUt: julianDay(2026, 12, 20, 20, 0, 0),
});
assertAllFinite(envTromsoNight, "tromsoNight");
checkHeaderHygiene(envTromsoNight.header, "tromsoNight");
ok(envTromsoNight.daySlot === "polar_night", "Tromso Dec 21 slot is polar_night");
ok(envTromsoNight.header.includes("slot=polar_night"), "header renders slot=polar_night");
ok(envTromsoNight.nightCrossed === true, "Tromso polar night tracks solar midnight crossing");

const envSval = chronosenseEnvelope(eng, julianDay(2026, 12, 21, 0, 0, 0), 78.2232, 15.6267);
ok(envSval.daySlot === "polar_night", "Svalbard deep winter slot is polar_night");
ok(envSval.twilight === "night", "Svalbard winter midnight is night");
ok(envSval.wavefrontQuadrant === "consolidate", "Svalbard polar night quadrant is consolidate");

// Tokyo UTC-midnight non-crossing trap & exact due deadline
const jdTokPrev = julianDay(2026, 3, 20, 23, 0, 0);
const jdTokNow = julianDay(2026, 3, 21, 1, 0, 0);
const envTok = chronosenseEnvelope(eng, jdTokNow, 35.6762, 139.6503, {
  turn: 7,
  prevJdUt: jdTokPrev,
  deadlineJdUt: jdTokNow + 0.3 / 1440.0,
  deadlineLabel: "market_open",
});
assertAllFinite(envTok, "tokyo");
checkHeaderHygiene(envTok.header, "tokyo");
ok(envTok.nightCrossed === false, "Tokyo 23:00Z->01:00Z crosses UTC midnight but NOT local night");
ok(envTok.deadlineState === "due", "0.3m deadline is due");
ok(envTok.header.includes("deadline=market_open(due)"), "header renders due state cleanly");

// Inverse UTC trap in NYC: 03:00Z -> 07:00Z same UTC date DOES cross local solar midnight
const envNycMid = chronosenseEnvelope(eng, julianDay(2026, 11, 22, 7, 0, 0), 40.7128, -74.006, {
  prevJdUt: julianDay(2026, 11, 22, 3, 0, 0),
});
ok(envNycMid.nightCrossed === true, "NYC 03:00Z->07:00Z (same UTC date) crosses local midnight");

// Sydney Southern Hemisphere summer overdue deadline + elevation
const jdSyd = julianDay(2026, 1, 15, 4, 0, 0);
const envSyd = chronosenseEnvelope(eng, jdSyd, -33.8688, 151.2093, {
  turn: 9,
  elevationM: 58.0,
  deadlineJdUt: jdSyd - 20.0 / 1440.0,
  deadlineLabel: "deploy",
});
assertAllFinite(envSyd, "sydney");
checkHeaderHygiene(envSyd.header, "sydney");
ok(envSyd.twilight === "daylight" && envSyd.sunAltDeg > 50.0, "Sydney Jan afternoon high Sun");
ok(envSyd.deadlineState === "overdue", "20m past deadline is overdue");
ok(envSyd.header.includes("deadline=deploy(overdue_20m)"), "header renders overdue state cleanly");

// Full 24h NYC equinox sweep: all 5 twilight classes, 4 quadrants, EXP-009 safety, 12 slots
{
  const seenTwilight = new Set<string>();
  const seenQuads = new Set<string>();
  const seenTrends = new Set<string>();
  const seenSlots = new Set<number | string>();
  const jdEq0 = julianDay(2026, 3, 20, 0, 0, 0);
  for (let step = 0; step < 96; step++) {
    const e = chronosenseEnvelope(eng, jdEq0 + (step * 15.0) / 1440.0, 40.7128, -74.006);
    seenTwilight.add(e.twilight);
    seenQuads.add(e.wavefrontQuadrant);
    seenTrends.add(e.sunTrend);
    seenSlots.add(e.daySlot);
    if (e.wavefrontQuadrant === "consolidate") {
      ok(e.sunAltDeg < -6.0, "EXP-009 nocturnal safety: consolidate only below -6 deg");
    } else {
      ok(e.sunAltDeg >= -6.0, "EXP-009 daylight alignment: interactive only >= -6 deg");
    }
  }
  ok(seenTwilight.size === 5, `all 5 twilight classes covered (${Array.from(seenTwilight)})`);
  ok(seenQuads.size === 4, `all 4 wavefront quadrants covered (${Array.from(seenQuads)})`);
  ok(seenTrends.has("rising") && seenTrends.has("setting"), "rising & setting covered");
  ok(seenSlots.size === 12, `all 12 diurnal/nocturnal slots covered (${seenSlots.size})`);
}

// ================================================== 4. auditChronosenseCursor

const cleanCursor: ChronosenseCursor = {
  clockId: envNyc.clockId,
  turn: envNyc.turn,
  nightCrossedAck: true,
  deadlineEtaMin: 42.5,
  citedFacts: {
    sun_alt_deg: Number(envNyc.sunAltDeg.toFixed(1)),
    moon_illum_pct: Number(envNyc.moonIllumPct.toFixed(1)),
    horizon_eta_min: Number(envNyc.horizonEtaMin!.toFixed(1)),
    twilight: envNyc.twilight,
    wavefront_quadrant: envNyc.wavefrontQuadrant,
  },
};
const resClean = auditChronosenseCursor(envNyc, cleanCursor);
ok(resClean.ok === true, "clean cursor passes");
ok(resClean.driftFlags.length === 0, "clean cursor has zero driftFlags");
ok(resClean.correctivePrompt === null, "clean cursor correctivePrompt is null");

// camelCase citedFacts aliases also work cleanly
const resCamelFacts = auditChronosenseCursor(envNyc, {
  clockId: envNyc.clockId,
  turn: envNyc.turn,
  nightCrossedAck: true,
  deadlineEtaMin: 42.0,
  citedFacts: {
    sunAltDeg: Number(envNyc.sunAltDeg.toFixed(1)),
    wavefrontQuadrant: envNyc.wavefrontQuadrant,
  },
});
ok(resCamelFacts.ok === true, "camelCase citedFacts aliases pass");

const resCamelBad = auditChronosenseCursor(envNyc, {
  clockId: envNyc.clockId,
  turn: envNyc.turn,
  nightCrossedAck: true,
  deadlineEtaMin: 42.0,
  citedFacts: { sunAltDeg: envNyc.sunAltDeg + 5.0 },
});
ok(
  resCamelBad.ok === false && resCamelBad.driftFlags.join(",") === "fact_mismatch:sun_alt_deg",
  `camelCase citedFacts mismatch reports canonical key (${resCamelBad.driftFlags})`,
);

// clock_id_mismatch
const rClock = auditChronosenseCursor(envNyc, { ...cleanCursor, clockId: "deadbeef" });
ok(
  !rClock.ok && rClock.driftFlags.join(",") === "clock_id_mismatch",
  "clock_id_mismatch detected",
);
ok(
  rClock.correctivePrompt !== null && rClock.correctivePrompt.includes(envNyc.clockId),
  "correctivePrompt quotes authoritative clockId",
);

// turn_mismatch (stale turn, non-integer turn, boolean cast)
const rTurn = auditChronosenseCursor(envNyc, { ...cleanCursor, turn: 13 });
ok(!rTurn.ok && rTurn.driftFlags.join(",") === "turn_mismatch", "stale turn rejected");
const rTurnFloat = auditChronosenseCursor(envNyc, { ...cleanCursor, turn: 14.5 });
ok(rTurnFloat.driftFlags.includes("turn_mismatch"), "non-integer turn rejected");
const rTurnBool = auditChronosenseCursor(envMinimal, {
  clockId: envMinimal.clockId,
  turn: true as unknown as number,
});
ok(rTurnBool.driftFlags.includes("turn_mismatch"), "boolean turn rejected");

// night_crossed_unacked
const rNc = auditChronosenseCursor(envNyc, { ...cleanCursor, nightCrossedAck: false });
ok(
  !rNc.ok && rNc.driftFlags.join(",") === "night_crossed_unacked",
  "night_crossed_unacked detected",
);
const rMinOk = auditChronosenseCursor(envMinimal, { clockId: envMinimal.clockId, turn: 1 });
ok(rMinOk.ok === true, "nightCrossed=false does not require ack");

// deadline_drift
const rDlFar = auditChronosenseCursor(envNyc, { ...cleanCursor, deadlineEtaMin: 10.0 });
ok(!rDlFar.ok && rDlFar.driftFlags.join(",") === "deadline_drift", "deadline_drift > 5m");
const rDlMiss = auditChronosenseCursor(envNyc, {
  clockId: envNyc.clockId,
  turn: envNyc.turn,
  nightCrossedAck: true,
});
ok(rDlMiss.driftFlags.includes("deadline_drift"), "missing active deadline triggers drift");
const rDlHalluc = auditChronosenseCursor(envMinimal, {
  clockId: envMinimal.clockId,
  turn: 1,
  deadlineEtaMin: 30.0,
});
ok(rDlHalluc.driftFlags.includes("deadline_drift"), "hallucinated deadline triggers drift");

// Circular moon_lon_deg wrap across 0/360
const envWrap = { ...envMinimal, moonLonDeg: 359.85 };
const rWrapOk = auditChronosenseCursor(envWrap, {
  clockId: envWrap.clockId,
  turn: 1,
  citedFacts: { moon_lon_deg: 0.1 },
});
ok(rWrapOk.ok === true, "circular moon_lon_deg wrap within 0.5 deg passes");
const rWrapBad = auditChronosenseCursor(envWrap, {
  clockId: envWrap.clockId,
  turn: 1,
  citedFacts: { moon_lon_deg: 1.0 },
});
ok(
  rWrapBad.driftFlags.join(",") === "fact_mismatch:moon_lon_deg",
  "circular moon_lon_deg wrap outside 0.5 deg fails",
);

// Polar null horizon_eta_min cited as null vs numeric
const rPolarOk = auditChronosenseCursor(envTromsoDay, {
  clockId: envTromsoDay.clockId,
  turn: 1,
  citedFacts: { horizon_eta_min: null },
});
ok(rPolarOk.ok === true, "polar horizon_eta_min=null passes");
const rPolarBad = auditChronosenseCursor(envTromsoDay, {
  clockId: envTromsoDay.clockId,
  turn: 1,
  citedFacts: { horizon_eta_min: 60.0 },
});
ok(
  rPolarBad.driftFlags.join(",") === "fact_mismatch:horizon_eta_min",
  "hallucinated polar horizon_eta_min fails",
);

// Non-object cursor & non-object citedFacts
const rNonObj = auditChronosenseCursor(envNyc, "not-an-object");
ok(!rNonObj.ok && rNonObj.driftFlags.length === 4, "non-object cursor produces 4 structural flags");
const rBadCited = auditChronosenseCursor(envMinimal, {
  clockId: envMinimal.clockId,
  turn: 1,
  citedFacts: ["bad"] as unknown as Record<string, number>,
});
ok(
  rBadCited.driftFlags.join(",") === "unknown_fact:cited_facts",
  "non-record citedFacts produces unknown_fact:cited_facts",
);

// ================================================== 5. Phase vector & stratum

const scOsloWinNoon = sceneGeometry(eng, julianDay(2026, 12, 21, 11, 20, 0), 59.9139, 10.7522);
const scOsloEqNoon = sceneGeometry(eng, julianDay(2026, 9, 22, 11, 10, 0), 59.9139, 10.7522);
const scOsloWinMid = sceneGeometry(eng, julianDay(2026, 12, 21, 23, 20, 0), 59.9139, 10.7522);
const scNycNoon = sceneGeometry(eng, julianDay(2026, 9, 22, 16, 50, 0), 40.7128, -74.006);
const scTokNoon = sceneGeometry(eng, julianDay(2026, 9, 22, 2, 35, 0), 35.6762, 139.6503);
const scTromsoDay = sceneGeometry(eng, jdTromsoDay, 69.6492, 18.9553);
const scTromsoNight = sceneGeometry(eng, jdTromsoNight, 69.6492, 18.9553);

const scenes = [
  ["osloWinNoon", scOsloWinNoon],
  ["osloEqNoon", scOsloEqNoon],
  ["osloWinMid", scOsloWinMid],
  ["nycNoon", scNycNoon],
  ["tokNoon", scTokNoon],
  ["tromsoDay", scTromsoDay],
  ["tromsoNight", scTromsoNight],
] as const;

const vecs: Record<string, number[]> = {};
for (const [name, sc] of scenes) {
  const v = photoperiodVector(sc);
  vecs[name] = v;
  ok(v.length === 10, `${name} photoperiodVector len === 10`);
  ok(v.every((x) => Number.isFinite(x)), `${name} photoperiodVector all finite`);
  const nrm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  ok(Math.abs(nrm - 1.0) < 1e-12, `${name} photoperiodVector unit norm (${nrm})`);
  ok(Math.abs(phaseCosineSimilarity(v, v) - 1.0) < 1e-12, `${name} self cosine === 1.0`);
}

const cosAb = phaseCosineSimilarity(vecs.osloWinNoon, vecs.osloEqNoon);
const cosBa = phaseCosineSimilarity(vecs.osloEqNoon, vecs.osloWinNoon);
ok(Math.abs(cosAb - cosBa) < 1e-15, "cosine similarity is symmetric");

const cosWinMid = phaseCosineSimilarity(vecs.osloWinNoon, vecs.osloWinMid);
ok(cosAb > 0.85, `Oslo winter noon aligns with equinox noon (${cosAb.toFixed(4)})`);
ok(cosWinMid < -0.5, `Oslo winter noon opposes winter midnight (${cosWinMid.toFixed(4)})`);
ok(cosAb > cosWinMid + 1.0, "strong day/night phase separation at 59.9N winter");

const cosTravel = phaseCosineSimilarity(vecs.nycNoon, vecs.tokNoon);
ok(cosTravel > 0.9, `NYC noon aligns with Tokyo noon (${cosTravel.toFixed(4)})`);

const scNycEarlyNight = sceneGeometry(eng, julianDay(2026, 3, 21, 1, 0, 0), 40.7128, -74.006);
const scNycPredawn = sceneGeometry(eng, julianDay(2026, 3, 21, 9, 0, 0), 40.7128, -74.006);
const cosNightProg = phaseCosineSimilarity(
  photoperiodVector(scNycEarlyNight),
  photoperiodVector(scNycPredawn),
);
ok(cosNightProg < 0.75, `early night vs pre-dawn distinct (${cosNightProg.toFixed(4)})`);
ok(phaseCosineSimilarity([0, 0], [1, 0]) === 0.0, "zero vector cosine === 0.0");

ok(phaseStratumKey(scOsloWinNoon, 10.7522) === "day:dec_sol:lon3", "Oslo winter noon stratum");
ok(phaseStratumKey(scOsloWinMid, 10.7522) === "night:dec_sol:lon3", "Oslo winter midnight stratum");
ok(phaseStratumKey(scNycNoon, -74.006) === "day:sep_eq:lon1", "NYC equinox noon stratum");
ok(phaseStratumKey(scTokNoon, 139.6503) === "day:sep_eq:lon5", "Tokyo equinox noon stratum");
ok(phaseStratumKey(scTromsoNight, 18.9553) === "twilight:dec_sol:lon3", "Tromso civil stratum");
ok(
  phaseStratumKey(scNycNoon) === phaseStratumKey(scNycNoon, -74.006),
  "phaseStratumKey defaults lonEast to scene.lonEast",
);
ok(
  phaseStratumKey(scNycNoon, -180.0) === phaseStratumKey(scNycNoon, 180.0),
  "phaseStratumKey wraps cleanly across antimeridian",
);

// ================================================== 6. stratifiedSelect

interface TaggedMemory extends StratifiedEntry {
  note: string;
}

const entries: TaggedMemory[] = [];
for (let i = 0; i < 100; i++) {
  entries.push({
    id: `day-${String(i).padStart(3, "0")}`,
    stratum: "day:jun_sol:lon3",
    score: 100.0 + i,
    note: `d${i}`,
  });
}
for (let i = 0; i < 5; i++) {
  entries.push({
    id: `twi-${String(i).padStart(2, "0")}`,
    stratum: "twilight:jun_sol:lon3",
    score: 10.0 + i,
    note: `tw${i}`,
  });
  entries.push({
    id: `ngt-${String(i).padStart(2, "0")}`,
    stratum: "night:jun_sol:lon3",
    score: 20.0 + i,
    note: `n${i}`,
  });
  entries.push({
    id: `tok-${String(i).padStart(2, "0")}`,
    stratum: "day:jun_sol:lon5",
    score: 30.0 + i,
    note: `tk${i}`,
  });
}

const snapshot = JSON.stringify(entries);
const picked20 = stratifiedSelect(entries, 20);
ok(JSON.stringify(entries) === snapshot, "stratifiedSelect does not mutate input");
ok(picked20.length === 20, `stratifiedSelect honors budget (${picked20.length})`);
ok(picked20[0].note === "d99", "generic entry extra properties preserved");

const counts: Record<string, number> = {};
for (const item of picked20) counts[item.stratum] = (counts[item.stratum] ?? 0) + 1;
ok(
  counts["day:jun_sol:lon3"] === 5
    && counts["twilight:jun_sol:lon3"] === 5
    && counts["night:jun_sol:lon3"] === 5
    && counts["day:jun_sol:lon5"] === 5,
  `balanced 5/5/5/5 retention across all 4 strata (${JSON.stringify(counts)})`,
);

const dayIds = picked20.filter((x) => x.stratum === "day:jun_sol:lon3").map((x) => x.id);
ok(
  dayIds.join(",") === "day-099,day-098,day-097,day-096,day-095",
  `highest-scoring daytime exemplars retained (${dayIds.join(",")})`,
);

const picked30 = stratifiedSelect(entries, 30);
ok(picked30.length === 30, "remainder fill uses full budget");
const dayCount30 = picked30.filter((x) => x.stratum === "day:jun_sol:lon3").length;
ok(dayCount30 === 15, `dominant stratum receives remaining 15 slots (${dayCount30})`);

// Deterministic shuffle invariance (Mulberry32)
let seed = 20261122 >>> 0;
const nextRand = (): number => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
};
const shuffled = [...entries];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(nextRand() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const pickedShuffled = stratifiedSelect(shuffled, 20);
ok(
  pickedShuffled.map((x) => x.id).join(",") === picked20.map((x) => x.id).join(","),
  "stratifiedSelect is invariant to input order",
);

const recEntries: StratifiedEntry[] = [
  { id: "a1", stratum: "s1", recency: 1 },
  { id: "a2", stratum: "s1", recency: 9 },
  { id: "b1", stratum: "s2", recency: 5 },
  { id: "b2", stratum: "s2", recency: 2 },
];
const pickedRec = stratifiedSelect(recEntries, 2);
ok(pickedRec.map((x) => x.id).join(",") === "a2,b1", "recency key supported cleanly");
ok(stratifiedSelect(entries, 0).length === 0, "budget=0 returns []");
ok(stratifiedSelect([], 10).length === 0, "empty entries returns []");
ok(stratifiedSelect(recEntries, 10).length === 4, "budget > len keeps all");
const picked2 = stratifiedSelect(entries, 2);
ok(
  picked2.map((x) => x.stratum).join(",") === "day:jun_sol:lon3,day:jun_sol:lon5",
  "budget < strata picks peak-score strata",
);

// ================================================== 7. Validation errors

throws(() => chronosenseEnvelope(eng, Number.NaN, 40.0, -74.0), "NaN jdUt rejected");
throws(() => chronosenseEnvelope(eng, jdNyc, 40.0, -74.0, { turn: 0 }), "turn=0 rejected");
throws(() => chronosenseEnvelope(eng, jdNyc, 40.0, -74.0, { turn: 1.5 }), "float turn rejected");
throws(
  () => chronosenseEnvelope(eng, jdNyc, 40.0, -74.0, { prevJdUt: Number.POSITIVE_INFINITY }),
  "infinite prevJdUt rejected",
);
throws(
  () => auditChronosenseCursor(envNyc, cleanCursor, { deadlineToleranceMin: -1.0 }),
  "negative deadlineToleranceMin rejected",
);
throws(
  () => auditChronosenseCursor(envNyc, cleanCursor, { factTolerance: -0.1 }),
  "negative factTolerance rejected",
);
throws(() => phaseCosineSimilarity([1.0, 0.0], [1.0]), "mismatched vector lengths rejected");
throws(() => phaseCosineSimilarity([], []), "empty vectors rejected");
throws(() => phaseStratumKey(scNycNoon, Number.NaN), "NaN lonEast rejected");
throws(() => stratifiedSelect(entries, -1), "negative budget rejected");
throws(() => stratifiedSelect(entries, 1.5), "non-integer budget rejected");

// ================================================== 8. < 2 ms latency budgets

// Warm up JIT before timing
for (let i = 0; i < 50; i++) {
  sceneGeometry(eng, jdNyc + i * 0.0001, 40.7128, -74.006);
  chronosenseEnvelope(eng, jdNyc + i * 0.0001, 40.7128, -74.006, { turn: 14 });
  auditChronosenseCursor(envNyc, cleanCursor);
  const va = photoperiodVector(scOsloWinNoon);
  const vb = photoperiodVector(scNycNoon);
  phaseStratumKey(scOsloWinNoon, 10.7522);
  phaseCosineSimilarity(va, vb);
}

const N_ENV = 200;
let t0 = performance.now();
for (let i = 0; i < N_ENV; i++) {
  sceneGeometry(eng, jdNyc + i * 0.0007, 40.7128, -74.006);
}
const sceneMs = (performance.now() - t0) / N_ENV;

t0 = performance.now();
for (let i = 0; i < N_ENV; i++) {
  chronosenseEnvelope(eng, jdNyc + i * 0.0007, 40.7128, -74.006, { turn: 14 });
}
const envMs = (performance.now() - t0) / N_ENV;
const envOverheadMs = Math.max(0, envMs - sceneMs);
ok(envOverheadMs < 2.0, `chronosenseEnvelope overhead over sceneGeometry < 2 ms (${envOverheadMs.toFixed(4)} ms)`);
ok(envMs < 5.0, `chronosenseEnvelope end-to-end < 5 ms (${envMs.toFixed(4)} ms)`);

const N_AUDIT = 2000;
t0 = performance.now();
for (let i = 0; i < N_AUDIT; i++) {
  auditChronosenseCursor(envNyc, cleanCursor);
}
const auditMs = (performance.now() - t0) / N_AUDIT;
ok(auditMs < 2.0, `auditChronosenseCursor < 2 ms (${auditMs.toFixed(4)} ms)`);

const N_VEC = 2000;
t0 = performance.now();
for (let i = 0; i < N_VEC; i++) {
  const va = photoperiodVector(scOsloWinNoon);
  const vb = photoperiodVector(scNycNoon);
  phaseStratumKey(scOsloWinNoon, 10.7522);
  phaseCosineSimilarity(va, vb);
}
const vecMs = (performance.now() - t0) / N_VEC;
ok(vecMs < 2.0, `photoperiodVector + stratum + cosine < 2 ms (${vecMs.toFixed(4)} ms)`);

const horizons = ["day", "twilight", "night"] as const;
const seasons = ["mar_eq", "jun_sol", "sep_eq", "dec_sol"] as const;
const entries360: StratifiedEntry[] = Array.from({ length: 360 }, (_, i) => ({
  id: `m-${String(i).padStart(3, "0")}`,
  stratum: `${horizons[i % 3]}:${seasons[Math.floor(i / 3) % 4]}:lon${Math.floor(i / 12) % 6}`,
  score: ((i * 37) % 1000) / 10.0,
}));
for (let i = 0; i < 50; i++) stratifiedSelect(entries360, 90);
const N_COMP = 500;
t0 = performance.now();
for (let i = 0; i < N_COMP; i++) {
  stratifiedSelect(entries360, 90);
}
const compMs = (performance.now() - t0) / N_COMP;
ok(compMs < 2.0, `stratifiedSelect(360 -> 90) < 2 ms (${compMs.toFixed(4)} ms)`);

console.log(
  `chronosense: ${checks - failures}/${checks} checks passed `
    + `(envelope=${envMs.toFixed(4)}ms, overhead=${envOverheadMs.toFixed(4)}ms, `
    + `audit=${auditMs.toFixed(4)}ms, vec+stratum+cos=${vecMs.toFixed(4)}ms, `
    + `stratified360=${compMs.toFixed(4)}ms)`,
);
process.exit(failures === 0 ? 0 : 1);
