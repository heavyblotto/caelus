/**
 * Validation harness for the Caelus corpus. Proves, without an ephemeris,
 * that every entry sits on a real grid cell, compiles to a live selector,
 * fires for its condition and not for a neighboring one, cites only atom
 * ids the projection would emit, and passes the corpus lints. Mirrors the
 * pd package's harness; run as `node dist/test/validation.test.js`.
 */
import { interpret } from "caelus";
import type { FactAtom, InterpretationContext, InterpretationSource } from "caelus";
import {
  passages, passageSets, sources, fullGrid, gridCoverage,
  lintCorpus, lintNearDuplicateSentences,
} from "../src/index.js";
import { selectorFromSpec } from "../src/selectors.js";
import type { Passage } from "../src/index.js";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) { console.error(`  FAIL: ${msg}`); failures++; }
}

// 1. Corpus shape.
console.log("corpus shape");
check(passageSets.length > 0, "at least one passage set");
const ids = passages.map((p) => p.id);
check(new Set(ids).size === ids.length, "passage ids unique");
for (const set of passageSets) {
  for (const p of set.passages) {
    check(p.family === set.family, `${p.id}: family matches its set (${set.id})`);
  }
}

// 2. Every passage sits on a bindable grid cell and matches its selector.
console.log("grid membership");
const grid = new Map(fullGrid().map((c) => [c.id, c]));
for (const p of passages) {
  const cell = grid.get(p.id);
  check(!!cell, `${p.id}: is a grid cell`);
  if (!cell) continue;
  check(cell.bindable, `${p.id}: cell is bindable`);
  check(cell.family === p.family, `${p.id}: family matches grid`);
  check(
    JSON.stringify(cell.when) === JSON.stringify(p.when),
    `${p.id}: selector spec matches the grid cell's`,
  );
  check(
    JSON.stringify(cell.atomIds) === JSON.stringify(p.atomIds),
    `${p.id}: atom ids match the grid cell's`,
  );
}

// 3. Selectors compile.
console.log("selector compilation");
for (const p of passages) {
  try {
    check(typeof selectorFromSpec(p.when) === "function", `${p.id}: selector resolves`);
  } catch (e) {
    check(false, `${p.id}: selector threw (${(e as Error).message})`);
  }
}

