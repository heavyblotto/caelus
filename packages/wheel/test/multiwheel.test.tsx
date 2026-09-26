/**
 * MultiWheel render checks: real charts from the engine through
 * renderToStaticMarkup (Node, no DOM — proves SSR safety), covering the
 * rings API from one ring to four, contacts, houses, and theming.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { Engine } from "caelus";
import { loadNodeData } from "caelus/node";
import { MultiWheel, type RingContact } from "../src/index.js";

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

const natal = eng.chart(1990, 3, 21, 14, 30, 0, 40.71, -74.01, "placidus");
const partner = eng.chart(1992, 11, 5, 6, 15, 0, 34.05, -118.24, "placidus");
const transitDay = eng.chart(2026, 8, 15, 12, 0, 0, 40.71, -74.01, "placidus");

// ---------------------------------------------------------------- one ring
{
  const svg = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal, label: "natal" }]} />,
  );
  assert(svg.startsWith("<svg"), "1 ring: renders an svg");
  assert(svg.includes("multi-ring chart wheel: natal"), "1 ring: aria label carries ring label");
  assert(svg.includes("♈"), "1 ring: zodiac glyphs present");
  assert(svg.includes("☉"), "1 ring: sun glyph present");
  assert(svg.includes(">AC<"), "1 ring: AC axis label from ring 0");
  assert(svg.includes(">1<") && svg.includes(">12<"), "1 ring: house numbers drawn");
  assert(svg.includes("°"), "1 ring: degree labels drawn at this ring count");
}

// ---------------------------------------------------------------- bi-wheel
{
  const contacts: RingContact[] = [
    { a: { ring: 0, body: "sun" }, b: { ring: 1, body: "moon" }, aspect: "trine", orb: 1.2 },
    { a: { ring: 0, body: "mars" }, b: { ring: 1, body: "venus" }, aspect: "square", orb: 3.4 },
  ];
  const svg = renderToStaticMarkup(
    <MultiWheel
      rings={[{ chart: natal, label: "A" }, { chart: partner, label: "B", color: "#dd6ba1" }]}
      contacts={contacts}
    />,
  );
  assert(svg.includes("multi-ring chart wheel: A, B"), "bi-wheel: both rings in aria label");
  assert(svg.includes('stroke="#dd6ba1"'), "bi-wheel: outer ring color applied");
  assert(svg.includes("c-0.sun-trine-1.moon") === false, "bi-wheel: react keys not serialized");
  // two contact lines: one solid (square is hard), one dashed (trine is soft)
  const dashed = (svg.match(/stroke-dasharray/g) ?? []).length;
  assert(dashed >= 1, "bi-wheel: soft contact drawn dashed");
  // orientation is ring 0's: the AC axis sits at ring 0's asc
  assert(svg.includes(">AC<"), "bi-wheel: axes from ring 0");
}

// ---------------------------------------------------------------- tri-wheel
{
  const svg = renderToStaticMarkup(
    <MultiWheel
      rings={[
        { chart: natal, label: "natal" },
        { chart: partner, label: "progressed" },
        { chart: transitDay, label: "transits" },
      ]}
    />,
  );
  assert(svg.includes("natal, progressed, transits"), "tri-wheel: three rings named");
  // at three rings the degree labels drop
  assert(!svg.includes("'</text>"), "tri-wheel: no degree labels");
  // three glyph layers: sun appears three times
  const suns = (svg.match(/☉/g) ?? []).length;
  assert(suns === 3, `tri-wheel: sun drawn once per ring (got ${suns})`);
}

// ---------------------------------------------------------------- four rings
{
  const svg = renderToStaticMarkup(
    <MultiWheel
      rings={[
        { chart: natal }, { chart: partner },
        { chart: transitDay }, { chart: natal },
      ]}
    />,
  );
  const suns = (svg.match(/☉/g) ?? []).length;
  assert(suns === 4, `4 rings: sun drawn once per ring (got ${suns})`);
}

// ---------------------------------------------------------------- options
{
  // showAspects draws ring 0's own aspect lines
  const on = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal }]} showAspects />,
  );
  const off = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal }]} />,
  );
  assert(on.length > off.length, "showAspects: adds aspect lines");

  // showHouses={false} removes cusps and numbers
  const noHouses = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal }]} showHouses={false} />,
  );
  assert(!noHouses.includes(">11<"), "showHouses=false: no house numbers");

  // theme override propagates
  const themed = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal }]} theme={{ axis: "#ff0000" }} />,
  );
  assert(themed.includes("#ff0000"), "theme: override applied");

  // size prop
  const sized = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal }]} size={300} />,
  );
  assert(sized.includes('width="300"'), "size: applied");

  // bodies filter per ring
  const filtered = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: natal, bodies: ["sun", "moon"] }]} />,
  );
  assert(!filtered.includes("♂"), "bodies filter: mars excluded");
  assert(filtered.includes("☉"), "bodies filter: sun kept");

  // a body absent from one ring's chart is skipped, not crashed on
  const partial = { ...natal, bodies: { ...natal.bodies, mars: undefined } };
  const skipped = renderToStaticMarkup(
    <MultiWheel rings={[{ chart: partial }]}
      contacts={[{ a: { ring: 0, body: "mars" }, b: { ring: 0, body: "sun" }, aspect: "trine", orb: 1 }]} />,
  );
  assert(skipped.startsWith("<svg"), "missing body: renders without it");
}

// deterministic output for identical input
{
  const a = renderToStaticMarkup(<MultiWheel rings={[{ chart: natal }, { chart: partner }]} />);
  const b = renderToStaticMarkup(<MultiWheel rings={[{ chart: natal }, { chart: partner }]} />);
  assert(a === b, "determinism: same input, same markup");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
