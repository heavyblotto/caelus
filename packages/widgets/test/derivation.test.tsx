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
import { ChartDerivation } from "../src/derivation-widget.js";
import {
  derivationDatum, shiftInstant, STATION_CAPTIONS, type SceneBody,
  deriveScene, DerivationFigure, DERIVATION_STATIONS, HOME_DERIVATION_STATIONS,
} from "../src/derivation.js";
import type { DerivationParams } from "../src/spec.js";

const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓"];

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

// ----------------------------------------------------- console datum
{
  const body: SceneBody = {
    id: "sun", lon: 79.45, lat: 1.0333, azDeg: 158.3, altDeg: 34.2,
    retrograde: false,
  };
  assert(derivationDatum(body)
    === "alt +34° 12′ · az 158° · λ 19°27′ ♊ · β +1°02′",
  `datum: the plan's register exactly, got "${derivationDatum(body)}"`);
  const below: SceneBody = {
    id: "moon", lon: 359.999, lat: -0.5, azDeg: 12.6, altDeg: -8.05,
    retrograde: false,
  };
  const d = derivationDatum(below);
  assert(d.startsWith("alt −8° 03′"), `datum: negative altitude signed (${d})`);
  assert(d.includes("♓") || d.includes("♈"),
    "datum: longitude wrap stays on the zodiac");
}

// ------------------------------------------------------------- the clock
{
  const i = { y: 1990, mo: 6, d: 10, h: 23, mi: 58, s: 0 };
  const on = shiftInstant(i, 4);
  assert(on.d === 11 && on.h === 0 && on.mi === 2,
    "clock: nudge carries across midnight");
  const back = shiftInstant(on, -4);
  assert(JSON.stringify(back) === JSON.stringify(i),
    "clock: nudges invert exactly");
}

// ------------------------------------------------- follow through the morph
{
  // the followed body's projection tick stays drawn at every t
  const lines = (html: string) => (html.match(/<line /g) ?? []).length;
  assert(lines(render(0, "sun")) === lines(render(0)) + 1,
    "follow: tick drawn at SKY");
  assert(lines(render(0.25, "sun")) === lines(render(0.25)) + 1,
    "follow: tick drawn at SPHERE");
}

// --------------------------------------------------------------- free orbit
{
  const plain = render(0.25);
  const orbited = renderToStaticMarkup(
    <DerivationFigure scene={scene} t={0.25} orbit={{ az: 20, alt: 10 }} />,
  );
  assert(plain !== orbited, "orbit: offset moves the camera");
  assert(renderToStaticMarkup(
    <DerivationFigure scene={scene} t={0.25} />,
  ) === plain, "orbit: omitted offset is the canonical view");
}

// ----------------------------------------------------------- opening aim
{
  const west = { az: 270, alt: 10 };
  const sky = renderToStaticMarkup(<DerivationFigure scene={scene} t={0} />);
  const view = renderToStaticMarkup(
    <DerivationFigure scene={scene} t={0} openingAim={west} />,
  );
  assert(sky !== view, "openingAim: VIEW camera differs from SKY at t=0");
  assert(renderToStaticMarkup(<DerivationFigure scene={scene} t={0} />) === sky,
    "openingAim: omitted keeps the playground SKY path");
  const handed = renderToStaticMarkup(
    <DerivationFigure scene={scene} t={1} openingAim={west} />,
  );
  assert(handed.includes("☉"), "openingAim: t=1 is still the real wheel");
  const atHandoff = renderToStaticMarkup(
    <DerivationFigure scene={scene} t={0.2} openingAim={west} />,
  );
  assert(atHandoff === sky, "openingAim: t=0.2 matches default SKY");
}

