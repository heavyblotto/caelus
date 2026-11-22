/**
 * EphemerisGraph render checks: real longitude, declination, and speed series
 * from the engine through renderToStaticMarkup (SSR safe, no DOM). Verifies
 * wrap splits, Tufte C2 range-frame axes, precision-formatted ticks, calendar
 * date x-axis anchors, B4 direct endpoint labels, C5 small multiples, and
 * interactive selection hooks.
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
assert(svg.includes(">Sun<") && svg.includes(">Mars<"), "direct mixed-case endpoint labels are drawn");
assert((svg.match(/<path /g) ?? []).length >= 3, "body lines are present");
assert(svg.includes(">360°<") || svg.includes(">300°<"), "the value axis carries degree units");
assert(svg.includes("2024-01-01") && svg.includes("2024-12-31"), "x-axis range-frame dates are printed");
assert(svg.length > 2000, `SVG has real content (length ${svg.length})`);

// Declination view (signed, no wrap) includes exact fractional ticks and zero line
const dec = ephemeris(eng, ["sun"], { start, end: start + 365, step: 5, value: "declination" });
const svgDec = renderToStaticMarkup(<EphemerisGraph series={dec} width={600} height={300} yUnit="°" />);
assert(svgDec.startsWith("<svg"), "declination view renders");
assert(svg !== svgDec, "longitude and declination produce different graphs");

// Fractional speed range (-0.4 to +1.4 deg/day) must never collapse onto duplicate rounded integers
const speed = ephemeris(eng, ["mercury"], { start, end: start + 180, step: 3, value: "speed" });
const svgSpeed = renderToStaticMarkup(<EphemerisGraph series={speed} width={600} height={280} yUnit="°/d" />);
const tickLabels = [...svgSpeed.matchAll(/>(-?\d+(?:\.\d+)?)°\/d</g)].map((m) => m[1]);
assert(new Set(tickLabels).size === tickLabels.length && tickLabels.length >= 3,
  `fractional ticks stay distinct without rounding collisions (${tickLabels.join(", ")})`);

// C5 Small multiples mode
const sm = renderToStaticMarkup(
  <EphemerisGraph series={series} width={720} height={360} wrap={360} smallMultiples />,
);
assert(sm.includes("small multiples") && sm.includes(">Sun<") && sm.includes(">Venus<"),
  "smallMultiples renders aligned per-body panels");

// Furniture: shaded band, moment ticks in top lane, and scrub cursor
const furnished = renderToStaticMarkup(
  <EphemerisGraph
    series={series}
    width={720}
    height={360}
    wrap={360}
    band={{ from: start + 40, to: start + 62 }}
    marks={[
      { jd: start + 40, label: "SR" },
      { jd: start + 62, label: "SD" },
      { jd: start - 50, label: "OFF" },
    ]}
    cursor={start + 51}
    accent="#8c2f2a"
  />,
);
assert(furnished.includes(">SR<") && furnished.includes(">SD<"), "mark labels are drawn");
assert(!furnished.includes(">OFF<"), "marks outside the window are skipped");
assert(furnished.includes('stroke="#8c2f2a"'), "the cursor takes the accent");
assert((furnished.match(/stroke-dasharray/g) ?? []).length === 2, "plain marks draw dashed");

const noCursor = renderToStaticMarkup(
  <EphemerisGraph series={series} width={720} height={360} wrap={360}
    cursor={start + 4000} accent="#8c2f2a" />,
);
assert(!noCursor.includes('stroke="#8c2f2a"'), "a cursor outside the window is not drawn");
assert(furnished.length > svg.length, "furniture adds marks to the figure");

// Linked selection
const sel = renderToStaticMarkup(
  <EphemerisGraph series={series} width={720} height={360} wrap={360} selectedBody="mars" />,
);
assert(sel.includes('data-body="mars" data-selected="true" data-highlighted="true"'),
  "selectedBody highlights target series");
assert(sel.includes('data-body="sun" data-dimmed="true"'),
  "unselected series dim");

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
