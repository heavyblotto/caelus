"""astroengine.features -- a chart as a feature vector, similarity between
charts, and search for when the sky most resembles a target configuration.

Each body's ecliptic longitude is circular, so it contributes a unit-circle
point (cos, sin), optionally weighted. Cosine similarity between two such vectors
reduces to a weighted mean of cos(delta-longitude) per body: 1 when the
configurations coincide, falling off as bodies diverge. This is the deterministic
substrate for matching, retrieving, and searching chart configurations.

Pure geometry. The TS port (features.ts) reproduces it, pinned by the golden.
"""
import math

from .core import DEG

DEFAULT_BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter",
                  "saturn", "uranus", "neptune", "pluto"]


def feature_vector(weighted_lons):
    """weighted_lons: list of (longitude_deg, weight). Returns the flat vector
    [w*cos(lon), w*sin(lon), ...] in input order."""
    out = []
    for lon, w in weighted_lons:
        r = lon * DEG
        out.append(w * math.cos(r))
        out.append(w * math.sin(r))
    return out


def cosine_similarity(a, b):
    """Cosine similarity of two feature vectors, in [-1, 1]."""
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def chart_features(engine, jd_ut, bodies=None, weights=None, zodiac="tropical"):
    """Feature vector for the sky at jd_ut over an ordered set of bodies."""
    bodies = bodies if bodies is not None else DEFAULT_BODIES
    wl = []
    for b in bodies:
        w = 1.0 if weights is None else weights.get(b, 1.0)
        wl.append((engine.longitude(b, jd_ut, zodiac=zodiac), w))
    return feature_vector(wl)


def configuration_fit(engine, jd_ut, target, bodies=None, weights=None,
                      zodiac="tropical"):
    """Similarity between the sky at jd_ut and a target feature vector."""
    return cosine_similarity(
        chart_features(engine, jd_ut, bodies, weights, zodiac), target)
