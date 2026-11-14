/** Node convenience loader. Browser apps inject EngineData themselves
 *  (bundle the JSON or fetch it) -- the core never touches the filesystem. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ChebData, EngineData, VsopSeries } from "./core.js";
import { decodePack } from "./packbin.js";

const PLANETS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn",
  "uranus", "neptune"];

export type VsopLevel = "full" | "high" | "embedded" | "micro";
export type MoonTier = "full" | "embedded" | "none";

export function loadNodeData(
  dir: string, level: VsopLevel = "embedded", moonTier: MoonTier = "full",
): EngineData {
  const j = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  // A Chebyshev pack by stem, e.g. "mars_cheb" or "moon_cheb.classical". The
  // binary form (`{stem}.cpk`, about a fifth of the size) wins over
  // `{stem}.json`; `hasPack` says whether either is on disk.
  const hasPack = (stem: string): boolean =>
    existsSync(join(dir, `${stem}.cpk`)) || existsSync(join(dir, `${stem}.json`));
  const pack = (stem: string): ChebData => {
    const bin = join(dir, `${stem}.cpk`);
    return existsSync(bin) ? decodePack(readFileSync(bin)) : j(`${stem}.json`);
  };
  const vsop: Record<string, VsopSeries> = {};
  // The npm package ships the embedded and micro VSOP tiers; full/high live
  // in the repo. Fall back per planet so "full" against the published
  // tarball loads instead of throwing ENOENT.
  for (const p of PLANETS) {
    const tiers = level === "embedded" || level === "micro" ? [level] : [level, "embedded"];
    const found = tiers.find((t) => existsSync(join(dir, `vsop87d_${p}.${t}.json`)));
    if (!found) {
      throw new Error(
        `no VSOP87D data for ${p} in ${dir} (tried ${tiers.join(", ")}); `
        + "the full/high tiers live in the caelus repo, not the npm package",
      );
    }
    vsop[p] = j(`vsop87d_${p}.${found}.json`);
  }
  const data: EngineData = {
    vsop,
    nutation: j("nutation_iau1980.json"),
    moonMeeus: j("moon_meeus47.json"),
    pluto: j("pluto_meeus37.json"),
  };
  if (hasPack("chiron_cheb")) data.chiron = pack("chiron_cheb");
  // interpolated ("natural") lunar apogee: geocentric ecliptic-of-date pack
  // minted from the engine's own precise Moon (fit_intp_apog.py).
  if (hasPack("intp_apog_cheb")) data.intpApog = pack("intp_apog_cheb");
  if (existsSync(join(dir, "uranian_kepler.json"))) {
    data.keplerPack = j("uranian_kepler.json");
  }
  if (existsSync(join(dir, "fixed_stars.json"))) {
    data.fixedStars = j("fixed_stars.json");
  }
  if (existsSync(join(dir, "fixed_stars_deep.json"))) {
    data.deepStars = j("fixed_stars_deep.json");
  }
  if (existsSync(join(dir, "constellations.json"))) {
    data.constellations = j("constellations.json");
  }
  // asteroid packs (Horizons fits): loaded when present, ~380 KB total.
  // `pluto` is optional too: when a wide-range Chebyshev pack is present it
  // supersedes the embedded Meeus ch.37 series (valid 1885-2099) above, so
  // Pluto extends past that window at full precision; see fit_pluto.py.
  // The planets mars..neptune follow the same pattern (fit_planet.py): a
  // Horizons/DE441 pack on disk supersedes their VSOP87D series, which
  // drifts to 3-17" against the modern ephemeris at the 1000/3000 edges
  // (range-expansion.md). No pack, no behaviour change.
  for (const b of ["ceres", "pallas", "juno", "vesta", "pholus", "pluto",
    "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
    if (hasPack(`${b}_cheb`)) (data.chebPacks ??= {})[b] = pack(`${b}_cheb`);
  }
  // Earth is not a chart body but it is the observer: every geocentric
  // direction is `body - earth`, so its own VSOP error is a floor under every
  // other body, amplified by 1/distance (2763 km at 2965 = 3.8" at 1 AU,
  // 10.3" at Mars's perigee). Kept out of chebPacks because it is consumed by
  // the VSOP layer rather than as a body.
  if (hasPack("earth_cheb")) data.earthPack = pack("earth_cheb");
  // Era slabs (deep-time R1): `{body}_cheb.{era}.json` beside the default
  // packs — e.g. `jupiter_cheb.classical.json` (3000 BCE–1000 CE, adjoining
  // the headline tier). Loaded when present; at compute time the slab whose
  // span covers the instant wins, the default pack first. No slab on disk,
  // no behaviour change.
  const ERA_SLABS = ["classical"];
  for (const era of ERA_SLABS) {
    for (const b of ["mercury", "venus", "mars", "jupiter", "saturn",
      "uranus", "neptune", "pluto", "ceres", "pallas", "juno", "vesta",
      "pholus"]) {
      if (hasPack(`${b}_cheb.${era}`)) {
        ((data.eraPacks ??= {})[b] ??= []).push(pack(`${b}_cheb.${era}`));
      }
    }
    if (hasPack(`earth_cheb.${era}`)) {
      (data.earthEraPacks ??= []).push(pack(`earth_cheb.${era}`));
    }
    if (hasPack(`moon_cheb.${era}`)) {
      (data.moonEraPacks ??= []).push(pack(`moon_cheb.${era}`));
    }
  }
  if (moonTier !== "none") {
    // The full tier (1000-3000) ships as a binary pack since 0.26. Earlier
    // tarballs carried only the embedded tier (1920-2080), so fall back to
    // it: a "full" request still gets the precise Moon where it exists.
    const tiers = moonTier === "full" ? ["full", "embedded"] : [moonTier];
    for (const t of tiers) {
      if (hasPack(`moon_cheb.${t}`)) { data.moonCheb = pack(`moon_cheb.${t}`); break; }
    }
  }
  return data;
}
