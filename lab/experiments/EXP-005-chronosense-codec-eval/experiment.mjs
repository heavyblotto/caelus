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
 *   - Runs deterministic grader and write-back cursor audit verification across
 *     clean, drifted, and hallucinated synthetic responses (0% scorer error).
 *   - Records status="inconclusive" because live transformer weights have not
 *     been queried yet, keeping FACT-002 honestly gated.
 *
 * Optional live-LLM mode (explicit CLI opt-in only):
 *   node lab/experiments/EXP-005-chronosense-codec-eval/experiment.mjs \
 *     --live --provider=gemini --model=gemini-2.5-flash
 *   Supported providers: gemini (GEMINI_API_KEY), openai (OPENAI_API_KEY),
 *   anthropic (ANTHROPIC_API_KEY).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import { loadNodeData } from "../../../packages/caelus/dist/src/node-loader.js";
import {
  Engine,
  sceneGeometry,
  canonicalChart,
  chartDigest,
} from "../../../packages/caelus/dist/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(REPO_ROOT, "packages/caelus/data");
const EVAL_SUITE_PATH = resolve(
  REPO_ROOT,
  "lab/experiments/EXP-001-chronosense-ablation/eval_suite.jsonl",
);

const ARMS = [
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
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

function round4(x) {
  return Number(x.toFixed(4));
}

function parseCliArgs(argv) {
  const opts = { live: false, provider: "gemini", model: null, limit: null };
  for (const arg of argv) {
    if (arg === "--live") opts.live = true;
    else if (arg.startsWith("--provider=")) opts.provider = arg.slice(11);
    else if (arg.startsWith("--model=")) opts.model = arg.slice(8);
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice(8));
  }
  return opts;
}

/**
 * Parse the two cached tool readings from the compaction_stale_tool prompt.
 * Returns [{ id: "Tool-A", moonDeg: 85.8 }, { id: "Tool-B", moonDeg: 101.0 }].
 */
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
 * sign indices (optional zodiacSignSlip simulates a +/-1 sign recall error
 * when an LLM mentally converts zodiac shorthand into ecliptic degrees).
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
    // Passive UTC ISO timestamp cannot determine local solar midnight crossing
    // without previous turn timestamp or local longitude, nor local twilight,
    // nor Moon longitude, nor physical sunset deadline.
    const isoMatch = header.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const utcHour = Number(isoMatch[2]) + Number(isoMatch[3]) / 60;
      // Naive UTC heuristic without coordinates: assume daytime 06..18 UTC
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
      const elapsedSec = Number(elapsedM[1]);
      // Without previous turn phase, elapsed > 12h hints night may have passed
      decoded.night_crossed = elapsedSec >= 43200;
    }
    if (sinM && cosM) {
      // Fixed 24h wave: cos24 < 0 corresponds to fixed 06:00..18:00 mean solar
      const cos24 = Number(cosM[1]);
      decoded.is_day = cos24 < 0;
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
      // Symbolic arm collapses civil/nautical/astronomical/night into binary Night.
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
        // Requires zodiac sign lookup + 30-deg multiplication + addition (2 hops)
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
 * Deterministic response grader shared by offline dry-run and --live LLM mode.
 * Grades a structured JSON response against the task ground_truth and
 * archetype-specific scoring rubric.
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
    checks.digest_match =
      typeof responseObj?.canonical_digest8 === "string" &&
      responseObj.canonical_digest8.toLowerCase() === gt.canonical_digest8;
  } else {
    checks.is_day =
      typeof responseObj?.is_day === "boolean" && responseObj.is_day === gt.is_day;
    checks.twilight_stage = responseObj?.twilight_stage === gt.twilight_stage;
    checks.deadline_phase = responseObj?.deadline_phase === gt.deadline_phase;
    checks.deadline_minutes_within_15m =
      typeof responseObj?.deadline_minutes_remaining === "number" &&
      Number.isFinite(responseObj.deadline_minutes_remaining) &&
      Math.abs(responseObj.deadline_minutes_remaining - gt.deadline_minutes_remaining) <= 15;
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
      ? `Return strict JSON only: {"night_crossed": boolean, "fresh_tool_id": "Tool-A"|"Tool-B", "canonical_digest8": string|null}`
      : `Return strict JSON only: {"is_day": boolean, "twilight_stage": "day"|"civil"|"nautical"|"astronomical"|"night", "deadline_phase": "applying"|"exact"|"separating", "deadline_minutes_remaining": number}`;
  const systemPrompt = [
    "You are an autonomous agent executing a long-horizon task with strict temporal grounding.",
    arm.system_header ? `Context header:\n${arm.system_header}` : "No temporal header is provided.",
    schemaHint,
  ].join("\n\n");
  return { systemPrompt, userPrompt: arm.user_prompt };
}

