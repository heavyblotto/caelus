/**
 * first-visibility checks: the presets reproduce the dates the heliacal
 * guide quotes on the embedded tier, a year's search finds what a direct
 * `heliacal` loop finds, the stretches of invisibility run from each last to
 * the first that follows it, the twilight curve clears zero on the event day
 * and stays under it on the day beside, Yallop's test is run for the evenings
 * around a new Moon, the text reads correctly, the generated call is the
 * call that was run, and the instrument renders its Workbench tiles at rest.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, heliacal, julianDay, localDay, type HeliacalEvent } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { jdOfYear, stampOf } from "../src/sky-dating.js";
import {
  absencesOf, crescentDays, dateText, defaultKind, gapDays, gapsOf, isFirst, isMorning, kindLabel, kindsOf,
  longestAbsence, neverLost, pickEvent, searchVisibility, shortDate, twilightCurve, VISIBILITY_EXTINCTIONS,
  VISIBILITY_PLACES, VISIBILITY_PRESETS, VISIBILITY_SPAN, VISIBILITY_TARGETS,
  visibilityQueryOk, visibilityReturned, visibilitySource, windowText,
  YALLOP_ZONES,
  type VisibilityQuery, type VisibilitySearch,
} from "../src/first-visibility.js";
import { FirstVisibility } from "../src/first-visibility-widget.js";

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
const preset = (id: string) => VISIBILITY_PRESETS.find((p) => p.id === id)!;
const run = (q: VisibilityQuery): Promise<VisibilitySearch> => searchVisibility(eng, q, { yieldFn: immediate });
const day = (jd: number | null | undefined): string => (jd === null || jd === undefined ? "none" : shortDate(jd));
const of = (s: VisibilitySearch, kind: string): HeliacalEvent[] => s.events.filter((e) => e.kind === kind);

// the form
{
  assert(VISIBILITY_PRESETS.length === 3 && VISIBILITY_PRESETS.every((p) => visibilityQueryOk(p.query)), "three presets, each of which runs");
  const names = new Set(eng.starNames());
  assert(VISIBILITY_TARGETS.filter((t) => t.group === "star").every((t) => names.has(t.id)), "every star offered is in the catalog");
  assert(VISIBILITY_TARGETS.filter((t) => t.group === "planet").map((t) => t.id).join() === "mercury,venus,mars,jupiter,saturn", "Mercury to Saturn");
  assert(VISIBILITY_PLACES.slice(0, 3).map((p) => `${p.lat}/${p.lonEast}`).join() === "29.85/31.25,32.54/44.42,37.98/23.73", "Memphis, Babylon, Athens as the task gives them");
  assert(VISIBILITY_EXTINCTIONS[0] === 0.15 && VISIBILITY_EXTINCTIONS.at(-1) === 0.45 && VISIBILITY_EXTINCTIONS.includes(0.25), "extinction from 0.15 to 0.45 with the default among them");
  const q = preset("sirius").query;
  assert(!visibilityQueryOk({ ...q, year: 139.5 }) && !visibilityQueryOk({ ...q, year: VISIBILITY_SPAN.to + 1 })
    && !visibilityQueryOk({ ...q, year: VISIBILITY_SPAN.from - 1 }), "the year is whole and inside the span");
  assert(visibilityQueryOk({ ...q, year: -1500 }) && visibilityQueryOk({ ...q, year: 0 }), "BCE years and the year 0 run");
  assert(!visibilityQueryOk({ ...q, place: { lat: 91, lonEast: 0 } }) && !visibilityQueryOk({ ...q, place: { lat: 0, lonEast: 181 } })
    && !visibilityQueryOk({ ...q, place: { lat: Number.NaN, lonEast: 0 } }), "the place is on the globe");
  assert(!visibilityQueryOk({ ...q, extinction: 0 }), "extinction is positive");
}

// which events a body has
{
  assert(kindsOf("Sirius").join() === "evening_last,morning_first" && kindsOf("mars").join() === "evening_last,morning_first", "a star and an outer planet vanish and return");
  assert(kindsOf("venus").length === 4 && kindsOf("mercury").length === 4, "the inner planets have four events");
  assert(kindsOf("moon").join() === "morning_last,evening_first", "the Moon has a last and a first crescent");
  assert(defaultKind("Sirius") === "morning_first" && defaultKind("venus") === "morning_first" && defaultKind("moon") === "evening_first", "the call opens on the return to visibility");
  assert(kindLabel("morning_first") === "Morning first" && kindLabel("evening_last") === "Evening last", "kinds have short labels");
  assert(isMorning("morning_last") && !isMorning("evening_first") && isFirst("evening_first") && !isFirst("evening_last"), "morning or evening, first or last");
}

const sirius = await run(preset("sirius").query);
const venus = await run(preset("venus").query);
const moon = await run(preset("crescent").query);

// Sirius at Memphis, 139 CE: the guide's opening example
{
  assert(sirius.done && sirius.progress === 1, "a finished search says so");
  assert(sirius.events.length === 2 && sirius.events.map((e) => e.kind).join() === "evening_last,morning_first", "Sirius has one setting and one rising in the year");
  const rising = pickEvent(sirius.events, preset("sirius").pick)!;
  assert(dateText(rising.jd) === "19 Jul 139 CE", `the rising is on 19 July 139 (got ${dateText(rising.jd)})`);
  assert(day(rising.earliest) === "18 Jul" && day(rising.latest) === "20 Jul", "its window is 18 to 20 July");
  assert(windowText(rising) === "18 to 20 Jul", `the window reads "18 to 20 Jul" (got ${windowText(rising)})`);
  assert(stampOf(rising.jd).ut.startsWith("02:34"), `at 02:34 UT (got ${stampOf(rising.jd).ut})`);
  assert(rising.margin!.toFixed(2) === "0.26" && rising.altitude!.toFixed(1) === "4.0"
    && rising.sunAltitude!.toFixed(1) === "-6.0" && rising.arcusVisionis!.toFixed(1) === "9.5", "margin 0.26, altitude 4.0, Sun -6.0, arcus 9.5, as the guide prints");
  const setting = sirius.events[0];
  assert(dateText(setting.jd) === "13 May 139 CE", `the setting is on 13 May (got ${dateText(setting.jd)})`);
  assert(sirius.gaps.length === 1 && sirius.gaps[0][0] === setting.jd && sirius.gaps[0][1] === rising.jd, "one stretch of invisibility, from the setting to the rising");
  assert(gapDays(sirius.gaps[0], 31.25) === 67, `67 days out of sight, 13 May to 19 July (got ${gapDays(sirius.gaps[0], 31.25)})`);
}

// the search is the direct loop
{
  const q = preset("sirius").query;
  const direct = heliacal(eng, "Sirius", julianDay(139, 1, 1, 0, 0, 0, "julian"), q.place.lat, q.place.lonEast)!;
  const mine = sirius.events.find((e) => e.kind === "morning_first")!;
  assert(direct.jd === mine.jd && direct.earliest === mine.earliest && direct.latest === mine.latest, "the search returns the event the guide's call returns");
  assert(sirius.jdStart === jdOfYear(139) && sirius.jdEnd === jdOfYear(140), "the year runs from 1 January to the next");
  assert(sirius.events.every((e) => e.jd >= sirius.jdStart && e.jd < sirius.jdEnd)
    && sirius.outside.every((e) => e.jd < sirius.jdStart || e.jd >= sirius.jdEnd), "events are split into the year and outside it");
  assert(sirius.events.every((e, i, a) => i === 0 || a[i - 1].jd <= e.jd), "events come in time order");
}

// Venus at Babylon, 2025: the guide's four events
{
  assert(day(of(venus, "evening_last")[0]?.jd) === "18 Mar", "Venus is last seen in the evening on 18 March");
  assert(day(of(venus, "morning_first")[0]?.jd) === "24 Mar", "and first seen in the morning on 24 March");
  assert(day(of(venus, "morning_last")[0]?.jd) === "1 Dec", "it is last seen in the morning on 1 December");
  assert(of(venus, "evening_first").length === 0
    && venus.outside.some((e) => e.kind === "evening_first" && dateText(e.jd) === "12 Feb 2026 CE"), "the return to the evening is in February 2026, outside the year");
  assert(venus.gaps.length === 2, `two stretches out of sight (got ${venus.gaps.length})`);
  assert(gapDays(venus.gaps[0], 44.42) === 6, "six days around inferior conjunction, as the guide says");
  assert(venus.gaps[1][1] === venus.jdEnd, "the second runs past the end of the year and is cut there");
  assert(pickEvent(venus.events, preset("venus").pick)?.kind === "morning_first", "the preset opens on the morning first");
  assert(longestAbsence(venus, 44.42) === 73, `the longest absence is measured in full, 1 December to 12 February (got ${longestAbsence(venus, 44.42)})`);
  assert(longestAbsence(sirius, 31.25) === 67, "and for Sirius it is the one inside the year");
}

// the Moon at Mecca, 2025
{
  const first = pickEvent(moon.events, preset("crescent").pick)!;
  assert(dateText(first.jd) === "30 Mar 2025 CE" && first.zone === "A" && Math.round(first.lagMinutes!) === 72, "the crescent of 30 March 2025 is zone A, 72 minutes behind the Sun");
  assert(stampOf(first.jd).ut.startsWith("16:07"), `best seen at 16:07 UT (got ${stampOf(first.jd).ut})`);
  assert(first.method === "crescent" && first.margin === undefined, "the Moon is tested by the crescent method");
  assert(of(moon, "evening_first").length >= 12 && of(moon, "evening_first").length <= 13
    && of(moon, "morning_last").length >= 12 && of(moon, "morning_last").length <= 13, "a crescent each way every month");
  assert(moon.gaps.length >= 12 && moon.gaps.every(([a, b]) => b - a > 0.5 && b - a < 5), "the Moon is lost for one to four days each month");

  const days = crescentDays(eng, preset("crescent").query, first);
  assert(days.length === 6 && days.filter((d) => d.chosen).length === 1, "six evenings, one of them the event's");
  const hit = days.find((d) => d.chosen)!;
  assert(hit.q === first.q && hit.zone === "A" && shortDate(hit.jd) === "30 Mar", "the chosen evening carries the event's q");
  const before = days[days.indexOf(hit) - 1];
  assert(before.zone === "F" && before.q! < -0.293 && shortDate(before.jd) === "29 Mar", "the evening before fails the test in zone F");
  assert(days.slice(days.indexOf(hit) + 1).every((d) => d.q! > hit.q!), "q climbs on the evenings after");
  assert(days.every((d) => d.day === localDay(d.jd, 39.83)), "each bar is labelled by its own local day");

  const last = of(moon, "morning_last")[0];
  const mornings = crescentDays(eng, preset("crescent").query, last);
  assert(mornings.filter((d) => d.chosen).length === 1 && mornings.find((d) => d.chosen)!.q === last.q, "a last crescent is tested morning by morning");
  assert(YALLOP_ZONES.map((z) => z.zone).join("") === "ABCDE" && YALLOP_ZONES[0].above === 0.216 && YALLOP_ZONES[1].above === -0.014, "the zone thresholds are the guide's");
}

// gaps by hand
{
  const ev = (kind: HeliacalEvent["kind"], jd: number, conjunction: number): HeliacalEvent => ({ kind, jd, conjunction } as HeliacalEvent);
  const g = gapsOf([ev("morning_first", 20, 15), ev("evening_last", 10, 15), ev("evening_last", 90, 380)], 0, 100);
  assert(g.length === 2 && g[0][0] === 10 && g[0][1] === 20 && g[1][0] === 90 && g[1][1] === 100, "a last runs to the first around the same conjunction, or to the end");
  assert(gapsOf([ev("evening_last", -30, 0), ev("morning_first", 15, 0.5)], 0, 100)[0][0] === 0, "a gap under way at the start is cut to it");
  assert(gapsOf([ev("morning_last", 10, 11), ev("morning_first", 12, 11), ev("evening_first", 40, 11)], 0, 100)[0][1] === 40, "a morning last waits for the evening first");
  assert(gapsOf([ev("morning_first", 12, 10)], 0, 100).length === 0, "a first alone is no gap");
  const abs = absencesOf([ev("evening_last", 90, 380), ev("morning_first", 20, 15), ev("evening_last", 10, 15)]);
  assert(abs.length === 2 && abs[0][0] === 10 && abs[0][1] === 20 && abs[1][0] === 90 && abs[1][1] === null, "an absence with no return has no end");

  // a star far enough north returns to the morning before it leaves the evening
  const north = [ev("morning_first", 280, 300), ev("evening_last", 350, 300), ev("morning_first", 645, 665)];
  assert(absencesOf(north).length === 0 && gapsOf(north, 0, 365).length === 0, "a return before the last evening is no absence, and the next year's return does not make one");
  assert(neverLost(north) && !neverLost([ev("evening_last", 10, 15), ev("morning_first", 20, 15)]), "such a body is never lost");
}

// Arcturus from 60 degrees north, 2025: never out of sight
{
  const arcturus = await run({ target: "Arcturus", place: { lat: 60, lonEast: 10 }, year: 2025, extinction: 0.25 });
  const first = of(arcturus, "morning_first")[0];
  const last = of(arcturus, "evening_last")[0];
  assert(first !== undefined && last !== undefined && first.jd < last.jd, "Arcturus returns to the morning before it leaves the evening");
  assert(arcturus.gaps.length === 0 && longestAbsence(arcturus, 10) === null && neverLost([...arcturus.events, ...arcturus.outside]), "so the year has no stretch out of sight");
  assert(!neverLost([...sirius.events, ...sirius.outside]) && !neverLost([...venus.events, ...venus.outside]), "Sirius at Memphis and Venus at Babylon are lost for a while");
}

// the twilight of the rising
{
  const q = preset("sirius").query;
  const rising = pickEvent(sirius.events, preset("sirius").pick)!;
  const c = twilightCurve(eng, q, rising);
  assert(c.day.length === 61 && c.beside.length === 61 && c.day[0].minutes === -60 && c.day[60].minutes === 60, "an hour either side, every two minutes");
  assert(c.besideIs === "before", "a first visibility is compared with the day before");
  assert(c.best !== null && c.best > 0 && Math.abs(c.best - rising.margin!) < 0.02, `the event day clears zero by the event's margin (got ${c.best})`);
  assert(c.bestBeside !== null && c.bestBeside < 0, `the day before stays below zero (got ${c.bestBeside})`);
  const mid = c.day[30];
  assert(mid.minutes === 0 && Math.abs(mid.sunAltitude - rising.sunAltitude!) < 0.01 && Math.abs(mid.altitude - rising.altitude!) < 0.01, "the middle sample is the event's own instant");
  assert(c.day[0].sunAltitude < c.day[60].sunAltitude, "the Sun climbs through a morning");
  assert(c.day.some((p) => p.margin === null), "samples with the star below the horizon have no margin");

  const setting = sirius.events[0];
  const s = twilightCurve(eng, q, setting);
  assert(s.besideIs === "after" && s.best! > 0 && s.bestBeside! < 0, "a last visibility is compared with the day after, which fails");
  assert(s.day[0].sunAltitude > s.day[60].sunAltitude, "the Sun sinks through an evening");
}

// a search can be cancelled and reports progress
{
  let seen = 0;
  let last = 0;
  let rising = true;
  await searchVisibility(eng, preset("crescent").query, {
    yieldFn: immediate,
    onProgress: (s) => { seen++; if (s.progress < last) rising = false; last = s.progress; },
  });
  assert(seen >= 24 && rising && last <= 1, "progress is reported after each event and only climbs");
  let n = 0;
  const cut = await searchVisibility(eng, preset("crescent").query, { yieldFn: immediate, cancelled: () => ++n > 3 });
  assert(!cut.done && cut.events.length < moon.events.length && cut.progress < 1, "a cancelled search stops early and says so");
}

// a body with no event
{
  const none = await run({ target: "Canopus", place: { lat: 37.98, lonEast: 23.73 }, year: 2025, extinction: 0.25 });
  assert(none.done && none.events.length === 0 && none.gaps.length === 0, "Canopus has no event from Athens in 2025, and the search still finishes");
}

// text
{
  const jd = julianDay(139, 7, 19, 2, 34, 0, "julian");
  assert(dateText(jd) === "19 Jul 139 CE" && shortDate(jd) === "19 Jul", "dates with and without the year");
  assert(shortDate(julianDay(-1500, 3, 4, 12, 0, 0, "julian")) === "4 Mar", "a BCE date loses its year too");
  const ev = (earliest: number | null, latest: number | null): HeliacalEvent => ({ jd, earliest, latest } as unknown as HeliacalEvent);
  assert(windowText(ev(jd - 1, jd + 1)) === "18 to 20 Jul", "a window inside one month");
  assert(windowText(ev(jd - 20, jd + 1)) === "29 Jun to 20 Jul", "a window across two months");
  assert(windowText(ev(jd, jd)) === "19 Jul", "a window of one day");
  assert(windowText(ev(null, jd)) === "up to 19 Jul" && windowText(ev(jd, null)) === "from 19 Jul" && windowText(ev(null, null)) === "none", "a window missing an end");
}

// the generated call
{
  const src = visibilitySource(preset("sirius").query, "morning_first");
  assert(src.includes("julianDay(139, 1, 1, 0, 0, 0, \"julian\")") && src.includes("heliacal(engine, \"Sirius\", start, 29.85, 31.25);")
    && src.includes("calendarDate(ev.jd, \"julian\")"), "the Sirius call is the guide's call");
  const v = visibilitySource({ ...preset("venus").query, extinction: 0.35 }, "evening_last");
  assert(v.includes("julianDay(2025, 1, 1)") && v.includes("kind: \"evening_last\", extinction: 0.35") && v.includes("calendarDate(ev.jd);"), "kind and extinction are stated when they are not the defaults");
  const m = visibilitySource({ ...preset("crescent").query, extinction: 0.35 }, "evening_first");
  assert(m.includes("kind: \"evening_first\"") && !m.includes("extinction"), "the Moon's call takes no extinction");

  const rising = pickEvent(sirius.events, preset("sirius").pick)!;
  const ret = visibilityReturned(rising);
  assert(ret.includes("kind: \"morning_first\"") && ret.includes("margin: 0.26") && ret.includes("arcusVisionis: 9.5") && ret.includes("extinction: 0.25, spread: 0.05"), "the returned event is printed with its figures");
  const cres = visibilityReturned(pickEvent(moon.events, preset("crescent").pick));
  assert(cres.includes("method: \"crescent\"") && cres.includes("zone: \"A\"") && !cres.includes("margin"), "a crescent prints q, zone, and lag");
  assert(visibilityReturned(null) === "null", "no event prints null");
}

// the instrument at rest
{
  const html = renderToStaticMarkup(<FirstVisibility engine={eng} />);
  assert(html.includes("Instrument I-04") && html.includes("<h1>First visibility</h1>"), "the title tile");
  for (const id of ["IN", "OUT", "TWL", "TBL", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(html.includes(`<b>${id}</b>`), `tile ${id} renders`);
  }
  assert(html.includes("Sirius at Memphis, 139 CE") && html.includes("New crescent at Mecca, March 2025"), "the presets are offered");
  assert(html.includes("value=\"139\"") && html.includes("29.85"), "the form opens on the Sirius preset");
  assert(html.includes("heliacal(engine, &quot;Sirius&quot;, start, 29.85, 31.25)"), "the call tile shows the opening call");
  assert(!html.includes("—"), "no em dash in the instrument's prose");
  assert(!/astrolog|horoscope|natal/i.test(html), "the instrument is framed as astronomy");

  const moonHtml = renderToStaticMarkup(<FirstVisibility engine={eng} initialPreset="crescent" />);
  assert(moonHtml.includes("<b>Q</b>") && !moonHtml.includes("<b>TWL</b>"), "the Moon swaps the twilight tile for the q tile");
  assert(moonHtml.includes("disabled") && moonHtml.includes("takes no extinction"), "and its extinction field is off");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
