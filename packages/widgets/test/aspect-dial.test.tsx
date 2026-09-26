/**
 * aspect-dial checks: the scene carries the pair, the aspectarian
 * (every pair within the ceiling, sorted by orb), and the next-exact
 * scan; the readout agrees with the engine's separation; the figure
 * draws the aspect furniture from the first body's place with the orb
 * arc in oxblood; the widget filters the aspectarian under the orb
 * rail and never loads an engine.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ASPECTS, Engine, separation, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  ASPECTARIAN_ORB, AspectDialFigure, DEFAULT_DIAL_ORB, deriveDial, dialDatum,
  dialReadout,
} from "../src/aspect-dial.js";
import { AspectDial } from "../src/aspect-dial-widget.js";
import type { AspectDialSpec } from "../src/spec.js";

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

const spec: AspectDialSpec = {
  kind: "aspect-dial",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
  },
};

const scene = deriveDial(eng, spec.params);

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.bodies.length >= 10 && round.aspectarian.length > 0,
    "scene carries bodies and rows and survives JSON");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(scene.pair.a === "sun" && scene.pair.b === "moon",
    "the pair defaults to Sun–Moon");
  assert(Object.keys(scene.aspects).length === 5
    && scene.orbs.conjunction === 8,
    "the five majors and their engine orbs");
  assert(
    scene.aspectarian.every((r, i, arr) =>
      Math.abs(r.orb) <= ASPECTARIAN_ORB
        && (i === 0 || Math.abs(arr[i - 1].orb) <= Math.abs(r.orb))),
    "rows within the ceiling, sorted by |orb|",
  );
  assert(scene.aspectarian.every((r) =>
    ["applying", "separating", "exact"].includes(r.phase)),
    "every row carries a phase");
  // The next-exact scan: a hit lands inside the window; a miss names
  // a real window.
  if (scene.nextExact) {
    assert(scene.nextExact.jdUt > scene.jdUt
      && scene.nextExact.jdUt <= scene.jdUt + scene.windowDays,
      "the exact hit is inside the scan window");
    assert(Object.keys(ASPECTS).includes(scene.nextExact.aspect),
      "the hit names a major aspect");
  } else {
    assert(scene.windowDays >= 30, "a miss still names the window");
  }
}

// ------------------------------------------------------------ readout
{
  const sun = scene.bodies.find((b) => b.id === "sun")!;
  const moon = scene.bodies.find((b) => b.id === "moon")!;
  const r = dialReadout(scene, moon.lon)!;
  assert(Math.abs(r.sep - separation(sun.lon, moon.lon)) < 1e-9,
    "readout separation agrees with the engine");
  // Dragging the Moon onto the Sun's trine point reads an exact trine.
  const exact = dialReadout(scene, sun.lon + 120)!;
  assert(exact.aspect === "trine" && Math.abs(exact.orb) < 1e-9,
    "dragged onto the trine point, the orb closes");
  assert(dialDatum(scene).includes("☉—☽"), "the datum names the pair");
  assert(dialDatum(scene, sun.lon + 120).includes("dragged"),
    "a dragged datum says so");
}

// ------------------------------------------------------------- figure
{
  const sunLon = scene.bodies.find((b) => b.id === "sun")!.lon;
  const at = (dragLonB?: number) => renderToStaticMarkup(
    <AspectDialFigure scene={scene} dragLonB={dragLonB} />,
  );
  const rest = at();
  assert(rest.includes("☉") && rest.includes("☽"), "the pair is drawn");
  // Furniture: five aspect glyphs, conjunction and opposition once,
  // the three two-sided aspects twice.
  for (const g of ["☌", "⚹", "□", "△", "☍"]) {
    assert(rest.includes(g), `furniture marks ${g}`);
  }
  assert(at(sunLon + 180) !== rest, "a drag re-draws the figure");
  assert(at(sunLon + 180).includes("#8c2f2a"),
    "at the exact opposition the orb arc draws (closed, but present)");
}

// ------------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<AspectDial scene={scene} />);
  assert(html.includes(`orb ≤ ${DEFAULT_DIAL_ORB}°00′`),
    "the rail label names the resting orb");
  const rows = scene.aspectarian.filter(
    (r) => Math.abs(r.orb) <= DEFAULT_DIAL_ORB,
  );
  assert(html.includes(`${rows.length} of ${scene.aspectarian.length}`),
    "the count tracks the filter");
  assert(!html.includes("reset"), "no reset affordance at rest");
  // The accent: the rail index, plus the orb arc when the resting
  // pair sits inside an orb zone.
  const r = dialReadout(scene, scene.bodies.find((b) => b.id === "moon")!.lon)!;
  const inOrb = Math.abs(r.orb) <= (scene.orbs[r.aspect] ?? 0);
  const want = 1 + (inOrb ? 1 : 0);
  const got = html.split("#8c2f2a").length - 1;
  assert(got === want, `oxblood ${want} times (rail${inOrb ? " + orb arc" : ""}), got ${got}`);
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
