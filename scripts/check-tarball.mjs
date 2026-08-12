#!/usr/bin/env node
// The npm tarball must contain every data pack the docs advertise. The
// asteroid, Uranian, and wide-Pluto packs were "shipped" in the repo for
// two releases while the published package lacked them — node-loader's
// existsSync guards made the gap silent: installed consumers (including the
// hosted MCP server) simply couldn't compute the advertised bodies.
import { execFileSync } from "node:child_process";

// Advertised on llms.txt + packages/caelus/README.md ("on request" bodies)
// and loaded by src/node-loader.ts when present.
const REQUIRED = [
  "data/ceres_cheb.json",
  "data/pallas_cheb.json",
  "data/juno_cheb.json",
  "data/vesta_cheb.json",
  "data/pholus_cheb.json",
  "data/pluto_cheb.json",   // wide-range Pluto (1700-2212); supersedes Meeus in-range
  "data/uranian_kepler.json",
  "data/turbo.json",        // sample turbo pack so the turbo tier works out of the box
  "data/chiron_cheb.json",
  "data/moon_cheb.embedded.json",
  "data/fixed_stars.json",
  "data/fixed_stars_deep.json",
  "data/constellations.json",
  "data/nutation_iau1980.json",
  "data/moon_meeus47.json",
  "data/pluto_meeus37.json",
];

const out = execFileSync(
  "npm",
  ["pack", "--dry-run", "--json", "-w", "caelus"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const [report] = JSON.parse(out);
const shipped = new Set(report.files.map((f) => f.path));

const missing = REQUIRED.filter((f) => !shipped.has(f));
if (missing.length) {
  console.error("npm tarball is missing advertised data packs:");
  for (const f of missing) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `check-tarball: all ${REQUIRED.length} advertised data packs in the caelus tarball ` +
    `(${(report.unpackedSize / 1e6).toFixed(1)} MB unpacked)`,
);
