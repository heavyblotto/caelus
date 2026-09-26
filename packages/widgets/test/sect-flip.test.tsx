/**
 * sect-flip checks: the seed chart is a day chart (mid-afternoon in
 * Tampa), the day and night lot sets follow the flipped formulas
 * (Fortune and Spirit swap), the sect table reads the seven classical
 * bodies in both modes, the figure puts the two lots on the wheel in
 * oxblood, and the widget's picker flips the counterfactual.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  deriveSect, restMode, sectDatum, SectFlipFigure, SectTable,
} from "../src/sect-flip.js";
import { SectFlip } from "../src/sect-flip-widget.js";
import type { SectFlipSpec } from "../src/spec.js";

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

const spec: SectFlipSpec = {
  kind: "sect-flip",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
  },
};

const scene = deriveSect(eng, spec.params);
const mod360 = (x: number): number => ((x % 360) + 360) % 360;

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.sectTable.length === 7, "scene survives JSON; seven sect rows");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(scene.day === true, "the seed chart is a day chart");
  const sun = scene.wheel.bodies.sun?.lon ?? 0;
  const moon = scene.wheel.bodies.moon?.lon ?? 0;
  const fortuneDay = mod360(scene.asc + moon - sun);
  assert(Math.abs(scene.lots.day.fortune - fortuneDay) < 1e-9,
    "day Fortune = ASC + ☽ − ☉");
  assert(Math.abs(scene.lots.night.fortune - mod360(scene.asc + sun - moon)) < 1e-9,
    "night Fortune = ASC + ☉ − ☽");
  // The flip swaps the pair: day Spirit is night Fortune.
  assert(Math.abs(scene.lots.day.spirit - scene.lots.night.fortune) < 1e-9,
    "day Spirit = night Fortune (the formulas mirror)");
  assert(Math.abs(scene.lots.night.spirit - scene.lots.day.fortune) < 1e-9,
    "night Spirit = day Fortune");
  // The sect table: the Sun is diurnal and in sect by day; Mercury
  // belongs to neither sect.
  const sunRow = scene.sectTable.find((r) => r.body === "sun");
  const mercRow = scene.sectTable.find((r) => r.body === "mercury");
  assert(sunRow?.sect === "diurnal" && sunRow.inDay === true
    && sunRow.inNight === false, "the sun reads diurnal, in by day");
  assert(mercRow?.sect === null && mercRow.inDay === null,
    "mercury carries no sect");
  assert(restMode(scene) === "day", "the plate rests at the chart's sect");
  assert(restMode({ ...scene, params: { ...scene.params, mode: "night" } })
    === "night", "the spec's mode override wins the rest state");
}

// ------------------------------------------------------------- figure
{
  const at = (mode?: "day" | "night") => renderToStaticMarkup(
    <SectFlipFigure scene={scene} mode={mode} />,
  );
  assert(at() === at("day"), "the resting figure draws the chart's sect");
  assert(at("day") !== at("night"), "the lots move under the flip");
  const html = at();
  assert(html.includes("⊕") && html.includes("⊗"),
    "both lots are on the wheel");
  assert(html.includes("#8c2f2a"), "the lots draw in oxblood");
}

// --------------------------------------------------------------- table
{
  const day = renderToStaticMarkup(<SectTable scene={scene} mode="day" />);
  assert(day.includes("diurnal") && day.includes("nocturnal"),
    "the table names the sects");
  assert(day.includes("in sect") && day.includes("out"),
    "the table reads both conditions");
  const night = renderToStaticMarkup(<SectTable scene={scene} mode="night" />);
  assert(day !== night, "the accent column follows the mode");
}

// ------------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<SectFlip scene={scene} />);
  assert(html.includes(">day</button>") && html.includes(">night</button>"),
    "the picker lists both modes");
  const datum = sectDatum(scene, "day");
  assert(datum.includes("ASC+☽−☉"), "the datum carries the day formula");
  assert(sectDatum(scene, "night").includes("counterfactual"),
    "the counterfactual mode says so");
  assert(!sectDatum(scene, "day").includes("counterfactual"),
    "the chart's own mode does not");
  assert(html.includes("⊕"), "the datum carries the lot glyphs");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
