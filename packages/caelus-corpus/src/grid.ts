/**
 * The B1 content grid (build-plan §4): every cell the batch must fill,
 * enumerated so coverage is a computation, not a claim. A cell names its
 * family, the selector it binds through, and the atom-id prefixes its text
 * may cite. The lint reports written vs remaining per family.
 *
 * Cells marked `bindable: false` name a real product surface whose atoms
 * the interpretation projection does not emit yet (angle conjunctions need
 * planet-on-angle atoms); they stay in the grid so the gap is visible, and
 * flip to bindable when the projection learns them.
 */
import type { SelectorSpec, CellFamily } from "./types.js";

export interface GridCell {
  id: string;
  family: CellFamily;
  when: SelectorSpec;
  atomIds: string[];
  /** Human title for briefs and review, e.g. "Sun in Aries". */
  title: string;
  bindable: boolean;
}

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
  "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** The ten planets of the aspect/dignity grids. */
const PLANETS = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto",
] as const;

/** The placement grid bodies: planets plus Chiron and the north node.
 *  Node cells are written once against `true_node`; the build mirrors the
 *  rule to `mean_node` so either node setting fires the same text. */
const PLACEMENT_BODIES = [...PLANETS, "chiron", "true_node"] as const;

const NAMES: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
  pluto: "Pluto", chiron: "Chiron", true_node: "North Node",
};

const ASPECTS = ["conjunction", "sextile", "square", "trine", "opposition"] as const;
const ASPECT_NAMES: Record<string, string> = {
  conjunction: "conjunct", sextile: "sextile", square: "square",
  trine: "trine", opposition: "opposite",
};

const DIGNITY_STATES = ["domicile", "exaltation", "detriment", "fall", "peregrine"] as const;

const PATTERN_KINDS = [
  "t_square", "grand_trine", "grand_cross", "yod", "kite",
  "mystic_rectangle", "stellium_sign", "stellium_house",
] as const;

const PATTERN_TITLES: Record<string, string> = {
  t_square: "T-square", grand_trine: "Grand trine", grand_cross: "Grand cross",
  yod: "Yod", kite: "Kite", mystic_rectangle: "Mystic rectangle",
  stellium_sign: "Stellium by sign", stellium_house: "Stellium by house",
};

const ELEMENTS = ["fire", "earth", "air", "water"] as const;
const MODALITIES = ["cardinal", "fixed", "mutable"] as const;
/** Classical chart rulers the signature projection can emit. */
const RULERS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const;

const OOB_BODIES = [
  "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto",
] as const;

const RETRO_BODIES = [
  "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron",
] as const;

const ANGLES = ["asc", "dsc", "mc", "ic"] as const;
const ANGLE_NAMES: Record<string, string> = {
  asc: "Ascendant", dsc: "Descendant", mc: "Midheaven", ic: "IC",
};

