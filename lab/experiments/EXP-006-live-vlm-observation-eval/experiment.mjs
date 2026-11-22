#!/usr/bin/env node
/**
 * EXP-006: Live Observation Tool-Use Eval (CoT-Only vs. Caelus MCP Tools)
 *
 * Evaluates the 30-task EXP-003/vlm_eval_pack.jsonl comparing two arms on the
 * exact same live model(s):
 *   - Arm1-CoT-NoTools: chain-of-thought only (zero tools).
 *   - Arm2-Caelus-MCP-Tools: same model equipped with local in-process Caelus
 *     tools (verify_observation, chronolocate, geolocate, scene_geometry)
 *     backed directly by packages/caelus/dist/.
 *
 * Default mode (zero network, deterministic):
 *   - Verifies local Caelus tool parity and latency against all 30 tasks in
 *     vlm_eval_pack.jsonl (oracle check).
 *   - If live_receipt.json is present, deterministically re-grades every raw
 *     recorded live response from both arms without network I/O and writes
 *     results.json.
 *
 * Live execution mode (explicit CLI opt-in):
 *   node lab/experiments/EXP-006-live-vlm-observation-eval/experiment.mjs \
 *     --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import { loadNodeData } from "../../../packages/caelus/dist/src/node-loader.js";
import {
  Engine,
  DEG,
  julianDay,
  mod,
  sceneGeometry,
  verifyObservation,
  chronolocate,
  geolocate,
} from "../../../packages/caelus/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/caelus/data");
const PACK_PATH = resolve(
  REPO_ROOT,
  "lab/experiments/EXP-003-vlm-observation-bench/vlm_eval_pack.jsonl",
);
const LIVE_RECEIPT_PATH = resolve(__dirname, "live_receipt.json");

export const ARMS = ["Arm1-CoT-NoTools", "Arm2-Caelus-MCP-Tools"];

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function round4(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(x.toFixed(4));
}

function round2(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(x.toFixed(2));
}

function wrap180(x) {
  const r = mod(x + 180.0, 360.0) - 180.0;
  return r === -180.0 ? 180.0 : r;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = wrap180(lon2 - lon1) * DEG;
  const s1 = Math.sin(dp * 0.5);
  const s2 = Math.sin(dl * 0.5);
  const a = s1 * s1 + Math.cos(p1) * Math.cos(p2) * s2 * s2;
  return 2.0 * 6371.0 * Math.asin(Math.min(1.0, Math.sqrt(Math.max(0.0, a))));
}

function percentile(values, p) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function mean(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function jdFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`);
  return julianDay(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  );
}

function isoFromJd(jd) {
  return new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 19) + "Z";
}

function toObservedConstraints(input) {
  if (!input || typeof input !== "object") return undefined;
  const out = {};
  if (input.shadow_bearing_deg !== undefined && input.shadow_bearing_deg !== null)
    out.shadowBearingDeg = Number(input.shadow_bearing_deg);
  if (input.shadow_length_ratio !== undefined && input.shadow_length_ratio !== null)
    out.shadowLengthRatio = Number(input.shadow_length_ratio);
  if (input.sun_azimuth_deg !== undefined && input.sun_azimuth_deg !== null)
    out.sunAzimuthDeg = Number(input.sun_azimuth_deg);
  if (input.sun_altitude_deg !== undefined && input.sun_altitude_deg !== null)
    out.sunAltitudeDeg = Number(input.sun_altitude_deg);
  if (input.twilight !== undefined && input.twilight !== null)
    out.twilight = String(input.twilight);
  if (input.sun_visible !== undefined && input.sun_visible !== null)
    out.sunVisible = Boolean(input.sun_visible);
  if (input.moon_visible !== undefined && input.moon_visible !== null)
    out.moonVisible = Boolean(input.moon_visible);
  if (input.moon_azimuth_deg !== undefined && input.moon_azimuth_deg !== null)
    out.moonAzimuthDeg = Number(input.moon_azimuth_deg);
  if (input.moon_altitude_deg !== undefined && input.moon_altitude_deg !== null)
    out.moonAltitudeDeg = Number(input.moon_altitude_deg);
  if (input.moon_illum !== undefined && input.moon_illum !== null)
    out.moonIllum = Number(input.moon_illum);
  if (input.moon_waxing !== undefined && input.moon_waxing !== null)
    out.moonWaxing = Boolean(input.moon_waxing);
  if (input.moon_bright_limb_deg !== undefined && input.moon_bright_limb_deg !== null)
    out.moonBrightLimbDeg = Number(input.moon_bright_limb_deg);
  if (Array.isArray(input.bodies_visible)) out.bodiesVisible = input.bodies_visible;
  if (input.shadow_sweep && typeof input.shadow_sweep === "object") {
    out.shadowSweep = {
      dtMinutes: Number(input.shadow_sweep.dt_minutes),
      deltaBearingDeg: Number(input.shadow_sweep.delta_bearing_deg),
      ...(input.shadow_sweep.tolerance_deg !== undefined
        ? { toleranceDeg: Number(input.shadow_sweep.tolerance_deg) }
        : {}),
    };
  }
  if (input.tolerances && typeof input.tolerances === "object") {
    const t = {};
    const ti = input.tolerances;
    if (ti.shadow_bearing_deg !== undefined) t.shadowBearingDeg = Number(ti.shadow_bearing_deg);
    if (ti.shadow_length_ratio !== undefined) t.shadowLengthRatio = Number(ti.shadow_length_ratio);
    if (ti.shadow_length_ratio_rel !== undefined) t.shadowLengthRatioRel = Number(ti.shadow_length_ratio_rel);
    if (ti.shadow_length_ratio_abs !== undefined) t.shadowLengthRatioAbs = Number(ti.shadow_length_ratio_abs);
    if (ti.sun_azimuth_deg !== undefined) t.sunAzimuthDeg = Number(ti.sun_azimuth_deg);
    if (ti.sun_altitude_deg !== undefined) t.sunAltitudeDeg = Number(ti.sun_altitude_deg);
    if (ti.moon_azimuth_deg !== undefined) t.moonAzimuthDeg = Number(ti.moon_azimuth_deg);
    if (ti.moon_altitude_deg !== undefined) t.moonAltitudeDeg = Number(ti.moon_altitude_deg);
    if (ti.moon_illum !== undefined) t.moonIllum = Number(ti.moon_illum);
    if (ti.moon_bright_limb_deg !== undefined) t.moonBrightLimbDeg = Number(ti.moon_bright_limb_deg);
    if (ti.shadow_sweep_deg !== undefined) t.shadowSweepDeg = Number(ti.shadow_sweep_deg);
    out.tolerances = t;
  }
  return out;
}

/**
 * Compact MCP-compatible formatters matching packages/caelus-mcp/src/core.ts.
 */
