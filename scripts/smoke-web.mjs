#!/usr/bin/env node
/**
 * Pre-merge web smoke test. `next build` proving the bundle compiles is not
 * the same as the site working: it does not catch a broken href, a link that
 * points at a route that does not exist, a soft 404, or a page that renders
 * the Next error overlay at runtime. Those are exactly the bugs that ship
 * while `build`, the unit suite, and the linters are all green.
 *
 * This boots the already-built app on a private ephemeral port, BFS-crawls
 * every page reachable from "/" and the sitemap, and asserts (hard failures):
 *   - every page returns 200 and is not the Next error/404 page
 *   - every internal <a href> resolves (no dead in-site links)
 * External links are checked and reported as warnings only -- third-party
 * rate limiting and network flakiness are not signals about this code, so they
 * never block the gate. The server it starts is torn down on exit.
 *
 * Usage:
 *   node scripts/smoke-web.mjs                 # builds nothing; starts apps/web from .next, crawls
 *   node scripts/smoke-web.mjs http://host:po  # crawl an already-running server, skip spawning
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..", "apps", "web");

const EXTERNAL_OK = process.env.SMOKE_SKIP_EXTERNAL === "1" ? false : true;
const providedBase = process.argv[2];

let failures = 0;
const warnings = [];
const fail = (msg) => { failures++; console.error(`  FAIL ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.warn(`  warn ${msg}`); };
const ok = (msg) => console.log(`  ok   ${msg}`);

/**
 * Detect a soft 404: a 200 response that actually rendered the not-found page.
 * The not-found body string ("This page could not be found") is embedded in
 * every page's RSC payload by Next's global not-found boundary, so matching it
 * in the body yields false positives on healthy pages. It only reaches the
 * <title> when the page genuinely rendered not-found, so key off the title.
 */
function isSoftNotFound(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  if (!m) return false;
  return /\b404\b|could not be found|page not found/i.test(m[1]);
}

function pickPort() {
  return 41000 + Math.floor(Math.random() * 2000);
}

async function waitForReady(base, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + "/", { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** Start `next start` and return { base, stop }. */
async function startServer() {
  const port = pickPort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(
    "npx",
    ["--no-install", "next", "start", "-H", "127.0.0.1", "-p", String(port)],
    // detached so the child gets its own process group; killing -pid reaps the
    // `next-server` worker too, instead of orphaning it (which piled up zombies).
    { cwd: APP_DIR, stdio: ["ignore", "pipe", "pipe"], env: process.env, detached: true },
  );
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.stdout.on("data", () => {});

  const exited = once(child, "exit");
  const ready = await Promise.race([
    waitForReady(base).then((up) => (up ? "ready" : "timeout")),
    exited.then(() => "exited"),
  ]);
  if (ready !== "ready") {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
    throw new Error(
      `next start did not become ready (${ready}). Did you run \`npm run build -w apps/web\` first?\n${stderr}`,
    );
  }
  const stop = () => {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
  };
  return { base, stop };
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

function normalizeInternal(href) {
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (/^https?:\/\//i.test(href)) return null;        // external, handled separately
  if (href.startsWith("//")) return null;             // protocol-relative external
  if (!href.startsWith("/")) return null;             // relative fragments we don't crawl
  const clean = href.split("#")[0].split("?")[0];
  return clean === "" ? "/" : clean;
}

async function crawl(base) {
  const seen = new Set();
  const queue = ["/"];

  // Seed from sitemap if present.
  try {
    const res = await fetch(base + "/sitemap.xml");
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        try {
          const u = new URL(m[1]);
          queue.push(u.pathname);
        } catch {}
      }
      ok("sitemap.xml parsed for route seeds");
    }
  } catch {}

  const externalLinks = new Map(); // url -> source page
  const pageStatuses = new Map();

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    let res, body;
    try {
      res = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      body = await res.text();
    } catch (err) {
      fail(`${path} -> fetch error: ${err.message}`);
      continue;
    }
    pageStatuses.set(path, res.status);

    if (res.status >= 300 && res.status < 400) {
      // redirect target; record but don't treat as failure
      continue;
    }
    if (res.status !== 200) {
      fail(`${path} -> ${res.status}`);
      continue;
    }
    if (isSoftNotFound(body)) {
      fail(`${path} -> 200 but rendered the not-found page (soft 404)`);
      continue;
    }

    // Only follow links from HTML documents.
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("text/html")) continue;

    for (const href of extractHrefs(body)) {
      if (/^https?:\/\//i.test(href)) {
        if (!externalLinks.has(href)) externalLinks.set(href, path);
        continue;
      }
      const internal = normalizeInternal(href);
      if (internal && !seen.has(internal) && !queue.includes(internal)) {
        queue.push(internal);
      }
    }
  }

  console.log(`  crawled ${seen.size} internal routes`);
  return { externalLinks, count: seen.size };
}

