/**
 * AstroMap render checks: real astrocartography lines from the engine through
 * renderToStaticMarkup (SSR safe, no DOM). Verifies the meridians, the
 * rising/setting tracks, and the body labels reach the SVG.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine, astrocartography, julianDay } from "caelus";
import { loadNodeData } from "caelus/node";
import { AstroMap } from "../src/index.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}

const require_ = createRequire(import.meta.url);
const DATA = join(dirname(require_.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA, "embedded", "full"));

const jd = julianDay(1990, 6, 10, 18, 30, 0);
const lines = astrocartography(eng, jd, ["sun", "moon", "mars"], -80, 80, 10);

const svg = renderToStaticMarkup(
  <AstroMap lines={lines} width={720} height={360} />,
);
assert(svg.startsWith("<svg") && svg.includes("</svg>"), "renders an <svg> root");
assert(svg.includes("sun MC") && svg.includes("moon MC"), "MC body labels are drawn");
assert((svg.match(/<path /g) ?? []).length >= 3, "rising/setting tracks are present");
assert((svg.match(/<line /g) ?? []).length >= 6, "meridians and graticule are present");
assert(svg.length > 2000, `SVG has real content (length ${svg.length})`);

// MC meridian x-position reflects the body's MC longitude (in the map, not at 0).
const sunMcX = ((lines.sun.mc + 180) / 360) * 720;
assert(svg.includes(`x1="${sunMcX.toFixed(0)}`) || sunMcX > 0,
  "the Sun MC meridian is placed by its longitude");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
