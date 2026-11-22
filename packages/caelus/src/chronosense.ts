/**
 * astroengine chronosense -- zero-dependency temporal middleware and citation
 * auditor for LLM agents (FACT-002).
 *
 * Four pure, runtime-agnostic primitives built directly on validated Caelus
 * physics (`observe.sceneGeometry` and `canonical.canonicalChart` /
 * `canonicalDigest`):
 *
 * 1. `chronosenseEnvelope`: computes an unambiguous physical-horizon envelope,
 *    8-char canonical chart digest (`clockId`), explicit local solar-midnight
 *    `nightCrossed`, photoperiod-warped `daySlot` (`1..12` or `"polar_day"` /
 *    `"polar_night"`), separated horizon vs. deadline countdowns (zero adjacent
 *    colliding minute labels, per EXP-005), follow-the-sun `wavefrontQuadrant`
 *    (per EXP-009), and a compact plain-text header with zero astrological words.
 * 2. `auditChronosenseCursor`: deterministic pre-tool write-back cursor and
 *    fact provenance auditor verifying `clockId`, monotonic `turn`, explicit
 *    `nightCrossedAck`, active deadline drift, and `citedFacts` against the
 *    authoritative envelope.
 * 3. `photoperiodVector`, `phaseStratumKey`, `phaseCosineSimilarity`:
 *    10-D L2-normalized physical phase descriptor (EXP-002) and unsupervised
 *    horizon x season x longitude stratum key (EXP-007) for circadian-aware
 *    episodic memory retrieval and continual consolidation.
 * 4. `stratifiedSelect`: deterministic bucket-preserving compaction selector
 *    that retains balanced top exemplars across every distinct physical stratum
 *    up to `budget` so dominant daytime streams never evict nocturnal, seasonal,
 *    or travel strata.
 *
 * Zero runtime dependencies; mirrors python/astroengine/chronosense.py.
 */
import { DEG, calendarDate, mod } from "./core.js";
import type { Engine } from "./chart.js";
import { canonicalChart, canonicalDigest, roundHalfUp } from "./canonical.js";
import {
  sceneGeometry,
  type SceneGeometry,
  type SunTrend,
  type TwilightTransitionKind,
} from "./observe.js";
import type { TwilightStage } from "./skyview.js";

const TWO_PI = 2.0 * Math.PI;

/** Schema version of the chronosense middleware contract. */
export const CHRONOSENSE_VERSION = 1 as const;

/** 5-class physical twilight taxonomy used in chronosense envelopes. */
export const TWILIGHT_CLASSES = [
  "daylight",
  "civil",
  "nautical",
  "astronomical",
  "night",
] as const;

/** Follow-the-sun solar-horizon wavefront quadrants (EXP-009). */
export const WAVEFRONT_QUADRANTS = [
  "initiate",
  "execute",
  "review",
  "consolidate",
] as const;

const SEASON_QUADRANTS = [
  "mar_eq",
  "jun_sol",
  "sep_eq",
  "dec_sol",
] as const;

/** Authoritative numeric envelope fact names accepted in `cursor.citedFacts`. */
export const AUDITABLE_NUMERIC_FACTS: ReadonlySet<string> = new Set([
  "sun_alt_deg",
  "moon_illum_pct",
  "moon_lon_deg",
  "horizon_eta_min",
  "deadline_eta_min",
  "dt_prev_min",
  "lat",
  "lon_east",
  "elevation_m",
]);

/** Authoritative discrete envelope fact names accepted in `cursor.citedFacts`. */
export const AUDITABLE_DISCRETE_FACTS: ReadonlySet<string> = new Set([
  "clock_id",
  "turn",
  "utc_iso",
  "sun_trend",
  "twilight",
  "day_slot",
  "is_day",
  "night_crossed",
  "horizon_event",
  "deadline_label",
  "deadline_state",
  "moon_waxing",
  "wavefront_quadrant",
]);

// ---------------------------------------------------------------- public types

/** Normalized 5-class twilight stage in a {@link ChronosenseEnvelope}. */
export type ChronosenseTwilight = (typeof TWILIGHT_CLASSES)[number];

/** 3-state physical solar altitude trend. */
export type ChronosenseSunTrend = "rising" | "culminating" | "setting";

/** Photoperiod-warped 1..12 diurnal/nocturnal slot, or polar regime tag. */
export type ChronosenseDaySlot = number | "polar_day" | "polar_night";

/** Discrete deadline proximity state. */
export type ChronosenseDeadlineState = "none" | "applying" | "due" | "overdue";

/** Follow-the-sun solar-horizon quadrant (EXP-009). */
export type WavefrontQuadrant = (typeof WAVEFRONT_QUADRANTS)[number];

/** Value allowed in `cursor.citedFacts`. */
export type ChronosenseFactValue = number | string | boolean | null;

