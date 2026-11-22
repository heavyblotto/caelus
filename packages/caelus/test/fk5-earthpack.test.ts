/**
 * Regression checks for GitHub issue #20: `fk5Correction` (Meeus 32.3) bridges
 * VSOP87D's dynamical ecliptic to FK5 and must not run on Horizons-derived
 * `earthPack` / `earthEraPacks` vectors.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCSEC, DEG, J2000,
  earthHeliocentric, mod, nutation, planetApparent, precessEcliptic, sunApparent,
  type EngineData,
} from "../src/core.js";
const TWO_PI = 2 * Math.PI;
import { Engine } from "../src/chart.js";
import { embeddedData } from "../src/data-embedded.js";
import { loadNodeData } from "../src/node-loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const fullData = loadNodeData(join(here, "../../data"), "embedded", "full");
const fullEng = new Engine(fullData);
const embEng = new Engine(embeddedData);

let checks = 0;
let failures = 0;
const ok = (cond: boolean, msg: string): void => {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
};

const wrapArcsec = (aDeg: number, bDeg: number): number =>
  ((((aDeg - bDeg + 180) % 360) + 360) % 360 - 180) * 3600;

// 1. Exact shione54 reproduction from issue #20 (1985-11-03 05:25:00 UTC, TT = JD 2446372.726333148)
const JD_TT = 2446372.726333148;
const HORIZONS_LTS_XYZ: [number, number, number] = [
  -7.493296385024389e-1,
  -6.499307199215022e-1,
  -2.000051510337879e-5,
];
const [hx, hy, hz] = HORIZONS_LTS_XYZ;
const hLon = mod(Math.atan2(hy, hx), TWO_PI) / DEG;
const hLat = Math.asin(hz / Math.hypot(hx, hy, hz)) / DEG;

ok(fullData.earthPack !== undefined, "full node data has earthPack loaded");
const [pubLon, pubLat] = fullEng.ecliptic("sun", JD_TT);
const [dpsi] = nutation(fullData, JD_TT);
const [j2Lon, j2Lat] = precessEcliptic(pubLon - dpsi, pubLat, JD_TT, J2000);
const dLonArcsec = wrapArcsec(mod(j2Lon, TWO_PI) / DEG, hLon);
const dLatArcsec = (j2Lat / DEG - hLat) * 3600;
ok(Math.abs(dLonArcsec) < 0.005, `earthPack Sun matches Horizons LT+S lon within 0.005" (got ${dLonArcsec.toFixed(4)}")`);
ok(Math.abs(dLatArcsec) < 0.001, `earthPack Sun matches Horizons LT+S lat within 0.001" (got ${dLatArcsec.toFixed(4)}")`);

// 2. Embedded VSOP87D fallback (no earthPack) MUST keep applying fk5Correction
ok(embeddedData.earthPack === undefined && embeddedData.earthEraPacks === undefined, "embeddedData uses VSOP87D Earth");
const [vsopLon] = sunApparent(embeddedData, JD_TT);
const embVsFullArcsec = Math.abs(wrapArcsec(vsopLon / DEG, pubLon / DEG));
ok(embVsFullArcsec < 0.15, `embeddedData VSOP87D Sun with FK5 agrees with earthPack Sun within 0.15" (got ${embVsFullArcsec.toFixed(4)}")`);

// Verify embeddedData actually applied -0.09033" relative to uncorrected VSOP87D
const [L0e, , R0e] = earthHeliocentric(embeddedData, JD_TT);
const rawEmbLon = mod(L0e + Math.PI, TWO_PI) - (20.4898 * ARCSEC) / R0e + nutation(embeddedData, JD_TT)[0];
const embFk5Shift = wrapArcsec(vsopLon / DEG, rawEmbLon / DEG);
ok(Math.abs(embFk5Shift + 0.09033) < 0.002, `embeddedData applies -0.09033" FK5 shift (got ${embFk5Shift.toFixed(5)}")`);

// 3. Classical-era-only EngineData (only earthEraPacks, no modern earthPack) skips fk5Correction
const classicalOnlyData: EngineData = {
  ...embeddedData,
  earthPack: undefined,
  earthEraPacks: fullData.earthEraPacks,
};
ok((classicalOnlyData.earthEraPacks?.length ?? 0) > 0, "classical earthEraPacks available");
const jdClass = 1903848.0; // 500 CE Julian
const [clLon] = sunApparent(classicalOnlyData, jdClass);
const [L0c, , R0c] = earthHeliocentric(classicalOnlyData, jdClass);
const rawClassLon = mod(L0c + Math.PI, TWO_PI) - (20.4898 * ARCSEC) / R0c + nutation(classicalOnlyData, jdClass)[0];
ok(Math.abs(wrapArcsec(clLon / DEG, rawClassLon / DEG)) < 1e-6, "classical earthEraPacks skips fk5Correction");

// 4. Mixed-tier planetApparent: earthPack loaded alongside unpacked VSOP87D Mars
const mixedData: EngineData = {
  ...embeddedData,
  earthPack: fullData.earthPack,
};
const [packedMarsLon] = fullEng.ecliptic("mars", JD_TT);
const [mixedMarsLon] = planetApparent(mixedData, "mars", JD_TT);
const [embMarsLon] = embEng.ecliptic("mars", JD_TT);
const mixedVsPacked = Math.abs(wrapArcsec(mixedMarsLon / DEG, packedMarsLon / DEG));
const mixedVsEmb = Math.abs(wrapArcsec(mixedMarsLon / DEG, embMarsLon / DEG));
ok(mixedVsPacked < 0.5, `mixed-tier VSOP Mars + earthPack agrees with packed Mars within 0.5" (got ${mixedVsPacked.toFixed(4)}")`);
ok(mixedVsEmb < 0.15, `mixed-tier Mars agrees with pure VSOP87D Mars without FK5 skew (got ${mixedVsEmb.toFixed(4)}")`);

console.log(`fk5-earthpack: ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
