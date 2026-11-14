/**
 * Pack loader: the browser-safe path to the full packs.
 *
 * A pack whose bytes match the manifest loads; a pack with one byte changed,
 * or one byte short, is refused before it is decoded; nothing is fetched that
 * was not asked for; and an engine built from the loader's output over the
 * embedded tier computes exactly the positions `loadNodeData` gives, at
 * deep-time and modern instants, because both decode the same .cpk files
 * into the same fields.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { julianDay } from "../src/core.js";
import { Engine } from "../src/chart.js";
import { embeddedData } from "../src/data-embedded.js";
import { loadNodeData } from "../src/node-loader.js";
import { decodePackHeader } from "../src/packbin.js";
import { engineCapabilities } from "../src/capabilities.js";
import {
  fetchPacks, loadPacks, mergePacks, selectPacks, PackIntegrityError,
  type PackManifest, type PackManifestEntry,
} from "../src/pack-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, "../../data");

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
};
async function rejects(run: () => Promise<unknown>): Promise<unknown> {
  try { await run(); } catch (err) { return err; }
  return null;
}

// A manifest over the packs on disk, built the way scripts/build-pack-manifest.mjs builds it.
const jdYear = (jd: number): number => 2000 + (jd - 2451545.0) / 365.25;
const packs: PackManifestEntry[] = readdirSync(DATA).filter((f) => f.endsWith(".cpk")).sort().map((file) => {
  const bytes = new Uint8Array(readFileSync(join(DATA, file)));
  const { header } = decodePackHeader(bytes);
  const [stem, tag] = file.replace(/\.cpk$/, "").split(".");
  return {
    file, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    body: stem.replace(/_cheb$/, ""),
    era: tag === undefined || tag === "full" ? "modern" : tag,
    from: Math.ceil(jdYear(header.jd0)),
    to: Math.floor(jdYear(header.jd0 + header.nseg * header.seg_days)),
  };
});
const manifest: PackManifest = { format: "caelus-pack-manifest", version: 1, packs };
ok(packs.length >= 17, `the data directory holds the binary packs (${packs.length})`);

const fetched: string[] = [];
const fromDisk = async (file: string): Promise<Uint8Array> => {
  fetched.push(file);
  return new Uint8Array(readFileSync(join(DATA, file)));
};
const files = (entries: PackManifestEntry[]): string => entries.map((e) => e.file).join(" ");

// ------------------------------------------------------------- selection
{
  const sun = selectPacks(manifest, { bodies: ["sun"] });
  ok(files(sun) === "earth_cheb.classical.cpk earth_cheb.cpk", `the Sun selects the Earth's packs (${files(sun)})`);
  const saturn = selectPacks(manifest, { bodies: ["saturn"], fromYear: -800, toYear: 0 });
  ok(files(saturn) === "earth_cheb.classical.cpk saturn_cheb.classical.cpk",
    `a planet selects its own pack and the Earth's, in the eras the years touch (${files(saturn)})`);
  const moon = selectPacks(manifest, { bodies: ["moon"], fromYear: 1500, toYear: 1600 });
  ok(files(moon) === "moon_cheb.full.cpk", `the Moon needs only its own pack (${files(moon)})`);
  const both = selectPacks(manifest, { bodies: ["mars"], fromYear: 900, toYear: 1100 });
  ok(both.length === 4, `a span across 1000 CE takes both eras (${files(both)})`);
  ok(selectPacks(manifest, { bodies: ["mean_node", "chiron"] }).length === 0, "bodies with no pack select nothing");
  ok(selectPacks(manifest, { bodies: ["jupiter"], eras: ["classical"] }).every((e) => e.era === "classical"),
    "an era filter is honoured");
}

// ------------------------------------------------------------- a matching pack loads
const wanted = selectPacks(manifest, {
  bodies: ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"],
});
let progressCalls = 0;
let lastProgress = { packsDone: 0, packsTotal: 0, bytesDone: 0, bytesTotal: 0 };
const data = await loadPacks(embeddedData, manifest, wanted, fromDisk, {
  onProgress: (p) => { progressCalls++; lastProgress = p; },
});
ok(fetched.length === wanted.length && new Set(fetched).size === wanted.length
  && fetched.every((f) => wanted.some((e) => e.file === f)),
  `fetched exactly the ${wanted.length} packs asked for, each once`);
ok(!fetched.some((f) => /uranus|neptune|pluto/.test(f)), "packs that were not asked for were not fetched");
ok(progressCalls === wanted.length && lastProgress.packsDone === wanted.length
  && lastProgress.bytesDone === lastProgress.bytesTotal
  && lastProgress.bytesTotal === wanted.reduce((s, e) => s + e.bytes, 0),
  "progress reports every pack and ends at the total");
ok(embeddedData.earthPack === undefined && embeddedData.eraPacks === undefined, "the base is left unchanged");
ok(data.earthPack !== undefined && data.earthEraPacks?.length === 1 && data.moonEraPacks?.length === 1
  && data.eraPacks?.saturn?.length === 1 && data.chebPacks?.saturn !== undefined
  && data.moonCheb !== embeddedData.moonCheb,
  "packs land in the fields loadNodeData uses");

// ------------------------------------------------------------- same answers as the Node loader
{
  const viaLoader = new Engine(data);
  const viaNode = new Engine(loadNodeData(DATA, "embedded", "full"));
  const embedded = new Engine(embeddedData);
  const instants: Array<[string, number]> = [
    ["24 Jan 76 CE", julianDay(76, 1, 24, 6, 0, 0, "julian")],
    ["1 Mar 2500 BCE", julianDay(-2499, 3, 1, 0, 0, 0, "julian")],
    ["29 Apr 410 BCE", julianDay(-409, 4, 29, 0, 0, 0, "julian")],
    ["10 Jun 1990", julianDay(1990, 6, 10, 14, 30)],
  ];
  let moved = 0;
  for (const [label, jd] of instants) {
    for (const body of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const) {
      const a = viaLoader.position(body, jd);
      const b = viaNode.position(body, jd);
      ok(a.lon === b.lon && a.lat === b.lat && a.dist === b.dist && a.speed === b.speed,
        `${body} at ${label}: loader ${a.lon} vs Node loader ${b.lon}`);
      if (a.lon !== embedded.position(body, jd).lon) moved++;
    }
  }
  ok(moved > 20, `the packs change the answer from the embedded tier (${moved} of 28 positions)`);
  const caps = engineCapabilities(viaLoader).bodies.find((b) => b.body === "saturn");
  ok(caps?.source === "chebyshev_pack" && (caps.fitted?.from ?? 0) < -2990,
    "the engine reports the loaded span");

  // A planet's pack without the Earth's is not the full tier: selectPacks adds the Earth for this reason.
  const saturnOnly = new Engine(mergePacks(embeddedData,
    await fetchPacks(manifest, packs.filter((p) => p.body === "saturn"), fromDisk)));
  const jd = instants[1][1];
  ok(saturnOnly.position("saturn", jd).lon !== viaNode.position("saturn", jd).lon,
    "Saturn's pack alone, with the Earth from the embedded series, does not match the full tier");
}

// ------------------------------------------------------------- tampering is refused
{
  const target = packs.find((p) => p.file === "saturn_cheb.classical.cpk")!;
  let decodedAfter = 0;
  const tampered = async (file: string): Promise<Uint8Array> => {
    const bytes = new Uint8Array(readFileSync(join(DATA, file)));
    bytes[bytes.length - 5] ^= 0x01; // one bit, deep in the payload
    return bytes;
  };
  const err = await rejects(() => fetchPacks(manifest, [target], tampered, { onProgress: () => { decodedAfter++; } }));
  ok(err instanceof PackIntegrityError && err.file === target.file && /SHA-256/.test(err.message),
    `one changed bit is refused (${err instanceof Error ? err.message : err})`);
  ok(decodedAfter === 0, "a refused pack is not decoded or reported as loaded");

  const short = await rejects(() => fetchPacks(manifest, [target],
    async (file) => new Uint8Array(readFileSync(join(DATA, file))).subarray(0, target.bytes - 1)));
  ok(short instanceof PackIntegrityError && /bytes/.test(short.message), "a truncated pack is refused by length");

  const buffer = await fetchPacks(manifest, [target],
    async (file) => { const b = readFileSync(join(DATA, file)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
  ok(buffer.length === 1 && buffer[0].pack.segments.length > 0, "an ArrayBuffer from fetch is accepted");
}

// ------------------------------------------------------------- only manifest entries, only plain names
{
  const calls: string[] = [];
  const spy = async (file: string): Promise<Uint8Array> => { calls.push(file); return new Uint8Array(0); };
  const stranger = { ...packs[0], file: "elsewhere.cpk" };
  ok((await rejects(() => fetchPacks(manifest, [stranger], spy))) instanceof RangeError,
    "an entry the manifest does not list is refused");
  const edited = { ...packs[0], sha256: "0".repeat(64) };
  ok((await rejects(() => fetchPacks(manifest, [edited], spy))) instanceof RangeError,
    "an entry whose hash was edited is refused");
  const escaping: PackManifest = { ...manifest, packs: [{ ...packs[0], file: "../secret.cpk" }] };
  ok((await rejects(() => fetchPacks(escaping, escaping.packs, spy))) instanceof RangeError,
    "a file name that climbs out of the directory is refused");
  ok(calls.length === 0, "none of the refused entries was fetched");
  ok((await rejects(() => fetchPacks({ format: "other" } as unknown as PackManifest, [], spy))) instanceof RangeError,
    "a manifest of another format is refused");
}

// ------------------------------------------------------------- merging twice adds nothing
{
  const again = mergePacks(data, await fetchPacks(manifest, wanted, fromDisk));
  ok(again.eraPacks?.saturn?.length === 1 && again.earthEraPacks?.length === 1 && again.moonEraPacks?.length === 1,
    "loading the same era slab twice does not duplicate it");
}

console.log(`pack-loader: ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
