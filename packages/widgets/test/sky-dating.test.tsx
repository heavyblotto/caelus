/**
 * sky-dating checks: the form's state becomes the right constraints, a
 * sliced search equals one direct dateSky call (slicing must not add, drop,
 * or split a window), spans cut by a slice boundary are stitched back, the
 * stamps use the calendar that was in use, the generated call is the call
 * that was run, and the instrument renders its Workbench tiles at rest.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Engine, dateSky, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import {
  buildConstraints, callSource, eraYear, foldSlice, jdOfYear, mergeSpans,
  searchSky, signDegree, signsAt, SKY_PRESETS, stampOf, windowText,
  type SkyQuery, type SkySearch,
} from "../src/sky-dating.js";
import { SkyDating } from "../src/sky-dating-widget.js";

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
const babylon = SKY_PRESETS.find((p) => p.id === "babylon")!.query;
const hadrian = SKY_PRESETS.find((p) => p.id === "hadrian")!.query;

// constraints
{
  const c = buildConstraints(babylon);
  assert(c.length === 4, "babylon preset: four constraints");
  assert(JSON.stringify(c[0]) === JSON.stringify({ body: "saturn", sign: "Cancer" }),
    "constraints follow the form's order, slowest first");
  const withPhase = buildConstraints({ ...babylon, phase: "full" });
  assert(JSON.stringify(withPhase[4]) === JSON.stringify({ elongation: ["moon", "sun"], from: 157.5, to: 202.5 }),
    "a phase is an elongation arc of the Moon from the Sun");
  assert(buildConstraints({ ...babylon, signs: {}, phase: null }).length === 0, "nothing set, no constraints");
}

// a sliced search equals one direct call
const immediate = (): Promise<void> => Promise.resolve();
{
  const direct = dateSky(eng, buildConstraints(babylon),
    jdOfYear(babylon.startYear), jdOfYear(babylon.endYear + 1), { keepStages: true });
  for (const sliceYears of [50, 137, 250, 5000]) {
    const s = await searchSky(eng, babylon, { sliceYears, yieldFn: immediate });
    assert(s.done && s.windows.length === direct.windows.length,
      `slices of ${sliceYears} y: ${s.windows.length} windows vs ${direct.windows.length}`);
    for (let i = 0; i < Math.min(s.windows.length, direct.windows.length); i++) {
      assert(Math.abs(s.windows[i][0] - direct.windows[i].start) < 1e-6
        && Math.abs(s.windows[i][1] - direct.windows[i].end) < 1e-6,
        `slices of ${sliceYears} y: window ${i} edges`);
    }
    for (let i = 0; i < direct.funnel.length; i++) {
      assert(s.stages[i].constraint === direct.funnel[i].constraint
        && s.stages[i].spans.length === direct.funnel[i].windows,
        `slices of ${sliceYears} y: stage ${i} has ${s.stages[i].spans.length} spans vs ${direct.funnel[i].windows}`);
      assert(Math.abs(s.stages[i].days - direct.funnel[i].days) < 1e-4, `slices of ${sliceYears} y: stage ${i} days`);
    }
  }
  // the accepted date is inside the 410 BCE window
  const born = julianDay(-409, 4, 29, 18, 0, 0, "julian");
  const s = await searchSky(eng, babylon, { yieldFn: immediate });
  assert(s.windows.some(([a, b]) => a <= born && born <= b), "babylon: 29 April 410 BCE is inside a window");
}

// progress and cancellation
{
  let calls = 0;
  let lastDone = 0;
  const s = await searchSky(eng, babylon, {
    sliceYears: 100, yieldFn: immediate,
    onProgress: (x) => { calls++; assert(x.jdDone > lastDone, "progress moves forward"); lastDone = x.jdDone; },
  });
  assert(calls === 8 && s.done, `eight slices of 100 years report eight times (${calls})`);
  let n = 0;
  const cut = await searchSky(eng, babylon, {
    sliceYears: 100, yieldFn: immediate, cancelled: () => ++n > 3,
  });
  assert(!cut.done && cut.jdDone < cut.jdEnd, "a cancelled search stops partway and says so");
  const empty = await searchSky(eng, { ...babylon, signs: {}, phase: null }, { yieldFn: immediate });
  assert(empty.done && empty.windows.length === 0, "no constraints: finished and empty");
}

// the Hadrian preset on the embedded tier finds 24 January 76 CE
{
  const q: SkyQuery = { ...hadrian, startYear: -200, endYear: 400 };
  const s = await searchSky(eng, q, { yieldFn: immediate });
  const born = julianDay(76, 1, 24, 6, 0, 0, "julian");
  assert(s.windows.length === 1 && s.windows[0][0] <= born && born <= s.windows[0][1],
    `hadrian: one window in 600 years, holding 24 January 76 CE (${s.windows.length})`);
  assert(windowText(s.windows[0][0], s.windows[0][1]) === "24 to 26 Jan 76 CE", `hadrian window text: ${windowText(s.windows[0][0], s.windows[0][1])}`);
}

// stitching
{
  assert(JSON.stringify(mergeSpans([[1, 2], [2, 3], [5, 6]])) === "[[1,3],[5,6]]", "spans that meet are joined");
  assert(JSON.stringify(mergeSpans([[1, 2], [3, 4]])) === "[[1,2],[3,4]]", "spans that do not meet are kept apart");
  const acc: SkySearch = { jdStart: 0, jdEnd: 20, jdDone: 10, done: false, windows: [[8, 10]],
    stages: [{ constraint: 0, label: "x", spans: [[8, 10]], days: 2 }] };
  const next = foldSlice(acc, { windows: [], truncated: false,
    funnel: [{ constraint: 0, label: "x", windows: 1, days: 3, spans: [[10, 13]] }] }, 20);
  assert(JSON.stringify(next.windows) === "[[8,13]]" && next.stages[0].days === 5 && next.done,
    "a window cut by a slice boundary comes back whole");
}

// stamps and text
{
  const a = stampOf(julianDay(-409, 4, 16, 16, 30, 0, "julian"));
  assert(a.calendar === "julian" && a.text === "16 Apr 410 BCE" && a.ut === "16:30", `julian stamp: ${JSON.stringify(a)}`);
  const b = stampOf(julianDay(2026, 11, 11, 23, 59, 50));
  assert(b.calendar === "gregorian" && b.text === "12 Nov 2026 CE" && b.ut === "00:00", `rounding rolls into the next day: ${JSON.stringify(b)}`);
  assert(eraYear(0) === "1 BCE" && eraYear(1) === "1 CE" && eraYear(-2998) === "2999 BCE", "era years");
  assert(signDegree(46.6) === "16°36′" && signDegree(59.9999) === "30°00′", "sign degrees");
  assert(windowText(julianDay(2020, 1, 30), julianDay(2020, 2, 2)) === "30 Jan 2020 CE to 2 Feb 2020 CE", "a window across a month names both");
  const now = signsAt(eng, julianDay(2026, 11, 12, 2, 0, 0));
  assert(now.sun === 7 && now.moon === 8, `signsAt: Sun in Scorpio, Moon in Sagittarius (${now.sun}, ${now.moon})`);
}

// the generated call
{
  const src = callSource(hadrian);
  assert(src.includes('{ body: "saturn", sign: "Capricorn" },') && src.includes("{ pad: 6 }"), "call lists the constraints and the pad");
  assert(src.includes('julianDay(-2998, 1, 1, 0, 0, 0, "julian"), julianDay(2999, 1, 1)'), "call uses the Julian calendar before 1583");
  assert(!callSource(babylon).includes("pad:"), "no options object when nothing is set");
}

// the instrument at rest
{
  const html = renderToStaticMarkup(<SkyDating engine={eng} />);
  for (const id of ["IN", "OUT", "TBL", "CUT", "TS", "RET", "M-1", "M-2", "M-3"]) {
    assert(html.includes(`<b>${id}</b>`), `tile ${id} renders`);
  }
  assert(html.includes("Instrument I-01") && html.includes("<h1>Sky dating</h1>"), "title tile");
  assert((html.match(/>Aries<\/option>/g) ?? []).length === 7
    && (html.match(/>Pisces<\/option>/g) ?? []).length === 7, "seven bodies offer the twelve signs");
  assert(html.includes("4 set"), "the default preset sets four constraints");
  assert(html.includes('sign: &quot;Cancer&quot;'), "the call tile shows the default query");
  assert(!/style="[^"]*(gradient|shadow|radius)/.test(html), "no inline decoration");
}

console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
