/**
 * zodiac-drift checks: the scene precomputes the five ayanamsa curves
 * over the ±150-year window (no engine instance — the ayanamsa is a
 * pure precession function), the gap interpolation lands on the
 * samples, the mode offsets are time-invariant (one precession
 * model), the figure rotates the sidereal ring by the gap with the
 * wedge in oxblood, and the widget lists the picker with the accent
 * exactly once.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { VERSION } from "caelus";
import {
  deriveDrift, DRIFT_MODES, DRIFT_WINDOW, driftDatum, driftGap, driftStations,
  ZodiacDriftFigure,
} from "../src/zodiac-drift.js";
import { ZodiacDrift } from "../src/zodiac-drift-widget.js";
import type { ZodiacDriftSpec } from "../src/spec.js";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

const spec: ZodiacDriftSpec = {
  kind: "zodiac-drift",
  params: {
    instant: { y: 1990, mo: 6, d: 10, h: 18, mi: 30, s: 0 },
    place: { latDeg: 27.95, lonEastDeg: -82.46, label: "Tampa" },
  },
};

const scene = deriveDrift(spec.params);

// ------------------------------------------------------------- scene
{
  const round = JSON.parse(JSON.stringify(scene)) as typeof scene;
  assert(round.years.length === 2 * DRIFT_WINDOW + 1,
    "scene carries the full year window and survives JSON");
  assert(DRIFT_MODES.every((m) => scene.curves[m].length === scene.years.length),
    "one sample per year per mode");
  assert(scene.engineVersion === VERSION, "scene stamps the running engine");
  assert(scene.restYear > 1990.4 && scene.restYear < 1990.5,
    "resting year is mid-1990");
  // Lahiri at 1990: about 23.72° (J2000 anchor 23.8571 minus a decade
  // of precession).
  const rest = driftGap(scene, "lahiri", scene.restYear);
  assert(rest > 23.5 && rest < 24.0, `lahiri at rest ≈ 23.7°, got ${rest}`);
  // Precession widens every mode's gap across the window.
  for (const m of DRIFT_MODES) {
    const first = scene.curves[m][0];
    const last = scene.curves[m][scene.curves[m].length - 1];
    assert(last - first > 3.5 && last - first < 4.5,
      `${m} widens ≈ 4.2° over three centuries, got ${last - first}`);
  }
  // One precession model: the mode offsets are time-invariant.
  const offsetAt = (y: number) =>
    driftGap(scene, "fagan_bradley", y) - driftGap(scene, "lahiri", y);
  assert(Math.abs(offsetAt(1850) - offsetAt(2050)) < 1e-6,
    "fagan_bradley − lahiri is constant across the window");
}

// --------------------------------------------------------- interpolation
{
  const k = 40;
  const y = scene.years[k];
  assert(driftGap(scene, "lahiri", y) === scene.curves.lahiri[k],
    "interpolation lands exactly on a sample year");
  const mid = (scene.curves.lahiri[k] + scene.curves.lahiri[k + 1]) / 2;
  assert(Math.abs(driftGap(scene, "lahiri", y + 0.5) - mid) < 1e-12,
    "mid-year interpolates linearly");
  assert(driftGap(scene, "nonsense", y) === driftGap(scene, "lahiri", y),
    "an unknown mode falls back to lahiri");
}

// ------------------------------------------------------------- figure
{
  const at = (mode?: string, year?: number) => renderToStaticMarkup(
    <ZodiacDriftFigure scene={scene} mode={mode} year={year} />,
  );
  assert(at() === at("lahiri", scene.restYear),
    "resting figure draws the spec defaults");
  assert(at("lahiri") !== at("raman"),
    "the sidereal ring moves between modes");
  assert(at("lahiri", 1900) !== at("lahiri", 2100),
    "the gap widens across the centuries");
  const html = at();
  assert((html.match(/<circle/g) ?? []).length === 2, "two rings");
  assert((html.match(/♈/g) ?? []).length === 4,
    "both rings carry all twelve signs (♈ twice per ring: glyph + zero label)");
  assert(html.includes("#8c2f2a"), "the gap wedge is oxblood");
  // The sidereal zero tick sits at tropical longitude = the gap; both
  // zero marks carry their "0° ♈" label.
  const gap = driftGap(scene, "lahiri", scene.restYear);
  assert((html.match(/0° ♈/g) ?? []).length === 2,
    "both rings label their zero marks");
  assert(gap > 0, "the sidereal ring trails the tropical");
}

// ------------------------------------------------------------- widget
{
  const html = renderToStaticMarkup(<ZodiacDrift scene={scene} />);
  for (const m of DRIFT_MODES) {
    assert(html.includes(`>${m.replace(/_/g, " ")}</button>`),
      `picker lists ${m}`);
  }
  const accents = html.split("#8c2f2a").length - 1;
  // Picker (the current mode), rail index, and the figure's wedge
  // (arc plus two end-caps).
  assert(accents === 5, `oxblood five times (picker, rail, wedge ×3), got ${accents}`);
  assert(html.includes("ayanamsa"), "datum names the quantity");
  assert(html.includes("1990"), "a station label names the resting year");
  const stations = driftStations(scene);
  assert(stations.some((s) => s.id === "rest"), "release-snap can return to rest");
  assert(stations.filter((s) => s.id.startsWith("y")).length === 3,
    "three century marks in a 300-year window");
  assert(driftDatum(scene, "lahiri", scene.restYear).includes("″/yr"),
    "the datum carries the precession rate");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
