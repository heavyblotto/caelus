/**
 * Derivation of the knowledge base from the `caelus` engine and the curated
 * files in `data/`.
 *
 * The rule: anything the engine states is derived here, never copied. The
 * engine's exported tables (BODIES, SIGNS, DOMICILE, TRIPLICITY,
 * TERMS_EGYPTIAN, NAKSHATRAS, ...) and its shipped data files
 * (fixed_stars.json, constellations.json) are the source of truth; the drift
 * test re-runs this module and fails if the committed kb.json disagrees.
 * Curated facts (traditions, sources, house topics, Wikidata ids, MCP tool
 * names) come from the small hand-maintained JSON files beside kb.json.
 *
 * Output is deterministic: fixed iteration order, no timestamps.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import {
  BODIES, EXTRA_BODIES, SIGNS, ASPECTS, DEFAULT_ORBS, HOUSE_SYSTEMS,
  element, modality, DOMICILE, EXALTATION,
  TRIPLICITY, TERMS_EGYPTIAN, FACE_CYCLE, DIGNITY_WEIGHTS,
  NAKSHATRAS, VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS, VARGA_DIVISIONS,
  HERMETIC_LOTS, detectYogas,
} from "caelus";
import type { ConceptNode, ConceptEdge } from "./types.js";
import { slug, bodyLabel } from "./ids.js";

const require = createRequire(import.meta.url);
const DATA_DIR = new URL("../../data/", import.meta.url);

function curated<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(file, DATA_DIR), "utf8")) as T;
}

// ------------------------------------------------------------------ curated
interface Tradition { id: string; label: string; period: string; note: string }
interface Source { id: string; title: string; author: string; year: number; rights: string }
interface HouseTopics { house: number; topics: string[]; attestedIn: string }

// -------------------------------------------------------------- engine data
/** The engine's shipped star catalog, resolved through its public
 *  `./package.json` export (the data files ship with the package but are not
 *  in its exports map). */
function engineData<T>(rel: string): T {
  const pkgDir = dirname(require.resolve("caelus/package.json"));
  return JSON.parse(readFileSync(join(pkgDir, rel), "utf8")) as T;
}

interface StarCatalog {
  stars: Record<string, { ra: number; dec: number; mag: number; bayer: string }>;
}
interface ConstellationData {
  labels: Array<{ name: string; con: string }>;
}
interface Correspondences {
  correspondences: Array<{
    body?: string;
    source: { locus: string };
    tarot?: string;
    color?: string;
    greekGod?: string;
    romanGod?: string;
  }>;
}

// ------------------------------------------------------ derivation helpers
/** The 12 firdaria/dasha lords that are not chart bodies: the nodes under
 *  their Vedic and firdaria names. They appear as time-lord edge and parse
 *  targets (`dasha:maha:rahu`, `firdaria:major:north_node`), so the graph
 *  carries them as Body nodes. */
const NODE_ALIASES = ["rahu", "ketu", "north_node", "south_node"];

/** Harvest the engine's named yogas through its public `detectYogas`,
 *  since the name tables themselves are module-private. Mahapurusha yogas
 *  fire one at a time (the planet in its domicile on the Ascendant, the
 *  rest in the 2nd); the pair yogas fire together (everything in one
 *  non-kendra sign). */
function namedYogas(): Array<{ name: string; planets: string[] }> {
  const found = new Map<string, string[]>();
  const seven = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
  for (const p of ["mars", "mercury", "jupiter", "venus", "saturn"]) {
    const d = DOMICILE[p][0];
    const signs: Record<string, number> = {};
    for (const q of seven) signs[q] = (d + 1) % 12;
    signs[p] = d;
    for (const y of detectYogas(signs, d)) {
      if (y.planets.length === 1 && y.planets[0] === p) found.set(y.yoga, y.planets);
    }
  }
  const together: Record<string, number> = {};
  for (const q of seven) together[q] = 1; // all in Taurus, Aries rising: 2nd house
  for (const y of detectYogas(together, 0)) {
    if (y.planets.length === 2) found.set(y.yoga, y.planets);
  }
  return [...found.entries()].map(([name, planets]) => ({ name, planets }));
}

