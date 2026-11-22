"use client";

import { useMemo } from "react";
import { Engine, julianDay, solarEclipses, lunarEclipses } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Eclipses } from "caelus-widgets/eclipses-widget";
import InstrumentWorkbench, {
  useUrlPreset,
  type InstrumentCodeBundle,
  type InstrumentPresetOption,
} from "../InstrumentWorkbench";

const PRESET_OPTIONS: InstrumentPresetOption[] = [
  { id: "2024", label: "2024 North America", summary: "Starts at 2024 including the April 8 total solar eclipse across North America." },
  { id: "2026", label: "2026 Spain & Iceland", summary: "Starts at 2026 including the August 12 total solar eclipse across Iceland and Spain." },
  { id: "2027", label: "2027 Luxor 6m23s", summary: "Starts at 2027 including the August 2 long-duration total solar eclipse over Egypt." },
  { id: "2030", label: "2030 Southern Path", summary: "Starts at 2030 including the November 25 total solar eclipse across southern Africa and Australia." },
];
const VALID_PRESETS = PRESET_OPTIONS.map((p) => p.id);

export default function EclipsesIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  const [preset, setPreset] = useUrlPreset(VALID_PRESETS, "2026");
  const startYear = Number(preset) || 2026;
  const endYear = startYear + 3;

  const code = useMemo<InstrumentCodeBundle>(() => {
    const jd0 = julianDay(startYear, 1, 1);
    const jd1 = julianDay(endYear + 1, 1, 1);
    let sample: unknown = null;
    try {
      const sol = solarEclipses(engine, jd0, jd1).slice(0, 6);
      const lun = lunarEclipses(engine, jd0, jd1).slice(0, 6);
      sample = {
        span: [startYear, endYear],
        solarCount: sol.length,
        lunarCount: lun.length,
        solar: sol.map((e) => ({ type: e.type, tMaxJd: Number(e.tMax.toFixed(5)), gamma: Number(e.gamma.toFixed(4)) })),
        lunar: lun.map((e) => ({ type: e.type, tMaxJd: Number(e.tMax.toFixed(5)), magUmbral: Number(e.magUmbral.toFixed(4)) })),
      };
    } catch {
      sample = { span: [startYear, endYear] };
    }

    return {
      ts: [
        `import { Engine, julianDay, solarEclipses, lunarEclipses, solarEclipseLocal } from "caelus";`,
        `import { embeddedData } from "caelus/data-embedded";`,
        ``,
        `const engine = new Engine(embeddedData);`,
        `const start = julianDay(${startYear}, 1, 1);`,
        `const end = julianDay(${endYear + 1}, 1, 1);`,
        `const solar = solarEclipses(engine, start, end);`,
        `const lunar = lunarEclipses(engine, start, end);`,
        `const local = solar[0] ? solarEclipseLocal(engine, solar[0].tMax, 40.42, -3.7) : null;`,
      ].join("\n"),
      python: [
        `from astroengine import Engine`,
        `from astroengine.core import julian_day`,
        `from astroengine.eclipses import solar_eclipses, lunar_eclipses, solar_eclipse_local`,
        ``,
        `engine = Engine()`,
        `solar = solar_eclipses(engine, julian_day(${startYear}, 1, 1), julian_day(${endYear + 1}, 1, 1))`,
        `lunar = lunar_eclipses(engine, julian_day(${startYear}, 1, 1), julian_day(${endYear + 1}, 1, 1))`,
      ].join("\n"),
      mcp: JSON.stringify(
        {
          tool: "sky_events",
          arguments: {
            start_date: `${startYear}-01-01T00:00:00Z`,
            end_date: `${endYear}-12-31T23:59:59Z`,
            kinds: ["solar_eclipse", "lunar_eclipse"],
          },
        },
        null,
        2,
      ),
      json: sample,
    };
  }, [engine, startYear, endYear]);

  return (
    <InstrumentWorkbench
      id="I-03"
      title="Eclipses"
      presets={PRESET_OPTIONS}
      activePreset={preset}
      onSelectPreset={setPreset}
      code={code}
    >
      <Eclipses key={startYear} engine={engine} year={startYear} />
    </InstrumentWorkbench>
  );
}
