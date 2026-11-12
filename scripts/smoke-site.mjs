#!/usr/bin/env node
/**
 * Smoke test for the Astro build of the site (apps/site), adapted from
 * scripts/smoke-web.mjs, which does the same job for the Next build.
 *
 * It serves the built site with `wrangler dev`, which runs the Worker and the
 * static assets in workerd, the runtime Cloudflare deploys to. Then it
 * BFS-crawls every page reachable from "/" and the sitemap and asserts (hard
 * failures):
 *   - every page returns 200 and is not the not-found page
 *   - every internal <a href> resolves (no dead in-site links)
 *   - the endpoints nothing links to still answer: the MCP chart widget
 *     bundle, the chart embed, robots.txt, the icon, the Open Graph image,
 *     /api/chart, /api/mcp, and the two redirects
 *   - an unknown path returns 404 with the not-found page
 *
 * With --against <url> it also crawls a running Next build and requires
 * parity: every URL that returns 200 there returns 200 here, and every
 * redirect there redirects to the same place here. That is the check to run
 * before cutting over.
 *
 * Usage:
 *   node scripts/smoke-site.mjs                        # serve apps/site/dist with wrangler, crawl
 *   node scripts/smoke-site.mjs http://host:port       # crawl an already-running server
 *   node scripts/smoke-site.mjs --against http://127.0.0.1:3000 [http://host:port]
 *
 * External links are skipped unless SMOKE_EXTERNAL=1 (smoke-web.mjs already
 * audits them, as warnings, for the same pages).
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..", "apps", "site");
const WRANGLER_CONFIG = resolve(APP_DIR, "dist", "server", "wrangler.json");

const args = process.argv.slice(2);
const againstAt = args.indexOf("--against");
const againstBase = againstAt === -1 ? null : args[againstAt + 1]?.replace(/\/$/, "");
if (againstAt !== -1) args.splice(againstAt, 2);
const providedBase = args[0]?.replace(/\/$/, "");
const CHECK_EXTERNAL = process.env.SMOKE_EXTERNAL === "1";

let failures = 0;
const warnings = [];
const fail = (msg) => { failures++; console.error(`  FAIL ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.warn(`  warn ${msg}`); };
const ok = (msg) => console.log(`  ok   ${msg}`);

/** A 200 response whose <title> is the not-found page's. */
function isSoftNotFound(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  if (!m) return false;
  return /\b404\b|could not be found|page not found|off the chart/i.test(m[1]);
}

