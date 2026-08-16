/**
 * Golden conformance test: the TypeScript port must reproduce the validated
 * Python engine's output. Both run identical algorithms in IEEE doubles, so
 * tolerances are tiny -- any real porting bug violates them by orders of
 * magnitude.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  julianDay, deltaT, jdTT, nutation, meanObliquity, DEG, mod, ayanamsa,
} from "../src/core.js";
import { Engine, BODIES, Body, DEFAULT_ORBS, ASPECTS, SIGNS, NOT_ASPECTABLE, findAspects } from "../src/chart.js";
import { aspectPhase } from "../src/electional.js";
import { compositeLongitudes, declinationAspects, outOfBounds, returns } from "../src/derived.js";
import { dignityScore } from "../src/dignity-score.js";
import { engineCapabilities } from "../src/capabilities.js";
import { deltaTSigma } from "../src/ranges.js";
import { interpretationContext } from "../src/interpretation.js";
import {
  transitAspects, transitHouses, synastryAspects, synastryOverlays,
  compositePlacements, compositeAspects, compositeFrame, activeReturns, activeLunations,
} from "../src/relational.js";
import { enrichContextOptions, enrichSynastryOptions } from "../src/interpretation-enrich.js";
import { profectionAt } from "../src/profections.js";
import { zrAt } from "../src/releasing.js";
import { firdariaAt } from "../src/firdaria.js";
import { vimshottariAt } from "../src/vedic.js";
import { yogasAt } from "../src/yogas.js";
import {
  interpret, hasPlacement, hasAspect, hasPattern, hasStar, hasLot, hasParallel,
  hasAngleContact,
  matchAll, matchNone,
  hasDispositor, hasReception, hasTransit, hasTransitHouse, hasStation,
  hasTimelord, hasDignityFine, hasSynastry,
  hasComposite, hasNakshatra, hasVarga, hasYoga, reconcile,
  hasReturn, hasLunation, hasSolarPhase, hasCompositeAspect,
} from "../src/interpret.js";
import { chartBrief, auditCitations, BRIEF_INSTRUCTIONS } from "../src/brief.js";
import {
  resolveTime, resolvePlace, parseOffset, isTimeAnchored, isoToJd,
} from "../src/provenance.js";
import { realize } from "../src/anchored.js";
import { counterfactual } from "../src/counterfactual.js";
import { pheno, equationOfTime } from "../src/pheno.js";
import { riseSet, crossings, lunarPhases, stations, gauquelinSector } from "../src/events.js";
import {
  lunarEclipses, solarEclipses, solarEclipseWhere, solarEclipseLocal,
  solarEclipseLimits, lunarEclipseLocal,
} from "../src/eclipses.js";
import * as H from "../src/houses.js";
import { loadNodeData } from "../src/node-loader.js";
import { embeddedData } from "../src/data-embedded.js";

const here = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(here, "../../test/golden.json"), "utf8"));
const data = loadNodeData(join(here, "../../data"), "embedded", "full");
const eng = new Engine(data);

let checks = 0;
let failures = 0;
let worst = { what: "", diff: 0 };

// `worst` tracks ANGULAR deviations only (expectAngleDeg): mixing JD,
// AU, magnitude, and second-valued diffs into one headline number would
// make "nano-arcseconds" a lie of units.
function expect(what: string, got: number, want: number, tol: number) {
  checks++;
  const diff = Math.abs(got - want);
  if (diff > tol) {
    failures++;
    if (failures <= 10) {
      console.error(`FAIL ${what}: got ${got}, want ${want} (diff ${diff})`);
    }
  }
}

function expectAngleDeg(what: string, got: number, want: number, tolDeg: number) {
  checks++;
  const diff = Math.abs(mod(got - want + 180, 360) - 180);
  if (diff > worst.diff) worst = { what, diff };
  if (diff > tolDeg) {
    failures++;
    if (failures <= 10) {
      console.error(`FAIL ${what}: got ${got}, want ${want} (diff ${diff * 3600}")`);
    }
  }
}

// tolerance: 1e-6 deg = 3.6 milliarcseconds
const TOL = 1e-6;

// julian day sanity
expect("julianDay(2000-1-1.5)", julianDay(2000, 1, 1, 12), 2451545.0, 1e-9);

// delta T
for (const g of G.delta_t) expect(`deltaT@${g.jd}`, deltaT(g.jd), g.dt, 1e-9);

// nutation + obliquity
for (const g of G.nutation) {
  const [dpsi, deps] = nutation(data, g.jde);
  expect(`dpsi@${g.jde}`, dpsi, g.dpsi, 1e-15);
  expect(`deps@${g.jde}`, deps, g.deps, 1e-15);
  expect(`eps0@${g.jde}`, meanObliquity(g.jde), g.eps0, 1e-15);
}

// body longitudes
for (const row of G.longitudes) {
  for (const b of BODIES) {
    expectAngleDeg(
      `${b}@${row.jd_ut}`, eng.longitude(b as Body, row.jd_ut), row.bodies[b], TOL,
    );
  }
}

// positions: speed + retrograde + lat/dist/ra/dec
for (const row of G.positions) {
  for (const b of BODIES) {
    const p = eng.position(b as Body, row.jd_ut);
    const g = row.bodies[b];
    expectAngleDeg(`${b}.lon@${row.jd_ut}`, p.lon, g.lon, TOL);
    expect(`${b}.speed@${row.jd_ut}`, p.speed, g.speed, 1e-6);
    expect(`${b}.lat@${row.jd_ut}`, p.lat, g.lat, TOL);
    expect(`${b}.latSpeed@${row.jd_ut}`, p.latSpeed ?? NaN, g.lat_speed, 1e-6);
    expectAngleDeg(`${b}.ra@${row.jd_ut}`, p.ra, g.ra, TOL);
    expect(`${b}.dec@${row.jd_ut}`, p.dec, g.dec, TOL);
    checks++;
    if (g.dist === null ? p.dist !== null : Math.abs((p.dist ?? NaN) - g.dist) > 1e-9) {
      failures++;
      console.error(`FAIL ${b}.dist@${row.jd_ut}: ${p.dist} vs ${g.dist}`);
    }
    checks++;
    if (p.retrograde !== g.retrograde) {
      failures++;
      console.error(`FAIL ${b}.retrograde@${row.jd_ut}`);
    }
  }
}

// sidereal longitudes + ayanamsa values
for (const row of G.sidereal) {
  for (const mode of Object.keys(row.modes)) {
    const want = row.modes[mode];
    const zodiac = `sidereal:${mode}` as const;
    expect(`ayanamsa.${mode}@${row.jd_ut}`,
      ayanamsa(jdTT(row.jd_ut), mode), want.ayanamsa, TOL);
    expectAngleDeg(`sun.${mode}@${row.jd_ut}`,
      eng.longitude("sun", row.jd_ut, { zodiac }), want.sun, TOL);
    expectAngleDeg(`moon.${mode}@${row.jd_ut}`,
      eng.longitude("moon", row.jd_ut, { zodiac }), want.moon, TOL);
  }
}

// extras: lilith, topocentric, heliocentric, pheno, equation of time
for (const row of G.extras) {
  const jd = row.jd_ut;
  const lil = eng.position("mean_lilith", jd);
  expectAngleDeg(`lilith.lon@${jd}`, lil.lon, row.lilith.lon, TOL);
  expect(`lilith.lat@${jd}`, lil.lat, row.lilith.lat, TOL);
  expect(`lilith.speed@${jd}`, lil.speed, row.lilith.speed, 1e-6);
  const topo = eng.position("moon", jd, {
    topocentric: true, observer: { lat: 27.95, lonEast: -82.46, altM: 10.0 },
  });
  expectAngleDeg(`moon.topo@${jd}`, topo.lon, row.moon_topo_lon, TOL);
  const helio = eng.heliocentric("mars", jd);
  expectAngleDeg(`mars.helio.lon@${jd}`, helio.lon, row.mars_helio.lon, TOL);
  expect(`mars.helio.dist@${jd}`, helio.dist, row.mars_helio.dist, 1e-9);
  const ven = eng.position("venus", jd);
  expectAngleDeg(`venus.ra@${jd}`, ven.ra, row.venus.ra, TOL);
  expect(`venus.dec@${jd}`, ven.dec, row.venus.dec, TOL);
  for (const [body, want] of [["mars", row.pheno_mars], ["moon", row.pheno_moon]] as const) {
    const ph = pheno(eng, body, jd);
    expect(`pheno.${body}.phase_angle@${jd}`, ph.phaseAngle, want.phase_angle, TOL);
    expect(`pheno.${body}.phase@${jd}`, ph.phase, want.phase, 1e-9);
    expect(`pheno.${body}.elongation@${jd}`, ph.elongation, want.elongation, TOL);
    expect(`pheno.${body}.diameter@${jd}`, ph.diameter, want.diameter, 1e-9);
    expect(`pheno.${body}.magnitude@${jd}`, ph.magnitude, want.magnitude, 1e-6);
  }
  expect(`eot@${jd}`, equationOfTime(eng, jd), row.eot_min, 1e-6);
}

// houses
for (const g of G.houses) {
  const [asc, mc, armc, eps] = H.angles(data, g.jd_ut, g.lat, g.lon);
  expectAngleDeg("asc", asc / DEG, g.asc, TOL);
  expectAngleDeg("mc", mc / DEG, g.mc, TOL);
  expectAngleDeg("armc", armc / DEG, g.armc, TOL);
  expect("eps", eps / DEG, g.eps, TOL);
  const [vtx, east] = H.vertexEastPoint(armc, g.lat * DEG, eps);
  expectAngleDeg("vertex", vtx / DEG, g.vertex, TOL);
  expectAngleDeg("east_point", east / DEG, g.east_point, TOL);
  const phi = g.lat * DEG;
  const systems: Array<[string, number[] | null, () => number[]]> = [
    ["placidus", g.placidus, () => H.housesPlacidus(armc, phi, eps)],
    ["porphyry", g.porphyry, () => H.housesPorphyry(asc, mc)],
    ["equal", g.equal, () => H.housesEqual(asc)],
    ["whole_sign", g.whole_sign, () => H.housesWholeSign(asc)],
    ["koch", g.koch, () => H.housesKoch(armc, phi, eps)],
    ["regiomontanus", g.regiomontanus, () => H.housesRegiomontanus(armc, phi, eps)],
    ["campanus", g.campanus, () => H.housesCampanus(armc, phi, eps)],
    ["alcabitius", g.alcabitius, () => H.housesAlcabitius(armc, phi, eps)],
    ["morinus", g.morinus, () => H.housesMorinus(armc, phi, eps)],
    ["meridian", g.meridian, () => H.housesMeridian(armc, phi, eps)],
    ["polich_page", g.polich_page, () => H.housesPolichPage(armc, phi, eps)],
    ["vehlow", g.vehlow, () => H.housesVehlow(armc, phi, eps)],
  ];
  for (const [name, want, fn] of systems) {
    if (!want) {
      if (name === "koch") {
        // fixture says undefined (polar latitudes): port must throw too
        checks++;
        try {
          fn();
          failures++;
          console.error(`FAIL ${name}@${g.jd_ut}: expected throw`);
        } catch { /* expected */ }
      }
      continue;
    }
    const got = fn();
    for (let i = 0; i < 12; i++) {
      expectAngleDeg(`${name}[${i}]`, got[i] / DEG, want[i], TOL);
    }
  }
}