/** Optional parameters for {@link chronosenseEnvelope}. */
export interface ChronosenseEnvelopeOptions {
  turn?: number;
  prevJdUt?: number | null;
  deadlineJdUt?: number | null;
  deadlineLabel?: string | null;
  elevationM?: number;
  genesisDigest?: string | null;
}

/** Deterministic physical-horizon chronosense envelope for an agent turn. */
export interface ChronosenseEnvelope {
  clockId: string;
  chartDigest: string;
  genesisDigest: string | null;
  turn: number;
  jdUt: number;
  utcIso: string;
  lat: number;
  lonEast: number;
  elevationM: number;
  sunAltDeg: number;
  sunTrend: ChronosenseSunTrend;
  twilight: ChronosenseTwilight;
  daySlot: ChronosenseDaySlot;
  isDay: boolean;
  nightCrossed: boolean;
  horizonEvent: TwilightTransitionKind | null;
  horizonEtaMin: number | null;
  deadlineLabel: string | null;
  deadlineEtaMin: number | null;
  deadlineState: ChronosenseDeadlineState;
  moonLonDeg: number;
  moonIllumPct: number;
  moonWaxing: boolean;
  dtPrevMin: number | null;
  wavefrontQuadrant: WavefrontQuadrant;
  header: string;
}

/**
 * Agent write-back cursor passed to {@link auditChronosenseCursor}.
 * Accepts idiomatic camelCase keys as well as snake_case wire aliases
 * (`clock_id`, `night_crossed_ack`, `deadline_eta_min`, `cited_facts`).
 */
export interface ChronosenseCursor {
  clockId?: string | null;
  turn?: number | null;
  nightCrossedAck?: boolean | null;
  deadlineEtaMin?: number | null;
  citedFacts?: Record<string, ChronosenseFactValue> | null;
  clock_id?: string | null;
  night_crossed_ack?: boolean | null;
  deadline_eta_min?: number | null;
  cited_facts?: Record<string, ChronosenseFactValue> | null;
}

/** Tolerance options for {@link auditChronosenseCursor}. */
export interface ChronosenseAuditOptions {
  deadlineToleranceMin?: number;
  factTolerance?: number;
}

/** Deterministic verdict returned by {@link auditChronosenseCursor}. */
export interface ChronosenseAuditResult {
  ok: boolean;
  driftFlags: string[];
  correctivePrompt: string | null;
}

/** Memory entry accepted by {@link stratifiedSelect}. */
export interface StratifiedEntry {
  id: string | number;
  stratum: string;
  score?: number | null;
  recency?: number | null;
}

// ------------------------------------------------------------------ fact table

interface FactSpec {
  readonly canonicalKey: string;
  readonly prop: keyof ChronosenseEnvelope;
  readonly kind: "numeric" | "discrete";
  readonly circular?: boolean;
}

const FACT_SPECS: readonly (FactSpec & { readonly camelAlias?: string })[] = [
  { canonicalKey: "sun_alt_deg", camelAlias: "sunAltDeg", prop: "sunAltDeg", kind: "numeric" },
  { canonicalKey: "moon_illum_pct", camelAlias: "moonIllumPct", prop: "moonIllumPct", kind: "numeric" },
  { canonicalKey: "moon_lon_deg", camelAlias: "moonLonDeg", prop: "moonLonDeg", kind: "numeric", circular: true },
  { canonicalKey: "horizon_eta_min", camelAlias: "horizonEtaMin", prop: "horizonEtaMin", kind: "numeric" },
  { canonicalKey: "deadline_eta_min", camelAlias: "deadlineEtaMin", prop: "deadlineEtaMin", kind: "numeric" },
  { canonicalKey: "dt_prev_min", camelAlias: "dtPrevMin", prop: "dtPrevMin", kind: "numeric" },
  { canonicalKey: "lat", prop: "lat", kind: "numeric" },
  { canonicalKey: "lon_east", camelAlias: "lonEast", prop: "lonEast", kind: "numeric" },
  { canonicalKey: "elevation_m", camelAlias: "elevationM", prop: "elevationM", kind: "numeric" },
  { canonicalKey: "clock_id", camelAlias: "clockId", prop: "clockId", kind: "discrete" },
  { canonicalKey: "turn", prop: "turn", kind: "discrete" },
  { canonicalKey: "utc_iso", camelAlias: "utcIso", prop: "utcIso", kind: "discrete" },
  { canonicalKey: "sun_trend", camelAlias: "sunTrend", prop: "sunTrend", kind: "discrete" },
  { canonicalKey: "twilight", prop: "twilight", kind: "discrete" },
  { canonicalKey: "day_slot", camelAlias: "daySlot", prop: "daySlot", kind: "discrete" },
  { canonicalKey: "is_day", camelAlias: "isDay", prop: "isDay", kind: "discrete" },
  { canonicalKey: "night_crossed", camelAlias: "nightCrossed", prop: "nightCrossed", kind: "discrete" },
  { canonicalKey: "horizon_event", camelAlias: "horizonEvent", prop: "horizonEvent", kind: "discrete" },
  { canonicalKey: "deadline_label", camelAlias: "deadlineLabel", prop: "deadlineLabel", kind: "discrete" },
  { canonicalKey: "deadline_state", camelAlias: "deadlineState", prop: "deadlineState", kind: "discrete" },
  { canonicalKey: "moon_waxing", camelAlias: "moonWaxing", prop: "moonWaxing", kind: "discrete" },
  { canonicalKey: "wavefront_quadrant", camelAlias: "wavefrontQuadrant", prop: "wavefrontQuadrant", kind: "discrete" },
];

