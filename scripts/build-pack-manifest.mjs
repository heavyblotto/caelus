#!/usr/bin/env node
/**
 * Publish the binary packs for the site and write their manifest.
 *
 * The full-tier packs (packages/caelus/data/*.cpk, 27 MB) are too large to
 * bundle into a page, so the site serves them as static files and a page
 * fetches the ones it needs through the engine's pack loader
 * (packages/caelus/src/pack-loader.ts). This script produces what that
 * loader reads:
 *
 *   apps/web/public/data/packs/manifest.json
 *   apps/web/public/data/packs/cpk/<stem>.<hash>.cpk
 *
 * The manifest lists each pack's file name, size, SHA-256, body, era, and
 * span in years. The loader checks every fetched pack against that hash
 * before decoding it.
 *
 * Each file is published under a name that carries the first 12 hex digits
 * of its SHA-256. A changed pack therefore gets a new URL, and the `cpk/`
 * directory can be served with a one-year immutable cache policy (set in
 * apps/web/next.config.mjs and apps/site/astro.config.mjs). The manifest
 * keeps a plain name and is revalidated.
 *
 * The output directory is generated and gitignored: the packs live in the
 * repository once, in packages/caelus/data. Both site builds serve
 * apps/web/public, so one run covers both. Runs as part of `npm run build -w
 * web` and `npm run build -w site`; needs nothing built.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "packages", "caelus", "data");
const OUT = join(ROOT, "apps", "web", "public", "data", "packs");
const FILES = "cpk";

/** Julian Day to a decimal year, as packages/caelus/src/ranges.ts does it. */
const jdYear = (jd) => 2000 + (jd - 2451545.0) / 365.25;

/** The JSON header of a CPK1 file (docs/binary-packs.md). */
function readHeader(bytes, file) {
  if (bytes.subarray(0, 4).toString("latin1") !== "CPK1") throw new Error(`${file} is not a CPK1 pack`);
  const length = bytes.readUInt32LE(4);
  return JSON.parse(bytes.subarray(8, 8 + length).toString("utf8"));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, FILES), { recursive: true });

const packs = [];
for (const name of readdirSync(DATA).filter((f) => f.endsWith(".cpk")).sort()) {
  const bytes = readFileSync(join(DATA, name));
  const header = readHeader(bytes, name);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // `{body}_cheb.cpk` is a body's modern pack and `{body}_cheb.{era}.cpk` an
  // era slab. The Moon's modern pack is named `moon_cheb.full.cpk`.
  const [stem, tag] = name.replace(/\.cpk$/, "").split(".");
  const file = `${FILES}/${stem}${tag ? `.${tag}` : ""}.${sha256.slice(0, 12)}.cpk`;
  copyFileSync(join(DATA, name), join(OUT, file));
  packs.push({
    file,
    bytes: bytes.length,
    sha256,
    body: stem.replace(/_cheb$/, ""),
    era: tag === undefined || tag === "full" ? "modern" : tag,
    from: Math.ceil(jdYear(header.jd0)),
    to: Math.floor(jdYear(header.jd0 + header.nseg * header.seg_days)),
  });
}
if (packs.length === 0) throw new Error(`no .cpk packs in ${relative(ROOT, DATA)}`);

writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify({ format: "caelus-pack-manifest", version: 1, packs }, null, 1) + "\n",
);

const total = packs.reduce((sum, p) => sum + p.bytes, 0);
console.log(
  `pack manifest: ${packs.length} packs, ${(total / 1e6).toFixed(1)} MB -> ${relative(ROOT, OUT)}`,
);