// events: rise/set/transit, crossings, phases, stations, true lilith
{
  const g = G.events;
  const jd0 = g.jd0;
  const JTOL = 1e-8; // days; both ports bisect the same bracket
  expect("ev.sun_rise", riseSet(eng, "sun", jd0, 27.95, -82.46, "rise")!,
    g.sun_rise_tampa, JTOL);
  expect("ev.moon_set", riseSet(eng, "moon", jd0, 51.5, -0.12, "set")!,
    g.moon_set_london, JTOL);
  expect("ev.mars_mtransit", riseSet(eng, "mars", jd0, -33.87, 151.21, "mtransit")!,
    g.mars_mtransit_sydney, JTOL);
  checks++;
  if (riseSet(eng, "sun", jd0, 78.2, 15.6, "set") !== null) {
    failures++;
    console.error("FAIL ev.polar midnight sun: expected null");
  }
  const cs = crossings(eng, "sun", 0.0, jd0, jd0 + 400);
  const cm = crossings(eng, "moon", 123.45, jd0, jd0 + 30);
  checks++;
  if (cs.length !== g.sun_cross_0.length || cm.length !== g.moon_cross_123.length) {
    failures++;
    console.error("FAIL ev.crossings count");
  } else {
    cs.forEach((t, i) => expect(`ev.sun_cross[${i}]`, t, g.sun_cross_0[i], JTOL));
    cm.forEach((t, i) => expect(`ev.moon_cross[${i}]`, t, g.moon_cross_123[i], JTOL));
  }
  const ph = lunarPhases(eng, jd0, jd0 + 30);
  const st = stations(eng, "mercury", jd0, jd0 + 200);
  checks++;
  if (ph.length !== g.phases_30d.length || st.length !== g.mercury_stations_200d.length) {
    failures++;
    console.error("FAIL ev.phases/stations count");
  } else {
    ph.forEach(([t, name], i) => {
      expect(`ev.phase[${i}]`, t, g.phases_30d[i][0], JTOL);
      checks++;
      if (name !== g.phases_30d[i][1]) {
        failures++;
        console.error(`FAIL ev.phase[${i}] name ${name}`);
      }
    });
    st.forEach(([t, dir], i) => {
      expect(`ev.station[${i}]`, t, g.mercury_stations_200d[i][0], JTOL);
      checks++;
      if (dir !== g.mercury_stations_200d[i][1]) {
        failures++;
        console.error(`FAIL ev.station[${i}] dir ${dir}`);
      }
    });
  }
  const lil = eng.position("true_lilith", jd0);
  expectAngleDeg("ev.true_lilith.lon", lil.lon, g.true_lilith.lon, TOL);
  expect("ev.true_lilith.lat", lil.lat, g.true_lilith.lat, TOL);
  expect("ev.true_lilith.dist", lil.dist!, g.true_lilith.dist, 1e-9);
  for (const [n, want] of Object.entries(g.stars) as Array<[string, any]>) {
    const st = eng.fixedStar(n, jd0);
    expectAngleDeg(`star.${n}.lon`, st.lon, want.lon, TOL);
    expect(`star.${n}.lat`, st.lat, want.lat, TOL);
    expectAngleDeg(`star.${n}.ra`, st.ra, want.ra, TOL);
    expect(`star.${n}.dec`, st.dec, want.dec, TOL);
  }
  expectAngleDeg("star.sid.galcent.sun",
    eng.longitude("sun", jd0, { zodiac: "sidereal:galcent_0sag" }),
    g.star_sidereal.galcent_0sag_sun, TOL);
  expectAngleDeg("star.sid.citra.spica",
    eng.fixedStar("Spica", jd0, { zodiac: "sidereal:true_citra" }).lon,
    g.star_sidereal.true_citra_spica, TOL);
  expect("gauquelin.sun", gauquelinSector(eng, "sun", jd0 + 0.3, 27.95, -82.46)!,
    g.gauquelin.sun_tampa, 1e-6);
  expect("gauquelin.moon", gauquelinSector(eng, "moon", jd0 + 0.6, -33.87, 151.21)!,
    g.gauquelin.moon_sydney, 1e-6);
  {
    const le = lunarEclipses(eng, jd0, jd0 + 366);
    const ge = g.lunar_eclipses_1y;
    checks++;
    if (le.length !== ge.length) {
      failures++;
      console.error(`FAIL lunar eclipse count ${le.length} vs ${ge.length}`);
    } else {
      le.forEach((e, i) => {
        expect(`lec[${i}].t_max`, e.tMax, ge[i].t_max, 1e-8);
        expect(`lec[${i}].mag_u`, e.magUmbral, ge[i].mag_umbral, 1e-9);
        checks++;
        if (e.type !== ge[i].type) { failures++; console.error(`FAIL lec[${i}].type`); }
        if (ge[i].partial_begin !== null) {
          expect(`lec[${i}].pb`, e.partialBegin!, ge[i].partial_begin, 1e-8);
        }
      });
    }
    const se = solarEclipses(eng, jd0, jd0 + 366);
    const gs = g.solar_eclipses_1y;
    checks++;
    if (se.length !== gs.length) {
      failures++;
      console.error(`FAIL solar eclipse count ${se.length} vs ${gs.length}`);
    } else {
      se.forEach((e, i) => {
        expect(`sec[${i}].t_max`, e.tMax, gs[i].t_max, 1e-8);
        expect(`sec[${i}].gamma`, e.gamma, gs[i].gamma, 1e-9);
        expect(`sec[${i}].begin`, e.begin, gs[i].begin, 1e-8);
        checks++;
        if (e.type !== gs[i].type) { failures++; console.error(`FAIL sec[${i}].type`); }
      });
    }
  }
  // Eclipse where/local: validated against NASA GSFC's five-millennium canon
  // rather than golden fixtures, since the canon is the external ground truth
  // (gated via `failures`, no `checks` inflation). Greatest-eclipse point to
  // ~0.02 deg (~2 km) and totality duration to a few seconds.
  for (const c of [
    // NASA GSFC canon: greatest-eclipse point, central duration, eclipse
    // magnitude (Moon/Sun diameter ratio at a central eclipse), path width.
    { y: 2017, m: 8, kind: "total", geLat: 36.974, geLon: -87.659, durS: 160, mag: 1.031, obsc: 1, widthKm: 114.7 },
    { y: 2024, m: 4, kind: "total", geLat: 25.298, geLon: -104.138, durS: 268, mag: 1.057, obsc: 1, widthKm: 197.5 },
    { y: 2023, m: 10, kind: "annular", geLat: 11.4, geLon: -83.1, durS: 317, mag: 0.952, obsc: 0.906, widthKm: 187 },
  ]) {
    const es = solarEclipses(eng, julianDay(c.y, c.m, 1), julianDay(c.y, c.m, 28));
    const e = es.find((x) => x.type === c.kind);
    const w = e ? solarEclipseWhere(eng, e.tMax) : null;
    if (!e || !w || Math.abs(w.lat - c.geLat) > 0.06 || Math.abs(w.lonEast - c.geLon) > 0.06) {
      failures++;
      console.error(`FAIL ${c.y} greatest-eclipse point: ${w ? `${w.lat.toFixed(3)},${w.lonEast.toFixed(3)}` : "null"} vs ${c.geLat},${c.geLon}`);
    }
    const loc = e ? solarEclipseLocal(eng, e.tMax, c.geLat, c.geLon) : null;
    const dur = loc && loc.c2 && loc.c3 ? (loc.c3 - loc.c2) * 86400 : -1;
    if (!loc || loc.type !== c.kind
      || Math.abs(loc.magnitude - c.mag) > 0.002
      || Math.abs(loc.obscuration - c.obsc) > 0.003
      || Math.abs(dur - c.durS) > 8) {
      failures++;
      console.error(`FAIL ${c.y} local@GE: type=${loc?.type} mag=${loc?.magnitude.toFixed(3)} obsc=${loc?.obscuration.toFixed(3)} dur=${dur.toFixed(0)}s`);
    }
    const path = e ? solarEclipseLimits(eng, e.tMax) : null;
    if (!path || path.widthKm === null || Math.abs(path.widthKm - c.widthKm) > 4) {
      failures++;
      console.error(`FAIL ${c.y} path width: ${path?.widthKm?.toFixed(1)} km vs ${c.widthKm} km`);
    }
  }
  // Lunar eclipse local visibility: the 2025-03-14 total lunar eclipse was up
  // over the Americas (night) and below the horizon in East Asia (daytime).
  {
    const le = lunarEclipses(eng, julianDay(2025, 3, 1), julianDay(2025, 3, 31))
      .find((x) => x.type === "total");
    const la = le ? lunarEclipseLocal(eng, le.tMax, 34.05, -118.24) : null; // Los Angeles
    const tk = le ? lunarEclipseLocal(eng, le.tMax, 35.68, 139.69) : null; // Tokyo
    if (!le || !la?.visible || tk?.visible !== false) {
      failures++;
      console.error(`FAIL 2025 lunar visibility: LA alt=${la?.altitude.toFixed(1)} Tokyo alt=${tk?.altitude.toFixed(1)}`);
    }
  }
  for (const [b, want] of Object.entries({ ...g.asteroids, ...g.uranians }) as Array<[string, any]>) {
    const p = eng.position(b, jd0);
    expectAngleDeg(`ast.${b}.lon`, p.lon, want.lon, TOL);
    expect(`ast.${b}.lat`, p.lat, want.lat, TOL);
    expect(`ast.${b}.dist`, p.dist!, want.dist, 1e-9);
    expect(`ast.${b}.speed`, p.speed, want.speed, 1e-6);
    checks++;
    if (p.retrograde !== want.retrograde) {
      failures++;
      console.error(`FAIL ast.${b}.retrograde`);
    }
  }
}

