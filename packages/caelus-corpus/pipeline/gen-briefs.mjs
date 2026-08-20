// Generate writer-slice briefs from the content grid (all batches). Each
// brief carries the verbatim cells (id/family/when/atomIds/title) a slice
// must fill and the output filename its JSON goes to.
import { fullGrid } from "../dist/src/grid.js";
import { passages } from "../dist/src/passages.js";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("./briefs/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const written = new Set(passages.map((p) => p.id));
const grid = fullGrid().filter((c) => c.bindable && !written.has(c.id));

const byFamily = new Map();
for (const c of grid) {
  const list = byFamily.get(c.family) ?? [];
  list.push(c);
  byFamily.set(c.family, list);
}

const briefs = [];
function brief(name, outFile, setId, cells) {
  if (!cells || cells.length === 0) return; // family already fully written
  briefs.push({ name, outFile, setId, family: cells[0].family, cells });
}

// planet-in-sign: one slice per body
const sign = byFamily.get("planet-in-sign") ?? [];
const signBodies = [...new Set(sign.map((c) => c.when.body))];
for (const body of signBodies) {
  brief(
    `signs-${body}`,
    `b1-${body.replace("_", "-")}-signs.json`,
    `corpus-b1-${body.replace("_", "-")}-signs`,
    sign.filter((c) => c.when.body === body),
  );
}

// planet-in-house: one slice per body
const house = byFamily.get("planet-in-house") ?? [];
const houseBodies = [...new Set(house.map((c) => c.when.body))];
for (const body of houseBodies) {
  brief(
    `houses-${body}`,
    `b1-${body.replace("_", "-")}-houses.json`,
    `corpus-b1-${body.replace("_", "-")}-houses`,
    house.filter((c) => c.when.body === body),
  );
}

// aspects: chunks of 15
const aspects = byFamily.get("aspect") ?? [];
for (let i = 0; i < aspects.length; i += 15) {
  const n = String(i / 15 + 1).padStart(2, "0");
  brief(`aspects-${n}`, `b1-aspects-${n}.json`, `corpus-b1-aspects-${n}`, aspects.slice(i, i + 15));
}

// mc signs: one slice
brief("mc-signs", "b1-mc-signs.json", "corpus-b1-mc-signs", byFamily.get("mc-sign"));

// angle conjunctions: one slice per angle (12 bodies each)
const angleConj = byFamily.get("angle-conjunction") ?? [];
for (const angle of [...new Set(angleConj.map((c) => c.when.angle))]) {
  brief(
    `angle-${angle}`,
    `b1-on-${angle}.json`,
    `corpus-b1-on-${angle}`,
    angleConj.filter((c) => c.when.angle === angle),
  );
}

// dignities: chunks of 13
const dign = byFamily.get("dignity") ?? [];
for (let i = 0; i < dign.length; i += 13) {
  const n = String(i / 13 + 1).padStart(2, "0");
  brief(`dignities-${n}`, `b1-dignities-${n}.json`, `corpus-b1-dignities-${n}`, dign.slice(i, i + 13));
}

// patterns: chunks of 14
const pat = byFamily.get("pattern") ?? [];
for (let i = 0; i < pat.length; i += 14) {
  const n = String(i / 14 + 1).padStart(2, "0");
  brief(`patterns-${n}`, `b1-patterns-${n}.json`, `corpus-b1-patterns-${n}`, pat.slice(i, i + 14));
}

// signature: chunks of 13
const sig = byFamily.get("signature") ?? [];
for (let i = 0; i < sig.length; i += 13) {
  const n = String(i / 13 + 1).padStart(2, "0");
  brief(`signature-${n}`, `b1-signature-${n}.json`, `corpus-b1-signature-${n}`, sig.slice(i, i + 13));
}

// out of bounds + natal retrogrades: one file each
brief("oob", "b1-out-of-bounds.json", "corpus-b1-out-of-bounds", byFamily.get("out-of-bounds"));
brief("retro", "b1-natal-retrogrades.json", "corpus-b1-natal-retrogrades", byFamily.get("natal-retrograde"));

// B2 transits by aspect: one slice per transiting body per aspect-target
// half (12 targets x 5 aspects = 60 cells per body, split into 4 of 15).
// Node-target cells slice apart under their own names (so their later
// unblock never collided with the numbered per-body slice files), paired
// by tempo-adjacent transiting bodies to keep each slice's prompt simple.
const trAspectAll = byFamily.get("transit-aspect") ?? [];
const trAspect = trAspectAll.filter((c) => !c.when.natal.endsWith("_node"));
const trNode = trAspectAll.filter((c) => c.when.natal.endsWith("_node"));
const NODE_PAIRS = [
  ["sun", "moon"], ["mercury", "venus"], ["mars", "jupiter"],
  ["saturn", "uranus"], ["neptune", "pluto"],
];
for (const pair of NODE_PAIRS) {
  const cells = trNode.filter((c) => pair.includes(c.when.transit));
  brief(
    `transits-node-${pair.join("-")}`,
    `b2-transits-node-${pair.join("-")}.json`,
    `corpus-b2-transits-node-${pair.join("-")}`,
    cells,
  );
}
const trBodies = [...new Set(trAspect.map((c) => c.when.transit))];
for (const body of trBodies) {
  const cells = trAspect.filter((c) => c.when.transit === body);
  for (let i = 0; i < cells.length; i += 15) {
    const n = String(i / 15 + 1);
    brief(
      `transits-${body}-${n}`,
      `b2-transits-${body}-${n}.json`,
      `corpus-b2-transits-${body}-${n}`,
      cells.slice(i, i + 15),
    );
  }
}

// B2 transit houses: one slice per transiting body (12 cells)
const trHouse = byFamily.get("transit-house") ?? [];
for (const body of [...new Set(trHouse.map((c) => c.when.body))]) {
  brief(
    `transit-houses-${body}`,
    `b2-transit-houses-${body}.json`,
    `corpus-b2-transit-houses-${body}`,
    trHouse.filter((c) => c.when.body === body),
  );
}

// B2 stations: one slice
brief("stations", "b2-stations.json", "corpus-b2-stations", byFamily.get("transit-station"));

// B3 synastry: one slice per pair of your-body (50 cells each) split into
// chunks of 15; overlays one slice per body; composite one slice per body.
const synAsp = byFamily.get("synastry-aspect") ?? [];
for (const a of [...new Set(synAsp.map((c) => c.when.a))]) {
  const cells = synAsp.filter((c) => c.when.a === a);
  for (let i = 0; i < cells.length; i += 15) {
    const n = String(i / 15 + 1);
    brief(
      `synastry-${a}-${n}`,
      `b3-synastry-${a}-${n}.json`,
      `corpus-b3-synastry-${a}-${n}`,
      cells.slice(i, i + 15),
    );
  }
}
const synOv = byFamily.get("synastry-overlay") ?? [];
for (const body of [...new Set(synOv.map((c) => c.when.body))]) {
  brief(`synastry-overlays-${body}`, `b3-synastry-overlays-${body}.json`,
    `corpus-b3-synastry-overlays-${body}`,
    synOv.filter((c) => c.when.body === body));
}
// Composite aspects: one slice per first body of the pair, chunked at 15.
const compAsp = byFamily.get("composite-aspect") ?? [];
for (const a of [...new Set(compAsp.map((c) => c.when.a))]) {
  const cells = compAsp.filter((c) => c.when.a === a);
  const key = a.replace("_", "-");
  for (let i = 0; i < cells.length; i += 15) {
    const n = String(i / 15 + 1);
    brief(
      `composite-aspects-${key}-${n}`,
      `b3-composite-aspects-${key}-${n}.json`,
      `corpus-b3-composite-aspects-${key}-${n}`,
      cells.slice(i, i + 15),
    );
  }
}

// Composite houses: one slice per body, the same shape as the placements.
const compHouse = byFamily.get("composite-house") ?? [];
for (const body of [...new Set(compHouse.map((c) => c.when.body))]) {
  const key = body.replace("_", "-");
  brief(`composite-houses-${key}`, `b3-composite-houses-${key}.json`,
    `corpus-b3-composite-houses-${key}`,
    compHouse.filter((c) => c.when.body === body));
}

const comp = byFamily.get("composite-placement") ?? [];
for (const body of [...new Set(comp.map((c) => c.when.body))]) {
  brief(`composite-${body.replace("_", "-")}`,
    `b3-composite-${body.replace("_", "-")}.json`,
    `corpus-b3-composite-${body.replace("_", "-")}`,
    comp.filter((c) => c.when.body === body));
}

// B4 time-lords: profection year-houses / year-lords / month-houses as
// three slices; ZR by level; firdaria majors in one slice and sub pairs by
// major; dasha mahas in one slice and antar pairs by maha.
const prof = byFamily.get("timelord-profection") ?? [];
brief("profection-year-houses", "b4-profection-year-houses.json",
  "corpus-b4-profection-year-houses",
  prof.filter((c) => c.when.level === "year" && c.when.house !== undefined));
brief("profection-year-lords", "b4-profection-year-lords.json",
  "corpus-b4-profection-year-lords",
  prof.filter((c) => c.when.level === "year" && c.when.lord !== undefined));
brief("profection-month-houses", "b4-profection-month-houses.json",
  "corpus-b4-profection-month-houses",
  prof.filter((c) => c.when.level === "month"));
const zr = byFamily.get("timelord-zr") ?? [];
for (const level of ["l1", "l2"]) {
  brief(`zr-${level}`, `b4-zr-${level}.json`, `corpus-b4-zr-${level}`,
    zr.filter((c) => c.when.level === level));
}
const fir = byFamily.get("timelord-firdaria") ?? [];
brief("firdaria-majors", "b4-firdaria-majors.json", "corpus-b4-firdaria-majors",
  fir.filter((c) => c.when.level === "major"));
for (const major of [...new Set(fir.filter((c) => c.when.level === "sub").map((c) => c.when.under))]) {
  brief(`firdaria-subs-${major}`, `b4-firdaria-subs-${major}.json`,
    `corpus-b4-firdaria-subs-${major}`,
    fir.filter((c) => c.when.level === "sub" && c.when.under === major));
}
const dasha = byFamily.get("timelord-dasha") ?? [];
brief("dasha-mahas", "b4-dasha-mahas.json", "corpus-b4-dasha-mahas",
  dasha.filter((c) => c.when.level === "maha"));
for (const maha of [...new Set(dasha.filter((c) => c.when.level === "antar").map((c) => c.when.under))]) {
  brief(`dasha-antars-${maha}`, `b4-dasha-antars-${maha}.json`,
    `corpus-b4-dasha-antars-${maha}`,
    dasha.filter((c) => c.when.level === "antar" && c.when.under === maha));
}

// B4 lunations, eclipses, returns, solar phase
const lun = byFamily.get("lunation-house") ?? [];
for (const phase of ["new", "full"]) {
  brief(`lunations-${phase}`, `b4-lunations-${phase}.json`,
    `corpus-b4-lunations-${phase}`, lun.filter((c) => c.when.phase === phase));
}
brief("eclipses", "b4-eclipses.json", "corpus-b4-eclipses", byFamily.get("eclipse"));
brief("returns", "b4-returns.json", "corpus-b4-returns", byFamily.get("planetary-return"));
brief("solar-phases", "b4-solar-phases.json", "corpus-b4-solar-phases",
  byFamily.get("solar-phase"));

for (const b of briefs) {
  writeFileSync(`${OUT}${b.name}.json`, JSON.stringify(b, null, 1));
}
console.log(`${briefs.length} briefs written to ${OUT}`);
for (const b of briefs) console.log(`  ${b.name}: ${b.cells.length} cells -> ${b.outFile}`);
