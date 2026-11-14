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
  "data/pluto_cheb.cpk",   // wide-range Pluto (1000-3000); supersedes Meeus in-range
  // Wide planet packs (fit_planet.py, 1000-3000, DE441 barycenters). These
  // supersede VSOP87D wherever they are present, which is the whole point:
  // Uranus and Neptune were the engine's worst bodies at the wide edges
  // (20.3" / 17.6") and read 0.145" / 0.118" through the packs.
  "data/mars_cheb.cpk",
  "data/saturn_cheb.cpk",
  "data/uranus_cheb.cpk",
  "data/neptune_cheb.cpk",
  "data/mercury_cheb.cpk",
  "data/venus_cheb.cpk",
  "data/jupiter_cheb.cpk",
  "data/earth_cheb.cpk",
  // Classical era slabs (fit_classical.py, 3000 BCE-1000 CE, DE441). The
  // loader chains them before the modern packs; missing, charts before
  // 1000 CE silently drop to "unavailable".
  "data/earth_cheb.classical.cpk",
  "data/moon_cheb.classical.cpk",
  "data/mercury_cheb.classical.cpk",
  "data/venus_cheb.classical.cpk",
  "data/mars_cheb.classical.cpk",
  "data/jupiter_cheb.classical.cpk",
  "data/saturn_cheb.classical.cpk",
  "data/uranian_kepler.json",
  "data/turbo.json",        // sample turbo pack so the turbo tier works out of the box
  "data/chiron_cheb.json",
  "data/intp_apog_cheb.json", // interpolated lunar apogee (fit_intp_apog.py)
  "data/moon_cheb.embedded.json",
  "data/moon_cheb.full.cpk",   // precise Moon, 1000-3000; binary since 0.26
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
