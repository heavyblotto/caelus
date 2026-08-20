/**
 * Derivation widget checks: the scene's two position paths agree (the
 * coordinate handoff is free by construction), the figure is a
 * deterministic pure function of (scene, t), every station renders
 * clean SVG, t = 1 is the standard ChartWheel, and the settle really
 * does land the Ascendant at the left edge (handedness, verified
 * numerically rather than asserted).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine, dirFromAzAlt, unitVector, VERSION, type Vec3 } from "caelus";
import { loadNodeData } from "caelus/node";
import {
  deriveScene, DerivationFigure, ChartDerivation, DERIVATION_STATIONS,
} from "../src/derivation.js";
import type { DerivationParams } from "../src/spec.js";

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

const PARAMS: DerivationParams = {
  instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
  place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
  houseSystem: "placidus",
};
const scene = deriveScene(eng, PARAMS);

// ---------------------------------------------------------------- scene
{
  assert(scene.engineVersion === VERSION, "scene: stamped with the engine version");
  // eclToHor is orthonormal
  const [X, Y, Z] = scene.eclToHor;
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  assert(Math.abs(dot(X, X) - 1) < 1e-9 && Math.abs(dot(Y, Y) - 1) < 1e-9
    && Math.abs(dot(Z, Z) - 1) < 1e-9, "scene: rotation columns are unit");
  assert(Math.abs(dot(X, Y)) < 1e-9 && Math.abs(dot(X, Z)) < 1e-9
    && Math.abs(dot(Y, Z)) < 1e-9, "scene: rotation columns are orthogonal");

  // the handoff identity: the ecliptic-frame path reproduces each
  // body's true horizontal direction
  const mul = (m: [Vec3, Vec3, Vec3], v: Vec3): Vec3 => [
    m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
    m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
    m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
  ];
  let worst = 0;
  for (const b of scene.bodies) {
    const viaEcl = mul(scene.eclToHor, unitVector(b.lon, b.lat));
    const direct = dirFromAzAlt(b.azDeg, b.altDeg);
    const sep = Math.acos(Math.max(-1, Math.min(1, dot(viaEcl, direct))));
    if (sep > worst) worst = sep;
  }
  assert(worst < 1e-6, `scene: handoff identity (worst ${worst.toExponential(1)} rad)`);

  // serializable end to end
  const rt = JSON.parse(JSON.stringify(scene));
  assert(rt.bodies.length === scene.bodies.length, "scene: JSON round-trip");
}

// ---------------------------------------------------------------- figure
const render = (t: number, follow?: string) =>
  renderToStaticMarkup(<DerivationFigure scene={scene} t={t} follow={follow} />);

{
  // deterministic: same (scene, t), same markup
  assert(render(0.4) === render(0.4), "figure: deterministic at t=0.4");

  // every station renders clean, and the five are distinct figures
  const marks = DERIVATION_STATIONS.map((s) => render(s.t));
  for (let i = 0; i < marks.length; i++) {
    assert(marks[i].startsWith("<svg"), `figure: ${DERIVATION_STATIONS[i].label} renders svg`);
    assert(!marks[i].includes("NaN"), `figure: ${DERIVATION_STATIONS[i].label} has no NaN`);
  }
  const distinct = new Set(marks);
  assert(distinct.size === marks.length, "figure: stations are distinct renders");

  // t = 1 is the standard ChartWheel (glyphs); just before it, dots
  assert(marks[4].includes("☉"), "figure: t=1 is the real wheel");
  assert(!render(0.999).includes("☉"), "figure: dots until the wheel dresses them");

  // the first lesson: below-horizon bodies are faint in the SKY view
  const below = scene.bodies.filter((b) => b.altDeg < 0);
  assert(below.length > 0, "fixture: some bodies below the horizon (precondition)");
  assert(render(0).includes('opacity="0.25"'), "figure: hidden hemisphere faint at t=0");
  assert(!render(0.25).includes('opacity="0.25"'), "figure: whole sphere solid at SPHERE");

  // follow: the held body takes the accent
  assert(render(0.6, "sun").includes("#8c2f2a"), "figure: followed body highlighted");
}

// ------------------------------------------------------------- handedness
{
  // At the end of the settle the Ascendant must sit at the left edge,
  // on the horizontal midline. The asc mark is the first r="6" ring;
  // apply the group's rotate() to its center and check where it lands.
  const html = render(0.9999);
  const rot = html.match(/rotate\((-?[\d.]+) ([\d.]+) ([\d.]+)\)/);
  const ring = html.match(/circle cx="([\d.-]+)" cy="([\d.-]+)" r="6"/);
  assert(!!ring, "handedness: asc ring found");
  if (ring) {
    let x = Number(ring[1]);
    let y = Number(ring[2]);
    if (rot) {
      const a = Number(rot[1]) * (Math.PI / 180);
      const cx = Number(rot[2]);
      const cy = Number(rot[3]);
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * Math.cos(a) - dy * Math.sin(a);
      y = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    const c = 260; // default size 520
    assert(x < c - 200, `handedness: asc at the left edge (x=${x.toFixed(0)})`);
    assert(Math.abs(y - c) < 15, `handedness: asc on the midline (y=${y.toFixed(0)})`);
  }
}

// ---------------------------------------------------------------- widget
{
  // the interactive wrapper SSRs at its resting t: figure + console
  const html = renderToStaticMarkup(
    <ChartDerivation scene={scene} initialT={0.5} />,
  );
  assert(html.includes("<svg"), "widget: figure present");
  assert(html.includes("ECLIPTIC"), "widget: station labels present");
  assert(html.includes("ecliptic · t 0.50"), "widget: datum line");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