/** The Hermetic lot formulas: day formula `Asc + added - subtracted`,
 *  reversed by night. NOT exported by the engine -- the operand table lives
 *  inside `hermeticLots()` in packages/caelus/src/lots.ts; vendored here
 *  verbatim. Remove when the engine exports it. */
const LOT_OPERANDS: Record<string, { added: string; subtracted: string }> = {
  fortune: { added: "body:moon", subtracted: "body:sun" },
  spirit: { added: "body:sun", subtracted: "body:moon" },
  eros: { added: "body:venus", subtracted: "lot:spirit" },
  necessity: { added: "lot:fortune", subtracted: "body:mercury" },
  courage: { added: "lot:fortune", subtracted: "body:mars" },
  victory: { added: "body:jupiter", subtracted: "lot:spirit" },
  nemesis: { added: "lot:fortune", subtracted: "body:saturn" },
};

/** Sign polarity by index parity: the classical alternation (odd signs
 *  positive/diurnal, even negative/nocturnal). The engine has no polarity
 *  table; the rule is structural, like element = index % 4. */
function polarity(signIndex: number): "positive" | "negative" {
  return signIndex % 2 === 0 ? "positive" : "negative";
}

const VARGA_LABELS: Record<number, string> = {
  1: "D1 (rasi)", 2: "D2 (hora)", 3: "D3 (drekkana)", 9: "D9 (navamsa)",
  10: "D10 (dasamsa)", 12: "D12 (dwadasamsa)", 30: "D30 (trimsamsa)",
};

const TIMELORD_SYSTEMS: Array<{ id: string; label: string }> = [
  { id: "technique:profection", label: "Annual profections" },
  { id: "technique:zr", label: "Zodiacal releasing" },
  { id: "technique:firdaria", label: "Firdaria" },
  { id: "technique:dasha", label: "Vimshottari dasha" },
];

const CHART_TYPES: Array<{ id: string; label: string }> = [
  { id: "chart-type:natal", label: "Natal" },
  { id: "chart-type:transit", label: "Transit" },
  { id: "chart-type:synastry", label: "Synastry" },
  { id: "chart-type:composite", label: "Composite" },
  { id: "chart-type:return", label: "Planetary return" },
  { id: "chart-type:progressed", label: "Progressed" },
  { id: "chart-type:directed", label: "Directed" },
  { id: "chart-type:electional", label: "Electional" },
  { id: "chart-type:draconic", label: "Draconic" },
];

const TECHNIQUE_LABELS: Record<string, string> = {
  "technique:lots": "Hermetic lots",
  "technique:dignities": "Essential dignities",
  "technique:parans": "Parans",
  "technique:planetary-hours": "Planetary hours",
  "technique:void-of-course": "Void of course",
  "technique:rectification": "Rectification grid",
  "technique:aspect-patterns": "Aspect patterns",
  "technique:chart-signature": "Chart signature",
  "technique:nakshatras": "Nakshatras",
  "technique:vargas": "Vargas",
  "technique:yogas": "Yogas",
};

/** `"Max Heindel and Augusta Foss Heindel"` -> two persons; parentheticals
 *  (translators, birth names) are stripped from person labels. */
