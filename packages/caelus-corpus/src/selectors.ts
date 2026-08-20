/**
 * Serializable selector specs, and their resolution into live Caelus
 * selectors.
 *
 * Vendored from `caelus-delineations-pd` (v0.1.6, `src/types.ts` and
 * `src/compile.ts`) so this corpus depends on the engine alone. The two
 * corpora shared this bridge because they shipped from one monorepo; it is
 * ~150 lines, and duplicating it costs less than keeping two packages'
 * selector vocabularies in lockstep across two repositories.
 *
 * Keeping selectors as data rather than code is what lets the corpus ship as
 * JSON and stay auditable: each cell names the fact it speaks to in a form
 * you can read, diff and lint.
 *
 * When a `kind` here drifts from the engine's `FactKind` set, this file is
 * the one place to correct it.
 */
import {
  hasPlacement, hasAspect, hasPattern, hasSignature, hasAngle, hasAngleContact,
  hasStar, hasLot, hasDegree,
  hasDispositor, hasReception, hasDignityFine, hasTransit, hasTransitHouse,
  hasStation, hasSynastry,
  hasComposite, hasCompositeAspect, hasTimelord, hasNakshatra, hasVarga, hasYoga,
  hasParallel, hasOutOfBounds,
  hasReturn, hasLunation, hasSolarPhase,
} from "caelus";
import type { Selector, AngleAtom } from "caelus";


/** Serializable selector spec — resolved to Caelus selectors at extract/build
 *  time. Covers every Caelus `FactKind`. The chart-pure kinds (placement,
 *  aspect, pattern, signature, angle, dispositor, reception, dignity,
 *  parallel, outOfBounds) match atoms every projection carries; the
 *  context-fed kinds (star, lot, transit, synastry, composite, timelord,
 *  nakshatra, varga, yoga) match atoms the caller supplies or enables via
 *  `ContextOptions` — a rule keyed on them simply never fires against a bare
 *  chart projection. */
export type SelectorSpec =
  | { kind: "placement"; body: string; sign?: string; house?: number; retrograde?: boolean; dignity?: string }
  | { kind: "aspect"; a: string; b: string; aspect: string; phase?: string }
  | { kind: "pattern"; pattern: string; body?: string }
  | { kind: "signature"; facet: string; value: string }
  | { kind: "angle"; angle: string; sign?: string }
  | { kind: "angleContact"; body?: string; angle?: string; maxOrb?: number }
  | { kind: "dispositor"; body?: string; dispositor?: string; final?: boolean }
  | { kind: "reception"; body?: string; by?: string }
  | { kind: "dignity"; facet?: "term" | "face" | "triplicity" | "almuten"; body?: string; ruler?: string }
  | { kind: "star"; body?: string; star?: string }
  | { kind: "lot"; lot?: string; sign?: string; house?: number }
  | { kind: "degree"; point?: string; sign?: string; degree?: number; face?: number }
  | { kind: "transit"; transit?: string; natal?: string; aspect?: string; phase?: string }
  | { kind: "transitHouse"; body?: string; house?: number }
  | { kind: "station"; body?: string; direction?: "retrograde" | "direct" }
  | { kind: "synastry"; mode?: "aspect" | "overlay"; a?: string; b?: string; aspect?: string; body?: string; partner?: "a" | "b"; house?: number }
  | { kind: "composite"; body?: string; sign?: string; house?: number }
  | { kind: "compositeAspect"; a?: string; b?: string; aspect?: string; minStrength?: number }
  | { kind: "timelord"; system?: "profection" | "zr" | "firdaria" | "dasha"; level?: string; lord?: string; sign?: string; house?: number; under?: string }
  | { kind: "nakshatra"; body?: string; name?: string; lord?: string; pada?: number }
  | { kind: "varga"; division?: number; body?: string; sign?: string }
  | { kind: "yoga"; yoga?: string; body?: string }
  | { kind: "parallel"; a?: string; b?: string; declination?: "parallel" | "contraparallel" }
  | { kind: "outOfBounds"; body?: string }
  | { kind: "return"; body?: string; nth?: number; minNth?: number }
  | { kind: "lunation"; phase?: "new" | "full"; eclipse?: boolean; eclipseKind?: "solar" | "lunar"; house?: number; onNatal?: string; anyOnNatal?: boolean }
  | { kind: "solarPhase"; body?: string; phase?: "cazimi" | "combust" | "under_beams" };