// full chart: aspects count + every cusp/body + angles
{
  const g = G.chart;
  const c = eng.chart(1990, 6, 10, 14, 30, 0, 27.95, -82.46, "placidus");
  expect("chart.jdUt", c.jdUt, g.jd_ut, 1e-9);
  for (const b of BODIES) {
    const cb = c.bodies[b];
    if (!cb) { failures++; console.error(`FAIL chart.${b}: unexpectedly absent`); continue; }
    expectAngleDeg(`chart.${b}`, cb.lon, g.bodies[b].lon, TOL);
  }
  for (let i = 0; i < 12; i++) {
    expectAngleDeg(`chart.cusp[${i}]`, c.cusps[i], g.cusps[i], TOL);
  }
  expectAngleDeg("chart.vertex", c.angles.vertex, g.angles.vertex, TOL);
  expectAngleDeg("chart.east_point", c.angles.eastPoint, g.angles.east_point, TOL);
  checks++;
  if (c.aspects.length !== g.aspects.length) {
    failures++;
    console.error(`FAIL aspect count: ${c.aspects.length} vs ${g.aspects.length}`);
  }
  // Aspects are pinned field-by-field against the Python reference,
  // phase and strength included (the fixture used to omit both, leaving the
  // enrichment cross-language unchecked).
  for (let i = 0; i < Math.min(c.aspects.length, g.aspects.length); i++) {
    const ap = c.aspects[i];
    const ga = g.aspects[i];
    checks++;
    if (ap.a !== ga.a || ap.b !== ga.b || ap.aspect !== ga.aspect || ap.phase !== ga.phase) {
      failures++;
      console.error(`FAIL aspect[${i}]: ${ap.a}~${ap.b} ${ap.aspect} ${ap.phase} vs ${ga.a}~${ga.b} ${ga.aspect} ${ga.phase}`);
    }
    expect(`aspect[${i}].orb`, ap.orb, ga.orb, 1e-9);
    expect(`aspect[${i}].strength`, ap.strength, ga.strength, 1e-9);
    // and the phase must equal the canonical aspectPhase (internal coherence)
    const pa = c.bodies[ap.a]!; const pb = c.bodies[ap.b]!;
    const want = aspectPhase(pa.lon, pa.speed, pb.lon, pb.speed, ASPECTS[ap.aspect]);
    checks++;
    if (ap.phase !== want || ap.strength < 0 || ap.strength > 1) {
      failures++;
      console.error(`FAIL aspect enrich ${ap.a}~${ap.b} ${ap.aspect}: phase=${ap.phase} vs ${want} strength=${ap.strength}`);
    }
  }
  // chartAt(jd) must be byte-for-byte identical to chart(calendar fields).
  // A TS-internal invariant (not a Python-pinned golden), so it guards
  // regressions without inflating the conformance check count.
  const cAt = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
  if (JSON.stringify(cAt) !== JSON.stringify(c)) {
    failures++;
    console.error("FAIL chartAt != chart for identical instant");
  }
}

// sidereal chart: koch + lahiri, options-object call form
{
  const g = G.chart_sidereal;
  const c = eng.chart(1990, 6, 10, 14, 30, 0, 27.95, -82.46, {
    houseSystem: "koch", zodiac: "sidereal:lahiri",
  });
  checks++;
  if (c.zodiac !== g.zodiac || c.houseSystem !== g.house_system) {
    failures++;
    console.error(`FAIL chart_sidereal meta: ${c.zodiac}/${c.houseSystem}`);
  }
  for (const b of BODIES) {
    const cb = c.bodies[b];
    if (!cb) { failures++; console.error(`FAIL sid.${b}: unexpectedly absent`); continue; }
    expectAngleDeg(`sid.${b}`, cb.lon, g.bodies[b].lon, TOL);
  }
  for (let i = 0; i < 12; i++) {
    expectAngleDeg(`sid.cusp[${i}]`, c.cusps[i], g.cusps[i], TOL);
  }
  expectAngleDeg("sid.asc", c.angles.asc, g.angles.asc, TOL);
  expectAngleDeg("sid.mc", c.angles.mc, g.angles.mc, TOL);
}

// polar Placidus fallback contract
{
  const g = G.chart_polar;
  const c = eng.chart(1985, 12, 1, 9, 0, 0, 78.2, 15.6, "placidus");
  checks++;
  if (c.houseSystem !== g.house_system || c.houseSystemRequested !== g.house_system_requested) {
    failures++;
    console.error(`FAIL polar fallback: ${c.houseSystem}/${c.houseSystemRequested}`);
  }
}

// Graceful degradation: a body outside its fitted range is omitted + reported,
// not thrown; an absurd instant (Julian Day passed as a year) still throws.
// These are behavioural assertions, not accuracy fixtures, so they gate the run
// via `failures` without inflating the `checks` count the docs quote.
{
  const inRange = eng.chart(1990, 6, 10, 14, 30, 0, 27.95, -82.46, "placidus");
  if (inRange.unavailable.length !== 0 || !("chiron" in inRange.bodies)) {
    failures++;
    console.error(`FAIL in-range unavailable: ${JSON.stringify(inRange.unavailable)}`);
  }

  // The wide packs make 1700 fully in-range now (validated 1000-3000), so the
  // "past the packs" probe moved to 900 CE. There every packed body -- the
  // majors, Pluto and the small bodies -- is outside its fitted span and lands
  // in `unavailable` (the engine will not compute a body past its validated
  // span rather than silently serve the unvalidated fallback). What still
  // computes is the analytic-and-fallback remainder: the Moon and the nodes.
  const pre1850 = eng.chart(900, 3, 21, 12, 0, 0, 51.5, -0.12, "placidus");
  if (
    !("moon" in pre1850.bodies) ||                 // the Meeus fallback still runs
    !pre1850.unavailable.includes("sun") ||        // sun IS outside its span
    !(pre1850.unavailable.includes("mars")) ||
    !(pre1850.unavailable.includes("pluto")) ||
    !pre1850.warnings.some((w) => w.kind === "outside_validated_range")
  ) {
    failures++;
    console.error(
      `FAIL pre-1000 degradation: unavailable=${JSON.stringify(pre1850.unavailable)} bodies=${Object.keys(pre1850.bodies).length}`,
    );
  }

  // Sparse bodies outside their fitted span are omitted and reported, never
  // thrown. At 900 CE the Pluto pack (1000-3000) and the small-body packs
  // (1600-2484) do not reach, so they land in `unavailable`.
  const pre1700 = eng.chart(900, 6, 1, 12, 0, 0, 48.85, 2.35, "whole_sign");
  if (
    "pluto" in pre1700.bodies ||
    "chiron" in pre1700.bodies ||
    !pre1700.unavailable.includes("pluto") ||
    !pre1700.unavailable.includes("chiron")
  ) {
    failures++;
    console.error(
      `FAIL sparse-pack degradation: 900 unavailable=${JSON.stringify(pre1700.unavailable)}`,
    );
  }

  // Validity warnings: an in-range chart states nothing; an out-of-range chart
  // states what is unvalidated and how uncertain delta-T is.
  if (inRange.warnings.length !== 0) {
    failures++;
    console.error(`FAIL modern chart warnings: ${JSON.stringify(inRange.warnings)}`);
  }
  {
    const rangeWarn = pre1700.warnings.filter((w) => w.kind === "outside_validated_range");
    const dtWarn = pre1700.warnings.find((w) => w.kind === "delta_t_uncertain");
    const warnedBodies = new Set(rangeWarn.map((w) => (w as { body: string }).body));
    // 900 < 1000 (the validated floor): the packed majors are absent (see
    // above), so the one computed body past its span is the Moon on its Meeus
    // fallback -- and it is warned. The analytic nodes carry no stated bound
    // (never warned). Delta-T sigma is well past 5 s.
    if (!warnedBodies.has("moon") || warnedBodies.has("mean_node")
      || !dtWarn || (dtWarn as { sigmaSeconds: number }).sigmaSeconds < 5) {
      failures++;
      console.error(`FAIL 1650 warnings: ${JSON.stringify(pre1700.warnings)}`);
    }
  }
  // Annual aberration must be applied to LATITUDE as well as longitude
  // (Meeus eq. 23.3). The engine originally omitted the latitude component,
  // which is invisible near the ecliptic and first-order away from it: Pallas
  // (inclination 34.8 deg) read 13.3" off against JPL, all of it in latitude.
  // Pinning it needs a high-|beta| epoch, since at beta ~ 0 the term is zero
  // and any regression would hide. 1900-03-15 puts Pallas near beta +32 deg;
  // dropping the term shifts its latitude by ~10 arcsec, far outside this
  // bound, while the correct value sits within an arcsecond of JPL's.
  {
    const jd = 2415092.71; // 1900-03-15 TT, Pallas near beta +32 deg
    const p = eng.position("pallas", jd);
    // JPL Horizons apparent geocentric ecliptic latitude of date at this exact
    // JD (OBSERVER quantity 31, airless, TIME_TYPE=TT). The engine agrees to
    // 0.07" with the term present, and is ~10" out without it.
    const jplLat = 32.31268;
    if (Math.abs(p.lat - jplLat) * 3600 > 2.0) {
      failures++;
      console.error(
        `FAIL aberration latitude term: pallas lat ${p.lat} vs JPL ${jplLat} `
        + `(${((p.lat - jplLat) * 3600).toFixed(3)}" -- is the dbeta term missing?)`,
      );
    }
  }
  // deltaTSigma pins to the published Morrison & Stephenson (2004) sigmas at
  // the breakpoints (the table itself is the oracle) and interpolates between.
  for (const [y, s] of [[0, 260], [1000, 55], [1600, 20], [500, 160], [800, 97]] as const) {
    expect(`deltaTSigma(${y})`, deltaTSigma(y), s, 1e-9);
  }

  let threw = false;
  try {
    eng.chart(2451545, 6, 10, 0, 0, 0, 0, 0);
  } catch (e) {
    threw = e instanceof RangeError;
  }
  if (!threw) {
    failures++;
    console.error("FAIL Julian-Day-as-year did not throw RangeError");
  }
}