function pickPort() {
  return 43000 + Math.floor(Math.random() * 2000);
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

/** Start `wrangler dev` on the built output and return { base, stop }. */
async function startServer() {
  if (!existsSync(WRANGLER_CONFIG)) {
    throw new Error("apps/site/dist is missing. Run `npm run build -w site` first.");
  }
  const port = pickPort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(
    "npx",
    [
      "--no-install", "wrangler", "dev", "--config", WRANGLER_CONFIG,
      "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", String(port + 2000),
      "--show-interactive-dev-session=false",
    ],
    // detached so the child gets its own process group; killing -pid reaps
    // workerd too, instead of orphaning it.
    {
      cwd: APP_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
      detached: true,
    },
  );
  let output = "";
  child.stderr.on("data", (d) => { output += d.toString(); });
  child.stdout.on("data", (d) => { output += d.toString(); });

  const kill = () => {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
  };
  const exited = once(child, "exit");
  const ready = await Promise.race([
    waitForReady(base).then((up) => (up ? "ready" : "timeout")),
    exited.then(() => "exited"),
  ]);
  if (ready !== "ready") {
    kill();
    throw new Error(`wrangler dev did not become ready (${ready}).\n${output}`);
  }
  return { base, stop: kill };
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
  // Build assets (fonts, CSS, chunks) are not routes; each framework names
  // its own, so they are neither crawled nor compared.
  if (href.startsWith("/_astro/") || href.startsWith("/_next/")) return null;
  const clean = href.split("#")[0].split("?")[0].replace(/&amp;/g, "&");
  return clean === "" ? "/" : clean;
}

/**
 * BFS from "/" and the sitemap. Returns the status (and redirect target) of
 * every internal URL seen. With `strict`, a non-200 page is a failure.
 */
async function crawl(base, { strict, label }) {
  const seen = new Set();
  const queue = ["/"];
  const pages = new Map(); // path -> { status, location, type }
  const externalLinks = new Map(); // url -> source page

  try {
    const res = await fetch(base + "/sitemap.xml");
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        try {
          queue.push(new URL(m[1]).pathname);
        } catch {}
      }
      queue.push("/sitemap.xml");
    }
  } catch {}

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    let res, body;
    try {
      res = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(20000) });
      body = await res.text();
    } catch (err) {
      if (strict) fail(`${path} -> fetch error: ${err.message}`);
      pages.set(path, { status: 0 });
      continue;
    }
    const type = (res.headers.get("content-type") || "").split(";")[0];
    const location = res.headers.get("location");
    pages.set(path, {
      status: res.status,
      type,
      location: location ? new URL(location, base).pathname : undefined,
    });

    if (res.status >= 300 && res.status < 400) continue;
    if (res.status !== 200) {
      if (strict) fail(`${path} -> ${res.status}`);
      continue;
    }
    if (type !== "text/html") continue;
    if (isSoftNotFound(body)) {
      if (strict) fail(`${path} -> 200 but rendered the not-found page (soft 404)`);
      pages.set(path, { status: 404, type });
      continue;
    }

    for (const href of extractHrefs(body)) {
      if (/^https?:\/\//i.test(href)) {
        if (!externalLinks.has(href)) externalLinks.set(href, path);
        continue;
      }
      const internal = normalizeInternal(href);
      if (internal && !seen.has(internal) && !queue.includes(internal)) queue.push(internal);
    }
  }

  console.log(`  ${label}: crawled ${seen.size} internal URLs`);
  return { pages, externalLinks };
}

