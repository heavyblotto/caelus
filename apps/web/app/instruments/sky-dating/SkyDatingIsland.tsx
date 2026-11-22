"use client";

import { useMemo } from "react";
import { Engine, SIGNS, dateSky } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { SKY_PRESETS, buildConstraints, jdOfYear, type PackSource } from "caelus-widgets/sky-dating";
import { SkyDating } from "caelus-widgets/sky-dating-widget";
import InstrumentWorkbench, {
  useUrlPreset,
  type InstrumentCodeBundle,
  type InstrumentPresetOption,
} from "../InstrumentWorkbench";

const PACKS: PackSource = {
  manifestUrl: "/data/packs/manifest.json",
  fetch: (url) => fetch(url),
};

const PRESET_OPTIONS: InstrumentPresetOption[] = [
  { id: "babylon", label: "Babylonian tablet", summary: "Ancient planetary sign configuration dated across 600 BCE to 1 CE." },
  { id: "hadrian", label: "Hadrian ceiling", summary: "Roman vault planetary configuration over 100 CE to 200 CE." },
  { id: "venus", label: "Venus visibility", summary: "Planetary sign alignment combined with a heliacal visibility event." },
];
const VALID_PRESETS = PRESET_OPTIONS.map((p) => p.id);

export default function SkyDatingIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  const [preset, setPreset] = useUrlPreset(VALID_PRESETS, "babylon");

  const code = useMemo<InstrumentCodeBundle>(() => {
    const p = SKY_PRESETS.find((x) => x.id === preset) ?? SKY_PRESETS[0];
    const signEntries = Object.entries(p.query.signs);
    const pyPreds = signEntries.map(
      ([body, signIdx]) => `    {"body": "${body}", "sign": "${SIGNS[signIdx as number]}"},`,
    );

    const startJd = jdOfYear(p.query.startYear);
    const endJd = jdOfYear(p.query.endYear + 1);
    const cal = p.query.startYear < 1583 ? `, 0, 0, 0, "julian"` : "";

    return {
      ts: [
        `import { Engine, dateSky, julianDay } from "caelus";`,
        `import { embeddedData } from "caelus/data-embedded";`,
        ``,
        `const engine = new Engine(embeddedData);`,
        `const start = julianDay(${p.query.startYear}, 1, 1${cal});`,
        `const end = julianDay(${p.query.endYear + 1}, 1, 1${cal});`,
        `const { windows } = dateSky(engine, [`,
        ...signEntries.map(([body, signIdx]) => `  { body: "${body}", sign: "${SIGNS[signIdx as number]}" },`),
        `], start, end, { zodiac: "${p.query.zodiac}" });`,
      ].join("\n"),
      python: [
        `from astroengine import Engine`,
        `from astroengine.core import julian_day`,
        `from astroengine.datesky import date_sky`,
        ``,
        `engine = Engine()`,
        `result = date_sky(engine, [`,
        pyPreds.join("\n"),
        `], julian_day(${p.query.startYear}, 1, 1), julian_day(${p.query.endYear + 1}, 1, 1), zodiac="${p.query.zodiac}")`,
      ].join("\n"),
      mcp: JSON.stringify(
        {
          tool: "find_aspect_dates",
          arguments: {
            start_year: p.query.startYear,
            end_year: p.query.endYear,
            zodiac: p.query.zodiac,
            signs: p.query.signs,
          },
        },
        null,
        2,
      ),
      json: () => {
        let sampleWindows: Array<{ startJd: number; endJd: number }> = [];
        try {
          const constraints = buildConstraints(p.query);
          if (constraints.length > 0) {
            const res = dateSky(engine, constraints, startJd, endJd, {
              zodiac: p.query.zodiac,
              pad: p.query.pad,
            });
            sampleWindows = res.windows.slice(0, 10).map((w) => ({
              startJd: Number(w.start.toFixed(4)),
              endJd: Number(w.end.toFixed(4)),
            }));
          }
        } catch {
          sampleWindows = [];
        }
        return {
          preset: p.id,
          span: [p.query.startYear, p.query.endYear],
          zodiac: p.query.zodiac,
          signs: p.query.signs,
          matchesSample: sampleWindows,
        };
      },
    };
  }, [engine, preset]);

  return (
    <InstrumentWorkbench
      id="I-01"
      title="Sky dating"
      presets={PRESET_OPTIONS}
      activePreset={preset}
      onSelectPreset={setPreset}
      code={code}
    >
      <SkyDating key={preset} engine={engine} initialPreset={preset} packs={PACKS} />
    </InstrumentWorkbench>
  );
}
