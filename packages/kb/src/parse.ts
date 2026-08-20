/**
 * Decompose engine fact-atom ids and corpus grid cell ids into concept ids.
 *
 * Atom formats are the ones `interpretationContext` emits
 * (packages/caelus/src/interpretation.ts); cell formats are the ones the
 * corpus grid enumerates (packages/caelus-corpus/src/grid.ts). The parsers
 * are pure string decomposition: they do not consult the graph, so a
 * returned id is a claim about the id's shape, not a guarantee the node
 * exists. Unknown formats return [].
 *
 * Cell-id shapes are a compatibility surface: the Encyclopedia widget
 * system's plate registry and its "In the delineation corpus" link block
 * both resolve through parseCellId (docs/product/encyclopedia-widgets-plan.md,
 * "Existing data contracts"). Changing a cell-id shape in grid.ts means
 * updating this parser and those consumers together.
 */
import { slug } from "./ids.js";

const ASPECT_NAMES = new Set(["conjunction", "sextile", "square", "trine", "opposition"]);
const SIGNATURE_FACETS = new Set(["element", "modality", "sign", "ruler"]);
const DIGNITY_STATES = new Set(["domicile", "exaltation", "detriment", "fall"]);
/** The yogas with KB concept nodes: the engine's detected set minus
 *  Kemadruma, which the KB does not carry. The grid's raja/dhana framing
 *  cells name no detected yoga and parse to []. */
const YOGA_CONCEPTS = new Set([
  "ruchaka", "bhadra", "hamsa", "malavya", "shasha", "gajakesari",
  "budha-aditya", "chandra-mangala",
]);

const body = (b: string): string => `body:${b}`;
const sign = (s: string): string => `sign:${slug(s)}`;
const house = (h: string): string => `house:${parseInt(h, 10)}`;

function pair(ab: string): [string, string] | null {
  const i = ab.indexOf("~");
  if (i <= 0 || i === ab.length - 1) return null;
  return [ab.slice(0, i), ab.slice(i + 1)];
}

function signatureConcept(facet: string, value: string): string[] {
  if (!SIGNATURE_FACETS.has(facet) || !value) return [];
  if (facet === "element") return [`element:${slug(value)}`];
  if (facet === "modality") return [`modality:${slug(value)}`];
  if (facet === "sign") return [sign(value)];
  return [body(value)]; // ruler
}

/** Concept ids named by an engine fact-atom id, e.g.
 *  `aspect:mars~saturn:square` -> `["body:mars", "body:saturn",
 *  "aspect:square"]`. Unknown formats return `[]`. */