/** Endpoints and behaviours no page links to. */
async function checkUnlinked(base) {
  const get = (path, init) =>
    fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(20000), ...init });

  for (const [path, label, expect] of [
    ["/embed/chart-widget.js", "MCP chart widget bundle", (b) => /\bcaelus-chart-root\b/.test(b)],
    ["/embed/chart", "standalone chart embed", (b) => !isSoftNotFound(b)],
    ["/robots.txt", "robots.txt", (b) => /Sitemap: https:\/\//.test(b)],
    ["/icon.svg", "site icon", (b) => b.includes("<svg")],
    ["/search-index.json", "search index", (b) => b.startsWith("[")],
    ["/llms.txt", "llms.txt", (b) => b.length > 0],
    ["/api/chart?date=2000-01-01T12:00:00Z&lat=51.5&lon=-0.12", "REST chart", (b) => "bodies" in JSON.parse(b)],
    ["/api/mcp", "MCP endpoint description", (b) => JSON.parse(b).tools.length > 0],
  ]) {
    try {
      const res = await get(path);
      const body = await res.text();
      if (res.status !== 200) fail(`${path} -> ${res.status}`);
      else if (!expect(body)) fail(`${path} -> 200 but not the ${label}`);
      else ok(`${path} -> 200 (${label})`);
    } catch (err) {
      fail(`${path} -> ${err.message}`);
    }
  }

  try {
    const res = await get("/opengraph-image");
    const type = res.headers.get("content-type");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (res.status !== 200 || type !== "image/png" || !isPng) {
      fail(`/opengraph-image -> ${res.status} ${type} (expected a 200 image/png)`);
    } else ok("/opengraph-image -> 200 image/png");
  } catch (err) {
    fail(`/opengraph-image -> ${err.message}`);
  }

  for (const [from, to] of [["/about", "/how-it-was-built"], ["/favicon.ico", "/icon.svg"]]) {
    const res = await get(from);
    const location = res.headers.get("location");
    const target = location ? new URL(location, base).pathname : null;
    if (res.status !== 307 || target !== to) fail(`${from} -> ${res.status} ${target} (expected 307 ${to})`);
    else ok(`${from} -> 307 ${to}`);
  }

  {
    const res = await get("/this-route-does-not-exist");
    const body = await res.text();
    if (res.status !== 404 || !isSoftNotFound(body)) {
      fail(`unknown path -> ${res.status} (expected 404 with the not-found page)`);
    } else ok("unknown path -> 404 (not-found page)");
  }

  {
    const res = await get("/api/chart?date=1700-01-01T00:00:00Z");
    if (res.status !== 400) fail(`/api/chart outside 1920-2080 -> ${res.status} (expected 400)`);
    else ok("/api/chart outside 1920-2080 -> 400");
  }

  {
    const res = await get("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const tools = res.ok ? (await res.json()).result?.tools : null;
    if (!Array.isArray(tools) || tools.length === 0) fail(`POST /api/mcp tools/list -> ${res.status}`);
    else ok(`POST /api/mcp tools/list -> ${tools.length} tools`);
  }
}

/** Every 200 and every redirect on the reference build must hold here too. */
function compare(reference, candidate) {
  let same = 0;
  for (const [path, ref] of reference) {
    const got = candidate.get(path);
    if (ref.status === 200) {
      if (!got) fail(`parity: ${path} is 200 on the reference build but was never reached here`);
      else if (got.status !== 200) fail(`parity: ${path} is 200 on the reference build, ${got.status} here`);
      else if (ref.type !== got.type) fail(`parity: ${path} is ${ref.type} on the reference build, ${got.type} here`);
      else same++;
    } else if (ref.status >= 300 && ref.status < 400) {
      if (!got || got.status < 300 || got.status >= 400 || got.location !== ref.location) {
        fail(`parity: ${path} redirects to ${ref.location} on the reference build, ${got?.status} ${got?.location ?? ""} here`);
      } else same++;
    }
  }
  const extra = [...candidate].filter(([path, got]) => got.status === 200 && !reference.has(path)).map(([p]) => p);
  ok(`parity: ${same} URLs answer the same on both builds`);
  if (extra.length) warn(`${extra.length} URL(s) are 200 here but unknown to the reference build: ${extra.slice(0, 8).join(", ")}`);
}

/**
 * The API responses must match on both builds: same status, same content
 * type, same JSON skeleton (every key, string, and their order), and the same
 * numbers.
 *
 * "The same numbers" cannot mean the same bytes. workerd and Node are both V8
 * but ship different math libraries, so Math.sin, Math.atan2, Math.exp and
 * friends round the last bit differently, and a chart computed on Cloudflare
 * differs from one computed on Node in the 14th significant digit of a few
 * values. (The engine's canonical output mode exists for callers who need
 * bit-stable results across runtimes.) Numbers are therefore compared within
 * NUMERIC_TOLERANCE, which is twelve orders of magnitude tighter than the
 * engine's validated accuracy, and the script reports how many responses were
 * byte-identical and the largest difference it saw.
 *
 * Samples: the flagship chart, both edges of the embedded 1920-2080 tier, a
 * polar latitude, defaulted coordinates, an ignored extra parameter, every
 * 400 branch (two of them dates outside the tier), and the MCP description.
 */
const API_SAMPLES = [
  "/api/chart?date=1990-06-10T14:30:00Z&lat=27.94&lon=-82.46",
  "/api/chart?date=2000-01-01T12:00:00Z&lat=51.5&lon=-0.12",
  "/api/chart?date=1920-01-01T00:00:00Z&lat=-33.87&lon=151.21",
  "/api/chart?date=2080-12-31T23:59:59Z&lat=78.22&lon=15.65",
  "/api/chart?date=2026-11-11T00:00:00Z",
  "/api/chart?date=1962-02-05T00:00:00Z&lat=27.95&lon=-82.46&foo=bar",
  "/api/chart?date=1700-01-01T00:00:00Z&lat=40.71&lon=-74.01",
  "/api/chart?date=2081-01-01T00:00:00Z&lat=40.71&lon=-74.01",
  "/api/chart?date=not-a-date",
  "/api/chart?date=2000-01-01T12:00:00Z&lat=91&lon=0",
  "/api/chart?date=2000-01-01T12:00:00Z&lat=0&lon=181",
  "/api/mcp",
];
const NUMERIC_TOLERANCE = 1e-9;
const NUMBER_RE = /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;

async function compareApi(referenceBase, base) {
  let identical = 0;
  let withinTolerance = 0;
  let worst = 0;
  for (const path of API_SAMPLES) {
    const [ref, got] = await Promise.all(
      [referenceBase, base].map(async (b) => {
        const res = await fetch(b + path, { signal: AbortSignal.timeout(20000) });
        return { status: res.status, type: (res.headers.get("content-type") || "").split(";")[0], body: await res.text() };
      }),
    );
    if (ref.status !== got.status) { fail(`api parity: ${path} is ${ref.status} on the reference build, ${got.status} here`); continue; }
    if (ref.type !== got.type) { fail(`api parity: ${path} is ${ref.type} on the reference build, ${got.type} here`); continue; }
    if (ref.body === got.body) { identical++; continue; }
    if (ref.body.replace(NUMBER_RE, "#") !== got.body.replace(NUMBER_RE, "#")) {
      fail(`api parity: ${path} differs in keys, strings, or order`);
      continue;
    }
    const a = ref.body.match(NUMBER_RE).map(Number);
    const b = got.body.match(NUMBER_RE).map(Number);
    const delta = a.reduce((max, x, i) => Math.max(max, Math.abs(x - b[i])), 0);
    worst = Math.max(worst, delta);
    if (delta > NUMERIC_TOLERANCE) fail(`api parity: ${path} numbers differ by up to ${delta}`);
    else withinTolerance++;
  }
  ok(`api parity: ${identical} of ${API_SAMPLES.length} responses byte-identical`);
  if (withinTolerance) {
    ok(`api parity: ${withinTolerance} more match in structure, with numbers equal to within ${worst.toExponential(1)} (runtime float rounding)`);
  }
}

async function checkExternal(externalLinks) {
  const jobs = [...new Map([...externalLinks].map(([url, source]) => [url.split("#")[0], [url, source]])).values()];
  console.log(`  checking ${jobs.length} external targets`);
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const [url, source] = jobs[i++];
      try {
        let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
        if ([403, 405, 501].includes(res.status)) {
          res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
        }
        if (res.status >= 400) warn(`external ${url} -> ${res.status} (linked from ${source})`);
      } catch (err) {
        warn(`external ${url} unreachable: ${err.message} (linked from ${source})`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(12, jobs.length) }, worker));
}