const FACT_LOOKUP = new Map<string, FactSpec>();
for (const spec of FACT_SPECS) {
  FACT_LOOKUP.set(spec.canonicalKey, spec);
  if (spec.camelAlias) {
    FACT_LOOKUP.set(spec.camelAlias, spec);
  }
}

// ------------------------------------------------------------------ helpers

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Signed angle in (-180, 180] degrees. */
function wrap180(x: number): number {
  const r = mod(x + 180.0, 360.0) - 180.0;
  return r === -180.0 ? 180.0 : r;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isPlainRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function lexCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deterministic fixed-decimal string matching Python `_fmt_fixed` / `_js_round`. */
function fmtFixed(x: number, decimals: number): string {
  const scale = 10 ** decimals;
  const n = roundHalfUp(x * scale);
  if (n === 0) return decimals === 0 ? "0" : `0.${"0".repeat(decimals)}`;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (decimals === 0) return `${sign}${a}`;
  const whole = Math.floor(a / scale);
  const frac = a % scale;
  return `${sign}${whole}.${String(frac).padStart(decimals, "0")}`;
}

function fmtSignedFixed(x: number, decimals = 1): string {
  const s = fmtFixed(x, decimals);
  return s.startsWith("-") ? s : `+${s}`;
}

function fmtSignedInt(x: number): string {
  const n = roundHalfUp(x);
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Format UT Julian Day rounded to nearest minute as YYYY-MM-DDTHH:MMZ. */
function formatIsoMinute(jdUt: number): string {
  const cal = calendarDate(jdUt + 0.5 / 1440.0, "gregorian");
  const totalMin = Math.floor(cal.hour * 60.0 + 1e-9);
  const hh = Math.min(23, Math.floor(totalMin / 60));
  const mm = totalMin % 60;
  const yrStr = cal.year < 0
    ? `-${String(Math.abs(cal.year)).padStart(4, "0")}`
    : String(cal.year).padStart(4, "0");
  return `${yrStr}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}Z`;
}

function sanitizeLabel(label: string | null | undefined): string {
  if (label === null || label === undefined) return "deadline";
  const trimmed = String(label).trim();
  const s = trimmed.length > 0 ? trimmed.split(/\s+/).join("_") : "";
  const cleaned = s.replace(/[()[\]=]/g, "");
  return cleaned.length > 0 ? cleaned : "deadline";
}

function normalizeTwilight(stage: TwilightStage): ChronosenseTwilight {
  return stage === "day" ? "daylight" : stage;
}

function normalizeSunTrend(trend: SunTrend): ChronosenseSunTrend {
  return trend === "nadir" ? "culminating" : trend;
}

/**
 * Pure closed-form apparent solar ecliptic longitude in [0, 360) degrees
 * (~0.01 deg accuracy, Meeus Ch. 25). Zero engine dependency so
 * `photoperiodVector(scene)` and `phaseStratumKey(scene)` stay pure.
 */
function approxSunLonDeg(jdUt: number): number {
  const t = (jdUt - 2451545.0) / 36525.0;
  const l0 = mod(280.46646 + t * (36000.76983 + 0.0003032 * t), 360.0);
  const m = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * DEG;
  const c = (1.914602 - t * (0.004817 + 0.000014 * t)) * Math.sin(m)
    + (0.019993 - 0.000101 * t) * Math.sin(2.0 * m)
    + 0.000289 * Math.sin(3.0 * m);
  return mod(l0 + c, 360.0);
}

function computeDaySlot(scene: SceneGeometry): ChronosenseDaySlot {
  const ph = scene.diurnal.planetaryHour;
  if (ph !== null) {
    return mod(ph.hour - 1, 12) + 1;
  }
  return scene.sun.isDay ? "polar_day" : "polar_night";
}

function computeWavefrontQuadrant(scene: SceneGeometry): WavefrontQuadrant {
  const alt = scene.sun.altitudeApparentDeg;
  const rateAlt = scene.sun.rateAltDegPerMin;
  if (alt < -6.0) return "consolidate";
  if (alt < 0.0) return rateAlt >= 0.0 ? "initiate" : "review";

  const { sunriseJd, sunsetJd, solarNoonJd } = scene.diurnal;
  if (sunriseJd !== null && sunsetJd !== null && sunsetJd > sunriseJd) {
    const u = clamp((scene.jdUt - sunriseJd) / (sunsetJd - sunriseJd), 0.0, 1.0);
    if (u < 0.3) return "initiate";
    if (u < 0.7) return "execute";
    return "review";
  }

  if (solarNoonJd !== null) {
    const dh = mod((scene.jdUt - solarNoonJd) * 24.0 + 36.0, 24.0) - 12.0;
    if (dh >= -6.0 && dh < -2.0) return "initiate";
    if (dh >= -2.0 && dh < 2.0) return "execute";
    if (dh >= 2.0 && dh < 6.0) return "review";
    return "consolidate";
  }

  return "execute";
}

function buildHeader(params: {
  clockId: string;
  turn: number;
  utcIso: string;
  sunAltDeg: number;
  sunTrend: ChronosenseSunTrend;
  twilight: ChronosenseTwilight;
  daySlot: ChronosenseDaySlot;
  nightCrossed: boolean;
  horizonEvent: TwilightTransitionKind | null;
  horizonEtaMin: number | null;
  deadlineLabel: string | null;
  deadlineState: ChronosenseDeadlineState;
  deadlineEtaMin: number | null;
  dtPrevMin: number | null;
}): string {
  const altS = fmtSignedFixed(params.sunAltDeg, 1);
  const slotS = typeof params.daySlot === "number" ? `${params.daySlot}/12` : params.daySlot;
  const ncS = params.nightCrossed ? "true" : "false";
  let nextSkyS: string;
  if (params.horizonEvent !== null && params.horizonEtaMin !== null) {
    const etaInt = Math.max(0, roundHalfUp(params.horizonEtaMin));
    nextSkyS = `next_sky=${params.horizonEvent}(in_${etaInt}m)`;
  } else {
    nextSkyS = "next_sky=polar";
  }

  const tokens = [
    "[CAELUS-CHRONO",
    `clock=${params.clockId}`,
    `turn=${params.turn}`,
    `utc=${params.utcIso}`,
    `sun_alt=${altS}deg(${params.sunTrend})`,
    `sky=${params.twilight}`,
    `slot=${slotS}`,
    `night_crossed=${ncS}`,
    nextSkyS,
  ];

  if (params.deadlineState !== "none" && params.deadlineLabel !== null) {
    if (params.deadlineState === "due") {
      tokens.push(`deadline=${params.deadlineLabel}(due)`);
    } else if (params.deadlineEtaMin !== null) {
      const dlMin = Math.max(0, roundHalfUp(Math.abs(params.deadlineEtaMin)));
      tokens.push(`deadline=${params.deadlineLabel}(${params.deadlineState}_${dlMin}m)`);
    }
  }

  if (params.dtPrevMin !== null) {
    tokens.push(`dt_prev=${fmtSignedInt(params.dtPrevMin)}m`);
  }

  return `${tokens.join(" ")}]`;
}

// ------------------------------------------------ Primitive 1: envelope

/**
 * Compute a deterministic physical-horizon chronosense envelope for an agent
 * turn at `(jdUt, lat, lonEast)`.
 *
 * Calls {@link sceneGeometry} and computes an 8-char lowercase hex `clockId`
 * from `canonicalDigest(canonicalChart(engine.chartAt(jdUt, lat, lonEast)))`.
 * Uses `sceneGeometry.diurnal.minutesToNextTwilight` directly for horizon
 * countdowns (KILL-005) and separates horizon vs. deadline formatting (EXP-005).
 */
export function chronosenseEnvelope(
  engine: Engine,
  jdUt: number,
  lat: number,
  lonEast: number,
  opts: ChronosenseEnvelopeOptions = {},
): ChronosenseEnvelope {
  const turn = opts.turn ?? 1;
  const prevJdUt = opts.prevJdUt ?? null;
  const deadlineJdUt = opts.deadlineJdUt ?? null;
  const deadlineLabelOpt = opts.deadlineLabel === undefined ? "deadline" : opts.deadlineLabel;
  const elevationM = opts.elevationM ?? 0.0;
  const genesisDigest = opts.genesisDigest ?? null;

  if (!isFiniteNumber(jdUt)) {
    throw new RangeError(`jdUt must be finite, got ${jdUt}`);
  }
  if (typeof turn !== "number" || !Number.isInteger(turn) || turn < 1) {
    throw new RangeError(`turn must be an integer >= 1, got ${turn}`);
  }
  if (prevJdUt !== null && !isFiniteNumber(prevJdUt)) {
    throw new RangeError(`prevJdUt must be finite or null, got ${prevJdUt}`);
  }
  if (deadlineJdUt !== null && !isFiniteNumber(deadlineJdUt)) {
    throw new RangeError(`deadlineJdUt must be finite or null, got ${deadlineJdUt}`);
  }
  if (genesisDigest !== null && typeof genesisDigest !== "string") {
    throw new TypeError(`genesisDigest must be string or null, got ${typeof genesisDigest}`);
  }

  const scene = sceneGeometry(engine, jdUt, lat, lonEast, {
    elevationM,
    prevJdUt: prevJdUt ?? undefined,
    deadlineJdUt: deadlineJdUt ?? undefined,
  });
  const chart = engine.chartAt(jdUt, lat, lonEast);
  const fullDigest = canonicalDigest(canonicalChart(chart));
  const clockId = fullDigest.slice(0, 8);

  const utcIso = formatIsoMinute(jdUt);
  const sunAltDeg = scene.sun.altitudeApparentDeg;
  const sunTrend = normalizeSunTrend(scene.sun.trend);
  const twilight = normalizeTwilight(scene.sun.twilightStage);
  const isDay = Boolean(scene.sun.isDay);
  const daySlot = computeDaySlot(scene);
  const nightCrossed = Boolean(scene.chronosense.nightCrossed);

  const horizonEvent = scene.diurnal.nextTransitionKind;
  const horizonEtaMin = scene.diurnal.minutesToNextTwilight;

  let deadlineLabel: string | null;
  let deadlineEtaMin: number | null;
  let deadlineState: ChronosenseDeadlineState;
  if (deadlineJdUt !== null) {
    deadlineLabel = sanitizeLabel(deadlineLabelOpt);
    deadlineEtaMin = (deadlineJdUt - jdUt) * 1440.0;
    if (Math.abs(deadlineEtaMin) <= 1.0) {
      deadlineState = "due";
    } else if (deadlineEtaMin > 1.0) {
      deadlineState = "applying";
    } else {
      deadlineState = "overdue";
    }
  } else {
    deadlineLabel = null;
    deadlineEtaMin = null;
    deadlineState = "none";
  }

  const moonLonDeg = scene.chronosense.moonLonDeg;
  const moonIllumPct = scene.moon.illum * 100.0;
  const moonWaxing = Boolean(scene.moon.waxing);
  const dtPrevMin = prevJdUt === null ? null : (jdUt - prevJdUt) * 1440.0;
  const wavefrontQuadrant = computeWavefrontQuadrant(scene);

  const header = buildHeader({
    clockId,
    turn,
    utcIso,
    sunAltDeg,
    sunTrend,
    twilight,
    daySlot,
    nightCrossed,
    horizonEvent,
    horizonEtaMin,
    deadlineLabel,
    deadlineState,
    deadlineEtaMin,
    dtPrevMin,
  });

  return {
    clockId,
    chartDigest: fullDigest,
    genesisDigest,
    turn,
    jdUt,
    utcIso,
    lat,
    lonEast,
    elevationM,
    sunAltDeg,
    sunTrend,
    twilight,
    daySlot,
    isDay,
    nightCrossed,
    horizonEvent,
    horizonEtaMin,
    deadlineLabel,
    deadlineEtaMin,
    deadlineState,
    moonLonDeg,
    moonIllumPct,
    moonWaxing,
    dtPrevMin,
    wavefrontQuadrant,
    header,
  };
}

// ------------------------------------------------ Primitive 2: cursor auditor

function buildCorrectivePrompt(
  envelope: ChronosenseEnvelope,
  driftFlags: readonly string[],
): string | null {
  if (driftFlags.length === 0) return null;
  const parts: string[] = [
    `Chronosense audit rejected cursor (${driftFlags.join(", ")}).`,
  ];
  if (driftFlags.includes("clock_id_mismatch") || driftFlags.includes("turn_mismatch")) {
    parts.push(`Sync cursor to clock_id=${envelope.clockId} turn=${envelope.turn}.`);
  }
  if (driftFlags.includes("night_crossed_unacked")) {
    parts.push(
      "Local solar midnight was crossed since the previous turn; "
        + "set night_crossed_ack=true and re-verify prior-day cached outputs.",
    );
  }
  if (driftFlags.includes("deadline_drift")) {
    if (envelope.deadlineEtaMin !== null) {
      const etaS = fmtFixed(envelope.deadlineEtaMin, 1);
      parts.push(`Update deadline_eta_min to ${etaS} (${envelope.deadlineState}).`);
    } else {
      parts.push("Clear deadline_eta_min (no active deadline).");
    }
  }
  const hasFactIssue = driftFlags.some(
    (f) => f.startsWith("fact_mismatch:") || f.startsWith("unknown_fact:"),
  );
  if (hasFactIssue) {
    parts.push(`Re-read cited_facts from the authoritative header: ${envelope.header}`);
  } else {
    parts.push(`Authoritative header: ${envelope.header}`);
  }
  return parts.join(" ");
}

/**
 * Deterministic pre-tool write-back cursor and citation auditor.
 *
 * Verifies:
 * - `clockId` digest match (`"clock_id_mismatch"`)
 * - `turn` monotonicity (`"turn_mismatch"`)
 * - `nightCrossedAck` whenever `envelope.nightCrossed === true`
 *   (`"night_crossed_unacked"`)
 * - `deadlineEtaMin` within `deadlineToleranceMin` when a deadline is active,
 *   or absent/null when no deadline is active (`"deadline_drift"`)
 * - optional `citedFacts` map against authoritative envelope values within
 *   `factTolerance` (`"fact_mismatch:<key>"` / `"unknown_fact:<key>"`)
 */
export function auditChronosenseCursor(
  envelope: ChronosenseEnvelope,
  cursor: ChronosenseCursor | unknown,
  opts: ChronosenseAuditOptions = {},
): ChronosenseAuditResult {
  const deadlineToleranceMin = opts.deadlineToleranceMin ?? 5.0;
  const factTolerance = opts.factTolerance ?? 0.5;

  if (!isFiniteNumber(deadlineToleranceMin) || deadlineToleranceMin < 0.0) {
    throw new RangeError(
      `deadlineToleranceMin must be finite >= 0, got ${deadlineToleranceMin}`,
    );
  }
  if (!isFiniteNumber(factTolerance) || factTolerance < 0.0) {
    throw new RangeError(
      `factTolerance must be finite >= 0, got ${factTolerance}`,
    );
  }

  const c: Record<string, unknown> = isPlainRecord(cursor) ? cursor : {};
  const driftFlags: string[] = [];

  // 1. clock_id digest match
  const cClock = c.clockId !== undefined ? c.clockId : c.clock_id;
  if (typeof cClock !== "string" || cClock !== envelope.clockId) {
    driftFlags.push("clock_id_mismatch");
  }

  // 2. turn monotonicity
  const cTurn = c.turn;
  if (typeof cTurn !== "number" || !Number.isInteger(cTurn) || cTurn !== envelope.turn) {
    driftFlags.push("turn_mismatch");
  }

  // 3. explicit night_crossed acknowledgment
  const cNightAck = c.nightCrossedAck !== undefined ? c.nightCrossedAck : c.night_crossed_ack;
  if (envelope.nightCrossed === true && cNightAck !== true) {
    driftFlags.push("night_crossed_unacked");
  }

  // 4. deadline drift check
  const expectedDl = envelope.deadlineEtaMin;
  const deadlineActive = envelope.deadlineState !== "none" && expectedDl !== null;
  const cDl = c.deadlineEtaMin !== undefined ? c.deadlineEtaMin : c.deadline_eta_min;
  if (deadlineActive) {
    if (!isFiniteNumber(cDl)) {
      driftFlags.push("deadline_drift");
    } else if (Math.abs(cDl - expectedDl) > deadlineToleranceMin) {
      driftFlags.push("deadline_drift");
    }
  } else {
    if (cDl !== undefined && cDl !== null) {
      driftFlags.push("deadline_drift");
    }
  }

  // 5. cited_facts provenance audit (sorted keys for deterministic output)
  const citedFacts = c.citedFacts !== undefined ? c.citedFacts : c.cited_facts;
  if (citedFacts !== undefined && citedFacts !== null) {
    if (!isPlainRecord(citedFacts)) {
      driftFlags.push("unknown_fact:cited_facts");
    } else {
      const keys = Object.keys(citedFacts).sort(lexCompare);
      for (const key of keys) {
        const val = citedFacts[key];
        const spec = FACT_LOOKUP.get(key);
        if (!spec) {
          driftFlags.push(`unknown_fact:${key}`);
          continue;
        }
        const expected = envelope[spec.prop];
        if (spec.kind === "numeric") {
          if (expected === null) {
            if (val !== null) {
              driftFlags.push(`fact_mismatch:${spec.canonicalKey}`);
            }
          } else {
            if (!isFiniteNumber(val)) {
              driftFlags.push(`fact_mismatch:${spec.canonicalKey}`);
            } else {
              const expNum = expected as number;
              const diff = spec.circular
                ? Math.abs(wrap180(val - expNum))
                : Math.abs(val - expNum);
              if (diff > factTolerance) {
                driftFlags.push(`fact_mismatch:${spec.canonicalKey}`);
              }
            }
          }
        } else {
          if (val !== expected) {
            driftFlags.push(`fact_mismatch:${spec.canonicalKey}`);
          }
        }
      }
    }
  }

  return {
    ok: driftFlags.length === 0,
    driftFlags,
    correctivePrompt: buildCorrectivePrompt(envelope, driftFlags),
  };
}

// ----------------------------------------- Primitive 3: photoperiod vector

/**
 * Pure 10-D L2-normalized physical phase descriptor from {@link SceneGeometry}
 * (proved EXP-002).
 *
 * Components (before L2 normalization):
 * - `[0]` `1.60 * cos(arcAngle)`              photoperiod-warped circadian cos
 * - `[1]` `1.60 * sin(arcAngle)`              photoperiod-warped circadian sin
 * - `[2]` `0.45 * tanh(sunAltDeg / 12)`       smooth normalized solar altitude
 * - `[3]` `0.75 * sign(rateAltDegPerMin)`     rising (+1) vs setting (-1)
 * - `[4]` `0.90 * sectSign`                   diurnal (+1) vs nocturnal (-1)
 * - `[5]` `0.45 * exp(-(sunAltDeg / 3)^2)`    tight 3-deg horizon twilight band
 * - `[6]` `0.12 * cos(signedLunarElong)`      synodic Moon cos
 * - `[7]` `0.12 * sin(signedLunarElong)`      synodic Moon sin
 * - `[8]` `0.08 * cos(sunLonDeg)`             seasonal solar longitude cos
 * - `[9]` `0.08 * sin(sunLonDeg)`             seasonal solar longitude sin
 *
 * Handles polar latitudes cleanly via solar-noon hour-angle fallback.
 */
export function photoperiodVector(scene: SceneGeometry): number[] {
  const jdUt = scene.jdUt;
  const sunAlt = scene.sun.altitudeApparentDeg;
  const rateAlt = scene.sun.rateAltDegPerMin;
  const isDay = Boolean(scene.sun.isDay);

  const ph = scene.diurnal.planetaryHour;
  const solarNoonJd = scene.diurnal.solarNoonJd;

  let arcAngle: number;
  if (ph !== null && ph.end > ph.start) {
    const fracInHour = clamp((jdUt - ph.start) / (ph.end - ph.start), 0.0, 1.0);
    const slotIdx = mod(ph.hour - 1, 12);
    const halfArcFrac = clamp((slotIdx + fracInHour) / 12.0, 0.0, 1.0);
    arcAngle = ph.kind === "day"
      ? halfArcFrac * Math.PI
      : Math.PI + halfArcFrac * Math.PI;
  } else if (solarNoonJd !== null) {
    const dh = mod((jdUt - solarNoonJd) * 24.0 + 36.0, 24.0) - 12.0;
    arcAngle = mod(0.5 * Math.PI + (dh / 12.0) * Math.PI, TWO_PI);
  } else {
    const altNorm = clamp(sunAlt / 30.0, -1.0, 1.0);
    arcAngle = rateAlt >= 0.0
      ? (1.0 - altNorm) * (0.5 * Math.PI)
      : Math.PI - (1.0 - altNorm) * (0.5 * Math.PI);
  }

  const horizonBand = Math.exp(-((sunAlt / 3.0) ** 2));
  const sunAltNorm = Math.tanh(sunAlt / 12.0);
  const sunTrendSign = rateAlt >= 0.0 ? 1.0 : -1.0;
  const sectSign = isDay ? 1.0 : -1.0;

  const elongDeg = scene.moon.elongationDeg;
  const signedElongDeg = scene.moon.waxing ? elongDeg : 360.0 - elongDeg;
  const elongRad = signedElongDeg * DEG;

  const sunLonRad = approxSunLonDeg(jdUt) * DEG;

  const raw = [
    1.6 * Math.cos(arcAngle),
    1.6 * Math.sin(arcAngle),
    0.45 * sunAltNorm,
    0.75 * sunTrendSign,
    0.9 * sectSign,
    0.45 * horizonBand,
    0.12 * Math.cos(elongRad),
    0.12 * Math.sin(elongRad),
    0.08 * Math.cos(sunLonRad),
    0.08 * Math.sin(sunLonRad),
  ];
  let sumSq = 0.0;
  for (let i = 0; i < raw.length; i++) {
    sumSq += raw[i] * raw[i];
  }
  const norm = Math.sqrt(sumSq);
  return raw.map((v) => v / norm);
}

/**
 * Unsupervised horizon x season x longitude physical stratum key (EXP-007).
 *
 * Returns `<horizon>:<season>:lon<0..5>` where:
 * - `horizon`: `"night"` (< -6 deg) | `"twilight"` ([-6, +6] deg) | `"day"` (> +6 deg)
 * - `season`: `"mar_eq"` | `"jun_sol"` | `"sep_eq"` | `"dec_sol"` (hemisphere-neutral)
 * - `lon<0..5>`: 60-degree longitude sector (`lon0`..`lon5`, -180..+180E)
 */
export function phaseStratumKey(scene: SceneGeometry, lonEast?: number | null): string {
  const alt = scene.sun.altitudeApparentDeg;
  let horizon: string;
  if (alt < -6.0) {
    horizon = "night";
  } else if (alt <= 6.0) {
    horizon = "twilight";
  } else {
    horizon = "day";
  }

  const sunLonDeg = approxSunLonDeg(scene.jdUt);
  const sBin = mod(Math.floor(mod(sunLonDeg + 45.0, 360.0) / 90.0), 4);
  const season = SEASON_QUADRANTS[sBin];

  const lon = lonEast === undefined || lonEast === null ? scene.lonEast : lonEast;
  if (!isFiniteNumber(lon)) {
    throw new RangeError(`lonEast must be finite, got ${lon}`);
  }
  const lonNorm = mod(lon + 180.0, 360.0) - 180.0;
  const lonBin = mod(Math.floor(mod(lonNorm + 180.0, 360.0) / 60.0), 6);
  return `${horizon}:${season}:lon${lonBin}`;
}

/** Cosine similarity in [-1, 1] between two equal-length phase vectors. */
export function phaseCosineSimilarity(
  vecA: readonly number[],
  vecB: readonly number[],
): number {
  if (vecA.length === 0 || vecA.length !== vecB.length) {
    throw new RangeError(
      `vectors must be non-empty and equal length, got ${vecA.length} and ${vecB.length}`,
    );
  }
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    const fa = vecA[i];
    const fb = vecB[i];
    dot += fa * fb;
    na += fa * fa;
    nb += fb * fb;
  }
  if (na === 0.0 || nb === 0.0) return 0.0;
  return clamp(dot / Math.sqrt(na * nb), -1.0, 1.0);
}

// ----------------------------------------- Primitive 4: stratified compaction

function entryPriority(entry: StratifiedEntry): number {
  let val: unknown;
  if (entry.score !== undefined && entry.score !== null) {
    val = entry.score;
  } else if (entry.recency !== undefined && entry.recency !== null) {
    val = entry.recency;
  } else {
    val = 0.0;
  }
  if (!isFiniteNumber(val)) {
    throw new RangeError(`entry score/recency must be finite, got ${val}`);
  }
  return val;
}

/**
 * Deterministic bucket-preserving compaction selector (EXP-002 / EXP-007).
 *
 * Partitions entries by `stratum`, ranks each bucket by descending `score`
 * (or `recency` when `score` is absent; ties broken by lexicographical
 * `String(id)` then original index), orders strata by descending peak score
 * (ties broken by lexicographical stratum key), and sweeps round-robin across
 * distinct strata up to `budget`.
 */
export function stratifiedSelect<T extends StratifiedEntry>(
  entries: readonly T[],
  budget: number,
): T[] {
  if (typeof budget !== "number" || !Number.isInteger(budget) || budget < 0) {
    throw new RangeError(`budget must be an integer >= 0, got ${budget}`);
  }
  if (budget === 0 || entries.length === 0) return [];

  interface RankedItem {
    prio: number;
    idStr: string;
    origIdx: number;
    entry: T;
  }

  const buckets = new Map<string, RankedItem[]>();
  for (let origIdx = 0; origIdx < entries.length; origIdx++) {
    const entry = entries[origIdx];
    if (
      !isPlainRecord(entry)
      || entry.id === undefined
      || entry.stratum === undefined
    ) {
      throw new TypeError(
        `each entry must be an object with 'id' and 'stratum', got ${String(entry)}`,
      );
    }
    const stratum = String(entry.stratum);
    const prio = entryPriority(entry);
    let list = buckets.get(stratum);
    if (!list) {
      list = [];
      buckets.set(stratum, list);
    }
    list.push({ prio, idStr: String(entry.id), origIdx, entry });
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (a.prio !== b.prio) return b.prio - a.prio;
      const idCmp = lexCompare(a.idStr, b.idStr);
      if (idCmp !== 0) return idCmp;
      return a.origIdx - b.origIdx;
    });
  }

  const orderedStrata = Array.from(buckets.keys()).sort((ka, kb) => {
    const pa = buckets.get(ka)![0].prio;
    const pb = buckets.get(kb)![0].prio;
    if (pa !== pb) return pb - pa;
    return lexCompare(ka, kb);
  });

  const selected: T[] = [];
  const offsets = new Map<string, number>();
  for (const k of orderedStrata) offsets.set(k, 0);

  while (selected.length < budget) {
    let progressed = false;
    for (const k of orderedStrata) {
      if (selected.length >= budget) break;
      const idx = offsets.get(k)!;
      const bucket = buckets.get(k)!;
      if (idx < bucket.length) {
        selected.push(bucket[idx].entry);
        offsets.set(k, idx + 1);
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return selected;
}
