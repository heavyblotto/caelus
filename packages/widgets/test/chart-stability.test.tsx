/**
 * chart-stability checks: the form's state becomes the right call, a sliced
 * scan matches one direct chartStability call (same facts, values, and
 * changes, with the instants agreeing to the scan's own resolution), runs cut
 * by a slice boundary are stitched back, a fact a slice does not mention gets
 * a null run, the names read correctly, the generated call is the call that
 * was run, and the instrument renders its Workbench tiles at rest.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, chartStability, julianDay, type StabilityFact, type StabilityResult } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import {
  baseOptions, changesOf, emptyScan, factLabel, foldStability, halfWidthOf,
  jdOfQuery, kindLabel, mergeSegments, queryOk, returnedSource, scanStability,
  STABILITY_DEFAULT, STABILITY_PLACES, STABILITY_WINDOWS, stabilitySource,
  statedText, subjectLabel, timeText, trackLabel, valueAt, valueLabel,
  type StabilityQuery,
} from "../src/chart-stability.js";
import { ChartStability } from "../src/chart-stability-widget.js";

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

// the form's state as a call
{
  const q = STABILITY_DEFAULT;
  assert(jdOfQuery(q) === julianDay(1990, 6, 10, 18, 30), "the stated instant is the UT date and time");
  assert(halfWidthOf(q) === 3600 && halfWidthOf({ ...q, window: "day" }) === 43200, "windows are half-widths in seconds");
  const o = baseOptions(q);
  assert(o.lat === 27.95 && o.lonEast === -82.46 && o.houseSystem === "placidus" && o.zodiac === "tropical", "place, houses, zodiac");
  const bare = baseOptions({ ...q, place: null });
  assert(bare.lat === undefined && bare.lonEast === undefined && bare.houseSystem === undefined, "no place: no lat, lon, or house system");
  assert(queryOk(q) && !queryOk({ ...q, month: 13 }) && !queryOk({ ...q, hour: Number.NaN }), "a query needs a real date and time");
  assert(!queryOk({ ...q, place: { lat: 91, lonEast: 0 } }) && queryOk({ ...q, place: null }), "a place must be on the globe; no place is fine");
  assert(STABILITY_WINDOWS.length === 5 && STABILITY_PLACES.length === 4, "five windows and four preset places");
}

/** Compare a stitched scan with one direct call. `edge` is the tolerance on
 *  the instants of change, in days. */
function sameAsDirect(label: string, facts: StabilityFact[], direct: StabilityResult, edge: number): void {
  assert(facts.length === direct.facts.length, `${label}: ${facts.length} facts vs ${direct.facts.length}`);
  let worst = 0;
  for (let i = 0; i < Math.min(facts.length, direct.facts.length); i++) {
    const a = facts[i];
    const b = direct.facts[i];
    const id = `${label}: ${b.kind} ${b.subject}`;
    assert(a.kind === b.kind && a.subject === b.subject, `${id}: same fact in the same place`);
    assert(a.value === b.value && a.stable === b.stable, `${id}: same stated value and stability`);
    assert(a.segments.length === b.segments.length, `${id}: ${a.segments.length} runs vs ${b.segments.length}`);
    for (let j = 0; j < Math.min(a.segments.length, b.segments.length); j++) {
      assert(a.segments[j].value === b.segments[j].value, `${id}: run ${j} has the same value`);
      worst = Math.max(worst,
        Math.abs(a.segments[j].from - b.segments[j].from), Math.abs(a.segments[j].to - b.segments[j].to));
    }
    assert(Math.abs(a.share - b.share) < 2 * edge / (direct.to - direct.from) + 1e-9, `${id}: share`);
  }
  assert(worst <= edge, `${label}: instants agree within ${(edge * 86400).toFixed(2)} s (worst ${(worst * 86400).toFixed(3)} s)`);
}

// a sliced scan matches one direct call
{
  for (const window of ["15m", "1h", "6h", "day"] as const) {
    for (const place of [STABILITY_DEFAULT.place, null]) {
      const q: StabilityQuery = { ...STABILITY_DEFAULT, window, place };
      const direct = chartStability(eng, jdOfQuery(q), { ...baseOptions(q), halfWidthSeconds: halfWidthOf(q) });
      const scan = await scanStability(eng, q, { yieldFn: immediate });
      const label = `${window}${place ? "" : ", no place"}`;
      assert(scan.done && scan.jdDone === scan.to, `${label}: the scan runs to the end of the window`);
      assert(scan.summary.facts === direct.summary.facts && scan.summary.stable === direct.summary.stable,
        `${label}: ${scan.summary.stable} of ${scan.summary.facts} hold vs ${direct.summary.stable} of ${direct.summary.facts}`);
      assert(Math.abs(scan.from - direct.from) < 1e-9 && Math.abs(scan.to - direct.to) < 1e-9, `${label}: same window`);
      // A slice and the whole window can sample different instants before
      // bisecting, so the instants of change agree to the bisection's
      // resolution, a little under a second.
      sameAsDirect(label, scan.facts, direct, 1.5 * SECOND);
    }
  }
  // the slice length does not change what is found
  const q: StabilityQuery = { ...STABILITY_DEFAULT, window: "6h" };
  const direct = chartStability(eng, jdOfQuery(q), { ...baseOptions(q), halfWidthSeconds: halfWidthOf(q) });
  for (const sliceSeconds of [1200, 5400, 100000]) {
    const scan = await scanStability(eng, q, { sliceSeconds, yieldFn: immediate });
    sameAsDirect(`6h in slices of ${sliceSeconds} s`, scan.facts, direct, 1.5 * SECOND);
  }
}

