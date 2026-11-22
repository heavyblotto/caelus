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
  const modelSummaries = [];

  for (const run of receipt.runs ?? []) {
    const byArm = {};
    for (const armName of ARMS) {
      const eps = (run.episodes ?? []).filter((e) => e.arm === armName);
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

      for (const ep of eps) {
        const task = taskById.get(ep.task_id);
        if (!task) continue;
        latSum += ep.latency_ms ?? 0;
        if (ep.api_error) {
          apiErrors++;
          continue;
        }
        if (!ep.parsed || typeof ep.parsed !== "object") {
          parseErrors++;
        }
        const g = gradeResponse(task, ep.parsed);
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

      const n = Math.max(1, eps.length);
      const fieldAcc = {};
      for (const k of Object.keys(fieldTotals)) {
        fieldAcc[k] = round4((fieldHits[k] ?? 0) / fieldTotals[k]);
      }

      byArm[armName] = {
        episodes: eps.length,
        mean_score: round4(scoreSum / n),
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

  // Macro mean across all evaluated models
  const macroByArm = {};
  for (const armName of ARMS) {
    const k = Math.max(1, modelSummaries.length);
    const avg = (fn) => round4(modelSummaries.reduce((acc, m) => acc + fn(m.by_arm[armName]), 0) / k);
    macroByArm[armName] = {
      mean_score: avg((a) => a.mean_score),
      exact_task_rate: avg((a) => a.exact_task_rate),
      compaction_score: avg((a) => a.compaction_score),
      photoperiod_score: avg((a) => a.photoperiod_score),
      high_lat_photoperiod_score: avg((a) => a.high_lat_photoperiod_score),
      high_lat_all_score: avg((a) => a.high_lat_all_score),
      mean_latency_ms: avg((a) => a.mean_latency_ms),
    };
  }

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

  const summary = liveSummary
    ? `Live-LLM 5-arm codec showdown verified over ${tasks.length} EXP-001 tasks x ${liveSummary.model_count} live models (${liveSummary.models_evaluated.join(", ")}) plus offline codec audit (GT parity=${gtVerifiedCount}/${tasks.length}). Live macro score: Physical=${(liveSummary.macro_by_arm["Treatment-Caelus-Physical"].mean_score * 100).toFixed(1)}% vs Symbolic=${(liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"].mean_score * 100).toFixed(1)}% vs Synthetic=${(liveSummary.macro_by_arm["Control-Synthetic"].mean_score * 100).toFixed(1)}% vs ISO=${(liveSummary.macro_by_arm["Control-ISO"].mean_score * 100).toFixed(1)}% vs None=${(liveSummary.macro_by_arm["Baseline-None"].mean_score * 100).toFixed(1)}% (Physical - ISO = +${(liveSummary.macro_deltas.physical_minus_iso * 100).toFixed(1)} pp, Physical - Synthetic = +${(liveSummary.macro_deltas.physical_minus_synthetic * 100).toFixed(1)} pp, Physical - Symbolic = +${(liveSummary.macro_deltas.physical_minus_symbolic * 100).toFixed(1)} pp at ${phys.mean_cl100k_tokens} cl100k tok/turn).`
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
      live_symbolic_accuracy: liveSummary
        ? liveSummary.macro_by_arm["Arm4b-Caelus-Symbolic"].mean_score
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
      live_models_count: liveSummary ? liveSummary.model_count : 0,
      physical_codec_score: phys.mean_score,
      symbolic_codec_score: sym.mean_score,
      synthetic_codec_score: synth.mean_score,
      iso_codec_score: iso.mean_score,
      none_codec_score: none.mean_score,
      physical_all20_twilight_5class_accuracy: all20TwilightPhysAcc,
      symbolic_all20_twilight_5class_accuracy: all20TwilightSymAcc,
      non_binary_twilight_tasks_count: nonBinaryTwilightTasks,
      physical_mean_cl100k_tokens: phys.mean_cl100k_tokens,
      symbolic_mean_cl100k_tokens: sym.mean_cl100k_tokens,
      symbolic_pm1_sign_slip_fresh_tool_accuracy: symbolicSignSlipFreshAcc,
      ground_truth_parity_rate: round4(gtVerifiedCount / tasks.length),
      scorer_oracle_pass_rate: round4(scorerOraclePassed / tasks.length),
      scorer_corrupt_catch_rate: round4(scorerCorruptCaught / tasks.length),
      live_llm_verified: Boolean(liveSummary),
      runtime_ms: elapsedMs,
      offline_codec_by_arm: offlineByArm,
      live_eval: liveSummary,
    },
    verdict,
  };

  const outPath = resolve(__dirname, "results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf8");
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