export function parseAtomId(atomId: string): string[] {
  const p = atomId.split(":");
  switch (p[0]) {
    case "placement":
      return p.length === 2 && p[1] ? [body(p[1])] : [];
    case "aspect": {
      if (p.length !== 3 || !ASPECT_NAMES.has(p[2])) return [];
      const ab = pair(p[1]);
      return ab ? [body(ab[0]), body(ab[1]), `aspect:${p[2]}`] : [];
    }
    case "angle":
      // asc/mc/vertex/eastPoint are chart points, not KB concepts.
      return [];
    case "angleContact":
      return p.length === 3 && p[1] ? [body(p[1])] : [];
    case "degree":
      // degree:{point}:{sign}:{n} -- ordinal degree of a sign; the ASC/MC
      // points are not KB concepts, and neither is the bare degree number.
      return p.length === 4 && p[1] && p[2] && /^\d+$/.test(p[3])
        ? [...(p[1] === "asc" || p[1] === "mc" ? [] : [body(p[1])]), sign(p[2])]
        : [];
    case "oob":
      return p.length === 2 && p[1] ? [body(p[1])] : [];
    case "star":
      return p.length >= 3 && p[1] && p[2]
        ? [body(p[1]), `star:${slug(p.slice(2).join(":"))}`] : [];
    case "lot":
      return p.length === 2 && p[1] ? [`lot:${p[1]}`] : [];
    case "term":
      return p.length === 3 ? [body(p[1]), body(p[2]), "dignity:term"] : [];
    case "face":
      return p.length === 3 ? [body(p[1]), body(p[2]), "dignity:face"] : [];
    case "triplicity":
      return p.length === 2 && p[1] ? [body(p[1]), "dignity:triplicity"] : [];
    case "almuten":
      return p.length === 3 ? [body(p[1]), body(p[2])] : [];
    case "transit": {
      // transit:{t}~natal_{n}:{aspect}
      if (p.length !== 3 || !ASPECT_NAMES.has(p[2])) return [];
      const ab = pair(p[1]);
      if (!ab || !ab[1].startsWith("natal_")) return [];
      return ["chart-type:transit", body(ab[0]), body(ab[1].slice("natal_".length)), `aspect:${p[2]}`];
    }
    case "transitHouse":
      return p.length === 3 ? ["chart-type:transit", body(p[1]), house(p[2])] : [];
    case "station":
      return p.length === 3 && p[1] ? [body(p[1])] : [];
    case "return":
      return p.length === 3 && p[1] ? ["chart-type:return", body(p[1])] : [];
    case "lunation":
      // lunation:{phase} or lunation:{phase}:eclipse:{kind}
      if (p.length !== 2 && !(p.length === 4 && p[2] === "eclipse")) return [];
      return ["body:moon"];
    case "solarPhase":
      return p.length === 3 && p[1] ? [body(p[1]), "body:sun"] : [];
    case "synastry": {
      if (p[1] === "overlay") {
        // synastry:overlay:{a|b}:{body}:house:{house}
        return p.length === 6 && p[4] === "house"
          ? ["chart-type:synastry", body(p[3]), house(p[5])] : [];
      }
      // synastry:{a}~b_{b}:{aspect}
      if (p.length !== 3 || !ASPECT_NAMES.has(p[2])) return [];
      const ab = pair(p[1]);
      if (!ab || !ab[1].startsWith("b_")) return [];
      return ["chart-type:synastry", body(ab[0]), body(ab[1].slice(2)), `aspect:${p[2]}`];
    }
    case "composite": {
      if (p.length === 2 && p[1] && !p[1].includes("~")) {
        return ["chart-type:composite", body(p[1])];
      }
      // composite:{a}~{b}:{aspect}
      if (p.length !== 3 || !ASPECT_NAMES.has(p[2])) return [];
      const ab = pair(p[1]);
      return ab ? ["chart-type:composite", body(ab[0]), body(ab[1]), `aspect:${p[2]}`] : [];
    }
    case "profection":
      // profection:{year|month}:{sign}:{lord}
      return p.length === 4 && (p[1] === "year" || p[1] === "month")
        ? ["technique:profection", sign(p[2]), body(p[3])] : [];
    case "zr":
      // zr:{level}:{sign}:{lord}; the lord can be empty for an unknown sign.
      if (p.length !== 4 || !p[1] || !p[2]) return [];
      return ["technique:zr", sign(p[2]), ...(p[3] ? [body(p[3])] : [])];
    case "firdaria":
      return p.length === 3 && (p[1] === "major" || p[1] === "sub")
        ? ["technique:firdaria", body(p[2])] : [];
    case "dasha":
      return p.length === 3 && p[1] && p[2] ? ["technique:dasha", body(p[2])] : [];
    case "nakshatra":
      return p.length === 3 && p[1] && p[2] ? [body(p[1]), `nakshatra:${slug(p[2])}`] : [];
    case "varga":
      // varga:d{n}:{body}:{sign}
      return p.length === 4 && /^d\d+$/.test(p[1])
        ? [`varga:${p[1]}`, body(p[2]), sign(p[3])] : [];
    case "yoga":
      return p.length === 2 && p[1] ? [`yoga:${slug(p[1])}`] : [];
    case "parallel": {
      if (p.length !== 3 || (p[2] !== "parallel" && p[2] !== "contraparallel")) return [];
      const ab = pair(p[1]);
      return ab ? [body(ab[0]), body(ab[1])] : [];
    }
    case "reception": {
      if (p.length !== 2) return [];
      const ab = pair(p[1]);
      return ab ? [body(ab[0]), body(ab[1])] : [];
    }
    case "dispositor":
      return p.length === 2 && p[1] ? [body(p[1])] : [];
    case "pattern":
      // pattern:{kind}:{bodies-joined-by-hyphen}
      return p.length === 3 && p[1] && p[2]
        ? p[2].split("-").filter(Boolean).map(body) : [];
    case "signature":
      return p.length === 3 ? signatureConcept(p[1], p[2]) : [];
    default:
      return [];
  }
}

