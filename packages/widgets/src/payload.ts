/**
 * caelus-widgets — chart-to-wheel payload (internal).
 *
 * The serializable slice of an engine Chart that `ChartWheel` takes:
 * what every widget whose end state is the ordinary wheel carries in
 * its scene. Shared so the derivation and wheel-anatomy scenes cannot
 * disagree about what the finished figure is.
 */
import type { Chart } from "caelus";
import type { WheelChart } from "caelus-wheel";

export function wheelPayload(chart: Chart): WheelChart {
  const bodies: WheelChart["bodies"] = {};
  for (const [id, b] of Object.entries(chart.bodies)) {
    if (!b) continue;
    bodies[id] = {
      lon: b.lon,
      ...(b.retrograde ? { retrograde: true } : {}),
      ...(b.signDeg !== undefined ? { signDeg: b.signDeg } : {}),
    };
  }
  return {
    bodies,
    angles: { asc: chart.angles.asc, mc: chart.angles.mc },
    cusps: chart.cusps,
    aspects: chart.aspects.map(({ a, b, aspect, orb }) =>
      ({ a, b, aspect, orb })),
  };
}