// -------------------------------------------------------------- overlays
{
  assert(scene.figures.length > 0, "overlays: scene packs constellation figures");
  assert(scene.figureLabels.filter((l) => l.name === "Serpens").length >= 2,
    "overlays: Serpens is labeled twice in the pack");
  const plain = render(0);
  const west = { az: 270, alt: 10 };
  const ov = (t: number) => renderToStaticMarkup(
    <DerivationFigure scene={scene} t={t} openingAim={west} overlays />,
  );
  assert(plain === renderToStaticMarkup(<DerivationFigure scene={scene} t={0} />),
    "overlays: omitted keeps the playground SKY path");
  assert(!plain.includes("☉"), "overlays: playground t=0 still has no body glyphs");
  const glyphs = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♅", "♆", "♇", "⚷", "☊"];
  const names = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto", "Chiron", "Node"];
  const ov0 = ov(0);
  assert(glyphs.some((g) => ov0.includes(g)) || names.some((n) => ov0.includes(n)),
    "overlays: body glyphs or names at VIEW");
  assert(!ov0.includes('stroke-width="3"'),
    "overlays: halo is a hairline, not a 3px outline");
  const ovThemed = renderToStaticMarkup(
    <DerivationFigure scene={scene} t={0} openingAim={west} overlays
      theme={{ planetText: "var(--text)" }} />,
  );
  assert(ovThemed.includes("var(--text)") && ovThemed.includes("var(--bg)"),
    "overlays: themed glyphs follow the page, halo follows the ground");
  assert(!SIGN_GLYPHS.some((g) => ov0.includes(g)),
    "overlays: no sign glyphs at VIEW");
  assert(!ov0.includes("ASC") && !ov0.includes("H1"),
    "overlays: no house marks at VIEW");
  assert(!scene.figureLabels.some((l) => ov0.includes(l.name)),
    "overlays: no constellation names at VIEW");
  assert(!ov0.includes('stroke-width="1.25"'),
    "overlays: no ecliptic stroke at VIEW");
  assert(!ov0.includes('stroke-width="1.75"'),
    "overlays: no horizon stroke at VIEW");
  const homeT = (id: string) =>
    HOME_DERIVATION_STATIONS.find((s) => s.id === id)!.t;
  const ovEcl = ov(homeT("ecliptic"));
  assert(ovEcl.includes('stroke-width="1.25"'),
    "overlays: ecliptic lights at ECLIPTIC");
  const eclD = ovEcl.match(
    /d="([^"]*)" fill="none" stroke="#8c2f2a" stroke-width="1.25"/,
  );
  assert(!!eclD && eclD[1].length > 20,
    "overlays: ecliptic path has geometry at ECLIPTIC");
  assert(!ovEcl.includes('stroke-width="1.75"'),
    "overlays: horizon still off at ECLIPTIC");
  const ovHor = ov(homeT("horizon"));
  assert(ovHor.includes('stroke-width="1.25"') && ovHor.includes('stroke-width="1.75"'),
    "overlays: the great cross is on at HORIZON");
  const ovFig = ov(homeT("figures"));
  assert(scene.figureLabels.some((l) => ovFig.includes(l.name)),
    "overlays: constellation names by FIGURES");
  const ovZod = ov(homeT("zodiac"));
  assert(SIGN_GLYPHS.some((g) => ovZod.includes(g)),
    "overlays: sign glyphs by ZODIAC");
  const ovSky = ov(homeT("sky"));
  assert(ovSky.includes("ASC") || ovSky.includes("H1"),
    "overlays: house marks by SKY");
  const sphere = ov(homeT("sphere"));
  const late = ov(0.95);
  assert(ovHor !== sphere && sphere !== late,
    "overlays: HORIZON → SPHERE → fold are distinct frames");
  assert(late.includes("☉"), "overlays: glyphs stay on as the wheel converges");
  assert(!late.includes("astrological chart wheel"),
    "overlays: ChartWheel waits until t=1");
  assert(ov(1).includes("astrological chart wheel"),
    "overlays: t=1 is still the real wheel");
}

// -------------------------------------------------------- console controls
{
  for (const s of DERIVATION_STATIONS) {
    assert(typeof STATION_CAPTIONS[s.id] === "string",
      `captions: station ${s.id} captioned`);
  }
  assert(typeof STATION_CAPTIONS.view === "string", "captions: VIEW captioned");
  for (const s of HOME_DERIVATION_STATIONS) {
    assert(typeof STATION_CAPTIONS[s.id] === "string",
      `captions: home station ${s.id} captioned`);
  }
  const bare = renderToStaticMarkup(<ChartDerivation scene={scene} />);
  assert(bare.includes("▸"), "controls: autoplay affordance present");
  assert(!bare.includes("clock"), "controls: no clock without an engine");

  const withEngine = renderToStaticMarkup(
    <ChartDerivation scene={scene} initialT={0.25}
      getEngine={() => Promise.reject(new Error("ssr"))} />,
  );
  assert(withEngine.includes("−4m") && withEngine.includes("+4m"),
    "controls: clock nudge with an engine");
  assert(withEngine.includes("lat "),
    "controls: latitude control at SPHERE");
  const atSky = renderToStaticMarkup(
    <ChartDerivation scene={scene} initialT={0}
      getEngine={() => Promise.reject(new Error("ssr"))} />,
  );
  assert(!atSky.includes("lat "),
    "controls: latitude control only at SPHERE");

  const captioned = renderToStaticMarkup(
    <ChartDerivation
      scene={{ ...scene, params: { ...scene.params, captions: true } }}
      initialT={0.75}
    />,
  );
  assert(captioned.includes(STATION_CAPTIONS.horizon),
    "captions: drawn when the instance asks");
  assert(!renderToStaticMarkup(<ChartDerivation scene={scene} initialT={0.75} />)
    .includes(STATION_CAPTIONS.horizon),
  "captions: absent by default");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