// Interpretation context: the fact-atom projection is a deterministic transform
// of a validated chart, so it is checked structurally (gated via `failures`):
// every aspect atom ties back to a chart aspect with a consistent strength and a
// valid phase, every present body has a placement, ids are unique, and atoms are
// salience-sorted.
{
  const c = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
  const ctx = interpretationContext(c);
  const by = (k: string) => ctx.atoms.filter((a) => a.kind === k);
  const ids = new Set(ctx.atoms.map((a) => a.id));
  const sorted = ctx.atoms.every((a, i) => i === 0 || ctx.atoms[i - 1].salience >= a.salience);
  if (
    ids.size !== ctx.atoms.length // unique ids
    || !sorted // descending salience
    || by("placement").length !== Object.keys(c.bodies).length
    // aspect atoms: the chart's own list plus the projection's node aspects
    // (counted exactly by the node-aspect block below)
    || by("aspect").length < c.aspects.length
    || by("angle").length !== 4
  ) {
    failures++;
    console.error(`FAIL interp shape: atoms=${ctx.atoms.length} placements=${by("placement").length}/${Object.keys(c.bodies).length} aspects=${by("aspect").length}/${c.aspects.length} unique=${ids.size === ctx.atoms.length} sorted=${sorted}`);
  }
  // every non-node aspect atom maps to a chart aspect; strength = 1 - |orb|/limit
  // in [0,1] (node atoms are pinned by their own recompute block below)
  for (const a of by("aspect") as Array<{ a: string; b: string; aspect: string; orb: number; strength: number; phase: string }>) {
    if (a.a.endsWith("_node") || a.b.endsWith("_node")) continue;
    const match = c.aspects.find((x) => x.a === a.a && x.b === a.b && x.aspect === a.aspect);
    const want = Math.max(0, 1 - Math.abs(a.orb) / DEFAULT_ORBS[a.aspect]);
    if (!match || Math.abs(match.orb - a.orb) > 1e-9 || Math.abs(a.strength - want) > 1e-9
      || !["applying", "separating", "exact"].includes(a.phase)) {
      failures++;
      console.error(`FAIL interp aspect ${a.a}~${a.b} ${a.aspect}: strength=${a.strength} phase=${a.phase}`);
      break;
    }
  }
  // a known fact: 1990-06-10 has the Sun in Gemini
  const sun = ctx.atoms.find((a) => a.id === "placement:sun") as { sign?: string } | undefined;
  if (sun?.sign !== "Gemini") {
    failures++;
    console.error(`FAIL interp sun placement: ${sun?.sign}`);
  }

  // Declination atoms: the projection's parallels/out-of-bounds must agree
  // with the pinned derived.ts geometry (declinationAspects / outOfBounds),
  // computed over the same aspectable bodies at the same instant.
  {
    const decBodies = Object.keys(c.bodies).filter((b) => !NOT_ASPECTABLE.has(b));
    const wantPairs = declinationAspects(eng, decBodies, c.jdUt, 1.0);
    const gotPairs = by("parallel") as Array<{ a: string; b: string; declination: string }>;
    const key = (a: string, b: string, k: string) => [[a, b].sort().join("~"), k].join(":");
    const wantSet = new Set(wantPairs.map((p) => key(p.a, p.b, p.kind as string)));
    const gotSet = new Set(gotPairs.map((p) => key(p.a, p.b, p.declination)));
    if (wantSet.size !== gotSet.size || [...wantSet].some((k) => !gotSet.has(k))) {
      failures++;
      console.error(`FAIL interp parallels: want ${[...wantSet].join(",")} got ${[...gotSet].join(",")}`);
    }
    const wantOob = decBodies.filter((b) => outOfBounds(eng, b, c.jdUt)).sort();
    const gotOob = (by("outOfBounds") as Array<{ body: string }>).map((a) => a.body).sort();
    if (wantOob.join() !== gotOob.join()) {
      failures++;
      console.error(`FAIL interp out-of-bounds: want [${wantOob}] got [${gotOob}]`);
    }
    // The selectors resolve against the projected atoms.
    if (gotPairs.length > 0) {
      const p0 = gotPairs[0];
      const m = hasParallel({ between: [p0.a, p0.b] })(ctx);
      if (!m.matched) {
        failures++;
        console.error(`FAIL hasParallel does not match projected ${p0.a}~${p0.b}`);
      }
    }
  }

  // Planet-on-angle contacts: the projection's angleContact atoms must agree
  // with separations recomputed from the chart's own angles at the default 8°
  // orb; mean_node sits out; the angleOrb option tightens the set; the
  // selector resolves against the projected atoms.
  {
    const points: Array<[string, number]> = [
      ["asc", c.angles.asc], ["dsc", mod(c.angles.asc + 180, 360)],
      ["mc", c.angles.mc], ["ic", mod(c.angles.mc + 180, 360)],
    ];
    const wantOrb = new Map<string, number>();
    for (const [body, p] of Object.entries(c.bodies)) {
      if (!p || body === "mean_node") continue;
      for (const [angle, lon] of points) {
        const orb = Math.abs(mod(p.lon - lon + 180, 360) - 180);
        if (orb <= 8) wantOrb.set(`${body}:${angle}`, orb);
      }
    }
    const got = by("angleContact") as Array<{ body: string; angle: string; orb: number }>;
    const bad = got.filter((a) => {
      const want = wantOrb.get(`${a.body}:${a.angle}`);
      return want === undefined || Math.abs(want - a.orb) > 1e-9;
    });
    if (got.length !== wantOrb.size || bad.length) {
      failures++;
      console.error(`FAIL interp angleContact: want ${[...wantOrb.keys()].join(",")} got ${got.map((a) => `${a.body}:${a.angle}`).join(",")}`);
    }
    if (got.length > 0) {
      const a0 = got[0];
      if (!hasAngleContact({ body: a0.body, angle: a0.angle })(ctx).matched) {
        failures++;
        console.error(`FAIL hasAngleContact does not match projected ${a0.body}:${a0.angle}`);
      }
    }
    const tight = interpretationContext(c, { angleOrb: 1 })
      .atoms.filter((a) => a.kind === "angleContact") as Array<{ body: string; angle: string; orb: number }>;
    if (tight.some((a) => a.orb > 1) || tight.length > got.length) {
      failures++;
      console.error(`FAIL interp angleContact orb option: ${tight.length}/${got.length}`);
    }
  }

  // Node aspects: the projection's node aspect atoms must agree with
  // separations recomputed from the chart's own longitudes (true node vs
  // every aspectable body, default orbs); only the true node projects when
  // both nodes are present; the engine boundary is unchanged (findAspects
  // still excludes nodes); the selector resolves against the projected atoms.
  {
    const np = c.bodies.true_node!;
    const wantOrb = new Map<string, number>();
    for (const [body, p] of Object.entries(c.bodies)) {
      if (!p || NOT_ASPECTABLE.has(body)) continue;
      const sep = Math.abs(mod(np.lon - p.lon + 180, 360) - 180);
      for (const [asp, angle] of Object.entries(ASPECTS)) {
        const orb = Math.abs(sep - angle);
        if (orb <= DEFAULT_ORBS[asp]) {
          const [x, y] = ["true_node", body].sort();
          wantOrb.set(`aspect:${x}~${y}:${asp}`, Math.round(orb * 100) / 100);
        }
      }
    }
    const got = (by("aspect") as Array<{ id: string; a: string; b: string; orb: number; phase: string; strength: number; aspect: string }>)
      .filter((a) => a.a === "true_node" || a.b === "true_node" || a.a === "mean_node" || a.b === "mean_node");
    const bad = got.filter((a) => {
      const want = wantOrb.get(a.id);
      return want === undefined || Math.abs(want - a.orb) > 1e-9
        || Math.abs(a.strength - Math.max(0, 1 - a.orb / DEFAULT_ORBS[a.aspect])) > 1e-9
        || !["applying", "separating", "exact"].includes(a.phase);
    });
    if (got.length !== wantOrb.size || bad.length
      || c.aspects.some((a) => a.a.endsWith("_node") || a.b.endsWith("_node"))) {
      failures++;
      console.error(`FAIL interp node aspects: want ${[...wantOrb.keys()].join(",")} got ${got.map((a) => a.id).join(",")}`);
    }
    if (got.length > 0) {
      const a0 = got[0];
      if (!hasAspect({ between: [a0.a, a0.b] as [string, string], aspect: a0.aspect })(ctx).matched) {
        failures++;
        console.error(`FAIL hasAspect does not match projected node aspect ${a0.id}`);
      }
    }
  }

  // Peregrine: a placement atom's dignities carry "peregrine" exactly when
  // the pinned five-fold score (dignity-golden) reports it for a classical
  // planet in this chart's sect; never for the outers or points; and the
  // Chart's own sign-level dignities list stays free of it.
  {
    const CLASSICAL7 = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
    const sect = c.bodies.sun!.house >= 7 ? "day" : "night";
    const got = by("placement") as Array<{ body: string; dignities: string[] }>;
    let peregrines = 0;
    for (const a of got) {
      const p = c.bodies[a.body as Body]!;
      const want = CLASSICAL7.includes(a.body)
        && dignityScore(a.body, p.lon, sect as "day" | "night").peregrine;
      if (want) peregrines++;
      if (a.dignities.includes("peregrine") !== want || p.dignities.includes("peregrine")) {
        failures++;
        console.error(`FAIL interp peregrine ${a.body}: atom=${a.dignities} chart=${p.dignities}`);
      }
    }
    if (peregrines > 0) {
      const body = got.find((a) => a.dignities.includes("peregrine"))!.body;
      if (!hasPlacement({ body, dignity: "peregrine" })(ctx).matched) {
        failures++;
        console.error(`FAIL hasPlacement peregrine does not match ${body}`);
      }
    } else {
      failures++;
      console.error("FAIL interp peregrine: 1990-06-10 chart should hold at least one peregrine classical planet");
    }
  }

  // Capabilities: every body the engine reports is classified, and the Node
  // tier (this test's data dir) reports the pack-backed sources and spans.
  {
    const caps = engineCapabilities(eng);
    const byBody = new Map(caps.bodies.map((x) => [x.body, x]));
    const missing = eng.bodies().filter((b) => !byBody.has(b));
    if (missing.length) {
      failures++;
      console.error(`FAIL capabilities: unclassified bodies [${missing}]`);
    }
    const pluto = byBody.get("pluto");
    const moon = byBody.get("moon");
    const ceres = byBody.get("ceres");
    // The wide Pluto pack is validated over its full measured span now
    // (1000-3000), and `fitted` reports the pack's actual geometry (1001-3000).
    // engineCapabilities reports both, so a consumer can tell "will compute"
    // from "has been checked".
    if (caps.plutoTier !== "chebyshev" || pluto?.source !== "chebyshev_pack"
      || pluto.validated?.from !== 1000 || pluto.validated?.to !== 3000
      || !pluto.fitted || Math.abs(pluto.fitted.from - 1001) > 2
      || Math.abs(pluto.fitted.to - 3000) > 2) {
      failures++;
      console.error(`FAIL capabilities pluto: ${JSON.stringify(pluto)} tier=${caps.plutoTier}`);
    }
    // The wide Moon pack is fitted 1000-3000 (fit_moon.py); `validated` stays
    // at the measured 1850-2150 until a wider measurement says otherwise --
    // the same fitted/validated split the Pluto pack makes visible above.
    if (caps.moonTier !== "chebyshev" || moon?.source !== "moon_chebyshev"
      || !moon.fitted || Math.abs(moon.fitted.from - 1000) > 2
      || Math.abs(moon.fitted.to - 3000) > 2) {
      failures++;
      console.error(`FAIL capabilities moon: ${JSON.stringify(moon)} tier=${caps.moonTier}`);
    }
    if (ceres?.source !== "chebyshev_pack" || !ceres.fitted) {
      failures++;
      console.error(`FAIL capabilities ceres: ${JSON.stringify(ceres)}`);
    }
    if (caps.headlineLabel !== "1000-3000"
      || byBody.get("mean_node")?.validated !== null
      || byBody.get("sun")?.source !== "vsop87d") {
      failures++;
      console.error("FAIL capabilities headline/analytic/vsop classification");
    }
  }

  // Fixed-star atoms: caller-supplied conjunctions project as `star` atoms and
  // a hasStar rule resolves against them. 1990-06-10 has Jupiter on Sirius.
  const conj = eng.starConjunctions(c, { orb: 1.0 });
  const sctx = interpretationContext(c, { stars: conj });
  const starAtoms = sctx.atoms.filter((a) => a.kind === "star");
  const sirius = eng.starConjunctions(c, { orb: 1.0, stars: ["Sirius"] });
  const sr = interpret(sctx, [{
    id: "stars", version: "0.1",
    rules: [{ id: "sirius", when: hasStar({ star: "Sirius" }), text: "x" }],
  }]);
  if (
    starAtoms.length !== conj.length
    || starAtoms.length === 0
    || !starAtoms.every((a) => a.id === `star:${(a as { body: string }).body}:${(a as { star: string }).star}`)
    || !sirius.some((x) => x.body === "jupiter")
    || !sr.entries.some((e) => e.rule === "sirius" && e.atomIds.includes("star:jupiter:Sirius"))
  ) {
    failures++;
    console.error(`FAIL interp stars: atoms=${starAtoms.length}/${conj.length} sirius=${JSON.stringify(sirius)}`);
  }

  // Embedded pack ships the fixed-star catalog for browser/edge consumers.
  const embEng = new Engine(embeddedData);
  const starCount = embEng.starNames().length;
  if (!embeddedData.fixedStars?.stars || starCount < 300) {
    failures++;
    console.error(`FAIL embeddedData fixed stars: starNames=${starCount}`);
  }
  const embConj = embEng.starConjunctions(c, { orb: 1.0, stars: ["Sirius"] });
  if (!embConj.some((x) => x.body === "jupiter")) {
    failures++;
    console.error(`FAIL embeddedData starConjunctions: ${JSON.stringify(embConj)}`);
  }

  // Lot atoms: the seven Hermetic lots project, Fortune and Spirit mirror the
  // Ascendant, and a hasLot rule resolves.
  const chartLots = eng.lots(c);
  const lctx = interpretationContext(c, { lots: chartLots });
  const lotAtoms = lctx.atoms.filter((a) => a.kind === "lot");
  const fortune = chartLots.find((l) => l.lot === "fortune");
  const lr = interpret(lctx, [{
    id: "lots", version: "0.1",
    rules: [{ id: "fortune", when: hasLot({ lot: "fortune" }), text: "x" }],
  }]);
  if (
    lotAtoms.length !== 7 || chartLots.length !== 7
    || !fortune || SIGNS[Math.floor(fortune.lon / 30)] !== fortune.sign
    || !lr.entries.some((e) => e.rule === "fortune" && e.atomIds.includes("lot:fortune"))
  ) {
    failures++;
    console.error(`FAIL interp lots: atoms=${lotAtoms.length} fortune=${JSON.stringify(fortune)}`);
  }

  // Diachronic / relational atoms: transits, synastry, composite, time-lords,
  // finer dignities, and Vedic structure — all citable for auditCitations.
  {
    const natal = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
    const transitJd = julianDay(2025, 6, 10, 12, 0, 0);
    const natalB = eng.chartAt(julianDay(1992, 3, 15, 8, 0, 0), 40.71, -74.0, "placidus");
    const transits = transitAspects(natal, eng, transitJd, { maxOrb: 3 });
    // Node-target hits: transitAspects admits one natal node as a target;
    // the hits must agree with separations recomputed from the transiting
    // ephemeris positions against the natal node's own longitude, and they
    // project as citable transit atoms the selector can match.
    {
      const nodeLon = natal.bodies.true_node!.lon;
      const want = new Map<string, number>();
      for (const tb of BODIES) {
        if (NOT_ASPECTABLE.has(tb)) continue;
        const tp = eng.position(tb, transitJd, { zodiac: natal.zodiac });
        const sep = Math.abs(mod(tp.lon - nodeLon + 180, 360) - 180);
        for (const [asp, angle] of Object.entries(ASPECTS)) {
          const orb = Math.abs(sep - angle);
          if (orb <= Math.min(3, DEFAULT_ORBS[asp])) {
            want.set(`${tb}:${asp}`, Math.round(orb * 100) / 100);
          }
        }
      }
      const got = transits.filter((t) => t.natal === "true_node");
      const bad = got.filter((t) => {
        const w0 = want.get(`${t.transit}:${t.aspect}`);
        return w0 === undefined || Math.abs(w0 - t.orb) > 1e-9;
      });
      const meanHits = transits.filter((t) => t.natal === "mean_node");
      if (got.length !== want.size || bad.length || meanHits.length) {
        failures++;
        console.error(`FAIL transit node targets: want ${[...want.keys()].join(",")} got ${got.map((t) => `${t.transit}:${t.aspect}`).join(",")} mean=${meanHits.length}`);
      }
      if (got.length > 0) {
        const nctx = interpretationContext(natal, { transits });
        const t0 = got[0];
        const id = `transit:${t0.transit}~natal_true_node:${t0.aspect}`;
        if (!nctx.atoms.some((a) => a.id === id)
          || !hasTransit({ natal: "true_node", transit: t0.transit })(nctx).matched) {
          failures++;
          console.error(`FAIL transit node atom/selector: ${id}`);
        }
      }
    }
    const prof = profectionAt(eng, natal.jdUt, transitJd, 27.95, -82.46);
    const zr = zrAt(eng, natal.jdUt, transitJd, 27.95, -82.46);
    const fir = firdariaAt(eng, natal.jdUt, transitJd, 27.95, -82.46);
    const sidNatal = eng.chartAt(natal.jdUt, 27.95, -82.46, { zodiac: "sidereal:lahiri" });
    const dasha = vimshottariAt(eng, natal.jdUt, transitJd);
    const yogas = yogasAt(eng, natal.jdUt, 27.95, -82.46);
    const rctx = interpretationContext(natal, {
      transits,
      synastry: {
        aspects: synastryAspects(natal, natalB, 4),
        overlays: synastryOverlays(natal, natalB),
      },
      composite: compositePlacements(eng, natal.jdUt, natalB.jdUt),
      timelords: {
        profection: prof,
        zr: { l1: zr.l1!, l2: zr.l2!, l3: zr.l3!, l4: zr.l4!, lot: zr.lot },
        firdaria: { major: fir.major, sub: fir.sub, day: fir.day },
        dasha: { maha: dasha.maha!, antar: dasha.antar ?? null, pratyantar: dasha.pratyantar ?? null, moon_nakshatra: dasha.moon_nakshatra },
      },
      vedic: { nakshatraBodies: ["moon"], vargas: [9], yogas },
    });
    const sidCtx = interpretationContext(sidNatal, { vedic: { nakshatraBodies: ["moon"], vargas: [9] } });
    const ids = new Set(rctx.atoms.map((a) => a.id));
    const transitAtom = rctx.atoms.find((a) => a.kind === "transit");
    const profAtom = rctx.atoms.find((a) => a.id.startsWith("profection:year:"));
    const termAtom = rctx.atoms.find((a) => a.kind === "dignity" && a.facet === "term");
    const nakAtom = sidCtx.atoms.find((a) => a.kind === "nakshatra");
    const vargaAtom = sidCtx.atoms.find((a) => a.kind === "varga");
    const rr = interpret(rctx, [{
      id: "rel", version: "0.1", rules: [
        { id: "t", when: hasTransit({ transit: transitAtom?.transit, minStrength: 0 }), text: "x" },
        { id: "p", when: hasTimelord({ system: "profection", level: "year" }), text: "x" },
        { id: "d", when: hasDignityFine({ facet: "term", body: "moon" }), text: "x" },
        { id: "y", when: hasYoga({ yoga: yogas[0]?.yoga }), text: "x" },
      ],
    }]);
    const audit = auditCitations([
      { text: "ok", cites: [transitAtom!.id, profAtom!.id, termAtom!.id] },
      { text: "bad", cites: ["transit:fake~natal_moon:square"] },
    ], rctx);
    if (
      ids.size !== rctx.atoms.length
      || !transits.length
      || !transitAtom?.id.includes("~natal_")
      || !profAtom
      || !termAtom
      || !nakAtom?.id.startsWith("nakshatra:moon:")
      || !vargaAtom?.id.startsWith("varga:d9:moon:")
      || rctx.atoms.filter((a) => a.kind === "synastry").length === 0
      || rctx.atoms.filter((a) => a.kind === "composite").length === 0
      || rr.entries.length < 3
      || audit.ok !== false
      || audit.unknown.length !== 1
    ) {
      failures++;
      console.error(`FAIL relational atoms: unique=${ids.size === rctx.atoms.length} transits=${transits.length} audit=${audit.ok}`);
    }
  }

  // Transit houses and stations: the projection's transitHouse atoms must
  // agree with each aspectable transiting body's natal-house position
  // recomputed from its longitude against the natal cusps; station atoms
  // must agree with stations() over the enrich window; both selectors
  // resolve against the projected atoms.
  {
    const natal = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
    const transitJd = julianDay(2025, 6, 10, 12, 0, 0);
    const enr = enrichContextOptions(eng, natal, { jd: transitJd, lat: 27.95, lonEast: -82.46 },
      { timelords: false, vedic: false, stationWindowDays: 30 });
    const thCtx = interpretationContext(natal, enr);

    const wantHouses = new Map<string, number>();
    for (const th of transitHouses(natal, eng, transitJd)) {
      // recompute the house from the longitude against the natal cusps
      let h = 12;
      for (let i = 0; i < 12; i++) {
        if (mod(th.lon - natal.cusps[i], 360)
          < mod(natal.cusps[(i + 1) % 12] - natal.cusps[i], 360)) { h = i + 1; break; }
      }
      if (h !== th.house) {
        failures++;
        console.error(`FAIL transitHouses ${th.body}: recomputed ${h} != ${th.house}`);
      }
      wantHouses.set(th.body, th.house);
    }
    const gotTh = thCtx.atoms.filter((a) => a.kind === "transitHouse") as Array<{ body: string; house: number }>;
    if (
      gotTh.length !== wantHouses.size
      || gotTh.some((a) => wantHouses.get(a.body) !== a.house)
    ) {
      failures++;
      console.error(`FAIL interp transitHouse: want ${wantHouses.size} got ${gotTh.length}`);
    }
    if (gotTh.length > 0
      && !hasTransitHouse({ body: gotTh[0].body, house: gotTh[0].house })(thCtx).matched) {
      failures++;
      console.error("FAIL hasTransitHouse does not match projected atom");
    }

    const wantStations: Array<{ body: string; direction: string; jd: number }> = [];
    for (const body of ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron"] as const) {
      for (const [jd, direction] of stations(eng, body, transitJd - 30, transitJd + 30)) {
        wantStations.push({ body, direction, jd });
      }
    }
    const gotSt = thCtx.atoms.filter((a) => a.kind === "station") as Array<{ body: string; direction: string; daysFromExact: number }>;
    const stKey = (b: string, d: string) => `${b}:${d}`;
    const wantKeys = new Set(wantStations.map((s) => stKey(s.body, s.direction)));
    if (
      gotSt.length !== wantStations.length
      || gotSt.some((a) => !wantKeys.has(stKey(a.body, a.direction)))
      || gotSt.some((a) => Math.abs(a.daysFromExact) > 30 + 1e-9)
      || wantStations.length === 0 // the 60-day window over 9 bodies must catch some
    ) {
      failures++;
      console.error(`FAIL interp station: want ${wantStations.length} got ${gotSt.length}`);
    }
    for (const s of wantStations) {
      const atom = gotSt.find((a) => a.body === s.body && a.direction === s.direction);
      if (!atom || Math.abs((s.jd - transitJd) - atom.daysFromExact) > 1e-9) {
        failures++;
        console.error(`FAIL station ${s.body} ${s.direction}: daysFromExact mismatch`);
      }
    }
    if (gotSt.length > 0
      && !hasStation({ body: gotSt[0].body, direction: gotSt[0].direction as "retrograde" | "direct" })(thCtx).matched) {
      failures++;
      console.error("FAIL hasStation does not match projected atom");
    }
  }

  // B4 projection surface: planetary returns, lunations, solar phase, and
  // the timelord house/under fields, each recomputed from pinned primitives.
  {
    const natal = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
    const RETURN_SET = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "chiron", "true_node"];

    // A return in progress at the root-found first Saturn return instant.
    const [srJd] = returns(eng, "saturn", natal.jdUt,
      natal.jdUt + 28 * 365.25, natal.jdUt + 31 * 365.25);
    if (!srJd) {
      failures++;
      console.error("FAIL activeReturns: no Saturn return found in the 28-31y window");
    } else {
      const hits = activeReturns(natal, eng, srJd);
      const sat = hits.find((h) => h.body === "saturn");
      if (!sat || sat.nth !== 1 || sat.orb > 0.05) {
        failures++;
        console.error(`FAIL activeReturns saturn: ${JSON.stringify(sat)}`);
      }
      // agreement with a direct separation recompute over the whole set
      for (const body of RETURN_SET) {
        const np = natal.bodies[body as Body];
        if (!np) continue;
        const tp = eng.position(body as Body, srJd, { zodiac: natal.zodiac });
        const orb = Math.abs(mod(tp.lon - np.lon + 180, 360) - 180);
        const hit0 = hits.find((h) => h.body === body);
        if ((orb <= 3) !== !!hit0
          || (hit0 && Math.abs(hit0.orb - Math.round(orb * 100) / 100) > 1e-9)) {
          failures++;
          console.error(`FAIL activeReturns recompute ${body}: orb=${orb} hit=${JSON.stringify(hit0)}`);
        }
      }
      // the projection + the selector, including the nth filters
      const rctx = interpretationContext(natal, { returns: hits });
      if (!rctx.atoms.some((a) => a.id === "return:saturn:1")
        || !hasReturn({ body: "saturn", nth: 1 })(rctx).matched
        || !hasReturn({ body: "saturn", minNth: 1 })(rctx).matched
        || hasReturn({ body: "saturn", minNth: 2 })(rctx).matched) {
        failures++;
        console.error("FAIL return atom/selector");
      }
      // a newborn chart reports nothing (nth >= 1)
      if (activeReturns(natal, eng, natal.jdUt).length !== 0) {
        failures++;
        console.error("FAIL activeReturns: nonempty at birth");
      }
    }

    // Lunations: 2025-03-14 was a total lunar eclipse (a Full Moon),
    // 2025-03-29 a partial solar eclipse (a New Moon), 2025-06-11 a plain
    // Full Moon. Each hit's timing, house, sign, and onNatal recompute from
    // lunarPhases and the natal chart's own cusps and longitudes.
    const checkLunation = (jd: number, phase: "new" | "full", eclipse: "solar" | "lunar" | null): void => {
      const hits = activeLunations(natal, eng, jd);
      const h0 = hits.find((h) => h.phase === phase);
      if (!h0 || h0.eclipse !== eclipse) {
        failures++;
        console.error(`FAIL activeLunations at ${jd}: want ${phase}/${eclipse} got ${JSON.stringify(hits)}`);
        return;
      }
      const syz = lunarPhases(eng, jd - 3, jd + 3).filter(([, n]) => n === phase);
      const sjd = syz[0]?.[0];
      const lon = eng.longitude("moon", sjd!, { zodiac: natal.zodiac });
      let house = 12;
      for (let i = 0; i < 12; i++) {
        if (mod(lon - natal.cusps[i], 360)
          < mod(natal.cusps[(i + 1) % 12] - natal.cusps[i], 360)) { house = i + 1; break; }
      }
      const onNatal = Object.entries(natal.bodies)
        .filter(([b, p]) => p && !NOT_ASPECTABLE.has(b)
          && Math.abs(mod(lon - p.lon + 180, 360) - 180) <= 3)
        .map(([b]) => b).sort();
      if (h0.house !== house || h0.sign !== SIGNS[Math.floor(mod(lon, 360) / 30)]
        || h0.onNatal.join() !== onNatal.join()
        || Math.abs(h0.daysFromExact - (sjd! - jd)) > 1e-6) {
        failures++;
        console.error(`FAIL lunation recompute: ${JSON.stringify(h0)} vs house=${house} onNatal=${onNatal}`);
      }
      const lctx = interpretationContext(natal, {
        lunations: hits.map(({ phase: p, eclipse: e, house: ho, sign, daysFromExact, onNatal: on }) =>
          ({ phase: p, eclipse: e, house: ho, sign, daysFromExact, onNatal: on })),
      });
      if (!hasLunation({ phase, house })(lctx).matched
        || !hasLunation({ eclipse: eclipse !== null })(lctx).matched
        || (eclipse !== null && !hasLunation({ eclipseKind: eclipse })(lctx).matched)) {
        failures++;
        console.error(`FAIL lunation atom/selector at ${jd}`);
      }
    };
    checkLunation(julianDay(2025, 3, 14, 0, 0, 0), "full", "lunar");
    checkLunation(julianDay(2025, 3, 29, 6, 0, 0), "new", "solar");
    checkLunation(julianDay(2025, 6, 10, 12, 0, 0), "full", null);

    // Solar phase: the projection's atoms must match the ladder recomputed
    // from the chart's own longitudes at the pinned electional thresholds
    // (cazimi 17', combust 8.5°, under beams 15°); classical five only.
    {
      const scan = [natal, eng.chartAt(julianDay(2025, 6, 10, 12, 0, 0), 27.95, -82.46, "placidus")];
      let seen = 0;
      for (const c2 of scan) {
        const ctx2 = interpretationContext(c2);
        const got = ctx2.atoms.filter((a) => a.kind === "solarPhase") as Array<{ body: string; phase: string; elongation: number }>;
        const want = new Map<string, string>();
        for (const body of ["mercury", "venus", "mars", "jupiter", "saturn"]) {
          const p = c2.bodies[body as Body];
          if (!p) continue;
          const e = Math.abs(mod(p.lon - c2.bodies.sun!.lon + 180, 360) - 180);
          const ph = e <= 0.2833 ? "cazimi" : e <= 8.5 ? "combust" : e <= 15.0 ? "under_beams" : null;
          if (ph) want.set(body, ph);
        }
        seen += want.size;
        if (got.length !== want.size || got.some((a) => want.get(a.body) !== a.phase)) {
          failures++;
          console.error(`FAIL interp solarPhase: want ${JSON.stringify([...want])} got ${got.map((g) => `${g.body}:${g.phase}`).join(",")}`);
        }
        if (got.length > 0
          && !hasSolarPhase({ body: got[0].body, phase: got[0].phase as "combust" })(ctx2).matched) {
          failures++;
          console.error("FAIL hasSolarPhase does not match projected atom");
        }
      }
      if (seen === 0) {
        failures++;
        console.error("FAIL interp solarPhase: neither scan chart holds a solar-phase body (pick better dates)");
      }
    }

    // Timelord house/under: the profection atoms carry the profected houses,
    // the firdaria sub its major, the dasha antar its maha; the extended
    // hasTimelord filters resolve; enrich carries returns + lunations too.
    {
      const transitJd = julianDay(2025, 6, 10, 12, 0, 0);
      const enr = enrichContextOptions(eng, natal, { jd: transitJd, lat: 27.95, lonEast: -82.46 },
        { transits: false, transitHouses: false, stations: false, vedic: false });
      const tctx = interpretationContext(natal, enr);
      const prof = profectionAt(eng, natal.jdUt, transitJd, 27.95, -82.46);
      const fir = firdariaAt(eng, natal.jdUt, transitJd, 27.95, -82.46);
      const dasha = vimshottariAt(eng, natal.jdUt, transitJd, "sidereal:lahiri");
      const tl = tctx.atoms.filter((a) => a.kind === "timelord") as Array<{ system: string; level: string; lord: string; house?: number; under?: string }>;
      const year = tl.find((a) => a.system === "profection" && a.level === "year");
      const month = tl.find((a) => a.system === "profection" && a.level === "month");
      const sub = tl.find((a) => a.system === "firdaria" && a.level === "sub");
      const antar = tl.find((a) => a.system === "dasha" && a.level === "antar");
      if (year?.house !== prof.annual.house || month?.house !== prof.monthly.house
        || (fir.sub != null && sub?.under !== fir.major)
        || (dasha.antar != null && antar?.under !== dasha.maha)) {
        failures++;
        console.error(`FAIL timelord house/under: year=${JSON.stringify(year)} sub=${JSON.stringify(sub)} antar=${JSON.stringify(antar)}`);
      }
      if (!hasTimelord({ system: "profection", level: "year", house: prof.annual.house })(tctx).matched
        || (dasha.antar != null && !hasTimelord({ system: "dasha", level: "antar", lord: dasha.antar, under: dasha.maha ?? undefined })(tctx).matched)
        || hasTimelord({ system: "profection", level: "year", house: (prof.annual.house % 12) + 1 })(tctx).matched) {
        failures++;
        console.error("FAIL hasTimelord house/under filters");
      }
      if (!enr.returns || !enr.lunations) {
        failures++;
        console.error("FAIL enrichContextOptions: returns/lunations missing");
      }
    }
  }

  // B3 projection surface: aspects inside the composite chart. The composite
  // longitudes are already pinned by derived-golden; what is new here is the
  // aspect set over them, so every hit recomputes from those longitudes by
  // brute force -- same aspect table and orb policy as findAspects, and no
  // phase, because a midpoint composite is a static figure.
  {
    const natalA = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
    const natalB = eng.chartAt(julianDay(1986, 2, 3, 6, 15, 0), 40.71, -74.01, "placidus");
    const bodySet = BODIES as unknown as Body[];
    const hits = compositeAspects(eng, natalA.jdUt, natalB.jdUt, bodySet);
    const lons = compositeLongitudes(eng, natalA.jdUt, natalB.jdUt, bodySet, "tropical");
    const names = bodySet.filter((b) => !NOT_ASPECTABLE.has(b) || b === "true_node");
    const want: string[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const sep = Math.abs(mod(lons[names[i]] - lons[names[j]] + 180, 360) - 180);
        for (const [asp, angle] of Object.entries(ASPECTS)) {
          const limit = DEFAULT_ORBS[asp];
          if (limit === undefined) continue;
          const orb = Math.abs(sep - (angle as number));
          if (orb <= limit) want.push(`${names[i]}~${names[j]}:${asp}`);
        }
      }
    }
    const got = hits.map((h) => `${h.a}~${h.b}:${h.aspect}`);
    if (want.sort().join("|") !== [...got].sort().join("|")) {
      failures++;
      console.error(`FAIL compositeAspects set: want ${want.length} got ${got.length}`);
    }
    checks++;
    // orb and strength reproduce from the composite longitudes alone
    for (const h of hits) {
      const sep = Math.abs(mod(lons[h.a as Body] - lons[h.b as Body] + 180, 360) - 180);
      const orb = Math.round(Math.abs(sep - (ASPECTS as Record<string, number>)[h.aspect]) * 100) / 100;
      const strength = Math.max(0, 1 - orb / DEFAULT_ORBS[h.aspect]);
      if (Math.abs(h.orb - orb) > 1e-9 || Math.abs(h.strength - strength) > 1e-9) {
        failures++;
        console.error(`FAIL compositeAspects recompute ${h.a}~${h.b}:${h.aspect}: ${JSON.stringify(h)}`);
      }
      checks++;
    }
    // a chart composited with itself is that chart's own aspect geometry:
    // every midpoint collapses onto the body, so the separations match the
    // natal ones and the aspect set is the natal set (phase aside).
    const selfHits = compositeAspects(eng, natalA.jdUt, natalA.jdUt, bodySet);
    const natalSet = new Set(findAspects(natalA.bodies as unknown as Record<string, import("../src/chart.js").Position>).map((a) => `${a.a}~${a.b}:${a.aspect}`));
    const selfSet = new Set(selfHits
      .filter((h) => !NOT_ASPECTABLE.has(h.a) && !NOT_ASPECTABLE.has(h.b))
      .map((h) => `${h.a}~${h.b}:${h.aspect}`));
    if (natalSet.size !== selfSet.size || [...natalSet].some((k) => !selfSet.has(k))) {
      failures++;
      console.error(`FAIL compositeAspects self-composite: natal ${natalSet.size} vs self ${selfSet.size}`);
    }
    checks++;
    // the projection and the selector
    const cctx = interpretationContext(natalA, {
      composite: compositePlacements(eng, natalA.jdUt, natalB.jdUt),
      compositeAspects: hits,
    });
    const first = hits[0];
    if (first) {
      const id = `composite:${first.a}~${first.b}:${first.aspect}`;
      if (!cctx.atoms.some((a) => a.id === id && a.kind === "compositeAspect")
        || !hasCompositeAspect({ a: first.a, b: first.b, aspect: first.aspect })(cctx).matched
        || !hasCompositeAspect({ between: [first.b, first.a] as [string, string], aspect: first.aspect })(cctx).matched
        || hasCompositeAspect({ a: first.a, b: first.b, aspect: first.aspect, minStrength: 1.01 })(cctx).matched) {
        failures++;
        console.error("FAIL compositeAspect atom/selector");
      }
      checks++;
    }
    // The composite frame: midpoint angles, equal houses from the composite
    // Ascendant. A convention, not a cast chart, so what is checked is that
    // it is exactly the convention it claims -- and the honest consequence
    // that the composite MC need not land on the tenth cusp.
    const frame = compositeFrame(natalA, natalB)!;
    const midASC = mod(natalA.angles.asc
      + (mod(natalB.angles.asc - natalA.angles.asc + 180, 360) - 180) / 2, 360);
    const midMC = mod(natalA.angles.mc
      + (mod(natalB.angles.mc - natalA.angles.mc + 180, 360) - 180) / 2, 360);
    if (Math.abs(mod(frame.asc - midASC + 180, 360) - 180) > 1e-9
      || Math.abs(mod(frame.mc - midMC + 180, 360) - 180) > 1e-9) {
      failures++;
      console.error(`FAIL compositeFrame angles: ${frame.asc} ${frame.mc}`);
    }
    checks++;
    if (frame.cusps.length !== 12
      || frame.cusps.some((c, i) => Math.abs(mod(c - mod(frame.asc + i * 30, 360) + 180, 360) - 180) > 1e-9)) {
      failures++;
      console.error("FAIL compositeFrame cusps are not equal from the Ascendant");
    }
    checks++;
    // every placement's house recomputes from those cusps by the same rule
    // the engine uses for a natal chart
    const housed = compositePlacements(
      eng, natalA.jdUt, natalB.jdUt, bodySet, "tropical", frame,
    );
    for (const p of housed) {
      let want = 12;
      for (let i = 0; i < 12; i++) {
        if (mod(p.lon - frame.cusps[i], 360) < mod(frame.cusps[(i + 1) % 12] - frame.cusps[i], 360)) {
          want = i + 1;
          break;
        }
      }
      if (p.house !== want) {
        failures++;
        console.error(`FAIL composite house ${p.body}: got ${p.house} want ${want}`);
      }
      checks++;
    }
    // without a frame there are no houses at all, rather than invented ones
    if (compositePlacements(eng, natalA.jdUt, natalB.jdUt, bodySet)
      .some((p) => p.house !== undefined)) {
      failures++;
      console.error("FAIL composite placements invent houses without a frame");
    }
    checks++;
    // the frame and the house filter reach the projection
    const hctx = interpretationContext(natalA, { composite: housed });
    const sunHouse = housed.find((p) => p.body === "sun")!.house!;
    if (!hasComposite({ body: "sun", house: sunHouse })(hctx).matched
      || hasComposite({ body: "sun", house: (sunHouse % 12) + 1 })(hctx).matched) {
      failures++;
      console.error("FAIL hasComposite house filter");
    }
    checks++;
    // and a houseless composite never matches a house filter
    const noHouse = interpretationContext(natalA, {
      composite: compositePlacements(eng, natalA.jdUt, natalB.jdUt, bodySet),
    });
    if (hasComposite({ body: "sun", house: sunHouse })(noHouse).matched) {
      failures++;
      console.error("FAIL hasComposite matches a house on a houseless composite");
    }
    checks++;

    // the two-chart enricher supplies them alongside placements and synastry
    const enrRel = enrichSynastryOptions(eng, natalA, natalB);
    if (!enrRel.compositeAspects?.length || !enrRel.composite?.length) {
      failures++;
      console.error("FAIL enrichSynastryOptions: composite aspects missing");
    }
    checks++;
  }

  // Matching + resolver: a developer's rule corpus over the projection, with
  // provenance. The engine ships the mechanism, never the content.
  const source = {
    id: "demo", version: "0.1", rules: [
      { id: "sun-gemini", when: hasPlacement({ body: "sun", sign: "Gemini" }), text: "x" },
      { id: "moon-neptune", when: hasAspect({ between: ["moon", "neptune"] as [string, string], aspect: "conjunction" }), text: "x", weight: 1.5 },
      { id: "moon-stellium", when: matchAll(hasPlacement({ body: "moon" }), hasPattern({ kind: "stellium_sign", body: "moon" })), text: "x" },
      { id: "no-aries-sun", when: matchNone(hasPlacement({ body: "sun", sign: "Aries" })), text: "x" },
      { id: "miss", when: hasPlacement({ body: "sun", sign: "Aries" }), text: "x" },
    ],
  };
  const reading = interpret(ctx, [source]);
  const byRule = Object.fromEntries(reading.entries.map((e) => [e.rule, e]));
  const rsorted = reading.entries.every((e, i) => i === 0 || reading.entries[i - 1].salience >= e.salience);
  if (
    reading.entries.length !== 4 // the four matching rules; "miss" omitted
    || "miss" in byRule
    || byRule["sun-gemini"]?.atomIds.join() !== "placement:sun" // provenance
    || byRule["sun-gemini"]?.id !== "demo/sun-gemini"
    || byRule["moon-stellium"]?.atomIds.length !== 2 // matchAll unions atoms
    || byRule["no-aries-sun"]?.atomIds.length !== 0 // absence: matched, no atoms
    || !rsorted
  ) {
    failures++;
    console.error(`FAIL interpret: entries=${reading.entries.length} rules=${JSON.stringify(reading.entries.map((e) => e.rule))} sorted=${rsorted}`);
  }

  // LLM brief + citation audit: the "novel and accurate" loop. The brief is the
  // top-N facts, id-tagged; the audit flags any citation that invents a fact.
  const brief = chartBrief(ctx, { limit: 6 });
  const briefSorted = brief.facts.every((f, i) => i === 0 || brief.facts[i - 1].salience >= f.salience);
  if (
    brief.facts.length !== 6
    || !brief.prompt.startsWith(BRIEF_INSTRUCTIONS)
    || !brief.prompt.includes(`[${brief.facts[0].id}]`)
    || !briefSorted
    || chartBrief(ctx, { header: false }).prompt.startsWith(BRIEF_INSTRUCTIONS) // header off
  ) {
    failures++;
    console.error(`FAIL brief: facts=${brief.facts.length} sorted=${briefSorted}`);
  }
  const realId = ctx.atoms[0].id;
  const audit = auditCitations([
    { text: "honest", cites: [realId] },
    { text: "invented", cites: ["aspect:mars~jupiter:trine:fake"] },
    { text: "uncited", cites: [] },
  ], ctx);
  if (
    audit.ok // must be false: one citation is fabricated
    || !audit.unknown.includes("aspect:mars~jupiter:trine:fake")
    || !audit.valid.includes(realId)
    || audit.uncited !== 1 || audit.cited !== 2 || audit.claims !== 3
  ) {
    failures++;
    console.error(`FAIL citation audit: ${JSON.stringify(audit)}`);
  }

  // Dispositors: one per classical planet; Saturn in Capricorn is a final
  // dispositor and the Moon (Capricorn) is disposited by Saturn. No mutual
  // reception in this chart.
  const disp = ctx.atoms.filter((a) => a.kind === "dispositor");
  if (
    disp.length !== 7
    || !hasDispositor({ body: "saturn", final: true })(ctx).matched
    || !hasDispositor({ body: "moon", dispositor: "saturn" })(ctx).matched
  ) {
    failures++;
    console.error(`FAIL dispositors: count=${disp.length}`);
  }
  // Reception (domicile/exaltation/triplicity): 2000-02-01 has the Mars<->Jupiter
  // and Venus<->Saturn domicile receptions plus a Venus<->Mars exaltation one.
  const ctx2000 = interpretationContext(eng.chartAt(julianDay(2000, 2, 1, 12, 0, 0), 51.5, 0, "whole_sign"));
  const recs = ctx2000.atoms.filter((a) => a.kind === "reception") as Array<{ id: string; by: string }>;
  const domicile = recs.filter((r) => r.by === "domicile").map((r) => r.id);
  if (
    !domicile.includes("reception:mars~jupiter")
    || !domicile.includes("reception:venus~saturn")
    || !recs.some((r) => r.by !== "domicile") // exaltation/triplicity now detected
    || !hasReception({ body: "mars" })(ctx2000).matched
    || hasReception({ body: "sun" })(ctx2000).matched // the Sun is in no reception here
  ) {
    failures++;
    console.error(`FAIL reception: ${JSON.stringify(recs.map((r) => `${r.id}:${r.by}`))}`);
  }

  // Reconcile: entries citing the same atom group together; opposing declared
  // tags mark the group contested; duplicate text is dropped.
  const rsrc = {
    id: "s", version: "1", rules: [
      { id: "sun-up", when: hasPlacement({ body: "sun" }), text: "a", tags: ["affirming"] },
      { id: "sun-dn", when: hasPlacement({ body: "sun" }), text: "b", tags: ["challenging"] },
      { id: "moon-a", when: hasPlacement({ body: "moon" }), text: "m" },
      { id: "moon-b", when: hasPlacement({ body: "moon" }), text: "m", weight: 0.5 }, // dup text
    ],
  };
  const groups = reconcile(interpret(ctx, [rsrc]), { conflicts: [["affirming", "challenging"]], dedupe: true });
  const sunGroup = groups.find((g) => g.atomIds.includes("placement:sun"));
  const moonGroup = groups.find((g) => g.atomIds.includes("placement:moon"));
  if (
    !sunGroup?.contested // opposing tags on shared atom
    || sunGroup.entries.length !== 2
    || moonGroup?.entries.length !== 1 // dedupe dropped the duplicate text
    || moonGroup.contested
  ) {
    failures++;
    console.error(`FAIL reconcile: sunContested=${sunGroup?.contested} moonEntries=${moonGroup?.entries.length}`);
  }
}