// 4. Fires for its condition, and not for a shifted one.
console.log("firing");
function atomFor(p: Passage): FactAtom | null {
  const w = p.when;
  switch (w.kind) {
    case "placement":
      return {
        id: `placement:${w.body}`, kind: "placement", bodies: [w.body],
        salience: 2.5, text: "synthetic", body: w.body,
        sign: w.sign ?? "Aries", signDeg: 10, house: w.house ?? 5,
        retrograde: w.retrograde ?? false,
        dignities: w.dignity ? [w.dignity] : [],
      } as FactAtom;
    case "angle":
      return {
        id: `angle:${w.angle}`, kind: "angle", bodies: [], salience: 3,
        text: "synthetic", angle: w.angle, sign: w.sign ?? "Aries", signDeg: 10,
      } as unknown as FactAtom;
    case "aspect":
      return {
        id: `aspect:${w.a}~${w.b}:${w.aspect}`, kind: "aspect",
        bodies: [w.a, w.b], salience: 2.5, text: "synthetic",
        a: w.a, b: w.b, aspect: w.aspect, orb: 1.2, applying: true,
        phase: w.phase ?? "applying", strength: 0.8,
      } as unknown as FactAtom;
    case "signature":
      return {
        id: `signature:${w.facet}:${w.value}`, kind: "signature", bodies: [],
        salience: 2, text: "synthetic", facet: w.facet, value: w.value,
      } as unknown as FactAtom;
    case "pattern":
      return {
        id: `pattern:${w.pattern}:synthetic`, kind: "pattern",
        bodies: w.body ? [w.body] : ["mars", "venus", "saturn"], salience: 3,
        text: "synthetic", pattern: w.pattern, apex: w.body,
      } as unknown as FactAtom;
    case "outOfBounds":
      return {
        id: `oob:${w.body}`, kind: "outOfBounds", bodies: [w.body ?? "moon"],
        salience: 2, text: "synthetic", body: w.body, declination: 24.1,
      } as unknown as FactAtom;
    case "angleContact":
      return {
        id: `angleContact:${w.body ?? "sun"}:${w.angle}`, kind: "angleContact",
        bodies: [w.body ?? "sun"], salience: 3, text: "synthetic",
        body: w.body ?? "sun", angle: w.angle, orb: 1.5,
      } as unknown as FactAtom;
    case "transit":
      return {
        id: `transit:${w.transit}~natal_${w.natal}:${w.aspect}`, kind: "transit",
        bodies: [w.transit ?? "sun", w.natal ?? "sun"], salience: 3,
        text: "synthetic", transit: w.transit, natal: w.natal,
        aspect: w.aspect, orb: 1.0, phase: w.phase ?? "applying",
        strength: 0.8, natalHouse: 5,
      } as unknown as FactAtom;
    case "transitHouse":
      return {
        id: `transitHouse:${w.body}:${w.house}`, kind: "transitHouse",
        bodies: [w.body ?? "sun"], salience: 2, text: "synthetic",
        body: w.body, house: w.house,
      } as unknown as FactAtom;
    case "station":
      return {
        id: `station:${w.body}:${w.direction}`, kind: "station",
        bodies: [w.body ?? "mercury"], salience: 3, text: "synthetic",
        body: w.body, direction: w.direction, daysFromExact: 1.5,
      } as unknown as FactAtom;
    case "timelord":
      return {
        id: `${w.system}:${w.level}:synthetic`, kind: "timelord",
        bodies: w.lord ? [w.lord] : [], salience: 3, text: "synthetic",
        system: w.system, level: w.level, lord: w.lord ?? "mars",
        sign: w.sign, house: w.house, under: w.under,
      } as unknown as FactAtom;
    case "return":
      return {
        id: `return:${w.body ?? "saturn"}:${w.nth ?? w.minNth ?? 1}`, kind: "return",
        bodies: [w.body ?? "saturn"], salience: 3.5, text: "synthetic",
        body: w.body ?? "saturn", nth: w.nth ?? w.minNth ?? 1,
        orb: 1.0, phase: "applying",
      } as unknown as FactAtom;
    case "lunation":
      return {
        id: `lunation:${w.phase ?? "new"}`, kind: "lunation",
        bodies: ["moon"], salience: 3.5, text: "synthetic",
        phase: w.phase ?? "new",
        eclipse: w.eclipseKind ?? (w.eclipse ? "solar" : null),
        house: w.house ?? 5, sign: "Aries", daysFromExact: 1.0,
        onNatal: w.onNatal ? [w.onNatal] : (w.anyOnNatal ? ["sun"] : []),
      } as unknown as FactAtom;
    case "solarPhase":
      return {
        id: `solarPhase:${w.body ?? "mercury"}:${w.phase ?? "combust"}`, kind: "solarPhase",
        bodies: [w.body ?? "mercury"], salience: 2, text: "synthetic",
        body: w.body ?? "mercury", phase: w.phase ?? "combust", elongation: 4.0,
      } as unknown as FactAtom;
    case "synastry":
      return w.mode === "overlay"
        ? {
          id: `synastry:overlay:${w.partner ?? "a"}:${w.body}:house:${w.house}`,
          kind: "synastry", bodies: [w.body ?? "venus"], salience: 2,
          text: "synthetic", mode: "overlay", body: w.body,
          partner: w.partner ?? "a", house: w.house,
        } as unknown as FactAtom
        : {
          id: `synastry:${w.a}~b_${w.b}:${w.aspect}`, kind: "synastry",
          bodies: [w.a ?? "venus", w.b ?? "mars"], salience: 3, text: "synthetic",
          mode: "aspect", a: w.a, b: w.b, aspect: w.aspect, orb: 1.2, strength: 0.7,
        } as unknown as FactAtom;
    case "composite":
      // A composite atom carries a house only when a frame was supplied, which
      // needs both birth times; composite-house cells select on it.
      return {
        id: `composite:${w.body ?? "sun"}`, kind: "composite",
        bodies: [w.body ?? "sun"], salience: 2, text: "synthetic",
        body: w.body ?? "sun", sign: w.sign ?? "Aries", signDeg: 12,
        ...(w.house === undefined ? {} : { house: w.house }),
      } as unknown as FactAtom;
    default:
      return null;
  }
}

