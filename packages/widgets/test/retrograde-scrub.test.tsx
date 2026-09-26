/**
 * retrograde-scrub checks: the scene finds the loop nearest the
 * instant (Mercury's April–May 1990 loop for the seed chart), the
 * unwrapped longitude series dips backward through it, the speed
 * series changes sign at the stations, the heliocentric track
 * interpolates, the figure shades the loop and marks SR/SD with the
 * cursor in oxblood, and the widget's rail snaps at the stations.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine, julianDay, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  deriveRetro, helioAt, restCursor, retroDatum, RetrogradeFigure,
  retroState,
} from "../src/retrograde-scrub.js";
import { RetrogradeScrub, retroStations } from "../src/retrograde-scrub-widget.js";
import type { RetrogradeScrubSpec } from "../src/spec.js";

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

const spec: RetrogradeScrubSpec = {
  kind: "retrograde-scrub",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
  },
};

const scene = deriveRetro(eng, spec.params);

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.lon.length === 361 && round.speed.length === 361,
    "scene carries the full series and survives JSON");
  assert(round.helio.length === 121, "the heliocentric track is complete");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(scene.body === "mercury", "the default body is mercury");
  // The featured loop is Mercury's April–May 1990 retrograde: about
  // 24 days, stationing in mid-Taurus.
  const span = scene.loop.sd - scene.loop.sr;
  assert(span > 18 && span < 30, `mercury's loop ≈ 24 days, got ${span}`);
  assert(scene.loop.sr > julianDay(1990, 4, 15, 0, 0, 0)
    && scene.loop.sr < julianDay(1990, 4, 29, 0, 0, 0),
    "SR lands in late April 1990");
  assert(scene.from < scene.loop.sr && scene.to > scene.loop.sd,
    "the window margins the loop");
  // The speed series changes sign across the loop.
  const at = (jd: number) => {
    const f = (jd - scene.from) / (scene.to - scene.from) * (scene.speed.length - 1);
    return scene.speed[Math.round(f)].value;
  };
  assert(at(scene.from + 1) > 0, "direct before the loop");
  assert(at((scene.loop.sr + scene.loop.sd) / 2) < 0, "retrograde inside it");
  assert(at(scene.to - 1) > 0, "direct after it");
  // The unwrapped longitude never jumps: consecutive samples stay close.
  let maxStep = 0;
  for (let k = 1; k < scene.lon.length; k++) {
    maxStep = Math.max(maxStep,
      Math.abs(scene.lon[k].value - scene.lon[k - 1].value));
  }
  assert(maxStep < 1, `the unwrapped line is continuous (max step ${maxStep}°)`);
  // The loop dips backward: longitude at SD is behind longitude at SR.
  const lonAt = (jd: number) => {
    const f = (jd - scene.from) / (scene.to - scene.from) * (scene.lon.length - 1);
    return scene.lon[Math.round(f)].value;
  };
  const dip = lonAt(scene.loop.sr) - lonAt(scene.loop.sd);
  assert(dip > 3 && dip < 20, `mercury retrogrades ≈ 5–15°, got ${dip}°`);
  assert(scene.stations.some((s) => s.kind === "retrograde")
    && scene.stations.some((s) => s.kind === "direct"),
    "both stations are inside the window");
}

// A slow body through the same derivation: Mars's loop is wider and
// the scan still brackets it.
{
  const mars = deriveRetro(eng, { ...spec.params, body: "mars" });
  const span = mars.loop.sd - mars.loop.sr;
  assert(span > 50 && span < 90, `mars's loop ≈ 72 days, got ${span}`);
  assert(mars.meanR.body > 1.3 && mars.meanR.body < 1.7,
    "mars's mean distance ≈ 1.52 AU");
  assert(Math.abs(mars.meanR.earth - 1) < 0.02, "earth's mean distance ≈ 1 AU");
}

// --------------------------------------------------------- interpolation
{
  const h = helioAt(scene, scene.helio[40].jd);
  assert(h.eL === scene.helio[40].eL && h.bL === scene.helio[40].bL,
    "helio interpolation lands exactly on a sample");
  const mid = helioAt(scene, (scene.helio[40].jd + scene.helio[41].jd) / 2);
  const want = (scene.helio[40].eR + scene.helio[41].eR) / 2;
  assert(Math.abs(mid.eR - want) < 1e-12, "mid-sample interpolates linearly");
  assert(retroState(-1) === "retrograde" && retroState(1) === "direct"
    && retroState(0.001) === "stationary", "the state words read the speed");
  assert(retroDatum(scene, restCursor(scene)).includes("°/day"),
    "the datum carries the speed");
}

// ------------------------------------------------------------- figure
{
  const at = (cursor?: number) => renderToStaticMarkup(
    <RetrogradeFigure scene={scene} cursor={cursor} />,
  );
  assert(at() === at(restCursor(scene)), "the resting figure draws the instant");
  assert(at(scene.loop.sr) !== at(scene.loop.sd),
    "the inset moves between the stations");
  const html = at();
  assert(html.includes(">SR<") && html.includes(">SD<"),
    "the stations are marked");
  assert(html.includes("#8c2f2a"), "the cursor is oxblood");
  assert(html.includes("♁") && html.includes("☉") && html.includes("☿"),
    "the inset draws earth, sun, and the body");
  assert(html.includes("loop"), "the apparatus names the loop");
  assert(html.includes("mercury"), "the legend names the body");
}

// ------------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<RetrogradeScrub scene={scene} />);
  const stations = retroStations(scene);
  assert(stations.length === scene.stations.length
    && stations.every((s) => s.t >= 0 && s.t <= 1),
    "the rail carries a snap station per station in the window");
  assert(stations.some((s) => s.label === "SR")
    && stations.some((s) => s.label === "SD"),
    "release-snap lands on the stations");
  assert(html.includes("°/day"), "the datum reads the speed");
  // Resting cursor: the instant is past the loop, so the plate rests
  // at the window's end.
  assert(restCursor(scene) === scene.to,
    "the seed instant rests at the window end");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
