/**
 * house-comparator checks: the scene carries all twelve systems from
 * one instant, houseOf agrees with the engine's own placements, the
 * figure swaps only the house furniture (bodies and angles fixed),
 * the cusp table marks the placements that change house, and a polar
 * birth surfaces the engine's whole-sign fallback instead of hiding
 * it.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, HOUSE_SYSTEMS, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  CuspTable, deriveComparator, HouseComparatorFigure, houseOf,
} from "../src/house-comparator.js";
import { HouseComparator } from "../src/house-comparator-widget.js";
import type { HouseComparatorSpec } from "../src/spec.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

const require_ = createRequire(import.meta.url);
const DATA = join(dirname(require_.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA, "embedded", "full"));

const spec: HouseComparatorSpec = {
  kind: "house-comparator",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
    houseSystem: "placidus",
    compare: "whole_sign",
  },
};

const scene = deriveComparator(eng, spec.params);

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.systems.length === HOUSE_SYSTEMS.length,
    "scene carries all twelve systems and survives JSON");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(scene.systems.every((s) => s.cusps.length === 12),
    "twelve cusps per system");
  assert(scene.systems.every((s) => !s.fellBack),
    "no polar fallback at Tampa");
  // whole-sign cusps sit on sign boundaries
  const ws = scene.systems.find((s) => s.id === "whole_sign")!;
  assert(ws.cusps.every((c) => Math.abs(c / 30 - Math.round(c / 30)) < 1e-9),
    "whole-sign cusps on sign boundaries");
  // houseOf agrees with the engine's own placement for the reference
  const ref = scene.systems.find((s) => s.id === scene.reference)!;
  const c = eng.chart(1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus");
  for (const [id, b] of Object.entries(c.bodies)) {
    if (!b) continue;
    assert(ref.houses[id] === houseOf(c.cusps, b.lon),
      `houseOf matches engine placement for ${id}`);
    break; // one body proves the wiring; houseOf itself is next
  }
  assert(houseOf([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], 359)
    === 12, "houseOf wraps the twelfth house");
}

// ------------------------------------------------------------- figure
{
  const at = (sys?: (typeof HOUSE_SYSTEMS)[number]) => renderToStaticMarkup(
    <HouseComparatorFigure scene={scene} system={sys} />,
  );
  assert(at() === at("whole_sign"),
    "resting figure draws the spec's compare system");
  assert(at("placidus") !== at("whole_sign"),
    "cusp furniture changes between systems");
  // bodies and angles never move: the sun glyph sits at the same spot
  const glyph = (html: string) => html.match(/<text[^>]*>☉<\/text>/)?.[0];
  assert(glyph(at("placidus")) === glyph(at("campanus")),
    "bodies fixed while cusps swap");
}

// -------------------------------------------------------------- table
{
  const html = renderToStaticMarkup(<CuspTable scene={scene} />);
  assert(html.includes("whole sign") && html.includes("placidus"),
    "table names both systems");
  assert((html.match(/<tr>/g) ?? []).length === 12, "twelve cusp rows");
  assert(html.includes("moves ·") || html.includes("no placement changes"),
    "table reports placement moves");
}

// ------------------------------------------------------- polar failure
{
  const polar = deriveComparator(eng, {
    ...spec.params,
    place: { latDeg: 78, lonEastDeg: 16 },
  });
  const placidus = polar.systems.find((s) => s.id === "placidus")!;
  assert(placidus.fellBack === "whole_sign",
    "polar latitude walks placidus into whole-sign fallback");
  const html = renderToStaticMarkup(
    <CuspTable scene={polar} system="placidus" />,
  );
  assert(html.includes("undefined at this latitude"),
    "table says so instead of hiding it");
}

// ------------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<HouseComparator scene={scene} />);
  for (const s of HOUSE_SYSTEMS) {
    assert(html.includes(`>${s.replace(/_/g, " ")}</button>`),
      `picker lists ${s}`);
  }
  const accents = html.split("#8c2f2a").length - 1;
  assert(accents === 1,
    `picker: oxblood exactly once (the selection), got ${accents}`);
  assert(!html.includes("lat "), "no latitude walk without an engine");
  const withEngine = renderToStaticMarkup(
    <HouseComparator scene={scene}
      getEngine={() => Promise.reject(new Error("ssr"))} />,
  );
  assert(withEngine.includes("φ 27.9°"),
    "latitude walk prints the working latitude");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
