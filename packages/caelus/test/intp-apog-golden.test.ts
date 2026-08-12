/**
 * Interpolated ("natural") lunar apogee golden: the TS engine must reproduce
 * the Python reference's intp_apog positions. Both sides evaluate the SAME
 * Chebyshev pack (data/intp_apog_cheb.json, minted by
 * python/fit_intp_apog.py from the engine's own DE-derived precise Moon), so
 * position differences are pure evaluator differences -- tolerance 1e-9 deg.
 *
 * Plus the construction's invariant: at a stored apogee-passage instant the
 * apsis IS the Moon, so the pack longitude must sit on the engine's Moon
 * longitude there (0.1 deg: the spline passes through the knots; the
 * Chebyshev refit adds only ~arcsec).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine, NOT_ASPECTABLE } from "../src/chart.js";
import { engineCapabilities } from "../src/capabilities.js";
import { loadNodeData } from "../src/node-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/intp-apog-golden.json"), "utf8"));
const data = loadNodeData(join(here, "../../data"), "embedded", "full");
const eng = new Engine(data);

let checks = 0;
let failures = 0;
let worst = 0;
const TOL = 1e-9;

function wrapDiff(a: number, b: number): number {
  return Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
}

function near(id: string, got: number, want: number, tol: number, wrap = false): void {
  checks++;
  const d = wrap ? wrapDiff(got, want) : Math.abs(got - want);
  if (tol === TOL && d > worst) worst = d;
  if (!(d <= tol)) {
    failures++;
    console.error(`FAIL ${id}: ${got} vs ${want} (diff ${d})`);
  }
}

function ok(cond: boolean, id: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${id}`);
  }
}

// structural: the pack loads, joins bodies(), classifies as a chebyshev_pack
// point with no validated span, and stays out of aspect search
ok(eng.bodies().includes("intp_apog"), "intp_apog in engine.bodies()");
ok(NOT_ASPECTABLE.has("intp_apog"), "intp_apog is a point (not aspectable)");
const cap = engineCapabilities(eng).bodies.find((b) => b.body === "intp_apog");
ok(cap?.source === "chebyshev_pack" && cap.validated === null && !!cap.fitted,
  "capabilities: chebyshev_pack source, null validated span, fitted span present");

// positions across the span: same pack, evaluator-level agreement
for (const c of G.cases as { jd: number; lon: number; lat: number }[]) {
  const p = eng.position("intp_apog", c.jd);
  near(`jd ${c.jd} lon`, p.lon, c.lon, TOL, true);
  near(`jd ${c.jd} lat`, p.lat, c.lat, TOL);
  ok(p.dist === null, `jd ${c.jd} dist is null (a point, like the Lilith points)`);
}

// passage invariant: pack lon ~= the engine's own Moon lon at each stored
// apogee instant, and the pack lon replays the reference exactly
for (const s of G.passages as { jd: number; intp_lon: number; moon_lon: number }[]) {
  const intp = eng.longitude("intp_apog", s.jd);
  near(`passage ${s.jd} pack lon`, intp, s.intp_lon, TOL, true);
  near(`passage ${s.jd} vs moon`, intp, eng.longitude("moon", s.jd), 0.1, true);
}

// outside the fitted span the pack throws RangeError (chartAt turns that
// into an `unavailable` entry, the packed-body contract)
checks++;
try {
  eng.position("intp_apog", 2200000.5); // ~1310 CE, far before the fit
  failures++;
  console.error("FAIL out-of-range: expected RangeError");
} catch (e) {
  if (!(e instanceof RangeError)) {
    failures++;
    console.error(`FAIL out-of-range: threw ${e} instead of RangeError`);
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
console.log(`worst evaluator diff: ${worst.toExponential(2)} deg`);
process.exit(failures ? 1 : 0);
