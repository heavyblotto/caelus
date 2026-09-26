/**
 * wheel-anatomy checks: the scene is serializable, the figure is a
 * pure function of (scene, layers) — layers genuinely add and remove
 * marks — and the finished state (every layer on) is the ordinary
 * ChartWheel in the plate theme, byte for byte.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import { ChartWheel, PLATE_THEME } from "caelus-wheel";
import {
  deriveAnatomy, WheelAnatomyFigure,
} from "../src/wheel-anatomy.js";
import { WheelAnatomy } from "../src/wheel-anatomy-widget.js";
import { ANATOMY_LAYERS, type WheelAnatomySpec } from "../src/spec.js";

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

const spec: WheelAnatomySpec = {
  kind: "wheel-anatomy",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
    houseSystem: "placidus",
  },
};

const scene = deriveAnatomy(eng, spec.params);

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.wheel.angles.asc === scene.wheel.angles.asc,
    "scene survives a JSON round-trip");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(Object.keys(scene.wheel.bodies).length >= 10,
    "wheel payload carries the bodies");
}

// ---------------------------------------------- finished state = wheel
{
  const finished = renderToStaticMarkup(
    <WheelAnatomyFigure scene={scene} layers={[...ANATOMY_LAYERS]} size={520} />,
  );
  const wheel = renderToStaticMarkup(
    <ChartWheel chart={scene.wheel} size={520} theme={PLATE_THEME} />,
  );
  assert(finished === wheel,
    "every layer on renders the ordinary ChartWheel exactly");
  // defaults: no layers prop and no params.layers also mean all-on
  const resting = renderToStaticMarkup(<WheelAnatomyFigure scene={scene} />);
  assert(resting === wheel, "resting default is the finished wheel");
}

// --------------------------------------------------- layers add marks
{
  const at = (...layers: Array<(typeof ANATOMY_LAYERS)[number]>) =>
    renderToStaticMarkup(
      <WheelAnatomyFigure scene={scene} layers={layers} />,
    );
  const horizon = at("horizon");
  assert(horizon.includes(">AC<") && horizon.includes(">MC<"),
    "horizon layer draws the four angles");
  assert(!horizon.includes("♈"), "horizon alone has no zodiac ring");
  const zodiac = at("horizon", "zodiac");
  assert(zodiac.includes("♈") && zodiac.includes("♓"),
    "zodiac layer adds the twelve signs");
  assert(!zodiac.includes(">12<"), "no house numbers before the cusp layer");
  const houses = at("horizon", "zodiac", "houses");
  assert(houses.includes(">12<"), "cusp layer adds the house numbers");
  const bodies = at("horizon", "zodiac", "houses", "bodies");
  assert(bodies.includes("☉"), "body layer adds the glyphs");
  assert(bodies.length < at(...ANATOMY_LAYERS).length,
    "the aspect web still missing before the last layer");
}

// ----------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<WheelAnatomy scene={scene} />);
  for (const l of ANATOMY_LAYERS) {
    assert(html.includes(`>${l}</button>`), `toggle rail lists ${l}`);
  }
  assert(html.includes('aria-pressed="true"'), "toggles carry pressed state");
  assert(!html.includes("cursor:default"),
    "widget toggles are live (buttons, not labels)");

  // a spec'd resting subset renders only those layers and dims the rest
  const partial = deriveAnatomy(eng, { ...spec.params, layers: ["horizon"] });
  const rest = renderToStaticMarkup(<WheelAnatomy scene={partial} />);
  assert(rest.includes('aria-pressed="false"'),
    "resting subset leaves the other toggles off");
  assert(!rest.includes("♈"), "resting subset draws only its layers");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