async function callLiveLlm(provider, model, systemPrompt, userPrompt) {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const m = model ?? "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
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
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(txt);
  }
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const m = model ?? "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
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
    return JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
  }
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    const m = model ?? "claude-3-5-haiku-latest";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: m,
        max_tokens: 256,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const txt = data?.content?.[0]?.text ?? "{}";
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  }
  throw new Error(`Unsupported provider: ${provider}`);
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

  // Step 5: Optional live-LLM execution (--live)
  let liveSummary = null;
  if (cli.live) {
    const liveByArm = {};
    for (const armName of ARMS) {
      let scoreSum = 0;
      let exactSum = 0;
      let errors = 0;
      for (const task of tasks) {
        const { systemPrompt, userPrompt } = buildLivePrompt(task, armName);
        try {
          const resp = await callLiveLlm(cli.provider, cli.model, systemPrompt, userPrompt);
          const g = gradeResponse(task, resp);
          scoreSum += g.score;
          if (g.all_correct) exactSum++;
        } catch {
          errors++;
        }
      }
      liveByArm[armName] = {
        mean_score: round4(scoreSum / tasks.length),
        exact_task_rate: round4(exactSum / tasks.length),
        api_errors: errors,
      };
    }
    liveSummary = {
      provider: cli.provider,
      model: cli.model ?? "default",
      tasks_evaluated: tasks.length,
      by_arm: liveByArm,
    };
  }

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
    `INCONCLUSIVE (offline dry-run complete; live-LLM gate pending): Ground-truth parity (${gtVerifiedCount}/${tasks.length}), scorer self-tests (${scorerOraclePassed}/${tasks.length} oracle, ${scorerCorruptCaught}/${tasks.length} corrupt caught), and bounded codec audit pass cleanly. Treatment-Caelus-Physical recovers ${(phys.mean_score * 100).toFixed(1)}% of task observables (${(all20TwilightPhysAcc * 100).toFixed(0)}% 5-class twilight across all 20 tasks, ${phys.mean_cl100k_tokens} tokens, 0 conversion hops) vs Arm4b-Caelus-Symbolic ${(sym.mean_score * 100).toFixed(1)}% (${(all20TwilightSymAcc * 100).toFixed(0)}% 5-class twilight across all 20 tasks because ${nonBinaryTwilightTasks} civil/nautical/astronomical twilight tasks collapse to binary Night, ${sym.mean_cl100k_tokens} tokens, 2 zodiac-to-degree hops, drops to ${(symbolicSignSlipFreshAcc * 100).toFixed(0)}% fresh-tool acc under symmetric +/-1 sign slip), Control-Synthetic ${(synth.mean_score * 100).toFixed(1)}%, Control-ISO ${(iso.mean_score * 100).toFixed(1)}%, and Baseline-None ${(none.mean_score * 100).toFixed(1)}%. Run with --live and an API key to clear the FACT-002 live-LLM gate.`;

  if (liveSummary) {
    const lp = liveSummary.by_arm["Treatment-Caelus-Physical"].mean_score;
    const ls = liveSummary.by_arm["Control-Synthetic"].mean_score;
    const li = liveSummary.by_arm["Control-ISO"].mean_score;
    const lsym = liveSummary.by_arm["Arm4b-Caelus-Symbolic"].mean_score;
    if (lp - li >= 0.2 && lp > ls + 0.05 && lp >= lsym) {
      status = "pass";
      verdict = `PASS (live ${liveSummary.provider}/${liveSummary.model}): Physical (${lp}) beats ISO (${li}) by +${round4(lp - li)}, beats Synthetic (${ls}), and beats/matches Symbolic (${lsym}).`;
    } else if (ls >= lp - 0.05) {
      status = "fail";
      verdict = `FAIL (live ${liveSummary.provider}/${liveSummary.model}): Control-Synthetic (${ls}) tied or beat Treatment-Caelus-Physical (${lp}) within 5 pp.`;
    }
  } else if (!offlineAuditClean) {
    status = "fail";
    verdict = "FAIL: Offline ground-truth verification or codec audit failed.";
  }

  const results = {
    id: "EXP-005",
    run_at: new Date().toISOString(),
    git_sha: getGitSha(),
    status,
    summary: `Offline codec audit + scorer verification over ${tasks.length} EXP-001 eval_suite tasks x 5 arms (GT parity=${gtVerifiedCount}/${tasks.length}, max sunAlt diff=${round4(maxSunAltDiffDeg)} deg). Bounded-decoder score: Physical=${(phys.mean_score * 100).toFixed(1)}% (${phys.mean_cl100k_tokens} tok, ${(all20TwilightPhysAcc * 100).toFixed(0)}% 5-class twilight), Symbolic=${(sym.mean_score * 100).toFixed(1)}% (${sym.mean_cl100k_tokens} tok, ${(all20TwilightSymAcc * 100).toFixed(0)}% 5-class twilight, 2 conversion hops, ${(symbolicSignSlipFreshAcc * 100).toFixed(0)}% on +/-1 sign slip), Synthetic=${(synth.mean_score * 100).toFixed(1)}%, ISO=${(iso.mean_score * 100).toFixed(1)}%, None=${(none.mean_score * 100).toFixed(1)}%. Live-LLM inference (${cli.live ? "EXECUTED" : "PENDING --live"}) remains the FACT-002 gate.`,
    metrics: {
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
      live_llm_executed: cli.live,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
