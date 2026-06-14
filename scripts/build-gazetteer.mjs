// Build the offline city gazetteer the playground uses for place lookup.
//
// Source: `all-the-cities` (MIT), whose data derives from GeoNames (CC BY 4.0).
// We keep cities with population >= THRESHOLD, slim each to a tuple, sort by
// population (so a name match can break ties by importance), and write a single
// static asset. The npm package is a BUILD-ONLY dependency: only this slim JSON
// ships to the browser, and it is fetched on demand (not in the main bundle).
//
// Regenerate with:  node scripts/build-gazetteer.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import cities from "all-the-cities";

const THRESHOLD = 15000; // ~24k cities; smaller birthplaces use manual lat/lon
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/web/public/gazetteer.json");

const round = (n) => Math.round(n * 1e3) / 1e3; // ~110 m, ample for tz + chart

// Sorted by population descending: array order encodes importance, so the
// runtime can rank name matches by index and we need not ship population.
const rows = cities
  .filter((c) => c.population >= THRESHOLD)
  .sort((a, b) => b.population - a.population)
  .map((c) => [
    c.name,
    c.country, // ISO-3166 alpha-2
    round(c.loc.coordinates[1]), // lat
    round(c.loc.coordinates[0]), // lon
  ]);

const payload = {
  v: 1,
  attribution:
    "City data © GeoNames (CC BY 4.0), via all-the-cities (MIT). Coordinates are city centroids; rows are ordered by population.",
  fields: ["name", "country", "lat", "lon"],
  cities: rows,
};

const json = JSON.stringify(payload);
writeFileSync(out, json);
console.log(
  `gazetteer: ${rows.length} cities (pop >= ${THRESHOLD}) -> ${out} (${(json.length / 1024).toFixed(0)} KB)`,
);