/**
 * Collapse the typedoc-generated source permalinks
 * (github.com/<owner>/<repo>/blob/<sha>/...#L) to one representative check per
 * commit: they all share a single SHA, so one resolving proves the rest do.
 * Every other URL is checked individually so an authored typo still fails.
 */
function dedupeKey(url) {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([0-9a-f]{7,40})\//i);
  if (m) return `gh-blob:${m[1]}/${m[2]}@${m[3]}`;
  return url.split("#")[0];
}

async function checkOne(url, source) {
  // External liveness is reported but never fails the gate: the network and
  // third-party rate limiting (GitHub/npm return 403/404/429 to bots) are not
  // signals about this codebase, and a merge gate that flakes on them is worse
  // than no gate. Internal routes and links are the deterministic, code-owned
  // checks that block. Run `npm run smoke:web` manually to audit the warnings.
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    }
    if (res.status === 404 || res.status === 410) {
      warn(`external ${url} -> ${res.status} (linked from ${source}); verify it is not a typo (third parties also 404 bots)`);
    } else if (res.status >= 400) {
      warn(`external ${url} -> ${res.status} (linked from ${source}); often bot-blocking, verify manually`);
    } else {
      ok(`external ${url} -> ${res.status}`);
    }
  } catch (err) {
    warn(`external ${url} unreachable: ${err.message} (linked from ${source})`);
  }
}

async function checkExternal(externalLinks) {
  if (!EXTERNAL_OK) { warn("external link check skipped (SMOKE_SKIP_EXTERNAL=1)"); return; }

  // One representative URL per dedupe key.
  const byKey = new Map();
  for (const [url, source] of externalLinks) {
    const key = dedupeKey(url);
    if (!byKey.has(key)) byKey.set(key, [url, source]);
  }
  const jobs = [...byKey.values()];
  console.log(`  checking ${jobs.length} unique external targets (${externalLinks.size} links collapsed)`);

  // Bounded concurrency.
  const CONCURRENCY = 12;
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const [url, source] = jobs[i++];
      await checkOne(url, source);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
}

let stop = () => {};
try {
  let base;
  if (providedBase) {
    base = providedBase.replace(/\/$/, "");
    if (!(await waitForReady(base, 5000))) throw new Error(`${base} is not responding`);
    console.log(`crawling provided server ${base}`);
  } else {
    const started = await startServer();
    base = started.base;
    stop = started.stop;
    console.log(`started built app at ${base}`);
  }

  const { externalLinks } = await crawl(base);

  // The MCP chart widget loads /embed/chart-widget.js directly (the caelus-mcp
  // ui://widget/chart.html resource points at it); /embed/chart is the
  // standalone browser fallback. Neither is linked from nav, so assert both.
  for (const [path, label, expectJs] of [
    ["/embed/chart-widget.js", "MCP chart widget bundle", true],
    ["/embed/chart", "standalone chart embed", false],
  ]) {
    try {
      const res = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      if (res.status !== 200) { fail(`${path} -> ${res.status}`); continue; }
      if (!expectJs && isSoftNotFound(body)) { fail(`${path} -> 200 but rendered the not-found page`); continue; }
      if (expectJs && !/\bcaelus-chart-root\b/.test(body)) { fail(`${path} -> 200 but not the widget bundle`); continue; }
      ok(`${path} -> 200 (${label})`);
    } catch (err) {
      fail(`${path} -> fetch error: ${err.message}`);
    }
  }

  await checkExternal(externalLinks);
} catch (err) {
  fail(err.message);
} finally {
  stop();
}

if (warnings.length) console.warn(`\n${warnings.length} warning(s) (non-fatal)`);
if (failures) {
  console.error(`\nweb smoke FAILED (${failures})`);
  process.exit(1);
}
console.log(`\nweb smoke passed`);
// The spawned `next start` child keeps the event loop alive; exit explicitly.
process.exit(0);