let stop = () => {};
try {
  let base;
  if (providedBase) {
    base = providedBase;
    if (!(await waitForReady(base, 5000))) throw new Error(`${base} is not responding`);
    console.log(`crawling provided server ${base}`);
  } else {
    const started = await startServer();
    base = started.base;
    stop = started.stop;
    console.log(`serving apps/site/dist with wrangler dev at ${base}`);
  }

  const site = await crawl(base, { strict: true, label: "site" });
  await checkUnlinked(base);

  if (againstBase) {
    if (!(await waitForReady(againstBase, 5000))) throw new Error(`${againstBase} is not responding`);
    console.log(`comparing against the reference build at ${againstBase}`);
    const reference = await crawl(againstBase, { strict: false, label: "reference" });
    // Fetch anything the reference reached that this crawl did not, so the
    // comparison reports its real status instead of "never reached".
    for (const path of reference.pages.keys()) {
      if (site.pages.has(path)) continue;
      try {
        const res = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(20000) });
        const body = await res.text();
        const type = (res.headers.get("content-type") || "").split(";")[0];
        const location = res.headers.get("location");
        const soft = res.status === 200 && type === "text/html" && isSoftNotFound(body);
        site.pages.set(path, {
          status: soft ? 404 : res.status,
          type,
          location: location ? new URL(location, base).pathname : undefined,
        });
      } catch {
        site.pages.set(path, { status: 0 });
      }
    }
    compare(reference.pages, site.pages);
    await compareApi(againstBase, base);
  }

  if (CHECK_EXTERNAL) await checkExternal(site.externalLinks);
} catch (err) {
  fail(err.message);
} finally {
  stop();
}

if (warnings.length) console.warn(`\n${warnings.length} warning(s) (non-fatal)`);
if (failures) {
  console.error(`\nsite smoke FAILED (${failures})`);
  process.exit(1);
}
console.log(`\nsite smoke passed`);
// The spawned wrangler child keeps the event loop alive; exit explicitly.
process.exit(0);