/** A context that should NOT fire the rule: shift the discriminating field. */
function shiftedAtom(p: Passage): FactAtom | null {
  const a = atomFor(p);
  if (!a) return null;
  const w = p.when;
  const clone = { ...a } as Record<string, unknown>;
  if (w.kind === "placement") {
    if (w.sign) clone.sign = w.sign === "Aries" ? "Taurus" : "Aries";
    else if (w.house) clone.house = (w.house % 12) + 1;
    else if (w.retrograde !== undefined) clone.retrograde = !w.retrograde;
    else if (w.dignity) clone.dignities = [];
    else return null;
  } else if (w.kind === "angle") {
    clone.sign = w.sign === "Aries" ? "Taurus" : "Aries";
  } else if (w.kind === "aspect") {
    clone.aspect = w.aspect === "square" ? "trine" : "square";
    clone.id = `aspect:${w.a}~${w.b}:${clone.aspect}`;
  } else if (w.kind === "signature") {
    clone.value = "synthetic-other";
    clone.id = `signature:${w.facet}:synthetic-other`;
  } else if (w.kind === "pattern") {
    clone.pattern = w.pattern === "yod" ? "kite" : "yod";
    clone.id = `pattern:${clone.pattern}:synthetic`;
  } else if (w.kind === "outOfBounds") {
    clone.id = "oob:synthetic-other";
    clone.body = "synthetic-other";
  } else if (w.kind === "angleContact") {
    clone.angle = w.angle === "asc" ? "mc" : "asc";
    clone.id = `angleContact:${w.body ?? "sun"}:${clone.angle}`;
  } else if (w.kind === "transit") {
    clone.aspect = w.aspect === "square" ? "trine" : "square";
    clone.id = `transit:${w.transit}~natal_${w.natal}:${clone.aspect}`;
  } else if (w.kind === "transitHouse") {
    clone.house = ((w.house ?? 1) % 12) + 1;
    clone.id = `transitHouse:${w.body}:${clone.house}`;
  } else if (w.kind === "station") {
    clone.direction = w.direction === "retrograde" ? "direct" : "retrograde";
    clone.id = `station:${w.body}:${clone.direction}`;
  } else if (w.kind === "timelord") {
    if (w.house !== undefined) clone.house = (w.house % 12) + 1;
    else if (w.under !== undefined) clone.under = w.under === "sun" ? "moon" : "sun";
    else if (w.sign !== undefined) clone.sign = w.sign === "Aries" ? "Taurus" : "Aries";
    else if (w.lord !== undefined) clone.lord = w.lord === "sun" ? "moon" : "sun";
    else return null;
  } else if (w.kind === "return") {
    if (w.nth !== undefined) clone.nth = w.nth + 1;
    else if (w.minNth !== undefined) clone.nth = w.minNth - 1;
    else {
      clone.body = w.body === "saturn" ? "jupiter" : "saturn";
      clone.id = `return:${clone.body}:1`;
    }
  } else if (w.kind === "lunation") {
    if (w.house !== undefined) clone.house = (w.house % 12) + 1;
    else if (w.anyOnNatal) clone.onNatal = [];
    else if (w.eclipse !== undefined || w.eclipseKind !== undefined) clone.eclipse = null;
    else if (w.phase !== undefined) clone.phase = w.phase === "new" ? "full" : "new";
    else return null;
  } else if (w.kind === "solarPhase") {
    clone.phase = w.phase === "combust" ? "under_beams" : "combust";
    clone.id = `solarPhase:${w.body ?? "mercury"}:${clone.phase}`;
  } else if (w.kind === "synastry") {
    if (w.mode === "overlay") {
      clone.house = ((w.house ?? 1) % 12) + 1;
      clone.id = `synastry:overlay:${w.partner ?? "a"}:${w.body}:house:${clone.house}`;
    } else {
      clone.aspect = w.aspect === "square" ? "trine" : "square";
      clone.id = `synastry:${w.a}~b_${w.b}:${clone.aspect}`;
    }
  } else if (w.kind === "composite") {
    // Shift whichever field the cell actually selects on: a composite-house
    // cell names no sign, so shifting the sign would leave it firing.
    if (w.house === undefined) {
      clone.sign = w.sign === "Aries" ? "Taurus" : "Aries";
    } else {
      clone.house = (w.house % 12) + 1;
    }
  }
  return clone as unknown as FactAtom;
}