const ordinal = (n: number): string =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function b1Grid(): GridCell[] {
  const cells: GridCell[] = [];

  // planet-in-sign: 12 bodies x 12 signs
  for (const body of PLACEMENT_BODIES) {
    for (const sign of SIGNS) {
      cells.push({
        id: `natal:${body}:sign:${sign.toLowerCase()}`,
        family: "planet-in-sign",
        when: { kind: "placement", body, sign },
        atomIds: [`placement:${body}`],
        title: `${NAMES[body]} in ${sign}`,
        bindable: true,
      });
    }
  }

  // planet-in-house: 12 bodies x 12 houses
  for (const body of PLACEMENT_BODIES) {
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `natal:${body}:house:${house}`,
        family: "planet-in-house",
        when: { kind: "placement", body, house },
        atomIds: [`placement:${body}`],
        title: `${NAMES[body]} in the ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  // aspects: unordered pairs over planets + chiron + node, 5 aspects
  for (let i = 0; i < PLACEMENT_BODIES.length; i++) {
    for (let j = i + 1; j < PLACEMENT_BODIES.length; j++) {
      const a = PLACEMENT_BODIES[i];
      const b = PLACEMENT_BODIES[j];
      for (const aspect of ASPECTS) {
        cells.push({
          id: `natal:aspect:${a}:${aspect}:${b}`,
          family: "aspect",
          when: { kind: "aspect", a, b, aspect },
          atomIds: [`aspect:${a}~${b}:${aspect}`, `aspect:${b}~${a}:${aspect}`],
          title: `${NAMES[a]} ${ASPECT_NAMES[aspect]} ${NAMES[b]}`,
          bindable: true,
        });
      }
    }
  }

  // rising sign and MC sign
  for (const sign of SIGNS) {
    cells.push({
      id: `natal:asc:sign:${sign.toLowerCase()}`,
      family: "rising-sign",
      when: { kind: "angle", angle: "asc", sign },
      atomIds: ["angle:asc"],
      title: `${sign} rising`,
      bindable: true,
    });
    cells.push({
      id: `natal:mc:sign:${sign.toLowerCase()}`,
      family: "mc-sign",
      when: { kind: "angle", angle: "mc", sign },
      atomIds: ["angle:mc"],
      title: `Midheaven in ${sign}`,
      bindable: true,
    });
  }

  // angle conjunctions: planet on ASC/DSC/MC/IC, bound through the
  // projection's angleContact atoms.
  for (const body of PLACEMENT_BODIES) {
    for (const angle of ANGLES) {
      cells.push({
        id: `natal:${body}:on:${angle}`,
        family: "angle-conjunction",
        when: { kind: "angleContact", body, angle },
        atomIds: [`angleContact:${body}:${angle}`],
        title: `${NAMES[body]} on the ${ANGLE_NAMES[angle]}`,
        bindable: true,
      });
    }
  }

  // dignities: 10 planets x 5 states
  for (const body of PLANETS) {
    for (const state of DIGNITY_STATES) {
      cells.push({
        id: `natal:${body}:dignity:${state}`,
        family: "dignity",
        when: { kind: "placement", body, dignity: state },
        atomIds: [`placement:${body}`],
        title: `${NAMES[body]} in ${state}`,
        bindable: true,
      });
    }
  }

  // patterns: 8 kinds + apex variants for t-square and yod
  for (const kind of PATTERN_KINDS) {
    cells.push({
      id: `natal:pattern:${kind}`,
      family: "pattern",
      when: { kind: "pattern", pattern: kind },
      atomIds: [`pattern:${kind}`],
      title: PATTERN_TITLES[kind],
      bindable: true,
    });
  }
  for (const kind of ["t_square", "yod"] as const) {
    for (const body of PLANETS) {
      cells.push({
        id: `natal:pattern:${kind}:apex:${body}`,
        family: "pattern",
        when: { kind: "pattern", pattern: kind, body },
        atomIds: [`pattern:${kind}`],
        title: `${PATTERN_TITLES[kind]} with ${NAMES[body]} at the apex`,
        bindable: true,
      });
    }
  }

  // signature: dominant element/modality, most-occupied sign, chart ruler
  for (const el of ELEMENTS) {
    cells.push({
      id: `natal:signature:element:${el}`,
      family: "signature",
      when: { kind: "signature", facet: "element", value: el },
      atomIds: [`signature:element:${el}`],
      title: `Dominant element: ${el}`,
      bindable: true,
    });
  }
  for (const mo of MODALITIES) {
    cells.push({
      id: `natal:signature:modality:${mo}`,
      family: "signature",
      when: { kind: "signature", facet: "modality", value: mo },
      atomIds: [`signature:modality:${mo}`],
      title: `Dominant modality: ${mo}`,
      bindable: true,
    });
  }
  for (const sign of SIGNS) {
    cells.push({
      id: `natal:signature:sign:${sign.toLowerCase()}`,
      family: "signature",
      when: { kind: "signature", facet: "sign", value: sign },
      atomIds: [`signature:sign:${sign}`],
      title: `Most-occupied sign: ${sign}`,
      bindable: true,
    });
  }
  for (const ruler of RULERS) {
    cells.push({
      id: `natal:signature:ruler:${ruler}`,
      family: "signature",
      when: { kind: "signature", facet: "ruler", value: ruler },
      atomIds: [`signature:ruler:${ruler}`],
      title: `${NAMES[ruler]} rules the chart`,
      bindable: true,
    });
  }

  // out of bounds
  for (const body of OOB_BODIES) {
    cells.push({
      id: `natal:${body}:oob`,
      family: "out-of-bounds",
      when: { kind: "outOfBounds", body },
      atomIds: [`oob:${body}`],
      title: `${NAMES[body]} out of bounds`,
      bindable: true,
    });
  }

  // natal retrogrades
  for (const body of RETRO_BODIES) {
    cells.push({
      id: `natal:${body}:retrograde`,
      family: "natal-retrograde",
      when: { kind: "placement", body, retrograde: true },
      atomIds: [`placement:${body}`],
      title: `${NAMES[body]} retrograde at birth`,
      bindable: true,
    });
  }

  return cells;
}

/** The transiting bodies of the B2 grid (proposal §6: 10 transiting). */
const TRANSITING = PLANETS;

/** Natal targets for transit aspects: planets, Chiron, and the node.
 *  Node-target cells bind through `transitAspects`' explicit node-target
 *  lane (the engine's pair search still excludes nodes via
 *  NOT_ASPECTABLE; the natal node joins as a target only). */
const TRANSIT_TARGETS = PLACEMENT_BODIES;

/** Bodies whose stations the transit-station family covers. */
const STATION_BODIES = [
  "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron",
] as const;

/**
 * The B2 content grid (build-plan §4): transits by aspect, transits
 * through houses, and stations. Transit-house and station cells bind
 * through the projection's `transitHouse` and `station` atoms (engine
 * work landed with goldens beside this batch), node-target cells through
 * the node-target lane of `transitAspects` (same shape, engine work with
 * goldens beside the B2 finish).
 */
export function b2Grid(): GridCell[] {
  const cells: GridCell[] = [];

  // transits by aspect: 10 transiting x 12 natal targets x 5 aspects
  for (const t of TRANSITING) {
    for (const n of TRANSIT_TARGETS) {
      for (const aspect of ASPECTS) {
        cells.push({
          id: `transit:${t}:${aspect}:${n}`,
          family: "transit-aspect",
          when: { kind: "transit", transit: t, natal: n, aspect },
          atomIds: [`transit:${t}~natal_${n}:${aspect}`],
          title: `Transiting ${NAMES[t]} ${ASPECT_NAMES[aspect]} your natal ${NAMES[n]}`,
          bindable: true,
        });
      }
    }
  }

  // transits through houses: 10 transiting x 12 houses
  for (const t of TRANSITING) {
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `transit:${t}:house:${house}`,
        family: "transit-house",
        when: { kind: "transitHouse", body: t, house },
        atomIds: [`transitHouse:${t}:${house}`],
        title: `${NAMES[t]} moving through your ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  // stations: 9 bodies x retrograde/direct
  for (const b of STATION_BODIES) {
    for (const dir of ["retrograde", "direct"] as const) {
      cells.push({
        id: `transit:${b}:station:${dir}`,
        family: "transit-station",
        when: { kind: "station", body: b, direction: dir },
        atomIds: [`station:${b}:${dir}`],
        title: `${NAMES[b]} stations ${dir}`,
        bindable: true,
      });
    }
  }

  return cells;
}

/** The seven classical profection-year lords (the outers never rule a sign
 *  in the traditional scheme the profection wheel uses). */
const PROFECTION_LORDS = RULERS;

/** The nine firdaria majors in cycle order; the two nodes close the
 *  sequence and carry no sub-periods. */
const FIRDARIA_MAJORS = [
  "sun", "venus", "mercury", "moon", "saturn", "jupiter", "mars",
  "north_node", "south_node",
] as const;
const FIRDARIA_SUBS = [
  "sun", "venus", "mercury", "moon", "saturn", "jupiter", "mars",
] as const;

/** The nine vimshottari lords in dasha order. */
const DASHA_LORDS = [
  "ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury",
] as const;

const B4_NAMES: Record<string, string> = {
  ...NAMES,
  north_node: "North Node", south_node: "South Node",
  rahu: "Rahu", ketu: "Ketu",
};

/** The solar-condition ladder bodies (the classical five; the projection
 *  computes the ladder for exactly these). */
const SOLAR_PHASE_BODIES = ["mercury", "venus", "mars", "jupiter", "saturn"] as const;
const SOLAR_PHASES = ["cazimi", "combust", "under_beams"] as const;
const SOLAR_PHASE_TITLES: Record<string, string> = {
  cazimi: "cazimi (in the heart of the Sun)",
  combust: "combust",
  under_beams: "under the Sun's beams",
};

/**
 * The B4 content grid (build-plan §4): time-lords (profection, zodiacal
 * releasing, firdaria, dasha -- majors and period pairs), lunations and
 * eclipses in the natal houses, planetary-return framings, and the solar
 * condition ladder. Binds through the projection's timelord (house/under),
 * lunation, return, and solarPhase atoms (engine work landed with goldens
 * beside this batch).
 */
export function b4Grid(): GridCell[] {
  const cells: GridCell[] = [];

  // Profection year by house (the invariant frame: the year of the Nth
  // house, whatever the rising sign), the seven possible year lords, and
  // the profection month by house.
  for (let house = 1; house <= 12; house++) {
    cells.push({
      id: `timelord:profection:year:house:${house}`,
      family: "timelord-profection",
      when: { kind: "timelord", system: "profection", level: "year", house },
      atomIds: ["profection:year:"],
      title: `A ${ordinal(house)}-house profection year`,
      bindable: true,
    });
  }
  for (const lord of PROFECTION_LORDS) {
    cells.push({
      id: `timelord:profection:year:lord:${lord}`,
      family: "timelord-profection",
      when: { kind: "timelord", system: "profection", level: "year", lord },
      atomIds: ["profection:year:"],
      title: `${NAMES[lord]} as lord of the year`,
      bindable: true,
    });
  }
  for (let house = 1; house <= 12; house++) {
    cells.push({
      id: `timelord:profection:month:house:${house}`,
      family: "timelord-profection",
      when: { kind: "timelord", system: "profection", level: "month", house },
      atomIds: ["profection:month:"],
      title: `A ${ordinal(house)}-house profection month`,
      bindable: true,
    });
  }

  // Zodiacal releasing: the L1 chapter and the L2 sub-chapter, by sign.
  for (const level of ["l1", "l2"] as const) {
    for (const sign of SIGNS) {
      cells.push({
        id: `timelord:zr:${level}:${sign.toLowerCase()}`,
        family: "timelord-zr",
        when: { kind: "timelord", system: "zr", level, sign },
        atomIds: [`zr:${level}:`],
        title: level === "l1"
          ? `A ${sign} chapter (zodiacal releasing L1)`
          : `A ${sign} sub-chapter (zodiacal releasing L2)`,
        bindable: true,
      });
    }
  }

  // Firdaria: the nine majors, and every major-sub pair (the seven planets
  // carry subs; the node periods close the cycle without them).
  for (const major of FIRDARIA_MAJORS) {
    cells.push({
      id: `timelord:firdaria:major:${major}`,
      family: "timelord-firdaria",
      when: { kind: "timelord", system: "firdaria", level: "major", lord: major },
      atomIds: ["firdaria:major:"],
      title: `The ${B4_NAMES[major]} firdaria (major period)`,
      bindable: true,
    });
  }
  for (const major of FIRDARIA_SUBS) {
    for (const sub of FIRDARIA_SUBS) {
      cells.push({
        id: `timelord:firdaria:sub:${major}:${sub}`,
        family: "timelord-firdaria",
        when: { kind: "timelord", system: "firdaria", level: "sub", lord: sub, under: major },
        atomIds: ["firdaria:sub:", "firdaria:major:"],
        title: `${B4_NAMES[sub]} sub-period of the ${B4_NAMES[major]} firdaria`,
        bindable: true,
      });
    }
  }

  // Vimshottari dasha: the nine mahadashas, and every maha-antar pair.
  for (const maha of DASHA_LORDS) {
    cells.push({
      id: `timelord:dasha:maha:${maha}`,
      family: "timelord-dasha",
      when: { kind: "timelord", system: "dasha", level: "maha", lord: maha },
      atomIds: ["dasha:maha:"],
      title: `The ${B4_NAMES[maha]} mahadasha`,
      bindable: true,
    });
  }
  for (const maha of DASHA_LORDS) {
    for (const antar of DASHA_LORDS) {
      cells.push({
        id: `timelord:dasha:antar:${maha}:${antar}`,
        family: "timelord-dasha",
        when: { kind: "timelord", system: "dasha", level: "antar", lord: antar, under: maha },
        atomIds: ["dasha:antar:", "dasha:maha:"],
        title: `${B4_NAMES[antar]} antardasha in the ${B4_NAMES[maha]} mahadasha`,
        bindable: true,
      });
    }
  }

  // Lunations in the natal houses: the New Moon and the Full Moon, each
  // through the twelve houses.
  for (const phase of ["new", "full"] as const) {
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `sky:lunation:${phase}:house:${house}`,
        family: "lunation-house",
        when: { kind: "lunation", phase, house },
        atomIds: [`lunation:${phase}`],
        title: `A ${phase === "new" ? "New" : "Full"} Moon in your ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  // Eclipses: an eclipse of either kind through the twelve houses, plus the
  // on-a-natal-planet framings (a lunation on a natal body; an eclipse on
  // one).
  for (let house = 1; house <= 12; house++) {
    cells.push({
      id: `sky:eclipse:house:${house}`,
      family: "eclipse",
      when: { kind: "lunation", eclipse: true, house },
      atomIds: ["lunation:"],
      title: `An eclipse in your ${ordinal(house)} house`,
      bindable: true,
    });
  }
  cells.push({
    id: "sky:lunation:on-natal",
    family: "eclipse",
    when: { kind: "lunation", anyOnNatal: true },
    atomIds: ["lunation:"],
    title: "A lunation lands on one of your natal planets",
    bindable: true,
  });
  cells.push({
    id: "sky:eclipse:on-natal",
    family: "eclipse",
    when: { kind: "lunation", eclipse: true, anyOnNatal: true },
    atomIds: ["lunation:"],
    title: "An eclipse lands on one of your natal planets",
    bindable: true,
  });

  // Planetary returns: the twelve framings (Saturn's three numbered).
  const returnCells: Array<{ id: string; when: SelectorSpec; title: string }> = [
    { id: "return:sun", when: { kind: "return", body: "sun" }, title: "Your solar return (the birthday chart)" },
    { id: "return:moon", when: { kind: "return", body: "moon" }, title: "Your lunar return (the month's chart)" },
    { id: "return:mercury", when: { kind: "return", body: "mercury" }, title: "Your Mercury return" },
    { id: "return:venus", when: { kind: "return", body: "venus" }, title: "Your Venus return" },
    { id: "return:mars", when: { kind: "return", body: "mars" }, title: "Your Mars return" },
    { id: "return:jupiter", when: { kind: "return", body: "jupiter" }, title: "Your Jupiter return" },
    { id: "return:saturn:1", when: { kind: "return", body: "saturn", nth: 1 }, title: "Your first Saturn return" },
    { id: "return:saturn:2", when: { kind: "return", body: "saturn", nth: 2 }, title: "Your second Saturn return" },
    { id: "return:saturn:3", when: { kind: "return", body: "saturn", minNth: 3 }, title: "Your third Saturn return" },
    { id: "return:uranus", when: { kind: "return", body: "uranus" }, title: "Your Uranus return" },
    { id: "return:chiron", when: { kind: "return", body: "chiron" }, title: "Your Chiron return" },
    { id: "return:true_node", when: { kind: "return", body: "true_node" }, title: "Your nodal return" },
  ];
  for (const r of returnCells) {
    cells.push({
      id: r.id, family: "planetary-return", when: r.when,
      atomIds: [r.id.startsWith("return:saturn") ? "return:saturn:" : `${r.id}:`],
      title: r.title, bindable: true,
    });
  }

  // The solar-condition ladder: cazimi / combust / under the beams for the
  // classical five. Fires on natal charts and on the moving sky alike.
  for (const body of SOLAR_PHASE_BODIES) {
    for (const phase of SOLAR_PHASES) {
      cells.push({
        id: `condition:${body}:${phase}`,
        family: "solar-phase",
        when: { kind: "solarPhase", body, phase },
        atomIds: [`solarPhase:${body}:${phase}`],
        title: `${NAMES[body]} ${SOLAR_PHASE_TITLES[phase]}`,
        bindable: true,
      });
    }
  }

  return cells;
}

/**
 * The B3 content grid (build-plan §4): two charts against each other.
 * Synastry aspects are ORDERED pairs (your Mars to their Venus is not
 * their Mars to yours), so the grid runs 10 x 10 x 5. House overlays are
 * written for one direction, `partner: "a"` -- your body in their house;
 * the People surface reads the other direction by swapping which chart is
 * A, exactly as the engine's `synastryOverlays` reports both ways.
 * Composite placements bind through the midpoint-composite atoms, which
 * carry a body and a sign (the composite chart has no houses of its own
 * until a Davison instant is cast).
 */
export function b3Grid(): GridCell[] {
  const cells: GridCell[] = [];

  // synastry by aspect: 10 of yours x 10 of theirs x 5 aspects
  for (const a of PLANETS) {
    for (const b of PLANETS) {
      for (const aspect of ASPECTS) {
        cells.push({
          id: `synastry:${a}:${aspect}:${b}`,
          family: "synastry-aspect",
          when: { kind: "synastry", mode: "aspect", a, b, aspect },
          atomIds: [`synastry:${a}~b_${b}:${aspect}`],
          title: `Your ${NAMES[a]} ${ASPECT_NAMES[aspect]} their ${NAMES[b]}`,
          bindable: true,
        });
      }
    }
  }

  // house overlays: 10 of your bodies x their 12 houses
  for (const body of PLANETS) {
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `synastry:overlay:${body}:house:${house}`,
        family: "synastry-overlay",
        when: { kind: "synastry", mode: "overlay", body, partner: "a", house },
        atomIds: [`synastry:overlay:a:${body}:house:${house}`],
        title: `Your ${NAMES[body]} in their ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  // composite aspects: unordered pairs of the composite chart's own bodies.
  // The relationship's chart has a geometry of its own, and it is read the
  // way a natal aspect is -- in the composite voice.
  for (let i = 0; i < PLACEMENT_BODIES.length; i++) {
    for (let j = i + 1; j < PLACEMENT_BODIES.length; j++) {
      const a = PLACEMENT_BODIES[i];
      const b = PLACEMENT_BODIES[j];
      for (const aspect of ASPECTS) {
        cells.push({
          id: `composite:aspect:${a}:${aspect}:${b}`,
          family: "composite-aspect",
          when: { kind: "compositeAspect", a, b, aspect },
          atomIds: [`composite:${a}~${b}:${aspect}`],
          title: `Composite ${NAMES[a]} ${ASPECT_NAMES[aspect]} composite ${NAMES[b]}`,
          bindable: true,
        });
      }
    }
  }

  // composite placements: the midpoint chart's 12 bodies through the signs
  for (const body of PLACEMENT_BODIES) {
    for (const sign of SIGNS) {
      cells.push({
        id: `composite:${body}:sign:${sign.toLowerCase()}`,
        family: "composite-placement",
        when: { kind: "composite", body, sign },
        atomIds: [`composite:${body}`],
        title: `Composite ${NAMES[body]} in ${sign}`,
        bindable: true,
      });
    }
  }

  // composite houses: the midpoint chart's 12 bodies through its own twelve
  // houses. The composite frame is a convention (equal houses from the
  // midpoint Ascendant), so these cells fire only when both birth times are
  // known -- the engine reports no composite house without them.
  for (const body of PLACEMENT_BODIES) {
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `composite:${body}:house:${house}`,
        family: "composite-house",
        when: { kind: "composite", body, house },
        atomIds: [`composite:${body}`],
        title: `Composite ${NAMES[body]} in the ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  return cells;
}

/** The seven Hermetic lots, keyed as the engine's lot atoms key them. */
const LOTS = [
  "fortune", "spirit", "eros", "necessity", "courage", "victory", "nemesis",
] as const;
const LOT_NAMES: Record<string, string> = {
  fortune: "Fortune", spirit: "Spirit", eros: "Eros", necessity: "Necessity",
  courage: "Courage", victory: "Victory", nemesis: "Nemesis",
};

/** The bodies of the declination grid: the ten planets plus Chiron (the
 *  engine computes parallels for every aspectable body; nodes and Lilith
 *  sit out, as they do for aspects). 55 unordered pairs. */
const PARALLEL_BODIES = [...PLANETS, "chiron"] as const;

/**
 * The curated fixed-star list (build-plan B5 row): 60 stars named from
 * `packages/caelus/data/fixed_stars.json`, chosen for weight in the
 * delineation tradition (Ptolemy, Robson, Brady) -- the four royal stars,
 * the named malefics and benefics, and the ecliptic-adjacent stars the
 * literature actually delineates. Strings are catalog keys, verbatim,
 * because the engine's star atoms carry them as such.
 */
export const B5_STARS = [
  // The four royal stars.
  "Aldebaran", "Regulus", "Antares", "Fomalhaut",
  // The heavyweights of the tradition.
  "Algol", "Alcyone", "Sirius", "Spica", "Arcturus", "Vega", "Capella",
  "Rigel", "Betelgeuse", "Bellatrix", "Procyon", "Pollux", "Castor",
  "Canopus", "Altair", "Scheat",
  // The zodiacal walk, Aries to Pisces.
  "Hamal", "Sheratan", "Menkar", "Alnilam", "Alhena", "Wasat",
  "Acubens", "Asellus Borealis", "Asellus Australis", "Alphard",
  "Zosma", "Denebola", "Vindemiatrix", "Algorab", "Zubenelgenubi",
  "Zubeneschamali", "Unukalhai", "Alphecca", "Dschubba", "Shaula",
  "Rasalhague", "Sabik", "Kaus Australis", "Nunki", "Deneb Algedi",
  "Sadalsuud", "Sadalmelik", "Skat", "Markab", "Algenib",
  // Off the ecliptic but delineated by name in the sources.
  "Alpheratz", "Mirach", "Almach", "Achernar", "Acrux", "Polaris",
  "Deneb", "Diphda", "Enif", "Mizar",
] as const;

/** Stars whose body conjunctions carry enough doctrine of their own for
 *  body-specific essays, paired with the luminaries and the two personal
 *  planets the sources delineate against them. */
const STAR_CONTACT_STARS = [
  "Aldebaran", "Regulus", "Antares", "Fomalhaut", "Algol", "Alcyone",
  "Sirius", "Spica", "Arcturus", "Vega", "Capella", "Rigel",
  "Betelgeuse", "Procyon", "Scheat",
] as const;
const STAR_CONTACT_BODIES = ["sun", "moon", "venus", "mars"] as const;

/** The 27 nakshatras, as the engine's `NAKSHATRAS` names them
 *  (`packages/caelus/src/vedic.ts`; not exported from the package root,
 *  so restated here -- the mansion list is stable doctrine). */
const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
  "Revati",
] as const;

/** The bodies the projection emits nakshatra and varga atoms for (the
 *  seven classical grahas; `interpretation.ts` nakBodies default). */
const VARGA_BODIES = [
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn",
] as const;

/** The divisional charts the engine computes beyond the rasi itself
 *  (`VARGA_DIVISIONS` minus D1), each with its conventional name. */
const VARGA_FRAMES: Array<[number, string]> = [
  [2, "hora"], [3, "drekkana"], [9, "navamsa"], [10, "dashamsha"],
  [12, "dwadashamsha"], [30, "trimshamsha"],
];

/** The yogas the engine detects (`yogas.ts` plus Kemadruma), as its yoga
 *  atoms name them. */
const YOGA_NAMES = [
  "Ruchaka", "Bhadra", "Hamsa", "Malavya", "Shasha", "Gajakesari",
  "Budha-Aditya", "Chandra-Mangala", "Kemadruma",
] as const;

const slug = (s: string): string => s.toLowerCase().replace(/\s+/g, "-");

/**
 * The B5 content grid (build-plan "Unwritten inventory / B5"): lots in sign
 * and house, final dispositors and mutual receptions, the curated fixed
 * stars, declination parallels, and the Vedic layer -- the Moon's mansions
 * and padas, the navamsa placements with per-varga framings, and the named
 * yogas. Every bindable cell binds through selectors and atoms the engine
 * already carries; the raja/dhana framing cells stay unbindable until the
 * engine detects those yogas.
 */
export function b5Grid(): GridCell[] {
  const cells: GridCell[] = [];

  // Lots in sign and in house: 7 lots x (12 + 12).
  for (const lot of LOTS) {
    for (const sign of SIGNS) {
      cells.push({
        id: `natal:lot:${lot}:sign:${sign.toLowerCase()}`,
        family: "lot-sign",
        when: { kind: "lot", lot, sign },
        atomIds: [`lot:${lot}`],
        title: `Lot of ${LOT_NAMES[lot]} in ${sign}`,
        bindable: true,
      });
    }
    for (let house = 1; house <= 12; house++) {
      cells.push({
        id: `natal:lot:${lot}:house:${house}`,
        family: "lot-house",
        when: { kind: "lot", lot, house },
        atomIds: [`lot:${lot}`],
        title: `Lot of ${LOT_NAMES[lot]} in the ${ordinal(house)} house`,
        bindable: true,
      });
    }
  }

  // Final dispositors: the ten planets, each in its own domicile anchoring
  // the dispositor chain.
  for (const body of PLANETS) {
    cells.push({
      id: `natal:dispositor:final:${body}`,
      family: "dispositor",
      when: { kind: "dispositor", body, final: true },
      atomIds: [`dispositor:${body}`],
      title: `${NAMES[body]} as final dispositor`,
      bindable: true,
    });
  }

  // Mutual receptions: one essay per dignity route, one per participating
  // planet. The engine's reception atoms carry `by` as the sorted join of
  // the two dignities.
  const RECEPTION_ROUTES: Array<[string, string]> = [
    ["domicile", "Mutual reception by domicile"],
    ["exaltation", "Mutual reception by exaltation"],
    ["domicile-exaltation", "Mixed reception, domicile with exaltation"],
  ];
  for (const [by, title] of RECEPTION_ROUTES) {
    cells.push({
      id: `natal:reception:${by}`,
      family: "reception",
      when: { kind: "reception", by },
      atomIds: ["reception:"],
      title,
      bindable: true,
    });
  }
  for (const body of PLANETS) {
    cells.push({
      id: `natal:reception:body:${body}`,
      family: "reception",
      when: { kind: "reception", body },
      atomIds: ["reception:"],
      title: `${NAMES[body]} in mutual reception`,
      bindable: true,
    });
  }

  // Fixed stars: the star essay (any natal body on it), then the
  // body-specific contacts for the stars with doctrine of their own.
  for (const star of B5_STARS) {
    cells.push({
      id: `natal:star:${slug(star)}`,
      family: "star",
      when: { kind: "star", star },
      atomIds: ["star:"],
      title: `A natal body on ${star}`,
      bindable: true,
    });
  }
  for (const star of STAR_CONTACT_STARS) {
    for (const body of STAR_CONTACT_BODIES) {
      cells.push({
        id: `natal:star:${slug(star)}:${body}`,
        family: "star-contact",
        when: { kind: "star", star, body },
        atomIds: [`star:${body}:${star}`],
        title: `${NAMES[body]} on ${star}`,
        bindable: true,
      });
    }
  }

  // Declination parallels: unordered pairs over planets + Chiron. The
  // parallel side only; contraparallels are a later extension of the
  // family, not a claim these essays may make.
  for (let i = 0; i < PARALLEL_BODIES.length; i++) {
    for (let j = i + 1; j < PARALLEL_BODIES.length; j++) {
      const a = PARALLEL_BODIES[i];
      const b = PARALLEL_BODIES[j];
      const [x, y] = [a, b].sort();
      cells.push({
        id: `natal:parallel:${a}:${b}`,
        family: "parallel",
        when: { kind: "parallel", a, b, declination: "parallel" },
        atomIds: [`parallel:${x}~${y}:parallel`],
        title: `${NAMES[a]} parallel ${NAMES[b]}`,
        bindable: true,
      });
    }
  }

  // Nakshatras: the Moon through the 27 mansions, then every pada. Other
  // bodies' mansions are a later extension (build plan: Moon first).
  for (const name of NAKSHATRA_NAMES) {
    const atom = `nakshatra:moon:${name.replace(/\s+/g, "_")}`;
    cells.push({
      id: `vedic:moon:nakshatra:${slug(name)}`,
      family: "nakshatra-moon",
      when: { kind: "nakshatra", body: "moon", name },
      atomIds: [atom],
      title: `Moon in ${name}`,
      bindable: true,
    });
    for (let pada = 1; pada <= 4; pada++) {
      cells.push({
        id: `vedic:moon:nakshatra:${slug(name)}:pada:${pada}`,
        family: "nakshatra-pada",
        when: { kind: "nakshatra", body: "moon", name, pada },
        atomIds: [atom],
        title: `Moon in ${name}, pada ${pada}`,
        bindable: true,
      });
    }
  }

  // Vargas: the navamsa (D9) placements for the seven grahas the
  // projection carries, plus one framing essay per computed division.
  for (const body of VARGA_BODIES) {
    for (const sign of SIGNS) {
      cells.push({
        id: `vedic:varga:d9:${body}:${sign.toLowerCase()}`,
        family: "varga-d9",
        when: { kind: "varga", division: 9, body, sign },
        atomIds: [`varga:d9:${body}:${sign.toLowerCase()}`],
        title: `${NAMES[body]} in ${sign} in the navamsa (D9)`,
        bindable: true,
      });
    }
  }
  for (const [n, name] of VARGA_FRAMES) {
    cells.push({
      id: `vedic:varga:frame:d${n}`,
      family: "varga-frame",
      when: { kind: "varga", division: n },
      atomIds: [`varga:d${n}:`],
      title: `Reading the ${name} (D${n})`,
      bindable: true,
    });
  }

  // Yogas: the nine the engine detects, plus raja and dhana framings that
  // stay visible-but-unbindable until the engine detects them.
  for (const name of YOGA_NAMES) {
    cells.push({
      id: `vedic:yoga:${slug(name)}`,
      family: "yoga",
      when: { kind: "yoga", yoga: name },
      atomIds: [`yoga:${name}`],
      title: `${name} yoga`,
      bindable: true,
    });
  }
  for (const [name, title] of [
    ["raja", "Raja yoga framings"], ["dhana", "Dhana yoga framings"],
  ] as const) {
    cells.push({
      id: `vedic:yoga:${name}`,
      family: "yoga",
      when: { kind: "yoga", yoga: name },
      atomIds: ["yoga:"],
      title,
      bindable: false,
    });
  }

  return cells;
}

/** Every enumerated cell across the batches written so far. */
export function fullGrid(): GridCell[] {
  return [...b1Grid(), ...b2Grid(), ...b3Grid(), ...b4Grid(), ...b5Grid()];
}

/** Coverage of the grid by a set of written cell ids. */
export function gridCoverage(writtenIds: Set<string>): {
  family: CellFamily; written: number; bindable: number; total: number;
}[] {
  const byFamily = new Map<CellFamily, { written: number; bindable: number; total: number }>();
  for (const cell of fullGrid()) {
    const row = byFamily.get(cell.family) ?? { written: 0, bindable: 0, total: 0 };
    row.total++;
    if (cell.bindable) row.bindable++;
    if (writtenIds.has(cell.id)) row.written++;
    byFamily.set(cell.family, row);
  }
  return [...byFamily.entries()].map(([family, r]) => ({ family, ...r }));
}
