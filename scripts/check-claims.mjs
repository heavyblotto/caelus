/**
 * Claims linter: every numeric/factual claim in prose must match a single
 * generated source of truth. Catches the class of drift where a number copied
 * from a transient console line (golden check count, worst diff) silently moves
 * and the prose is never updated.
 *
 * Sources of truth:
 *   - conformance-stats.json: emitted by the golden suite (CAELUS_STATS_OUT).
 *     If absent, this script regenerates it by running the built suite.
 *   - packages/caelus/accuracy.json: canonical per-body accuracy table.
 *
 * Zero dependencies. Exits non-zero with a file:line report on any mismatch.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const rel = (p) => ROOT + p;

const STATS_PATH = process.env.CAELUS_STATS_OUT || rel("conformance-stats.json");
const GOLDEN_JS = rel("packages/caelus/dist/test/golden.test.js");

function loadStats() {
  // Prefer a freshly generated file over an existing one. The stats are a
  // build artifact of the golden suite (and gitignored), so a checkout that
  // ran the suite at an older check count keeps reporting the old number --
  // and every prose claim then "fails" against a stale source of truth, which
  // reads exactly like a real prose bug. Regenerating is a few seconds and is
  // what CI does anyway; only fall back to the stored file when the suite is
  // not built.
  if (existsSync(GOLDEN_JS)) {
    execFileSync("node", [GOLDEN_JS], {
      env: { ...process.env, CAELUS_STATS_OUT: STATS_PATH }, stdio: "ignore",
    });
    return JSON.parse(readFileSync(STATS_PATH, "utf8"));
  }
  if (existsSync(STATS_PATH)) return JSON.parse(readFileSync(STATS_PATH, "utf8"));
  if (!existsSync(GOLDEN_JS)) {
    console.error(
      `check-claims: no stats at ${STATS_PATH} and the golden suite is not built.\n` +
      `Run: npm run build -w caelus && CAELUS_STATS_OUT=conformance-stats.json node ${GOLDEN_JS}`,
    );
    process.exit(2);
  }
  // Regenerate stats from the built suite.
  execFileSync("node", [GOLDEN_JS], { env: { ...process.env, CAELUS_STATS_OUT: STATS_PATH }, stdio: "ignore" });
  return JSON.parse(readFileSync(STATS_PATH, "utf8"));
}

const accuracy = JSON.parse(readFileSync(rel("packages/caelus/accuracy.json"), "utf8"));

const BUNDLES_PATH = rel("bundle-sizes.json");
let bundlesCache;
function loadBundles() {
  // bundle-sizes.json is a generated artifact (gitignored, like the golden
  // stats). Regenerate when absent; needs the workspaces built + esbuild.
  if (existsSync(BUNDLES_PATH)) return JSON.parse(readFileSync(BUNDLES_PATH, "utf8"));
  execFileSync("node", [rel("scripts/bundle-sizes.mjs")], { stdio: "ignore" });
  return JSON.parse(readFileSync(BUNDLES_PATH, "utf8"));
}

// Raw data files usable as claim sources (counts that prose quotes).
const DATA_FILES = {
  fixed_stars: "packages/caelus/data/fixed_stars.json",
  fixed_stars_deep: "packages/caelus/data/fixed_stars_deep.json",
};

function resolveSource(spec, stats) {
  // spec like "stats.worst.nano_arcsec", "accuracy.<key>",
  // "bundles.embedded.gzipKb", or "data.fixed_stars.stars#keys"
  // (a terminal "#keys" counts the keys of the object at that path).
  const [root, ...path] = spec.split(".");
  let countKeys = false;
  if (path.length && path[path.length - 1].endsWith("#keys")) {
    countKeys = true;
    path[path.length - 1] = path[path.length - 1].slice(0, -"#keys".length);
  }
  let cur;
  if (root === "stats") cur = stats;
  else if (root === "accuracy") cur = accuracy;
  else if (root === "bundles") cur = (bundlesCache ??= loadBundles());
  else if (root === "data") {
    const file = DATA_FILES[path.shift()];
    if (!file) throw new Error(`unknown data source in spec: ${spec}`);
    cur = JSON.parse(readFileSync(rel(file), "utf8"));
  } else {
    throw new Error(`unknown source root: ${root}`);
  }
  for (const k of path) cur = cur?.[k];
  if (countKeys && cur && typeof cur === "object") cur = Object.keys(cur).length;
  return cur;
}

function renderValue(claim, raw) {
  let v = raw;
  if (typeof claim.round === "number" && typeof v === "number") {
    v = Number(v.toFixed(claim.round));
  }
  if (claim.format === "thousands" && typeof v === "number") {
    return v.toLocaleString("en-US");
  }
  return v;
}

const registry = JSON.parse(readFileSync(rel("scripts/claims-registry.json"), "utf8"));
const stats = loadStats();

const problems = [];

function lineOf(text, idx) {
  return text.slice(0, idx).split("\n").length;
}

/**
 * The forms prose may use for an id. Reference docs quote the literal
 * ("polich_page"), running prose hyphenates or spaces it ("Polich-Page",
 * "whole sign"); any one of them counts as naming the system.
 */
