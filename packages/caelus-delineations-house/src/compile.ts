/**
 * Compile house passages into Caelus {@link InterpretationSource}s, reusing
 * the pd package's selector compiler verbatim (the validation floor the
 * proposal's content strategy leans on).
 */
import { selectorFromSpec } from "./selectors.js";
import type { InterpretationSource, Rule } from "caelus";
import type { HousePassage, HousePassageSet } from "./types.js";

export function ruleFromHousePassage(p: HousePassage): Rule {
  return {
    id: p.id,
    when: selectorFromSpec(p.when),
    text: p.text,
    weight: p.weight,
    tags: ["caelus", `family:${p.family}`, ...(p.tags ?? [])],
  };
}

/** Node cells are written once against `true_node`; mirror each such rule
 *  (placement, natal aspect, or transit target) to `mean_node` so either
 *  node setting fires the same text. */
function mirrorNodeRules(passages: HousePassage[]): HousePassage[] {
  const out: HousePassage[] = [];
  for (const p of passages) {
    out.push(p);
    const w = p.when;
    let mirrored: HousePassage["when"] | null = null;
    if (w.kind === "composite" && w.body === "true_node") {
      mirrored = { ...w, body: "mean_node" };
    } else if (w.kind === "placement" && w.body === "true_node") {
      mirrored = { ...w, body: "mean_node" };
    } else if (w.kind === "aspect" && (w.a === "true_node" || w.b === "true_node")) {
      mirrored = {
        ...w,
        a: w.a === "true_node" ? "mean_node" : w.a,
        b: w.b === "true_node" ? "mean_node" : w.b,
      };
    } else if (w.kind === "transit" && w.natal === "true_node") {
      mirrored = { ...w, natal: "mean_node" };
    } else if (w.kind === "return" && w.body === "true_node") {
      mirrored = { ...w, body: "mean_node" };
    } else if (w.kind === "compositeAspect" && (w.a === "true_node" || w.b === "true_node")) {
      mirrored = {
        ...w,
        a: w.a === "true_node" ? "mean_node" : w.a,
        b: w.b === "true_node" ? "mean_node" : w.b,
      };
    }
    if (mirrored) {
      out.push({
        ...p,
        id: p.id.replace("true_node", "mean_node"),
        when: mirrored,
        atomIds: p.atomIds.map((a) => a.replace("true_node", "mean_node")),
      });
    }
  }
  return out;
}

export function compileHouseSource(set: HousePassageSet): InterpretationSource {
  return {
    id: set.id,
    version: set.version,
    rules: mirrorNodeRules(set.passages).map(ruleFromHousePassage),
  };
}
