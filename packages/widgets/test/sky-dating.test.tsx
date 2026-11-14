/**
 * sky-dating checks: the form's state becomes the right constraints, a
 * sliced search equals one direct dateSky call (slicing must not add, drop,
 * or split a window), spans cut by a slice boundary are stitched back, the
 * stamps use the calendar that was in use, the generated call is the call
 * that was run, and the instrument renders its Workbench tiles at rest.
 *
 * Full packs: a query selects only the packs its bodies and years need, the
 * store fetches each once through the engine's verifying loader, a search on
 * the store's engine equals one on the Node loader's, and a pack altered in
 * transit stops the load.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, dateSky, decodePackHeader, julianDay, type PackManifest } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { loadNodeData } from "caelus/node";
import {
  buildConstraints, callSource, eraYear, foldSlice, jdOfYear, megabytes, mergeSpans,
  packBytes, packsForQuery, PackStore, queryBodies,
  searchSky, signDegree, signsAt, SKY_PRESETS, stampOf, windowText,
  type PackResponse, type PackSource, type SkyQuery, type SkySearch,
} from "../src/sky-dating.js";
import { SkyDating } from "../src/sky-dating-widget.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

// The instrument runs on the embedded tier in the browser, so the tests do too.
const eng = new Engine(embeddedData);
const babylon = SKY_PRESETS.find((p) => p.id === "babylon")!.query;
const hadrian = SKY_PRESETS.find((p) => p.id === "hadrian")!.query;

// constraints
{
  const c = buildConstraints(babylon);
  assert(c.length === 4, "babylon preset: four constraints");
  assert(JSON.stringify(c[0]) === JSON.stringify({ body: "saturn", sign: "Cancer" }),
    "constraints follow the form's order, slowest first");
  const withPhase = buildConstraints({ ...babylon, phase: "full" });
  assert(JSON.stringify(withPhase[4]) === JSON.stringify({ elongation: ["moon", "sun"], from: 157.5, to: 202.5 }),
    "a phase is an elongation arc of the Moon from the Sun");
  assert(buildConstraints({ ...babylon, signs: {}, phase: null }).length === 0, "nothing set, no constraints");
}

// a sliced search equals one direct call
const immediate = (): Promise<void> => Promise.resolve();
{
  const direct = dateSky(eng, buildConstraints(babylon),
    jdOfYear(babylon.startYear), jdOfYear(babylon.endYear + 1), { keepStages: true });
  for (const sliceYears of [50, 137, 250, 5000]) {
    const s = await searchSky(eng, babylon, { sliceYears, yieldFn: immediate });
    assert(s.done && s.windows.length === direct.windows.length,
      `slices of ${sliceYears} y: ${s.windows.length} windows vs ${direct.windows.length}`);
    for (let i = 0; i < Math.min(s.windows.length, direct.windows.length); i++) {
      assert(Math.abs(s.windows[i][0] - direct.windows[i].start) < 1e-6
        && Math.abs(s.windows[i][1] - direct.windows[i].end) < 1e-6,
        `slices of ${sliceYears} y: window ${i} edges`);
    }
    for (let i = 0; i < direct.funnel.length; i++) {
      assert(s.stages[i].constraint === direct.funnel[i].constraint
        && s.stages[i].spans.length === direct.funnel[i].windows,
        `slices of ${sliceYears} y: stage ${i} has ${s.stages[i].spans.length} spans vs ${direct.funnel[i].windows}`);
      assert(Math.abs(s.stages[i].days - direct.funnel[i].days) < 1e-4, `slices of ${sliceYears} y: stage ${i} days`);
    }
  }
  // the accepted date is inside the 410 BCE window
  const born = julianDay(-409, 4, 29, 18, 0, 0, "julian");
  const s = await searchSky(eng, babylon, { yieldFn: immediate });
  assert(s.windows.some(([a, b]) => a <= born && born <= b), "babylon: 29 April 410 BCE is inside a window");
}

// progress and cancellation
{
  let calls = 0;
  let lastDone = 0;
  const s = await searchSky(eng, babylon, {
    sliceYears: 100, yieldFn: immediate,
    onProgress: (x) => { calls++; assert(x.jdDone > lastDone, "progress moves forward"); lastDone = x.jdDone; },
  });
  assert(calls === 8 && s.done, `eight slices of 100 years report eight times (${calls})`);
  let n = 0;
  const cut = await searchSky(eng, babylon, {
    sliceYears: 100, yieldFn: immediate, cancelled: () => ++n > 3,
  });
  assert(!cut.done && cut.jdDone < cut.jdEnd, "a cancelled search stops partway and says so");
  const empty = await searchSky(eng, { ...babylon, signs: {}, phase: null }, { yieldFn: immediate });
  assert(empty.done && empty.windows.length === 0, "no constraints: finished and empty");
}

// the Hadrian preset on the embedded tier finds 24 January 76 CE
{
  const q: SkyQuery = { ...hadrian, startYear: -200, endYear: 400 };
  const s = await searchSky(eng, q, { yieldFn: immediate });
  const born = julianDay(76, 1, 24, 6, 0, 0, "julian");
  assert(s.windows.length === 1 && s.windows[0][0] <= born && born <= s.windows[0][1],
    `hadrian: one window in 600 years, holding 24 January 76 CE (${s.windows.length})`);
  assert(windowText(s.windows[0][0], s.windows[0][1]) === "24 to 26 Jan 76 CE", `hadrian window text: ${windowText(s.windows[0][0], s.windows[0][1])}`);
}

// stitching
{
  assert(JSON.stringify(mergeSpans([[1, 2], [2, 3], [5, 6]])) === "[[1,3],[5,6]]", "spans that meet are joined");
  assert(JSON.stringify(mergeSpans([[1, 2], [3, 4]])) === "[[1,2],[3,4]]", "spans that do not meet are kept apart");
  const acc: SkySearch = { jdStart: 0, jdEnd: 20, jdDone: 10, done: false, windows: [[8, 10]],
    stages: [{ constraint: 0, label: "x", spans: [[8, 10]], days: 2 }] };
  const next = foldSlice(acc, { windows: [], truncated: false,
    funnel: [{ constraint: 0, label: "x", windows: 1, days: 3, spans: [[10, 13]] }] }, 20);
  assert(JSON.stringify(next.windows) === "[[8,13]]" && next.stages[0].days === 5 && next.done,
    "a window cut by a slice boundary comes back whole");
}

// stamps and text
{
  const a = stampOf(julianDay(-409, 4, 16, 16, 30, 0, "julian"));
  assert(a.calendar === "julian" && a.text === "16 Apr 410 BCE" && a.ut === "16:30", `julian stamp: ${JSON.stringify(a)}`);
  const b = stampOf(julianDay(2026, 11, 11, 23, 59, 50));
  assert(b.calendar === "gregorian" && b.text === "12 Nov 2026 CE" && b.ut === "00:00", `rounding rolls into the next day: ${JSON.stringify(b)}`);
  assert(eraYear(0) === "1 BCE" && eraYear(1) === "1 CE" && eraYear(-2998) === "2999 BCE", "era years");
  assert(signDegree(46.6) === "16°36′" && signDegree(59.9999) === "30°00′", "sign degrees");
  assert(windowText(julianDay(2020, 1, 30), julianDay(2020, 2, 2)) === "30 Jan 2020 CE to 2 Feb 2020 CE", "a window across a month names both");
  const now = signsAt(eng, julianDay(2026, 11, 12, 2, 0, 0));
  assert(now.sun === 7 && now.moon === 8, `signsAt: Sun in Scorpio, Moon in Sagittarius (${now.sun}, ${now.moon})`);
}

// the generated call
{
  const src = callSource(hadrian);
  assert(src.includes('{ body: "saturn", sign: "Capricorn" },') && src.includes("{ pad: 6 }"), "call lists the constraints and the pad");
  assert(src.includes('julianDay(-2998, 1, 1, 0, 0, 0, "julian"), julianDay(2999, 1, 1)'), "call uses the Julian calendar before 1583");
  assert(!callSource(babylon).includes("pad:"), "no options object when nothing is set");
}

// ---------------------------------------------------------------- full packs
// A manifest over the packs in packages/caelus/data, as build-pack-manifest.mjs
// writes it, and a fetch that serves it and them from disk.
const DATA = join(dirname(fileURLToPath(import.meta.url)), "../../../caelus/data");
const jdYear = (jd: number): number => 2000 + (jd - 2451545.0) / 365.25;
const manifest: PackManifest = {
  format: "caelus-pack-manifest", version: 1,
  packs: readdirSync(DATA).filter((f) => f.endsWith(".cpk")).sort().map((name) => {
    const bytes = new Uint8Array(readFileSync(join(DATA, name)));
    const { header } = decodePackHeader(bytes);
    const [stem, tag] = name.replace(/\.cpk$/, "").split(".");
    return {
      file: `cpk/${name}`, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      body: stem.replace(/_cheb$/, ""), era: tag === undefined || tag === "full" ? "modern" : tag,
      from: Math.ceil(jdYear(header.jd0)), to: Math.floor(jdYear(header.jd0 + header.nseg * header.seg_days)),
    };
  }),
};
function diskSource(tamper?: (url: string, bytes: Uint8Array) => void): PackSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    manifestUrl: "/data/packs/manifest.json",
    fetch: async (url: string): Promise<PackResponse> => {
      calls.push(url);
      if (url === "/data/packs/manifest.json") return new Response(JSON.stringify(manifest));
      if (!url.startsWith("/data/packs/cpk/")) return new Response("", { status: 404 });
      const bytes = new Uint8Array(readFileSync(join(DATA, url.slice("/data/packs/cpk/".length))));
      tamper?.(url, bytes);
      return new Response(bytes);
    },
  };
}
const names = (q: SkyQuery): string =>
  packsForQuery(manifest, q).map((e) => e.file.slice(4).replace(/_cheb|\.cpk/g, "")).join(" ");

// what a query needs
{
  assert(queryBodies(babylon).join(" ") === "saturn jupiter mars venus", "the Babylonian preset constrains four planets");
  assert(names(babylon) === "earth.classical jupiter.classical mars.classical saturn.classical venus.classical",
    `four planets before 1 CE: their classical packs and the Earth's (${names(babylon)})`);
  const all = packsForQuery(manifest, hadrian);
  assert(all.length === 14 && !all.some((e) => /uranus|neptune|pluto/.test(e.file)),
    `the Hadrian preset, seven bodies across both eras: 14 packs (${all.length})`);
  assert(names({ ...babylon, signs: {}, phase: "full", startYear: 1900, endYear: 2000 }) === "earth moon.full",
    "a lunar phase alone needs the Moon and, for the Sun, the Earth");
  assert(packsForQuery(manifest, { ...babylon, signs: {}, phase: null }).length === 0, "nothing set, nothing to fetch");
  assert(megabytes(packBytes(packsForQuery(manifest, babylon))) === "4.2 MB",
    `the Babylonian preset's packs are ${megabytes(packBytes(packsForQuery(manifest, babylon)))}`);
  assert(megabytes(4_240_000) === "4.2 MB" && megabytes(0) === "0.0 MB", "megabytes");
}

// the store fetches once, verifies, and matches the Node loader
{
  const source = diskSource();
  const store = new PackStore(source, embeddedData);
  const list = await store.manifest();
  await store.manifest();
  assert(source.calls.length === 1, "the manifest is fetched once");
  const needed = packsForQuery(list, babylon);
  assert(store.missing(needed).length === 5, "nothing is held before the first load");

  const seen: number[] = [];
  const full = await store.engineFor(list, needed, (p) => seen.push(p.bytesDone));
  assert(source.calls.length === 6 && source.calls.slice(1).every((u) => /classical/.test(u)),
    `only the five packs the query needs were fetched (${source.calls.length - 1})`);
  assert(seen[0] === 0 && seen[seen.length - 1] === packBytes(needed)
    && seen.every((b, i) => i === 0 || b >= seen[i - 1]), "progress runs from nothing to the total");
  assert(store.missing(needed).length === 0, "the packs are held after the load");
  assert(await store.engineFor(list, needed) === full && source.calls.length === 6,
    "a second request reuses the engine and fetches nothing");

  const node = new Engine(loadNodeData(DATA, "embedded", "full"));
  const a = await searchSky(full, babylon, { yieldFn: immediate });
  const b = await searchSky(node, babylon, { yieldFn: immediate });
  assert(a.windows.length === b.windows.length && a.windows.length === 3
    && a.windows.every(([s, e], i) => s === b.windows[i][0] && e === b.windows[i][1]),
    "a search on the fetched packs returns the Node loader's windows exactly");
  const emb = await searchSky(eng, babylon, { yieldFn: immediate });
  assert(emb.windows.length === 3 && emb.windows.some(([s], i) => s !== a.windows[i][0]),
    "the embedded tier finds the same windows with different edges");

  // a wider query fetches only what is new
  const wider = packsForQuery(list, { ...babylon, startYear: -800, endYear: 1200 });
  await store.engineFor(list, wider);
  assert(source.calls.length === 6 + 5, `widening the span past 1000 CE fetched the five modern packs (${source.calls.length - 6})`);
}

// a pack altered in transit stops the load
{
  const source = diskSource((url, bytes) => { if (url.includes("saturn")) bytes[bytes.length - 9] ^= 0x10; });
  const store = new PackStore(source, embeddedData);
  const list = await store.manifest();
  let message = "";
  try {
    await store.engineFor(list, packsForQuery(list, babylon));
  } catch (err) {
    message = (err as Error).message;
  }
  assert(/saturn/.test(message) && /SHA-256/.test(message), `an altered pack is refused (${message})`);
}

// a failed manifest fetch is reported and retried
{
  let fail = true;
  const source = diskSource();
  const inner = source.fetch;
  source.fetch = async (url) => (fail && url.endsWith("manifest.json") ? new Response("", { status: 503 }) : inner(url));
  const store = new PackStore(source, embeddedData);
  let message = "";
  try { await store.manifest(); } catch (err) { message = (err as Error).message; }
  assert(/503/.test(message), "a manifest that fails to load says so");
  fail = false;
  assert((await store.manifest()).packs.length === manifest.packs.length, "and the next attempt retries");
}

// the call tile on the full tier
{
  const src = callSource(babylon, "full");
  assert(src.includes("loadPacks(embeddedData, manifest, packs,") && src.includes('const base = "/data/packs/";')
    && src.includes('bodies: ["saturn", "jupiter", "mars", "venus"],') && src.includes("fromYear: -800, toYear: 0,"),
    "on the full tier the call shows the loader in front of the search");
  assert(!callSource(babylon).includes("loadPacks"), "on the embedded tier it does not");
}

// the instrument at rest
{
  const withPacks = renderToStaticMarkup(<SkyDating engine={eng} packs={diskSource()} />);
  assert(withPacks.includes('id="sd-tier"') && withPacks.includes("Full packs, downloaded")
    && withPacks.includes("embedded tier"), "with a pack source the form offers the two tiers, embedded first");
  const html = renderToStaticMarkup(<SkyDating engine={eng} />);
  assert(!html.includes('id="sd-tier"'), "without a pack source there is no tier control");
  for (const id of ["IN", "OUT", "TBL", "CUT", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(html.includes(`<b>${id}</b>`), `tile ${id} renders`);
  }
  assert(html.includes("Instrument I-01") && html.includes("<h1>Sky dating</h1>"), "title tile");
  assert((html.match(/>Aries<\/option>/g) ?? []).length === 7
    && (html.match(/>Pisces<\/option>/g) ?? []).length === 7, "seven bodies offer the twelve signs");
  assert(html.includes("4 set"), "the default preset sets four constraints");
  assert(html.includes('sign: &quot;Cancer&quot;'), "the call tile shows the default query");
  assert(!/style="[^"]*(gradient|shadow|radius)/.test(html), "no inline decoration");
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