function formatSceneCompact(s) {
  return {
    utc: isoFromJd(s.jdUt),
    lat: s.lat,
    lon: s.lonEast,
    elevation_m: s.elevationM,
    sun: {
      azimuth_deg: round2(s.sun.azimuthDeg),
      altitude_apparent_deg: round2(s.sun.altitudeApparentDeg),
      twilight_stage: s.sun.twilightStage,
      is_day: s.sun.isDay,
      trend: s.sun.trend,
    },
    shadow: {
      cast: s.shadow.cast,
      bearing_deg: s.shadow.bearingDeg === null ? null : round2(s.shadow.bearingDeg),
      length_ratio: s.shadow.lengthRatio === null ? null : round4(s.shadow.lengthRatio),
      rate_bearing_deg_per_min:
        s.shadow.rateBearingDegPerMin === null ? null : round4(s.shadow.rateBearingDegPerMin),
      slope_deg: s.shadow.slopeDeg,
      slope_azimuth_deg: s.shadow.slopeAzimuthDeg,
    },
    moon: {
      visible: s.moon.visible,
      azimuth_deg: round2(s.moon.azimuthDeg),
      altitude_apparent_deg: round2(s.moon.altitudeApparentDeg),
      illum: round4(s.moon.illum),
      waxing: s.moon.waxing,
      bright_limb_zenith_deg:
        s.moon.brightLimbZenithDeg === null ? null : round2(s.moon.brightLimbZenithDeg),
    },
  };
}

function executeCaelusTool(engine, name, rawArgs) {
  const args =
    typeof rawArgs === "string"
      ? JSON.parse(rawArgs)
      : rawArgs && typeof rawArgs === "object"
        ? rawArgs
        : {};
  const t0 = performance.now();
  let output;
  if (name === "verify_observation") {
    const jdUt = jdFromIso(args.date);
    const res = verifyObservation(
      engine,
      {
        jdUt,
        lat: Number(args.lat),
        lonEast: Number(args.lon),
        elevationM: args.elevation_m !== undefined ? Number(args.elevation_m) : 0,
        slopeDeg: args.slope_deg !== undefined ? Number(args.slope_deg) : 0,
        slopeAzimuthDeg: args.slope_azimuth_deg !== undefined ? Number(args.slope_azimuth_deg) : 0,
        timeToleranceMin: args.time_tolerance_min !== undefined ? Number(args.time_tolerance_min) : 0,
        placeToleranceDeg: args.place_tolerance_deg !== undefined ? Number(args.place_tolerance_deg) : 0,
      },
      toObservedConstraints(args.observed),
    );
    output = {
      verdict: res.verdict,
      consistency_score: res.consistencyScore === null ? null : round4(res.consistencyScore),
      checks: res.checks.map((ch) => ({
        field: ch.field,
        status: ch.status,
        observed: typeof ch.observed === "number" ? round4(ch.observed) : ch.observed,
        expected: typeof ch.expected === "number" ? round4(ch.expected) : ch.expected,
        residual: ch.residual === null ? null : round4(ch.residual),
        tolerance: ch.tolerance === null ? null : round4(ch.tolerance),
        note: ch.note,
      })),
      scene: formatSceneCompact(res.scene),
      diagnostics:
        res.diagnostics === null
          ? null
          : {
              time_shift: {
                utc: isoFromJd(res.diagnostics.timeShift.jdUt),
                offset_minutes: round2(res.diagnostics.timeShift.offsetMinutes),
                fit_score: round4(res.diagnostics.timeShift.fitScore),
                verdict: res.diagnostics.timeShift.verdict,
              },
              hemisphere_flip: {
                lat: round4(res.diagnostics.hemisphereFlip.lat),
                lon: round4(res.diagnostics.hemisphereFlip.lonEast),
                fit_score: round4(res.diagnostics.hemisphereFlip.fitScore),
                verdict: res.diagnostics.hemisphereFlip.verdict,
              },
              date_shift:
                res.diagnostics.dateShift === null
                  ? null
                  : {
                      utc: isoFromJd(res.diagnostics.dateShift.jdUt),
                      offset_days: res.diagnostics.dateShift.offsetDays,
                      fit_score: round4(res.diagnostics.dateShift.fitScore),
                      verdict: res.diagnostics.dateShift.verdict,
                    },
              summary: res.diagnostics.summary,
            },
    };
  } else if (name === "chronolocate") {
    const jdStart = jdFromIso(args.start);
    const jdEnd = jdFromIso(args.end);
    const res = chronolocate(
      engine,
      {
        lat: Number(args.lat),
        lonEast: Number(args.lon),
        elevationM: args.elevation_m !== undefined ? Number(args.elevation_m) : 0,
        slopeDeg: args.slope_deg !== undefined ? Number(args.slope_deg) : 0,
        slopeAzimuthDeg: args.slope_azimuth_deg !== undefined ? Number(args.slope_azimuth_deg) : 0,
      },
      toObservedConstraints(args.observed) ?? {},
      jdStart,
      jdEnd,
      {
        stepMinutes: args.step_minutes !== undefined ? Number(args.step_minutes) : 10,
        maxWindows: args.max_windows !== undefined ? Number(args.max_windows) : 16,
      },
    );
    const sortedWindows = [...res.windows].sort((a, b) => b.fitScore - a.fitScore);
    output = {
      start_utc: isoFromJd(res.jdStart),
      end_utc: isoFromJd(res.jdEnd),
      days_scanned: res.daysScanned,
      days_pruned: res.daysPruned,
      windows: sortedWindows.slice(0, 8).map((w) => ({
        start_utc: isoFromJd(w.jdStart),
        end_utc: isoFromJd(w.jdEnd),
        best_utc: isoFromJd(w.bestJd),
        duration_minutes: round2(w.durationMinutes),
        fit_score: round4(w.fitScore),
      })),
    };
  } else if (name === "geolocate") {
    const jdUt = jdFromIso(args.date);
    const res = geolocate(engine, jdUt, toObservedConstraints(args.observed) ?? {}, {
      latMin: args.lat_min !== undefined ? Number(args.lat_min) : -70,
      latMax: args.lat_max !== undefined ? Number(args.lat_max) : 70,
      lonMin: args.lon_min !== undefined ? Number(args.lon_min) : -180,
      lonMax: args.lon_max !== undefined ? Number(args.lon_max) : 180,
      gridStepDeg: args.grid_step_deg !== undefined ? Number(args.grid_step_deg) : 4,
      maxCandidates: args.max_candidates !== undefined ? Number(args.max_candidates) : 8,
      elevationM: args.elevation_m !== undefined ? Number(args.elevation_m) : 0,
      slopeDeg: args.slope_deg !== undefined ? Number(args.slope_deg) : 0,
      slopeAzimuthDeg: args.slope_azimuth_deg !== undefined ? Number(args.slope_azimuth_deg) : 0,
    });
    output = {
      utc: isoFromJd(res.jdUt),
      method: res.method,
      subsolar: { lat: round4(res.subsolar.lat), lon: round4(res.subsolar.lon) },
      sublunar: { lat: round4(res.sublunar.lat), lon: round4(res.sublunar.lon) },
      candidates: res.candidates.slice(0, 6).map((c) => ({
        lat: round4(c.lat),
        lon: round4(c.lon),
        fit_score: round4(c.fitScore),
        radius_km: round2(c.radiusKm),
        region_kind: c.regionKind,
      })),
    };
  } else if (name === "scene_geometry") {
    const jdUt = jdFromIso(args.date);
    const s = sceneGeometry(engine, jdUt, Number(args.lat), Number(args.lon), {
      elevationM: args.elevation_m !== undefined ? Number(args.elevation_m) : 0,
      slopeDeg: args.slope_deg !== undefined ? Number(args.slope_deg) : 0,
      slopeAzimuthDeg: args.slope_azimuth_deg !== undefined ? Number(args.slope_azimuth_deg) : 0,
    });
    output = formatSceneCompact(s);
  } else {
    throw new Error(`Unknown Caelus tool: ${name}`);
  }
  const latencyMs = round4(performance.now() - t0);
  return { output, latencyMs };
}