/** Resolve a serializable {@link SelectorSpec} into a live {@link Selector}. */
export function selectorFromSpec(spec: SelectorSpec): Selector {
  switch (spec.kind) {
    case "placement":
      return hasPlacement({
        body: spec.body, sign: spec.sign, house: spec.house,
        retrograde: spec.retrograde, dignity: spec.dignity,
      });
    case "aspect":
      return hasAspect({ between: [spec.a, spec.b], aspect: spec.aspect, phase: spec.phase });
    case "pattern":
      return hasPattern({ kind: spec.pattern, body: spec.body });
    case "signature":
      return hasSignature(spec.facet, spec.value);
    case "angle":
      return hasAngle(spec.angle as AngleAtom["angle"], spec.sign);
    case "angleContact":
      return hasAngleContact({ body: spec.body, angle: spec.angle, maxOrb: spec.maxOrb });
    case "dispositor":
      return hasDispositor({
        body: spec.body, dispositor: spec.dispositor, final: spec.final,
      });
    case "reception":
      return hasReception({ body: spec.body, by: spec.by });
    case "dignity":
      return hasDignityFine({ facet: spec.facet, body: spec.body, ruler: spec.ruler });
    case "star":
      return hasStar({ body: spec.body, star: spec.star });
    case "lot":
      return hasLot({ lot: spec.lot, sign: spec.sign, house: spec.house });
    case "degree":
      return hasDegree({
        point: spec.point, sign: spec.sign, degree: spec.degree, face: spec.face,
      });
    case "transit":
      return hasTransit({
        transit: spec.transit, natal: spec.natal, aspect: spec.aspect, phase: spec.phase,
      });
    case "transitHouse":
      return hasTransitHouse({ body: spec.body, house: spec.house });
    case "station":
      return hasStation({ body: spec.body, direction: spec.direction });
    case "synastry":
      return hasSynastry({
        mode: spec.mode, a: spec.a, b: spec.b, aspect: spec.aspect,
        body: spec.body, partner: spec.partner, house: spec.house,
      });
    case "composite":
      return hasComposite({ body: spec.body, sign: spec.sign, house: spec.house });
    case "compositeAspect":
      return hasCompositeAspect({
        a: spec.a, b: spec.b, aspect: spec.aspect, minStrength: spec.minStrength,
      });
    case "timelord":
      return hasTimelord({
        system: spec.system, level: spec.level, lord: spec.lord, sign: spec.sign,
        house: spec.house, under: spec.under,
      });
    case "nakshatra":
      return hasNakshatra({
        body: spec.body, name: spec.name, lord: spec.lord, pada: spec.pada,
      });
    case "varga":
      return hasVarga({ division: spec.division, body: spec.body, sign: spec.sign });
    case "yoga":
      return hasYoga({ yoga: spec.yoga, body: spec.body });
    case "parallel":
      return hasParallel({
        between: spec.a && spec.b ? [spec.a, spec.b] : undefined,
        body: spec.a && !spec.b ? spec.a : undefined,
        declination: spec.declination,
      });
    case "outOfBounds":
      return hasOutOfBounds({ body: spec.body });
    case "return":
      return hasReturn({ body: spec.body, nth: spec.nth, minNth: spec.minNth });
    case "lunation":
      return hasLunation({
        phase: spec.phase, eclipse: spec.eclipse, eclipseKind: spec.eclipseKind,
        house: spec.house, onNatal: spec.onNatal, anyOnNatal: spec.anyOnNatal,
      });
    case "solarPhase":
      return hasSolarPhase({ body: spec.body, phase: spec.phase });
  }
}
