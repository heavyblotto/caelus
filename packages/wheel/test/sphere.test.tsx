/**
 * ChartSphere render checks: a real chart through renderToStaticMarkup (SSR
 * safe, no DOM), ecliptic latitude depth, smooth flattening, out-of-bounds
 * declination detection, 3D aspect chords, and linked selection hooks.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine } from "caelus";
import { loadNodeData } from "caelus/node";
import { ChartSphere } from "../src/index.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}

const require_ = createRequire(import.meta.url);
const DATA = join(dirname(require_.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA, "embedded", "full"));
const chart = eng.chart(1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus");

const svg = renderToStaticMarkup(<ChartSphere chart={chart} size={500} />);
assert(svg.startsWith("<svg") && svg.includes("</svg>"), "renders an <svg> root");
assert(svg.includes("☉") && svg.includes("☽"), "Sun and Moon glyphs are drawn");
assert((svg.match(/<path /g) ?? []).length >= 2, "great-circle ring paths are present");
assert(svg.includes("<line "), "latitude stems are present");
assert(svg.includes(">Ecliptic<") && svg.includes(">Equator<"), "direct reference circle labels present");
assert(svg.length > 2000, `SVG has real content (length ${svg.length})`);

// Ecliptic latitude must matter: flatten every body to lat 0 and the render
// changes (the Moon's ~5 deg and Pluto's ~17 deg move on the sphere).
const flat = {
  bodies: Object.fromEntries(
    Object.entries(chart.bodies).map(([k, v]) => [k, { ...v!, lat: 0 }]),
  ),
};
const svgFlat = renderToStaticMarkup(<ChartSphere chart={flat} size={500} />);
assert(svg !== svgFlat, "ecliptic latitude changes the rendering (3D, not a flat wheel)");

// Smooth projection flattening (FACT-006)
const flattened = renderToStaticMarkup(<ChartSphere chart={chart} size={500} flatten={0.8} />);
assert(flattened !== svg && !flattened.includes("NaN"), "flatten prop interpolates geometry cleanly");

// Out-of-bounds declination marker (lon 90 deg, lat +5 deg => dec ~28.4 deg > 23.44 deg)
const oobChart = { bodies: { moon: { lon: 90, lat: 5 } } };
const svgOob = renderToStaticMarkup(<ChartSphere chart={oobChart} size={420} />);
assert(svgOob.includes('data-oob="true"') && svgOob.includes("<polygon"),
  "out-of-bounds body flagged with data-oob and diamond cue");

// Linked selection & 3D aspects
const linked = renderToStaticMarkup(
  <ChartSphere chart={chart} size={500} showAspects selectedBody="sun" />,
);
assert(linked.includes('data-body="sun" data-selected="true" data-highlighted="true"'),
  "selectedBody highlights target body on sphere");
assert(linked.includes('data-dimmed="true"'), "unconnected bodies dim when selectedBody is set");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