const OBSERVED_SCHEMA = {
  type: "object",
  description: "Observed physical measurements extracted from the scene.",
  properties: {
    shadow_bearing_deg: { type: "number", description: "Shadow compass bearing in degrees clockwise from true north (0..360)." },
    shadow_length_ratio: { type: "number", description: "Shadow length divided by vertical pole height (L/H)." },
    sun_azimuth_deg: { type: "number", description: "Solar compass azimuth in degrees." },
    sun_altitude_deg: { type: "number", description: "Apparent solar elevation in degrees above horizon." },
    twilight: { type: "string", description: "Observed lighting regime: day, civil, nautical, astronomical, night, or dark." },
    sun_visible: { type: "boolean" },
    moon_visible: { type: "boolean" },
    moon_azimuth_deg: { type: "number" },
    moon_altitude_deg: { type: "number" },
    moon_illum: { type: "number", description: "Lunar illuminated fraction in [0, 1]." },
    moon_waxing: { type: "boolean", description: "true if waxing, false if waning." },
    moon_bright_limb_deg: { type: "number", description: "Zenith-frame bright-limb angle in degrees (0..360)." },
    shadow_sweep: {
      type: "object",
      properties: {
        dt_minutes: { type: "number" },
        delta_bearing_deg: { type: "number" },
      },
      required: ["dt_minutes", "delta_bearing_deg"],
    },
    tolerances: {
      type: "object",
      properties: {
        shadow_bearing_deg: { type: "number" },
        shadow_length_ratio: { type: "number" },
        sun_altitude_deg: { type: "number" },
        moon_altitude_deg: { type: "number" },
        moon_bright_limb_deg: { type: "number" },
      },
    },
  },
};

const CAELUS_TOOLS_OLLAMA = [
  {
    type: "function",
    function: {
      name: "verify_observation",
      description:
        "Verify physical observations (solar shadows, Sun/Moon azimuth/altitude, twilight, Moon phase/bright-limb, or video shadow sweep) against a claimed UTC timestamp and Earth location. Returns verdict (consistent, marginal, inconsistent, impossible), consistency_score, per-field residuals, and counterfactual diagnostics (time_shift, hemisphere_flip, date_shift).",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Claimed UTC ISO-8601 timestamp." },
          lat: { type: "number", description: "Latitude in degrees, north positive." },
          lon: { type: "number", description: "Longitude in degrees, east positive." },
          elevation_m: { type: "number", description: "Elevation above sea level in meters (default 0)." },
          slope_deg: { type: "number", description: "Terrain downhill slope in degrees (default 0)." },
          slope_azimuth_deg: { type: "number", description: "Downhill slope azimuth in degrees from north (default 0)." },
          observed: OBSERVED_SCHEMA,
        },
        required: ["date", "lat", "lon", "observed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chronolocate",
      description:
        "Find every UTC time window within [start, end] at a known Earth location where the observed physical constraints (shadow bearing, length ratio, twilight, lunar illumination/waxing) held simultaneously. Returns ranked windows with best_utc and fit_score.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lon: { type: "number" },
          start: { type: "string", description: "UTC ISO-8601 start of search window." },
          end: { type: "string", description: "UTC ISO-8601 end of search window." },
          elevation_m: { type: "number" },
          slope_deg: { type: "number" },
          slope_azimuth_deg: { type: "number" },
          observed: OBSERVED_SCHEMA,
        },
        required: ["lat", "lon", "start", "end", "observed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "geolocate",
      description:
        "Invert physical observations at a known UTC timestamp to Earth coordinates (lat, lon). Uses closed-form analytical fix for flat-ground solar shadow bearing + length ratio, or global spherical grid for Sun+Moon double altitude, lunar bright-limb tilt, or sloped terrain. Returns ranked candidate regions.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Known UTC ISO-8601 timestamp." },
          elevation_m: { type: "number" },
          slope_deg: { type: "number" },
          slope_azimuth_deg: { type: "number" },
          grid_step_deg: { type: "number", description: "Grid spacing in degrees for grid mode (default 4)." },
          observed: OBSERVED_SCHEMA,
        },
        required: ["date", "observed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scene_geometry",
      description:
        "Compute full physical sky and shadow ground truth (Sun azimuth/altitude, shadow bearing and length ratio, twilight stage, Moon visibility/illumination/bright-limb) at a specific UTC instant and Earth location.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string" },
          lat: { type: "number" },
          lon: { type: "number" },
          elevation_m: { type: "number" },
          slope_deg: { type: "number" },
          slope_azimuth_deg: { type: "number" },
        },
        required: ["date", "lat", "lon"],
      },
    },
  },
];

function taskKind(task) {
  if (task.tool_expected === "verify_observation") return "verify";
  if (task.tool_expected === "chronolocate") return "chronolocate";
  return "geolocate";
}

function answerSchemaFor(task) {
  const kind = taskKind(task);
  if (kind === "verify") {
    return (
      `Return strict JSON only: ` +
      `{"reasoning": "1-3 concise sentences", "is_spoof": boolean, ` +
      `"verdict": "consistent"|"marginal"|"inconsistent"|"impossible", ` +
      `"diagnostic_kind": "time_shift"|"hemisphere_flip"|"date_shift"|"none"} ` +
      `(set is_spoof=false if verdict is consistent or marginal; is_spoof=true if inconsistent or impossible; ` +
      `set diagnostic_kind to "time_shift", "hemisphere_flip", or "date_shift" if a single-axis shift explains the mismatch, otherwise "none").`
    );
  }
  if (kind === "chronolocate") {
    return (
      `Return strict JSON only: ` +
      `{"reasoning": "1-3 concise sentences", "best_utc": "YYYY-MM-DDTHH:MM:SSZ"} ` +
      `(report the single best-fitting UTC ISO-8601 capture timestamp within the search window).`
    );
  }
  return (
    `Return strict JSON only: ` +
    `{"reasoning": "1-3 concise sentences", "candidates": [{"lat": number, "lon": number}]} ` +
    `(list 1 to 2 best candidate Earth coordinates in decimal degrees; latitude north positive, longitude east positive).`
  );
}

/**
 * Build IDENTICAL user task prompt for both Arm1 (no tools) and Arm2 (Caelus tools).
 * Never includes tool_input, ground_truth, or eval_rubric.
 */
