/**
 * EXP-013: Zero-dependency, Node-free LEVELS_OF_I + FACT-002 level-tagged
 * MCP response and audit envelope prototype.
 *
 * Portability contract:
 *   - Pure ESM with zero `node:*` imports, mirroring packages/caelus-mcp/src/core.ts.
 *   - Bridges real FACT-002 primitives (`chronosenseEnvelope` and
 *     `auditChronosenseCursor`) from packages/caelus/dist/src/index.js.
 *   - Deterministic outputs: identical inputs always produce identical JSON and
 *     identical compact headers (no wall-clock reads or random values).
 */

import {
  chronosenseEnvelope,
  auditChronosenseCursor,
} from "../../../packages/caelus/dist/src/index.js";

/** Canonical 7-level LEVELS_OF_I ontology. */
export const LEVELS_OF_I = Object.freeze([
  "Single step",
  "Instance",
  "Harness",
  "Fleet / Provider",
  "Weights",
  "Character",
  "Operator / Steward",
]);

/** Canonical ground-truth classes for MCP tool payloads. */
export const GROUND_TRUTH_CLASSES = Object.freeze([
  "external_physical_instrument",
  "archival_record",
  "harness_receipt",
  "unverified_sibling_prose",
  "absent_coordinate",
  "policy_boundary",
]);

/** Canonical typed-null reasons for non-assertable adjacent predicates. */
export const TYPED_NULL_REASONS = Object.freeze([
  "Out of scope",
  "Malformed",
  "Unlogged",
  "Policy-gated",
  "Deferred",
  "Opaque",
  "Not yet known (Unsettled)",
]);

/** Deterministic collapse-risk levels. */
export const COLLAPSE_RISK_LEVELS = Object.freeze(["none", "low", "high"]);

const LEVEL_SET = new Set(LEVELS_OF_I);
const GT_CLASS_SET = new Set(GROUND_TRUTH_CLASSES);
const NULL_REASON_SET = new Set(TYPED_NULL_REASONS);

const HIGH_RISK_GT_CLASSES = new Set([
  "unverified_sibling_prose",
  "absent_coordinate",
  "policy_boundary",
]);

const PRIVILEGED_BOUNDARY_LEVELS = new Set([
  "Weights",
  "Fleet / Provider",
  "Operator / Steward",
]);