function personsOf(author: string): string[] {
  return author
    .replace(/\s*\([^)]*\)/g, "")
    .split(/\s+and\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ordinal = (n: number): string =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

// ------------------------------------------------------------------- build
export interface Kb {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export function buildKb(): Kb {
  const traditions = curated<Tradition[]>("traditions.json");
  const sources = curated<Source[]>("sources.json");
  const houseTopics = curated<HouseTopics[]>("house-topics.json");
  const wikidata = curated<Record<string, string>>("wikidata.json");
  const mcpTools = curated<Record<string, string>>("mcp-tools.json");
  const starCatalog = engineData<StarCatalog>("data/fixed_stars.json");
  const constellations = engineData<ConstellationData>("data/constellations.json");
  const correspondences = JSON.parse(readFileSync(
    require.resolve("caelus-delineations-pd/data/correspondences.json"), "utf8",
  )) as Correspondences;

  const nodes: ConceptNode[] = [];
  const edges: ConceptEdge[] = [];

  // Bodies: the chart set, the on-request extras, and the time-lord aliases.
  for (const b of [...BODIES, ...EXTRA_BODIES, ...NODE_ALIASES]) {
    nodes.push({ id: `body:${b}`, type: "Body", label: bodyLabel(b) });
  }

  // Signs.
  for (let i = 0; i < SIGNS.length; i++) {
    nodes.push({ id: `sign:${slug(SIGNS[i])}`, type: "Sign", label: SIGNS[i], data: { index: i } });
  }

  // Houses, with their curated traditional topics.
  const topicsByHouse = new Map(houseTopics.map((h) => [h.house, h]));
  for (let h = 1; h <= 12; h++) {
    const t = topicsByHouse.get(h);
    nodes.push({
      id: `house:${h}`, type: "House", label: `${ordinal(h)} house`,
      ...(t ? { data: { topics: t.topics } } : {}),
    });
  }

  // House systems.
  for (const hs of HOUSE_SYSTEMS) {
    nodes.push({ id: `house-system:${slug(hs)}`, type: "HouseSystem", label: bodyLabel(hs) });
  }

  // Aspect types, angle and default orb as node data.
  for (const [name, angle] of Object.entries(ASPECTS)) {
    nodes.push({
      id: `aspect:${name}`, type: "AspectType", label: bodyLabel(name),
      data: { angle, defaultOrb: DEFAULT_ORBS[name] },
    });
  }

  // Elements, modalities, polarities, sect.
  for (const e of ["fire", "earth", "air", "water"]) {
    nodes.push({ id: `element:${e}`, type: "Element", label: bodyLabel(e) });
  }
  for (const m of ["cardinal", "fixed", "mutable"]) {
    nodes.push({ id: `modality:${m}`, type: "Modality", label: bodyLabel(m) });
  }
  nodes.push({ id: "polarity:positive", type: "Polarity", label: "Positive", data: { alsoCalled: ["masculine", "diurnal"] } });
  nodes.push({ id: "polarity:negative", type: "Polarity", label: "Negative", data: { alsoCalled: ["feminine", "nocturnal"] } });
  nodes.push({ id: "sect:day", type: "Sect", label: "Day" });
  nodes.push({ id: "sect:night", type: "Sect", label: "Night" });

  // Dignity types, with Lilly's weights from the engine. The engine's
  // scoring key "rulership" is the same dignity its `dignities()` calls
  // "domicile"; the KB uses the atom/corpus vocabulary.
  const dignityKey: Record<string, string> = { domicile: "rulership" };
  for (const d of ["domicile", "exaltation", "triplicity", "term", "face", "detriment", "fall"]) {
    nodes.push({
      id: `dignity:${d}`, type: "DignityType", label: bodyLabel(d),
      data: { weight: DIGNITY_WEIGHTS[dignityKey[d] ?? d] },
    });
  }

  // Lots.
  for (const lot of HERMETIC_LOTS) {
    nodes.push({ id: `lot:${lot}`, type: "Lot", label: `Lot of ${bodyLabel(lot)}` });
  }

  // Fixed stars from the engine catalog. "Sol" is the Sun (the catalog's
  // frame anchor), not a fixed star; it is skipped.
  for (const [name, s] of Object.entries(starCatalog.stars)) {
    if (name === "Sol") continue;
    nodes.push({
      id: `star:${slug(name)}`, type: "FixedStar", label: name,
      data: { ra: s.ra, dec: s.dec, mag: s.mag, bayer: s.bayer },
    });
  }

  // Constellations from the engine's IAU label table. Serpens carries two
  // label positions (Caput and Cauda) but is one constellation: dedupe by id.
  const conByAbbr = new Map<string, string>();
  for (const c of constellations.labels) {
    const id = `constellation:${slug(c.name)}`;
    if (conByAbbr.get(c.con) === id) continue;
    conByAbbr.set(c.con, id);
    nodes.push({ id, type: "Constellation", label: c.name, data: { abbr: c.con } });
  }

  // Nakshatras.
  for (let i = 0; i < NAKSHATRAS.length; i++) {
    nodes.push({ id: `nakshatra:${slug(NAKSHATRAS[i])}`, type: "Nakshatra", label: NAKSHATRAS[i], data: { index: i } });
  }

  // Vargas.
  for (const n of VARGA_DIVISIONS) {
    nodes.push({ id: `varga:d${n}`, type: "Varga", label: VARGA_LABELS[n] ?? `D${n}`, data: { division: n } });
  }

  // Yogas, harvested from the engine's detector.
  for (const y of namedYogas()) {
    nodes.push({ id: `yoga:${slug(y.name)}`, type: "Yoga", label: y.name, data: { planets: y.planets } });
  }

  // Time-lord systems, chart types, techniques.
  for (const t of TIMELORD_SYSTEMS) nodes.push({ id: t.id, type: "TimeLordSystem", label: t.label });
  for (const c of CHART_TYPES) nodes.push({ id: c.id, type: "ChartType", label: c.label });
  const timelordIds = new Set(TIMELORD_SYSTEMS.map((t) => t.id));
  for (const id of Object.keys(mcpTools)) {
    if (!id.startsWith("technique:") || timelordIds.has(id)) continue;
    nodes.push({ id, type: "Technique", label: TECHNIQUE_LABELS[id] ?? bodyLabel(id.slice("technique:".length)) });
  }

  // Traditions, persons, source texts.
  for (const t of traditions) {
    nodes.push({ id: `tradition:${t.id}`, type: "Tradition", label: t.label, data: { period: t.period, note: t.note } });
  }
  const personIds = new Set<string>();
  for (const s of sources) {
    for (const p of personsOf(s.author)) {
      const id = `person:${slug(p)}`;
      if (personIds.has(id)) continue;
      personIds.add(id);
      nodes.push({ id, type: "Person", label: p });
    }
  }
  for (const s of sources) {
    nodes.push({
      id: `source:${s.id}`, type: "SourceText", label: s.title,
      data: {
        author: s.author, year: s.year, rights: s.rights,
        persons: personsOf(s.author).map((p) => `person:${slug(p)}`),
      },
    });
  }

  // ------------------------------------------------------------------ edges
  const signId = (i: number): string => `sign:${slug(SIGNS[((i % 12) + 12) % 12])}`;

  // Domicile rulerships and, opposite them, detriments.
  for (const [body, domiciles] of Object.entries(DOMICILE)) {
    for (const s of domiciles) edges.push({ type: "rules", from: `body:${body}`, to: signId(s) });
  }
  for (const [body, s] of Object.entries(EXALTATION)) {
    edges.push({ type: "exaltedIn", from: `body:${body}`, to: signId(s) });
  }
  for (const [body, domiciles] of Object.entries(DOMICILE)) {
    for (const s of domiciles) edges.push({ type: "detrimentIn", from: `body:${body}`, to: signId(s + 6) });
  }
  for (const [body, s] of Object.entries(EXALTATION)) {
    edges.push({ type: "fallIn", from: `body:${body}`, to: signId(s + 6) });
  }

  // Dorothean triplicity rulers, by element and sect.
  const ELEMENT_ORDER = ["fire", "earth", "air", "water"];
  const SECTS = ["day", "night", "participating"] as const;
  for (let e = 0; e < 4; e++) {
    for (let s = 0; s < 3; s++) {
      edges.push({
        type: "triplicityRuler", from: `body:${TRIPLICITY[e][s]}`,
        to: `element:${ELEMENT_ORDER[e]}`, sect: SECTS[s],
      });
    }
  }

  // Egyptian terms: per sign, ruler over a degree range.
  for (let s = 0; s < 12; s++) {
    let lower = 0;
    for (const [ruler, upper] of TERMS_EGYPTIAN[s]) {
      edges.push({ type: "termRuler", from: `body:${ruler}`, to: signId(s), fromDeg: lower, toDeg: upper });
      lower = upper;
    }
  }

  // Faces: the Chaldean cycle from Mars at 0 Aries, decans 1-3 of each sign.
  for (let s = 0; s < 12; s++) {
    for (let d = 0; d < 3; d++) {
      edges.push({
        type: "faceRuler", from: `body:${FACE_CYCLE[(s * 3 + d) % 7]}`,
        to: signId(s), decan: d + 1,
      });
    }
  }

  // Sign structure: element, modality, polarity, opposite.
  for (let i = 0; i < 12; i++) {
    edges.push({ type: "hasElement", from: signId(i), to: `element:${element(i)}` });
    edges.push({ type: "hasModality", from: signId(i), to: `modality:${modality(i)}` });
    edges.push({ type: "hasPolarity", from: signId(i), to: `polarity:${polarity(i)}` });
    edges.push({ type: "opposite", from: signId(i), to: signId(i + 6) });
  }

  // Nakshatra lords: the Vimshottari cycle, with each lord's period years.
  for (let i = 0; i < NAKSHATRAS.length; i++) {
    const lord = VIMSHOTTARI_ORDER[i % 9];
    edges.push({
      type: "nakshatraLord", from: `nakshatra:${slug(NAKSHATRAS[i])}`,
      to: `body:${lord}`, years: VIMSHOTTARI_YEARS[lord],
    });
  }

  // Star -> constellation, from the catalog's Bayer designation (its last
  // token is the IAU abbreviation). Stars without one carry no edge.
  for (const [name, s] of Object.entries(starCatalog.stars)) {
    if (name === "Sol" || !s.bayer) continue;
    const abbr = s.bayer.trim().split(/\s+/).pop() ?? "";
    const con = conByAbbr.get(abbr);
    if (con) edges.push({ type: "inConstellation", from: `star:${slug(name)}`, to: con });
  }

  // Lot formulas: day formula Asc + added - subtracted; night reverses.
  for (const lot of HERMETIC_LOTS) {
    const f = LOT_OPERANDS[lot];
    edges.push({ type: "lotFormula", from: `lot:${lot}`, to: f.added, role: "added" });
    edges.push({ type: "lotFormula", from: `lot:${lot}`, to: f.subtracted, role: "subtracted" });
  }

  // Liber 777 correspondences, read from caelus-delineations-pd at build
  // time (never copied here): one edge per entry that names a chart body.
  for (const c of correspondences.correspondences) {
    if (!c.body) continue;
    edges.push({
      type: "correspondsTo", from: `body:${c.body}`, to: "source:liber-777",
      locus: c.source.locus,
      ...(c.tarot ? { tarot: c.tarot } : {}),
      ...(c.color ? { color: c.color } : {}),
      ...(c.greekGod ? { greekGod: c.greekGod } : {}),
      ...(c.romanGod ? { romanGod: c.romanGod } : {}),
    });
  }

  // House-topic attestations.
  for (const h of houseTopics) {
    edges.push({ type: "attestedIn", from: `house:${h.house}`, to: `source:${h.attestedIn}` });
  }

  // Concept -> MCP tool name.
  for (const [concept, tool] of Object.entries(mcpTools)) {
    edges.push({ type: "computedBy", from: concept, to: tool });
  }

  // Concept -> Wikidata.
  for (const [concept, qid] of Object.entries(wikidata)) {
    edges.push({ type: "sameAs", from: concept, to: `wikidata:${qid}` });
  }

  // `starNature` and `describedBy` are declared edge types with no
  // instances yet: the repo has no structured star-nature table (Robson's
  // natures exist only as PD prose), and the encyclopedia has no slugs.

  // ------------------------------------------------------------- validation
  const ids = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    ids.add(n.id);
  }
  const external = new Set(["computedBy", "sameAs"]);
  for (const e of edges) {
    if (!ids.has(e.from)) throw new Error(`edge ${e.type}: unknown from ${e.from}`);
    if (!external.has(e.type) && !ids.has(e.to)) throw new Error(`edge ${e.type}: unknown to ${e.to}`);
  }

  return { nodes, edges };
}
