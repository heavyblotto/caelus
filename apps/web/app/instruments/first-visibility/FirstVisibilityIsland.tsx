"use client";

import { useMemo } from "react";
import { Engine, heliacal, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { VISIBILITY_PRESETS } from "caelus-widgets/first-visibility";
import { FirstVisibility } from "caelus-widgets/first-visibility-widget";
import InstrumentWorkbench, {
  useUrlPreset,
  type InstrumentCodeBundle,
  type InstrumentPresetOption,
} from "../InstrumentWorkbench";

const PRESET_OPTIONS: InstrumentPresetOption[] = [
  { id: "sirius", label: "Sirius at Memphis", summary: "Heliacal rising of Sirius before dawn at Memphis, Egypt." },
  { id: "venus", label: "Venus at Babylon", summary: "Morning and evening first and last visibility of Venus from Babylon." },
  { id: "crescent", label: "Lunar crescent", summary: "First visible evening crescent Moon using the Yallop criterion." },
];
const VALID_PRESETS = PRESET_OPTIONS.map((p) => p.id);

export default function FirstVisibilityIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  const [preset, setPreset] = useUrlPreset(VALID_PRESETS, "sirius");

  const code = useMemo<InstrumentCodeBundle>(() => {
    const p = VISIBILITY_PRESETS.find((x) => x.id === preset) ?? VISIBILITY_PRESETS[0];
    const q = p.query;
    const startJd = julianDay(q.year, 1, 1);

    return {
      ts: [
        `import { Engine, heliacal, julianDay } from "caelus";`,
        `import { embeddedData } from "caelus/data-embedded";`,
        ``,
        `const engine = new Engine(embeddedData);`,
        `const ev = heliacal(`,
        `  engine,`,
        `  "${q.target}",`,
        `  julianDay(${q.year}, 1, 1),`,
        `  ${q.place.lat},`,
        `  ${q.place.lonEast},`,
        `  { kind: "${p.pick.kind}", extinction: ${q.extinction} },`,
        `);`,
      ].join("\n"),
      python: [
        `from astroengine import Engine`,
        `from astroengine.core import julian_day`,
        `from astroengine.heliacal import heliacal`,
        ``,
        `engine = Engine()`,
        `ev = heliacal(`,
        `    engine, "${q.target}", julian_day(${q.year}, 1, 1),`,
        `    ${q.place.lat}, ${q.place.lonEast},`,
        `    kind="${p.pick.kind}", extinction=${q.extinction},`,
        `)`,
      ].join("\n"),
      mcp: JSON.stringify(
        {
          tool: "sky_events",
          arguments: {
            start_date: `${q.year}-01-01T00:00:00Z`,
            end_date: `${q.year}-12-31T23:59:59Z`,
            lat: q.place.lat,
            lon: q.place.lonEast,
            target: q.target,
          },
        },
        null,
        2,
      ),
      json: () => {
        try {
          const ev = heliacal(engine, q.target, startJd, q.place.lat, q.place.lonEast, {
            kind: p.pick.kind,
            extinction: q.extinction,
          });
          return {
            preset: p.id,
            target: q.target,
            year: q.year,
            observer: q.place,
            extinction: q.extinction,
            event: ev
              ? {
                  kind: ev.kind,
                  jd: Number(ev.jd.toFixed(4)),
                  sunAltitude: ev.sunAltitude != null ? Number(ev.sunAltitude.toFixed(2)) : null,
                  altitude: ev.altitude != null ? Number(ev.altitude.toFixed(2)) : null,
                }
              : null,
          };
        } catch {
          return { preset: p.id, target: q.target, year: q.year, observer: q.place };
        }
      },
    };
  }, [engine, preset]);

  return (
    <InstrumentWorkbench
      id="I-04"
      title="First visibility"
      presets={PRESET_OPTIONS}
      activePreset={preset}
      onSelectPreset={setPreset}
      code={code}
    >
      <FirstVisibility key={preset} engine={engine} initialPreset={preset} />
    </InstrumentWorkbench>
  );
}
