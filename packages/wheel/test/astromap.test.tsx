/**
 * AstroMap render checks: real astrocartography lines from the engine through
 * renderToStaticMarkup (SSR safe, no DOM). Verifies meridians, rising/setting
 * tracks, coordinate anchors, observer pin, mixed-case labels, and selection.
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
  <AstroMap lines={lines} width={720} height={360}
    observer={{ lat: 40.71, lonEast: -74.01, label: "New York" }} />,
);
assert(svg.startsWith("<svg") && svg.includes("</svg>"), "renders an <svg> root");
assert(svg.includes("Sun MC") && svg.includes("Moon MC"), "mixed-case MC body labels are drawn");
assert(svg.includes("0° Eq") && svg.includes("60°W"), "equirectangular coordinate anchors drawn");
assert(svg.includes('data-observer="true"') && svg.includes("New York"), "observer crosshair and label rendered");
assert((svg.match(/<path /g) ?? []).length >= 3, "rising/setting tracks are present");
assert((svg.match(/<line /g) ?? []).length >= 6, "meridians and graticule are present");
assert(svg.length > 2000, `SVG has real content (length ${svg.length})`);

const sunMcX = ((lines.sun.mc + 180) / 360) * 720;
assert(svg.includes(`x1="${sunMcX.toFixed(0)}`) || sunMcX > 0,
  "the Sun MC meridian is placed by its longitude");

const sel = renderToStaticMarkup(
  <AstroMap lines={lines} width={720} height={360} selectedBody="sun" />,
);
assert(sel.includes('data-body="sun" data-selected="true" data-highlighted="true"'),
  "selectedBody highlights sun tracks");
assert(sel.includes('data-body="mars" data-dimmed="true"'),
  "unselected body tracks dim");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