function buildTaskUserPrompt(task) {
  return [
    `Scene description:\n${task.scene_description}`,
    `Claimed context (JSON):\n${JSON.stringify(task.claimed_context)}`,
    `Measured visual observations (JSON):\n${JSON.stringify(task.visual_measurements)}`,
    answerSchemaFor(task),
  ].join("\n\n");
}

function buildSystemPrompt(armName) {
  if (armName === "Arm1-CoT-NoTools") {
    return [
      "You are a forensic spacetime analyst verifying visual physics (shadows, solar/lunar geometry, twilight, chronolocation, and celestial geolocation) using reasoning only.",
      "No external tools are available. Think step by step briefly in the `reasoning` field and output strict JSON matching the requested schema.",
    ].join("\n\n");
  }
  return [
    "You are a forensic spacetime analyst equipped with Caelus ephemeris and physical observation tools (`verify_observation`, `chronolocate`, `geolocate`, `scene_geometry`).",
    "Always call the appropriate Caelus tool with the exact numerical parameters from the scene (including `elevation_m`, `slope_deg`, `slope_azimuth_deg`, and `tolerances` whenever provided) before drawing conclusions.",
    "For `verify_observation`, inspect `verdict` and `diagnostics` (selecting the single-axis cause `time_shift`, `hemisphere_flip`, or `date_shift` if its diagnostic summary or fit_score >= 0.85 resolves the conflict, or `none` if authentic or unresolvable).",
    "For `chronolocate`, report the highest `fit_score` window's `best_utc`. For `geolocate`, report the top 1-2 `candidates` (`lat`, `lon`) returned by the tool.",
    "After reviewing tool output, return ONLY the final strict JSON object matching the requested schema.",
  ].join("\n\n");
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback: match last balanced JSON object
  }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/**
 * Deterministic task grader shared across Arm1, Arm2, oracle check, and
 * offline live_receipt.json re-verification.
 */
export function gradeTask(task, parsed) {
  const kind = taskKind(task);
  const gt = task.ground_truth;

  if (kind === "verify") {
    const verdict =
      typeof parsed?.verdict === "string" ? parsed.verdict.trim().toLowerCase() : null;
    let predSpoof = null;
    if (typeof parsed?.is_spoof === "boolean") {
      predSpoof = parsed.is_spoof;
    } else if (verdict === "inconsistent" || verdict === "impossible") {
      predSpoof = true;
    } else if (verdict === "consistent" || verdict === "marginal") {
      predSpoof = false;
    }

    const rawDiag =
      typeof parsed?.diagnostic_kind === "string"
        ? parsed.diagnostic_kind.trim().toLowerCase()
        : null;
    const normDiag =
      rawDiag === "time_shift" || rawDiag === "hemisphere_flip" || rawDiag === "date_shift"
        ? rawDiag
        : null;

    const spoofCorrect = predSpoof === gt.is_spoof;
    const diagApplicable = gt.expected_diagnostic_kind !== null;
    const diagCorrect = diagApplicable ? normDiag === gt.expected_diagnostic_kind : null;

    return {
      kind,
      pass: spoofCorrect,
      pred_spoof: predSpoof,
      gt_is_spoof: gt.is_spoof,
      spoof_correct: spoofCorrect,
      verdict_pred: verdict,
      verdict_gt: gt.verdict,
      diag_applicable: diagApplicable,
      diag_pred: normDiag,
      diag_gt: gt.expected_diagnostic_kind,
      diag_correct: diagCorrect,
    };
  }

  if (kind === "chronolocate") {
    const predUtc =
      typeof parsed?.best_utc === "string" ? parsed.best_utc.trim() : null;
    const predMs = predUtc ? Date.parse(predUtc) : NaN;
    const trueMs = Date.parse(gt.true_utc);
    const errorMin =
      Number.isFinite(predMs) && Number.isFinite(trueMs)
        ? Math.abs(predMs - trueMs) / 60000
        : null;
    const pass = errorMin !== null && errorMin <= 20.0;
    return {
      kind,
      pass,
      pred_utc: predUtc,
      gt_true_utc: gt.true_utc,
      error_minutes: round4(errorMin),
    };
  }

  // geolocate
  let candidates = [];
  if (Array.isArray(parsed?.candidates)) {
    candidates = parsed.candidates
      .slice(0, 4)
      .filter(
        (c) =>
          c &&
          typeof c.lat === "number" &&
          typeof c.lon === "number" &&
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lon),
      );
  } else if (
    typeof parsed?.lat === "number" &&
    typeof parsed?.lon === "number" &&
    Number.isFinite(parsed.lat) &&
    Number.isFinite(parsed.lon)
  ) {
    candidates = [{ lat: parsed.lat, lon: parsed.lon }];
  }

  let bestErrKm = null;
  for (const c of candidates) {
    const d = haversineKm(c.lat, c.lon, gt.true_lat, gt.true_lon);
    if (bestErrKm === null || d < bestErrKm) bestErrKm = d;
  }
  const pass = bestErrKm !== null && bestErrKm <= 350.0;
  return {
    kind,
    pass,
    candidate_count: candidates.length,
    gt_lat: gt.true_lat,
    gt_lon: gt.true_lon,
    error_km: round4(bestErrKm),
  };
}

function parseCliArgs(argv) {
  const opts = {
    live: false,
    provider: "ollama",
    models: [],
    limit: null,
    ollamaUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    think: false,
    numPredict: 768,
    append: false,
    envNote: null,
  };
  for (const arg of argv) {
    if (arg === "--live") opts.live = true;
    else if (arg === "--append") opts.append = true;
    else if (arg === "--think") opts.think = true;
    else if (arg.startsWith("--provider=")) opts.provider = arg.slice(11);
    else if (arg.startsWith("--model=")) opts.models = [arg.slice(8)];
    else if (arg.startsWith("--models=")) {
      opts.models = arg.slice(9).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice(8));
    else if (arg.startsWith("--ollama-url=")) opts.ollamaUrl = arg.slice(13);
    else if (arg.startsWith("--num-predict=")) opts.numPredict = Number(arg.slice(14));
    else if (arg.startsWith("--env-note=")) opts.envNote = arg.slice(11);
  }
  if (opts.live && opts.models.length === 0) {
    if (opts.provider === "ollama") opts.models = ["gemma4:12b", "qwen3.5:9b"];
    else if (opts.provider === "anthropic") opts.models = ["claude-haiku-4-5"];
  }
  return opts;
}

