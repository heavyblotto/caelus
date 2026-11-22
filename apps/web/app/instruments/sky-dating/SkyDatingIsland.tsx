"use client";

import { useMemo } from "react";
import { Engine, when, allOf, inSign } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { SKY_PRESETS, jdOfYear, type PackSource } from "caelus-widgets/sky-dating";
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
    const tsPreds = signEntries.map(
      ([body, signIdx]) => `  inSign("${body}", ${signIdx}, "${p.query.zodiac}")`,
    );
    const pyPreds = signEntries.map(
      ([body, signIdx]) => `    in_sign("${body}", ${signIdx}, "${p.query.zodiac}")`,
    );

    const startJd = jdOfYear(p.query.startYear);
    const endJd = jdOfYear(p.query.endYear + 1);
    let sampleWindows: Array<{ startJd: number; endJd: number }> = [];
    try {
      const preds = signEntries.map(([b, idx]) =>
        inSign(b as Parameters<typeof inSign>[0], idx as number, p.query.zodiac),
      );
      if (preds.length > 0) {
        const res = when(engine, preds.length === 1 ? preds[0] : allOf(...preds), startJd, endJd);
        sampleWindows = res.slice(0, 10).map(([s, e]) => ({
          startJd: Number(s.toFixed(4)),
          endJd: Number(e.toFixed(4)),
        }));
      }
    } catch {
      sampleWindows = [];
    }

    return {
      ts: [
        `import { Engine, when, allOf, inSign, julianDay } from "caelus";`,
        `import { embeddedData } from "caelus/data-embedded";`,
        ``,
        `const engine = new Engine(embeddedData);`,
        `const start = julianDay(${p.query.startYear}, 1, 1);`,
        `const end = julianDay(${p.query.endYear + 1}, 1, 1);`,
        `const windows = when(engine, allOf(`,
        tsPreds.join(",\n"),
        `), start, end);`,
      ].join("\n"),
      python: [
        `from astroengine import Engine`,
        `from astroengine.core import julian_day`,
        `from astroengine.query import when, all_of, in_sign`,
        ``,
        `engine = Engine()`,
        `windows = when(engine, all_of(`,
        pyPreds.join(",\n"),
        `), julian_day(${p.query.startYear}, 1, 1), julian_day(${p.query.endYear + 1}, 1, 1))`,
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
      json: {
        preset: p.id,
        span: [p.query.startYear, p.query.endYear],
        zodiac: p.query.zodiac,
        signs: p.query.signs,
        matchesSample: sampleWindows,
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
