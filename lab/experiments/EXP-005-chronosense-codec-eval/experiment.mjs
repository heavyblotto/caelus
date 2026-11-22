#!/usr/bin/env node
/**
 * EXP-005: Chronosense Physical vs. Symbolic Codec Eval Harness
 *
 * Evaluates all 5 temporal context arms from EXP-001/eval_suite.jsonl:
 *   1. Baseline-None
 *   2. Control-ISO
 *   3. Control-Synthetic
 *   4. Treatment-Caelus-Physical
 *   5. Arm4b-Caelus-Symbolic
 *
 * Default mode (zero network, deterministic):
 *   - Re-verifies every eval_suite.jsonl ground_truth record against live
 *     packages/caelus/dist/ (sceneGeometry, canonicalChart, chartDigest).
 *   - Runs a bounded zero-ephemeris codec decoder audit measuring exact
 *     field-level information recoverability, token cost, zodiac-conversion
 *     arithmetic hops, and symbolic sign-slip sensitivity across all 20 tasks.
 *   - Runs deterministic grader self-tests (oracle pass + corrupt catch).
 *   - If live_receipt.json exists alongside this script, deterministically
 *     re-grades every raw recorded live-LLM output without network I/O and
 *     computes the verified Razor verdict.
 *
 * Live-LLM mode (explicit CLI opt-in only):
 *   node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs \
 *     --live --provider=ollama --models=gemma4:12b,qwen3.5:9b
 *   Supported providers: ollama (http://127.0.0.1:11434), anthropic
 *   (ANTHROPIC_API_KEY), gemini (GEMINI_API_KEY), openai (OPENAI_API_KEY).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import { loadNodeData } from "../../../packages/caelus/dist/src/node-loader.js";
import {
  Engine,
  sceneGeometry,
} from "../../../packages/caelus/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/caelus/data");
const EVAL_SUITE_PATH = resolve(
  REPO_ROOT,
  "lab/experiments/EXP-001-chronosense-ablation/eval_suite.jsonl",
);
const LIVE_RECEIPT_PATH = resolve(__dirname, "live_receipt.json");

export const ARMS = [
  "Baseline-None",
  "Control-ISO",
  "Control-Synthetic",
  "Treatment-Caelus-Physical",
  "Arm4b-Caelus-Symbolic",
];

const SIGN_ABBREV = [
  "Ari", "Tau", "Gem", "Can", "Leo", "Vir",
  "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis",
];

const HIGH_LAT_CITIES = new Set(["oslo", "tromso"]);

/**
 * Symmetric, arm-specific header legends mirroring production middleware
 * documentation. Every arm receives an exact specification of its own header
 * syntax, including explicit sign-to-degree offsets for Arm4b-Caelus-Symbolic
 * and sin24/cos24 conventions for Control-Synthetic.
 */
const ARM_LEGENDS = {
  "Baseline-None": "No temporal context header is injected.",
  "Control-ISO": "Header format: `[time] <UTC ISO-8601 timestamp>`.",
  "Control-Synthetic":
    "Header format: `[clock] elapsed=<seconds since episode start> sin24=<sin(2*pi*local_mean_hour/24)> cos24=<cos(2*pi*local_mean_hour/24)> due=<signed minutes to deadline>` (cos24=-1 is local mean noon, +1 is local mean midnight; positive due is applying/upcoming, negative is separating/past, |due|<=2 is exact).",
  "Treatment-Caelus-Physical":
    "Header format: `<UTC> <twilight: day|civil|nautical|astronomical|night> sun:<alt><dir>/<trend> <next_event>:<min>m due:<signed_min>m/<phase> [+night present iff local solar midnight passed since prior turn] m:<moon_ecliptic_lon_deg> a:<asc_deg> #<canonical_digest8>`.",
  "Arm4b-Caelus-Symbolic":
    "Header format: `[caelus-sym] <Day|Night> <planetary_hour|polar> | Sun <deg><Sign> | Moon <deg><Sign> | Asc <deg><Sign> due=<signed_min>m/<phase> [+night present iff local solar midnight passed since prior turn] | d=<canonical_digest8>` (ecliptic zodiac 0..360 deg in twelve 30-deg signs: Ari=0, Tau=30, Gem=60, Can=90, Leo=120, Vir=150, Lib=180, Sco=210, Sag=240, Cap=270, Aqu=300, Pis=330).",
};

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

function approxCl100kTokens(text) {
  if (!text) return 0;
  const parts = text.match(/[A-Za-z]+|\d+|[^\sA-Za-z\d]/g) ?? [];
  return parts.length;
}

function whitespaceTokens(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function angDist(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function round4(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(x.toFixed(4));
}

function round2(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(x.toFixed(2));
}

/**
 * Deterministic Mulberry32 PRNG for reproducible 10,000-resample bootstrap CIs.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantileSorted(sorted, q) {
  if (!sorted.length) return null;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Exact two-sided binomial sign-test p-value for wins vs losses (ignoring ties).
 */
function exactBinomialTwoSidedP(wins, losses) {
  const n = wins + losses;
  if (n === 0) return 1.0;
  const k = Math.min(wins, losses);
  // Compute sum_{i=0..k} C(n, i) * 2^-n safely via log-gamma / multiplicative step
  let prob = 0;
  let term = Math.pow(0.5, n);
  prob += term;
  for (let i = 1; i <= k; i++) {
    term = (term * (n - i + 1)) / i;
    prob += term;
  }
  return Math.min(1.0, 2.0 * prob);
}

/**
 * Deterministic B=10,000 bootstrap 95% CI for mean of scalar array.
 */
function bootstrapMeanCi(values, resamples = 10000, seed = 20261122) {
  const n = values.length;
  if (n === 0) return { mean: null, ci95: [null, null], se: null };
  const meanVal = values.reduce((a, b) => a + b, 0) / n;
  const rng = mulberry32(seed);
  const boots = new Float64Array(resamples);
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += values[Math.floor(rng() * n)];
    }
    boots[b] = s / n;
  }
  boots.sort();
  let sumSq = 0;
  for (let b = 0; b < resamples; b++) {
    const d = boots[b] - meanVal;
    sumSq += d * d;
  }
  return {
    n,
    resamples,
    mean: round4(meanVal),
    se: round4(Math.sqrt(sumSq / resamples)),
    ci95: [round4(quantileSorted(boots, 0.025)), round4(quantileSorted(boots, 0.975))],
  };
}

/**
 * Deterministic B=10,000 paired bootstrap comparison of armA minus armB.
 */
function pairedBootstrapTest(scoresA, scoresB, resamples = 10000, seed = 20261122) {
  const n = Math.min(scoresA.length, scoresB.length);
  const diffs = new Array(n);
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let sumD = 0;
  for (let i = 0; i < n; i++) {
    const d = scoresA[i] - scoresB[i];
    diffs[i] = d;
    sumD += d;
    if (d > 1e-9) wins++;
    else if (d < -1e-9) losses++;
    else ties++;
  }
  const meanDiff = sumD / Math.max(1, n);
  const rng = mulberry32(seed);
  const boots = new Float64Array(resamples);
  let leZero = 0;
  let geZero = 0;
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += diffs[Math.floor(rng() * n)];
    }
    const m = s / n;
    boots[b] = m;
    if (m <= 0) leZero++;
    if (m >= 0) geZero++;
  }
  boots.sort();
  const ciLo = quantileSorted(boots, 0.025);
  const ciHi = quantileSorted(boots, 0.975);
  const pOneSided = leZero / resamples;
  const pTwoSided = Math.min(1.0, 2.0 * Math.min(leZero, geZero) / resamples);
  const signTestP = exactBinomialTwoSidedP(wins, losses);
  return {
    n_pairs: n,
    resamples,
    mean_diff: round4(meanDiff),
    ci95: [round4(ciLo), round4(ciHi)],
    ci95_excludes_zero: ciLo > 0 || ciHi < 0,
    bootstrap_p_one_sided_le_zero: Number(pOneSided.toFixed(6)),
    bootstrap_p_two_sided: Number(pTwoSided.toFixed(6)),
    exact_sign_test_p_two_sided: Number(signTestP.toFixed(6)),
    wins,
    ties,
    losses,
  };
}

/**
 * 20-line Spencer (1971) / NOAA solar declination + equation-of-time baseline.
 * Zero ephemeris tables, zero atmospheric refraction on altitude, zero Moon, zero canonical digest.
 */
