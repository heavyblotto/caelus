import type { TwilightStage } from "caelus";
import { twilightStage } from "caelus";
import manifest from "../../public/home/sky-plates/manifest.json";

export type AimBucket = "N" | "E" | "S" | "W";
export type Lighting =
  | "day"
  | "morning"
  | "midday"
  | "golden"
  | "civil"
  | "night"
  | "moonlit"
  | "overcast";

export interface SkyPlate {
  id: string;
  src: string;
  lighting: Lighting;
  aimBucket: AimBucket;
  prompt?: string;
}

export const NYC_FOREGROUND: Record<AimBucket, string> = {
  E: "Foreground: New York City looking east from a Manhattan rooftop over the East River toward Brooklyn and Queens, Queensboro Bridge massing in the distance. No Sun, Moon, planets, or stars.",
  S: "Foreground: New York City looking south from midtown along the downtown harbor axis, Lower Manhattan towers. No Sun, Moon, planets, or stars.",
  W: "Foreground: New York City looking west from Manhattan across the Hudson River toward the New Jersey skyline. No Sun, Moon, planets, or stars.",
  N: "Foreground: New York City looking north through a denser midtown street canyon. No Sun, Moon, planets, or stars.",
};

const PLATES = manifest.plates as SkyPlate[];

export function aimBucket(azDeg: number): AimBucket {
  const a = ((azDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return "N";
  if (a < 135) return "E";
  if (a < 225) return "S";
  return "W";
}

export function lightingOf(
  sunAltDeg: number,
  moonAltDeg: number,
  moonIllum: number,
): Lighting {
  const stage: TwilightStage = twilightStage(sunAltDeg);
  if (stage === "day") {
    if (sunAltDeg < 12) return "golden";
    if (sunAltDeg < 40) return "morning";
    return "midday";
  }
  if (stage === "civil") return sunAltDeg > -4 ? "golden" : "civil";
  if (stage === "nautical") return "civil";
  if (moonAltDeg > 8 && moonIllum > 0.35) return "moonlit";
  return "night";
}

function score(plate: SkyPlate, light: Lighting, aim: AimBucket): number {
  let s = 0;
  if (plate.lighting === light) s += 4;
  else if (nearLighting(plate.lighting, light)) s += 2;
  if (plate.aimBucket === aim) s += 3;
  return s;
}

function nearLighting(a: Lighting, b: Lighting): boolean {
  const groups: Lighting[][] = [
    ["day", "morning", "midday"],
    ["golden", "civil"],
    ["night", "moonlit"],
  ];
  return groups.some((g) => g.includes(a) && g.includes(b));
}

/** Nearest pre-generated NYC plate for this sky state. */
export function pickPlate(
  sunAltDeg: number,
  moonAltDeg: number,
  moonIllum: number,
  aimAzDeg: number,
): SkyPlate | undefined {
  if (PLATES.length === 0) return undefined;
  const light = lightingOf(sunAltDeg, moonAltDeg, moonIllum);
  const aim = aimBucket(aimAzDeg);
  let best = PLATES[0];
  let bestScore = -1;
  for (const p of PLATES) {
    const sc = score(p, light, aim);
    if (sc > bestScore) {
      best = p;
      bestScore = sc;
    }
  }
  return best;
}
