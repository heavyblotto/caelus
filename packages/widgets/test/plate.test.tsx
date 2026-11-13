/**
 * caelus-widgets plate scaffolding checks: the frame and console
 * render through renderToStaticMarkup (proving SSR safety — this is
 * Node, no DOM), the stamp names the engine version, and oxblood
 * appears exactly once (the scrub index), keeping the single-accent
 * rule mechanical.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { VERSION } from "caelus";
import { PLATE_TOKENS } from "caelus-wheel";
import { PlateFrame } from "../src/frame.js";
import { labelLefts, PlateConsole, type ConsoleStation } from "../src/console.js";
import type { WidgetSpec } from "../src/spec.js";
import type { PlateRecord } from "../src/registry.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

// ---------------------------------------------------------------- frame
{
  const svg = <svg width="200" height="200" />;
  const html = renderToStaticMarkup(
    <PlateFrame
      figure={3}
      caption="Chart for 10 June 1990, 14:30 UT, Tampa (27.95° N, 82.46° W), Placidus houses."
      engineVersion={VERSION}
      reproduceHref="/playground#spec"
    >
      {svg}
    </PlateFrame>,
  );
  assert(html.includes("Fig. 3"), "frame: figure number");
  assert(html.includes(`Figures · caelus ${VERSION}`), "frame: version stamp");
  assert(html.includes('href="/playground#spec"'), "frame: reproduce permalink");
  assert(html.includes("<svg"), "frame: figure content");
  assert(!html.includes(PLATE_TOKENS.accent), "frame: no oxblood in chrome");

  const bare = renderToStaticMarkup(
    <PlateFrame figure={1} caption="c" engineVersion={VERSION}>
      {svg}
    </PlateFrame>,
  );
  assert(!bare.includes("reproduce"), "frame: reproduce affordance is opt-in");
}

// ---------------------------------------------------------------- console
const STATIONS: ConsoleStation[] = [
  { id: "sky", label: "SKY", t: 0 },
  { id: "sphere", label: "SPHERE", t: 0.25 },
  { id: "ecliptic", label: "ECLIPTIC", t: 0.5 },
  { id: "horizon", label: "HORIZON", t: 0.75 },
  { id: "wheel", label: "WHEEL", t: 1 },
];
{
  const html = renderToStaticMarkup(
    <PlateConsole
      t={0.5}
      stations={STATIONS}
      datum="alt +34° 12′ · az 158° · λ 19°27′ ♊"
    />,
  );
  const accents = html.split(PLATE_TOKENS.accent).length - 1;
  assert(accents === 1, `console: oxblood exactly once (index), got ${accents}`);
  assert(html.includes("SKY") && html.includes("WHEEL"), "console: station labels");
  assert(html.includes("λ 19°27′"), "console: datum line");
  assert(html.includes("left:50%"), "console: index at t");
  assert(html.includes("user-select:none"), "console: no text selection on the rail");
  // inert without onScrub: rendering is identical server- and client-side
  assert(!html.includes("cursor:pointer"), "console: inert without onScrub");
  const live = renderToStaticMarkup(
    <PlateConsole t={0.5} stations={STATIONS} onScrub={() => {}} />,
  );
  assert(live.includes("cursor:ew-resize"), "console: hydrated rail is a drag");
  assert(live.includes("height:44px"), "console: rail hit area is taller than the rule");
  assert(live.includes("role=\"slider\""), "console: hydrated rail is a slider");
  const crowded = renderToStaticMarkup(
    <PlateConsole t={0} stations={[
      { id: "view", label: "VIEW", t: 0 },
      { id: "figures", label: "FIGURES", t: 0.07 },
      { id: "zodiac", label: "ZODIAC", t: 0.13 },
      { id: "sky", label: "SKY", t: 0.2 },
      { id: "sphere", label: "SPHERE", t: 0.4 },
      { id: "ecliptic", label: "ECLIPTIC", t: 0.6 },
      { id: "horizon", label: "HORIZON", t: 0.72 },
      { id: "wheel", label: "WHEEL", t: 1 },
    ]} />,
  );
  assert(crowded.includes("height:32px"), "console: crowded stations use two rows");
  assert(crowded.includes("top:16px"), "console: odd stations sit on the second row");
  // Labels on a row cannot collide at any rail width: each left edge is the
  // larger of its place under the tick and the edge of the label before it.
  const lefts = labelLefts([
    { id: "a", label: "VIEW", t: 0 },
    { id: "b", label: "HORIZON", t: 0.08 },
    { id: "c", label: "ZODIAC", t: 0.16 },
    { id: "d", label: "WHEEL", t: 1 },
  ], () => 0);
  assert(lefts[0] === "calc(0% + 0px)", `console: the first label starts at the rail's left edge (${lefts[0]})`);
  assert(lefts[1] === "max(calc(8% + -23.8px), calc(0% + 35.2px))", `console: the second clears the first (${lefts[1]})`);
  assert(lefts[2] === "max(calc(16% + -20.4px), calc(8% + 31.8px), calc(0% + 90.8px))", `console: the third clears both (${lefts[2]})`);
  assert(lefts[3] === "100%", "console: a station at the end is anchored to the right edge");
  // evaluate the CSS for a few rail widths and check nothing overlaps
  const px = (css: string, rail: number): number => Math.max(...[...css.matchAll(/calc\(([\d.]+)% \+ (-?[\d.]+)px\)/g)]
    .map((m) => (Number(m[1]) / 100) * rail + Number(m[2])));
  for (const rail of [180, 235, 340, 815]) {
    const edges = lefts.slice(0, 3).map((css) => px(css, rail));
    const widths = [4, 7, 6].map((n) => n * 6.8);
    assert(edges[1] >= edges[0] + widths[0] + 8 - 1e-9 && edges[2] >= edges[1] + widths[1] + 8 - 1e-9,
      `console: labels clear each other on a ${rail}px rail`);
  }
  assert(Math.abs(px(lefts[2], 815) - (0.16 * 815 - 20.4)) < 1e-9, "console: on a wide rail a label sits centred under its tick");
  assert(crowded.includes("max(calc("), "console: the rendered labels carry the push");
}

// ---------------------------------------------------------------- types
{
  // the spec union and registry types compose (compile-time; exercised
  // here so the shapes stay honest at runtime too)
  const spec: WidgetSpec = {
    kind: "derivation",
    params: {
      instant: { y: 1990, mo: 6, d: 10, h: 14, mi: 30, s: 0 },
      place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
      houseSystem: "placidus",
      t: 1,
    },
  };
  const record: PlateRecord = {
    id: "ascendant-fig-1",
    figure: 1,
    spec,
    caption: "The horizon axis.",
    location: { entry: "ascendant", section: "1" },
    kb: "chart-type:natal",
    engineVersion: VERSION,
  };
  const roundTrip = JSON.parse(JSON.stringify(record)) as PlateRecord;
  assert(roundTrip.spec.kind === "derivation", "registry: spec survives JSON round-trip");
  assert(roundTrip.spec.params.instant.y === 1990, "registry: params survive JSON round-trip");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
