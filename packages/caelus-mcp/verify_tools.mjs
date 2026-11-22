/**
 * MCP-layer oracle suite: one section per tool, asserted against the engine
 * imported in-process. The golden conformance suite cannot see server.ts;
 * this suite exists to catch wiring bugs in the MCP layer (wrong body loop,
 * stale natal data, orb misuse, missed retrograde re-hits, silent fallbacks).
 *
 * Grown from verify_aspects.mjs (PATCHES.md finding #2).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import {
  Engine, BODIES, julianDay, mod, aspectPhase, solarPhase, ASPECTS,
  solarReturn, progressedLongitude, directedLongitude, solarArc,
  compositeLongitudes, davisonParams, dignityOf, isDayChart, planetarySect, inSect,
  lots, HERMETIC_LOTS,
  profectionAt, firdaria, firdariaActive,
  zrRelease, zrAt, SIGNS, canonicalDigest, chartDigest,
  composeRemainders, nearBoundary,
  primaryDirections, mundaneDirections, KEYS,
  nakshatra, vimshottariDashas, vimshottariAt,
  yoginiDashas, yoginiAt, ashtottariDashas, ashtottariAt,
  varga, VARGA_DIVISIONS,
  yogasAt, kemadrumaAt, rajaYogasAt, dhanaYogasAt,
  detectPatterns, detectPatternsIn, chartSignature, parans,
  chartFeatures, configurationFit,
  dignityScore, voidOfCourse,
  synastryAspects, dateSky, chartStability, heliacal, localDay, calendarDate,
  sceneGeometry, verifyObservation, chronolocate, geolocate,
  chronosenseEnvelope, auditChronosenseCursor, photoperiodVector, phaseStratumKey,
} from "caelus";
import { loadNodeData } from "caelus/node";

const require = createRequire(import.meta.url);
const DATA_DIR = join(dirname(require.resolve("caelus/package.json")), "data");
const eng = new Engine(loadNodeData(DATA_DIR, "embedded", "full"));

let checks = 0;
let failures = 0;
function assert(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}
const r2 = (x) => Math.round(x * 100) / 100;
const jdFromIso = (iso) => {
  const d = new Date(iso);
  return julianDay(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  );
};
const houseFromCusps = (cusps, lon) => {
  for (let i = 0; i < 12; i++) {
    if (mod(lon - cusps[i], 360) < mod(cusps[(i + 1) % 12] - cusps[i], 360)) return i + 1;
  }
  return 12;
};

const serverPath = fileURLToPath(new URL("./dist/src/server.js", import.meta.url));
const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
const client = new Client({ name: "verify", version: "0.0.1" });
await client.connect(transport);
const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) throw new Error(`${name}: ${res.content[0].text}`);
  return JSON.parse(res.content[0].text);
};

// ---------------------------------------------------------------- natal_chart
{
  const iso = "1990-06-10T14:30:00Z";
  const c = await call("natal_chart", { date: iso, lat: 27.95, lon: -82.46 });
  const g = eng.chart(1990, 6, 10, 14, 30, 0, 27.95, -82.46, "placidus");

  assert(c.houses === "placidus", "natal_chart: house system");
  assert(c.houses_requested === undefined, "natal_chart: no fallback fields at non-polar latitude");
  assert(Math.abs(c.angles.asc - r2(g.angles.asc)) < 1e-9, `natal_chart: asc ${c.angles.asc} vs ${g.angles.asc}`);
  assert(Math.abs(c.angles.mc - r2(g.angles.mc)) < 1e-9, `natal_chart: mc ${c.angles.mc} vs ${g.angles.mc}`);
  for (let i = 0; i < 12; i++) {
    assert(Math.abs(c.cusps[i] - r2(g.cusps[i])) < 1e-9, `natal_chart: cusp ${i + 1}`);
  }
  for (const b of BODIES) {
    const p = g.bodies[b];
    assert(Math.abs(c.bodies[b].lon - r2(p.lon)) < 1e-9, `natal_chart: ${b} lon ${c.bodies[b].lon} vs ${p.lon}`);
    assert(Math.abs(c.bodies[b].speed - r2(p.speed)) < 1e-9, `natal_chart: ${b} speed`);
    assert((c.bodies[b].rx === true) === p.retrograde, `natal_chart: ${b} retrograde flag`);
    assert(c.bodies[b].house === houseFromCusps(g.cusps, p.lon), `natal_chart: ${b} house`);
  }
  // Engine Aspect objects (including phase and strength) pass through unchanged.
  assert(JSON.stringify(c.aspects) === JSON.stringify(g.aspects),
    "natal_chart: aspect objects pass the engine Aspect objects through unchanged");
  const jd = jdFromIso(iso);
  for (const a of c.aspects) {
    const expected = aspectPhase(
      g.bodies[a.a].lon, g.bodies[a.a].speed,
      g.bodies[a.b].lon, g.bodies[a.b].speed, ASPECTS[a.aspect]);
    assert(a.phase === expected, `natal_chart: aspect ${a.a} ${a.aspect} ${a.b} phase ${a.phase} vs ${expected}`);
  }
  // Solar phase per body matches the engine primitive (omitted when far from Sun).
  for (const b of BODIES) {
    const expected = solarPhase(eng, b, jd);
    assert((c.bodies[b].solar ?? null) === expected, `natal_chart: ${b} solar phase ${c.bodies[b].solar ?? null} vs ${expected}`);
  }
}

// polar Placidus fallback must be reported, never silent
{
  const c = await call("natal_chart", { date: "1985-12-01T09:00:00Z", lat: 78.2, lon: 15.6 });
  assert(c.houses === "whole_sign", `natal_chart polar: fell back to ${c.houses}`);
  assert(c.houses_requested === "placidus", "natal_chart polar: reports requested system");
  assert(typeof c.houses_fallback_reason === "string", "natal_chart polar: reports fallback reason");
}

// ---------------------------------------------------------------- current_sky
{
  const args = { date: "2026-03-20T14:46:00Z", lat: 51.5, lon: -0.12 };
  const sky = await call("current_sky", args);
  const natal = await call("natal_chart", { ...args });
  assert(JSON.stringify(sky) === JSON.stringify(natal),
    "current_sky: identical payload to natal_chart for the same instant");
}

// ---------------------------------------------------------------- transits
{
  const orb = 3;
  const natalArgs = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const tIso = "2026-06-01T00:00:00Z";
  const t = await call("transits", { ...natalArgs, transit_date: tIso, orb });
  const natal = await call("natal_chart", natalArgs);
  const jdT = jdFromIso(tIso);
  const ASP = [["conjunction", 0], ["sextile", 60], ["square", 90], ["trine", 120], ["opposition", 180]];

  // oracle: rebuild the expected hit set from engine positions + the natal payload
  const expected = new Set();
  for (const tb of BODIES) {
    const tp = eng.position(tb, jdT);
    assert(t.transiting[tb].natal_house === houseFromCusps(natal.cusps, tp.lon),
      `transits: ${tb} natal house`);
    assert((t.transiting[tb].rx === true) === tp.retrograde, `transits: ${tb} rx flag`);
    for (const nb of BODIES) {
      const sep = Math.abs(mod(tp.lon - natal.bodies[nb].lon + 180, 360) - 180);
      for (const [name, angle] of ASP) {
        if (Math.abs(sep - angle) <= orb) expected.add(`t.${tb} ${name} n.${nb}`);
      }
    }
  }
  const got = new Set(t.aspects_to_natal.map((h) => `t.${h.t} ${h.aspect} n.${h.n}`));
  assert(got.size === expected.size && [...expected].every((e) => got.has(e)),
    `transits: aspect set ${got.size} vs oracle ${expected.size}`);
  for (const h of t.aspects_to_natal) {
    assert(typeof h.orb === "number" && h.orb >= 0 && h.orb <= orb
      && typeof h.applying === "boolean",
      `transits: hit shape ${JSON.stringify(h)}`);
  }
}

// ---------------------------------------------------------------- synastry
{
  const a = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const b = { date: "1987-11-02T06:15:00Z", lat: 40.71, lon: -74.0 };
  const orb = 4;
  const s = await call("synastry", { a, b, orb });
  const chartA = eng.chartAt(jdFromIso(a.date), a.lat, a.lon, { houseSystem: "placidus" });
  const chartB = eng.chartAt(jdFromIso(b.date), b.lat, b.lon, { houseSystem: "placidus" });

  for (const ba of BODIES) {
    assert(s.a_planets_in_b_houses[ba] === houseFromCusps(s.b.cusps, s.a.bodies[ba].lon),
      `synastry: A.${ba} house in B`);
    assert(s.b_planets_in_a_houses[ba] === houseFromCusps(s.a.cusps, s.b.bodies[ba].lon),
      `synastry: B.${ba} house in A`);
  }
  const expected = synastryAspects(chartA, chartB, orb)
    .map((x) => `A.${x.a} ${x.aspect} B.${x.b}`);
  const got = s.inter_aspects.map((x) => `A.${x.a} ${x.aspect} B.${x.b}`);
  assert(got.length === expected.length && expected.every((e) => got.includes(e)),
    `synastry: inter-aspect set ${got.length} vs oracle ${expected.length}`);
}

// ---------------------------------------------------------------- find_aspect_dates
const assertExactHits = (hits, body, targetLonAt, angle, label, tolDeg = 0.02) => {
  for (const iso of hits) {
    const jd = jdFromIso(iso);
    const sep = Math.abs(mod(eng.longitude(body, jd) - targetLonAt(jd) + 180, 360) - 180);
    assert(Math.abs(sep - angle) < tolDeg, `${label}: hit ${iso} off by ${(sep - angle).toFixed(4)}°`);
  }
  const jds = hits.map(jdFromIso);
  assert(jds.every((v, i) => i === 0 || v > jds[i - 1]), `${label}: hits sorted`);
};

// fixed target through a Mars retrograde loop: must root-find BOTH offsets
// and report retrograde re-hits (3 crossings, not 1)
{
  // locate the Mars retrograde loop nearest 2027 and aim at its midpoint
  let jd = jdFromIso("2026-06-01T00:00:00Z");
  while (eng.position("mars", jd).speed > 0) jd += 1;
  const jd0 = jd;
  while (eng.position("mars", jd).speed < 0) jd += 1;
  const midLon = eng.longitude("mars", (jd0 + jd) / 2);

  const res = await call("find_aspect_dates", {
    body: "mars", aspect: "conjunction", target_lon: midLon,
    start: "2026-06-01T00:00:00Z", end: "2028-06-01T00:00:00Z",
  });
  assert(res.hits.length === 3, `find_aspect_dates: mars retro conj expected 3 hits, got ${res.hits.length}`);
  assertExactHits(res.hits, "mars", () => midLon, 0, "find_aspect_dates mars conj");
}

// non-axial aspect: exact at +60 AND -60 (both geometries must appear)
{
  const target = 283.283;
  const res = await call("find_aspect_dates", {
    body: "sun", aspect: "sextile", target_lon: target,
    start: "2026-01-01T00:00:00Z", end: "2027-01-01T00:00:00Z",
  });
  assert(res.hits.length === 2, `find_aspect_dates: sun sextile expected 2 hits/yr, got ${res.hits.length}`);
  assertExactHits(res.hits, "sun", () => target, 60, "find_aspect_dates sun sextile");
  const signs = new Set(res.hits.map((iso) =>
    Math.sign(mod(eng.longitude("sun", jdFromIso(iso)) - target + 180, 360) - 180)));
  assert(signs.has(1) && signs.has(-1), "find_aspect_dates: both ±60° geometries found");
}

// body-to-body: new moons, ~29.5 days apart
{
  const res = await call("find_aspect_dates", {
    body: "moon", aspect: "conjunction", target_body: "sun",
    start: "2026-01-01T00:00:00Z", end: "2026-04-01T00:00:00Z",
  });
  assert(res.hits.length === 3, `find_aspect_dates: expected 3 new moons in Q1, got ${res.hits.length}`);
  assertExactHits(res.hits, "moon", (jd) => eng.longitude("sun", jd), 0, "find_aspect_dates new moons");
}

// contract errors must be errors, not empty results
{
  const tooBig = await client.callTool({ name: "find_aspect_dates", arguments: {
    body: "pluto", aspect: "conjunction", target_lon: 0,
    start: "1900-01-01T00:00:00Z", end: "2099-01-01T00:00:00Z" } });
  assert(tooBig.isError === true, "find_aspect_dates: >50yr range rejected");
  const noTarget = await client.callTool({ name: "find_aspect_dates", arguments: {
    body: "mars", aspect: "square",
    start: "2026-01-01T00:00:00Z", end: "2027-01-01T00:00:00Z" } });
  assert(noTarget.isError === true, "find_aspect_dates: missing target rejected");
}

// ---------------------------------------------------------------- rectification_grid
{
  const res = await call("rectification_grid", {
    date: "1990-06-10T00:00:00Z", lat: 27.95, lon: -82.46, step_minutes: 20,
  });
  assert(res.grid.length === 73, `rectification_grid: 73 rows for 24h/20min, got ${res.grid.length}`);
  // ASC sweeps the full zodiac in ~24h: every sign boundary must be reported
  assert(res.asc_sign_changes.length >= 11 && res.asc_sign_changes.length <= 13,
    `rectification_grid: ${res.asc_sign_changes.length} sign changes (expected ~12)`);
  // cross-check a grid row against current_sky at the same instant
  const row = res.grid[36]; // 12:00
  const sky = await call("current_sky", {
    date: `1990-06-10T${row.utc}:00Z`, lat: 27.95, lon: -82.46, house_system: "whole_sign",
  });
  assert(row.asc === sky.angles.ascPos && row.mc === sky.angles.mcPos,
    `rectification_grid: row ${row.utc} matches current_sky (${row.asc}/${row.mc} vs ${sky.angles.ascPos}/${sky.angles.mcPos})`);
}

// ---------------------------------------------------------------- returns
{
  const natal = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("returns", {
    ...natal, body: "sun",
    search_start: "2025-01-01T00:00:00Z", search_end: "2026-01-01T00:00:00Z",
  });
  const natalJd = jdFromIso(natal.date);
  const expected = solarReturn(eng, natalJd, jdFromIso("2025-01-01T00:00:00Z"), jdFromIso("2026-01-01T00:00:00Z"));
  assert(res.returns.length === expected.length, `returns: count ${res.returns.length} vs ${expected.length}`);
  // defining property: the Sun is back at its natal longitude at each return instant
  const natalSun = eng.longitude("sun", natalJd);
  for (const iso of res.returns) {
    const d = Math.abs(mod(eng.longitude("sun", jdFromIso(iso)) - natalSun + 180, 360) - 180);
    assert(d < 0.01, `returns: sun back to natal lon at ${iso} (off ${d.toFixed(4)}°)`);
  }
  assert(res.return_lat === natal.lat && res.return_lon === natal.lon, "returns: return place defaults to birthplace");
  // the return chart is a real chart at that instant+place: identical to current_sky there
  const sky = await call("current_sky", { date: res.returns[0], lat: res.return_lat, lon: res.return_lon });
  assert(JSON.stringify(res.chart) === JSON.stringify(sky), "returns: chart matches current_sky at the return instant");
}

// ---------------------------------------------------------------- progressions
{
  const res = await call("progressions", { date: "1990-06-10T14:30:00Z", target_date: "2025-06-10T00:00:00Z" });
  const natalJd = jdFromIso("1990-06-10T14:30:00Z");
  const targetJd = jdFromIso("2025-06-10T00:00:00Z");
  assert(Math.abs(res.solar_arc - r2(solarArc(eng, natalJd, targetJd))) < 1e-9, "progressions: solar arc");
  for (const b of BODIES) {
    assert(Math.abs(res.bodies[b].secondary - r2(progressedLongitude(eng, b, natalJd, targetJd))) < 1e-9,
      `progressions: ${b} secondary`);
    assert(Math.abs(res.bodies[b].directed - r2(directedLongitude(eng, b, natalJd, targetJd))) < 1e-9,
      `progressions: ${b} directed`);
  }
}

// ---------------------------------------------------------------- composite
{
  const a = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const b = { date: "1988-03-21T06:00:00Z", lat: 40.71, lon: -74.01 };
  const res = await call("composite", { a, b });
  const jdA = jdFromIso(a.date);
  const jdB = jdFromIso(b.date);
  const comp = compositeLongitudes(eng, jdA, jdB, BODIES);
  for (const body of BODIES) {
    assert(Math.abs(res.composite.bodies[body].lon - r2(comp[body])) < 1e-9, `composite: ${body} midpoint`);
  }
  // davison: a real chart at the temporal+geographic midpoint; equals current_sky there
  const [, midLat, midLon] = davisonParams(jdA, jdB, a.lat, a.lon, b.lat, b.lon);
  const sky = await call("current_sky", { date: res.davison.utc, lat: midLat, lon: midLon });
  assert(JSON.stringify(res.davison) === JSON.stringify(sky), "composite: davison matches current_sky at the midpoint");
}

// ---------------------------------------------------------------- dignities
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("dignities", args);
  const jd = jdFromIso(args.date);
  const day = isDayChart(eng, jd, args.lat, args.lon);
  assert(res.sect === (day ? "day" : "night"), "dignities: chart sect");
  for (const b of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]) {
    assert(JSON.stringify(res.bodies[b].dignity) === JSON.stringify(dignityOf(eng, b, jd)), `dignities: ${b} dignity`);
    const ds = dignityScore(b, eng.longitude(b, jd), day ? "day" : "night");
    assert(res.bodies[b].score === ds.total, `dignities: ${b} weighted score`);
    assert((res.bodies[b].peregrine ?? false) === ds.peregrine, `dignities: ${b} peregrine flag`);
    assert(res.bodies[b].planetary_sect === planetarySect(b), `dignities: ${b} planetary sect`);
    assert(res.bodies[b].in_sect === inSect(b, day), `dignities: ${b} in sect`);
  }
}

// ---------------------------------------------------------------- lots
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("lots", args);
  const jd = jdFromIso(args.date);
  const expected = lots(eng, jd, args.lat, args.lon);
  const day = isDayChart(eng, jd, args.lat, args.lon);
  assert(res.sect === (day ? "day" : "night"), "lots: chart sect");
  for (const name of HERMETIC_LOTS) {
    assert(Math.abs(res.lots[name].lon - r2(expected[name])) < 1e-9, `lots: ${name} longitude`);
  }
  // implementation-independent invariant: Fortune and Spirit mirror about the Asc
  const asc = eng.chartAt(jd, args.lat, args.lon).angles.asc;
  const sum = res.lots.fortune.lon + res.lots.spirit.lon;
  assert(Math.abs(mod(sum - 2 * asc + 180, 360) - 180) < 0.02,
    "lots: fortune + spirit symmetric about the ascendant");
}

// ---------------------------------------------------------------- profections
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const target = "2026-06-10T00:00:00Z";
  const res = await call("profections", { ...args, target_date: target });
  const exp = profectionAt(eng, jdFromIso(args.date), jdFromIso(target), args.lat, args.lon);
  assert(res.age_years === exp.age_years, `profections: age ${res.age_years} vs ${exp.age_years}`);
  assert(res.month === exp.month, `profections: month ${res.month} vs ${exp.month}`);
  assert(JSON.stringify(res.annual) === JSON.stringify(exp.annual), "profections: annual profected sign");
  assert(JSON.stringify(res.monthly) === JSON.stringify(exp.monthly), "profections: monthly profected sign");
  // textbook invariant: the annual profected house advances one sign per year of life
  assert(res.annual.house === (res.age_years % 12) + 1, "profections: annual house = age%12 + 1");
}

// ---------------------------------------------------------------- firdaria
{
  const NODE_LORDS = ["north_node", "south_node"];
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const target = "2026-06-10T00:00:00Z";
  const res = await call("firdaria", { ...args, target_date: target });
  const natalJd = jdFromIso(args.date);
  const day = isDayChart(eng, natalJd, args.lat, args.lon);
  assert(res.sect === (day ? "day" : "night"), "firdaria: chart sect");
  assert(res.periods.length === 9, `firdaria: nine major periods, got ${res.periods.length}`);
  // matches the engine timeline, lord and length for length
  const exp = firdaria(day, natalJd);
  for (let i = 0; i < 9; i++) {
    assert(res.periods[i].lord === exp[i].lord, `firdaria: period ${i} lord`);
    assert(res.periods[i].years === exp[i].years, `firdaria: period ${i} years`);
  }
  // invariant: nine periods total 75 years and tile contiguously
  assert(res.periods.reduce((a, p) => a + p.years, 0) === 75, "firdaria: 75-year total");
  for (let i = 1; i < res.periods.length; i++) {
    assert(res.periods[i].start === res.periods[i - 1].end, `firdaria: period ${i} contiguous with previous`);
  }
  // invariant: planetary periods split into seven sub-periods tiling the major; nodes have none
  for (const p of res.periods) {
    if (NODE_LORDS.includes(p.lord)) {
      assert(p.sub.length === 0, `firdaria: ${p.lord} has no sub-periods`);
    } else {
      assert(p.sub.length === 7, `firdaria: ${p.lord} has seven sub-periods`);
      assert(p.sub[0].start === p.start && p.sub[6].end === p.end, `firdaria: ${p.lord} sub-periods tile the major period`);
    }
  }
  const active = firdariaActive(day, natalJd, jdFromIso(target));
  assert(res.active.major === active.major && res.active.sub === active.sub, "firdaria: active lord matches engine");
}

// ---------------------------------------------------------------- releasing
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const target = "2026-06-10T00:00:00Z";
  const res = await call("releasing", { ...args, target_date: target, max_level: 2, horizon_years: 60 });
  const natalJd = jdFromIso(args.date);
  const targetJd = jdFromIso(target);
  const oa = zrAt(eng, natalJd, targetJd, args.lat, args.lon, "spirit");
  assert(res.lot === "spirit" && res.lot_sign === oa.lot_sign, "releasing: lot and lot sign match engine zrAt");
  assert(res.sect === (oa.day ? "day" : "night"), "releasing: chart sect");
  assert((res.active.l1 ?? null) === (oa.l1 ?? null) && (res.active.l2 ?? null) === (oa.l2 ?? null) &&
    (res.active.l3 ?? null) === (oa.l3 ?? null) && (res.active.l4 ?? null) === (oa.l4 ?? null),
    "releasing: active L1..L4 match engine zrAt");
  const lotSign = SIGNS.indexOf(oa.lot_sign);
  const exp = zrRelease(lotSign, natalJd, 2, 60);
  assert(res.periods.length === exp.length, `releasing: timeline length ${res.periods.length} vs ${exp.length}`);
  // L1 periods tile contiguously
  const l1 = res.periods.filter((p) => p.level === 1);
  for (let i = 1; i < l1.length; i++) {
    assert(l1[i].start === l1[i - 1].end, `releasing: L1 period ${i} contiguous with previous`);
  }
  // loosing-of-the-bond invariant: the L1 loosing period jumps +6 signs from the start sign
  const lb1 = l1.find((p) => p.lb);
  if (lb1) {
    assert(SIGNS.indexOf(lb1.sign) === mod(lotSign + 6, 12), "releasing: L1 loosing of the bond is +6 from the start sign");
  }
  // each L2 run fills (tiles) its parent L1 period
  for (const p of l1) {
    const subs = res.periods.filter((s) => s.level === 2 && s.start >= p.start && s.end <= p.end);
    if (subs.length) {
      assert(subs[0].start === p.start, "releasing: first L2 starts at its L1 parent");
      assert(subs[subs.length - 1].end === p.end, "releasing: last L2 ends at its L1 parent");
    }
  }
}

// ---------------------------------------------------------------- directions
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("directions", { ...args, key: "naibod", max_years: 90 });
  const natalJd = jdFromIso(args.date);
  const exp = primaryDirections(eng, natalJd, args.lat, args.lon, undefined, "naibod", 90);
  assert(res.key === "naibod", "directions: key echoed");
  assert(res.directions.length === exp.length, `directions: count ${res.directions.length} vs ${exp.length}`);
  for (let i = 0; i < exp.length; i++) {
    assert(res.directions[i].body === exp[i].body, `directions: entry ${i} body`);
    assert(res.directions[i].angle === exp[i].angle, `directions: entry ${i} angle`);
    assert(Math.abs(res.directions[i].arc - exp[i].arc) < 0.02, `directions: entry ${i} arc`);
    assert(Math.abs(res.directions[i].years - exp[i].years) < 0.02, `directions: entry ${i} years`);
  }
  // sorted ascending by age
  for (let i = 1; i < res.directions.length; i++) {
    assert(res.directions[i].years >= res.directions[i - 1].years - 1e-9, "directions: sorted by years");
  }
  // time-key invariant: years = arc / key (naibod)
  for (const d of res.directions) {
    assert(Math.abs(d.years - d.arc / KEYS.naibod) < 0.02, "directions: years = arc / naibod key");
  }
  // geometric invariant: for a body with both MC and IC directions, IC arc = MC arc + 180
  const byBody = {};
  for (const d of res.directions) (byBody[d.body] ??= {})[d.angle] = d.arc;
  for (const b of Object.keys(byBody)) {
    if (byBody[b].MC !== undefined && byBody[b].IC !== undefined) {
      assert(Math.abs(mod(byBody[b].IC - byBody[b].MC - 180, 360)) < 0.02, `directions: ${b} IC = MC + 180`);
    }
  }
  // include_mundane: inter-planetary directions match the engine and are gated off by default
  assert(res.mundane === undefined, "directions: no mundane block unless requested");
  const resM = await call("directions", { ...args, key: "naibod", max_years: 90, include_mundane: true });
  const expM = mundaneDirections(eng, natalJd, args.lat, args.lon, undefined, "naibod", 90);
  assert(resM.mundane.length === expM.length, `directions: mundane count ${resM.mundane.length} vs ${expM.length}`);
  for (let i = 0; i < expM.length; i++) {
    assert(resM.mundane[i].promissor === expM[i].promissor, `directions: mundane ${i} promissor`);
    assert(resM.mundane[i].significator === expM[i].significator, `directions: mundane ${i} significator`);
    assert(Math.abs(resM.mundane[i].years - expM[i].years) < 0.02, `directions: mundane ${i} years`);
  }
  for (const d of resM.mundane) {
    assert(d.promissor !== d.significator, "directions: mundane never self-direction");
    assert(Math.abs(d.years - d.arc / KEYS.naibod) < 0.02, "directions: mundane years = arc / naibod key");
  }
}

// ---------------------------------------------------------------- nakshatras
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("nakshatras", args);
  const natalJd = jdFromIso(args.date);
  const Z = "sidereal:lahiri";
  assert(res.zodiac === Z, "nakshatras: defaults to sidereal:lahiri");
  for (const b of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]) {
    const g = nakshatra(eng.longitude(b, natalJd, { zodiac: Z }));
    assert(res.points[b].nakshatra === g.name, `nakshatras: ${b} name`);
    assert(res.points[b].pada === g.pada, `nakshatras: ${b} pada`);
    assert(res.points[b].lord === g.lord, `nakshatras: ${b} lord`);
    assert(res.points[b].pada >= 1 && res.points[b].pada <= 4, `nakshatras: ${b} pada in 1..4`);
  }
  const ascNak = nakshatra(eng.chartAt(natalJd, args.lat, args.lon, { zodiac: Z }).angles.asc);
  assert(res.points.asc.nakshatra === ascNak.name, "nakshatras: ascendant (lagna) nakshatra");
}

// ---------------------------------------------------------------- dasha
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const natalJd = jdFromIso(args.date);
  const Z = "sidereal:lahiri";
  const moonLon = eng.longitude("moon", natalJd, { zodiac: Z });
  const target = "2026-06-14T00:00:00Z";
  const targetJd = jdFromIso(target);

  // vimshottari
  {
    const res = await call("dasha", { ...args, system: "vimshottari", target_date: target });
    const tl = vimshottariDashas(moonLon, natalJd, 2);
    assert(res.system === "vimshottari", "dasha/vim: system echoed");
    assert(res.start_lord === tl.start_lord, "dasha/vim: start lord");
    assert(res.periods.length === tl.dashas.length, "dasha/vim: timeline length");
    assert(Math.abs(res.balance_years - r2(tl.balance_years)) < 0.01, "dasha/vim: balance years");
    // maha periods tile contiguously
    for (let i = 1; i < res.periods.length; i++) {
      assert(res.periods[i].start === res.periods[i - 1].end, `dasha/vim: maha ${i} contiguous`);
    }
    const a = vimshottariAt(eng, natalJd, targetJd, Z);
    assert(res.active.maha === (a.maha ?? null), "dasha/vim: active maha matches engine");
    assert(res.active.antar === (a.antar ?? null), "dasha/vim: active antar matches engine");
    assert(res.active.pratyantar === (a.pratyantar ?? null), "dasha/vim: active pratyantar matches engine");
  }
  // yogini
  {
    const res = await call("dasha", { ...args, system: "yogini", target_date: target });
    const tl = yoginiDashas(moonLon, natalJd, 2);
    assert(res.start_yogini === tl.start_yogini, "dasha/yogini: start yogini");
    assert(res.periods.length === tl.dashas.length, "dasha/yogini: timeline length");
    const a = yoginiAt(eng, natalJd, targetJd, Z);
    assert(res.active.maha === (a.maha ?? null), "dasha/yogini: active maha matches engine");
  }
  // ashtottari
  {
    const res = await call("dasha", { ...args, system: "ashtottari", target_date: target });
    const tl = ashtottariDashas(moonLon, natalJd, 2);
    assert(res.start_lord === tl.start_lord, "dasha/ashtottari: start lord");
    assert(res.periods.length === tl.dashas.length, "dasha/ashtottari: timeline length");
    const a = ashtottariAt(eng, natalJd, targetJd, Z);
    assert(res.active.maha === (a.maha ?? null), "dasha/ashtottari: active maha matches engine");
  }
}

// ---------------------------------------------------------------- vargas
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("vargas", args);
  const natalJd = jdFromIso(args.date);
  const Z = "sidereal:lahiri";
  for (const n of VARGA_DIVISIONS) {
    assert(res.charts[`D${n}`] !== undefined, `vargas: chart D${n} present`);
  }
  // D1 reduces to the rasi: the divisional sign equals the body's rasi
  for (const b of ["sun", "moon", "mars", "jupiter", "saturn"]) {
    const lon = eng.longitude(b, natalJd, { zodiac: Z });
    assert(res.charts.D1[b].sign_index === Math.floor(((lon % 360) + 360) % 360 / 30) % 12, `vargas: D1 ${b} = rasi`);
    assert(res.charts.D9[b].sign === varga(lon, 9).sign, `vargas: D9 ${b} navamsa matches engine`);
  }
}

// ---------------------------------------------------------------- yogas
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("yogas", args);
  const natalJd = jdFromIso(args.date);
  const Z = "sidereal:lahiri";
  const placement = yogasAt(eng, natalJd, args.lat, args.lon, Z);
  assert(res.yogas.length === placement.length, "yogas: placement count matches engine");
  const names = new Set(res.yogas.map((y) => y.yoga));
  for (const y of placement) assert(names.has(y.yoga), `yogas: ${y.yoga} present`);
  assert(res.kemadruma === kemadrumaAt(eng, natalJd, args.lat, args.lon, false, false, Z).present, "yogas: kemadruma matches engine");
  const { raja, yogakarakas } = rajaYogasAt(eng, natalJd, args.lat, args.lon, Z);
  assert(res.raja_yogas.length === raja.length, "yogas: raja count matches engine");
  assert(JSON.stringify(res.yogakarakas) === JSON.stringify(yogakarakas), "yogas: yogakarakas match engine");
  assert(res.dhana_yogas.length === dhanaYogasAt(eng, natalJd, args.lat, args.lon, Z).length, "yogas: dhana count matches engine");
  // every raja/dhana association is one of the three defined types
  for (const y of [...res.raja_yogas, ...res.dhana_yogas]) {
    assert(["conjunction", "aspect", "exchange"].includes(y.via), `yogas: association type ${y.via} is defined`);
  }
}

// ---------------------------------------------------------------- aspect_patterns
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("aspect_patterns", args);
  const c = eng.chart(1990, 6, 10, 14, 30, 0, args.lat, args.lon, "placidus");
  const expected = detectPatterns(c);
  assert(JSON.stringify(res.patterns) === JSON.stringify(expected),
    "aspect_patterns: matches engine detectPatterns");
  assert(res.houses === "placidus", "aspect_patterns: house system echoed");
}

// ---------------------------------------------------------------- parans
{
  const args = { date: "1990-06-10T00:00:00Z", lat: 27.95, tolerance_min: 30 };
  const res = await call("parans", args);
  const jd = julianDay(1990, 6, 10, 0, 0, 0);
  const expected = parans(eng, jd, args.lat, undefined, args.tolerance_min);
  assert(res.parans.length === expected.length,
    `parans: hit count matches engine (${res.parans.length} vs ${expected.length})`);
  for (let i = 0; i < expected.length; i++) {
    const got = res.parans[i];
    const want = expected[i];
    assert(got.a === want.a && got.b === want.b
      && got.a_angle === want.a_angle && got.b_angle === want.b_angle,
      `parans[${i}]: pair and angles match engine`);
    assert(Math.abs(got.gap_min - want.gap_min) < 0.01,
      `parans[${i}]: gap matches engine`);
  }
  assert(res.parans.every((p) => p.gap_min <= args.tolerance_min),
    "parans: every gap within the stated tolerance");
  assert(res.lat === args.lat, "parans: latitude echoed");
}

// ---------------------------------------------------------------- chart_signature
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46 };
  const res = await call("chart_signature", args);
  const c = eng.chart(1990, 6, 10, 14, 30, 0, args.lat, args.lon, "placidus");
  assert(JSON.stringify(res.signature) === JSON.stringify(chartSignature(c)),
    "chart_signature: matches engine chartSignature");
}

// ---------------------------------------------------------------- similar_skies
{
  const ref = "1990-06-10T14:30:00Z";
  const res = await call("similar_skies", { reference_date: ref, start: "1990-01-01T00:00:00Z", end: "1991-01-01T00:00:00Z" });
  assert(res.matches.length > 0 && res.matches.length <= 10, "similar_skies: returns up to limit matches");
  // sorted by similarity, highest first
  let sorted = true;
  for (let i = 1; i < res.matches.length; i++) if (res.matches[i].similarity > res.matches[i - 1].similarity) sorted = false;
  assert(sorted, "similar_skies: matches sorted by similarity descending");
  // the reference sky matches itself: the best match in a window containing it is near-identical
  assert(res.matches[0].similarity > 0.99, "similar_skies: reference sky matches itself within the window");
  // the reported similarity equals the engine's configurationFit at the top match
  const refJd = julianDay(1990, 6, 10, 14, 30, 0);
  const target = chartFeatures(eng, refJd);
  const top = res.matches[0];
  const d = new Date(top.utc);
  const topJd = julianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  assert(Math.abs(configurationFit(eng, topJd, target) - top.similarity) < 1e-3, "similar_skies: similarity matches configurationFit");
}

// ---------------------------------------------------------------- electional_search
{
  const res = await call("electional_search", {
    start: "2026-06-01T00:00:00Z", end: "2026-06-20T00:00:00Z",
    wanted: [{ a: "moon", b: "venus", aspect: "trine" }], step_hours: 6,
  });
  assert(res.moments.length > 0 && res.moments.length <= 10, "electional_search: returns ranked moments");
  let sorted = true;
  for (let i = 1; i < res.moments.length; i++) if (res.moments[i].score > res.moments[i - 1].score) sorted = false;
  assert(sorted, "electional_search: moments sorted by score descending");
  for (const mo of res.moments) {
    assert(mo.matched.length > 0, "electional_search: each returned moment matched something");
    for (const m of mo.matched) {
      assert(m.a === "moon" && m.b === "venus" && m.aspect === "trine", "electional_search: matched the wanted aspect");
    }
  }
}

// ---------------------------------------------------------------- cosmic_weather
{
  const date = "2026-06-10T00:00:00Z";
  const res = await call("cosmic_weather", { date });
  const bodies = {};
  for (const b of BODIES) bodies[b] = { lon: eng.longitude(b, jdFromIso(date)) };
  assert(JSON.stringify(res.patterns) === JSON.stringify(detectPatternsIn(bodies)), "cosmic_weather: patterns match engine");
  assert(res.patterns.every((p) => p.kind !== "stellium_house"), "cosmic_weather: no house-based patterns in a mundane snapshot");
  assert(res.moon_void_of_course === voidOfCourse(eng, jdFromIso(date)).isVoid, "cosmic_weather: void Moon flag matches engine");
}

// ---------------------------------------------------------------- date_sky
{
  // Four planets by sign, the positions usually quoted for the oldest
  // Babylonian horoscope; one window in these 200 years, in 410 BCE.
  const cons = [
    { body: "jupiter", sign: "Pisces" }, { body: "venus", sign: "Taurus" },
    { body: "saturn", sign: "Cancer" }, { body: "mars", sign: "Gemini" },
  ];
  const res = await call("date_sky", { constraints: cons, start_year: -499, end_year: -300 });
  assert(res.windows.length === 1 && res.truncated === false, "date_sky: one window in 499-301 BCE");
  const w = res.windows[0];
  assert(w.start.calendar === "julian" && w.start.year === -409 && w.start.era === "410 BCE"
    && w.start.month === 4 && w.start.day === 16, `date_sky: window opens 16 April 410 BCE (${JSON.stringify(w.start)})`);
  assert(/^\d\d:\d\d$/.test(w.start.ut) && /^\d\d:\d\d$/.test(w.end.ut), "date_sky: UT stamps are HH:MM");
  // the payload is the engine's dateSky over the same range
  const direct = dateSky(eng, cons,
    julianDay(-499, 1, 1, 0, 0, 0, "julian"), julianDay(-299, 1, 1, 0, 0, 0, "julian"));
  assert(direct.windows.length === 1
    && Math.abs(direct.windows[0].start - w.start.jd) < 1e-4
    && Math.abs(direct.windows[0].end - w.end.jd) < 1e-4, "date_sky: window edges match the engine");
  assert(Math.abs(w.days - r2(direct.windows[0].end - direct.windows[0].start)) < 1e-9, "date_sky: days is the window length");
  // every constraint holds in the middle of the window
  const mid = (w.start.jd + w.end.jd) / 2;
  for (const c of cons) {
    assert(SIGNS[Math.floor(eng.longitude(c.body, mid) / 30)] === c.sign, `date_sky: ${c.body} is in ${c.sign} mid-window`);
  }
  // the funnel is in scan order, slowest first, and never widens
  assert(res.funnel.length === 4 && res.funnel[0].label === "saturn in Cancer", "date_sky: Saturn is scanned first");
  assert(res.funnel.every((f, i) => i === 0 || f.days <= res.funnel[i - 1].days), "date_sky: the funnel never widens");
  assert(res.funnel[3].windows === 1, "date_sky: the last stage is the result");

  // a modern search stamps Gregorian dates
  const modern = await call("date_sky", {
    constraints: [{ body: "saturn", sign: "Capricorn" }, { body: "jupiter", sign: "Capricorn" }],
    start_year: 2019, end_year: 2021,
  });
  assert(modern.windows.length >= 1 && modern.windows[0].start.calendar === "gregorian"
    && modern.windows[0].start.year === 2019 && modern.windows[0].start.month === 12
    && modern.windows[0].start.era === "2019 CE", `date_sky: Jupiter joins Saturn in Capricorn in December 2019 (${JSON.stringify(modern.windows[0]?.start)})`);

  // limit truncates and says so
  const many = await call("date_sky", { constraints: [{ body: "moon", sign: 0 }], start_year: 2020, end_year: 2021, limit: 3 });
  assert(many.windows.length === 3 && many.truncated === true, "date_sky: limit truncates and reports it");

  // refusals: a span outside the data, an unknown body, a malformed constraint
  const tooEarly = await client.callTool({ name: "date_sky", arguments: { constraints: cons, start_year: -5000, end_year: -4000 } });
  assert(tooEarly.isError === true && /covers years/.test(tooEarly.content[0].text), "date_sky: a span outside the data is refused with the covered years");
  const unknown = await client.callTool({ name: "date_sky", arguments: { constraints: [{ body: "vulcan_prime", sign: "Leo" }], start_year: 2000, end_year: 2001 } });
  assert(unknown.isError === true, "date_sky: unknown body rejected");
  const noArc = await client.callTool({ name: "date_sky", arguments: { constraints: [{ body: "sun" }], start_year: 2000, end_year: 2001 } });
  assert(noArc.isError === true, "date_sky: a constraint with no arc is rejected");
}

// ------------------------------------------- date_sky with a visibility
{
  // Sirius rising at Memphis with the Moon in Cancer, 130 to 144 CE
  const cons = [
    { visibility: { target: "Sirius", kind: "heliacal_rising", lat: 29.85, lon: 31.25 } },
    { body: "moon", sign: "Cancer" },
  ];
  const res = await call("date_sky", { constraints: cons, start_year: 130, end_year: 144 });
  const direct = dateSky(eng, [
    { visibility: { target: "Sirius", kind: "heliacal_rising", lat: 29.85, lonEast: 31.25 } },
    { body: "moon", sign: "Cancer" },
  ], julianDay(130, 1, 1, 0, 0, 0, "julian"), julianDay(145, 1, 1, 0, 0, 0, "julian"));
  assert(res.windows.length === direct.windows.length && res.windows.length > 0,
    `date_sky: visibility windows match the engine (${res.windows.length} vs ${direct.windows.length})`);
  assert(res.windows.every((w, i) => Math.abs(w.start.jd - direct.windows[i].start) < 1e-4
    && Math.abs(w.end.jd - direct.windows[i].end) < 1e-4), "date_sky: visibility window edges match the engine");
  assert(res.funnel[res.funnel.length - 1].label === "Sirius morning_first at 29.85, 31.25",
    `date_sky: the visibility is taken last (${res.funnel.map((f) => f.label).join(" | ")})`);
  assert(res.windows.every((w) => w.start.month === 7 && w.start.calendar === "julian"), "date_sky: every window is in July, Julian calendar");
  // every window lies on the days of an event the heliacal tool reports
  const first = res.windows[0];
  const ev = await call("heliacal", { target: "Sirius", lat: 29.85, lon: 31.25, start_year: first.start.year, kind: "morning_first" });
  assert(ev.events[0].earliest.jd - 1 <= first.start.jd && first.end.jd <= ev.events[0].latest.jd + 1,
    "date_sky: the first window lies inside that year's rising window");
  const widened = await call("date_sky", {
    constraints: [{ ...cons[0], within_days: 5 }, cons[1]], start_year: 130, end_year: 144,
  });
  assert(widened.windows.length >= res.windows.length, "date_sky: within_days never loses a window");
  const bad = async (args) => (await client.callTool({ name: "date_sky", arguments: args })).isError === true;
  assert(await bad({ constraints: [{ visibility: { target: "jupiter", kind: "evening_first", lat: 30, lon: 31 } }], start_year: 2000, end_year: 2001 }),
    "date_sky: an event the target does not have is rejected");
  assert(await bad({ constraints: [{ visibility: { target: "nibiru", kind: "morning_first", lat: 30, lon: 31 } }], start_year: 2000, end_year: 2001 }),
    "date_sky: an unknown visibility target is rejected");
  assert(await bad({ constraints: [{ body: "sun", visibility: { target: "Sirius", kind: "morning_first", lat: 30, lon: 31 } }], start_year: 2000, end_year: 2001 }),
    "date_sky: a visibility with a body is rejected");
}

// ---------------------------------------------------------------- chart_stability
{
  const iso = "1990-06-10T18:30:00Z";
  const jd = jdFromIso(iso);
  const res = await call("chart_stability", { date: iso, lat: 27.95, lon: -82.46, uncertainty_minutes: 15 });
  const direct = chartStability(eng, jd, { lat: 27.95, lonEast: -82.46, halfWidthSeconds: 900 });
  assert(res.summary.facts === direct.summary.facts && res.summary.stable === direct.summary.stable,
    `chart_stability: summary matches the engine (${JSON.stringify(res.summary)})`);
  assert(res.window.half_width_seconds === 900 && res.window.from_utc === "1990-06-10T18:15:00Z"
    && res.window.to_utc === "1990-06-10T18:45:00Z", `chart_stability: window is the stated time plus and minus 15 minutes (${JSON.stringify(res.window)})`);
  assert(res.stable.length + res.unstable.length === res.summary.facts, "chart_stability: every fact is listed once");
  const kinds = Object.values(res.summary.by_kind);
  assert(kinds.reduce((n, k) => n + k.facts, 0) === res.summary.facts
    && kinds.reduce((n, k) => n + k.stable, 0) === res.summary.stable, "chart_stability: by_kind adds up");
  // each unstable fact's changes are the engine's segment boundaries
  for (const u of res.unstable) {
    const f = direct.facts.find((x) => x.kind === u.kind && x.subject === u.subject);
    assert(f && !f.stable && u.changes.length === f.segments.length - 1, `chart_stability: ${u.kind} ${u.subject} has the engine's changes`);
    assert(u.value === f.value, `chart_stability: ${u.kind} ${u.subject} value at the stated instant`);
    u.changes.forEach((c, i) => {
      assert(c.from === f.segments[i].value && c.to === f.segments[i + 1].value,
        `chart_stability: ${u.kind} ${u.subject} change ${i} goes ${c.from} to ${c.to}`);
      assert(Math.abs(jdFromIso(c.utc) - f.segments[i + 1].from) < 1.5 / 86400, `chart_stability: ${u.kind} ${u.subject} change ${i} instant`);
    });
  }
  // a stable fact is the engine's value
  const sunSign = res.stable.find((x) => x.kind === "sign" && x.subject === "sun");
  assert(sunSign && sunSign.value === SIGNS[Math.floor(eng.longitude("sun", jd) / 30)], "chart_stability: the Sun's sign is the engine's");

  // a date with no time: the angles and every house change, the signs do not
  const day = await call("chart_stability", { date: "1990-06-10T12:00:00Z", lat: 27.95, lon: -82.46, uncertainty_minutes: 720 });
  assert(day.summary.by_kind.angle_sign.stable === 0 && day.summary.by_kind.house.stable === 0, "chart_stability: no angle or house survives a whole day");
  assert(day.summary.by_kind.sign.stable >= day.summary.by_kind.sign.facts - 1, "chart_stability: at most the Moon changes sign in a day");

  // no place: no angles, houses, or sect
  const bare = await call("chart_stability", { date: iso, uncertainty_minutes: 60 });
  assert(!("angle_sign" in bare.summary.by_kind) && !("house" in bare.summary.by_kind) && !("sect" in bare.summary.by_kind),
    "chart_stability: without a place there are no angles, houses, or sect");

  // default window is the delta-T sigma: under a second for a modern date
  const modern = await call("chart_stability", { date: iso, lat: 27.95, lon: -82.46 });
  assert(modern.window.half_width_seconds < 1, `chart_stability: modern default window is under a second (${modern.window.half_width_seconds})`);

  const half = await client.callTool({ name: "chart_stability", arguments: { date: iso, lat: 27.95 } });
  assert(half.isError === true, "chart_stability: lat without lon is rejected");
  const tooWide = await client.callTool({ name: "chart_stability", arguments: { date: iso, uncertainty_minutes: 2000 } });
  assert(tooWide.isError === true, "chart_stability: more than 720 minutes is rejected");
}

// ---------------------------------------------------------------- heliacal
{
  // Sirius at Memphis in 139 CE: the tool's date is the engine's.
  const jd0 = julianDay(139, 1, 1, 0, 0, 0, "julian");
  const res = await call("heliacal", { target: "Sirius", lat: 29.85, lon: 31.25, start_year: 139 });
  assert(res.method === "visibility" && res.atmosphere.extinction === 0.25 && res.atmosphere.spread === 0.05,
    "heliacal: echoes the method and the atmosphere");
  assert(res.events.length === 2 && res.not_found.length === 0, `heliacal: a star has a rising and a setting (${res.events.length})`);
  const rising = res.events.find((e) => e.kind === "morning_first");
  const direct = heliacal(eng, "Sirius", jd0, 29.85, 31.25);
  assert(Math.abs(rising.date.jd - direct.jd) < 1e-4, "heliacal: the rising instant is the engine's");
  assert(rising.date.calendar === "julian" && rising.date.era === "139 CE" && rising.date.month === 7 && rising.date.day === 19,
    `heliacal: Sirius rises on 19 July 139, Julian calendar (${JSON.stringify(rising.date)})`);
  assert(rising.local_date.month === 7 && rising.local_date.day === 19, "heliacal: the local date is given");
  assert(rising.earliest.jd <= rising.date.jd && rising.date.jd <= rising.latest.jd, "heliacal: the window brackets the date");
  assert(rising.window_days === localDay(direct.latest, 31.25) - localDay(direct.earliest, 31.25),
    `heliacal: window_days counts local days (${rising.window_days})`);
  assert(rising.margin > 0 && rising.altitude > 0 && rising.sun_altitude < 0 && rising.azimuth < 180,
    "heliacal: seen in the east with the Sun down");
  assert(Math.abs(rising.arcus_visionis - direct.arcusVisionis) < 0.06, "heliacal: the implied arcus visionis is the engine's");
  assert(res.events[0].date.jd <= res.events[1].date.jd, "heliacal: events are in date order");

  // the implied arcus visionis, fed to the geometric method, lands on the same day
  const arcus = await call("heliacal", {
    target: "Sirius", lat: 29.85, lon: 31.25, start_year: 139, kind: "heliacal_rising",
    method: "arcus", arcus_visionis: direct.arcusVisionis - 1e-6,
  });
  assert(arcus.events.length === 1 && arcus.events[0].kind === "morning_first" && arcus.events[0].method === "arcus"
    && arcus.arcus_visionis !== undefined && arcus.atmosphere === undefined,
    "heliacal: the arcus method reports its angle and no atmosphere");
  assert(arcus.events[0].local_date.day === 19 && arcus.events[0].earliest === undefined,
    "heliacal: the arcus method lands on the same day and has no window");

  // Venus has all four; in date order from the start
  const venus = await call("heliacal", { target: "venus", lat: 32.54, lon: 44.42, start_year: 2020 });
  assert(venus.events.length === 4 && new Set(venus.events.map((e) => e.kind)).size === 4, "heliacal: Venus has four events");
  for (const e of venus.events) {
    const d = heliacal(eng, "venus", julianDay(2020, 1, 1), 32.54, 44.42, { kind: e.kind });
    assert(Math.abs(e.date.jd - d.jd) < 1e-4, `heliacal: venus ${e.kind} is the engine's`);
  }
  const el = venus.events.find((e) => e.kind === "evening_last");
  const mf = venus.events.find((e) => e.kind === "morning_first");
  assert(mf.date.jd - el.date.jd > 0 && mf.date.jd - el.date.jd < 30, "heliacal: Venus's inferior conjunction hides it for under a month");

  // outer planets gain the opposition events under the arcus method
  const jup = await call("heliacal", { target: "jupiter", lat: 32.54, lon: 44.42, start_year: 2020, method: "arcus", arcus_visionis: 7 });
  assert(jup.events.length === 4 && jup.events.some((e) => e.kind === "acronychal_rising")
    && jup.events.some((e) => e.kind === "cosmical_setting"), "heliacal: the arcus method adds the opposition events");
  assert(jup.events.every((e) => e.sun_depression >= 7), "heliacal: the Sun is at least the arcus down");

  // the Moon: Yallop's test
  const moon = await call("heliacal", { target: "moon", lat: 21.42, lon: 39.83, start_year: 2025, start_month: 3, start_day: 1 });
  const ef = moon.events.find((e) => e.kind === "evening_first");
  assert(moon.method === "crescent" && moon.atmosphere === undefined && moon.events.length === 2, "heliacal: the Moon has two events by the crescent test");
  assert(ef.method === "crescent" && ef.q > -0.014 && ["A", "B"].includes(ef.zone) && ef.lag_minutes > 20,
    `heliacal: the new crescent passes Yallop's test (${JSON.stringify(ef)})`);
  assert(ef.date.year === 2025 && ef.date.month === 3 && ef.date.day === 1, "heliacal: the crescent of 1 March 2025 at Mecca");

  // a circumpolar star has no heliacal events; they are listed, not dropped
  const polaris = await call("heliacal", { target: "Polaris", lat: 51.5, lon: -0.12, start_year: 2020 });
  assert(polaris.events.length === 0 && polaris.not_found.length === 2, "heliacal: a star that never sets has none");

  // an ancient date and a Julian stamp
  const old = await call("heliacal", { target: "Regulus", lat: 32.54, lon: 44.42, start_year: -599, kind: "morning_first" });
  assert(old.events.length === 1 && old.events[0].date.calendar === "julian" && old.events[0].date.era === "600 BCE",
    `heliacal: Regulus in 600 BCE (${JSON.stringify(old.events[0]?.date)})`);
  assert(old.searched_from.year === -599 && old.searched_from.month === 1 && old.searched_from.day === 1, "heliacal: searched_from is the start date");
  const cd = calendarDate(old.events[0].date.jd, "julian");
  assert(cd.month === old.events[0].date.month && cd.day === old.events[0].date.day, "heliacal: the stamp is the Julian calendar date");

  // refusals
  const bad = async (args) => (await client.callTool({ name: "heliacal", arguments: args })).isError === true;
  assert(await bad({ target: "vulcan_prime", lat: 30, lon: 31, start_year: 2020 }), "heliacal: unknown target rejected");
  assert(await bad({ target: "Sirius", lat: 30, lon: 31, start_year: 2020, method: "arcus" }), "heliacal: arcus without its angle rejected");
  assert(await bad({ target: "moon", lat: 30, lon: 31, start_year: 2020, kind: "morning_first" }), "heliacal: the Moon has no morning first");
  assert(await bad({ target: "jupiter", lat: 30, lon: 31, start_year: 2020, kind: "evening_first" }), "heliacal: Jupiter has no evening first");
  assert(await bad({ target: "Sirius", lat: 30, lon: 31, start_year: 2020, kind: "cosmical_setting" }), "heliacal: opposition events need the arcus method");
  assert(await bad({ target: "Sirius", lat: 30, lon: 31, start_year: -5000 }), "heliacal: a start outside the data is rejected");
  assert(await bad({ target: "Sirius", lat: 30, lon: 31, start_year: 2020, extinction: 3 }), "heliacal: an impossible extinction is rejected");
}

// ------------------------------------------------- chart_facts exotic anchors
// Every anchor kind the tool description names must actually resolve through
// the handler -- these once shipped as documented dead ends (no calendars map,
// no gazetteer), so `narrative` whens and `named` places always fell to
// via:"none".
{
  // Named place through the bundled gazetteer: houses computed at the city.
  const named = await call("chart_facts", {
    date: "1990-06-10T14:30:00Z", place: "Paris, FR",
  });
  assert(named.via === "ephemeris", "chart_facts: named place resolves to a computed chart");
  assert(named.place && Math.abs(named.place.lat - 48.85) < 0.2,
    `chart_facts: gazetteer Paris latitude (${named.place?.lat})`);

  // Narrative when through a caller-supplied calendar map.
  const narrative = await call("chart_facts", {
    when: { kind: "narrative", calendar: "regnal", value: "year 2 of the reign" },
    calendars: { regnal: { "year 2 of the reign": "1990-06-10T14:30:00Z" } },
    lat: 27.95, lon: -82.46,
  });
  assert(narrative.via === "ephemeris", "chart_facts: narrative when resolves through the calendar map");

  // An unmapped narrative value resolves to no instant -- reported, not invented.
  const unmapped = await call("chart_facts", {
    when: { kind: "narrative", calendar: "regnal", value: "year 99" },
    calendars: { regnal: { "year 2": "1990-06-10T14:30:00Z" } },
    lat: 27.95, lon: -82.46,
  });
  assert(unmapped.via !== "ephemeris", "chart_facts: unmapped narrative value does not invent an instant");

  // A fictional place never resolves to coordinates: planetary layer only.
  const fictional = await call("chart_facts", {
    date: "1990-06-10T14:30:00Z",
    where: { kind: "fictional", value: "Minas Tirith" },
    realm: "fictional",
  });
  assert(fictional.via === "ephemeris", "chart_facts: fictional place still computes the planetary layer");
  assert(!fictional.place, "chart_facts: fictional place resolves to no coordinates");
}

// ------------------------------------------- chart_facts latitude constraints
// The compiler path accepts the latitude-aware constraint kinds and reports
// solved latitudes when a body leaves the ecliptic.
{
  const res = await call("chart_facts", {
    realm: "archetypal",
    constraints: [
      { kind: "parallel", a: "venus", b: "jupiter" },
      { kind: "declination", body: "moon", degree: -5 },
      { kind: "aspect", a: "venus", b: "jupiter", angle: 120 },
    ],
  });
  assert(res.via === "compiler", "chart_facts: latitude constraints go through the compiler");
  assert(!res.impossible, "chart_facts: the latitude form is satisfiable");
  assert(res.latitudes && Object.values(res.latitudes).some((v) => v !== 0),
    "chart_facts: solved latitudes are reported when a body leaves the ecliptic");
}

// ----------------------------------------------------- canonical output mode
// output:"canonical" must be integer-only, digest-stable, and equal to the
// engine's own chartDigest for the same inputs (the MCP layer adds nothing).
{
  const args = { date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46, output: "canonical" };
  const res = await call("natal_chart", args);
  assert(res.format === "caelus-canonical" && res.grid === "arcsec",
    "canonical: format + default grid");
  const floats = [];
  (function walk(v, path) {
    if (typeof v === "number" && !Number.isInteger(v)) floats.push(path);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    }
  })(res, "$");
  assert(floats.length === 0, `canonical: no floats anywhere (found ${floats.slice(0, 3)})`);
  const { digest, ...body } = res;
  assert(digest === canonicalDigest(body), "canonical: digest covers the body");
  const c = eng.chart(1990, 6, 10, 14, 30, 0, args.lat, args.lon, "placidus");
  assert(digest === chartDigest(c), "canonical: MCP digest equals engine chartDigest");
  const again = await call("natal_chart", args);
  assert(again.digest === digest, "canonical: digest stable across calls");
  const dms = await call("natal_chart", { ...args, grid: "dms" });
  assert(Array.isArray(dms.bodies.sun.lon) && dms.bodies.sun.lon.length === 3,
    "canonical: dms grid renders [deg,min,sec] triples");
  assert(dms.digest !== digest, "canonical: the grid is bound into the digest");

  // Sign/house/aspects derive from the quantized values: internal coherence.
  const sun = res.bodies.sun;
  const scale = 3600;
  assert(sun.sign === SIGNS[Math.floor(sun.lon / (30 * scale)) % 12],
    "canonical: sign derives from the quantized longitude");

  // Derived surfaces: parans + returns in canonical form.
  const p = await call("parans", { date: "1990-06-10T00:00:00Z", lat: 27.95, output: "canonical" });
  assert(p.format === "caelus-canonical" && Number.isInteger(p.timeMs)
    && p.parans.every((x) => Number.isInteger(x.timeMs) && Number.isInteger(x.gapCentiMin)),
    "canonical parans: integer instants and gaps");
  const { digest: pd, ...pbody } = p;
  assert(pd === canonicalDigest(pbody), "canonical parans: digest covers the body");
  const r = await call("returns", {
    date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46, body: "sun",
    search_start: "2024-01-01T00:00:00Z", search_end: "2024-12-31T00:00:00Z",
    output: "canonical",
  });
  assert(r.format === "caelus-canonical" && r.returnsMs.every(Number.isInteger)
    && r.chart && r.chart.format === "caelus-canonical",
    "canonical returns: integer instants + canonical return chart");

  // Remainder sets: the optional residual layer. Refinement mode only over
  // MCP (bits is engine-API-only); the sidecar is additive (base digest
  // unchanged), integer-only, digest-bound, and telescopes: compose equals
  // the finer grid computed directly.
  const withRem = await call("natal_chart", { ...args, remainders: "auto" });
  assert(withRem.digest === digest,
    "remainders: requesting the sidecar never changes the base digest");
  const rem = withRem.remainders;
  assert(rem && rem.format === "caelus-remainders" && rem.mode === "refine"
    && rem.remainderGrid === "milliarcsec",
    "remainders: auto over arcsec refines to milliarcsec");
  assert(rem.for === withRem.digest, "remainders: sidecar binds to the payload digest");
  assert(Object.values(rem.values).every((v) => Number.isInteger(v) && 2 * Math.abs(v) <= 1000),
    "remainders: every residue is an integer within half a quantum");
  const { digest: _d2, remainders: _rem2, ...remBase } = withRem;
  const composed = composeRemainders(remBase, rem);
  const fine = await call("natal_chart", { ...args, grid: "milliarcsec" });
  assert(canonicalDigest(composed) === fine.digest,
    "remainders: compose(payload, sidecar) equals the finer-grid chart");
  assert(Array.isArray(nearBoundary(rem)), "remainders: nearBoundary reads the sidecar");
  const acc = await call("natal_chart", { ...args, grid: "accuracy", remainders: "arcsec" });
  assert(acc.remainders.remainderGrid === "arcsec"
    && Object.values(acc.remainders.values).every(Number.isInteger),
    "remainders: explicit arcsec refinement over the accuracy grid");
  let bitsRejected = false;
  try { await call("natal_chart", { ...args, remainders: "bits" }); }
  catch { bitsRejected = true; }
  assert(bitsRejected, "remainders: bits mode is engine-API-only, rejected over MCP");
  const rRem = await call("returns", {
    date: "1990-06-10T14:30:00Z", lat: 27.95, lon: -82.46, body: "sun",
    search_start: "2024-01-01T00:00:00Z", search_end: "2024-12-31T00:00:00Z",
    output: "canonical", remainders: "auto",
  });
  assert(rRem.digest === r.digest,
    "remainders: returns outer digest unchanged by the sidecar");
  assert(rRem.remainders && rRem.remainders.for === rRem.chart.digest,
    "remainders: returns sidecar binds to the inner chart digest");
}

// --------------------------------------------------------- verify_observation
{
  // 1. Unconstrained mode: pure physical ground-truth scene + camera lighting + chronosense
  const iso = "2026-06-21T18:00:00Z";
  const jd = jdFromIso(iso);
  const prevIso = "2026-06-20T22:48:00Z";
  const deadlineIso = "2026-06-21T18:45:00Z";
  const oracleRes = await call("verify_observation", {
    date: iso,
    lat: 40.7128,
    lon: -74.006,
    camera_aim_az_deg: 180,
    camera_aim_alt_deg: 5,
    prev_date: prevIso,
    deadline_date: deadlineIso,
  });
  const directScene = sceneGeometry(eng, jd, 40.7128, -74.006, {
    cameraAimAzDeg: 180,
    cameraAimAltDeg: 5,
    prevJdUt: jdFromIso(prevIso),
    deadlineJdUt: jdFromIso(deadlineIso),
  });
  assert(oracleRes.verdict === "unconstrained" && oracleRes.consistency_score === null
    && oracleRes.checks.length === 0 && oracleRes.diagnostics === null,
    "verify_observation unconstrained: verdict, null score, empty checks, null diagnostics");
  assert(Math.abs(oracleRes.scene.sun.azimuth_deg - directScene.sun.azimuthDeg) < 0.02,
    "verify_observation unconstrained: sun azimuth matches engine");
  assert(Math.abs(oracleRes.scene.sun.altitude_apparent_deg - directScene.sun.altitudeApparentDeg) < 0.02,
    "verify_observation unconstrained: sun apparent altitude matches engine");
  assert(oracleRes.scene.shadow.cast === directScene.shadow.cast
    && Math.abs(oracleRes.scene.shadow.bearing_deg - directScene.shadow.bearingDeg) < 0.02
    && Math.abs(oracleRes.scene.shadow.length_ratio - directScene.shadow.lengthRatio) < 0.002,
    "verify_observation unconstrained: shadow geometry matches engine");
  assert(oracleRes.scene.lighting !== null
    && oracleRes.scene.lighting.glare_risk === directScene.lighting.glareRisk
    && Math.abs(oracleRes.scene.lighting.sun_camera_angle_deg - directScene.lighting.sunCameraAngleDeg) < 0.02,
    "verify_observation unconstrained: camera lighting matches engine");
  assert(oracleRes.scene.moon.phase_name === directScene.moon.phaseName
    && oracleRes.scene.moon.bright_limb_clock === directScene.moon.brightLimbClock
    && Math.abs(oracleRes.scene.moon.illum - directScene.moon.illum) < 0.001,
    "verify_observation unconstrained: moon geometry matches engine");
  assert(oracleRes.scene.chronosense.night_crossed === directScene.chronosense.nightCrossed
    && oracleRes.scene.chronosense.deadline !== null
    && oracleRes.scene.chronosense.deadline.phase === directScene.chronosense.deadline.phase
    && Math.abs(oracleRes.scene.chronosense.deadline.minutes_remaining - 45) < 0.05
    && oracleRes.scene.chronosense.line === directScene.chronosense.line,
    "verify_observation unconstrained: chronosense matches engine");

  // Default-now path: omitting date computes current scene cleanly
  const nowRes = await call("verify_observation", { lat: 40.7128, lon: -74.006 });
  assert(nowRes.verdict === "unconstrained" && typeof nowRes.scene.utc === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z @40\.71,-74\.01/.test(nowRes.scene.chronosense.line),
    `verify_observation default-now: returns unconstrained scene with chronosense line (${nowRes.scene.chronosense.line})`);

  // 2. Authentic scene verification: matches verifyObservation() check-for-check
  const obsAuthentic = {
    shadow_bearing_deg: 41.7537,
    shadow_length_ratio: 0.3966,
    sun_azimuth_deg: 221.7537,
    sun_altitude_deg: 68.3652,
    twilight: "day",
    sun_visible: true,
    moon_visible: true,
    moon_illum: 0.4844,
    moon_waxing: true,
    moon_bright_limb_deg: 71.0737,
    shadow_sweep: { dt_minutes: 30, delta_bearing_deg: 13.4597 },
  };
  const authRes = await call("verify_observation", {
    date: iso, lat: 40.7128, lon: -74.006, observed: obsAuthentic,
  });
  const authDirect = verifyObservation(eng, { jdUt: jd, lat: 40.7128, lonEast: -74.006 }, {
    shadowBearingDeg: 41.7537,
    shadowLengthRatio: 0.3966,
    sunAzimuthDeg: 221.7537,
    sunAltitudeDeg: 68.3652,
    twilight: "day",
    sunVisible: true,
    moonVisible: true,
    moonIllum: 0.4844,
    moonWaxing: true,
    moonBrightLimbDeg: 71.0737,
    shadowSweep: { dtMinutes: 30, deltaBearingDeg: 13.4597 },
  });
  assert(authRes.verdict === authDirect.verdict && authRes.verdict === "consistent",
    `verify_observation authentic: verdict consistent (got ${authRes.verdict})`);
  assert(Math.abs(authRes.consistency_score - authDirect.consistencyScore) < 0.001,
    "verify_observation authentic: consistency score matches engine");
  assert(authRes.checks.length === authDirect.checks.length && authRes.diagnostics === null,
    "verify_observation authentic: check count matches engine and diagnostics null");
  assert(authRes.checks.some((c) => c.field === "shadow_bearing_deg")
    && authRes.checks.some((c) => c.field === "shadow_sweep"),
    "verify_observation authentic: check fields mapped to snake_case");

  // 3. Sloped ground self-shadowing
  const slopeIso = "2026-03-21T22:00:00Z";
  const slopeRes = await call("verify_observation", {
    date: slopeIso, lat: 40.7128, lon: -74.006,
    slope_deg: 25, slope_azimuth_deg: 80,
    observed: { shadow_bearing_deg: 90, shadow_length_ratio: 1.5 },
  });
  assert(slopeRes.scene.shadow.self_shadowed === true && slopeRes.scene.shadow.cast === false
    && slopeRes.verdict === "impossible",
    "verify_observation sloped self-shadowing: flagged self_shadowed and verdict impossible");

  // 4. Counterfactual diagnostics: India half-hour timezone spoof (+5.5h = +330 min)
  const indiaIso = "2026-03-21T10:00:00Z";
  const indiaDirect = verifyObservation(eng, {
    jdUt: jdFromIso(indiaIso), lat: 28.6139, lonEast: 77.209,
  }, { shadowBearingDeg: 302.108, shadowLengthRatio: 1.0137 });
  const indiaRes = await call("verify_observation", {
    date: indiaIso, lat: 28.6139, lon: 77.209,
    observed: { shadow_bearing_deg: 302.108, shadow_length_ratio: 1.0137 },
  });
  assert(indiaRes.verdict === indiaDirect.verdict && indiaRes.diagnostics !== null,
    "verify_observation India spoof: triggers counterfactual diagnostics");
  assert(Math.abs(indiaRes.diagnostics.time_shift.offset_minutes - indiaDirect.diagnostics.timeShift.offsetMinutes) < 0.05
    && Math.abs(Math.abs(indiaRes.diagnostics.time_shift.offset_minutes) - 330) < 15,
    `verify_observation India spoof: recovers ~330 min offset (got ${indiaRes.diagnostics?.time_shift.offset_minutes})`);

  // 5. Southern hemisphere reversed video shadow sweep (Sydney)
  const sydIso = "2026-01-15T02:00:00Z";
  const sydRes = await call("verify_observation", {
    date: sydIso, lat: -33.8688, lon: 151.2093,
    observed: { shadow_sweep: { dt_minutes: 30, delta_bearing_deg: 30.2364 } },
  });
  assert(sydRes.verdict === "inconsistent" || sydRes.verdict === "impossible",
    `verify_observation Sydney reversed sweep: rejected (got ${sydRes.verdict})`);

  // 6. Near-zenith Lahaina noon: shadow bearing indeterminate, no false failure
  const zenRes = await call("verify_observation", {
    date: iso, lat: 23.4373617, lon: -89.5320953,
    observed: { shadow_bearing_deg: 237, shadow_length_ratio: 0.01 },
  });
  assert(zenRes.verdict === "consistent"
    && zenRes.checks.find((c) => c.field === "shadow_bearing_deg")?.status === "indeterminate",
    "verify_observation Lahaina zenith: bearing indeterminate and verdict consistent");
}

// --------------------------------------------------------------- chronolocate
{
  const start = "2026-06-06T18:00:00Z";
  const end = "2026-07-06T18:00:00Z";
  const res = await call("chronolocate", {
    lat: 40.7128,
    lon: -74.006,
    start,
    end,
    observed: {
      shadow_bearing_deg: 41.7537,
      shadow_length_ratio: 0.3966,
      moon_illum: 0.4844,
      moon_waxing: true,
    },
  });
  const direct = chronolocate(eng, { lat: 40.7128, lonEast: -74.006 }, {
    shadowBearingDeg: 41.7537,
    shadowLengthRatio: 0.3966,
    moonIllum: 0.4844,
    moonWaxing: true,
  }, jdFromIso(start), jdFromIso(end));
  assert(res.windows.length === direct.windows.length && res.windows.length >= 1,
    `chronolocate NYC 30d: window count matches engine (${res.windows.length} vs ${direct.windows.length})`);
  assert(res.days_scanned === direct.daysScanned && res.days_pruned === direct.daysPruned && res.days_pruned > 0,
    `chronolocate NYC 30d: pruning counts match engine (scanned=${res.days_scanned}, pruned=${res.days_pruned})`);
  const targetJd = jdFromIso("2026-06-21T18:00:00Z");
  const bestDiffMin = Math.min(...res.windows.map((w) => Math.abs(jdFromIso(w.best_utc) - targetJd) * 1440));
  assert(bestDiffMin < 1.0, `chronolocate NYC 30d: best_utc recovers ground truth within 1 min (${bestDiffMin.toFixed(3)} min)`);
  for (let i = 0; i < direct.windows.length; i++) {
    assert(Math.abs(jdFromIso(res.windows[i].best_utc) - direct.windows[i].bestJd) < 1.5 / 86400,
      `chronolocate NYC 30d: window[${i}] best_utc matches engine`);
    assert(Math.abs(res.windows[i].fit_score - direct.windows[i].fitScore) < 0.001,
      `chronolocate NYC 30d: window[${i}] fit_score matches engine`);
  }

  // Refusals: inverted range, >370d range, empty constraints
  const bad = async (args) => (await client.callTool({ name: "chronolocate", arguments: args })).isError === true;
  assert(await bad({ lat: 40.7, lon: -74, start: end, end: start, observed: { twilight: "day" } }),
    "chronolocate: end <= start rejected");
  assert(await bad({ lat: 40.7, lon: -74, start: "2025-01-01T00:00:00Z", end: "2027-01-01T00:00:00Z", observed: { twilight: "day" } }),
    "chronolocate: >370d range rejected");
  assert(await bad({ lat: 40.7, lon: -74, start, end, observed: {} }),
    "chronolocate: empty observed rejected");
}

// ------------------------------------------------------------------ geolocate
{
  // Path A: analytical closed-form celestial navigation fix (NYC shadow)
  const iso = "2026-06-21T18:00:00Z";
  const jd = jdFromIso(iso);
  const ana = await call("geolocate", {
    date: iso,
    observed: { shadow_bearing_deg: 41.7537, shadow_length_ratio: 0.3966 },
  });
  const anaDirect = geolocate(eng, jd, { shadowBearingDeg: 41.7537, shadowLengthRatio: 0.3966 });
  assert(ana.method === "analytical" && anaDirect.method === "analytical",
    "geolocate analytical: method is analytical");
  assert(ana.candidates.length === anaDirect.candidates.length && ana.candidates.length >= 1,
    "geolocate analytical: candidate count matches engine");
  assert(Math.abs(ana.candidates[0].lat - 40.7128) < 0.05 && Math.abs(ana.candidates[0].lon - (-74.006)) < 0.05,
    `geolocate analytical: recovers NYC (${ana.candidates[0].lat}, ${ana.candidates[0].lon})`);
  assert(Math.abs(ana.candidates[0].lat - anaDirect.candidates[0].lat) < 0.001
    && Math.abs(ana.candidates[0].lon - anaDirect.candidates[0].lon) < 0.001
    && Math.abs(ana.subsolar.lat - anaDirect.subsolar.lat) < 0.001
    && Math.abs(ana.sublunar.lon - anaDirect.sublunar.lon) < 0.001,
    "geolocate analytical: coordinates and subsolar/sublunar match engine");

  // Path B: spherical grid with antimeridian wrap (Fiji Sun + Moon altitude)
  const fijiIso = "2026-06-21T02:00:00Z";
  const fijiJd = jdFromIso(fijiIso);
  const grid = await call("geolocate", {
    date: fijiIso,
    observed: {
      sun_altitude_deg: 40.5413,
      moon_altitude_deg: 36.2613,
      tolerances: { sun_altitude_deg: 1.5, moon_altitude_deg: 1.5 },
    },
  });
  const gridDirect = geolocate(eng, fijiJd, {
    sunAltitudeDeg: 40.5413,
    moonAltitudeDeg: 36.2613,
    tolerances: { sunAltitudeDeg: 1.5, moonAltitudeDeg: 1.5 },
  });
  assert(grid.method === "grid" && grid.candidates.length === gridDirect.candidates.length && grid.candidates.length >= 1,
    "geolocate grid Fiji: method and candidate count match engine");
  assert(Math.abs(grid.candidates[0].lat - gridDirect.candidates[0].lat) < 0.001
    && Math.abs(grid.candidates[0].lon - gridDirect.candidates[0].lon) < 0.001,
    "geolocate grid Fiji: top candidate matches engine");

  // Refusals: empty observed, inverted lat bounds
  const bad = async (args) => (await client.callTool({ name: "geolocate", arguments: args })).isError === true;
  assert(await bad({ date: iso, observed: {} }), "geolocate: empty observed rejected");
  assert(await bad({ date: iso, lat_min: 30, lat_max: 10, observed: { twilight: "day" } }),
    "geolocate: lat_min >= lat_max rejected");
}

// ------------------------------------------------------------ chronosense_tick
{
  const iso = "2026-11-22T14:30:00Z";
  const prevIso = "2026-11-21T23:00:00Z";
  const deadlineIso = "2026-11-22T15:15:00Z";
  const tick = await call("chronosense_tick", {
    date: iso,
    lat: 40.7128,
    lon: -74.006,
    turn: 14,
    prev_date: prevIso,
    deadline_date: deadlineIso,
    deadline_label: "ship_pr",
  });
  const jd = jdFromIso(iso);
  const prevJd = jdFromIso(prevIso);
  const deadlineJd = jdFromIso(deadlineIso);
  const directEnv = chronosenseEnvelope(eng, jd, 40.7128, -74.006, {
    turn: 14,
    prevJdUt: prevJd,
    deadlineJdUt: deadlineJd,
    deadlineLabel: "ship_pr",
  });
  const directScene = sceneGeometry(eng, jd, 40.7128, -74.006, {
    prevJdUt: prevJd,
    deadlineJdUt: deadlineJd,
  });
  const directVec = photoperiodVector(directScene);
  const directStratum = phaseStratumKey(directScene, -74.006);

  assert(tick.envelope.clockId === directEnv.clockId && tick.envelope.chartDigest === directEnv.chartDigest,
    "chronosense_tick NYC: clockId and chartDigest match engine");
  assert(tick.header === directEnv.header && tick.envelope.header === directEnv.header,
    "chronosense_tick NYC: header matches engine");
  assert(tick.envelope.turn === 14 && tick.envelope.nightCrossed === true,
    "chronosense_tick NYC: turn=14 and nightCrossed=true across local solar midnight");
  assert(tick.envelope.deadlineLabel === "ship_pr" && tick.envelope.deadlineState === "applying"
    && Math.abs(tick.envelope.deadlineEtaMin - 45) < 0.01,
    "chronosense_tick NYC: deadline metadata matches engine");
  assert(tick.envelope.wavefrontQuadrant === directEnv.wavefrontQuadrant
    && tick.envelope.twilight === directEnv.twilight
    && tick.envelope.daySlot === directEnv.daySlot,
    "chronosense_tick NYC: wavefrontQuadrant, twilight, and daySlot match engine");
  assert(Math.abs(tick.envelope.sunAltDeg - directEnv.sunAltDeg) < 1e-3
    && Math.abs(tick.envelope.moonIllumPct - directEnv.moonIllumPct) < 1e-3,
    "chronosense_tick NYC: sunAltDeg and moonIllumPct match engine");
  assert(tick.photoperiodVector.length === 10
    && tick.photoperiodVector.every((v, i) => Math.abs(v - directVec[i]) < 1e-5),
    "chronosense_tick NYC: 10-D photoperiodVector matches engine");
  assert(tick.phaseStratumKey === directStratum,
    `chronosense_tick NYC: phaseStratumKey matches engine (${tick.phaseStratumKey} vs ${directStratum})`);

  // Polar night regime (Svalbard in December)
  const polar = await call("chronosense_tick", {
    date: "2026-12-21T12:00:00Z", lat: 78.2232, lon: 15.6267, turn: 2,
  });
  assert(polar.envelope.daySlot === "polar_night" && polar.envelope.horizonEvent === null
    && polar.header.includes("next_sky=polar"),
    "chronosense_tick Svalbard polar night: safe polar fallback");
}

// --------------------------------------------------- audit_chronosense_cursor
{
  const iso = "2026-11-22T14:30:00Z";
  const prevIso = "2026-11-21T23:00:00Z";
  const deadlineIso = "2026-11-22T15:15:00Z";
  const tick = await call("chronosense_tick", {
    date: iso,
    lat: 40.7128,
    lon: -74.006,
    turn: 14,
    prev_date: prevIso,
    deadline_date: deadlineIso,
    deadline_label: "ship_pr",
  });

  // 1. Clean cursor audited against passed envelope object
  const validCursor = {
    clock_id: tick.envelope.clockId,
    turn: 14,
    night_crossed_ack: true,
    deadline_eta_min: 45,
    cited_facts: {
      sun_alt_deg: tick.envelope.sunAltDeg,
      twilight: tick.envelope.twilight,
    },
  };
  const passRes = await call("audit_chronosense_cursor", {
    envelope: tick.envelope,
    cursor: validCursor,
  });
  assert(passRes.ok === true && passRes.driftFlags.length === 0 && passRes.correctivePrompt === null,
    "audit_chronosense_cursor: valid cursor against envelope passes");

  // 2. Recompute mode (no envelope passed): clean cursor passes
  const passRecompute = await call("audit_chronosense_cursor", {
    date: iso,
    lat: 40.7128,
    lon: -74.006,
    turn: 14,
    prev_date: prevIso,
    deadline_date: deadlineIso,
    deadline_label: "ship_pr",
    cursor: validCursor,
  });
  assert(passRecompute.ok === true && passRecompute.driftFlags.length === 0,
    "audit_chronosense_cursor: valid cursor in recompute mode passes");

  // 3. Multi-drift rejection matches engine auditChronosenseCursor exactly
  const badCursor = {
    clock_id: "00000000",
    turn: 13,
    night_crossed_ack: false,
    deadline_eta_min: 10,
    cited_facts: { sun_alt_deg: -40, hallucinated_key: 1 },
  };
  const failRes = await call("audit_chronosense_cursor", {
    date: iso,
    lat: 40.7128,
    lon: -74.006,
    turn: 14,
    prev_date: prevIso,
    deadline_date: deadlineIso,
    deadline_label: "ship_pr",
    cursor: badCursor,
  });
  const directEnv = chronosenseEnvelope(eng, jdFromIso(iso), 40.7128, -74.006, {
    turn: 14,
    prevJdUt: jdFromIso(prevIso),
    deadlineJdUt: jdFromIso(deadlineIso),
    deadlineLabel: "ship_pr",
  });
  const directFail = auditChronosenseCursor(directEnv, badCursor);
  assert(failRes.ok === false && JSON.stringify(failRes.driftFlags) === JSON.stringify(directFail.driftFlags),
    `audit_chronosense_cursor: driftFlags match engine (${JSON.stringify(failRes.driftFlags)})`);
  assert(failRes.correctivePrompt === directFail.correctivePrompt && typeof failRes.correctivePrompt === "string",
    "audit_chronosense_cursor: correctivePrompt matches engine");

  // 4. Refusal when neither envelope nor date/lat/lon is given
  const missingCtx = await client.callTool({
    name: "audit_chronosense_cursor",
    arguments: { cursor: validCursor },
  });
  assert(missingCtx.isError === true, "audit_chronosense_cursor: missing envelope and date/lat/lon rejected");
}

// ------------------------------------------------------------------- prompts
{
  const list = await client.listPrompts();
  const names = new Set(list.prompts.map((p) => p.name));
  for (const name of ["rectification_session", "natal_reading", "chronosense_agent_header", "forensic_observation_loop"]) {
    assert(names.has(name), `prompts: ${name} listed`);
  }
  const chronoP = await client.getPrompt({
    name: "chronosense_agent_header",
    arguments: { role: "release engineer", deadline_label: "deploy", require_cited_facts: "true" },
  });
  const chronoText = chronoP.messages[0].content.text;
  assert(chronoText.includes("[CAELUS-CHRONO") && chronoText.includes("audit_chronosense_cursor")
    && chronoText.includes("deploy") && chronoText.includes("cited_facts"),
    "prompts: chronosense_agent_header renders cursor & header instructions");

  const forenP = await client.getPrompt({
    name: "forensic_observation_loop",
    arguments: {
      claimed_date: "2026-07-04T19:30:00Z",
      claimed_lat: "40.7128",
      claimed_lon: "-74.006",
      observations: "shadow bearing 71.8 deg, ratio 0.73",
    },
  });
  const forenText = forenP.messages[0].content.text;
  assert(forenText.includes("verify_observation") && forenText.includes("chronolocate")
    && forenText.includes("geolocate"),
    "prompts: forensic_observation_loop includes 3-step verification workflow");
}

await client.close();
console.log(`\n${checks} checks, ${failures} failures`);

if (process.env.CAELUS_STATS_OUT) {
  writeFileSync(process.env.CAELUS_STATS_OUT, JSON.stringify({
    suite: "mcp",
    checks,
    failures,
    generatedAt: new Date().toISOString(),
  }, null, 2) + "\n");
}

process.exit(failures ? 1 : 0);
