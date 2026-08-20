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
import { PlateConsole, type ConsoleStation } from "../src/console.js";
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
  // inert without onScrub: rendering is identical server- and client-side
  assert(!html.includes("cursor:pointer"), "console: inert without onScrub");
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
    kb: "kb:angle/ascendant",
    engineVersion: VERSION,
  };
  const roundTrip = JSON.parse(JSON.stringify(record)) as PlateRecord;
  assert(roundTrip.spec.kind === "derivation", "registry: spec survives JSON round-trip");
  assert(roundTrip.spec.params.instant.y === 1990, "registry: params survive JSON round-trip");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