/** Concept ids named by a corpus grid cell id, e.g.
 *  `transit:saturn:house:7` -> `["chart-type:transit", "body:saturn",
 *  "house:7"]`. Unknown formats return `[]`. */
export function parseCellId(cellId: string): string[] {
  const p = cellId.split(":");
  switch (p[0]) {
    case "natal": {
      const natal = "chart-type:natal";
      if (p[1] === "aspect") {
        // natal:aspect:{a}:{aspect}:{b}
        return p.length === 5 && ASPECT_NAMES.has(p[3])
          ? [natal, body(p[2]), `aspect:${p[3]}`, body(p[4])] : [];
      }
      if ((p[1] === "asc" || p[1] === "mc") && p[2] === "sign") {
        return p.length === 4 ? [natal, sign(p[3])] : [];
      }
      if (p[1] === "pattern") {
        // natal:pattern:{kind} or natal:pattern:{kind}:apex:{body}
        if (p.length === 3) return [natal];
        return p.length === 5 && p[3] === "apex" ? [natal, body(p[4])] : [];
      }
      if (p[1] === "signature") {
        return p.length === 4 ? [natal, ...signatureConcept(p[2], p[3])] : [];
      }
      if (p[1] === "lot") {
        // natal:lot:{lot}:sign:{sign} or natal:lot:{lot}:house:{n}
        if (!p[2]) return [];
        if (p.length === 5 && p[3] === "sign") return [natal, `lot:${p[2]}`, sign(p[4])];
        if (p.length === 5 && p[3] === "house") return [natal, `lot:${p[2]}`, house(p[4])];
        return [];
      }
      if (p[1] === "dispositor") {
        // natal:dispositor:final:{body}; no dispositor concept node, so the
        // body alone, as parseAtomId does for dispositor atoms.
        return p.length === 4 && p[2] === "final" && p[3] ? [natal, body(p[3])] : [];
      }
      if (p[1] === "reception") {
        // natal:reception:body:{body}, or natal:reception:{route} where the
        // route names the dignities involved; no reception concept node.
        if (p.length === 4 && p[2] === "body" && p[3]) return [natal, body(p[3])];
        if (p.length === 3 && p[2] === "domicile") return [natal, "dignity:domicile"];
        if (p.length === 3 && p[2] === "exaltation") return [natal, "dignity:exaltation"];
        if (p.length === 3 && p[2] === "domicile-exaltation")
          return [natal, "dignity:domicile", "dignity:exaltation"];
        return [];
      }
      if (p[1] === "star") {
        // natal:star:{star} or natal:star:{star}:{body}; the id segment is
        // the star's slugged catalog name.
        if (!p[2]) return [];
        if (p.length === 3) return [natal, `star:${p[2]}`];
        if (p.length === 4 && p[3]) return [natal, `star:${p[2]}`, body(p[3])];
        return [];
      }
      if (p[1] === "parallel") {
        // natal:parallel:{a}:{b}; declination parallels carry no aspect node.
        return p.length === 4 && p[2] && p[3] ? [natal, body(p[2]), body(p[3])] : [];
      }
      // natal:{body}:...
      if (p.length === 4 && p[2] === "sign") return [natal, body(p[1]), sign(p[3])];
      if (p.length === 4 && p[2] === "house") return [natal, body(p[1]), house(p[3])];
      if (p.length === 4 && p[2] === "on") return [natal, body(p[1])];
      if (p.length === 4 && p[2] === "dignity") {
        // peregrine is an absence, not a DignityType node.
        return [natal, body(p[1]), ...(DIGNITY_STATES.has(p[3]) ? [`dignity:${p[3]}`] : [])];
      }
      if (p.length === 3 && (p[2] === "oob" || p[2] === "retrograde")) return [natal, body(p[1])];
      return [];
    }
    case "transit": {
      const transit = "chart-type:transit";
      if (p.length === 4 && p[2] === "house") return [transit, body(p[1]), house(p[3])];
      if (p.length === 4 && p[2] === "station") return [transit, body(p[1])];
      // transit:{t}:{aspect}:{n}
      return p.length === 4 && ASPECT_NAMES.has(p[2])
        ? [transit, body(p[1]), `aspect:${p[2]}`, body(p[3])] : [];
    }
    case "timelord": {
      if (p[1] === "profection") {
        // timelord:profection:{year|month}:{house|lord}:{value}
        if (p.length !== 5 || (p[2] !== "year" && p[2] !== "month")) return [];
        if (p[3] === "house") return ["technique:profection", house(p[4])];
        if (p[3] === "lord") return ["technique:profection", body(p[4])];
        return [];
      }
      if (p[1] === "zr") {
        // timelord:zr:{level}:{sign}
        return p.length === 4 ? ["technique:zr", sign(p[3])] : [];
      }
      if (p[1] === "firdaria") {
        if (p.length === 4 && p[2] === "major") return ["technique:firdaria", body(p[3])];
        if (p.length === 5 && p[2] === "sub") return ["technique:firdaria", body(p[3]), body(p[4])];
        return [];
      }
      if (p[1] === "dasha") {
        if (p.length === 4 && p[2] === "maha") return ["technique:dasha", body(p[3])];
        if (p.length === 5 && p[2] === "antar") return ["technique:dasha", body(p[3]), body(p[4])];
        return [];
      }
      return [];
    }
    case "sky": {
      // sky:lunation:{phase}:house:{n}, sky:eclipse:house:{n},
      // sky:lunation:on-natal, sky:eclipse:on-natal
      if (p[1] === "lunation" && p.length === 5 && p[3] === "house") return ["body:moon", house(p[4])];
      if (p[1] === "eclipse" && p.length === 4 && p[2] === "house") return ["body:moon", house(p[3])];
      if ((p[1] === "lunation" || p[1] === "eclipse") && p.length === 3 && p[2] === "on-natal") return ["body:moon"];
      return [];
    }
    case "return":
      // return:{body} or return:saturn:{nth}
      return (p.length === 2 || p.length === 3) && p[1]
        ? ["chart-type:return", body(p[1])] : [];
    case "condition":
      // condition:{body}:{phase}
      return p.length === 3 && p[1] ? [body(p[1]), "body:sun"] : [];
    case "synastry": {
      const syn = "chart-type:synastry";
      if (p[1] === "overlay") {
        // synastry:overlay:{body}:house:{n}
        return p.length === 5 && p[3] === "house" ? [syn, body(p[2]), house(p[4])] : [];
      }
      // synastry:{a}:{aspect}:{b}
      return p.length === 4 && ASPECT_NAMES.has(p[2])
        ? [syn, body(p[1]), `aspect:${p[2]}`, body(p[3])] : [];
    }
    case "composite": {
      const comp = "chart-type:composite";
      if (p[1] === "aspect") {
        // composite:aspect:{a}:{aspect}:{b}
        return p.length === 5 && ASPECT_NAMES.has(p[3])
          ? [comp, body(p[2]), `aspect:${p[3]}`, body(p[4])] : [];
      }
      if (p.length === 4 && p[2] === "sign") return [comp, body(p[1]), sign(p[3])];
      if (p.length === 4 && p[2] === "house") return [comp, body(p[1]), house(p[3])];
      return [];
    }
    case "vedic": {
      if (p[1] === "moon" && p[2] === "nakshatra") {
        // vedic:moon:nakshatra:{name}, optionally with :pada:{n}; the pada
        // refines the mansion but carries no concept node of its own.
        if (p.length === 4 && p[3]) return [body("moon"), `nakshatra:${p[3]}`];
        if (p.length === 6 && p[3] && p[4] === "pada" && /^\d+$/.test(p[5]))
          return [body("moon"), `nakshatra:${p[3]}`];
        return [];
      }
      if (p[1] === "varga") {
        // vedic:varga:d9:{body}:{sign} or vedic:varga:frame:d{n}
        if (p.length === 5 && /^d\d+$/.test(p[2]))
          return [`varga:${p[2]}`, body(p[3]), sign(p[4])];
        if (p.length === 4 && p[2] === "frame" && /^d\d+$/.test(p[3]))
          return [`varga:${p[3]}`];
        return [];
      }
      if (p[1] === "yoga") {
        return p.length === 3 && YOGA_CONCEPTS.has(p[2]) ? [`yoga:${p[2]}`] : [];
      }
      return [];
    }
    default:
      return [];
  }
}
