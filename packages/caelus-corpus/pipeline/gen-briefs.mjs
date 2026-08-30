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

// B5 lots: one slice per lot per placement mode (12 cells each).
for (const fam of ["lot-sign", "lot-house"]) {
  const mode = fam === "lot-sign" ? "signs" : "houses";
  const cells = byFamily.get(fam) ?? [];
  for (const lot of [...new Set(cells.map((c) => c.when.lot))]) {
    brief(`lot-${lot}-${mode}`, `b5-lot-${lot}-${mode}.json`,
      `corpus-b5-lot-${lot}-${mode}`,
      cells.filter((c) => c.when.lot === lot));
  }
}

// B5 dispositors and receptions: one slice each.
brief("dispositors", "b5-dispositors.json", "corpus-b5-dispositors",
  byFamily.get("dispositor"));
brief("receptions", "b5-receptions.json", "corpus-b5-receptions",
  byFamily.get("reception"));

// B5 stars: the star essays in chunks of 15; the body contacts per body.
const starCells = byFamily.get("star") ?? [];
for (let i = 0; i < starCells.length; i += 15) {
  const n = String(i / 15 + 1).padStart(2, "0");
  brief(`stars-${n}`, `b5-stars-${n}.json`, `corpus-b5-stars-${n}`,
    starCells.slice(i, i + 15));
}
const starContacts = byFamily.get("star-contact") ?? [];
for (const body of [...new Set(starContacts.map((c) => c.when.body))]) {
  brief(`star-contacts-${body}`, `b5-star-contacts-${body}.json`,
    `corpus-b5-star-contacts-${body}`,
    starContacts.filter((c) => c.when.body === body));
}

// B5 parallels: chunks of 14.
const par = byFamily.get("parallel") ?? [];
for (let i = 0; i < par.length; i += 14) {
  const n = String(i / 14 + 1).padStart(2, "0");
  brief(`parallels-${n}`, `b5-parallels-${n}.json`, `corpus-b5-parallels-${n}`,
    par.slice(i, i + 14));
}

// B5 nakshatras: the Moon's mansions in two slices; the padas in chunks
// of 16 (four mansions per slice).
const nakMoon = byFamily.get("nakshatra-moon") ?? [];
for (let i = 0; i < nakMoon.length; i += 14) {
  const n = String(i / 14 + 1).padStart(2, "0");
  brief(`nakshatras-moon-${n}`, `b5-nakshatras-moon-${n}.json`,
    `corpus-b5-nakshatras-moon-${n}`, nakMoon.slice(i, i + 14));
}
const nakPada = byFamily.get("nakshatra-pada") ?? [];
for (let i = 0; i < nakPada.length; i += 16) {
  const n = String(i / 16 + 1).padStart(2, "0");
  brief(`nakshatra-padas-${n}`, `b5-nakshatra-padas-${n}.json`,
    `corpus-b5-nakshatra-padas-${n}`, nakPada.slice(i, i + 16));
}

// B5 vargas: D9 placements per body; the framings in one slice.
const d9 = byFamily.get("varga-d9") ?? [];
for (const body of [...new Set(d9.map((c) => c.when.body))]) {
  brief(`varga-d9-${body}`, `b5-varga-d9-${body}.json`,
    `corpus-b5-varga-d9-${body}`,
    d9.filter((c) => c.when.body === body));
}
brief("varga-frames", "b5-varga-frames.json", "corpus-b5-varga-frames",
  byFamily.get("varga-frame"));

// B5 yogas: one slice (the unbindable raja/dhana cells filter out above).
brief("yogas", "b5-yogas.json", "corpus-b5-yogas", byFamily.get("yoga"));

// B6 ten-degree faces: chunks of 12 (four signs per slice, zodiac order).
const faces = byFamily.get("ten-degree-face") ?? [];
for (let i = 0; i < faces.length; i += 12) {
  const n = String(i / 12 + 1).padStart(2, "0");
  brief(`faces-${n}`, `b6-faces-${n}.json`, `corpus-b6-faces-${n}`,
    faces.slice(i, i + 12));
}

// B6 degree symbols: one slice per sign (30 cells) -- one writer holds a
// sign's whole walk of degrees, keeping the through-line in one hand.
const degSym = byFamily.get("degree-symbol") ?? [];
for (const signName of [...new Set(degSym.map((c) => c.when.sign))]) {
  brief(`degree-symbols-${signName.toLowerCase()}`,
    `b6-degree-symbols-${signName.toLowerCase()}.json`,
    `corpus-b6-degree-symbols-${signName.toLowerCase()}`,
    degSym.filter((c) => c.when.sign === signName));
}

for (const b of briefs) {
  writeFileSync(`${OUT}${b.name}.json`, JSON.stringify(b, null, 1));
}
console.log(`${briefs.length} briefs written to ${OUT}`);
for (const b of briefs) console.log(`  ${b.name}: ${b.cells.length} cells -> ${b.outFile}`);
