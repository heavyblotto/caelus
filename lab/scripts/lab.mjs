#!/usr/bin/env node
/**
 * Caelus R&D Lab and Feature Factory CLI (`lab/scripts/lab.mjs`).
 *
 * Zero-dependency Node ESM control plane for `lab/`:
 *   node lab/scripts/lab.mjs status            Summary tables + hygiene check
 *   node lab/scripts/lab.mjs run <id|all>      Execute experiment(s) and verify results.json
 *   node lab/scripts/lab.mjs ledger            Regenerate lab/LEDGER.md deterministically
 *   node lab/scripts/lab.mjs check             Validate schemas and zero em-dashes in lab/ and .agents/
 *   node lab/scripts/lab.mjs new exp <slug>    Scaffold a Razor-compliant experiment
 *   node lab/scripts/lab.mjs new fact <slug>   Scaffold a 5-stage Feature Factory track
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LAB_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(LAB_DIR, "..");
const EXPERIMENTS_DIR = join(LAB_DIR, "experiments");
const FACTORY_DIR = join(LAB_DIR, "factory");
const GRAVEYARD_DIR = join(LAB_DIR, "graveyard");
const LEDGER_PATH = join(LAB_DIR, "LEDGER.md");

const VALID_TRACKS = new Set(["research", "factory"]);
const VALID_STATUSES = new Set([
  "idea",
  "queued",
  "active",
  "proved",
  "promoted",
  "shipped",
  "killed",
]);
const VALID_RESULT_STATUSES = new Set(["pass", "fail", "inconclusive"]);

const REQUIRED_MANIFEST_KEYS = [
  "id",
  "title",
  "track",
  "status",
  "created",
  "hypothesis",
  "null_baseline",
  "success_bar",
  "kill_criterion",
  "entrypoint",
  "tags",
];

const REQUIRED_RESULT_KEYS = [
  "id",
  "run_at",
  "git_sha",
  "status",
  "summary",
  "metrics",
  "verdict",
];

const EM_DASH_RE = new RegExp(
  ["\\u2014", "&" + "mdash;", "&#" + "8212;", "&#x" + "2014;"].join("|"),
  "gi",
);
const HYGIENE_EXTS = new Set([".md", ".mdx", ".json", ".mjs", ".js", ".ts", ".py", ".jsonl"]);

function gitInfo() {
  const run = (args) => {
    try {
      return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  };
  return {
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
    sha: run(["rev-parse", "--short", "HEAD"]),
  };
}

function readJsonSafe(filePath) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(filePath, "utf8")), error: null };
  } catch (err) {
    return { ok: false, data: null, error: String(err.message ?? err) };
  }
}

function validateManifest(manifest, fileRel) {
  const issues = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return [`${fileRel}: manifest must be a JSON object`];
  }
  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (!(key in manifest)) {
      issues.push(`${fileRel}: missing required key "${key}"`);
    }
  }
  if (manifest.track && !VALID_TRACKS.has(manifest.track)) {
    issues.push(`${fileRel}: invalid track "${manifest.track}"`);
  }
  if (manifest.status && !VALID_STATUSES.has(manifest.status)) {
    issues.push(`${fileRel}: invalid status "${manifest.status}"`);
  }
  if (manifest.track === "research" && (!manifest.entrypoint || typeof manifest.entrypoint !== "string")) {
    issues.push(`${fileRel}: research manifest must specify string "entrypoint"`);
  }
  if (manifest.tags !== undefined && !Array.isArray(manifest.tags)) {
    issues.push(`${fileRel}: "tags" must be an array`);
  }
  return issues;
}

function validateResults(results, fileRel) {
  const issues = [];
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    return [`${fileRel}: results.json must be a JSON object`];
  }
  for (const key of REQUIRED_RESULT_KEYS) {
    if (!(key in results)) {
      issues.push(`${fileRel}: missing required key "${key}"`);
    }
  }
  if (results.status && !VALID_RESULT_STATUSES.has(results.status)) {
    issues.push(`${fileRel}: invalid status "${results.status}"`);
  }
  if (results.metrics !== undefined && (typeof results.metrics !== "object" || results.metrics === null)) {
    issues.push(`${fileRel}: "metrics" must be an object`);
  }
  return issues;
}

function discoverTrackItems(baseDir) {
  if (!existsSync(baseDir)) return [];
  const entries = readdirSync(baseDir)
    .filter((name) => !name.startsWith("."))
    .map((name) => join(baseDir, name))
    .filter((full) => statSync(full).isDirectory())
    .sort();

  const items = [];
  for (const dir of entries) {
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifestRel = relative(REPO_ROOT, manifestPath);
    const parsedManifest = readJsonSafe(manifestPath);
    const issues = parsedManifest.ok
      ? validateManifest(parsedManifest.data, manifestRel)
      : [`${manifestRel}: JSON parse error (${parsedManifest.error})`];

    const resultsPath = join(dir, "results.json");
    let results = null;
    if (existsSync(resultsPath)) {
      const resultsRel = relative(REPO_ROOT, resultsPath);
      const parsedResults = readJsonSafe(resultsPath);
      if (parsedResults.ok) {
        results = parsedResults.data;
        issues.push(...validateResults(results, resultsRel));
      } else {
        issues.push(`${resultsRel}: JSON parse error (${parsedResults.error})`);
      }
    }

    items.push({
      dir,
      dirRel: relative(REPO_ROOT, dir),
      slug: dir.split("/").pop(),
      manifestPath,
      resultsPath,
      manifest: parsedManifest.data,
      results,
      issues,
    });
  }

  return items.sort((a, b) => {
    const idA = a.manifest?.id ?? a.slug;
    const idB = b.manifest?.id ?? b.slug;
    return idA.localeCompare(idB, undefined, { numeric: true });
  });
}

function discoverGraveyard() {
  if (!existsSync(GRAVEYARD_DIR)) return [];
  const files = readdirSync(GRAVEYARD_DIR)
    .filter((name) => /^KILL-\d+.*\.md$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return files.map((file) => {
    const full = join(GRAVEYARD_DIR, file);
    const text = readFileSync(full, "utf8");
    const heading = text.match(/^#\s+(?:KILL-\d+\s*:\s*)?(.+)$/m)?.[1]?.trim() ?? file;
    const id = text.match(/\*\*ID\*\*:\s*`?([^`\n]+)`?/i)?.[1]?.trim()
      ?? file.match(/^(KILL-\d+)/i)?.[1]?.toUpperCase()
      ?? file;
    const date = text.match(/\*\*Date Killed\*\*:\s*`?([^`\n]+)`?/i)?.[1]?.trim() ?? "unknown";
    const verdict = text.match(/\*\*Verdict\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "KILLED";
    return {
      id,
      file,
      fileRel: relative(REPO_ROOT, full),
      title: heading,
      date,
      verdict,
    };
  });
}

function scanEmDashes(dirs) {
  const violations = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git") continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (HYGIENE_EXTS.has(extname(entry).toLowerCase())) {
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line, idx) => {
          const matches = [...line.matchAll(EM_DASH_RE)];
          if (matches.length) {
            violations.push({
              file: relative(REPO_ROOT, full),
              line: idx + 1,
              token: matches[0][0],
              snippet: line.trim().slice(0, 90),
            });
          }
        });
      }
    }
  }
  for (const d of dirs) walk(d);
  return violations;
}

function fmtScalar(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return String(val);
    if (Number.isInteger(val)) return String(val);
    const abs = Math.abs(val);
    if (abs > 0 && abs < 0.0001) return val.toExponential(2);
    return String(Number(val.toFixed(4)));
  }
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

function flattenMetrics(obj, prefix = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined || typeof v !== "object") {
      out.push([key, fmtScalar(v)]);
    } else if (Array.isArray(v)) {
      const allPrimitive = v.every((x) => x === null || typeof x !== "object");
      if (allPrimitive && v.length <= 6) {
        out.push([key, `[${v.map(fmtScalar).join(", ")}]`]);
      } else {
        out.push([key, `${v.length} item(s)`]);
      }
    } else {
      flattenMetrics(v, key, out);
    }
  }
  return out;
}

const HEADLINE_METRIC_RE =
  /(f1|recall|precision|accuracy|auc|top1|top_1|top3|median_.*err|mae|mean_us|latency|false_positive_rate|recovery_rate|attribution_rate|collision|margin|drift.*catch|caught_rate)/i;

function isNumericScalar(v) {
  return /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v);
}

function summarizeMetrics(metrics, maxItems = 3) {
  if (!metrics || typeof metrics !== "object") return "(no receipt)";
  const flat = flattenMetrics(metrics);
  if (!flat.length) return "(empty)";
  const numeric = flat.filter(([, v]) => isNumericScalar(v));
  const pool = numeric.length ? numeric : flat;

  // Prefer headline metrics spread across distinct top-level metric groups.
  const headline = pool.filter(([k]) => HEADLINE_METRIC_RE.test(k) && !/\.by_city\.|\.by_class\./i.test(k));
  const picked = [];
  const usedGroups = new Set();
  const pickFrom = (list) => {
    for (const entry of list) {
      if (picked.length >= maxItems) break;
      const group = entry[0].split(".")[0];
      if (!usedGroups.has(group)) {
        usedGroups.add(group);
        picked.push(entry);
      }
    }
    for (const entry of list) {
      if (picked.length >= maxItems) break;
      if (!picked.includes(entry)) picked.push(entry);
    }
  };
  pickFrom(headline);
  if (picked.length < maxItems) pickFrom(pool);

  return picked
    .map(([k, v]) => {
      const shortKey = k.split(".").slice(-2).join(".");
      return `${shortKey}=${v}`;
    })
    .join(", ");
}

function selectLedgerMetrics(metrics, maxRows = 36) {
  const flat = flattenMetrics(metrics);
  if (flat.length <= maxRows) return { rows: flat, omitted: 0 };
  const primary = flat.filter(([k]) => !/\.by_city\.|\.per_city\./i.test(k));
  if (primary.length <= maxRows) {
    return { rows: primary, omitted: flat.length - primary.length };
  }
  const headline = primary.filter(([k]) => HEADLINE_METRIC_RE.test(k));
  const rest = primary.filter(([k]) => !HEADLINE_METRIC_RE.test(k));
  const combined = [...headline, ...rest].slice(0, maxRows);
  return { rows: combined, omitted: flat.length - combined.length };
}

function sanitizeMd(text) {
  return String(text ?? "")
    .replace(EM_DASH_RE, " - ")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function truncate(str, maxLen) {
  const s = String(str ?? "");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 3))}...`;
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)),
  );
  const line = (cols) => cols.map((c, i) => String(c ?? "").padEnd(widths[i])).join(" | ");
  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  console.log(line(headers));
  console.log(sep);
  for (const r of rows) console.log(line(r));
}

function detectRunner(manifest, entryPath) {
  if (manifest?.runner) return manifest.runner;
  const ext = extname(entryPath).toLowerCase();
  if (ext === ".py") return "python3";
  if (ext === ".mjs" || ext === ".js") return "node";
  if (ext === ".sh") return "bash";
  return "node";
}

function cmdStatus() {
  const git = gitInfo();
  const exps = discoverTrackItems(EXPERIMENTS_DIR);
  const facts = discoverTrackItems(FACTORY_DIR);
  const kills = discoverGraveyard();
  const emDashes = scanEmDashes([LAB_DIR, join(REPO_ROOT, ".agents")]);
  const allIssues = [...exps, ...facts].flatMap((x) => x.issues);

  const receiptsCount = exps.filter((e) => e.results).length;
  console.log(`Caelus R&D Lab and Feature Factory Status (branch=${git.branch}, sha=${git.sha})`);
  console.log(
    `Experiments: ${exps.length} (${receiptsCount} with receipts) | Factory: ${facts.length} | Graveyard: ${kills.length} | Hygiene: ${
      allIssues.length === 0 && emDashes.length === 0 ? "CLEAN" : `${allIssues.length} schema, ${emDashes.length} em-dash`
    }`,
  );
  console.log("");

  console.log("EXPERIMENTS (lab/experiments/)");
  if (!exps.length) {
    console.log("  (none yet)");
  } else {
    printTable(
      ["ID", "Status", "Receipt", "Key Metrics", "Title"],
      exps.map((e) => [
        e.manifest?.id ?? e.slug,
        e.manifest?.status ?? "invalid",
        e.results ? `${e.results.status} (${String(e.results.run_at ?? "").slice(0, 10)})` : "pending",
        truncate(e.results ? summarizeMetrics(e.results.metrics, 3) : "run pending", 48),
        truncate(e.manifest?.title ?? e.slug, 44),
      ]),
    );
  }
  console.log("");

  console.log("FEATURE FACTORY QUEUE (lab/factory/)");
  if (!facts.length) {
    console.log("  (none)");
  } else {
    printTable(
      ["ID", "Status", "Stage", "Title"],
      facts.map((f) => [
        f.manifest?.id ?? f.slug,
        f.manifest?.status ?? "invalid",
        f.manifest?.stage ?? "stage-0",
        truncate(f.manifest?.title ?? f.slug, 64),
      ]),
    );
  }
  console.log("");

  console.log("GRAVEYARD ARCHIVE (lab/graveyard/)");
  if (!kills.length) {
    console.log("  (none)");
  } else {
    printTable(
      ["ID", "Date", "Title", "Verdict"],
      kills.map((k) => [
        k.id,
        k.date,
        truncate(k.title, 44),
        truncate(k.verdict, 54),
      ]),
    );
  }

  if (allIssues.length || emDashes.length) {
    console.log("");
    console.log("HYGIENE WARNINGS:");
    for (const iss of allIssues) console.log(`  [schema] ${iss}`);
    for (const v of emDashes) {
      console.log(`  [em-dash] ${v.file}:${v.line} (${v.token}) ${v.snippet}`);
    }
  }
}

function cmdCheck() {
  const exps = discoverTrackItems(EXPERIMENTS_DIR);
  const facts = discoverTrackItems(FACTORY_DIR);
  const emDashes = scanEmDashes([LAB_DIR, join(REPO_ROOT, ".agents")]);
  const allIssues = [...exps, ...facts].flatMap((x) => x.issues);

  if (allIssues.length || emDashes.length) {
    console.error(`Lab hygiene check FAILED (${allIssues.length} schema issue(s), ${emDashes.length} em-dash violation(s)):`);
    for (const iss of allIssues) console.error(`  [schema] ${iss}`);
    for (const v of emDashes) {
      console.error(`  [em-dash] ${v.file}:${v.line} (${v.token}): ${v.snippet}`);
    }
    process.exit(1);
  }

  console.log(
    `Lab hygiene check passed: ${exps.length} experiment(s), ${facts.length} factory track(s), 0 schema issues, 0 em-dash violations.`,
  );
}

function cmdRun(target) {
  if (!target) {
    console.error("Usage: node lab/scripts/lab.mjs run <id|all>");
    process.exit(1);
  }

  const allItems = [
    ...discoverTrackItems(EXPERIMENTS_DIR),
    ...discoverTrackItems(FACTORY_DIR),
  ];

  let selected = [];
  if (target.toLowerCase() === "all") {
    selected = allItems.filter((item) => typeof item.manifest?.entrypoint === "string" && item.manifest.entrypoint.length > 0);
  } else {
    const q = target.toLowerCase();
    selected = allItems.filter((item) => {
      const id = String(item.manifest?.id ?? "").toLowerCase();
      const slug = item.slug.toLowerCase();
      return id === q || slug === q || slug.startsWith(`${q}-`);
    });
  }

  if (!selected.length) {
    console.error(`No runnable lab item matched "${target}".`);
    process.exit(1);
  }

  let failures = 0;
  for (const item of selected) {
    const id = item.manifest?.id ?? item.slug;
    const ep = item.manifest?.entrypoint;
    if (!ep) {
      console.error(`${id}: manifest has no executable entrypoint.`);
      failures++;
      continue;
    }

    const entryPath = existsSync(join(item.dir, ep))
      ? join(item.dir, ep)
      : resolve(REPO_ROOT, ep);

    if (!existsSync(entryPath)) {
      console.error(`${id}: entrypoint not found at ${relative(REPO_ROOT, entryPath)}`);
      failures++;
      continue;
    }

    const runner = detectRunner(item.manifest, entryPath);
    const relEntry = relative(REPO_ROOT, entryPath);
    console.log(`\n=== Running ${id}: ${runner} ${relEntry} ===`);

    const t0 = performance.now();
    const proc = spawnSync(runner, [entryPath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 25 * 1024 * 1024,
      env: { ...process.env, LAB_EXP_DIR: item.dir },
    });
    const elapsedMs = performance.now() - t0;

    if (proc.stdout?.trim()) {
      const outLines = proc.stdout.trim().split("\n");
      const preview = outLines.slice(-12).join("\n");
      console.log(preview);
    }
    if (proc.stderr?.trim()) {
      console.error(proc.stderr.trim());
    }

    if (proc.status !== 0) {
      console.error(`FAIL ${id}: exited with code ${proc.status} in ${elapsedMs.toFixed(1)} ms`);
      failures++;
      continue;
    }

    if (!existsSync(item.resultsPath)) {
      console.error(`FAIL ${id}: script exited 0 in ${elapsedMs.toFixed(1)} ms, but did not write ${relative(REPO_ROOT, item.resultsPath)}`);
      failures++;
      continue;
    }

    const parsed = readJsonSafe(item.resultsPath);
    if (!parsed.ok) {
      console.error(`FAIL ${id}: results.json parse error (${parsed.error})`);
      failures++;
      continue;
    }

    const issues = validateResults(parsed.data, relative(REPO_ROOT, item.resultsPath));
    if (issues.length) {
      console.error(`FAIL ${id}: results.json schema issues:`);
      for (const iss of issues) console.error(`  - ${iss}`);
      failures++;
      continue;
    }

    const res = parsed.data;
    console.log(`OK ${id} (${elapsedMs.toFixed(1)} ms) | receipt=${res.status} | sha=${res.git_sha}`);
    console.log(`  Summary: ${res.summary}`);
    console.log(`  Metrics: ${summarizeMetrics(res.metrics, 6)}`);
    console.log(`  Verdict: ${res.verdict}`);
  }

  console.log(`\nRun complete: ${selected.length - failures}/${selected.length} succeeded.`);
  if (failures > 0) process.exit(1);
}

function cmdLedger() {
  const git = gitInfo();
  const exps = discoverTrackItems(EXPERIMENTS_DIR);
  const facts = discoverTrackItems(FACTORY_DIR);
  const kills = discoverGraveyard();

  const lines = [];
  lines.push("# Caelus R&D Lab and Feature Factory Ledger");
  lines.push("");
  lines.push(
    "Generated deterministically by `node lab/scripts/lab.mjs ledger` from `lab/experiments/*/manifest.json`, `results.json`, `lab/factory/*/manifest.json`, and `lab/graveyard/KILL-*.md`. Do not hand-edit metrics in this file.",
  );
  lines.push("");
  lines.push(`- **Branch**: \`${git.branch}\``);
  lines.push(`- **Git HEAD**: \`${git.sha}\``);
  lines.push(`- **Research Experiments**: ${exps.length} (${exps.filter((e) => e.results).length} with verified receipts)`);
  lines.push(`- **Feature Factory Tracks**: ${facts.length}`);
  lines.push(`- **Graveyard Kills**: ${kills.length}`);
  lines.push("");

  lines.push("## 1. Research Experiments Overview");
  lines.push("");
  if (!exps.length) {
    lines.push("No research experiments registered yet.");
  } else {
    lines.push("| ID | Title | Status | Receipt | Key Metrics | Path |");
    lines.push("|---|---|---|---|---|---|");
    for (const e of exps) {
      const m = e.manifest ?? {};
      const r = e.results;
      const receiptCell = r ? `\`${r.status}\` (${String(r.run_at ?? "").slice(0, 10)})` : "`pending`";
      const metricCell = r ? sanitizeMd(summarizeMetrics(r.metrics, 4)) : "not run";
      lines.push(
        `| \`${sanitizeMd(m.id ?? e.slug)}\` | ${sanitizeMd(m.title ?? e.slug)} | \`${sanitizeMd(m.status ?? "unknown")}\` | ${receiptCell} | ${metricCell} | \`${e.dirRel}/\` |`,
      );
    }
  }
  lines.push("");

  if (exps.length) {
    lines.push("## 2. Experiment Receipts and Razor Records");
    lines.push("");
    for (const e of exps) {
      const m = e.manifest ?? {};
      const r = e.results;
      lines.push(`### ${sanitizeMd(m.id ?? e.slug)}: ${sanitizeMd(m.title ?? e.slug)}`);
      lines.push("");
      lines.push(`- **Directory**: \`${e.dirRel}/\``);
      const chartPath = join(e.dir, "chart.svg");
      if (existsSync(chartPath)) {
        lines.push(`- **Chart**: \`${e.dirRel}/chart.svg\``);
      }
      lines.push(`- **Status**: \`${sanitizeMd(m.status ?? "unknown")}\` | **Created**: \`${sanitizeMd(m.created ?? "unknown")}\` | **Entrypoint**: \`${sanitizeMd(m.entrypoint ?? "none")}\``);
      if (Array.isArray(m.tags) && m.tags.length) {
        lines.push(`- **Tags**: ${m.tags.map((t) => `\`${sanitizeMd(t)}\``).join(", ")}`);
      }
      lines.push(`- **Hypothesis**: ${sanitizeMd(m.hypothesis)}`);
      lines.push(`- **Null Baseline**: ${sanitizeMd(m.null_baseline)}`);
      lines.push(`- **Success Bar**: ${sanitizeMd(m.success_bar)}`);
      lines.push(`- **Kill Criterion**: ${sanitizeMd(m.kill_criterion)}`);
      lines.push("");

      if (!r) {
        lines.push("Receipt status: pending execution (`node lab/scripts/lab.mjs run " + (m.id ?? e.slug) + "`).");
        lines.push("");
      } else {
        lines.push(`**Latest Receipt**: \`${sanitizeMd(r.status)}\` (run at \`${sanitizeMd(r.run_at)}\`, git SHA \`${sanitizeMd(r.git_sha)}\`)`);
        lines.push("");
        lines.push(`- **Summary**: ${sanitizeMd(r.summary)}`);
        lines.push(`- **Verdict**: ${sanitizeMd(r.verdict)}`);
        lines.push("");

        const { rows, omitted } = selectLedgerMetrics(r.metrics, 36);
        if (rows.length) {
          lines.push("| Metric | Value |");
          lines.push("|---|---|");
          for (const [k, v] of rows) {
            lines.push(`| \`${sanitizeMd(k)}\` | \`${sanitizeMd(v)}\` |`);
          }
          if (omitted > 0) {
            lines.push(`| _additional detail_ | \`${omitted} more metric entries in ${e.dirRel}/results.json\` |`);
          }
          lines.push("");
        }
      }
    }
  }

  lines.push("## 3. Feature Factory Queue");
  lines.push("");
  if (!facts.length) {
    lines.push("No Feature Factory tracks registered.");
  } else {
    lines.push("| ID | Title | Status | Stage | Dependencies | Spec |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of facts) {
      const m = f.manifest ?? {};
      const deps = Array.isArray(m.dependencies) && m.dependencies.length
        ? m.dependencies.map(sanitizeMd).join("; ")
        : "none";
      const specPath = existsSync(join(f.dir, "SPEC.md")) ? `${f.dirRel}/SPEC.md` : `${f.dirRel}/manifest.json`;
      const tuftePath = join(f.dir, "tufte-notes.md");
      const specCell = existsSync(tuftePath)
        ? `\`${specPath}\`, \`${f.dirRel}/tufte-notes.md\``
        : `\`${specPath}\``;
      lines.push(
        `| \`${sanitizeMd(m.id ?? f.slug)}\` | ${sanitizeMd(m.title ?? f.slug)} | \`${sanitizeMd(m.status ?? "unknown")}\` | \`${sanitizeMd(m.stage ?? "stage-0")}\` | ${deps} | ${specCell} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 4. Graveyard Archive (Killed Ideas)");
  lines.push("");
  if (!kills.length) {
    lines.push("No killed ideas archived yet.");
  } else {
    lines.push("| ID | Date | Title | Verdict | Postmortem |");
    lines.push("|---|---|---|---|---|");
    for (const k of kills) {
      lines.push(
        `| \`${sanitizeMd(k.id)}\` | \`${sanitizeMd(k.date)}\` | ${sanitizeMd(k.title)} | ${sanitizeMd(k.verdict)} | \`${k.fileRel}\` |`,
      );
    }
  }
  lines.push("");

  lines.push("## 5. Lab Commands");
  lines.push("");
  lines.push("```bash");
  lines.push("node lab/scripts/lab.mjs status          # Live summary tables and hygiene check");
  lines.push("node lab/scripts/lab.mjs run all         # Execute all experiments and verify results.json");
  lines.push("node lab/scripts/lab.mjs ledger          # Regenerate this file deterministically");
  lines.push("node lab/scripts/lab.mjs check           # Validate schemas and zero em-dashes");
  lines.push("node lab/scripts/lab.mjs new exp <slug>  # Scaffold a new Razor-compliant experiment");
  lines.push("node lab/scripts/lab.mjs new fact <slug> # Scaffold a new Feature Factory track");
  lines.push("```");
  lines.push("");

  const output = lines.join("\n");
  writeFileSync(LEDGER_PATH, output, "utf8");
  console.log(
    `Wrote ${relative(REPO_ROOT, LEDGER_PATH)} (${exps.length} experiments, ${facts.length} factory tracks, ${kills.length} graveyard kills).`,
  );
}

function nextId(baseDir, prefix) {
  let maxNum = 0;
  if (existsSync(baseDir)) {
    const re = new RegExp(`^${prefix}-(\\d+)`, "i");
    for (const name of readdirSync(baseDir)) {
      const m = name.match(re);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

function cmdNew(kind, slug) {
  if (!kind || !slug || !["exp", "fact"].includes(kind)) {
    console.error("Usage: node lab/scripts/lab.mjs new <exp|fact> <kebab-slug>");
    process.exit(1);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`Invalid slug "${slug}": use lowercase alphanumeric kebab-case (for example, "solar-drift-bench").`);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const titleWords = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (kind === "exp") {
    const id = nextId(EXPERIMENTS_DIR, "EXP");
    const dir = join(EXPERIMENTS_DIR, `${id}-${slug}`);
    if (existsSync(dir)) {
      console.error(`Directory already exists: ${relative(REPO_ROOT, dir)}`);
      process.exit(1);
    }
    mkdirSync(dir, { recursive: true });

    const manifest = {
      id,
      title: titleWords,
      track: "research",
      status: "queued",
      created: today,
      hypothesis: "TODO: State a falsifiable claim grounded in a specific Caelus primitive.",
      null_baseline: "TODO: Name the trivial baseline (Date.now(), sin/cos(2*pi*t/T), sha256, or semantic+LRU).",
      success_bar: "TODO: Pre-register the numeric margin over the null baseline.",
      kill_criterion: "TODO: State the exact failure or tie condition that archives this to lab/graveyard/.",
      entrypoint: "experiment.mjs",
      tags: ["research"],
    };

    const readme = `# ${id}: ${titleWords}

## Hypothesis

${manifest.hypothesis}

## Null Baseline

${manifest.null_baseline}

## Success Bar and Kill Criterion

- **Success Bar**: ${manifest.success_bar}
- **Kill Criterion**: ${manifest.kill_criterion}

## How to Run

\`\`\`bash
node lab/scripts/lab.mjs run ${id}
\`\`\`
`;

    const script = `#!/usr/bin/env node
/**
 * ${id}: ${titleWords}
 * Deterministic, zero-network benchmark script writing results.json.
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const gitSha = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

// TODO: Import built engine modules from "../../../packages/caelus/dist/src/index.js"
// and run deterministic ablation arms against the null baseline.

const results = {
  id: "${id}",
  run_at: new Date().toISOString(),
  git_sha: gitSha,
  status: "inconclusive",
  summary: "Template scaffold executed; replace with real benchmark measurements.",
  metrics: {
    baseline_score: 0,
    treatment_score: 0,
  },
  verdict: "INCONCLUSIVE: benchmark implementation pending.",
};

writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\\n", "utf8");
console.log("${id}: wrote results.json");
`;

    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    writeFileSync(join(dir, "README.md"), readme, "utf8");
    writeFileSync(join(dir, "experiment.mjs"), script, "utf8");

    console.log(`Scaffolded experiment ${id} at ${relative(REPO_ROOT, dir)}/`);
    console.log(`Next: edit manifest.json + experiment.mjs, then run "node lab/scripts/lab.mjs run ${id}".`);
    return;
  }

  // kind === "fact"
  const id = nextId(FACTORY_DIR, "FACT");
  const dir = join(FACTORY_DIR, `${id}-${slug}`);
  if (existsSync(dir)) {
    console.error(`Directory already exists: ${relative(REPO_ROOT, dir)}`);
    process.exit(1);
  }
  mkdirSync(dir, { recursive: true });

  const manifest = {
    id,
    title: titleWords,
    track: "factory",
    status: "queued",
    stage: "stage-0-spec",
    created: today,
    hypothesis: "TODO: Describe the production capability and user/agent value.",
    null_baseline: "TODO: Describe the status quo or alternative.",
    success_bar: "TODO: State exact parity, latency, and preflight acceptance gates.",
    kill_criterion: "TODO: State conditions that block promotion or cancel the track.",
    entrypoint: null,
    dependencies: [],
    tags: ["factory"],
  };

  const spec = `# ${id}: ${titleWords}

- **Factory ID**: \`${id}\`
- **Status**: \`queued\`
- **Branch Target**: \`feat/${slug}\`

## 1. Promotion Gate and Objective

State the upstream R&D Lab receipt or \`ROADMAP.md\` milestone that authorizes
this Feature Factory track.

## 2. Stage Plan (5-Stage Caelus Feature Factory)

- **Stage 1 (Python Reference + Golden)**: \`python/astroengine/...\` + \`packages/caelus/test/...-golden.json\`
- **Stage 2 (Zero-Dep TypeScript Port)**: \`packages/caelus/src/...\` (zero \`node:*\`, zero runtime deps)
- **Stage 3 (Node-Free MCP / Widgets / Docs)**: \`packages/caelus-mcp/src/core.ts\`, \`packages/widgets/\`, \`apps/web/\`, \`apps/site/\`, \`scripts/sync-facts.mjs\`
- **Stage 4 (Adversarial Verifier + Preflight)**: independent read-only audit + \`npm run test:python && npm run build && npm run preflight\`

## 3. File Ownership Map

List exact files per stage worker to avoid concurrent edits.
`;

  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, "SPEC.md"), spec, "utf8");
  console.log(`Scaffolded Feature Factory track ${id} at ${relative(REPO_ROOT, dir)}/`);
  console.log(`Next: complete SPEC.md and manifest.json, then run "node lab/scripts/lab.mjs ledger".`);
}

function cmdHelp() {
  console.log(`Caelus R&D Lab and Feature Factory CLI

Usage:
  node lab/scripts/lab.mjs status            Show experiments, factory queue, graveyard, and hygiene
  node lab/scripts/lab.mjs run <id|all>      Run experiment(s) and verify results.json receipts
  node lab/scripts/lab.mjs ledger            Deterministically regenerate lab/LEDGER.md
  node lab/scripts/lab.mjs check             Validate manifest/receipt schemas and zero em-dashes
  node lab/scripts/lab.mjs new exp <slug>    Scaffold a new Razor-compliant experiment
  node lab/scripts/lab.mjs new fact <slug>   Scaffold a new 5-stage Feature Factory track
`);
}

const [, , command, arg1, arg2] = process.argv;
switch (command) {
  case "status":
    cmdStatus();
    break;
  case "run":
    cmdRun(arg1);
    break;
  case "ledger":
    cmdLedger();
    break;
  case "check":
    cmdCheck();
    break;
  case "new":
    cmdNew(arg1, arg2);
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    cmdHelp();
    break;
  default:
    console.error(`Unknown command "${command}".`);
    cmdHelp();
    process.exit(1);
}