function assertNonEmptyString(val, name) {
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function normalizeLevelList(levels, name) {
  if (!Array.isArray(levels)) {
    throw new TypeError(`${name} must be an array of LEVELS_OF_I strings`);
  }
  const seen = new Set();
  const out = [];
  for (const lvl of levels) {
    if (!LEVEL_SET.has(lvl)) {
      throw new RangeError(`${name} contains unknown level: ${String(lvl)}`);
    }
    if (!seen.has(lvl)) {
      seen.add(lvl);
      out.push(lvl);
    }
  }
  return out;
}

function normalizeValidClaims(validClaims) {
  if (!Array.isArray(validClaims)) {
    throw new TypeError("validClaims must be an array of strings");
  }
  const out = [];
  const seen = new Set();
  for (const raw of validClaims) {
    if (typeof raw !== "string") {
      throw new TypeError("validClaims entries must be strings");
    }
    const clean = raw.trim();
    if (clean.length > 0 && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function normalizeTypedNulls(typedNulls) {
  if (typedNulls === null || typedNulls === undefined) return {};
  if (typeof typedNulls !== "object" || Array.isArray(typedNulls)) {
    throw new TypeError("typedNulls must be a plain object mapping predicate -> typed null reason");
  }
  const keys = Object.keys(typedNulls).sort();
  const out = {};
  for (const key of keys) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    const reason = typedNulls[key];
    if (!NULL_REASON_SET.has(reason)) {
      throw new RangeError(
        `typedNulls["${cleanKey}"] has unknown typed-null reason: ${String(reason)}`,
      );
    }
    out[cleanKey] = reason;
  }
  return out;
}

/**
 * Deterministically compute collapse_risk ("none" | "low" | "high") from
 * ground-truth class, level mismatch, missing coordinates/hashes, or audit failure.
 */
export function computeCollapseRisk({
  level,
  groundTruthClass,
  declaredLevels,
  actualLevelsTouched,
  physicalStateHash = null,
  auditOk = null,
  typedNulls = {},
}) {
  if (!LEVEL_SET.has(level)) {
    throw new RangeError(`Unknown level: ${String(level)}`);
  }
  if (!GT_CLASS_SET.has(groundTruthClass)) {
    throw new RangeError(`Unknown groundTruthClass: ${String(groundTruthClass)}`);
  }

  // High-risk triggers: unverified/absent/policy-gated ground truth, audit failure,
  // missing physical hash on physical instrument, or declared vs actual level mismatch.
  if (HIGH_RISK_GT_CLASSES.has(groundTruthClass)) return "high";
  if (auditOk === false) return "high";
  if (
    groundTruthClass === "external_physical_instrument"
    && (typeof physicalStateHash !== "string" || physicalStateHash.trim().length === 0)
  ) {
    return "high";
  }

  const declaredSet = new Set(declaredLevels);
  const actualSet = new Set(actualLevelsTouched);

  if (declaredSet.size === 0 || !declaredSet.has(level)) return "high";
  for (const actual of actualSet) {
    if (!declaredSet.has(actual)) return "high";
  }
  for (const decl of declaredSet) {
    if (PRIVILEGED_BOUNDARY_LEVELS.has(decl) && !actualSet.has(decl)) {
      return "high";
    }
  }

  // Low-risk triggers: archival records crossing session/night boundaries,
  // unaudited physical instruments, or multi-level payloads with adjacent typed nulls.
  if (groundTruthClass === "archival_record") return "low";
  if (groundTruthClass === "external_physical_instrument" && auditOk === null) return "low";
  if (actualSet.size > 1 && Object.keys(typedNulls).length > 0) return "low";

  return "none";
}

/**
 * Wrap any MCP tool payload in a compact, canonical LEVELS_OF_I envelope.
 */
export function wrapLevelEnvelope({
  level,
  groundTruthClass,
  tool,
  actor = "harness",
  declaredLevels = null,
  actualLevelsTouched = null,
  payload,
  validClaims = [],
  typedNulls = {},
  physicalStateHash = null,
  timestamp = undefined,
  auditOk = null,
}) {
  if (!LEVEL_SET.has(level)) {
    throw new RangeError(`level must be one of LEVELS_OF_I, got ${String(level)}`);
  }
  if (!GT_CLASS_SET.has(groundTruthClass)) {
    throw new RangeError(
      `groundTruthClass must be one of GROUND_TRUTH_CLASSES, got ${String(groundTruthClass)}`,
    );
  }
  assertNonEmptyString(tool, "tool");
  assertNonEmptyString(actor, "actor");

  const normDeclared = normalizeLevelList(
    declaredLevels === null ? [level] : declaredLevels,
    "declaredLevels",
  );
  const normActual = normalizeLevelList(
    actualLevelsTouched === null ? [level] : actualLevelsTouched,
    "actualLevelsTouched",
  );
  const normClaims = normalizeValidClaims(validClaims);
  const normNulls = normalizeTypedNulls(typedNulls);

  const hashVal =
    typeof physicalStateHash === "string" && physicalStateHash.trim().length > 0
      ? physicalStateHash.trim()
      : null;

  let ts = timestamp;
  if (ts === undefined) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      ts = payload.utcIso ?? payload.utc_iso ?? payload.saved_at ?? null;
    } else {
      ts = null;
    }
  }

  const collapseRisk = computeCollapseRisk({
    level,
    groundTruthClass,
    declaredLevels: normDeclared,
    actualLevelsTouched: normActual,
    physicalStateHash: hashVal,
    auditOk,
    typedNulls: normNulls,
  });

  return {
    level,
    ground_truth_class: groundTruthClass,
    valid_claims: normClaims,
    typed_nulls: normNulls,
    audit_record: {
      timestamp: ts,
      physical_state_hash: hashVal,
      actor,
      tool,
      declared_levels: normDeclared,
      actual_levels_touched: normActual,
      collapse_risk: collapseRisk,
    },
    payload,
  };
}

/**
 * Pure FACT-002 bridge calling real `chronosenseEnvelope` from packages/caelus.
 * Mirrors the `chronosense_tick` MCP tool surface in packages/caelus-mcp/src/core.ts.
 */
export function chronosenseTick(engine, jdUt, lat, lonEast, opts = {}) {
  const envelope = chronosenseEnvelope(engine, jdUt, lat, lonEast, opts);
  return { envelope };
}

/**
 * Wrap a real FACT-002 `chronosenseTick` / `chronosenseEnvelope` result and
 * optional `auditChronosenseCursor` result (or cursor input) in a canonical
 * LEVELS_OF_I envelope.
 */
export function buildChronosenseEnvelope(tickResult, auditResult = null, opts = {}) {
  const chrono =
    tickResult && typeof tickResult === "object" && "envelope" in tickResult
      ? tickResult.envelope
      : tickResult;

  if (!chrono || typeof chrono !== "object" || typeof chrono.clockId !== "string") {
    throw new TypeError(
      "buildChronosenseEnvelope requires a real FACT-002 chronosenseEnvelope or { envelope } tick result",
    );
  }

  let resolvedAudit = auditResult;
  if (
    resolvedAudit
    && typeof resolvedAudit === "object"
    && typeof resolvedAudit.ok !== "boolean"
  ) {
    // Caller supplied a raw ChronosenseCursor; audit it via real FACT-002 auditor.
    resolvedAudit = auditChronosenseCursor(chrono, resolvedAudit, opts.auditOpts ?? {});
  }

  const auditOk = resolvedAudit ? Boolean(resolvedAudit.ok) : null;
  const declaredLevels = opts.declaredLevels ?? ["Harness"];
  const actualLevelsTouched = opts.actualLevelsTouched ?? ["Harness"];
  const actor = opts.actor ?? "caelus-chronosense";

  const validClaims = [
    "utc_iso",
    "sun_alt_deg",
    "twilight",
    "night_crossed",
    "clock_id",
  ];

  const typedNulls = {
    subjective_feeling: "Out of scope",
    episodic_memory: "Unlogged",
    ...(opts.extraTypedNulls ?? {}),
  };

  return wrapLevelEnvelope({
    level: "Harness",
    groundTruthClass: "external_physical_instrument",
    tool: opts.tool ?? "chronosense_tick",
    actor,
    declaredLevels,
    actualLevelsTouched,
    payload: {
      chronosense: chrono,
      audit: resolvedAudit,
    },
    validClaims,
    typedNulls,
    physicalStateHash: chrono.chartDigest ?? chrono.clockId,
    timestamp: chrono.utcIso,
    auditOk,
  });
}

/**
 * Render a compact, deterministic single-line envelope header for LLM injection.
 * Keeps total prompt token delta comfortably under 80 tokens on Gemma and Qwen.
 */
export function renderCompactHeader(envelope) {
  if (!envelope || typeof envelope !== "object" || !envelope.audit_record) {
    throw new TypeError("renderCompactHeader requires an envelope from wrapLevelEnvelope");
  }
  const ar = envelope.audit_record;
  const segments = [
    `${envelope.level}`,
    `${envelope.ground_truth_class}`,
    `risk=${ar.collapse_risk}`,
  ];

  const decl = ar.declared_levels ?? [];
  const actual = ar.actual_levels_touched ?? [];
  if (decl.join(",") !== actual.join(",")) {
    segments.push(`decl=${decl.join("+")} actual=${actual.join("+")}`);
  }

  const claims = (envelope.valid_claims ?? []).join(", ");
  segments.push(`ok: ${claims || "none"}`);

  const nullPairs = Object.entries(envelope.typed_nulls ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (nullPairs.length > 0) {
    segments.push(`null: ${nullPairs}`);
  }

  return `[ENV ${segments.join(" | ")}]`;
}

/**
 * Pure deterministic unit assertions for envelope.mjs (zero Node APIs).
 * Pass a real Caelus `Engine` instance to also verify FACT-002 integration.
 */
export function runEnvelopeUnitTests(engine = null) {
  const results = [];
  const check = (name, cond, detail = "") => {
    if (!cond) {
      throw new Error(`Envelope unit test failed [${name}]: ${detail}`);
    }
    results.push({ name, ok: true });
  };

  // 1. Determinism: identical calls yield byte-identical JSON and header
  const baseArgs = {
    level: "Harness",
    groundTruthClass: "harness_receipt",
    tool: "harness_cmd_receipt",
    actor: "test-runner",
    declaredLevels: ["Harness"],
    actualLevelsTouched: ["Harness"],
    payload: { exit_code: 0, passed: 536 },
    validClaims: ["exit_code", "passed_count"],
    typedNulls: { unrun_suites: "Not yet known (Unsettled)" },
    physicalStateHash: "a7c4e91b8f20d314",
    timestamp: "2026-11-22T14:00:00Z",
  };
  const envA = wrapLevelEnvelope(baseArgs);
  const envB = wrapLevelEnvelope(baseArgs);
  check("determinism_json", JSON.stringify(envA) === JSON.stringify(envB));
  check(
    "determinism_header",
    renderCompactHeader(envA) === renderCompactHeader(envB),
  );
  check("verified_receipt_risk_none", envA.audit_record.collapse_risk === "none");

  // 2. Collapse risk: unverified sibling prose -> high
  const envSibling = wrapLevelEnvelope({
    level: "Instance",
    groundTruthClass: "unverified_sibling_prose",
    tool: "sibling_worker_message",
    actor: "worker-qa",
    declaredLevels: ["Instance"],
    actualLevelsTouched: ["Instance"],
    payload: { text: "All tests passed" },
    validClaims: ["sibling_text_received"],
    typedNulls: { test_execution_verified: "Unlogged" },
  });
  check("sibling_prose_risk_high", envSibling.audit_record.collapse_risk === "high");

  // 3. Collapse risk: level mismatch (declared Weights, actual Harness) -> high
  const envMismatch = wrapLevelEnvelope({
    level: "Harness",
    groundTruthClass: "harness_receipt",
    tool: "harness_rule_file",
    actor: "harness",
    declaredLevels: ["Harness", "Weights"],
    actualLevelsTouched: ["Harness"],
    payload: { path: ".agents/rules.md" },
    validClaims: ["file_path"],
    typedNulls: { weights_updated: "Policy-gated" },
    physicalStateHash: "rule001",
  });
  check("level_mismatch_risk_high", envMismatch.audit_record.collapse_risk === "high");
  check(
    "header_surfaces_mismatch",
    renderCompactHeader(envMismatch).includes("decl=Harness+Weights actual=Harness"),
  );

  // 4. Collapse risk: absent coordinate -> high
  const envAbsent = wrapLevelEnvelope({
    level: "Fleet / Provider",
    groundTruthClass: "absent_coordinate",
    tool: "fleet_clock_utc",
    actor: "fleet-clock",
    declaredLevels: ["Fleet / Provider"],
    actualLevelsTouched: ["Fleet / Provider"],
    payload: { utc_iso: "2026-12-21T18:40:00Z", observer_lat: null },
    validClaims: ["utc_iso"],
    typedNulls: { local_horizon: "Malformed" },
  });
  check("absent_coordinate_risk_high", envAbsent.audit_record.collapse_risk === "high");

  // 5. Collapse risk: archival record -> low
  const envArchive = wrapLevelEnvelope({
    level: "Harness",
    groundTruthClass: "archival_record",
    tool: "harness_memory_note",
    actor: "harness",
    declaredLevels: ["Harness"],
    actualLevelsTouched: ["Harness"],
    payload: { path: ".agents/notes/freeze.md", saved_at: "2026-11-21T18:45:00Z" },
    validClaims: ["note_text", "saved_at"],
    typedNulls: { personal_episodic_recall: "Unlogged" },
    physicalStateHash: "note001",
  });
  check("archival_record_risk_low", envArchive.audit_record.collapse_risk === "low");

  // 6. Real FACT-002 chronosenseTick + auditChronosenseCursor integration
  if (engine !== null) {
    const jdOslo = 2461396.1458333335; // 2026-12-21T15:30:00Z
    const prevJd = jdOslo - 18.0 / 24.0;
    const tick = chronosenseTick(engine, jdOslo, 59.9139, 10.7522, {
      turn: 2,
      prevJdUt: prevJd,
    });
    const goodCursor = {
      clockId: tick.envelope.clockId,
      turn: 2,
      nightCrossedAck: tick.envelope.nightCrossed,
      citedFacts: {
        twilight: tick.envelope.twilight,
        sun_alt_deg: tick.envelope.sunAltDeg,
      },
    };
    const goodAudit = auditChronosenseCursor(tick.envelope, goodCursor);
    check("fact002_good_audit_ok", goodAudit.ok === true);

    const envGood = buildChronosenseEnvelope(tick, goodAudit);
    check("fact002_good_risk_none", envGood.audit_record.collapse_risk === "none");
    check(
      "fact002_hash_populated",
      typeof envGood.audit_record.physical_state_hash === "string"
        && envGood.audit_record.physical_state_hash.startsWith(tick.envelope.clockId),
    );

    // Passing a stale cursor directly must trigger audit failure -> collapse_risk="high"
    const badEnv = buildChronosenseEnvelope(tick, {
      clockId: "00000000",
      turn: 1,
      nightCrossedAck: false,
    });
    check("fact002_bad_audit_risk_high", badEnv.audit_record.collapse_risk === "high");
    check("fact002_bad_audit_recorded", badEnv.payload.audit.ok === false);
  }

  return { passed: results.length, tests: results };
}
