import type { DerivationScene } from "caelus-widgets/derivation";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Photographic opening aim: Sun if up, else twilight Sun, else Moon, else south. */
export function scenicAim(scene: DerivationScene): { az: number; alt: number } {
  const sun = scene.bodies.find((b) => b.id === "sun");
  const moon = scene.bodies.find((b) => b.id === "moon");
  if (sun && sun.altDeg > 5) {
    return { az: sun.azDeg, alt: clamp(sun.altDeg, 8, 25) };
  }
  if (sun && sun.altDeg > -12) {
    return { az: sun.azDeg, alt: 8 };
  }
  if (moon && moon.altDeg > 5) {
    return { az: moon.azDeg, alt: clamp(moon.altDeg, 8, 30) };
  }
  return { az: 180, alt: 25 };
}
