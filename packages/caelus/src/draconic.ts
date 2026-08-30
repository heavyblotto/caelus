/**
 * astroengine draconic -- the draconic (nodal) chart transform.
 *
 * The draconic zodiac re-zeroes the ecliptic at the Moon's ascending node:
 * 0 Aries draconic sits at the node, so each point's draconic longitude is
 * mod(tropical longitude - node longitude, 360). Houses and angles transform
 * identically. Declinations and latitudes are untouched -- the transform
 * rotates the zodiacal reference, it does not move anything in space.
 *
 * Conventions (mirroring the Python reference, astroengine/draconic.py):
 * - Default node is the TRUE node ("true_node"), matching the engine's
 *   default chart set and its precise-Moon node handling; "mean" selects the
 *   mean node ("mean_node").
 * - The transform applies to natal (or any single epoch's) longitudes; all
 *   inputs must come from the same moment.
 * - No zodiac option: an ayanamsa shifts body and node alike, so it cancels
 *   in the difference -- draconic longitudes are the same in every zodiac.
 *   Everything is computed in the tropical zodiac.
 */
import { mod, DEG } from "./core.js";
import { Engine, BodyId, BODIES } from "./chart.js";
import { angles, vertexEastPoint } from "./houses.js";

/** Which lunar node anchors the draconic zodiac. */
export type DraconicNode = "true" | "mean";

/** node option -> engine body id */
export const NODE_BODY: Record<DraconicNode, BodyId> = {
  true: "true_node",
  mean: "mean_node",
};

/** A draconic chart: node choice, its tropical longitude, and every point's
 *  draconic longitude (degrees). `angles` is present when a place was given. */
export interface DraconicChart {
  node: DraconicNode;
  node_lon: number;
  bodies: Record<string, number>;
  angles?: { asc: number; mc: number; vertex: number; east_point: number };
}

/** Draconic longitude of a point: mod(lon - nodeLon, 360). */
export function draconicLongitude(lon: number, nodeLon: number): number {
  return mod(lon - nodeLon, 360);
}

/** Map named longitudes into the draconic zodiac, insertion order preserved. */
export function draconicLongitudes(
  lons: Record<string, number>, nodeLon: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, lon] of Object.entries(lons)) out[name] = mod(lon - nodeLon, 360);
  return out;
}

/** Tropical longitude of the chosen node ("true" or "mean") at jd (UT). */
export function nodeLongitude(
  engine: Engine, jdUt: number, node: DraconicNode = "true",
): number {
  const body = NODE_BODY[node];
  if (!body) throw new Error(`unknown node ${JSON.stringify(node)} (use 'true' or 'mean')`);
  return engine.longitude(body, jdUt);
}

/**
 * Draconic longitudes of `bodies` at jd (default the standard chart set),
 * plus the four angles when a place (lat, east-positive lon) is given. The
 * node body itself maps to 0 by construction.
 */
export function draconicChart(
  engine: Engine, jdUt: number, bodies: BodyId[] = BODIES as unknown as BodyId[],
  node: DraconicNode = "true", lat?: number, lonEast?: number,
): DraconicChart {
  const nodeLon = nodeLongitude(engine, jdUt, node);
  const out: DraconicChart = { node, node_lon: nodeLon, bodies: {} };
  for (const b of bodies) {
    out.bodies[b] = draconicLongitude(engine.longitude(b, jdUt), nodeLon);
  }
  if (lat !== undefined && lonEast !== undefined) {
    const [asc, mc, armc, eps] = angles(engine.data, jdUt, lat, lonEast);
    const [vtx, east] = vertexEastPoint(armc, lat * DEG, eps);
    out.angles = {
      asc: draconicLongitude(asc / DEG, nodeLon),
      mc: draconicLongitude(mc / DEG, nodeLon),
      vertex: draconicLongitude(vtx / DEG, nodeLon),
      east_point: draconicLongitude(east / DEG, nodeLon),
    };
  }
  return out;
}