const srcFor = (p: Passage): InterpretationSource | undefined =>
  sources.find((s) => s.rules.some((r) => r.id === p.id));

for (const p of passages) {
  const atom = atomFor(p);
  const src = srcFor(p);
  check(!!src, `${p.id}: compiled into a source`);
  if (!atom || !src) continue;
  const ctx: InterpretationContext = { jdUt: 0, zodiac: "tropical", atoms: [atom] };
  const reading = interpret(ctx, [src]);
  check(
    reading.entries.some((e) => e.rule === p.id),
    `${p.id}: fires for its condition`,
  );
  const off = shiftedAtom(p);
  if (off) {
    const offCtx: InterpretationContext = { jdUt: 0, zodiac: "tropical", atoms: [off] };
    const offReading = interpret(offCtx, [src]);
    check(
      !offReading.entries.some((e) => e.rule === p.id),
      `${p.id}: does not fire for a shifted condition`,
    );
  }
}

// 5. Corpus lints: length bands, banned phrases, reading level, duplication.
console.log("corpus lints");
const findings = lintCorpus(passages);
for (const f of findings) console.error(`  LINT ${f.rule} ${f.id}: ${f.detail}`);
check(findings.length === 0, `lints clean (${findings.length} findings)`);

// 5b. The near-duplicate sentence lint, on fixtures.
//
// It gates in lintCorpus (above) since the repair waves took the backlog to
// zero; when first written it found 348 findings in shipped content and ran
// writer-facing only. These fixtures pin the behaviour either way.
console.log("near-duplicate sentence lint");
{
  const p = (id: string, text: string): Passage =>
    ({ id, family: "fixture", when: {}, atomIds: [], text }) as unknown as Passage;

  // The real B3 case: one sentence, one word swapped, across two entries.
  const swapped = lintNearDuplicateSentences([
    p("a", "Each end supplies what the other lacks in this pairing."),
    p("b", "Each pole supplies what the other lacks in this pairing."),
  ]);
  check(swapped.length === 2, "near-dup: catches a one-word sentence swap");
  check(
    swapped.every((f) => f.rule === "near-duplicate-sentence"),
    "near-dup: reports under its own rule name",
  );
  // Both sides are reported: check-family attributes a finding by its id, so
  // a one-sided finding lets the second writer ship the collision.
  check(
    new Set(swapped.map((f) => f.id)).size === 2,
    "near-dup: reports the pair against both entries",
  );

  // A verbatim repeat belongs to lintSharedSentences, not to this lint.
  check(
    lintNearDuplicateSentences([
      p("a", "Each pole supplies what the other lacks in this pairing."),
      p("b", "Each pole supplies what the other lacks in this pairing."),
    ]).length === 0,
    "near-dup: leaves a verbatim repeat to the shared-sentence lint",
  );

  // Two sentences on the same subject in different shapes are not a finding.
  check(
    lintNearDuplicateSentences([
      p("a", "Each end supplies what the other lacks in this pairing."),
      p("b", "What one side cannot reach, the other one turns out to hold."),
    ]).length === 0,
    "near-dup: allows the same idea written two ways",
  );

  // Sentences shorter than the six-word floor are asides, not formulas.
  check(
    lintNearDuplicateSentences([
      p("a", "It is quiet work."), p("b", "It is quieter work."),
    ]).length === 0,
    "near-dup: ignores fragments below the sentence floor",
  );

  // Two near-identical sentences inside one entry are that entry's business.
  check(
    lintNearDuplicateSentences([
      p("a", "Each end supplies what the other lacks in this pairing. "
        + "Each pole supplies what the other lacks in this pairing."),
    ]).length === 0,
    "near-dup: only compares across entries",
  );
}

// 6. Coverage report (informational; completeness is the M7 gate).
console.log("B1 coverage");
const written = new Set(ids);
for (const row of gridCoverage(written)) {
  console.log(
    `  ${row.family}: ${row.written}/${row.bindable} written` +
    (row.bindable < row.total ? ` (${row.total - row.bindable} blocked on projection)` : ""),
  );
}

if (failures > 0) {
  console.error(`\n${failures} failures`);
  process.exit(1);
}
console.log("\ncaelus corpus validation passed");
