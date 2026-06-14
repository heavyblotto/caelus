/**
 * Features golden: the TS port must reproduce the Python reference on the same
 * specs (features-golden.json). Numbers compared with tolerance; structure exact.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { julianDay } from "../src/core.js";
import { Engine } from "../src/chart.js";
import { loadNodeData } from "../src/node-loader.js";
import { featureVector, cosineSimilarity, chartFeatures, configurationFit } from "../src/features.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/features-golden.json"), "utf8"));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

function jd(date: number[]): number {
  return julianDay(date[0], date[1], date[2], date[3] ?? 0, date[4] ?? 0, date[5] ?? 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compute(spec: any): any {
  switch (spec.type) {
    case "vector":
      return featureVector(spec.items.map((it: number[]) => [it[0], it[1]]));
    case "cosine":
      return cosineSimilarity(spec.a, spec.b);
    case "chart":
      return chartFeatures(eng, jd(spec.jd), { weights: spec.weights });
    case "fit": {
      const target = chartFeatures(eng, jd(spec.target_jd));
      return configurationFit(eng, jd(spec.jd), target);
    }
    default: throw new Error(`unknown features type ${spec.type}`);
  }
}

let checks = 0;
let failures = 0;
let worst = 0;
const TOL = 1e-12;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function leaf(id: string, got: any, want: any): void {
  checks++;
  if (typeof want === "number") {
    const d = Math.abs(got - want);
    if (d > worst) worst = d;
    if (typeof got !== "number" || d > TOL) {
      failures++; console.error(`FAIL ${id}: ${got} vs ${want} (diff ${d})`);
    }
  } else if (got !== want) {
    failures++; console.error(`FAIL ${id}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepCmp(id: string, got: any, want: any): void {
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) {
      checks++; failures++;
      console.error(`FAIL ${id}: length ${got?.length} vs ${want.length}`);
      return;
    }
    for (let i = 0; i < want.length; i++) deepCmp(`${id}[${i}]`, got[i], want[i]);
  } else {
    leaf(id, got, want);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const c of G.cases as any[]) deepCmp(c.id, compute(c.spec), c.result);

console.log(`\n${checks} checks, ${failures} failures`);
console.log(`worst numeric diff: ${worst.toExponential(2)}`);
process.exit(failures ? 1 : 0);
