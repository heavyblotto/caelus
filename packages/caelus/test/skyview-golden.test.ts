/**
 * SkyView numeric-spine golden: the TS side (resolveLens, skyPlacer,
 * twilightStage/limitingMag, extinctionMag, and the full skyView body loop)
 * must reproduce the Python reference (astroengine.skyview) on the same specs
 * (skyview-golden.json, from export_skyview_golden.py). Numbers compared with
 * tolerance; structure exact. The Python fixture carries snake_case keys and
 * null where the TS placer yields NaN (behind a rectilinear camera); the maps
 * below translate the TS results into that shape before comparing.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { julianDay, mod } from "../src/core.js";
import { Engine } from "../src/chart.js";
import { loadNodeData } from "../src/node-loader.js";
import { extinctionMag } from "../src/pheno.js";
import {
  resolveLens, skyPlacer, twilightStage, limitingMag, skyView,
  SkyLens, SkyPlacement, SkyBody, SkyOffFrameBody,
} from "../src/skyview.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/skyview-golden.json"), "utf8"));
const eng = new Engine(loadNodeData(join(here, "../../data"), "embedded", "full"));

const pix = (v: number): number | null => (Number.isFinite(v) ? v : null);

function mapLens(l: SkyLens): unknown {
  return {
    name: l.name, focal_length_mm: l.focalLengthMm,
    sensor_width_mm: l.sensorWidthMm, projection: l.projection,
    hfov_deg: l.hfovDeg, vfov_deg: l.vfovDeg,
  };
}

function mapPlace(p: SkyPlacement): unknown {
  return {
    alt_app: p.altApp, x: pix(p.x), y: pix(p.y), in_frame: p.inFrame,
    delta_deg: p.deltaDeg, side: p.side,
  };
}

function mapBody(b: SkyBody): unknown {
  return {
    id: b.id, azimuth_deg: b.azimuthDeg, altitude_deg: b.altitudeDeg,
    x: b.x, y: b.y, in_frame: b.inFrame, size_px: b.sizePx,
    angular_diameter_deg: b.angularDiameterDeg, magnitude: b.magnitude,
    extinction_mag: b.extinctionMag, naked_eye: b.nakedEye,
    ...(b.id === "moon"
      ? { illum: b.illum, bright_limb_angle_deg: b.brightLimbAngleDeg }
      : {}),
  };
}

function mapOff(o: SkyOffFrameBody): unknown {
  return {
    id: o.id, side: o.side, delta_deg: o.deltaDeg,
    azimuth_deg: o.azimuthDeg, altitude_deg: o.altitudeDeg,
    magnitude: o.magnitude,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compute(spec: any): any {
  switch (spec.type) {
    case "lens":
      return mapLens(resolveLens(spec.lens, spec.width, spec.height));
    case "place": {
      const lens = resolveLens(spec.lens, spec.width, spec.height);
      const placer = skyPlacer(spec.aim[0], spec.aim[1], lens, spec.width,
        spec.height, { refraction: spec.refraction });
      return spec.points.map(([az, alt]: number[]) => mapPlace(placer(az, alt)));
    }
    case "twilight": {
      const rows: unknown[] = [];
      for (const sunAlt of spec.sun_alts) {
        const stage = twilightStage(sunAlt);
        for (const moon of spec.moons) {
          for (const bortle of spec.bortles) {
            rows.push({
              stage,
              limit: limitingMag(stage, moon === null ? null : moon[0],
                moon === null ? null : moon[1], bortle ?? undefined),
            });
          }
        }
      }
      return rows;
    }
    case "extinction":
      return spec.alts.map((alt: number) => extinctionMag(alt));
    case "bodies": {
      const j = julianDay(spec.jd[0], spec.jd[1], spec.jd[2],
        spec.jd[3] ?? 0, spec.jd[4] ?? 0, spec.jd[5] ?? 0);
      const r = skyView(eng, j, {
        observer: {
          lat: spec.observer.lat, lonEast: spec.observer.lon_east,
          altM: spec.observer.alt_m,
        },
        aim: spec.aim,
        lens: spec.lens,
        image: spec.image,
      }, { bortle: spec.bortle ?? undefined, includeStars: false });
      // The Python reference mirrors the body loop only (no star field), so
      // stars are excluded above; the numeric core is identical either way.
      const sun = eng.position("sun", j);
      const moon = eng.position("moon", j);
      return {
        summary: {
          twilight: r.sky.twilight,
          limiting_mag: r.sky.limitingMag,
          sun_alt_true: r.sky.sunAltitudeDeg,
          moon_alt_true: r.sky.moonAltitudeDeg,
          moon_illum: r.sky.moonIllum,
          moon_waxing: mod(moon.lon - sun.lon, 360) < 180,
        },
        bodies: r.bodies.map(mapBody),
        off_frame: r.offFrame.map(mapOff),
      };
    }
    default: throw new Error(`unknown skyview type ${spec.type}`);
  }
}

let checks = 0;
let failures = 0;
let worst = 0;
const TOL = 1e-9;

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

console.log(`\n${checks} checks, ${failures} failures`);
console.log(`worst numeric diff: ${worst.toExponential(2)}`);
process.exit(failures ? 1 : 0);
