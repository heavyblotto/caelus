/**
 * The figure harness: the corpus discipline extended to figures.
 *
 * Walks the plate registry, SSR-renders every spec at its resting
 * params in canonical mode (fixed size, embedded tier), hashes the
 * SVG, and compares against the committed hashes
 * (figure-hashes.json). Scrub widgets hash at each named station, not
 * only at rest. It also asserts the stamped engine version equals the
 * version doing the computing — a figure that cannot name the engine
 * that drew it does not ship. A dependency bump that moves a cusp by
 * an arcsecond is a hash diff; a broken plate fails the build.
 *
 * Regenerate after an intentional change:
 *   CAELUS_FIGURES_WRITE=1 node dist/test/harness.test.js
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, VERSION } from "caelus";
import { loadNodeData } from "caelus/node";
import { HOUSE_SYSTEMS } from "caelus";
import { deriveScene, DerivationFigure, DERIVATION_STATIONS } from "../src/derivation.js";
import { deriveAnatomy, WheelAnatomyFigure } from "../src/wheel-anatomy.js";
import { deriveComparator, HouseComparatorFigure } from "../src/house-comparator.js";
import { ANATOMY_LAYERS } from "../src/spec.js";
import type { PlateRegistry, PlateRecord } from "../src/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test at runtime; the fixtures live in the source test dir
const fixtures = join(here, "..", "..", "test");
const WRITE = process.env.CAELUS_FIGURES_WRITE === "1";

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

const registry = JSON.parse(
  readFileSync(join(fixtures, "plate-registry.json"), "utf8"),
) as PlateRegistry;

const sha = (svg: string): string =>
  createHash("sha256").update(svg).digest("hex");

/** Canonical renders for one plate: at rest, then at every station a
 *  scrub widget names. Keyed `id` and `id@station`. */
function renderPlate(rec: PlateRecord): Record<string, string> {
  const spec = rec.spec;
  switch (spec.kind) {
    case "derivation": {
      const scene = deriveScene(eng, spec.params);
      const at = (t: number): string =>
        renderToStaticMarkup(
          <DerivationFigure scene={scene} t={t}
            follow={spec.params.follow} />,
        );
      const out: Record<string, string> = {
        [rec.id]: sha(at(spec.params.t ?? 1)),
      };
      for (const s of DERIVATION_STATIONS) {
        out[`${rec.id}@${s.id}`] = sha(at(s.t));
      }
      return out;
    }
    case "wheel-anatomy": {
      // Toggle widgets hash the cumulative build: rest first, then the
      // figure as each layer joins in tutorial order, keyed by the
      // layer that just arrived.
      const scene = deriveAnatomy(eng, spec.params);
      const out: Record<string, string> = {
        [rec.id]: sha(renderToStaticMarkup(
          <WheelAnatomyFigure scene={scene} />,
        )),
      };
      for (let k = 1; k <= ANATOMY_LAYERS.length; k++) {
        out[`${rec.id}@${ANATOMY_LAYERS[k - 1]}`] = sha(renderToStaticMarkup(
          <WheelAnatomyFigure scene={scene}
            layers={ANATOMY_LAYERS.slice(0, k)} />,
        ));
      }
      return out;
    }
    case "house-comparator": {
      // Comparators hash at rest and then once per house system —
      // the twelve are this widget's stations.
      const scene = deriveComparator(eng, spec.params);
      const out: Record<string, string> = {
        [rec.id]: sha(renderToStaticMarkup(
          <HouseComparatorFigure scene={scene} />,
        )),
      };
      for (const sys of HOUSE_SYSTEMS) {
        out[`${rec.id}@${sys}`] = sha(renderToStaticMarkup(
          <HouseComparatorFigure scene={scene} system={sys} />,
        ));
      }
      return out;
    }
    default:
      throw new Error(`figure harness: unknown widget kind`);
  }
}

// stamp discipline: the registry and every plate name the running engine
assert(registry.engineVersion === VERSION,
  `registry stamped ${registry.engineVersion}, engine is ${VERSION}`);
for (const rec of registry.plates) {
  assert(rec.engineVersion === VERSION,
    `${rec.id} stamped ${rec.engineVersion}, engine is ${VERSION}`);
}

const got: Record<string, string> = {};
for (const rec of registry.plates) Object.assign(got, renderPlate(rec));

const hashPath = join(fixtures, "figure-hashes.json");
if (WRITE) {
  writeFileSync(hashPath, `${JSON.stringify(
    { engineVersion: VERSION, hashes: got }, null, 1,
  )}\n`);
  console.log(`wrote ${Object.keys(got).length} hashes -> ${hashPath}`);
} else {
  const want = JSON.parse(readFileSync(hashPath, "utf8")) as {
    engineVersion: string;
    hashes: Record<string, string>;
  };
  assert(want.engineVersion === VERSION,
    `committed hashes computed by ${want.engineVersion}, engine is ${VERSION}`);
  const keys = new Set([...Object.keys(want.hashes), ...Object.keys(got)]);
  for (const k of keys) {
    assert(got[k] === want.hashes[k],
      `${k}: ${got[k]?.slice(0, 12)} vs committed ${want.hashes[k]?.slice(0, 12)}`);
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
