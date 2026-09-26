/**
 * Emit NYC sky-plate prompts from skyView (body-free renderPlan + sceneNote).
 * Images are generated separately from those prompts.
 *
 *   npm run build -w caelus
 *   node apps/web/scripts/nyc-sky-plates.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine, julianDay, riseSet, skyView, twilightStage } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/home/sky-plates");
const NYC = { lat: 40.7128, lonEast: -74.006, altM: 30 };
const AIM_AZ = { N: 0, E: 90, S: 180, W: 270 };
const FOREGROUND = {
  E: "Foreground: New York City looking east from a Manhattan rooftop over the East River toward Brooklyn and Queens, Queensboro Bridge massing in the distance. No Sun, Moon, planets, or stars.",
  S: "Foreground: New York City looking south from midtown along the downtown harbor axis, Lower Manhattan towers. No Sun, Moon, planets, or stars.",
  W: "Foreground: New York City looking west from Manhattan across the Hudson River toward the New Jersey skyline. No Sun, Moon, planets, or stars.",
  N: "Foreground: New York City looking north through a denser midtown street canyon. No Sun, Moon, planets, or stars.",
};

const engine = new Engine(embeddedData);

function lightingOf(sunAlt, moonAlt, moonIllum) {
  const stage = twilightStage(sunAlt);
  if (stage === "day") {
    if (sunAlt < 12) return "golden";
    if (sunAlt < 40) return "morning";
    return "midday";
  }
  if (stage === "civil") return sunAlt > -4 ? "golden" : "civil";
  if (stage === "nautical") return "civil";
  if (moonAlt > 8 && moonIllum > 0.35) return "moonlit";
  return "night";
}

function jdOf(y, mo, d, h, mi) {
  return julianDay(y, mo, d, h, mi, 0);
}

function resolveJd(cell) {
  const [y, mo, d] = cell.date;
  const start = jdOf(y, mo, d, 0, 0);
  if (cell.kind === "sunrise" || cell.kind === "civil-rise") {
    const rise = riseSet(engine, "sun", start, NYC.lat, NYC.lonEast, "rise");
    if (!rise) return jdOf(y, mo, d, 10, 0);
    return cell.kind === "civil-rise" ? rise - 20 / 1440 : rise;
  }
  if (cell.kind === "sunset" || cell.kind === "civil-set") {
    const set = riseSet(engine, "sun", start, NYC.lat, NYC.lonEast, "set");
    if (!set) return jdOf(y, mo, d, 0, 0);
    return cell.kind === "civil-set" ? set + 25 / 1440 : set;
  }
  if (cell.kind === "noon") {
    return riseSet(engine, "sun", start, NYC.lat, NYC.lonEast, "mtransit")
      ?? jdOf(y, mo, d, 16, 0);
  }
  if (cell.kind === "afternoon") return jdOf(y, mo, d, 20, 0);
  if (cell.kind === "morning") {
    const rise = riseSet(engine, "sun", start, NYC.lat, NYC.lonEast, "rise") ?? start;
    return rise + 90 / 1440;
  }
  if (cell.kind === "night" || cell.kind === "moonlit") {
    const set = riseSet(engine, "sun", start, NYC.lat, NYC.lonEast, "set");
    return (set ?? start) + 3 / 24;
  }
  return jdOf(y, mo, d, 16, 0);
}

const CELLS = [
  { id: "golden-e", aim: "E", kind: "sunrise", date: [2026, 6, 21] },
  { id: "civil-e", aim: "E", kind: "civil-rise", date: [2026, 6, 21] },
  { id: "morning-e", aim: "E", kind: "morning", date: [2026, 6, 21] },
  { id: "midday-s", aim: "S", kind: "noon", date: [2026, 6, 21] },
  { id: "midday-s-winter", aim: "S", kind: "noon", date: [2026, 12, 21] },
  { id: "day-s", aim: "S", kind: "afternoon", date: [2026, 8, 15] },
  { id: "day-w", aim: "W", kind: "afternoon", date: [2026, 8, 15] },
  { id: "golden-w", aim: "W", kind: "sunset", date: [2026, 6, 21] },
  { id: "civil-w", aim: "W", kind: "civil-set", date: [2026, 6, 21] },
  { id: "night-s", aim: "S", kind: "night", date: [2026, 1, 15] },
  { id: "night-e", aim: "E", kind: "night", date: [2026, 1, 15] },
  { id: "night-w", aim: "W", kind: "night", date: [2026, 1, 15] },
  { id: "night-n", aim: "N", kind: "night", date: [2026, 1, 15] },
  { id: "moonlit-s", aim: "S", kind: "moonlit", date: [2026, 8, 28] },
  { id: "moonlit-e", aim: "E", kind: "moonlit", date: [2026, 8, 28] },
  { id: "moonlit-w", aim: "W", kind: "moonlit", date: [2026, 8, 28] },
  { id: "overcast-s", aim: "S", kind: "noon", date: [2026, 6, 21],
    weather: "Low overcast, flat grey daylight, wet pavement, no direct sun disc." },
];

mkdirSync(join(OUT, "prompts"), { recursive: true });

const plates = [];
for (const cell of CELLS) {
  const jd = resolveJd(cell);
  const az = AIM_AZ[cell.aim];
  const sceneNote = [FOREGROUND[cell.aim], cell.weather].filter(Boolean).join(" ");
  const result = skyView(engine, jd, {
    observer: { lat: NYC.lat, lonEast: NYC.lonEast, altM: NYC.altM },
    aim: { azimuth: az, altitude: 8 },
    lens: "wide",
    image: { width: 1536, height: 1024 },
  }, {
    bortle: 8,
    promptStyle: "photoreal",
    sceneNote,
  });
  const prompt = result.renderPlan.background.prompt;
  writeFileSync(join(OUT, "prompts", `${cell.id}.txt`), prompt);
  const light = lightingOf(
    result.sky.sunAltitudeDeg,
    result.sky.moonAltitudeDeg ?? -90,
    result.sky.moonIllum ?? 0,
  );
  plates.push({
    id: cell.id,
    src: `/home/sky-plates/${cell.id}.webp`,
    lighting: cell.id.startsWith("overcast") ? "overcast" : light,
    aimBucket: cell.aim,
    promptFile: `prompts/${cell.id}.txt`,
    jdUt: jd,
    aimAz: az,
  });
  console.log(`${cell.id}\t${light}\t${cell.aim}\tsunAlt ${result.sky.sunAltitudeDeg}`);
}

writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify({
  observer: NYC,
  plates,
}, null, 2)}\n`);
console.log(`wrote ${plates.length} plates to ${OUT}`);
