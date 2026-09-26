"""astroengine.draconic -- the draconic (nodal) chart transform.

The draconic zodiac re-zeroes the ecliptic at the Moon's ascending node:
0 Aries draconic sits at the node, so each point's draconic longitude is
mod(tropical longitude - node longitude, 360). Houses and angles transform
identically. Declinations and latitudes are untouched -- the transform
rotates the zodiacal reference, it does not move anything in space.

Conventions (mirrored bit for bit by the TS port, draconic.ts):
- Default node is the TRUE node ("true_node"), matching the engine's default
  chart set and its precise-Moon node handling; node="mean" selects the mean
  node ("mean_node").
- The transform applies to natal (or any single epoch's) longitudes; all
  inputs must come from the same moment.
- No zodiac option: an ayanamsa shifts body and node alike, so it cancels in
  the difference -- draconic longitudes are the same in every zodiac. The
  reference computes in the tropical zodiac.
"""
from .core import DEG
from . import houses as H

# node option -> engine body id
NODE_BODY = {"true": "true_node", "mean": "mean_node"}


def draconic_longitude(lon, node_lon):
    """Draconic longitude of a point: mod(lon - node_lon, 360)."""
    return (lon - node_lon) % 360.0


def draconic_longitudes(lons, node_lon):
    """Map named longitudes (dict) into the draconic zodiac, order preserved."""
    return {name: (lon - node_lon) % 360.0 for name, lon in lons.items()}


def node_longitude(engine, jd_ut, node="true"):
    """Tropical longitude of the chosen node ("true" or "mean") at jd (UT)."""
    body = NODE_BODY.get(node)
    if body is None:
        raise ValueError(f"unknown node {node!r} (use 'true' or 'mean')")
    return engine.longitude(body, jd_ut)


def draconic_chart(engine, jd_ut, bodies=None, node="true", lat=None,
                   lon_east=None):
    """Draconic longitudes of `bodies` at jd (default the standard chart set),
    plus the four angles when a place (lat, east-positive lon) is given.
    Returns {"node", "node_lon", "bodies", ["angles"]}; the node body itself
    maps to 0 by construction."""
    if bodies is None:
        from .chart import BODIES
        bodies = BODIES
    node_lon = node_longitude(engine, jd_ut, node)
    out = {"node": node, "node_lon": node_lon,
           "bodies": {b: draconic_longitude(engine.longitude(b, jd_ut),
                                            node_lon) for b in bodies}}
    if lat is not None and lon_east is not None:
        asc, mc, armc, eps = H.angles(jd_ut, lat, lon_east)
        vtx, east = H.vertex_east_point(armc, lat * DEG, eps)
        out["angles"] = {a: draconic_longitude(r / DEG, node_lon)
                         for a, r in [("asc", asc), ("mc", mc),
                                      ("vertex", vtx), ("east_point", east)]}
    return out