function nameVariants(id) {
  const base = String(id).toLowerCase();
  return [base, base.replaceAll("_", "-"), base.replaceAll("_", " ")];
}

/**
 * eachOf claims: the source is a list of ids, and every one must be named in
 * each file that enumerates the set. A count check alone passes a page that
 * names the wrong twelve systems, or denies shipping one that exists.
 */
function checkEachOf(claim) {
  const list = resolveSource(claim.source, stats);
  if (!Array.isArray(list) || !list.length) {
    problems.push(`[${claim.id}] source "${claim.source}" is not a non-empty list`);
    return;
  }
  for (const file of claim.appearsIn) {
    const fpath = rel(file);
    if (!existsSync(fpath)) {
      problems.push(`[${claim.id}] missing file: ${file}`);
      continue;
    }
    const hay = readFileSync(fpath, "utf8").replaceAll("**", "").toLowerCase();
    const missing = list.filter((id) => !nameVariants(id).some((n) => hay.includes(n)));
    if (missing.length) {
      problems.push(
        `[${claim.id}] ${file}: enumerates the set but never names [${missing.join(", ")}] (from ${claim.source})`,
      );
    }
  }
}

for (const claim of registry.claims) {
  if (claim.eachOf) {
    checkEachOf(claim);
    continue;
  }
  const raw = resolveSource(claim.source, stats);
  if (raw === undefined || raw === null) {
    problems.push(`[${claim.id}] source "${claim.source}" resolved to ${raw}`);
    continue;
  }
  const value = renderValue(claim, raw);
  const expected = claim.render.map((r) => r.replaceAll("{value}", String(value)));
  // A claim with a numeric "tolerance" (in source units) accepts any rendered
  // number within that distance of the raw measurement. Bundle gzip sizes need
  // it: CI pins Node 22 while laptops run newer majors, and zlib's gzip output
  // differs between Node versions (the minified bytes are identical, the
  // compressed size is not). Exact equality would make the gate depend on
  // which Node measured; counts and accuracy figures stay exact.
  const withinTolerance = (n) => Math.abs(n - raw) <= claim.tolerance;
  const shapeMatches = (template, text) => {
    const parts = template.split("{value}").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(parts.join("(\\d+(?:\\.\\d+)?)"), "g");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (withinTolerance(Number(m[1]))) return true;
    }
    return false;
  };

  // appearsIn files must contain the value AND carry no competing one.
  // competingIn files are only swept for competing values: pages that render
  // the number through a facts.ts formatter never hold the literal, and pages
  // that quote a rival project's figure would fail a presence check, but both
  // still go stale the same way when the underlying number moves.
  const scanned = [
    ...claim.appearsIn.map((file) => ({ file, requirePresent: true })),
    ...(claim.competingIn ?? []).map((file) => ({ file, requirePresent: false })),
  ];

  for (const { file, requirePresent } of scanned) {
    const fpath = rel(file);
    if (!existsSync(fpath)) {
      problems.push(`[${claim.id}] missing file: ${file}`);
      continue;
    }
    // Bold/italic markers (**) break both presence and competing matching
    // ("**thirty-five** tools" vs the "thirty-five tools" render), so scan a
    // normalized copy; line numbers stay identical.
    const text = readFileSync(fpath, "utf8").replaceAll("**", "");

    // 1. The expected rendered value must be present (any one render form).
    //    Tolerance claims accept any number within range instead of the exact
    //    rendered value.
    const present = claim.tolerance !== undefined
      ? claim.render.some((r) => shapeMatches(r, text))
      : expected.some((e) => text.includes(e));
    if (requirePresent && !present) {
      const want = claim.tolerance !== undefined
        ? `${expected.join(" | ")} ± ${claim.tolerance}`
        : `one of [${expected.join(" | ")}]`;
      problems.push(
        `[${claim.id}] ${file}: expected ${want} (from ${claim.source}=${value}) — not found`,
      );
    }

    // 2. No competing value of the same shape may appear.
    if (claim.competing) {
      const re = new RegExp(claim.competing, "g");
      let m;
      while ((m = re.exec(text)) !== null) {
        const matched = m[0];
        // The match is OK only if it is (or contains) one of the expected
        // renders, or -- for tolerance claims -- carries a number within
        // range of the measurement.
        const num = claim.tolerance !== undefined ? matched.match(/\d+(?:\.\d+)?/) : null;
        const ok = num
          ? withinTolerance(Number(num[0]))
          : expected.some((e) => matched.includes(e) || e.includes(matched));
        if (!ok) {
          problems.push(
            `[${claim.id}] ${file}:${lineOf(text, m.index)}: competing value "${matched.trim()}" — expected ${value}`,
          );
        }
      }
    }
  }
}

if (problems.length) {
  console.error("claims check FAILED:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`claims check passed (${registry.claims.length} claims, stats from ${stats.suite} suite: ${stats.checks} checks)`);