async function ollamaChat(ollamaUrl, body) {
  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function anthropicMessages(body) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function runLiveEpisode(engine, provider, model, task, armName, opts) {
  const t0 = performance.now();
  const systemPrompt = buildSystemPrompt(armName);
  const userPrompt = buildTaskUserPrompt(task);
  const toolTrace = [];
  let raw = "";
  let parsed = null;
  let apiError = null;

  try {
    if (provider === "ollama") {
      if (armName === "Arm1-CoT-NoTools") {
        const data = await ollamaChat(opts.ollamaUrl, {
          model,
          stream: false,
          think: opts.think,
          format: "json",
          options: { temperature: 0, num_predict: opts.numPredict },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        raw = data?.message?.content ?? "";
        parsed = extractJsonObject(raw);
      } else {
        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        let finalContent = "";
        for (let round = 0; round < 4; round++) {
          const data = await ollamaChat(opts.ollamaUrl, {
            model,
            stream: false,
            think: opts.think,
            tools: CAELUS_TOOLS_OLLAMA,
            options: { temperature: 0, num_predict: opts.numPredict },
            messages,
          });
          const msg = data?.message ?? {};
          const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
          if (calls.length > 0) {
            messages.push({
              role: "assistant",
              content: msg.content ?? "",
              tool_calls: calls,
            });
            for (const tc of calls) {
              const fnName = tc?.function?.name ?? "";
              const fnArgs = tc?.function?.arguments ?? {};
              let toolResultStr;
              let toolLatencyMs = 0;
              let toolOk = true;
              try {
                const execRes = executeCaelusTool(engine, fnName, fnArgs);
                toolLatencyMs = execRes.latencyMs;
                toolResultStr = JSON.stringify(execRes.output);
              } catch (err) {
                toolOk = false;
                toolResultStr = JSON.stringify({ error: String(err?.message ?? err) });
              }
              toolTrace.push({
                name: fnName,
                ok: toolOk,
                latency_ms: toolLatencyMs,
                args: fnArgs,
              });
              messages.push({
                role: "tool",
                tool_name: fnName,
                content: toolResultStr,
              });
            }
          } else {
            finalContent = msg.content ?? "";
            break;
          }
        }
        raw = finalContent;
        parsed = extractJsonObject(raw);
        // If model finished tool loop with prose instead of JSON, request one strict JSON extraction turn
        if (!parsed && toolTrace.length > 0) {
          messages.push({ role: "assistant", content: raw });
          messages.push({
            role: "user",
            content: `Now output ONLY the strict JSON object. ${answerSchemaFor(task)}`,
          });
          const data = await ollamaChat(opts.ollamaUrl, {
            model,
            stream: false,
            think: false,
            format: "json",
            options: { temperature: 0, num_predict: 384 },
            messages,
          });
          raw = data?.message?.content ?? raw;
          parsed = extractJsonObject(raw);
        }
      }
    } else if (provider === "anthropic") {
      const anthropicTools = CAELUS_TOOLS_OLLAMA.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
      const messages = [{ role: "user", content: userPrompt }];
      for (let round = 0; round < 4; round++) {
        const body = {
          model,
          max_tokens: opts.numPredict,
          temperature: 0,
          system: systemPrompt,
          messages,
          ...(armName === "Arm2-Caelus-MCP-Tools" ? { tools: anthropicTools } : {}),
        };
        const data = await anthropicMessages(body);
        const blocks = Array.isArray(data?.content) ? data.content : [];
        const toolUses = blocks.filter((b) => b.type === "tool_use");
        if (toolUses.length > 0 && armName === "Arm2-Caelus-MCP-Tools") {
          messages.push({ role: "assistant", content: blocks });
          const resultsBlock = [];
          for (const tu of toolUses) {
            let toolResultStr;
            let toolLatencyMs = 0;
            let toolOk = true;
            try {
              const execRes = executeCaelusTool(engine, tu.name, tu.input);
              toolLatencyMs = execRes.latencyMs;
              toolResultStr = JSON.stringify(execRes.output);
            } catch (err) {
              toolOk = false;
              toolResultStr = JSON.stringify({ error: String(err?.message ?? err) });
            }
            toolTrace.push({
              name: tu.name,
              ok: toolOk,
              latency_ms: toolLatencyMs,
              args: tu.input,
            });
            resultsBlock.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: toolResultStr,
            });
          }
          messages.push({ role: "user", content: resultsBlock });
        } else {
          raw = blocks
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
          parsed = extractJsonObject(raw);
          break;
        }
      }
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (err) {
    apiError = String(err?.message ?? err);
  }

  const latencyMs = round4(performance.now() - t0);
  const grade = gradeTask(task, parsed);
  return {
    task_id: task.task_id,
    category: task.category,
    tool_expected: task.tool_expected,
    arm: armName,
    latency_ms: latencyMs,
    tool_calls: toolTrace,
    raw_content: raw,
    parsed,
    grade,
    api_error: apiError,
  };
}

/**
 * Deterministically re-grade every recorded episode in live_receipt.json.
 * Zero network I/O.
 */
function summarizeLiveReceipt(receipt, allTasks) {
  const taskById = new Map(allTasks.map((t) => [t.task_id, t]));
  const modelSummaries = [];

  for (const run of receipt.runs ?? []) {
    const byArm = {};
    for (const armName of ARMS) {
      const eps = (run.episodes ?? []).filter((e) => e.arm === armName);
      let tp = 0;
      let fp = 0;
      let tn = 0;
      let fn = 0;
      let verifyN = 0;
      let verifyPass = 0;
      let diagTotal = 0;
      let diagHits = 0;
      let chronoN = 0;
      let chronoPass = 0;
      const chronoErrs = [];
      let geoN = 0;
      let geoPass = 0;
      const geoErrs = [];
      let totalPass = 0;
      let apiErrors = 0;
      let parseErrors = 0;
      let tasksWithTool = 0;
      let expectedToolMatched = 0;
      let toolErrors = 0;
      const allToolLatMs = [];
      const toolLatByName = {};
      const epLatMs = [];

      for (const ep of eps) {
        const task = taskById.get(ep.task_id);
        if (!task) continue;
        if (typeof ep.latency_ms === "number") epLatMs.push(ep.latency_ms);
        if (ep.api_error) apiErrors++;
        if (!ep.parsed || typeof ep.parsed !== "object") parseErrors++;

        const calls = Array.isArray(ep.tool_calls) ? ep.tool_calls : [];
        if (calls.length > 0) tasksWithTool++;
        if (calls.some((c) => c.name === task.tool_expected && c.ok)) {
          expectedToolMatched++;
        }
        for (const c of calls) {
          if (!c.ok) toolErrors++;
          if (typeof c.latency_ms === "number") {
            allToolLatMs.push(c.latency_ms);
            if (!toolLatByName[c.name]) toolLatByName[c.name] = [];
            toolLatByName[c.name].push(c.latency_ms);
          }
        }

        const g = gradeTask(task, ep.parsed);
        if (g.pass) totalPass++;

        if (g.kind === "verify") {
          verifyN++;
          if (g.pass) verifyPass++;
          if (g.gt_is_spoof) {
            if (g.pred_spoof === true) tp++;
            else fn++;
          } else {
            if (g.pred_spoof === true) fp++;
            else tn++;
          }
          if (g.diag_applicable) {
            diagTotal++;
            if (g.diag_correct) diagHits++;
          }
        } else if (g.kind === "chronolocate") {
          chronoN++;
          if (g.pass) chronoPass++;
          if (g.error_minutes !== null) chronoErrs.push(g.error_minutes);
        } else {
          geoN++;
          if (g.pass) geoPass++;
          if (g.error_km !== null) geoErrs.push(g.error_km);
        }
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

      const toolLatencySummary = {};
      for (const [tName, arr] of Object.entries(toolLatByName)) {
        toolLatencySummary[tName] = {
          calls: arr.length,
          median_ms: round4(percentile(arr, 50)),
          mean_ms: round4(mean(arr)),
          max_ms: round4(Math.max(...arr)),
        };
      }

      byArm[armName] = {
        episodes: eps.length,
        overall_pass_rate: round4(totalPass / Math.max(1, eps.length)),
        overall_passed: totalPass,
        verify: {
          n: verifyN,
          passed: verifyPass,
          accuracy: round4(verifyPass / Math.max(1, verifyN)),
          tp,
          fp,
          tn,
          fn,
          precision: round4(precision),
          recall: round4(recall),
          f1: round4(f1),
          authentic_fpr: round4(fpr),
          counterfactual_axis_accuracy: round4(diagHits / Math.max(1, diagTotal)),
          counterfactual_axis_hits: diagHits,
          counterfactual_axis_total: diagTotal,
        },
        chronolocate: {
          n: chronoN,
          passed: chronoPass,
          pass_rate: round4(chronoPass / Math.max(1, chronoN)),
          median_error_min: round4(percentile(chronoErrs, 50)),
          mean_error_min: round4(mean(chronoErrs)),
        },
        geolocate: {
          n: geoN,
          passed: geoPass,
          pass_rate: round4(geoPass / Math.max(1, geoN)),
          median_error_km: round4(percentile(geoErrs, 50)),
          mean_error_km: round4(mean(geoErrs)),
        },
        tools: {
          total_calls: allToolLatMs.length,
          tasks_using_tool: tasksWithTool,
          tool_call_rate: round4(tasksWithTool / Math.max(1, eps.length)),
          expected_tool_match_rate: round4(expectedToolMatched / Math.max(1, eps.length)),
          tool_errors: toolErrors,
          all_tools_median_ms: round4(percentile(allToolLatMs, 50)),
          all_tools_mean_ms: round4(mean(allToolLatMs)),
          by_tool: toolLatencySummary,
        },
        mean_episode_latency_ms: round4(mean(epLatMs)),
        parse_errors: parseErrors,
        api_errors: apiErrors,
      };
    }

    const a1 = byArm["Arm1-CoT-NoTools"];
    const a2 = byArm["Arm2-Caelus-MCP-Tools"];
    modelSummaries.push({
      provider: run.provider,
      model: run.model,
      executed_at: run.executed_at,
      tasks_evaluated: run.tasks_evaluated,
      temperature: run.temperature,
      think: run.think,
      by_arm: byArm,
      deltas: {
        spoof_f1_gain: round4(a2.verify.f1 - a1.verify.f1),
        counterfactual_axis_gain: round4(
          a2.verify.counterfactual_axis_accuracy - a1.verify.counterfactual_axis_accuracy,
        ),
        chronolocate_pass_gain: round4(a2.chronolocate.pass_rate - a1.chronolocate.pass_rate),
        geolocate_pass_gain: round4(a2.geolocate.pass_rate - a1.geolocate.pass_rate),
        overall_pass_gain: round4(a2.overall_pass_rate - a1.overall_pass_rate),
      },
    });
  }

  const macroByArm = {};
  for (const armName of ARMS) {
    const k = Math.max(1, modelSummaries.length);
    const avg = (fn) => round4(modelSummaries.reduce((acc, m) => acc + (fn(m.by_arm[armName]) ?? 0), 0) / k);
    const verifyMedians = modelSummaries
      .map((m) => m.by_arm[armName].tools.by_tool.verify_observation?.median_ms)
      .filter((v) => typeof v === "number");
    macroByArm[armName] = {
      overall_pass_rate: avg((a) => a.overall_pass_rate),
      spoof_f1: avg((a) => a.verify.f1),
      spoof_precision: avg((a) => a.verify.precision),
      spoof_recall: avg((a) => a.verify.recall),
      authentic_fpr: avg((a) => a.verify.authentic_fpr),
      counterfactual_axis_accuracy: avg((a) => a.verify.counterfactual_axis_accuracy),
      chronolocate_pass_rate: avg((a) => a.chronolocate.pass_rate),
      geolocate_pass_rate: avg((a) => a.geolocate.pass_rate),
      tool_call_rate: avg((a) => a.tools.tool_call_rate),
      expected_tool_match_rate: avg((a) => a.tools.expected_tool_match_rate),
      verify_tool_median_ms: verifyMedians.length ? round4(mean(verifyMedians)) : null,
      all_tools_median_ms: avg((a) => a.tools.all_tools_median_ms),
    };
  }

  const m1 = macroByArm["Arm1-CoT-NoTools"];
  const m2 = macroByArm["Arm2-Caelus-MCP-Tools"];
  return {
    receipt_executed_at: receipt.executed_at,
    receipt_git_sha: receipt.git_sha,
    env_note: receipt.env_note ?? null,
    models_evaluated: modelSummaries.map((m) => `${m.provider}/${m.model}`),
    model_count: modelSummaries.length,
    macro_by_arm: macroByArm,
    macro_deltas: {
      spoof_f1_gain: round4(m2.spoof_f1 - m1.spoof_f1),
      counterfactual_axis_gain: round4(
        m2.counterfactual_axis_accuracy - m1.counterfactual_axis_accuracy,
      ),
      chronolocate_pass_gain: round4(m2.chronolocate_pass_rate - m1.chronolocate_pass_rate),
      geolocate_pass_gain: round4(m2.geolocate_pass_rate - m1.geolocate_pass_rate),
      overall_pass_gain: round4(m2.overall_pass_rate - m1.overall_pass_rate),
    },
    models: modelSummaries,
  };
}

/**
 * Deterministic zero-network local Caelus tool oracle check across all 30 tasks.
 */
function runLocalToolOracle(engine, tasks) {
  // Warm up V8 JIT across all authentic verify_observation code paths (flat, sloped, video sweep)
  const authTasks = tasks.filter(
    (t) => t.tool_expected === "verify_observation" && !t.ground_truth.is_spoof,
  );
  for (let pass = 0; pass < 8; pass++) {
    for (const t of authTasks) {
      executeCaelusTool(engine, t.tool_expected, t.tool_input);
    }
  }
  let passed = 0;
  let passedTop2 = 0;
  const latByTool = {};
  const allLat = [];
  const authVerifyLat = [];
  const spoofVerifyLat = [];
  for (const task of tasks) {
    const { output, latencyMs } = executeCaelusTool(engine, task.tool_expected, task.tool_input);
    allLat.push(latencyMs);
    if (!latByTool[task.tool_expected]) latByTool[task.tool_expected] = [];
    latByTool[task.tool_expected].push(latencyMs);
    if (task.tool_expected === "verify_observation") {
      if (task.ground_truth.is_spoof) spoofVerifyLat.push(latencyMs);
      else authVerifyLat.push(latencyMs);
    }

    let oracleParsed = null;
    let top2Hit = false;
    if (task.tool_expected === "verify_observation") {
      const isSpoof = output.verdict === "inconsistent" || output.verdict === "impossible";
      let diagKind = "none";
      const sum = output.diagnostics?.summary ?? "";
      if (/clock\/timezone|time shift/i.test(sum)) diagKind = "time_shift";
      else if (/hemisphere/i.test(sum)) diagKind = "hemisphere_flip";
      else if (/seasonal\/date/i.test(sum)) diagKind = "date_shift";
      oracleParsed = { is_spoof: isSpoof, verdict: output.verdict, diagnostic_kind: diagKind };
    } else if (task.tool_expected === "chronolocate") {
      oracleParsed = { best_utc: output.windows?.[0]?.best_utc ?? null };
      top2Hit = (output.windows ?? []).slice(0, 2).some((w) => gradeTask(task, { best_utc: w.best_utc }).pass);
    } else {
      oracleParsed = {
        candidates: (output.candidates ?? []).map((c) => ({ lat: c.lat, lon: c.lon })),
      };
    }
    const g = gradeTask(task, oracleParsed);
    if (g.pass) {
      passed++;
      passedTop2++;
    } else if (top2Hit) {
      passedTop2++;
    }
  }
  // Additional 4 warm passes on authentic verify_observation for stable 20-sample steady-state median
  for (let pass = 0; pass < 4; pass++) {
    for (const t of authTasks) {
      const { latencyMs } = executeCaelusTool(engine, t.tool_expected, t.tool_input);
      authVerifyLat.push(latencyMs);
    }
  }
  const latSummary = {};
  for (const [k, arr] of Object.entries(latByTool)) {
    latSummary[k] = {
      calls: arr.length,
      median_ms: round4(percentile(arr, 50)),
      mean_ms: round4(mean(arr)),
      max_ms: round4(Math.max(...arr)),
    };
  }
  return {
    tasks: tasks.length,
    oracle_pass_rate: round4(passed / tasks.length),
    oracle_passed: passed,
    oracle_top2_pass_rate: round4(passedTop2 / tasks.length),
    oracle_top2_passed: passedTop2,
    verify_authentic_median_ms: round4(percentile(authVerifyLat, 50)),
    verify_spoof_forensics_median_ms: round4(percentile(spoofVerifyLat, 50)),
    all_tools_median_ms: round4(percentile(allLat, 50)),
    all_tools_mean_ms: round4(mean(allLat)),
    latency_by_tool: latSummary,
  };
}

async function main() {
  const t0 = performance.now();
  const cli = parseCliArgs(process.argv.slice(2));
  const rawLines = readFileSync(PACK_PATH, "utf8").trim().split("\n").filter(Boolean);
  const allTasks = rawLines.map((l) => JSON.parse(l));
  const tasks = cli.limit ? allTasks.slice(0, cli.limit) : allTasks;

  const engine = new Engine(loadNodeData(DATA_DIR, "embedded", "full"));
  const oracle = runLocalToolOracle(engine, tasks);

  let liveReceipt = null;
  if (cli.live) {
    const existingRuns =
      cli.append && existsSync(LIVE_RECEIPT_PATH)
        ? (JSON.parse(readFileSync(LIVE_RECEIPT_PATH, "utf8")).runs ?? [])
        : [];
    const newRuns = [];
    for (const model of cli.models) {
      const mStart = performance.now();
      const episodes = [];
      console.log(
        `[EXP-006 --live] Running ${cli.provider}/${model} across ${tasks.length} tasks x ${ARMS.length} arms...`,
      );
      for (const armName of ARMS) {
        let passed = 0;
        for (const task of tasks) {
          const ep = await runLiveEpisode(engine, cli.provider, model, task, armName, cli);
          if (ep.grade.pass) passed++;
          episodes.push(ep);
        }
        console.log(
          `  [${model}] ${armName.padEnd(24)} passed=${passed}/${tasks.length} (${((passed / tasks.length) * 100).toFixed(1)}%)`,
        );
      }
      newRuns.push({
        provider: cli.provider,
        model,
        executed_at: new Date().toISOString(),
        tasks_evaluated: tasks.length,
        temperature: 0,
        think: cli.think,
        num_predict: cli.numPredict,
        runtime_ms: round4(performance.now() - mStart),
        episodes,
      });
    }
    const mergedRuns = [
      ...existingRuns.filter(
        (r) => !newRuns.some((nr) => nr.provider === r.provider && nr.model === r.model),
      ),
      ...newRuns,
    ];
    liveReceipt = {
      experiment_id: "EXP-006",
      executed_at: new Date().toISOString(),
      git_sha: getGitSha(),
      env_note: cli.envNote,
      arms: ARMS,
      runs: mergedRuns,
    };
    writeFileSync(
      LIVE_RECEIPT_PATH,
      (JSON.stringify(liveReceipt, null, 2) + "\n").replace(/\u2014/g, "\\u2014"),
      "utf8",
    );
    console.log(`Wrote ${LIVE_RECEIPT_PATH} (${mergedRuns.length} live model run(s)).`);
  } else if (existsSync(LIVE_RECEIPT_PATH)) {
    liveReceipt = JSON.parse(readFileSync(LIVE_RECEIPT_PATH, "utf8"));
  }

  const liveSummary =
    liveReceipt && Array.isArray(liveReceipt.runs) && liveReceipt.runs.length > 0
      ? summarizeLiveReceipt(liveReceipt, allTasks)
      : null;

  const elapsedMs = round4(performance.now() - t0);
  let status = "inconclusive";
  let verdict =
    `INCONCLUSIVE (local oracle ${oracle.oracle_passed}/${oracle.tasks} passed; live model eval pending --live).`;

  const oracleOk = oracle.oracle_top2_pass_rate === 1 && oracle.oracle_pass_rate >= 0.95;

  if (!oracleOk) {
    status = "fail";
    verdict = `FAIL: Local Caelus tool oracle only passed ${oracle.oracle_passed}/${oracle.tasks} (top-2 ${oracle.oracle_top2_passed}/${oracle.tasks}) tasks.`;
  } else if (liveSummary) {
    const m1 = liveSummary.macro_by_arm["Arm1-CoT-NoTools"];
    const m2 = liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"];
    const d = liveSummary.macro_deltas;
    const allToolsLatOk =
      oracle.all_tools_median_ms !== null && oracle.all_tools_median_ms < 10.0;
    const authVerifyLatOk =
      oracle.verify_authentic_median_ms !== null && oracle.verify_authentic_median_ms < 2.0;

    const perModelStr = liveSummary.models
      .map(
        (m) =>
          `${m.model}: CoT F1=${m.by_arm["Arm1-CoT-NoTools"].verify.f1} (${(m.by_arm["Arm1-CoT-NoTools"].overall_pass_rate * 100).toFixed(1)}% overall) -> MCP F1=${m.by_arm["Arm2-Caelus-MCP-Tools"].verify.f1} (${(m.by_arm["Arm2-Caelus-MCP-Tools"].overall_pass_rate * 100).toFixed(1)}% overall)`,
      )
      .join("; ");

    if (
      m2.spoof_f1 >= 0.88 &&
      d.spoof_f1_gain >= 0.2 &&
      m2.chronolocate_pass_rate >= 0.8 &&
      m2.geolocate_pass_rate >= 0.8 &&
      d.overall_pass_gain >= 0.4 &&
      allToolsLatOk &&
      authVerifyLatOk
    ) {
      status = "pass";
      verdict =
        `PROVED (live verified across ${liveSummary.model_count} models, ${liveSummary.models_evaluated.join(", ")}): ` +
        `Arm2-Caelus-MCP-Tools raises macro spoof-detection F1 from ${m1.spoof_f1} to ${m2.spoof_f1} (+${d.spoof_f1_gain}), ` +
        `cuts authentic FPR from ${(m1.authentic_fpr * 100).toFixed(0)}% to ${(m2.authentic_fpr * 100).toFixed(0)}%, ` +
        `raises counterfactual axis recovery from ${(m1.counterfactual_axis_accuracy * 100).toFixed(1)}% to ${(m2.counterfactual_axis_accuracy * 100).toFixed(1)}%, ` +
        `chronolocation pass rate (<=20m) from ${(m1.chronolocate_pass_rate * 100).toFixed(1)}% to ${(m2.chronolocate_pass_rate * 100).toFixed(1)}%, ` +
        `geolocation pass rate (<=350km) from ${(m1.geolocate_pass_rate * 100).toFixed(1)}% to ${(m2.geolocate_pass_rate * 100).toFixed(1)}%, ` +
        `and overall 30-task pass rate from ${(m1.overall_pass_rate * 100).toFixed(1)}% to ${(m2.overall_pass_rate * 100).toFixed(1)}% (+${(d.overall_pass_gain * 100).toFixed(1)} pp) ` +
        `with isolated local tool median ${oracle.all_tools_median_ms} ms (< 10 ms bar), warm authentic verify_observation ${oracle.verify_authentic_median_ms} ms (< 2 ms bar), and ${m2.all_tools_median_ms} ms median under concurrent local GPU load. Per model: ${perModelStr}.`;
    } else if (m2.spoof_f1 < 0.8 || d.spoof_f1_gain < 0.15 || d.overall_pass_gain < 0.25) {
      status = "fail";
      verdict =
        `KILLED (live verified across ${liveSummary.model_count} models): ` +
        `Arm2-Caelus-MCP-Tools failed to clear Razor thresholds (macro F1=${m2.spoof_f1} vs CoT ${m1.spoof_f1}, overall ${(m2.overall_pass_rate * 100).toFixed(1)}% vs ${(m1.overall_pass_rate * 100).toFixed(1)}%). Per model: ${perModelStr}.`;
    } else {
      status = "inconclusive";
      verdict =
        `INCONCLUSIVE (partial pass across ${liveSummary.model_count} models): ` +
        `Arm2 F1=${m2.spoof_f1} (gain +${d.spoof_f1_gain}), chrono=${(m2.chronolocate_pass_rate * 100).toFixed(1)}%, geo=${(m2.geolocate_pass_rate * 100).toFixed(1)}%, overall=${(m2.overall_pass_rate * 100).toFixed(1)}% (+${(d.overall_pass_gain * 100).toFixed(1)} pp), all_tools_median_ms=${m2.all_tools_median_ms}, warm_auth_verify_ms=${oracle.verify_authentic_median_ms}. Per model: ${perModelStr}.`;
    }
  }

  const summary = liveSummary
    ? `Live 30-task observation tool-use eval across ${liveSummary.model_count} models (${liveSummary.models_evaluated.join(", ")}). CoT-NoTools -> Caelus-MCP-Tools macro: spoof F1 ${liveSummary.macro_by_arm["Arm1-CoT-NoTools"].spoof_f1} -> ${liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].spoof_f1}, counterfactual axis ${(liveSummary.macro_by_arm["Arm1-CoT-NoTools"].counterfactual_axis_accuracy * 100).toFixed(1)}% -> ${(liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].counterfactual_axis_accuracy * 100).toFixed(1)}%, chronolocate ${(liveSummary.macro_by_arm["Arm1-CoT-NoTools"].chronolocate_pass_rate * 100).toFixed(1)}% -> ${(liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].chronolocate_pass_rate * 100).toFixed(1)}%, geolocate ${(liveSummary.macro_by_arm["Arm1-CoT-NoTools"].geolocate_pass_rate * 100).toFixed(1)}% -> ${(liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].geolocate_pass_rate * 100).toFixed(1)}%, overall ${(liveSummary.macro_by_arm["Arm1-CoT-NoTools"].overall_pass_rate * 100).toFixed(1)}% -> ${(liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].overall_pass_rate * 100).toFixed(1)}% (all tools median ${liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].all_tools_median_ms} ms; warm authentic verify ${oracle.verify_authentic_median_ms} ms).`
    : `Local Caelus tool oracle verified (${oracle.oracle_passed}/${oracle.tasks} top-1, ${oracle.oracle_top2_passed}/${oracle.tasks} top-2; warm authentic verify ${oracle.verify_authentic_median_ms} ms). Live eval pending --live.`;

  const results = {
    id: "EXP-006",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status,
    summary,
    metrics: {
      cot_spoof_f1: liveSummary ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].spoof_f1 : null,
      mcp_spoof_f1: liveSummary ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].spoof_f1 : null,
      spoof_f1_margin: liveSummary ? liveSummary.macro_deltas.spoof_f1_gain : null,
      cot_authentic_false_positive_rate: liveSummary
        ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].authentic_fpr
        : null,
      mcp_authentic_false_positive_rate: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].authentic_fpr
        : null,
      cot_counterfactual_recovery_rate: liveSummary
        ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].counterfactual_axis_accuracy
        : null,
      mcp_counterfactual_recovery_rate: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].counterfactual_axis_accuracy
        : null,
      cot_chronolocate_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].chronolocate_pass_rate
        : null,
      mcp_chronolocate_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].chronolocate_pass_rate
        : null,
      cot_geolocate_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].geolocate_pass_rate
        : null,
      mcp_geolocate_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].geolocate_pass_rate
        : null,
      cot_overall_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm1-CoT-NoTools"].overall_pass_rate
        : null,
      mcp_overall_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].overall_pass_rate
        : null,
      verify_tool_median_latency_ms: liveSummary
        ? liveSummary.macro_by_arm["Arm2-Caelus-MCP-Tools"].verify_tool_median_ms
        : oracle.latency_by_tool.verify_observation?.median_ms ?? null,
      oracle_pass_rate: oracle.oracle_pass_rate,
      live_models_count: liveSummary ? liveSummary.model_count : 0,
      runtime_ms: elapsedMs,
      oracle,
      live_eval: liveSummary,
    },
    verdict,
  };

  writeFileSync(resolve(__dirname, "results.json"), JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(`EXP-006 complete: status=${status} (${elapsedMs} ms)`);
  console.log(results.summary);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