// Provenance: temporal/spatial anchors resolve to instants/places with an
// honest certainty, or null when none can be derived. Behavioural, gated via
// `failures` (pure type-driven logic, no Swiss Ephemeris oracle).
{
  const reg = {
    instants: { ev: 2110700.5 },
    calendars: { stardate: (v: string) => 2440587.5 + Number(v) * 0.1 },
    gazetteer: (id: string) => (id === "london" ? { lat: 51.5, lonEast: -0.12 } : null),
  };
  const approxEq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const checksProv = [
    // offsets
    parseOffset("3d") === 3,
    approxEq(parseOffset("-2h"), -2 / 24),
    approxEq(parseOffset("P1Y2M10DT2H30M"), 365.2425 + 2 * 30.436875 + 10 + 2.5 / 24),
    Number.isNaN(parseOffset("junk")),
    // temporal
    resolveTime({ kind: "instant", utc: "2024-04-08T18:17:18Z" }).certainty === "exact",
    approxEq(resolveTime({ kind: "instant", utc: "2024-04-08T18:17:18Z" }).jd!, isoToJd("2024-04-08T18:17:18Z")!),
    resolveTime({ kind: "range", earliest: "1990-01-01", latest: "1990-12-31" }).certainty === "representative",
    approxEq(resolveTime({ kind: "relative", relation: "after", anchorId: "ev", offset: "P3D" }, reg).jd!, 2110703.5),
    resolveTime({ kind: "relative", relation: "after", anchorId: "missing", offset: "1d" }, reg).jd === null,
    resolveTime({ kind: "narrative", calendar: "stardate", value: "41153.7", sequence: 1 }, reg).jd !== null,
    resolveTime({ kind: "narrative", calendar: "middle_earth", value: "TA 3019" }, reg).jd === null,
    resolveTime({ kind: "symbolic", rationale: "x" }).jd === null,
    resolveTime({ kind: "none", reason: "atemporal" }).jd === null,
    // spatial
    resolvePlace({ kind: "geo", lat: 40.7, lonEast: -74 }).certainty === "exact",
    resolvePlace({ kind: "named", placeId: "london" }, reg).place !== null,
    resolvePlace({ kind: "named", placeId: "atlantis" }, reg).place === null,
    resolvePlace({ kind: "fictional", value: "Minas Tirith" }).place === null,
    // realm routing
    isTimeAnchored("observed") && isTimeAnchored("forecast"),
    !isTimeAnchored("archetypal") && !isTimeAnchored("conceptual"),
  ];
  if (checksProv.some((ok) => !ok)) {
    failures++;
    console.error(`FAIL provenance: ${checksProv.map((ok, i) => (ok ? "" : i)).filter((x) => x !== "").join(",")}`);
  }

  // Routing: a resolvable instant -> ephemeris; else constraints -> compiler;
  // else nothing, with a reason. The realm rides along as framing.
  const obs = realize(eng, {
    realm: "observed", when: { kind: "instant", utc: "1990-06-10T14:30:00Z" },
    where: { kind: "geo", lat: 27.95, lonEast: -82.46 },
  });
  const arch = realize(eng, {
    realm: "archetypal", when: { kind: "symbolic", rationale: "the sign Aries" },
    constraints: [{ kind: "sign", body: "sun", sign: 0 }, { kind: "aspect", a: "sun", b: "moon", angle: 120 }],
  });
  const concept = realize(eng, { realm: "conceptual", when: { kind: "none", reason: "atemporal" } });
  const fore = realize(eng, {
    realm: "forecast", when: { kind: "range", earliest: "2030-01-01", latest: "2030-12-31" },
  });
  if (
    obs.via !== "ephemeris" || obs.chart === null || obs.chart.bodies.sun?.sign !== "Gemini"
    || arch.via !== "compiler" || arch.form === null || arch.chart !== null
    || concept.via !== "none" || concept.chart !== null || concept.form !== null
    || fore.via !== "ephemeris" || fore.time.certainty !== "representative"
  ) {
    failures++;
    console.error(`FAIL realize: obs=${obs.via} arch=${arch.via} concept=${concept.via} fore=${fore.via}/${fore.time.certainty}`);
  }

  // Framing + damping: an inexact certainty damps time-sensitive atoms (Moon,
  // angles) but not the slow planets; realm/certainty ride onto context + brief.
  const fchart = eng.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, "placidus");
  const exactCtx = interpretationContext(fchart, { provenance: { realm: "observed", certainty: "exact" } });
  const fuzzyCtx = interpretationContext(fchart, { provenance: { realm: "forecast", certainty: "representative" } });
  const sal = (c: typeof exactCtx, id: string) => c.atoms.find((a) => a.id === id)!.salience;
  const fbrief = chartBrief(fuzzyCtx, { limit: 1 }).prompt;
  if (
    fuzzyCtx.realm !== "forecast" || fuzzyCtx.certainty !== "representative"
    || !(sal(fuzzyCtx, "placement:moon") < sal(exactCtx, "placement:moon")) // Moon damped
    || !(sal(fuzzyCtx, "angle:asc") < sal(exactCtx, "angle:asc")) // angle damped
    || sal(fuzzyCtx, "placement:sun") !== sal(exactCtx, "placement:sun") // slow planet unchanged
    || !fbrief.includes("forecast") || !fbrief.includes("uncertain")
  ) {
    failures++;
    console.error("FAIL framing/damping");
  }

  // Counterfactual: a time shift rotates the houses and angles (planets stay
  // put); a longitude splice moves only that body and recomputes its aspects.
  const cfBase = {
    realm: "counterfactual" as const,
    when: { kind: "instant" as const, utc: "1990-06-10T14:30:00Z" },
    where: { kind: "geo" as const, lat: 27.95, lonEast: -82.46 },
  };
  const cfShift = counterfactual(eng, cfBase, { shiftTime: "3h" });
  const marsLon = cfShift.original.chart!.bodies.mars!.lon;
  const cfMove = counterfactual(eng, cfBase, { setLongitudes: { mars: marsLon + 30 } });
  if (
    cfShift.variant === null || cfShift.diff!.angles.length === 0 || cfShift.diff!.bodies.length === 0
    || cfMove.diff!.bodies.length !== 1 // only Mars moved
    || cfMove.diff!.bodies[0].body !== "mars"
    || cfMove.diff!.bodies[0].signFrom === cfMove.diff!.bodies[0].signTo // changed sign
    || cfMove.diff!.aspectsGained.length === 0 // squares became trines, etc.
    || cfMove.diff!.angles.length !== 0 // geometry splice leaves the angles alone
  ) {
    failures++;
    console.error(`FAIL counterfactual: shiftAngles=${cfShift.diff?.angles.length} moveBodies=${JSON.stringify(cfMove.diff?.bodies.map((b) => b.body))}`);
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
console.log(`worst diff: ${worst.what} = ${(worst.diff * 3600).toExponential(2)}" (${worst.diff.toExponential(2)} deg)`);

if (process.env.CAELUS_STATS_OUT) {
  const arcsec = worst.diff * 3600;
  writeFileSync(process.env.CAELUS_STATS_OUT, JSON.stringify({
    suite: "golden",
    checks,
    failures,
    worst: {
      what: worst.what,
      deg: worst.diff,
      arcsec,
      nano_arcsec: arcsec * 1e9,
    },
    bodies: BODIES.length,
    fixtures: {
      delta_t: G.delta_t.length,
      nutation: G.nutation.length,
      longitudes: G.longitudes.length,
      positions: G.positions.length,
      houses: G.houses.length,
      sidereal: G.sidereal.length,
      extras: G.extras.length,
      events: Object.keys(G.events).length,
    },
    generatedAt: new Date().toISOString(),
  }, null, 2) + "\n");
}

process.exit(failures ? 1 : 0);