// the numbers the guide quotes hold on the embedded tier
{
  const quarter = await scanStability(eng, { ...STABILITY_DEFAULT, window: "15m" }, { yieldFn: immediate });
  assert(quarter.summary.facts === 61 && quarter.summary.stable === 60, `±15 min: 60 of 61 (${quarter.summary.stable} of ${quarter.summary.facts})`);
  const moved = quarter.facts.filter((f) => !f.stable);
  assert(moved.length === 1 && moved[0].kind === "house" && moved[0].subject === "true_node", "the one that moves is the true node's house");
  const ch = changesOf(quarter.facts);
  assert(ch.length === 1 && ch[0].from === 5 && ch[0].to === 4 && timeText(ch[0].jd) === "18:43", `it goes from the fifth to the fourth at 18:43 UT (${timeText(ch[0].jd)})`);
  const day = await scanStability(eng, { ...STABILITY_DEFAULT, window: "day" }, { yieldFn: immediate });
  assert(day.summary.facts === 64 && day.summary.stable === 42, `the whole day: 42 of 64 (${day.summary.stable} of ${day.summary.facts})`);
  assert(day.facts.filter((f) => f.kind === "sign").every((f) => f.stable), "every body keeps its sign all day");
  assert(day.facts.filter((f) => f.kind === "house").every((f) => !f.stable), "every house placement changes");
  const times = changesOf(day.facts).map((c) => c.jd);
  assert(times.every((t, i) => i === 0 || times[i - 1] <= t), "changes come back in time order");
}

// progress and cancellation
{
  let calls = 0;
  let lastDone = 0;
  const q: StabilityQuery = { ...STABILITY_DEFAULT, window: "6h" };
  const s = await scanStability(eng, q, {
    yieldFn: immediate,
    onProgress: (x) => { calls++; assert(x.jdDone > lastDone, "progress moves forward"); lastDone = x.jdDone; },
  });
  assert(calls === 12 && s.done, `twelve hours in hourly slices report twelve times (${calls})`);
  let n = 0;
  const cut = await scanStability(eng, q, { yieldFn: immediate, cancelled: () => ++n > 3 });
  assert(!cut.done && cut.jdDone < cut.to && cut.facts.length > 0, "a cancelled scan stops partway and keeps what it has");
}

// stitching
{
  const merged = mergeSegments([
    { value: "Leo", from: 0, to: 1 }, { value: "Leo", from: 1, to: 2 }, { value: "Virgo", from: 2, to: 3 },
  ]);
  assert(JSON.stringify(merged) === JSON.stringify([{ value: "Leo", from: 0, to: 2 }, { value: "Virgo", from: 2, to: 3 }]),
    "runs that meet with one value are joined");
  assert(valueAt(merged, 1.5) === "Leo" && valueAt(merged, 2.5) === "Virgo" && valueAt(merged, 3) === "Virgo", "valueAt reads a run");

  const fact = (subject: string, segments: StabilityFact["segments"]): StabilityFact => ({
    kind: "aspect", subject, value: segments[0].value, stable: segments.length === 1, share: 1, segments,
  });
  // window 0..2, stated instant 1; the pair is in aspect only in the second slice
  let acc = emptyScan(1, 86400);
  acc = foldStability(acc, {
    jdUt: 0.5, from: 0, to: 1, halfWidthSeconds: 43200,
    facts: [fact("sun-moon", [{ value: "trine", from: 0, to: 1 }])], summary: { facts: 1, stable: 1 },
  }, 1);
  acc = foldStability(acc, {
    jdUt: 1.5, from: 1, to: 2, halfWidthSeconds: 43200,
    facts: [
      fact("sun-moon", [{ value: "trine", from: 1, to: 2 }]),
      fact("sun-mars", [{ value: null, from: 1, to: 1.4 }, { value: "square", from: 1.4, to: 2 }]),
    ],
    summary: { facts: 2, stable: 1 },
  }, 2);
  const trine = acc.facts.find((f) => f.subject === "sun-moon")!;
  const square = acc.facts.find((f) => f.subject === "sun-mars")!;
  assert(acc.done && trine.stable && trine.segments.length === 1 && trine.segments[0].to === 2,
    "a run cut by a slice boundary comes back whole");
  assert(square.segments.length === 2 && square.segments[0].value === null && square.segments[0].from === 0
    && square.segments[0].to === 1.4, "a fact first seen in a later slice has no value before it");
  assert(square.value === null && Math.abs(square.share - 0.7) < 1e-12 && !square.stable,
    "its stated value and share come from the stitched runs");
  assert(acc.summary.facts === 2 && acc.summary.stable === 1, "the summary counts the stitched facts");
  assert(acc.facts[0].subject === "sun-moon", "pairs keep the engine's order");
}

