/**
 * eclipses checks: a sliced search finds the eclipses one direct call finds,
 * an eclipse near a slice boundary is kept once, the horizon is applied to
 * what a place sees, the figures the guide quotes come back on the embedded
 * tier, a central path traces and plots, a partial eclipse has no path, the
 * text reads correctly, the generated calls are the calls that were run, and
 * the instrument renders its Workbench tiles at rest.
 */
import { renderToStaticMarkup } from "react-dom/server";
import {
  Engine, julianDay, lunarEclipses, solarEclipseLimits, solarEclipses,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { jdOfYear } from "../src/sky-dating.js";
import {
  clockText, contactsText, dateText, defaultEclipseQuery, ECLIPSE_PLACES,
  ECLIPSE_SPAN, eclipseQueryOk, eclipseReturned, eclipseSource, foldEclipses,
  lunarSeen, plotPath, searchEclipses, seenCount, seenText, solarSeen,
  sunAltitude, tracePath,
  type EclipseQuery, type EclipseRow, type EclipseSearch,
} from "../src/eclipses.js";
import { Eclipses } from "../src/eclipses-widget.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

// The instrument runs on the embedded tier in the browser, so the tests do too.
const eng = new Engine(embeddedData);
const immediate = (): Promise<void> => Promise.resolve();
const SECOND = 1 / 86400;
const DALLAS = { lat: 32.78, lonEast: -96.8 };
const NEW_YORK = { lat: 40.71, lonEast: -74.01 };
const LONDON = { lat: 51.51, lonEast: -0.13 };
const SYDNEY = { lat: -33.87, lonEast: 151.21 };

// the form
{
  const q = defaultEclipseQuery(2026);
  assert(q.startYear === 2026 && q.endYear === 2028 && q.kinds === "both", "the opening span is a year and the two after it");
  assert(q.place.lat === ECLIPSE_PLACES[0].lat && ECLIPSE_PLACES.length === 5, "five preset places, the first is the default");
  assert(eclipseQueryOk(q), "the opening query runs");
  assert(!eclipseQueryOk({ ...q, endYear: 2025 }) && !eclipseQueryOk({ ...q, startYear: 2026.5 }), "years are whole and in order");
  assert(!eclipseQueryOk({ ...q, endYear: q.startYear + ECLIPSE_SPAN.maxYears })
    && eclipseQueryOk({ ...q, endYear: q.startYear + ECLIPSE_SPAN.maxYears - 1 }), "at most a hundred years at a time");
  assert(!eclipseQueryOk({ ...q, place: { lat: 95, lonEast: 0 } }) && !eclipseQueryOk({ ...q, startYear: -3000 }), "the place and the years are bounded");
}

// a sliced search finds what one direct call finds
{
  const q: EclipseQuery = { startYear: 2020, endYear: 2039, kinds: "both", place: DALLAS };
  const a = jdOfYear(2020);
  const b = jdOfYear(2040);
  const solar = solarEclipses(eng, a, b).filter((e) => e.tMax >= a && e.tMax < b);
  const lunar = lunarEclipses(eng, a, b).filter((e) => e.tMax >= a && e.tMax < b);
  for (const sliceYears of [1, 2, 7, 50]) {
    const s = await searchEclipses(eng, q, { sliceYears, yieldFn: immediate });
    const gotSolar = s.rows.filter((r) => r.kind === "solar");
    const gotLunar = s.rows.filter((r) => r.kind === "lunar");
    assert(s.done && gotSolar.length === solar.length && gotLunar.length === lunar.length,
      `slices of ${sliceYears} y: ${gotSolar.length} solar and ${gotLunar.length} lunar vs ${solar.length} and ${lunar.length}`);
    let worst = 0;
    gotSolar.forEach((r, i) => {
      assert(r.type === solar[i]?.type, `slices of ${sliceYears} y: solar ${i} type`);
      worst = Math.max(worst, Math.abs(r.tMax - (solar[i]?.tMax ?? 0)));
    });
    gotLunar.forEach((r, i) => {
      assert(r.type === lunar[i]?.type, `slices of ${sliceYears} y: lunar ${i} type`);
      worst = Math.max(worst, Math.abs(r.tMax - (lunar[i]?.tMax ?? 0)));
    });
    assert(worst < 0.5 * SECOND, `slices of ${sliceYears} y: greatest eclipse agrees within half a second (worst ${(worst * 86400).toFixed(4)} s)`);
    assert(s.rows.every((r, i) => i === 0 || s.rows[i - 1].tMax <= r.tMax), `slices of ${sliceYears} y: rows in time order`);
  }
  const onlySolar = await searchEclipses(eng, { ...q, kinds: "solar" }, { yieldFn: immediate });
  const onlyLunar = await searchEclipses(eng, { ...q, kinds: "lunar" }, { yieldFn: immediate });
  assert(onlySolar.rows.length === solar.length && onlySolar.rows.every((r) => r.kind === "solar"), "solar only");
  assert(onlyLunar.rows.length === lunar.length && onlyLunar.rows.every((r) => r.kind === "lunar"), "lunar only");
}

// progress, cancellation, and the join
{
  const q: EclipseQuery = { startYear: 2000, endYear: 2009, kinds: "both", place: DALLAS };
  let calls = 0;
  let last = 0;
  const s = await searchEclipses(eng, q, {
    yieldFn: immediate,
    onProgress: (x) => { calls++; assert(x.jdDone > last, "progress moves forward"); last = x.jdDone; },
  });
  assert(calls === 5 && s.done, `ten years in slices of two report five times (${calls})`);
  let n = 0;
  const cut = await searchEclipses(eng, q, { yieldFn: immediate, cancelled: () => ++n > 2 });
  assert(!cut.done && cut.jdDone < cut.jdEnd && cut.rows.length > 0, "a cancelled search stops partway and keeps what it has");

  const row = (kind: "solar" | "lunar", tMax: number): EclipseRow => (
    kind === "solar" ? s.rows.find((r) => r.kind === "solar")! : s.rows.find((r) => r.kind === "lunar")!
  ) && ({ ...(s.rows.find((r) => r.kind === kind)!), tMax } as EclipseRow);
  const acc: EclipseSearch = { jdStart: 100, jdEnd: 200, jdDone: 150, rows: [row("solar", 149.9)], done: false };
  const next = foldEclipses(acc, [row("solar", 149.9000001), row("lunar", 150.2), row("solar", 205), row("solar", 99)], 200);
  assert(next.rows.length === 2 && next.done, `an eclipse found by two slices is kept once, and ones outside the range are dropped (${next.rows.length})`);
  assert(next.rows[0].kind === "solar" && next.rows[1].kind === "lunar", "a solar and a lunar eclipse near each other are both kept");
}

// what a place sees, with the horizon applied
{
  const [apr2024] = solarEclipses(eng, julianDay(2024, 4, 1), julianDay(2024, 5, 1));
  const dallas = solarSeen(eng, apr2024, DALLAS);
  assert(dallas.seen === "seen" && dallas.type === "total" && Math.abs(dallas.magnitude - 1.056) < 0.001,
    `Dallas sees the 8 April 2024 eclipse total at magnitude 1.056 (${dallas.type} ${dallas.magnitude.toFixed(3)})`);
  assert(clockText(dallas.c2!) === "18:40:45" && clockText(dallas.c3!) === "18:44:41", `totality in Dallas from 18:40:45 to 18:44:41 UT (${clockText(dallas.c2!)} to ${clockText(dallas.c3!)})`);
  assert(dallas.altitude !== null && dallas.altitude > 50, "the Sun is high in Dallas at maximum");
  const ny = solarSeen(eng, apr2024, NEW_YORK);
  assert(ny.seen === "seen" && ny.type === "partial" && Math.abs(ny.magnitude - 0.91) < 0.001, `New York sees it partial at 0.910 (${ny.magnitude.toFixed(3)})`);
  // In Sydney the geometry alone gives a partial eclipse, through the Earth:
  // the Sun is 40° below the horizon there.
  const sydney = solarSeen(eng, apr2024, SYDNEY);
  assert(sydney.type === "partial" && sydney.seen === "below" && sydney.altitude !== null && sydney.altitude < -30,
    `Sydney's eclipse of 8 April 2024 happens with the Sun down (${sydney.seen}, ${sydney.altitude?.toFixed(0)}°)`);
  const sydneyRow: EclipseRow = { kind: "solar", tMax: apr2024.tMax, type: apr2024.type, eclipse: apr2024, local: sydney };
  assert(seenText(sydneyRow) === "not seen, Sun below the horizon" && contactsText(sydneyRow) === "" && seenCount([sydneyRow]) === 0,
    "the table says not seen, gives no contact times, and does not count it");

  // Somewhere the geometry gives an eclipse while the Sun is down. The
  // engine's local circumstances do not know about the horizon; this module
  // does.
  let night = 0;
  let partlyUp = 0;
  for (const e of solarEclipses(eng, julianDay(2020, 1, 1), julianDay(2030, 1, 1))) {
    for (const p of ECLIPSE_PLACES) {
      const got = solarSeen(eng, e, p);
      if (got.seen === "below") {
        night++;
        assert(got.type !== "none" && got.altitude !== null && got.altitude <= 0
          && sunAltitude(eng, got.c1!, p.lat, p.lonEast) <= 0 && sunAltitude(eng, got.c4!, p.lat, p.lonEast) <= 0,
          `${p.label}: an eclipse marked below the horizon has the Sun down at maximum and at both ends`);
      }
      if (got.seen === "partly") {
        partlyUp++;
        assert(got.altitude !== null && got.altitude <= 0, `${p.label}: partly seen means the Sun is down at maximum`);
      }
      if (got.seen === "seen") assert(got.altitude !== null && got.altitude > 0, `${p.label}: seen means the Sun is up at maximum`);
    }
  }
  assert(night > 0, `some eclipse in ten years happens with the Sun down at one of the preset places (${night} below, ${partlyUp} partly)`);

  const [mar2025] = lunarEclipses(eng, julianDay(2025, 3, 1), julianDay(2025, 4, 1));
  assert(mar2025.type === "total" && clockText(mar2025.tMax) === "06:58:41", `the lunar eclipse of 14 March 2025 is total at 06:58:41 UT (${clockText(mar2025.tMax)})`);
  const nyMoon = lunarSeen(eng, mar2025, NEW_YORK);
  const londonMoon = lunarSeen(eng, mar2025, LONDON);
  assert(nyMoon.seen === "seen" && Math.round(nyMoon.altitude) === 44, `the Moon is 44° up in New York (${nyMoon.altitude.toFixed(1)})`);
  assert(londonMoon.seen !== "seen" && Math.round(londonMoon.altitude) === -5, `and 5° below the horizon in London (${londonMoon.altitude.toFixed(1)}, ${londonMoon.seen})`);
  const text = seenText({ kind: "lunar", tMax: mar2025.tMax, type: mar2025.type, eclipse: mar2025, local: nyMoon });
  assert(text === "Moon 44° up", `lunar text: ${text}`);
  assert(seenText({ kind: "lunar", tMax: mar2025.tMax, type: mar2025.type, eclipse: mar2025, local: { seen: "partly", altitude: -0.03 } })
    === "in part, Moon on the horizon at greatest eclipse", "a Moon within half a degree of the horizon is on it");
}

// the opening result
{
  const s = await searchEclipses(eng, defaultEclipseQuery(2026), { yieldFn: immediate });
  const solar = s.rows.filter((r) => r.kind === "solar");
  assert(solar.length === 6 && solar.map((r) => r.type).join(" ") === "annular total annular total annular total",
    `2026 to 2028 holds six solar eclipses, annular and total by turns (${solar.map((r) => r.type).join(" ")})`);
  assert(dateText(solar[1].tMax) === "12 Aug 2026 CE" && clockText(solar[1].tMax) === "17:45:46", `the second is 12 August 2026 at 17:45:46 UT (${dateText(solar[1].tMax)} ${clockText(solar[1].tMax)})`);
  assert(seenCount(s.rows) > 0 && seenCount(s.rows) < s.rows.length, "Madrid sees some of them and not others");
  const aug = solar[1];
  assert(aug.kind === "solar" && aug.local.type === "partial" && aug.local.magnitude > 0.99 && aug.local.magnitude < 1,
    "Madrid is just outside totality on 12 August 2026");
  assert(contactsText(aug).startsWith("begins ") && contactsText(aug).includes("maximum ") && contactsText(aug).includes("ends "), `contact line: ${contactsText(aug)}`);
}

// the central path
{
  const [apr2024] = solarEclipses(eng, julianDay(2024, 4, 1), julianDay(2024, 5, 1));
  const trace = tracePath(eng, apr2024)!;
  assert(trace !== null && trace.points.length > 20, `the 2024 path has ${trace?.points.length} sampled points`);
  assert(Math.abs(trace.widthAtMaxKm! - 198.98) < 0.5, `it is 199 km wide at greatest eclipse (${trace.widthAtMaxKm?.toFixed(2)})`);
  const direct = solarEclipseLimits(eng, apr2024.tMax)!;
  assert(Math.abs(direct.center.lat - 25.3) < 0.05 && Math.abs(direct.center.lonEast - -104.17) < 0.05, "greatest eclipse falls near Torreón");
  assert(Math.abs(trace.greatest.jd - apr2024.tMax) < (apr2024.end - apr2024.begin) / 120, "the greatest sample is the one nearest greatest eclipse");
  assert(trace.points.every((p, i) => i === 0 || Math.abs(p.center[0] - trace.points[i - 1].center[0]) < 90), "longitudes are continuous along the path");
  assert(trace.points.every((p) => !p.north || !p.south || p.north[1] > p.south[1] - 5), "the northern limit lies north of the southern one");

  const plot = plotPath(trace, DALLAS);
  assert(plot.width === 640 && plot.height >= 192 && plot.height <= 640, `plot size ${plot.width} by ${plot.height}`);
  assert(plot.center.split(" ").length === trace.points.length && plot.band.split(" ").length > trace.points.length, "the centre line and the band have a point per sample");
  assert(plot.place !== null && plot.place[0] > 0 && plot.place[0] < plot.width && plot.place[1] > 0 && plot.place[1] < plot.height, "Dallas falls inside the plot");
  assert(plotPath(trace, SYDNEY).place === null && plotPath(trace, null).place === null, "a place off the plot is left out");
  assert(plot.meridians.length >= 2 && plot.meridians.every((m) => /^\d+°[WE]?$/.test(m.label)), `meridian labels: ${plot.meridians.map((m) => m.label).join(" ")}`);
  assert(plot.parallels.length >= 2 && plot.parallels.every((p) => /^\d+°[NS]?$/.test(p.label)), `parallel labels: ${plot.parallels.map((p) => p.label).join(" ")}`);
  assert(plot.greatest[0] > plot.first[0] && plot.greatest[0] < plot.last[0], "greatest eclipse lies between the ends of the path");

  // A path that curls near a pole turns its ground track around, and the
  // engine's north and south limits swap names there. The trace follows each
  // line through the swap, so neither limit jumps across the path.
  const [feb2026] = solarEclipses(eng, julianDay(2026, 2, 1), julianDay(2026, 3, 1));
  const polar = tracePath(eng, feb2026)!;
  assert(feb2026.type === "annular" && polar !== null && polar.greatest.center[1] < -60, "the annular eclipse of 17 February 2026 is central over Antarctica");
  const km = (a: [number, number], b: [number, number]): number =>
    Math.hypot((a[0] - b[0]) * Math.cos(a[1] * Math.PI / 180), a[1] - b[1]);
  let jumps = 0;
  for (let i = 1; i < polar.points.length; i++) {
    const p = polar.points[i - 1];
    const q = polar.points[i];
    if (p.north && p.south && q.north && q.south
      && km(p.north, q.south) + km(p.south, q.north) < km(p.north, q.north) + km(p.south, q.south)) jumps++;
  }
  assert(jumps === 0, `neither limit of the polar path jumps across it (${jumps} jumps)`);

  // a path that crosses the date line stays in one piece
  let crossed = 0;
  for (const e of solarEclipses(eng, julianDay(2020, 1, 1), julianDay(2040, 1, 1))) {
    const t = tracePath(eng, e, 60);
    if (e.type === "partial") { assert(t === null, "a partial eclipse has no central path"); continue; }
    if (!t) continue;
    const lons = t.points.map((p) => p.center[0]);
    if (Math.min(...lons) < -180 || Math.max(...lons) > 180) crossed++;
    assert(t.points.every((p, i) => i === 0 || Math.abs(p.center[0] - t.points[i - 1].center[0]) < 120), "no jump of a whole turn along a path");
    const p = plotPath(t, null);
    assert(Number.isFinite(p.height) && !p.center.includes("NaN"), "every central path plots");
  }
  assert(crossed > 0, `at least one path in twenty years crosses the date line (${crossed})`);
}

// text
{
  assert(clockText(julianDay(2024, 4, 8, 18, 17, 23)) === "18:17:23", "clock time to the second");
  assert(clockText(julianDay(2024, 4, 8, 23, 59, 59.7)) === "23:59:59" && dateText(julianDay(2024, 4, 8, 23, 59, 59.7)) === "8 Apr 2024 CE", "times are cut to the second, so the clock and the date agree at midnight");
  assert(clockText(julianDay(2024, 4, 9, 0, 0, 0.2)) === "00:00:00" && dateText(julianDay(2024, 4, 9, 0, 0, 0.2)) === "9 Apr 2024 CE", "just after midnight is the next day");
  assert(dateText(julianDay(-584, 5, 28, 14, 26, 0, "julian")) === "28 May 585 BCE", `an ancient date reads in the Julian calendar (${dateText(julianDay(-584, 5, 28, 14, 26, 0, "julian"))})`);
}

// the generated calls
{
  const q = defaultEclipseQuery(2026);
  const src = eclipseSource(q);
  assert(src.includes("julianDay(2026, 1, 1)") && src.includes("julianDay(2029, 1, 1)"), "the calls span the years asked for");
  assert(src.includes("solarEclipseLocal(engine, e.tMax, 40.42, -3.7)") && src.includes("lunarEclipseLocal(engine, e.tMax, 40.42, -3.7)"), "and name the place");
  const solarOnly = eclipseSource({ ...q, kinds: "solar" });
  assert(!solarOnly.includes("lunarEclipses") && solarOnly.includes("solarEclipseLimits"), "solar only: no lunar call");
  assert(!eclipseSource({ ...q, kinds: "lunar" }).includes("solarEclipses"), "lunar only: no solar call");
  assert(eclipseSource({ ...q, startYear: -600, endYear: -580 }).includes('julianDay(-600, 1, 1, 0, 0, 0, "julian")'), "years before 1583 use the Julian calendar");
  const s = await searchEclipses(eng, q, { yieldFn: immediate });
  const ret = eclipseReturned(s.rows);
  assert(ret.includes('type: "annular"') && ret.includes("solarEclipseLocal") && ret.includes("lunarEclipseLocal"), "the returned shapes show a solar and a lunar eclipse");
  assert(eclipseReturned([]) === "[]", "the returned shape at rest");
}

// the instrument at rest
{
  const html = renderToStaticMarkup(<Eclipses engine={eng} />);
  for (const id of ["IN", "OUT", "TBL", "PATH", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(html.includes(`<b>${id}</b>`), `tile ${id} renders`);
  }
  assert(html.includes("Instrument I-03") && html.includes("<h1>Eclipses</h1>"), "title tile");
  assert(html.includes('value="2026"') && html.includes('value="2028"'), "at rest the span is a fixed year and the two after it");
  assert(html.includes(">Madrid</option>") && html.includes(">Sydney</option>"), "preset places");
  assert(html.includes("solarEclipses(engine, from, to)"), "the call tile shows the opening query");
  assert(!html.includes("<img") && !/https?:\/\//.test(html), "no images and no addresses in the markup");
  assert(!/style="[^"]*(gradient|shadow|radius)/.test(html), "no inline decoration");
  const other = renderToStaticMarkup(<Eclipses engine={eng} year={1999} />);
  assert(other.includes('value="1999"') && other.includes('value="2001"'), "a host can set the opening year");
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
