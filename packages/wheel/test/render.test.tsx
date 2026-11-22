/**
 * caelus-wheel render checks: real charts from the engine through
 * renderToStaticMarkup (also proves SSR safety — this is Node, no DOM),
 * plus unit checks on the collision-avoidance fan.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine } from "caelus";
import { loadNodeData } from "caelus/node";
import { createHash } from "node:crypto";
import {
  ChartWheel, MultiWheel, spreadAngles, sweptArc, GLYPHS, PLATE_THEME, PLATE_BODY_INKS, PLATE_TOKENS,
  NorthIndianKundli, SouthIndianKundli,
  type WheelChart,
} from "../src/index.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const require_ = createRequire(import.meta.url);
const DATA = join(dirname(require_.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA, "embedded", "full"));

// ---------------------------------------------------------------- spreadAngles
{
  // well-separated input is returned unchanged
  const lons = [10, 100, 200, 300];
  const out = spreadAngles(lons, 6.5);
  assert(out.every((v, i) => Math.abs(v - lons[i]) < 1e-9), "spread: identity when separated");
}
{
  // a tight stellium fans to >= minSep, order preserved, centered
  const lons = [315.71, 315.61, 316.93, 317.77, 318.61]; // 1962-02-05 cluster
  const out = spreadAngles(lons, 6.5);
  const sorted = [...out].sort((a, b) => mod(a - 300, 360) - mod(b - 300, 360));
  for (let i = 1; i < sorted.length; i++) {
    assert(mod(sorted[i] - sorted[i - 1], 360) >= 6.5 - 1e-6,
      `spread: stellium pair ${i} separation ${mod(sorted[i] - sorted[i - 1], 360).toFixed(2)}`);
  }
  // zodiacal order preserved (moon < sun < mercury < venus < jupiter)
  const order = [1, 0, 2, 3, 4]; // indices sorted by true lon
  for (let k = 1; k < order.length; k++) {
    assert(mod(out[order[k]] - out[order[k - 1]], 360) < 180,
      "spread: stellium order preserved");
  }
}
{
  // cluster across the 0° wrap
  const lons = [358, 1, 4];
  const out = spreadAngles(lons, 6.5);
  const seps = [mod(out[1] - out[0], 360), mod(out[2] - out[1], 360)];
  assert(seps.every((s) => s >= 6.5 - 1e-6), `spread: wrap cluster seps ${seps.map((s) => s.toFixed(1))}`);
}
{
  // more bodies than the circle can hold at minSep: falls back to 360/n
  const lons = Array.from({ length: 80 }, (_, i) => mod(i * 1.3, 360));
  const out = spreadAngles(lons, 6.5);
  assert(out.every((v) => Number.isFinite(v)), "spread: dense input stays finite");
}

// ---------------------------------------------------------------- rendering
function render(chart: Parameters<typeof ChartWheel>[0]["chart"], props = {}) {
  return renderToStaticMarkup(<ChartWheel chart={chart} {...props} />);
}

const fixture = eng.chart(1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus");
const polar = eng.chart(1985, 12, 1, 9, 0, 0, 78.2, 15.6, "placidus"); // whole_sign fallback
const stellium = eng.chart(1962, 2, 5, 0, 0, 0, 27.95, -82.46, "placidus");

for (const [label, chart] of [
  ["fixture", fixture], ["polar", polar], ["stellium", stellium],
] as const) {
  const svg = render(chart);
  assert(svg.startsWith("<svg"), `${label}: renders svg`);
  assert(!svg.includes("NaN"), `${label}: no NaN coordinates`);
  assert(svg.includes("☉") && svg.includes("☽") && svg.includes("⚷"),
    `${label}: planet glyphs present`);
  assert(svg.includes("♈") && svg.includes("♓"), `${label}: sign glyphs present`);
  assert((svg.match(/AC|MC|DC|IC/g) ?? []).length >= 4, `${label}: axes labeled`);
}

// retrograde mark appears for the fixture chart (saturn is retrograde)
assert(fixture.bodies.saturn.retrograde === true, "fixture: saturn retrograde (precondition)");
assert(render(fixture).includes("℞"), "fixture: retrograde mark rendered");

// aspect toggle: hiding aspects removes line elements
{
  const withA = (render(fixture).match(/<line/g) ?? []).length;
  const without = (render(fixture, { showAspects: false }).match(/<line/g) ?? []).length;
  assert(withA - without === fixture.aspects.length,
    `aspects: ${withA - without} lines for ${fixture.aspects.length} aspects`);
}

// aspectTypes filter
{
  const only = render(fixture, { aspectTypes: ["trine"] });
  const trines = fixture.aspects.filter((a) => a.aspect === "trine").length;
  const base = (render(fixture, { showAspects: false }).match(/<line/g) ?? []).length;
  assert((only.match(/<line/g) ?? []).length === base + trines,
    "aspects: aspectTypes filters to trines only");
}

// mean_node hidden by default, shown when requested
{
  const dflt = render(fixture);
  const both = render(fixture, { bodies: Object.keys(fixture.bodies) });
  assert((both.match(/☊/g) ?? []).length === 2 && (dflt.match(/☊/g) ?? []).length === 1,
    "bodies: mean_node opt-in");
}

// MCP payload shape: rx instead of retrograde, no signDeg — renders identically
// to the engine chart it mirrors (caelus-mcp natal_chart pipes in as-is)
{
  const mcpShaped = {
    bodies: Object.fromEntries(Object.entries(fixture.bodies).map(([id, p]) => [
      id,
      {
        lon: Math.round(p!.lon * 100) / 100,
        ...(p!.retrograde ? { rx: true } : {}),
      },
    ])),
    angles: { asc: fixture.angles.asc, mc: fixture.angles.mc },
    cusps: fixture.cusps,
    aspects: fixture.aspects,
  };
  const svg = render(mcpShaped);
  assert(svg.startsWith("<svg") && !svg.includes("NaN"), "mcp shape: renders without NaN");
  assert(svg.includes("℞"), "mcp shape: rx flag renders the retrograde mark");
  // note: react escapes the trailing apostrophe in text content, so match without it
  const sd = mod(mcpShaped.bodies.sun.lon, 30);
  const label = `${Math.floor(sd)}°${String(Math.floor(mod(sd, 1) * 60)).padStart(2, "0")}`;
  assert(svg.includes(label), `mcp shape: sun degree label ${label} derived from lon`);
}

// theme override propagates
assert(render(fixture, { theme: { axis: "#ff0000" } }).includes("#ff0000"),
  "theme: override applied");

// planetColors tints glyph + position tick; label/connector stay on labelText
{
  const svg = render(fixture, {
    theme: {
      planetText: "#cccccc",
      labelText: "#888888",
      planetColors: { sun: "#ffaa00", moon: "#aabbcc" },
    },
  });
  assert(svg.includes('fill="#ffaa00"'), "planetColors: sun glyph fill");
  assert(svg.includes('stroke="#ffaa00"'), "planetColors: sun position tick");
  assert(svg.includes('fill="#aabbcc"'), "planetColors: moon glyph fill");
  assert(!svg.includes('fill="#cccccc"') || svg.includes('fill="#888888"'),
    "planetColors: unlisted bodies fall back to planetText or use labelText for labels");
}

// size prop
assert(render(fixture, { size: 300 }).includes('width="300"'), "size: applied");

// plate theme: complete over every glyphed body (a theme is complete or it
// does not merge), and oxblood keeps its one meaning (nothing in the base
// theme or the body inks uses the accent)
{
  for (const body of Object.keys(GLYPHS)) {
    assert(PLATE_THEME.planetColors?.[body] !== undefined,
      `plate theme: planetColors covers ${body}`);
    assert(PLATE_BODY_INKS[body] !== undefined,
      `plate theme: body inks cover ${body}`);
  }
  const values = [
    ...Object.values(PLATE_THEME.aspectColors),
    ...Object.values(PLATE_THEME.planetColors ?? {}),
    ...Object.values(PLATE_BODY_INKS),
    PLATE_THEME.ring, PLATE_THEME.axis, PLATE_THEME.signText,
    PLATE_THEME.planetText, PLATE_THEME.labelText, PLATE_THEME.houseText,
  ];
  assert(values.every((v) => v.toLowerCase() !== PLATE_TOKENS.accent),
    "plate theme: oxblood reserved for interaction");
  const svg = render(fixture, { theme: PLATE_THEME });
  assert(svg.startsWith("<svg") && !svg.includes("NaN"), "plate theme: renders");
  assert(svg.includes(PLATE_TOKENS.ink), "plate theme: ink present");
}

// ---------------------------------------------------------------- kundli
{
  const DRAW = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto", "chiron", "true_node"];
  const north = renderToStaticMarkup(<NorthIndianKundli chart={fixture} />);
  const south = renderToStaticMarkup(<SouthIndianKundli chart={fixture} />);
  for (const [label, svg] of [["north", north], ["south", south]] as const) {
    assert(svg.startsWith("<svg"), `kundli ${label}: renders svg`);
    assert(!svg.includes("NaN"), `kundli ${label}: no NaN coordinates`);
    for (const b of DRAW) {
      assert(svg.includes(`data-body="${b}"`), `kundli ${label}: body ${b} present`);
    }
  }
}

// ---------------------------------------------------------------- uncertainty
// A chart written out by hand, so these renders depend on this package
// alone and the hashes below move only when the wheel's own output does.
const STATIC: WheelChart = {
  bodies: {
    sun: { lon: 79.45 }, moon: { lon: 282.1 }, mercury: { lon: 58.2, retrograde: true },
    venus: { lon: 41.75 }, mars: { lon: 7.9 }, jupiter: { lon: 108.33 },
    saturn: { lon: 293.6, retrograde: true }, true_node: { lon: 310.05 }, mean_node: { lon: 311.2 },
  },
  angles: { asc: 185.2, mc: 96.4 },
  cusps: [185.2, 213.9, 244.6, 276.4, 308.3, 338.1, 5.2, 33.9, 64.6, 96.4, 128.3, 158.1],
  aspects: [
    { a: "sun", b: "moon", aspect: "trine", orb: 2.65 },
    { a: "mars", b: "saturn", aspect: "square", orb: 4.3 },
    { a: "venus", b: "jupiter", aspect: "sextile", orb: 3.4 },
  ],
};
const sha = (svg: string): string => createHash("sha256").update(svg).digest("hex");

// With the prop left out the wheel is deterministic across runs.
{
  assert(sha(render(STATIC)) === "2bdb5663a1983c30e48057463ebc22d97fbdf855a600e8fc64c06c55274f74d0",
    "uncertainty: the default render is deterministic");
  assert(sha(render(STATIC, { size: 360, layers: { aspects: false }, theme: { axis: "#123456" } }))
    === "8c0d5b68cba28844765399efdb9968f74bcf9e11a9874ee39a6188bf58e67e06",
    "uncertainty: a render with other props is deterministic");
  assert(sha(renderToStaticMarkup(<MultiWheel rings={[{ chart: STATIC, label: "a" }, { chart: STATIC, label: "b" }]} />))
    === "97d0e2c099e2618ee6165172ebb3e8b2543d79457efad27656bc0cc8e8a48270",
    "uncertainty: MultiWheel is deterministic");
  assert(render(STATIC, { uncertainty: undefined }) === render(STATIC), "uncertainty: undefined is the same as absent");
  assert(render(STATIC, { uncertainty: { samples: [STATIC] } }) === render(STATIC), "uncertainty: one sample is no window, so nothing draws");
}

// tight-conjunction degree label collision regression check (2024 eclipse + 1962 stellium)
{
  const eclipse = eng.chart(2024, 4, 8, 18, 17, 0, 23.2494, -106.4111, "placidus");
  for (const [label, ch] of [["2024-eclipse", eclipse], ["1962-stellium", stellium]] as const) {
    const svg = render(ch, { size: 460 });
    const fs = 460 * 0.0185;
    const boxes = [...svg.matchAll(/<text x="([^"]+)" y="([^"]+)" font-size="8\.51[^"]*"[^>]*>([^<]+)<\/text>/g)]
      .map((m) => {
        const t = m[3].replace(/&#x27;/g, "'");
        return { x: Number(m[1]), y: Number(m[2]), w: t.length * fs * 0.74 + 3.5, h: fs * 1.25 + 2 };
      });
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (Math.abs(boxes[i].x - boxes[j].x) < (boxes[i].w + boxes[j].w) / 2
          && Math.abs(boxes[i].y - boxes[j].y) < (boxes[i].h + boxes[j].h) / 2) {
          overlaps++;
        }
      }
    }
    assert(boxes.length === 12 && overlaps === 0,
      `collision: ${label} degree labels stay clear (${boxes.length} labels, ${overlaps} overlaps)`);
  }
}

// interactive selection & cross-highlighting
{
  const sel = render(STATIC, { selectedBody: "sun" });
  assert(sel.includes('data-body="sun" data-selected="true" data-highlighted="true"'),
    "interactive: selected body carries data-selected and data-highlighted");
  assert(sel.includes('data-body="moon" data-highlighted="true"'),
    "interactive: aspect-connected body stays highlighted");
  assert(sel.includes('data-body="mars" data-dimmed="true"'),
    "interactive: unrelated body is dimmed");
  assert(sel.includes('data-aspect="trine" data-a="sun" data-b="moon" data-highlighted="true"'),
    "interactive: connected aspect is highlighted");
  assert(sel.includes('data-aspect="square" data-a="mars" data-b="saturn" data-dimmed="true"'),
    "interactive: unrelated aspect is dimmed");
  assert(!render(STATIC).includes("tabindex="),
    "inert: static wheel emits no tabindex when callbacks are omitted");
  const clickable = render(STATIC, { onSelectBody: () => {} });
  assert(clickable.includes('role="button"') && clickable.includes('tabindex="0"'),
    "interactive: callbacks attach accessible button roles");
}

// the swept arc
{
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
  const fwd = sweptArc([10, 12, 15]);
  assert(near(fwd.from, 10) && near(fwd.sweep, 5) && fwd.boundaries.length === 0, "arc: forward motion inside one sign");
  const cross = sweptArc([28.5, 29.4, 30.6]);
  assert(near(cross.from, 28.5) && near(cross.sweep, 2.1) && cross.boundaries.join() === "30", "arc: crossing into the next sign names the boundary");
  const back = sweptArc([31, 30.2, 29.6]);
  assert(near(back.from, 29.6) && near(back.sweep, 1.4) && back.boundaries.join() === "30", "arc: retrograde motion runs from the lowest point reached");
  const turn = sweptArc([14, 16, 15, 13]);
  assert(near(turn.from, 13) && near(turn.sweep, 3), "arc: a body that turns inside the window is covered across its whole excursion");
  const wrap = sweptArc([358, 359.5, 1]);
  assert(near(wrap.from, 358) && near(wrap.sweep, 3) && wrap.boundaries.join() === "0", "arc: crossing 0° Aries");
  assert(sweptArc([25, 30]).boundaries.length === 0 && sweptArc([30, 35]).boundaries.length === 0, "arc: a boundary at an end of the arc is touched, not crossed");
  const big = sweptArc(Array.from({ length: 13 }, (_, i) => 100 + i * 20));
  assert(near(big.from, 100) && near(big.sweep, 240) && big.boundaries.length === 8, "arc: steps add up past half a turn");
  const round = sweptArc(Array.from({ length: 25 }, (_, i) => (200 + i * 15.04) % 360));
  assert(round.sweep === 360 && round.boundaries.length === 12, "arc: a full turn is the whole circle and every boundary");
  assert(sweptArc([42]).sweep === 0 && sweptArc([]).sweep === 0, "arc: one sample or none sweeps nothing");
}

// the layer on the wheel
{
  const at = (dAsc: number, dMoon: number, dSun: number): WheelChart => ({
    ...STATIC,
    bodies: { ...STATIC.bodies, moon: { lon: 282.1 + dMoon }, sun: { lon: 79.45 + dSun } },
    angles: { asc: 185.2 + dAsc, mc: 96.4 + dAsc },
  });
  // a quarter of an hour either way: the Ascendant moves a few degrees
  const short = render(STATIC, { uncertainty: { samples: [at(-4, -0.14, -0.01), STATIC, at(4, 0.14, 0.01)] } });
  const paths = (svg: string): number => (svg.match(/<path /g) ?? []).length;
  assert(short.startsWith("<svg") && !short.includes("NaN"), "layer: renders without NaN");
  assert(paths(render(STATIC)) === 0 && paths(short) === 3, `layer: the Moon and the two angles get an arc, and the Sun's is too short to draw (${paths(short)})`);
  assert(!short.includes("<rect"), "layer: no sign boundary is crossed, so no square");
  assert((short.match(/<line/g) ?? []).length === (render(STATIC).match(/<line/g) ?? []).length, "layer: nothing else on the wheel changes");

  // the Moon crosses from Capricorn into Aquarius (300°): heavier arc, one square
  const cross = render(STATIC, { uncertainty: { samples: [at(0, 15, 0), at(0, 20, 0)] } });
  assert((cross.match(/<rect/g) ?? []).length === 1 && cross.includes('stroke-width="3"'), "layer: a body that changes sign is drawn heavier with a square on the boundary");

  // a whole day: both angles go all the way round
  const day = render(STATIC, { uncertainty: { samples: Array.from({ length: 49 }, (_, i) => at((i - 24) * 7.52, (i - 24) * 0.27, (i - 24) * 0.02)) } });
  const rings = (svg: string): number => (svg.match(/<circle/g) ?? []).length;
  assert(rings(day) === rings(render(STATIC)) + 2, "layer: over a whole day each angle's arc is a full circle");
  assert((day.match(/<rect/g) ?? []).length === 24, `layer: and carries a square on all twelve boundaries (${(day.match(/<rect/g) ?? []).length})`);

  // a chart with no place has no angles to sweep
  const bare = render(STATIC, { uncertainty: { samples: [{ bodies: at(0, -6, 0).bodies }, { bodies: at(0, 6, 0).bodies }] } });
  assert(paths(bare) === 1 && !bare.includes("NaN"), "layer: samples without angles draw the bodies only");
  const off = render(STATIC, { layers: { axes: false, bodies: false }, uncertainty: { samples: [at(-4, -6, 0), at(4, 6, 0)] } });
  assert(paths(off) === 0, "layer: arcs follow the bodies and axes layers");
  assert(render(STATIC, { uncertainty: { samples: [at(-4, -6, 0), at(4, 6, 0)], color: "#abcdef" } }).includes('stroke="#abcdef"'), "layer: the arc color can be set");
  assert(short.includes('stroke="#8a7fd4" stroke-width="1.5"'), "layer: arcs default to the axis ink");

  // a real window from the engine: a quarter hour either way on the fixture
  const jd = fixture.jdUt;
  const real = [-900, 0, 900].map((sec) => eng.chartAt(jd + sec / 86400, 27.95, -82.46, { houseSystem: "placidus" }));
  const svg = render(fixture, { uncertainty: { samples: real } });
  assert(!svg.includes("NaN") && paths(svg) >= 2, "layer: a real window renders");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
