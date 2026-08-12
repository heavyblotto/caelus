/**
 * Synthetic-ephemeris golden: the TS module must reproduce the Python
 * reference on the same specs (synthetic-golden.json, from
 * export_synthetic_golden.py). Pure math -- Kepler solver, vector frames,
 * central-difference speeds -- so tolerances are tiny; structure (validation
 * messages, retrograde flags) compares exactly.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateSyntheticSystem, syntheticPositions, syntheticEphemeris,
  SyntheticSystem,
} from "../src/synthetic.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/synthetic-golden.json"), "utf8"));

let checks = 0;
let failures = 0;
let worst = 0;
const TOL = 1e-9;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compute(spec: any): any {
  switch (spec.type) {
    case "validate":
      return validateSyntheticSystem(spec.sys as SyntheticSystem);
    case "positions":
      return syntheticPositions(spec.sys as SyntheticSystem, spec.t);
    case "ephemeris": {
      const eph = syntheticEphemeris(spec.sys as SyntheticSystem);
      return (spec.ts as number[]).map((t) => eph.position(spec.body, t));
    }
    default: throw new Error(`unknown synthetic type ${spec.type}`);
  }
}

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
  } else if (want !== null && typeof want === "object") {
    for (const k of Object.keys(want)) deepCmp(`${id}.${k}`, got?.[k], want[k]);
  } else {
    leaf(id, got, want);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const c of G.cases as any[]) deepCmp(c.id, compute(c.spec), c.result);

// The ephemeris sweep must actually contain an apparent-retrograde sample --
// the whole point of viewing an outer body from an inner observer. Guard the
// fixture against becoming vacuously green.
{
  const sweep = (G.cases as Array<{ id: string; result: Array<{ retrograde: boolean }> }>)
    .find((c) => c.id === "ephemeris-observed-sweep");
  checks++;
  if (!sweep || !sweep.result.some((p) => p.retrograde)) {
    failures++;
    console.error("FAIL ephemeris-observed-sweep: no retrograde sample in the sweep");
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
console.log(`worst numeric diff: ${worst.toExponential(2)}`);
process.exit(failures ? 1 : 0);
