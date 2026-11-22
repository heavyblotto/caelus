"use client";

import { useMemo } from "react";
import { Engine, chartStability, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import {
  STABILITY_DEFAULT,
  halfWidthOf,
  type StabilityQuery,
} from "caelus-widgets/chart-stability";
import { ChartStability } from "caelus-widgets/chart-stability-widget";
import { WHEEL_THEME } from "../../../lib/wheelTheme";
import InstrumentWorkbench, {
  useUrlPreset,
  type InstrumentCodeBundle,
  type InstrumentPresetOption,
} from "../InstrumentWorkbench";

const PRESETS: Record<string, StabilityQuery> = {
  "tampa-1h": STABILITY_DEFAULT,
  "london-day": {
    year: 2000,
    month: 8,
    day: 22,
    hour: 12,
    minute: 0,
    place: { lat: 51.51, lonEast: -0.13 },
    window: "day",
    houseSystem: "placidus",
    zodiac: "tropical",
  },
  "delhi-sidereal": {
    year: 1990,
    month: 6,
    day: 10,
    hour: 18,
    minute: 30,
    place: { lat: 28.61, lonEast: 77.21 },
    window: "1h",
    houseSystem: "whole_sign",
    zodiac: "sidereal:lahiri",
  },
};

const PRESET_OPTIONS: InstrumentPresetOption[] = [
  { id: "tampa-1h", label: "Tampa +/-1h", summary: "10 June 1990 18:30 UT in Tampa with +/-1 hour uncertainty." },
  { id: "london-day", label: "London 24h scan", summary: "22 August 2000 over London across the full +/-12 hour day." },
  { id: "delhi-sidereal", label: "Delhi Lahiri +/-1h", summary: "Sidereal Lahiri whole-sign stability in New Delhi (+/-1 hour)." },
];
const VALID_PRESETS = PRESET_OPTIONS.map((p) => p.id);

export default function ChartStabilityIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  const [preset, setPreset] = useUrlPreset(VALID_PRESETS, "tampa-1h");
  const initial = PRESETS[preset] ?? STABILITY_DEFAULT;

  const code = useMemo<InstrumentCodeBundle>(() => {
    const q = initial;
    const halfSec = halfWidthOf(q);
    const jd = julianDay(q.year, q.month, q.day, q.hour, q.minute, 0);
    const iso = `${String(q.year).padStart(4, "0")}-${String(q.month).padStart(2, "0")}-${String(q.day).padStart(2, "0")}T${String(q.hour).padStart(2, "0")}:${String(q.minute).padStart(2, "0")}:00Z`;

    return {
      ts: [
        `import { Engine, chartStability, julianDay } from "caelus";`,
        `import { embeddedData } from "caelus/data-embedded";`,
        ``,
        `const engine = new Engine(embeddedData);`,
        `const jd = julianDay(${q.year}, ${q.month}, ${q.day}, ${q.hour}, ${q.minute}, 0);`,
        `const report = chartStability(engine, jd, {`,
        `  halfWidthSeconds: ${halfSec},`,
        ...(q.place ? [`  lat: ${q.place.lat},`, `  lonEast: ${q.place.lonEast},`] : []),
        `  houseSystem: "${q.houseSystem}",`,
        `  zodiac: "${q.zodiac}",`,
        `});`,
      ].join("\n"),
      python: [
        `from astroengine import Engine`,
        `from astroengine.core import julian_day`,
        `from astroengine.stability import chart_stability`,
        ``,
        `engine = Engine()`,
        `jd = julian_day(${q.year}, ${q.month}, ${q.day}, ${q.hour}, ${q.minute}, 0)`,
        `report = chart_stability(`,
        `    engine, jd, half_width_seconds=${halfSec},`,
        ...(q.place ? [`    lat=${q.place.lat}, lon_east=${q.place.lonEast},`] : []),
        `    house_system="${q.houseSystem}", zodiac="${q.zodiac}",`,
        `)`,
      ].join("\n"),
      mcp: JSON.stringify(
        {
          tool: "rectification_grid",
          arguments: {
            date: iso.slice(0, 10),
            lat: q.place?.lat ?? 0,
            lon: q.place?.lonEast ?? 0,
            step_min: 15,
          },
        },
        null,
        2,
      ),
      json: () => {
        try {
          const res = chartStability(engine, jd, {
            halfWidthSeconds: halfSec,
            lat: q.place?.lat,
            lonEast: q.place?.lonEast,
            houseSystem: q.houseSystem,
            zodiac: q.zodiac,
          });
          return {
            preset,
            statedUtc: iso,
            halfWidthSeconds: halfSec,
            stableCount: res.facts.filter((f) => f.stable).length,
            changingCount: res.facts.filter((f) => !f.stable).length,
            changingFacts: res.facts
              .filter((f) => !f.stable)
              .slice(0, 12)
              .map((f) => ({ kind: f.kind, subject: f.subject, stated: f.value, segments: f.segments.length })),
          };
        } catch {
          return { preset, statedUtc: iso };
        }
      },
    };
  }, [engine, initial, preset]);

  return (
    <InstrumentWorkbench
      id="I-02"
      title="Uncertain time"
      presets={PRESET_OPTIONS}
      activePreset={preset}
      onSelectPreset={setPreset}
      code={code}
    >
      <ChartStability key={preset} engine={engine} initial={initial} wheelTheme={WHEEL_THEME} />
    </InstrumentWorkbench>
  );
}