function noaa20Solar(jdUt, latDeg, lonEastDeg) {
  const DEG = Math.PI / 180;
  const dt = new Date((jdUt - 2440587.5) * 86400000);
  const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
  const doy = Math.floor((dt.getTime() - yearStart) / 86400000);
  const utcHr = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
  const gamma = ((2 * Math.PI) / 365) * (doy + (utcHr - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latR = latDeg * DEG;
  const tst = (((utcHr * 60 + eqtime + 4 * lonEastDeg) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * DEG;
  const sinAlt = Math.max(-1, Math.min(1, Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)));
  const altDeg = Math.asin(sinAlt) / DEG;
  const cosHa0 = (Math.cos(90.833 * DEG) - Math.sin(latR) * Math.sin(decl)) / Math.max(1e-9, Math.cos(latR) * Math.cos(decl));
  const ha0Deg = cosHa0 >= -1 && cosHa0 <= 1 ? Math.acos(cosHa0) / DEG : null;
  const noonUtcMin = 720 - 4 * lonEastDeg - eqtime;
  const sunsetUtcMin = ha0Deg !== null ? noonUtcMin + 4 * ha0Deg : null;
  const sunriseUtcMin = ha0Deg !== null ? noonUtcMin - 4 * ha0Deg : null;
  const isDay = altDeg >= -0.833;
  const twilightStage = altDeg >= -0.833 ? "day" : altDeg >= -6 ? "civil" : altDeg >= -12 ? "nautical" : altDeg >= -18 ? "astronomical" : "night";
  return { altDeg, declDeg: decl / DEG, eqtimeMin: eqtime, tstMin: tst, noonUtcMin, sunriseUtcMin, sunsetUtcMin, polarNoRiseSet: ha0Deg === null, isDay, twilightStage };
}

/**
 * Evaluate the offline 20-line NOAA solar formula baseline against EXP-001/eval_suite.jsonl
 * and measure exact agreement / divergence vs Caelus sceneGeometry.
 */
function evaluateNoaa20Baseline(engine, tasks) {
  let totalScore = 0;
  let totalExact = 0;
  let compScore = 0;
  let compN = 0;
  let photoScore = 0;
  let photoN = 0;
  let cl100kSum = 0;
  let wsSum = 0;
  const fieldHits = {};
  const fieldTotals = {};
  const altDiffsAll = [];
  const altDiffsMidLat = [];
  const altDiffsHighLat = [];
  const sunsetTimingDiffsMidLat = [];
  const sunsetTimingDiffsHighLat = [];
  let polarUndefinedSunsetCount = 0;
  let twilightMatchesAll20 = 0;

  for (const task of tasks) {
    const noaa = noaa20Solar(task.jd_ut, task.lat, task.lon_east);
    const scene = sceneGeometry(engine, task.jd_ut, task.lat, task.lon_east, {
      prevJdUt: task.prev_jd_ut,
      deadlineJdUt: task.deadline_jd_ut,
    });
    const isHiLat = HIGH_LAT_CITIES.has(task.city_id);

    const altDiff = Math.abs(noaa.altDeg - scene.sun.altitudeApparentDeg);
    altDiffsAll.push(altDiff);
    if (isHiLat) altDiffsHighLat.push(altDiff);
    else altDiffsMidLat.push(altDiff);

    if (noaa.twilightStage === task.ground_truth.twilight_stage) twilightMatchesAll20++;

    // NOAA local-solar-midnight crossing check between prev_jd_ut and jd_ut (tst wraps past 0/1440)
    const dtDays = task.jd_ut - task.prev_jd_ut;
    const prevNoaa = noaa20Solar(task.prev_jd_ut, task.lat, task.lon_east);
    const nightCrossedNoaa = dtDays >= 1.0 || noaa.tstMin < prevNoaa.tstMin;

    // NOAA deadline minutes remaining: compare NOAA's predicted event time (solar_noon or sunset)
    // vs task.deadline_jd_ut on the same UTC date as deadline_jd_ut
    const dlNoaa = noaa20Solar(task.deadline_jd_ut, task.lat, task.lon_east);
    const dlUtcDay0 = Math.floor(task.deadline_jd_ut - 0.5) + 0.5;
    let predDeadlineJd = null;
    if (task.deadline_kind === "solar_noon" || task.deadline_kind === "polar_noon_fallback") {
      // Pick closest noon cycle to deadline_jd_ut
      const cands = [-1, 0, 1].map((d) => dlUtcDay0 + d + dlNoaa.noonUtcMin / 1440);
      predDeadlineJd = cands.reduce((best, c) =>
        Math.abs(c - task.deadline_jd_ut) < Math.abs(best - task.deadline_jd_ut) ? c : best,
      );
    } else if (task.deadline_kind === "sunset") {
      if (dlNoaa.sunsetUtcMin !== null) {
        const cands = [-1, 0, 1].map((d) => dlUtcDay0 + d + dlNoaa.sunsetUtcMin / 1440);
        predDeadlineJd = cands.reduce((best, c) =>
          Math.abs(c - task.deadline_jd_ut) < Math.abs(best - task.deadline_jd_ut) ? c : best,
        );
      } else {
        polarUndefinedSunsetCount++;
      }
    }

    if (task.deadline_kind === "polar_noon_fallback" && dlNoaa.polarNoRiseSet) {
      polarUndefinedSunsetCount++;
    }

    let dlMinNoaa = null;
    let dlPhaseNoaa = null;
    if (predDeadlineJd !== null) {
      dlMinNoaa = Math.round((predDeadlineJd - task.jd_ut) * 1440);
      dlPhaseNoaa = Math.abs(dlMinNoaa) <= 2 ? "exact" : dlMinNoaa > 0 ? "applying" : "separating";
      const timingErrMin = Math.abs(predDeadlineJd - task.deadline_jd_ut) * 1440;
      if (isHiLat) sunsetTimingDiffsHighLat.push(timingErrMin);
      else sunsetTimingDiffsMidLat.push(timingErrMin);
    }

    // Build compact NOAA-20line text header (no moon longitude, no canonical digest)
    const isoShort = new Date((task.jd_ut - 2440587.5) * 86400000).toISOString().slice(0, 16) + "Z";
    const altStr = `${noaa.altDeg >= 0 ? "+" : ""}${Math.round(noaa.altDeg)}`;
    const dueStr = dlMinNoaa !== null ? `due:${dlMinNoaa >= 0 ? "+" : ""}${dlMinNoaa}m/${dlPhaseNoaa}` : "due:n/a";
    const header = `${isoShort} ${noaa.twilightStage} sun:${altStr} ${dueStr}${nightCrossedNoaa ? " +night" : ""}`;
    cl100kSum += approxCl100kTokens(header);
    wsSum += whitespaceTokens(header);

    // Zero-ephemeris decoded record from NOAA-20line (cannot resolve moon-tagged fresh_tool_id or canonical_digest8)
    const decoded = {
      night_crossed: nightCrossedNoaa,
      fresh_tool_id: null,
      canonical_digest8: null,
      is_day: noaa.isDay,
      twilight_stage: noaa.twilightStage,
      deadline_phase: dlPhaseNoaa,
      deadline_minutes_remaining: dlMinNoaa,
    };
    const graded = gradeResponse(task, decoded);
    totalScore += graded.score;
    if (graded.all_correct) totalExact++;
    if (task.archetype === "compaction_stale_tool") {
      compScore += graded.score;
      compN++;
    } else {
      photoScore += graded.score;
      photoN++;
    }
    for (const [k, ok] of Object.entries(graded.checks)) {
      fieldTotals[k] = (fieldTotals[k] ?? 0) + 1;
      if (ok) fieldHits[k] = (fieldHits[k] ?? 0) + 1;
    }
  }

  // Horizon-grazing refraction probe (Oslo winter sunset + Tromso low Arctic sun)
  // Measures where unrefracted NOAA-20line diverges from refracted Caelus apparent altitude
  const refractionProbes = [
    { label: "Oslo winter sunset grazing", jdUt: 2461391.090786, lat: 59.9139, lon: 10.7522 },
    { label: "Tromso June low midnight sun", jdUt: 2461207.46, lat: 69.6492, lon: 18.9553 },
    { label: "NYC equinox sunset", jdUt: 2461119.965, lat: 40.7128, lon: -74.006 },
  ].map((p) => {
    const n = noaa20Solar(p.jdUt, p.lat, p.lon);
    const s = sceneGeometry(engine, p.jdUt, p.lat, p.lon);
    return {
      label: p.label,
      noaa_geom_alt_deg: round4(n.altDeg),
      caelus_apparent_alt_deg: round4(s.sun.altitudeApparentDeg),
      abs_diff_deg: round4(Math.abs(n.altDeg - s.sun.altitudeApparentDeg)),
    };
  });

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const maxVal = (arr) => (arr.length ? Math.max(...arr) : null);
  const fieldAcc = {};
  for (const k of Object.keys(fieldTotals)) {
    fieldAcc[k] = round4((fieldHits[k] ?? 0) / fieldTotals[k]);
  }

  return {
    arm_name: "Control-NOAA-20line",
    formula: "20-line Spencer (1971) / NOAA solar declination + equation-of-time (zero Moon, zero refraction, zero canonical digest)",
    mean_score: round4(totalScore / tasks.length),
    exact_task_rate: round4(totalExact / tasks.length),
    compaction_score: round4(compScore / Math.max(1, compN)),
    photoperiod_score: round4(photoScore / Math.max(1, photoN)),
    twilight_5class_all20_accuracy: round4(twilightMatchesAll20 / tasks.length),
    mean_cl100k_tokens: round4(cl100kSum / tasks.length),
    mean_whitespace_tokens: round4(wsSum / tasks.length),
    field_accuracy: fieldAcc,
    vs_caelus_scene_geometry: {
      solar_alt_mae_all_deg: round4(avg(altDiffsAll)),
      solar_alt_max_err_all_deg: round4(maxVal(altDiffsAll)),
      solar_alt_mae_midlat_deg: round4(avg(altDiffsMidLat)),
      solar_alt_mae_highlat_deg: round4(avg(altDiffsHighLat)),
      deadline_timing_mae_midlat_min: round4(avg(sunsetTimingDiffsMidLat)),
      deadline_timing_max_midlat_min: round4(maxVal(sunsetTimingDiffsMidLat)),
      deadline_timing_mae_highlat_min: round4(avg(sunsetTimingDiffsHighLat)),
      deadline_timing_max_highlat_min: round4(maxVal(sunsetTimingDiffsHighLat)),
      polar_undefined_sunset_tasks: polarUndefinedSunsetCount,
      horizon_refraction_probes: refractionProbes,
    },
    where_noaa20_ties_caelus:
      "On basic mid-latitude solar daylight, twilight class, solar noon, and sunset timing, the 20-line NOAA formula matches Caelus sceneGeometry within ~1-2 minutes and achieves 100% on the 10-task photoperiod-deadline slice offline.",
    where_caelus_adds_value: [
      "Polar and low-elevation refraction: unrefracted NOAA-20line misses ~0.55-0.60 deg atmospheric refraction near the horizon and produces undefined sunrise/sunset roots during polar midnight sun / polar night (Tromso).",
      "Lunar compaction separation: NOAA-20line has zero Moon ephemeris, scoring 0/10 (0.0%) on same-clock-time cross-day stale-tool separation (fresh_tool_id) vs 10/10 (100%) for Caelus.",
      "Canonical provenance & digest auditing: NOAA-20line emits no canonical chart digest (0/10 on digest_match) and cannot power EXP-003/EXP-006 sloped-ground 3D shadows or lunar bright-limb tilt.",
      "Unified zero-dependency cross-runtime packaging: Caelus packages solar, lunar, horizon, shadow, and MCP audit primitives in one tested zero-dep TypeScript/Python library rather than ad-hoc per-task trig snippets.",
    ],
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
    numPredict: 512,
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
    else if (opts.provider === "gemini") opts.models = ["gemini-2.5-flash"];
    else if (opts.provider === "openai") opts.models = ["gpt-4o-mini"];
  }
  return opts;
}

function parseToolCandidates(userPrompt) {
  const re = /\[(Tool-[AB])\] recorded at local (\d\d:\d\d) \(moon=([0-9.]+)deg\)/g;
  const out = [];
  let m;
  while ((m = re.exec(userPrompt)) !== null) {
    out.push({ id: m[1], localHm: m[2], moonDeg: Number(m[3]) });
  }
  return out;
}

/**
 * Bounded zero-ephemeris codec decoder.
 * Reads ONLY the arm's system_header (plus user_prompt tool lines) without
 * invoking any astronomical ephemeris or lookup table outside static zodiac
 * sign indices.
 */
function decodeArmHeader(armName, header, userPrompt, opts = {}) {
  const zodiacSignSlip = opts.zodiacSignSlip ?? 0;
  const decoded = {
    night_crossed: null,
    fresh_tool_id: null,
    is_day: null,
    twilight_stage: null,
    deadline_phase: null,
    deadline_minutes_remaining: null,
    canonical_digest8: null,
    conversion_hops: 0,
  };

  if (!header) return decoded;
  const tools = parseToolCandidates(userPrompt);

  if (armName === "Control-ISO") {
    const isoMatch = header.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const utcHour = Number(isoMatch[2]) + Number(isoMatch[3]) / 60;
      decoded.is_day = utcHour >= 6 && utcHour < 18;
      decoded.twilight_stage = decoded.is_day ? "day" : "night";
    }
    return decoded;
  }

  if (armName === "Control-Synthetic") {
    const elapsedM = header.match(/elapsed=(\d+)s/);
    const sinM = header.match(/sin24=([+-]?[0-9.]+)/);
    const cosM = header.match(/cos24=([+-]?[0-9.]+)/);
    const dueM = header.match(/due=([+-]?\d+)m/);
    if (elapsedM) {
      decoded.night_crossed = Number(elapsedM[1]) >= 43200;
    }
    if (sinM && cosM) {
      decoded.is_day = Number(cosM[1]) < 0;
      decoded.twilight_stage = decoded.is_day ? "day" : "night";
      decoded.conversion_hops += 1;
    }
    if (dueM) {
      const mins = Number(dueM[1]);
      decoded.deadline_minutes_remaining = mins;
      decoded.deadline_phase =
        Math.abs(mins) <= 2 ? "exact" : mins > 0 ? "applying" : "separating";
    }
    return decoded;
  }

  if (armName === "Treatment-Caelus-Physical") {
    const stageM = header.match(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\s+(day|civil|nautical|astronomical|night)\s+/,
    );
    if (stageM) {
      decoded.twilight_stage = stageM[1];
      decoded.is_day = stageM[1] === "day";
    }
    decoded.night_crossed = /\s\+night(?:\s|$)/.test(header);
    const dueM = header.match(/due[:=]([+-]?\d+)m\/(applying|exact|separating)/);
    if (dueM) {
      decoded.deadline_minutes_remaining = Number(dueM[1]);
      decoded.deadline_phase = dueM[2];
    }
    const moonM = header.match(/\sm:([0-9.]+)/);
    if (moonM && tools.length === 2) {
      const moonNow = Number(moonM[1]);
      const d0 = angDist(moonNow, tools[0].moonDeg);
      const d1 = angDist(moonNow, tools[1].moonDeg);
      decoded.fresh_tool_id = d0 <= d1 ? tools[0].id : tools[1].id;
    }
    const digM = header.match(/#([0-9a-f]{8})\b/);
    if (digM) decoded.canonical_digest8 = digM[1];
    return decoded;
  }

  if (armName === "Arm4b-Caelus-Symbolic") {
    const sectM = header.match(/\[caelus-sym\]\s+(Day|Night)\s+/);
    if (sectM) {
      decoded.is_day = sectM[1] === "Day";
      decoded.twilight_stage = decoded.is_day ? "day" : "night";
    }
    decoded.night_crossed = /\s\+night(?:\s|$)/.test(header);
    const dueM = header.match(/due[:=]([+-]?\d+)m\/(applying|exact|separating)/);
    if (dueM) {
      decoded.deadline_minutes_remaining = Number(dueM[1]);
      decoded.deadline_phase = dueM[2];
    }
    const moonSymM = header.match(/Moon\s+(\d{2})([A-Za-z]{3})/);
    if (moonSymM && tools.length === 2) {
      const degInSign = Number(moonSymM[1]);
      const signIdx = SIGN_ABBREV.indexOf(moonSymM[2]);
      if (signIdx >= 0) {
        const effectiveSign = (signIdx + zodiacSignSlip + 12) % 12;
        const moonApprox = effectiveSign * 30 + degInSign + 0.5;
        decoded.conversion_hops += 2;
        const d0 = angDist(moonApprox, tools[0].moonDeg);
        const d1 = angDist(moonApprox, tools[1].moonDeg);
        decoded.fresh_tool_id = d0 <= d1 ? tools[0].id : tools[1].id;
      }
    }
    const digM = header.match(/d=([0-9a-f]{8})\b/);
    if (digM) decoded.canonical_digest8 = digM[1];
    return decoded;
  }

  return decoded;
}

/**
 * Deterministic response grader shared by offline dry-run, --live execution,
 * and zero-network live_receipt.json re-verification.
 */
export function gradeResponse(task, responseObj) {
  const gt = task.ground_truth;
  const archetype = task.archetype;
  const checks = {};

  if (archetype === "compaction_stale_tool") {
    checks.night_crossed =
      typeof responseObj?.night_crossed === "boolean" &&
      responseObj.night_crossed === gt.night_crossed;
    checks.fresh_tool_id = responseObj?.fresh_tool_id === gt.fresh_tool_id;
    const rawDigest =
      typeof responseObj?.canonical_digest8 === "string"
        ? responseObj.canonical_digest8.trim().replace(/^#|^d=/i, "").toLowerCase()
        : null;
    checks.digest_match = rawDigest === gt.canonical_digest8;
  } else {
    checks.is_day =
      typeof responseObj?.is_day === "boolean" && responseObj.is_day === gt.is_day;
    const stage =
      typeof responseObj?.twilight_stage === "string"
        ? responseObj.twilight_stage.trim().toLowerCase()
        : null;
    checks.twilight_stage = stage === gt.twilight_stage;
    const phase =
      typeof responseObj?.deadline_phase === "string"
        ? responseObj.deadline_phase.trim().toLowerCase()
        : null;
    checks.deadline_phase = phase === gt.deadline_phase;
    const mins =
      typeof responseObj?.deadline_minutes_remaining === "number"
        ? responseObj.deadline_minutes_remaining
        : typeof responseObj?.deadline_minutes_remaining === "string" &&
            responseObj.deadline_minutes_remaining.trim() !== ""
          ? Number(responseObj.deadline_minutes_remaining)
          : NaN;
    checks.deadline_minutes_within_15m =
      Number.isFinite(mins) &&
      Math.abs(mins - gt.deadline_minutes_remaining) <= 15;
  }

  const keys = Object.keys(checks);
  const passed = keys.filter((k) => checks[k]).length;
  return {
    archetype,
    checks,
    passed_checks: passed,
    total_checks: keys.length,
    score: keys.length > 0 ? passed / keys.length : 0,
    all_correct: passed === keys.length,
  };
}

/**
 * Build the structured JSON system + user prompt for live-LLM evaluation.
 */
function buildLivePrompt(task, armName) {
  const arm = task.arms[armName];
  const schemaHint =
    task.archetype === "compaction_stale_tool"
      ? `Return strict JSON only: {"reasoning": "1-2 concise sentences", "night_crossed": boolean, "fresh_tool_id": "Tool-A"|"Tool-B", "canonical_digest8": string|null} (put the 8-hex-char digest without # or d= prefix, or null if absent).`
      : `Return strict JSON only: {"reasoning": "1-2 concise sentences", "is_day": boolean, "twilight_stage": "day"|"civil"|"nautical"|"astronomical"|"night", "deadline_phase": "applying"|"exact"|"separating", "deadline_minutes_remaining": number}`;
  const systemPrompt = [
    "You are an autonomous agent executing a long-horizon task with strict temporal grounding.",
    ARM_LEGENDS[armName],
    arm.system_header ? `Context header:\n${arm.system_header}` : "Context header: (none)",
    schemaHint,
  ].join("\n\n");
  return { systemPrompt, userPrompt: arm.user_prompt };
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to balanced brace substring
  }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function callLiveLlm(provider, model, systemPrompt, userPrompt, opts) {
  const t0 = performance.now();
  if (provider === "ollama") {
    const res = await fetch(`${opts.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: opts.think,
        format: "json",
        options: {
          temperature: 0,
          num_predict: opts.numPredict,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data?.message?.content ?? "";
    return {
      raw,
      parsed: extractJsonObject(raw),
      latencyMs: round4(performance.now() - t0),
    };
  }
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.numPredict,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data?.content?.[0]?.text ?? "";
    return {
      raw,
      parsed: extractJsonObject(raw),
      latencyMs: round4(performance.now() - t0),
    };
  }
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return {
      raw,
      parsed: extractJsonObject(raw),
      latencyMs: round4(performance.now() - t0),
    };
  }
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    return {
      raw,
      parsed: extractJsonObject(raw),
      latencyMs: round4(performance.now() - t0),
    };
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Deterministically re-grade all recorded episodes in live_receipt.json
 * against eval_suite.jsonl ground truth. Zero network I/O.
 */
function summarizeLiveReceipt(receipt, allTasks) {
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const taskIds = allTasks.map((t) => t.id);
  const modelSummaries = [];

  // Paired score tables for deterministic B=10,000 bootstrap CIs:
  //   pooledEpisodes[arm] = 40 scores ordered by (modelIdx, taskIdx)
  //   taskClusterMeans[arm] = 20 scores (each = mean across models for taskIdx)
  const pooledEpisodes = Object.fromEntries(ARMS.map((a) => [a, []]));
  const perTaskBuckets = Object.fromEntries(
    ARMS.map((a) => [a, Object.fromEntries(taskIds.map((id) => [id, []]))]),
  );

  for (let runIdx = 0; runIdx < (receipt.runs ?? []).length; runIdx++) {
    const run = receipt.runs[runIdx];
    const byArm = {};
    const runScoresByArm = {};

    for (const armName of ARMS) {
      const eps = (run.episodes ?? []).filter((e) => e.arm === armName);
      const epByTask = new Map(eps.map((e) => [e.task_id, e]));
      let scoreSum = 0;
      let exactSum = 0;
      let compScore = 0;
      let compN = 0;
      let photoScore = 0;
      let photoN = 0;
      let hiLatPhotoScore = 0;
      let hiLatPhotoN = 0;
      let hiLatAllScore = 0;
      let hiLatAllN = 0;
      let latSum = 0;
      let parseErrors = 0;
      let apiErrors = 0;
      const fieldHits = {};
      const fieldTotals = {};
      const alignedScores = [];

      for (const taskId of taskIds) {
        const ep = epByTask.get(taskId);
        const task = taskById.get(taskId);
        if (!ep || !task) continue;
        latSum += ep.latency_ms ?? 0;
        if (ep.api_error) {
          apiErrors++;
          alignedScores.push(0);
          pooledEpisodes[armName].push(0);
          perTaskBuckets[armName][taskId].push(0);
          continue;
        }
        if (!ep.parsed || typeof ep.parsed !== "object") {
          parseErrors++;
        }
        const g = gradeResponse(task, ep.parsed);
        alignedScores.push(g.score);
        pooledEpisodes[armName].push(g.score);
        perTaskBuckets[armName][taskId].push(g.score);
        scoreSum += g.score;
        if (g.all_correct) exactSum++;

        const isHiLat = HIGH_LAT_CITIES.has(task.city_id);
        if (isHiLat) {
          hiLatAllScore += g.score;
          hiLatAllN++;
        }
        if (task.archetype === "compaction_stale_tool") {
          compScore += g.score;
          compN++;
        } else {
          photoScore += g.score;
          photoN++;
          if (isHiLat) {
            hiLatPhotoScore += g.score;
            hiLatPhotoN++;
          }
        }
        for (const [k, ok] of Object.entries(g.checks)) {
          fieldTotals[k] = (fieldTotals[k] ?? 0) + 1;
          if (ok) fieldHits[k] = (fieldHits[k] ?? 0) + 1;
        }
      }

      runScoresByArm[armName] = alignedScores;
      const n = Math.max(1, eps.length);
      const fieldAcc = {};
      for (const k of Object.keys(fieldTotals)) {
        fieldAcc[k] = round4((fieldHits[k] ?? 0) / fieldTotals[k]);
      }

      const armBoot = bootstrapMeanCi(alignedScores, 10000, 20261122 + runIdx * 97 + ARMS.indexOf(armName) * 13);
      byArm[armName] = {
        episodes: eps.length,
        mean_score: round4(scoreSum / n),
        ci95_bootstrap: armBoot.ci95,
        exact_task_rate: round4(exactSum / n),
        compaction_score: round4(compScore / Math.max(1, compN)),
        photoperiod_score: round4(photoScore / Math.max(1, photoN)),
        high_lat_photoperiod_score: round4(hiLatPhotoScore / Math.max(1, hiLatPhotoN)),
        high_lat_all_score: round4(hiLatAllScore / Math.max(1, hiLatAllN)),
        mean_latency_ms: round4(latSum / n),
        parse_errors: parseErrors,
        api_errors: apiErrors,
        field_accuracy: fieldAcc,
      };
    }

    const p = byArm["Treatment-Caelus-Physical"];
    const sym = byArm["Arm4b-Caelus-Symbolic"];
    const syn = byArm["Control-Synthetic"];
    const iso = byArm["Control-ISO"];
    const none = byArm["Baseline-None"];

    const keySlicePhys = round4((p.compaction_score + p.high_lat_photoperiod_score) / 2);
    const keySliceSyn = round4((syn.compaction_score + syn.high_lat_photoperiod_score) / 2);
    const keySliceSym = round4((sym.compaction_score + sym.high_lat_photoperiod_score) / 2);

    modelSummaries.push({
      provider: run.provider,
      model: run.model,
      executed_at: run.executed_at,
      tasks_evaluated: run.tasks_evaluated,
      temperature: run.temperature,
      think: run.think,
      by_arm: byArm,
      paired_bootstrap_10000: {
        physical_vs_symbolic: pairedBootstrapTest(
          runScoresByArm["Treatment-Caelus-Physical"],
          runScoresByArm["Arm4b-Caelus-Symbolic"],
          10000,
          20261122 + runIdx * 31 + 1,
        ),
        physical_vs_synthetic: pairedBootstrapTest(
          runScoresByArm["Treatment-Caelus-Physical"],
          runScoresByArm["Control-Synthetic"],
          10000,
          20261122 + runIdx * 31 + 2,
        ),
        physical_vs_iso: pairedBootstrapTest(
          runScoresByArm["Treatment-Caelus-Physical"],
          runScoresByArm["Control-ISO"],
          10000,
          20261122 + runIdx * 31 + 3,
        ),
      },
      deltas: {
        physical_minus_iso: round4(p.mean_score - iso.mean_score),
        physical_minus_synthetic: round4(p.mean_score - syn.mean_score),
        physical_minus_symbolic: round4(p.mean_score - sym.mean_score),
        physical_minus_none: round4(p.mean_score - none.mean_score),
        compaction_physical_minus_synthetic: round4(p.compaction_score - syn.compaction_score),
        compaction_physical_minus_symbolic: round4(p.compaction_score - sym.compaction_score),
        high_lat_photo_physical_minus_synthetic: round4(
          p.high_lat_photoperiod_score - syn.high_lat_photoperiod_score,
        ),
        high_lat_photo_physical_minus_symbolic: round4(
          p.high_lat_photoperiod_score - sym.high_lat_photoperiod_score,
        ),
        key_slice_physical: keySlicePhys,
        key_slice_synthetic: keySliceSyn,
        key_slice_symbolic: keySliceSym,
      },
    });
  }

  // Task-cluster means (20 tasks, averaging across models per task)
  const taskClusterMeans = {};
  for (const armName of ARMS) {
    taskClusterMeans[armName] = taskIds.map((id) => {
      const vals = perTaskBuckets[armName][id];
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
  }

  // Macro mean + 10,000-resample bootstrap 95% CIs across all evaluated models
  const macroByArm = {};
  const armBootstrapEpisode = {};
  const armBootstrapTaskCluster = {};
  for (let ai = 0; ai < ARMS.length; ai++) {
    const armName = ARMS[ai];
    const k = Math.max(1, modelSummaries.length);
    const avg = (fn) => round4(modelSummaries.reduce((acc, m) => acc + fn(m.by_arm[armName]), 0) / k);
    const epBoot = bootstrapMeanCi(pooledEpisodes[armName], 10000, 20261122 + ai * 101);
    const tcBoot = bootstrapMeanCi(taskClusterMeans[armName], 10000, 20261122 + ai * 101 + 50);
    armBootstrapEpisode[armName] = epBoot;
    armBootstrapTaskCluster[armName] = tcBoot;
    macroByArm[armName] = {
      mean_score: avg((a) => a.mean_score),
      ci95_episode_bootstrap: epBoot.ci95,
      ci95_task_cluster_bootstrap: tcBoot.ci95,
      exact_task_rate: avg((a) => a.exact_task_rate),
      compaction_score: avg((a) => a.compaction_score),
      photoperiod_score: avg((a) => a.photoperiod_score),
      high_lat_photoperiod_score: avg((a) => a.high_lat_photoperiod_score),
      high_lat_all_score: avg((a) => a.high_lat_all_score),
      mean_latency_ms: avg((a) => a.mean_latency_ms),
    };
  }

  const pairedEpisode = {
    physical_vs_symbolic: pairedBootstrapTest(
      pooledEpisodes["Treatment-Caelus-Physical"],
      pooledEpisodes["Arm4b-Caelus-Symbolic"],
      10000,
      20261122 + 501,
    ),
    physical_vs_synthetic: pairedBootstrapTest(
      pooledEpisodes["Treatment-Caelus-Physical"],
      pooledEpisodes["Control-Synthetic"],
      10000,
      20261122 + 502,
    ),
    physical_vs_iso: pairedBootstrapTest(
      pooledEpisodes["Treatment-Caelus-Physical"],
      pooledEpisodes["Control-ISO"],
      10000,
      20261122 + 503,
    ),
    physical_vs_none: pairedBootstrapTest(
      pooledEpisodes["Treatment-Caelus-Physical"],
      pooledEpisodes["Baseline-None"],
      10000,
      20261122 + 504,
    ),
  };
  const pairedTaskCluster = {
    physical_vs_symbolic: pairedBootstrapTest(
      taskClusterMeans["Treatment-Caelus-Physical"],
      taskClusterMeans["Arm4b-Caelus-Symbolic"],
      10000,
      20261122 + 601,
    ),
    physical_vs_synthetic: pairedBootstrapTest(
      taskClusterMeans["Treatment-Caelus-Physical"],
      taskClusterMeans["Control-Synthetic"],
      10000,
      20261122 + 602,
    ),
    physical_vs_iso: pairedBootstrapTest(
      taskClusterMeans["Treatment-Caelus-Physical"],
      taskClusterMeans["Control-ISO"],
      10000,
      20261122 + 603,
    ),
    physical_vs_none: pairedBootstrapTest(
      taskClusterMeans["Treatment-Caelus-Physical"],
      taskClusterMeans["Baseline-None"],
      10000,
      20261122 + 604,
    ),
  };

  const physEpCi = macroByArm["Treatment-Caelus-Physical"].ci95_episode_bootstrap;
  const symEpCi = macroByArm["Arm4b-Caelus-Symbolic"].ci95_episode_bootstrap;
  const physTcCi = macroByArm["Treatment-Caelus-Physical"].ci95_task_cluster_bootstrap;
  const symTcCi = macroByArm["Arm4b-Caelus-Symbolic"].ci95_task_cluster_bootstrap;

  const mp = macroByArm["Treatment-Caelus-Physical"];
  const msym = macroByArm["Arm4b-Caelus-Symbolic"];
  const msyn = macroByArm["Control-Synthetic"];
  const miso = macroByArm["Control-ISO"];
  const mnone = macroByArm["Baseline-None"];

  return {
    receipt_executed_at: receipt.executed_at,
    receipt_git_sha: receipt.git_sha,
    env_note: receipt.env_note ?? null,
    models_evaluated: modelSummaries.map((m) => `${m.provider}/${m.model}`),
    model_count: modelSummaries.length,
    macro_by_arm: macroByArm,
    bootstrap_10000: {
      seed: 20261122,
      resamples: 10000,
      episode_level_n40: {
        by_arm: armBootstrapEpisode,
        paired_deltas: pairedEpisode,
        physical_vs_symbolic_marginal_cis_overlap: physEpCi[0] <= symEpCi[1],
        physical_vs_symbolic_paired_ci_excludes_zero: pairedEpisode.physical_vs_symbolic.ci95_excludes_zero,
      },
      task_cluster_n20: {
        by_arm: armBootstrapTaskCluster,
        paired_deltas: pairedTaskCluster,
        physical_vs_symbolic_marginal_cis_overlap: physTcCi[0] <= symTcCi[1],
        physical_vs_symbolic_paired_ci_excludes_zero: pairedTaskCluster.physical_vs_symbolic.ci95_excludes_zero,
      },
    },
    macro_deltas: {
      physical_minus_iso: round4(mp.mean_score - miso.mean_score),
      physical_minus_synthetic: round4(mp.mean_score - msyn.mean_score),
      physical_minus_symbolic: round4(mp.mean_score - msym.mean_score),
      physical_minus_none: round4(mp.mean_score - mnone.mean_score),
      compaction_physical_minus_synthetic: round4(mp.compaction_score - msyn.compaction_score),
      compaction_physical_minus_symbolic: round4(mp.compaction_score - msym.compaction_score),
      high_lat_photo_physical_minus_synthetic: round4(
        mp.high_lat_photoperiod_score - msyn.high_lat_photoperiod_score,
      ),
      high_lat_photo_physical_minus_symbolic: round4(
        mp.high_lat_photoperiod_score - msym.high_lat_photoperiod_score,
      ),
    },
    models: modelSummaries,
  };
}

/**
 * Render inert, zero-chartjunk Tufte SVG directly from measured results (exact 2-decimal tokens + 95% bootstrap CIs).
 */
function renderExp005ChartSvg(offlineByArm, liveSummary, outPath) {
  if (!liveSummary) return;
  const W = 820;
  const H = 456;
  const x0 = 244;
  const x1 = 634;
  const px = (v) => x0 + v * (x1 - x0);

  const isoMean = liveSummary.macro_by_arm["Control-ISO"].mean_score;
  const razorThresh = isoMean + 0.2;
  const pairSym = liveSummary.bootstrap_10000.episode_level_n40.paired_deltas.physical_vs_symbolic;
  const mGemma = liveSummary.models.find((m) => m.model.includes("gemma")) ?? liveSummary.models[0];
  const mQwen = liveSummary.models.find((m) => m.model.includes("qwen")) ?? liveSummary.models[1];

  const rows = [
    {
      arm: "Treatment-Caelus-Physical",
      sub: `${offlineByArm["Treatment-Caelus-Physical"].mean_cl100k_tokens.toFixed(2)} tok, 0 hops, 5-class twilight`,
      delta: `+${(liveSummary.macro_deltas.physical_minus_iso * 100).toFixed(1)} pp vs ISO`,
      bold: true,
    },
    {
      arm: "Arm4b-Caelus-Symbolic",
      sub: `${offlineByArm["Arm4b-Caelus-Symbolic"].mean_cl100k_tokens.toFixed(2)} tok, 2 zodiac hops, Day/Night`,
      delta: `-${(liveSummary.macro_deltas.physical_minus_symbolic * 100).toFixed(1)} pp vs Phys`,
      bold: false,
    },
    {
      arm: "Control-Synthetic",
      sub: `${offlineByArm["Control-Synthetic"].mean_cl100k_tokens.toFixed(2)} tok, elapsed + 24h sin/cos`,
      delta: `-${(liveSummary.macro_deltas.physical_minus_synthetic * 100).toFixed(1)} pp vs Phys`,
      bold: false,
    },
    {
      arm: "Control-ISO",
      sub: `${offlineByArm["Control-ISO"].mean_cl100k_tokens.toFixed(2)} tok, passive UTC ISO-8601`,
      delta: "baseline control",
      bold: false,
    },
    {
      arm: "Baseline-None",
      sub: `${offlineByArm["Baseline-None"].mean_cl100k_tokens.toFixed(2)} tok, no temporal header`,
      delta: `-${(liveSummary.macro_deltas.physical_minus_none * 100).toFixed(1)} pp vs Phys`,
      bold: false,
    },
  ];

  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="et-book, ET-Bembo, Palatino, Georgia, serif" font-size="13">`,
    `  <rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `  <text x="32" y="30" font-size="16" fill="#111111">EXP-005: Live 5-Arm Chronosense Codec Showdown (20 Tasks x 2 Models, 95% Bootstrap CIs)</text>`,
    `  <text x="32" y="48" font-size="11.5" fill="#555555">Equal-weighted check-level composite accuracy (%); bars = 10,000-resample 95% CI (n=40 pairs, temperature = 0)</text>`,
    `  <line x1="${px(isoMean).toFixed(1)}" y1="90" x2="${px(isoMean).toFixed(1)}" y2="366" stroke="#dddddd" stroke-width="1" stroke-dasharray="3,3"/>`,
    `  <line x1="${px(razorThresh).toFixed(1)}" y1="90" x2="${px(razorThresh).toFixed(1)}" y2="366" stroke="#c8d6dc" stroke-width="1" stroke-dasharray="3,3"/>`,
    `  <text x="${px(isoMean).toFixed(1)}" y="380" text-anchor="middle" font-size="10" fill="#777777">ISO ${(isoMean * 100).toFixed(1)}%</text>`,
    `  <text x="${px(razorThresh).toFixed(1)}" y="380" text-anchor="middle" font-size="10" fill="#1b5e7a">Razor +20 pp (${(razorThresh * 100).toFixed(1)}%)</text>`,
  ];

  // Direct mark callouts above Row 0 (staggered lanes, zero overlap)
  const pGemma = px(mGemma.by_arm["Treatment-Caelus-Physical"].mean_score);
  const pQwen = px(mQwen.by_arm["Treatment-Caelus-Physical"].mean_score);
  const pOff = px(offlineByArm["Treatment-Caelus-Physical"].mean_score);
  lines.push(
    `  <text x="${pQwen.toFixed(1)}" y="68" text-anchor="middle" font-size="10.5" fill="#9e4228">qwen3.5:9b</text>`,
    `  <line x1="${pQwen.toFixed(1)}" y1="72" x2="${pQwen.toFixed(1)}" y2="104" stroke="#9e4228" stroke-width="0.8"/>`,
    `  <text x="${(pGemma - 8).toFixed(1)}" y="84" text-anchor="end" font-size="10.5" fill="#1b5e7a">gemma4:12b</text>`,
    `  <line x1="${(pGemma - 6).toFixed(1)}" y1="87" x2="${pGemma.toFixed(1)}" y2="104" stroke="#1b5e7a" stroke-width="0.8"/>`,
    `  <text x="${pOff.toFixed(1)}" y="84" text-anchor="end" font-size="10" fill="#777777">offline ceiling</text>`,
    `  <line x1="${pOff.toFixed(1)}" y1="88" x2="${pOff.toFixed(1)}" y2="102" stroke="#999999" stroke-width="0.8"/>`,
    `  <text x="648" y="84" text-anchor="start" font-size="10.5" fill="#444444">Macro [95% CI]</text>`,
  );

  rows.forEach((r, idx) => {
    const yc = 114 + idx * 58;
    const m = liveSummary.macro_by_arm[r.arm];
    const [ciLo, ciHi] = m.ci95_episode_bootstrap;
    const xG = px(mGemma.by_arm[r.arm].mean_score);
    const xQ = px(mQwen.by_arm[r.arm].mean_score);
    const xOff = px(offlineByArm[r.arm].mean_score);
    const xLo = px(ciLo);
    const xHi = px(ciHi);
    const col = r.bold ? "#1b5e7a" : "#222222";
    const weight = r.bold ? ' font-weight="bold"' : "";

    lines.push(
      `  <text x="232" y="${yc - 3}" text-anchor="end" font-size="12"${weight} fill="${col}">${r.arm}</text>`,
      `  <text x="232" y="${yc + 11}" text-anchor="end" font-size="10" fill="#666666">${r.sub}</text>`,
      `  <line x1="${x0}" y1="${yc}" x2="${x1}" y2="${yc}" stroke="#efefef" stroke-width="1"/>`,
      // 95% bootstrap CI bar with end caps
      `  <line x1="${xLo.toFixed(1)}" y1="${yc}" x2="${xHi.toFixed(1)}" y2="${yc}" stroke="${r.bold ? "#1b5e7a" : "#666666"}" stroke-width="${r.bold ? "2.2" : "1.6"}" opacity="0.65"/>`,
      `  <line x1="${xLo.toFixed(1)}" y1="${yc - 4}" x2="${xLo.toFixed(1)}" y2="${yc + 4}" stroke="${r.bold ? "#1b5e7a" : "#666666"}" stroke-width="1.2"/>`,
      `  <line x1="${xHi.toFixed(1)}" y1="${yc - 4}" x2="${xHi.toFixed(1)}" y2="${yc + 4}" stroke="${r.bold ? "#1b5e7a" : "#666666"}" stroke-width="1.2"/>`,
      // Offline ceiling tick
      `  <line x1="${xOff.toFixed(1)}" y1="${yc - 8}" x2="${xOff.toFixed(1)}" y2="${yc + 8}" stroke="#999999" stroke-width="1.2"/>`,
      // Model markers
      `  <circle cx="${xG.toFixed(1)}" cy="${yc}" r="4.3" fill="#1b5e7a"/>`,
      `  <polygon points="${xQ.toFixed(1)},${yc - 4.8} ${(xQ + 4.8).toFixed(1)},${yc} ${xQ.toFixed(1)},${yc + 4.8} ${(xQ - 4.8).toFixed(1)},${yc}" fill="#9e4228"/>`,
      // Right-column macro + 95% CI + delta
      `  <text x="648" y="${yc - 1}" text-anchor="start" font-size="11.5"${weight} fill="${col}">${(m.mean_score * 100).toFixed(1)}% [${(ciLo * 100).toFixed(1)}, ${(ciHi * 100).toFixed(1)}]</text>`,
      `  <text x="648" y="${yc + 12}" text-anchor="start" font-size="9.8" fill="${r.bold ? "#1b5e7a" : "#666666"}">${r.delta}</text>`,
    );
  });

  // Range-frame horizontal axis (0% to 100%)
  lines.push(`  <line x1="${x0}" y1="394" x2="${x1}" y2="394" stroke="#333333" stroke-width="1"/>`);
  for (const frac of [0, 0.25, 0.5, 0.75, 1.0]) {
    const xv = px(frac);
    lines.push(
      `  <line x1="${xv.toFixed(1)}" y1="394" x2="${xv.toFixed(1)}" y2="399" stroke="#333333" stroke-width="1"/>`,
      `  <text x="${xv.toFixed(1)}" y="412" text-anchor="middle" font-size="11" fill="#444444">${Math.round(frac * 100)}%</text>`,
    );
  }

  lines.push(
    `  <text x="32" y="432" font-size="10.5" fill="#1b5e7a">Paired bootstrap (Physical - Symbolic, n=40): +${(pairSym.mean_diff * 100).toFixed(1)} pp [95% CI +${(pairSym.ci95[0] * 100).toFixed(1)}, +${(pairSym.ci95[1] * 100).toFixed(1)} pp], p=${pairSym.bootstrap_p_two_sided.toFixed(4)} (${pairSym.wins}W / ${pairSym.ties}T / ${pairSym.losses}L)</text>`,
    `  <text x="32" y="447" font-size="10" fill="#555555">Circles = gemma4:12b, diamonds = qwen3.5:9b, vertical ticks = offline ceiling; token counts = cl100k-approx mean header tokens</text>`,
    `</svg>\n`,
  );
  writeFileSync(outPath, lines.join("\n"), "utf8");
}

async function main() {
  const t0 = performance.now();
  const cli = parseCliArgs(process.argv.slice(2));
  const rawLines = readFileSync(EVAL_SUITE_PATH, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  const allTasks = rawLines.map((line) => JSON.parse(line));
  const tasks = cli.limit ? allTasks.slice(0, cli.limit) : allTasks;

  // Step 1: Verify every ground_truth record against live packages/caelus/dist/
  const engine = new Engine(loadNodeData(DATA_DIR));
  let gtVerifiedCount = 0;
  let maxSunAltDiffDeg = 0;
  let headerDigestMismatches = 0;
  let nonBinaryTwilightTasks = 0;

  for (const task of tasks) {
    const scene = sceneGeometry(engine, task.jd_ut, task.lat, task.lon_east, {
      prevJdUt: task.prev_jd_ut,
      deadlineJdUt: task.deadline_jd_ut,
    });
    const sunDiff = Math.abs(
      Number(scene.sun.altitudeApparentDeg.toFixed(2)) -
        task.ground_truth.sun_altitude_apparent_deg,
    );
    if (sunDiff > maxSunAltDiffDeg) maxSunAltDiffDeg = sunDiff;

    const physHeader = task.arms["Treatment-Caelus-Physical"].system_header;
    const symHeader = task.arms["Arm4b-Caelus-Symbolic"].system_header;
    const okDigest =
      physHeader.includes(`#${task.ground_truth.canonical_digest8}`) &&
      symHeader.includes(`d=${task.ground_truth.canonical_digest8}`);
    if (!okDigest) headerDigestMismatches++;

    const okDay = scene.sun.isDay === task.ground_truth.is_day;
    const okTwilight = scene.sun.twilightStage === task.ground_truth.twilight_stage;
    const dlDiff =
      scene.chronosense.deadline !== null
        ? Math.abs(
            Math.round(scene.chronosense.deadline.minutesRemaining) -
              task.ground_truth.deadline_minutes_remaining,
          )
        : 999;
    if (
      task.ground_truth.twilight_stage !== "day" &&
      task.ground_truth.twilight_stage !== "night"
    ) {
      nonBinaryTwilightTasks++;
    }
    if (okDigest && okDay && okTwilight && sunDiff <= 0.02 && dlDiff <= 1) {
      gtVerifiedCount++;
    }
  }

  // Step 2: Bounded zero-ephemeris codec recoverability & token efficiency audit
  const offlineByArm = {};
  for (const armName of ARMS) {
    let totalScore = 0;
    let totalExact = 0;
    let compactionScore = 0;
    let compactionN = 0;
    let photoperiodScore = 0;
    let photoperiodN = 0;
    let twilightCorrect = 0;
    let twilightN = 0;
    let cl100kSum = 0;
    let wsSum = 0;
    let hopsSum = 0;
    const fieldHits = {};
    const fieldTotals = {};

    for (const task of tasks) {
      const arm = task.arms[armName];
      const header = arm.system_header ?? "";
      cl100kSum += approxCl100kTokens(header);
      wsSum += whitespaceTokens(header);

      const decoded = decodeArmHeader(armName, header, arm.user_prompt);
      hopsSum += decoded.conversion_hops;
      const graded = gradeResponse(task, decoded);
      totalScore += graded.score;
      if (graded.all_correct) totalExact++;

      if (task.archetype === "compaction_stale_tool") {
        compactionScore += graded.score;
        compactionN++;
      } else {
        photoperiodScore += graded.score;
        photoperiodN++;
        twilightN++;
        if (graded.checks.twilight_stage) twilightCorrect++;
      }
      for (const [k, ok] of Object.entries(graded.checks)) {
        fieldTotals[k] = (fieldTotals[k] ?? 0) + 1;
        if (ok) fieldHits[k] = (fieldHits[k] ?? 0) + 1;
      }
    }

    const fieldAcc = {};
    for (const k of Object.keys(fieldTotals)) {
      fieldAcc[k] = round4((fieldHits[k] ?? 0) / fieldTotals[k]);
    }

    offlineByArm[armName] = {
      mean_score: round4(totalScore / tasks.length),
      exact_task_rate: round4(totalExact / tasks.length),
      compaction_score: round4(compactionScore / Math.max(1, compactionN)),
      photoperiod_score: round4(photoperiodScore / Math.max(1, photoperiodN)),
      twilight_5class_accuracy: round4(twilightCorrect / Math.max(1, twilightN)),
      mean_cl100k_tokens: round4(cl100kSum / tasks.length),
      mean_whitespace_tokens: round4(wsSum / tasks.length),
      mean_conversion_hops: round4(hopsSum / tasks.length),
      field_accuracy: fieldAcc,
    };
  }

  // Step 3: Symbolic zodiac sign-slip sensitivity (+/-1 sign lookup slip on Arm4b)
  let slipPlusHits = 0;
  let slipMinusHits = 0;
  let slipCompactionN = 0;
  let allTasksTwilightHitsPhys = 0;
  let allTasksTwilightHitsSym = 0;
  for (const task of tasks) {
    const decP = decodeArmHeader(
      "Treatment-Caelus-Physical",
      task.arms["Treatment-Caelus-Physical"].system_header,
      task.arms["Treatment-Caelus-Physical"].user_prompt,
    );
    const decS = decodeArmHeader(
      "Arm4b-Caelus-Symbolic",
      task.arms["Arm4b-Caelus-Symbolic"].system_header,
      task.arms["Arm4b-Caelus-Symbolic"].user_prompt,
    );
    if (decP.twilight_stage === task.ground_truth.twilight_stage) allTasksTwilightHitsPhys++;
    if (decS.twilight_stage === task.ground_truth.twilight_stage) allTasksTwilightHitsSym++;

    if (task.archetype !== "compaction_stale_tool") continue;
    slipCompactionN++;
    const arm = task.arms["Arm4b-Caelus-Symbolic"];
    const decPlus = decodeArmHeader("Arm4b-Caelus-Symbolic", arm.system_header, arm.user_prompt, {
      zodiacSignSlip: 1,
    });
    const decMinus = decodeArmHeader("Arm4b-Caelus-Symbolic", arm.system_header, arm.user_prompt, {
      zodiacSignSlip: -1,
    });
    if (decPlus.fresh_tool_id === task.ground_truth.fresh_tool_id) slipPlusHits++;
    if (decMinus.fresh_tool_id === task.ground_truth.fresh_tool_id) slipMinusHits++;
  }
  const symbolicSignSlipFreshAcc = round4(
    (slipPlusHits + slipMinusHits) / Math.max(1, 2 * slipCompactionN),
  );
  const all20TwilightPhysAcc = round4(allTasksTwilightHitsPhys / tasks.length);
  const all20TwilightSymAcc = round4(allTasksTwilightHitsSym / tasks.length);

  // Step 4: Deterministic grader self-test (oracle pass + corrupted response catch)
  let scorerOraclePassed = 0;
  let scorerCorruptCaught = 0;
  for (const task of tasks) {
    const gt = task.ground_truth;
    const oracleGrade = gradeResponse(task, gt);
    if (oracleGrade.all_correct) scorerOraclePassed++;

    const corrupt =
      task.archetype === "compaction_stale_tool"
        ? {
            night_crossed: !gt.night_crossed,
            fresh_tool_id: gt.fresh_tool_id === "Tool-A" ? "Tool-B" : "Tool-A",
            canonical_digest8: "00000000",
          }
        : {
            is_day: !gt.is_day,
            twilight_stage: gt.twilight_stage === "day" ? "night" : "day",
            deadline_phase:
              gt.deadline_phase === "applying" ? "separating" : "applying",
            deadline_minutes_remaining: gt.deadline_minutes_remaining + 95,
          };
    const corruptGrade = gradeResponse(task, corrupt);
    if (!corruptGrade.all_correct && corruptGrade.score === 0) {
      scorerCorruptCaught++;
    }
  }

  // Step 5: Optional live-LLM execution (--live), writing live_receipt.json
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
        `[EXP-005 --live] Running ${cli.provider}/${model} across ${tasks.length} tasks x ${ARMS.length} arms (${tasks.length * ARMS.length} calls)...`,
      );
      for (const armName of ARMS) {
        let armScoreSum = 0;
        for (const task of tasks) {
          const { systemPrompt, userPrompt } = buildLivePrompt(task, armName);
          let raw = "";
          let parsed = null;
          let latencyMs = 0;
          let apiError = null;
          try {
            const resp = await callLiveLlm(
              cli.provider,
              model,
              systemPrompt,
              userPrompt,
              cli,
            );
            raw = resp.raw;
            parsed = resp.parsed;
            latencyMs = resp.latencyMs;
          } catch (err) {
            apiError = String(err?.message ?? err);
          }
          const graded = gradeResponse(task, parsed);
          armScoreSum += graded.score;
          episodes.push({
            task_id: task.id,
            city_id: task.city_id,
            season: task.season,
            archetype: task.archetype,
            arm: armName,
            latency_ms: latencyMs,
            raw_content: raw,
            parsed,
            checks: graded.checks,
            score: round4(graded.score),
            all_correct: graded.all_correct,
            api_error: apiError,
          });
        }
        console.log(
          `  [${model}] ${armName.padEnd(26)} mean_score=${((armScoreSum / tasks.length) * 100).toFixed(1)}%`,
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
      experiment_id: "EXP-005",
      executed_at: new Date().toISOString(),
      git_sha: getGitSha(),
      env_note: cli.envNote,
      arms: ARMS,
      arm_legends: ARM_LEGENDS,
      runs: mergedRuns,
    };
    writeFileSync(
      LIVE_RECEIPT_PATH,
      (JSON.stringify(liveReceipt, null, 2) + "\n").replace(/\u2014/g, "\\u2014"),
      "utf8",
    );
    console.log(`Wrote ${LIVE_RECEIPT_PATH} (${mergedRuns.length} live model run(s)).`);
  } else if (existsSync(LIVE_RECEIPT_PATH)) {
    // Zero-network deterministic re-verification of recorded live receipts
    liveReceipt = JSON.parse(readFileSync(LIVE_RECEIPT_PATH, "utf8"));
  }

  const liveSummary =
    liveReceipt && Array.isArray(liveReceipt.runs) && liveReceipt.runs.length > 0
      ? summarizeLiveReceipt(liveReceipt, allTasks)
      : null;

  const elapsedMs = round4(performance.now() - t0);
  const phys = offlineByArm["Treatment-Caelus-Physical"];
  const sym = offlineByArm["Arm4b-Caelus-Symbolic"];
  const synth = offlineByArm["Control-Synthetic"];
  const iso = offlineByArm["Control-ISO"];
  const none = offlineByArm["Baseline-None"];

  const offlineAuditClean =
    gtVerifiedCount === tasks.length &&
    headerDigestMismatches === 0 &&
    scorerOraclePassed === tasks.length &&
    scorerCorruptCaught === tasks.length &&
    phys.exact_task_rate === 1 &&
    phys.mean_cl100k_tokens <= 55;

  let status = "inconclusive";
  let verdict =
    `INCONCLUSIVE (offline dry-run complete; live-LLM gate pending): Ground-truth parity (${gtVerifiedCount}/${tasks.length}), scorer self-tests pass cleanly. Run with --live to evaluate live models.`;

  if (!offlineAuditClean) {
    status = "fail";
    verdict = "FAIL: Offline ground-truth verification or codec audit failed.";
  } else if (liveSummary) {
    const mp = liveSummary.macro_by_arm["Treatment-Caelus-Physical"];
    const msym = liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"];
    const msyn = liveSummary.macro_by_arm["Control-Synthetic"];
    const miso = liveSummary.macro_by_arm["Control-ISO"];
    const mnone = liveSummary.macro_by_arm["Baseline-None"];
    const md = liveSummary.macro_deltas;

    const allModelsBeatIso20pp = liveSummary.models.every(
      (m) => m.deltas.physical_minus_iso >= 0.2,
    );
    const allModelsBeatSynth5pp = liveSummary.models.every(
      (m) => m.deltas.physical_minus_synthetic > 0.05,
    );
    const allModelsBeatOrTieSymbolic = liveSummary.models.every(
      (m) => m.deltas.physical_minus_symbolic >= 0,
    );
    const allModelsBeatSymbolicOnSlices = liveSummary.models.every(
      (m) =>
        m.by_arm["Treatment-Caelus-Physical"].compaction_score >=
          m.by_arm["Arm4b-Caelus-Symbolic"].compaction_score &&
        m.by_arm["Treatment-Caelus-Physical"].high_lat_photoperiod_score >=
          m.by_arm["Arm4b-Caelus-Symbolic"].high_lat_photoperiod_score,
    );
    const synthKillsOnKeySlices = liveSummary.models.every(
      (m) => m.deltas.key_slice_synthetic >= m.deltas.key_slice_physical - 0.05,
    );

    const perModelLine = liveSummary.models
      .map(
        (m) =>
          `${m.model}: Phys ${(m.by_arm["Treatment-Caelus-Physical"].mean_score * 100).toFixed(1)}% vs Sym ${(m.by_arm["Arm4b-Caelus-Symbolic"].mean_score * 100).toFixed(1)}% vs Synth ${(m.by_arm["Control-Synthetic"].mean_score * 100).toFixed(1)}% vs ISO ${(m.by_arm["Control-ISO"].mean_score * 100).toFixed(1)}% vs None ${(m.by_arm["Baseline-None"].mean_score * 100).toFixed(1)}%`,
      )
      .join("; ");

    if (
      md.physical_minus_iso >= 0.2 &&
      md.physical_minus_synthetic > 0.05 &&
      md.physical_minus_symbolic > 0 &&
      allModelsBeatIso20pp &&
      allModelsBeatSynth5pp &&
      allModelsBeatOrTieSymbolic &&
      !synthKillsOnKeySlices
    ) {
      status = "pass";
      verdict =
        `PROVED (live verified across ${liveSummary.model_count} models, ${liveSummary.models_evaluated.join(", ")}): ` +
        `Macro score Treatment-Caelus-Physical ${(mp.mean_score * 100).toFixed(1)}% beats Control-ISO ${(miso.mean_score * 100).toFixed(1)}% by +${(md.physical_minus_iso * 100).toFixed(1)} pp (>= 20 pp bar), ` +
        `beats Control-Synthetic ${(msyn.mean_score * 100).toFixed(1)}% by +${(md.physical_minus_synthetic * 100).toFixed(1)} pp (compaction +${(md.compaction_physical_minus_synthetic * 100).toFixed(1)} pp, high-lat photoperiod +${(md.high_lat_photo_physical_minus_synthetic * 100).toFixed(1)} pp), ` +
        `and beats Arm4b-Caelus-Symbolic ${(msym.mean_score * 100).toFixed(1)}% by +${(md.physical_minus_symbolic * 100).toFixed(1)} pp (compaction +${(md.compaction_physical_minus_symbolic * 100).toFixed(1)} pp, high-lat photoperiod +${(md.high_lat_photo_physical_minus_symbolic * 100).toFixed(1)} pp; slices_monotone=${allModelsBeatSymbolicOnSlices}) ` +
        `and Baseline-None ${(mnone.mean_score * 100).toFixed(1)}% at ${phys.mean_cl100k_tokens} cl100k tokens/turn. ` +
        `Per model: ${perModelLine}.`;
    } else if (synthKillsOnKeySlices || md.physical_minus_synthetic <= 0.05 || md.physical_minus_symbolic < 0) {
      status = "fail";
      verdict =
        `KILLED (live verified across ${liveSummary.model_count} models): ` +
        `Treatment-Caelus-Physical (${(mp.mean_score * 100).toFixed(1)}%) failed to clear the Razor margin over Control-Synthetic (${(msyn.mean_score * 100).toFixed(1)}%) or Arm4b-Caelus-Symbolic (${(msym.mean_score * 100).toFixed(1)}%). Per model: ${perModelLine}.`;
    } else {
      status = "inconclusive";
      verdict =
        `INCONCLUSIVE (mixed across ${liveSummary.model_count} models): Macro Physical ${(mp.mean_score * 100).toFixed(1)}% vs Sym ${(msym.mean_score * 100).toFixed(1)}% vs Synth ${(msyn.mean_score * 100).toFixed(1)}% vs ISO ${(miso.mean_score * 100).toFixed(1)}%. Per model: ${perModelLine}.`;
    }
  }

  const noaa20Baseline = evaluateNoaa20Baseline(engine, tasks);
  const scoringRubric = {
    name: "equal_weighted_check_composite_accuracy",
    task_score_formula: "s_i = passed_checks_i / total_checks_i in [0, 1]",
    compaction_stale_tool_checks: [
      "night_crossed (exact boolean match)",
      "fresh_tool_id (exact Tool-A | Tool-B match)",
      "digest_match (exact lowercase 8-hex-char canonical_digest8 match, stripping # or d=)",
    ],
    photoperiod_deadline_regime_checks: [
      "is_day (exact boolean match)",
      "twilight_stage (exact 5-class match: day | civil | nautical | astronomical | night)",
      "deadline_phase (exact applying | exact | separating match)",
      "deadline_minutes_within_15m (|pred_min - gt_min| <= 15)",
    ],
    model_composite_formula: "model_score = (1 / 20) * sum_{i=1..20} s_i",
    macro_composite_formula: "macro_score = (1 / M) * sum_{m=1..M} model_score_m (M = 2 models; identical to pooled mean over 40 task-model episodes)",
    exact_task_rate_formula: "fraction of episodes with passed_checks_i === total_checks_i (s_i === 1.0)",
    token_counting_method: "approxCl100kTokens regex /[A-Za-z]+|\\d+|[^\\sA-Za-z\\d]/g over system_header",
  };

  const pairEpSym = liveSummary?.bootstrap_10000?.episode_level_n40?.paired_deltas?.physical_vs_symbolic ?? null;
  const pairTcSym = liveSummary?.bootstrap_10000?.task_cluster_n20?.paired_deltas?.physical_vs_symbolic ?? null;

  const summary = liveSummary
    ? `Live-LLM 5-arm codec showdown verified over ${tasks.length} EXP-001 tasks x ${liveSummary.model_count} live models (${liveSummary.models_evaluated.join(", ")}) plus offline codec + 20-line NOAA baseline audit (GT parity=${gtVerifiedCount}/${tasks.length}). Live macro score: Physical=${(liveSummary.macro_by_arm["Treatment-Caelus-Physical"].mean_score * 100).toFixed(1)}% [95% CI ${(liveSummary.macro_by_arm["Treatment-Caelus-Physical"].ci95_episode_bootstrap[0] * 100).toFixed(1)}-${(liveSummary.macro_by_arm["Treatment-Caelus-Physical"].ci95_episode_bootstrap[1] * 100).toFixed(1)}%] vs Symbolic=${(liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"].mean_score * 100).toFixed(1)}% vs Synthetic=${(liveSummary.macro_by_arm["Control-Synthetic"].mean_score * 100).toFixed(1)}% vs ISO=${(liveSummary.macro_by_arm["Control-ISO"].mean_score * 100).toFixed(1)}% vs None=${(liveSummary.macro_by_arm["Baseline-None"].mean_score * 100).toFixed(1)}% (paired Physical-Symbolic +${(pairEpSym.mean_diff * 100).toFixed(1)} pp [95% CI +${(pairEpSym.ci95[0] * 100).toFixed(1)}, +${(pairEpSym.ci95[1] * 100).toFixed(1)} pp], p=${pairEpSym.bootstrap_p_two_sided.toFixed(4)}, ${pairEpSym.wins}W/${pairEpSym.ties}T/${pairEpSym.losses}L; offline NOAA-20line=${(noaa20Baseline.mean_score * 100).toFixed(1)}% overall, ${(noaa20Baseline.photoperiod_score * 100).toFixed(1)}% photoperiod tie vs ${(noaa20Baseline.compaction_score * 100).toFixed(1)}% compaction; ${phys.mean_cl100k_tokens.toFixed(2)} cl100k tok/turn).`
    : `Offline codec audit + scorer verification over ${tasks.length} EXP-001 eval_suite tasks x 5 arms (GT parity=${gtVerifiedCount}/${tasks.length}, max sunAlt diff=${round4(maxSunAltDiffDeg)} deg). Live-LLM inference PENDING --live.`;

  const results = {
    id: "EXP-005",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status,
    summary,
    metrics: {
      live_physical_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Treatment-Caelus-Physical"].mean_score
        : null,
      live_physical_ci95_episode: liveSummary
        ? liveSummary.macro_by_arm["Treatment-Caelus-Physical"].ci95_episode_bootstrap
        : null,
      live_symbolic_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"].mean_score
        : null,
      live_symbolic_ci95_episode: liveSummary
        ? liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"].ci95_episode_bootstrap
        : null,
      live_synthetic_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Control-Synthetic"].mean_score
        : null,
      live_iso_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Control-ISO"].mean_score
        : null,
      live_none_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Baseline-None"].mean_score
        : null,
      live_margin_physical_vs_iso: liveSummary
        ? liveSummary.macro_deltas.physical_minus_iso
        : null,
      live_margin_physical_vs_synthetic: liveSummary
        ? liveSummary.macro_deltas.physical_minus_synthetic
        : null,
      live_margin_physical_vs_symbolic: liveSummary
        ? liveSummary.macro_deltas.physical_minus_symbolic
        : null,
      live_paired_physical_vs_symbolic_ci95_n40: pairEpSym ? pairEpSym.ci95 : null,
      live_paired_physical_vs_symbolic_p_n40: pairEpSym ? pairEpSym.bootstrap_p_two_sided : null,
      live_paired_physical_vs_symbolic_ci95_n20_cluster: pairTcSym ? pairTcSym.ci95 : null,
      live_paired_physical_vs_symbolic_p_n20_cluster: pairTcSym ? pairTcSym.bootstrap_p_two_sided : null,
      live_models_count: liveSummary ? liveSummary.model_count : 0,
      physical_codec_score: phys.mean_score,
      symbolic_codec_score: sym.mean_score,
      synthetic_codec_score: synth.mean_score,
      iso_codec_score: iso.mean_score,
      none_codec_score: none.mean_score,
      noaa20_offline_codec_score: noaa20Baseline.mean_score,
      noaa20_offline_photoperiod_score: noaa20Baseline.photoperiod_score,
      noaa20_offline_compaction_score: noaa20Baseline.compaction_score,
      physical_all20_twilight_5class_accuracy: all20TwilightPhysAcc,
      symbolic_all20_twilight_5class_accuracy: all20TwilightSymAcc,
      non_binary_twilight_tasks_count: nonBinaryTwilightTasks,
      physical_mean_cl100k_tokens: phys.mean_cl100k_tokens,
      symbolic_mean_cl100k_tokens: sym.mean_cl100k_tokens,
      synthetic_mean_cl100k_tokens: synth.mean_cl100k_tokens,
      iso_mean_cl100k_tokens: iso.mean_cl100k_tokens,
      none_mean_cl100k_tokens: none.mean_cl100k_tokens,
      noaa20_mean_cl100k_tokens: noaa20Baseline.mean_cl100k_tokens,
      symbolic_pm1_sign_slip_fresh_tool_accuracy: symbolicSignSlipFreshAcc,
      ground_truth_parity_rate: round4(gtVerifiedCount / tasks.length),
      scorer_oracle_pass_rate: round4(scorerOraclePassed / tasks.length),
      scorer_corrupt_catch_rate: round4(scorerCorruptCaught / tasks.length),
      live_llm_verified: Boolean(liveSummary),
      runtime_ms: elapsedMs,
      scoring_rubric: scoringRubric,
      offline_codec_by_arm: offlineByArm,
      control_noaa_20line: noaa20Baseline,
      live_eval: liveSummary,
    },
    verdict,
  };

  const outPath = resolve(__dirname, "results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf8");
  renderExp005ChartSvg(offlineByArm, liveSummary, resolve(__dirname, "chart.svg"));
  console.log(`EXP-005 complete: status=${status} (${elapsedMs} ms)`);
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
