import type { Constraint, HouseSystem, Zodiac } from "caelus";
import type { DocKind, FigureView, RailId } from "./util";
import type { Tradition } from "../../lib/share";

export interface CodeCallParams {
  docKind: DocKind;
  utIso: string;
  targetIso: string;
  lat: number;
  lon: number;
  sys: HouseSystem;
  zodiac: Zodiac;
  tradition: Tradition;
  figure: FigureView;
  rail: RailId;
  advanced: boolean;
  topocentric: boolean;
  spatial: boolean;
  orbOverride: string;
  harmonicN: number;
  selectedBody: string | null;
  constraints: Constraint[];
}

export interface GeneratedCode {
  ts: string;
  python: string;
  mcp: string;
}

function parseIsoParts(iso: string) {
  const safe = iso && iso.length >= 16 ? iso : "2000-08-22T12:00";
  const [date, time] = safe.split("T");
  const [y, mo, d] = date.split("-").map((x) => Number(x) || 0);
  const [h, mi] = time.split(":").map((x) => Number(x) || 0);
  return { y, mo, d, h, mi, isoZ: `${safe}:00Z` };
}

/** Generate exact reproducible TS, Python, and MCP calls for the current Playground state. */
export function buildPlaygroundCode(p: CodeCallParams): GeneratedCode {
  const lat = Number.isFinite(p.lat) ? Number(p.lat.toFixed(4)) : 0;
  const lon = Number.isFinite(p.lon) ? Number(p.lon.toFixed(4)) : 0;

  if (p.docKind === "form") {
    const jsonConstraints = JSON.stringify(p.constraints, null, 2);
    return {
      ts: [
        `import { compileForm } from "caelus";`,
        ``,
        `const result = compileForm(${jsonConstraints});`,
        `console.log(result.longitudes, result.residual);`,
      ].join("\n"),
      python: [
        `from astroengine.compiler import compile_form`,
        ``,
        `result = compile_form(${jsonConstraints})`,
        `print(result["longitudes"], result["residual"])`,
      ].join("\n"),
      mcp: JSON.stringify(
        {
          tool: "compile_form",
          arguments: { constraints: p.constraints },
        },
        null,
        2,
      ),
    };
  }

  const natal = parseIsoParts(p.utIso);
  const target = parseIsoParts(p.targetIso || p.utIso);
  const optsParts: string[] = [
    `houseSystem: "${p.sys}"`,
    `zodiac: "${p.zodiac}"`,
  ];
  if (p.advanced && p.topocentric) {
    optsParts.push(`topocentric: true`);
    optsParts.push(`observer: { lat: ${lat}, lonEast: ${lon} }`);
  }
  if (p.advanced && p.spatial) {
    optsParts.push(`separation: "spatial"`);
  }
  const orbN = Number(p.orbOverride);
  if (p.advanced && Number.isFinite(orbN) && orbN > 0) {
    optsParts.push(
      `orbs: { conjunction: ${orbN}, sextile: ${orbN}, square: ${orbN}, trine: ${orbN}, opposition: ${orbN} }`,
    );
  }

  const tsImports = new Set<string>(["Engine"]);
  const tsTail: string[] = [];

  if (p.selectedBody) {
    tsImports.add("dignityScore");
    tsTail.push(
      ``,
      `// Focused body: ${p.selectedBody}`,
      `const body = chart.bodies.${p.selectedBody};`,
      `const bodyAspects = chart.aspects.filter((a) => a.a === "${p.selectedBody}" || a.b === "${p.selectedBody}");`,
    );
  }

  if (p.figure === "transits" || p.figure === "tri" || p.rail === "timing") {
    tsImports.add("transitAspects");
    tsImports.add("julianDay");
    tsTail.push(
      ``,
      `const targetJd = julianDay(${target.y}, ${target.mo}, ${target.d}, ${target.h}, ${target.mi}, 0);`,
      `const transits = transitAspects(chart, engine, targetJd, { zodiac: "${p.zodiac}" });`,
    );
  } else if (p.figure === "map") {
    tsImports.add("astrocartography");
    tsTail.push(
      ``,
      `const acgLines = astrocartography(engine, chart.jdUt);`,
    );
  } else if (p.rail === "sky") {
    tsImports.add("skyView");
    tsImports.add("julianDay");
    tsTail.push(
      ``,
      `const viewJd = julianDay(${target.y}, ${target.mo}, ${target.d}, ${target.h}, ${target.mi}, 0);`,
      `const frame = skyView(engine, viewJd, {`,
      `  observer: { lat: ${lat}, lonEast: ${lon} },`,
      `  aim: { azimuth: "W", altitude: 5 },`,
      `  lens: "normal",`,
      `  image: { width: 1024, height: 683 },`,
      `});`,
    );
  } else if (p.tradition === "vedic" || p.rail === "vedic") {
    tsImports.add("nakshatra");
    tsImports.add("vimshottariActive");
    tsImports.add("julianDay");
    tsTail.push(
      ``,
      `const targetJd = julianDay(${target.y}, ${target.mo}, ${target.d}, ${target.h}, ${target.mi}, 0);`,
      `const moonNak = nakshatra(chart.bodies.moon.lon);`,
      `const dasha = vimshottariActive(chart.bodies.moon.lon, chart.jdUt, targetJd);`,
    );
  } else if (p.figure === "harmonic") {
    tsImports.add("harmonicChart");
    tsTail.push(
      ``,
      `const harmonic = harmonicChart(engine, chart.jdUt, undefined, ${p.harmonicN}, "${p.zodiac}");`,
    );
  }

  const ts = [
    `import { ${[...tsImports].join(", ")} } from "caelus";`,
    `import { embeddedData } from "caelus/data-embedded";`,
    ``,
    `const engine = new Engine(embeddedData);`,
    `const chart = engine.chart(`,
    `  ${natal.y}, ${natal.mo}, ${natal.d}, ${natal.h}, ${natal.mi}, 0,`,
    `  ${lat}, ${lon},`,
    `  { ${optsParts.join(", ")} },`,
    `);`,
    ...tsTail,
  ].join("\n");

  const pyLines = [
    `from astroengine import Engine`,
    ``,
    `engine = Engine()`,
    `chart = engine.chart(`,
    `    ${natal.y}, ${natal.mo}, ${natal.d}, ${natal.h}, ${natal.mi}, 0,`,
    `    ${lat}, ${lon},`,
    `    house_system="${p.sys}",`,
    `    zodiac="${p.zodiac}",`,
    `)`,
  ];
  if (p.selectedBody) {
    pyLines.push(`body = chart["bodies"]["${p.selectedBody}"]`);
  }
  if (p.tradition === "vedic" || p.rail === "vedic") {
    pyLines.push(
      `from astroengine.vedic import nakshatra, vimshottari_active`,
      `moon_nak = nakshatra(chart["bodies"]["moon"]["lon"])`,
    );
  } else if (p.rail === "sky") {
    pyLines.push(
      `from astroengine.skyview import sky_view`,
      `frame = sky_view(engine, chart["jd_ut"], {"lat": ${lat}, "lon_east": ${lon}})`,
    );
  }

  let mcpObj: Record<string, unknown>;
  if (p.rail === "sky") {
    mcpObj = {
      tool: "sky_view",
      arguments: {
        date: target.isoZ,
        lat,
        lon,
        azimuth: "W",
        altitude: 5,
        lens: "normal",
        width: 1024,
        height: 683,
      },
    };
  } else if (p.figure === "transits" || p.rail === "timing") {
    mcpObj = {
      tool: "transits",
      arguments: {
        natal_date: natal.isoZ,
        natal_lat: lat,
        natal_lon: lon,
        transit_date: target.isoZ,
        zodiac: p.zodiac,
      },
    };
  } else if (p.tradition === "vedic" || p.rail === "vedic") {
    mcpObj = {
      tool: "dasha",
      arguments: {
        date: natal.isoZ,
        lat,
        lon,
        target_date: target.isoZ,
      },
    };
  } else {
    mcpObj = {
      tool: "natal_chart",
      arguments: {
        date: natal.isoZ,
        lat,
        lon,
        house_system: p.sys,
        zodiac: p.zodiac,
        ...(p.advanced && p.spatial ? { separation: "spatial" } : {}),
      },
    };
  }

  return {
    ts,
    python: pyLines.join("\n"),
    mcp: JSON.stringify(mcpObj, null, 2),
  };
}