// names and times
{
  assert(factLabel({ kind: "house", subject: "true_node" }) === "True node house", "fact label for a house");
  assert(factLabel({ kind: "angle_sign", subject: "asc" }) === "Ascendant sign" && factLabel({ kind: "sect", subject: "chart" }) === "Sect", "fact labels for angles and sect");
  assert(factLabel({ kind: "aspect", subject: "sun-moon" }) === "Sun and Moon", "fact label for a pair");
  assert(subjectLabel("mc") === "Midheaven" && subjectLabel("jupiter") === "Jupiter", "subject labels");
  assert(valueLabel("house", 5) === "house 5" && valueLabel("retrograde", true) === "retrograde"
    && valueLabel("retrograde", false) === "direct" && valueLabel("aspect", null) === "no aspect"
    && valueLabel("sign", "Leo") === "Leo" && valueLabel("sect", "day") === "day", "value labels");
  assert(trackLabel("house", 5) === "5" && trackLabel("sign", "Leo") === "Leo" && trackLabel("aspect", null) === "no aspect", "inside a track a house is its number");
  assert(kindLabel("retrograde") === "Directions" && kindLabel("angle_sign") === "Angle signs", "kind labels");
  const jd = julianDay(1990, 6, 10, 18, 43, 7);
  assert(timeText(jd) === "18:43" && timeText(jd, { seconds: true }) === "18:43:07", `clock time: ${timeText(jd, { seconds: true })}`);
  assert(timeText(jd, { withDate: true }) === "10 Jun 18:43", `with the date: ${timeText(jd, { withDate: true })}`);
  assert(timeText(julianDay(1990, 6, 10, 23, 59, 59.6), { seconds: true, withDate: true }) === "11 Jun 00:00:00", "rounding rolls into the next day");
  assert(statedText(STABILITY_DEFAULT) === "10 Jun 1990, 18:30 UT", "the stated instant as text");
}

// the generated call
{
  const src = stabilitySource(STABILITY_DEFAULT);
  assert(src.includes("julianDay(1990, 6, 10, 18, 30)") && src.includes("lat: 27.95, lonEast: -82.46,")
    && src.includes("halfWidthSeconds: 3600,"), "the call carries the instant, the place, and the window");
  assert(!src.includes("houseSystem") && !src.includes("zodiac"), "defaults are left out of the call");
  const other = stabilitySource({ ...STABILITY_DEFAULT, place: null, zodiac: "sidereal:lahiri", houseSystem: "koch" });
  assert(!other.includes("lat:") && !other.includes("houseSystem") && other.includes('zodiac: "sidereal:lahiri"'),
    "no place: no lat, lon, or house system, and the zodiac is named");
  assert(stabilitySource({ ...STABILITY_DEFAULT, houseSystem: "koch" }).includes('houseSystem: "koch"'), "a house system other than Placidus is named");
  const scan = await scanStability(eng, STABILITY_DEFAULT, { yieldFn: immediate });
  const ret = returnedSource(scan);
  assert(ret.includes("summary: { facts: 61, stable: 48 }") && ret.includes('kind: "angle_sign", subject: "asc"'), "the returned shape shows the summary and the first fact that changes");
  assert(returnedSource(null).includes("facts: 0"), "the returned shape at rest");
}

// the instrument at rest
{
  const html = renderToStaticMarkup(<ChartStability engine={eng} />);
  for (const id of ["IN", "OUT", "TBL", "HOLD", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(html.includes(`<b>${id}</b>`), `tile ${id} renders`);
  }
  assert(html.includes("Instrument I-02") && html.includes("<h1>Uncertain time</h1>"), "title tile");
  assert(html.includes('value="1990-06-10"') && html.includes('value="18:30"'), "the form opens on the guide's birth");
  assert((html.match(/<option value="(5m|15m|1h|6h|day)"/g) ?? []).length === 5, "five windows on offer");
  assert(html.includes(">Tampa</option>") && html.includes(">No place</option>"), "preset places and a no-place option");
  assert(html.includes("halfWidthSeconds: 3600"), "the call tile shows the opening query");
  assert(!/style="[^"]*(gradient|shadow|radius)/.test(html), "no inline decoration");
  const bare = renderToStaticMarkup(<ChartStability engine={eng} initial={{ ...STABILITY_DEFAULT, place: null }} />);
  assert(!bare.includes('id="cs-lat"') && !bare.includes('id="cs-houses"'), "with no place the latitude, longitude, and house fields are not shown");
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
