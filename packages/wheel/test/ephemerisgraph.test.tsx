/**
 * EphemerisGraph render checks: a real longitude series from the engine through
 * renderToStaticMarkup (SSR safe, no DOM). Verifies the lines, the wrap split,
 * the legend, and the value axis.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine, ephemeris, julianDay } from "caelus";
import { loadNodeData } from "caelus/node";
import { EphemerisGraph } from "../src/index.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { failures++; console.error(`FAIL ${msg}`); }
}

const require_ = createRequire(import.meta.url);
const DATA = join(dirname(require_.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA, "embedded", "full"));

const start = julianDay(2024, 1, 1, 0, 0, 0);
const series = ephemeris(eng, ["sun", "venus", "mars"],
  { start, end: start + 365, step: 5 });

const svg = renderToStaticMarkup(
  <EphemerisGraph series={series} width={720} height={360} wrap={360} />,
);
assert(svg.startsWith("<svg") && svg.includes("</svg>"), "renders an <svg> root");
assert(svg.includes(">sun<") && svg.includes(">mars<"), "legend labels are drawn");
assert((svg.match(/<path /g) ?? []).length >= 3, "body lines are present");
assert(svg.includes(">360<") || svg.includes(">300<"), "the value axis is labelled");
assert(svg.length > 2000, `SVG has real content (length ${svg.length})`);

// The Sun's longitude wraps once over a year, so its line splits into >= 2
// segments; with no wrap set it would be a single jagged path. Confirm the
// declination view (no wrap) renders straight without erroring.
const dec = ephemeris(eng, ["sun"], { start, end: start + 365, step: 5, value: "declination" });
const svgDec = renderToStaticMarkup(<EphemerisGraph series={dec} width={600} height={300} />);
assert(svgDec.startsWith("<svg"), "declination view renders");
assert(svg !== svgDec, "longitude and declination produce different graphs");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
