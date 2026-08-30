"""astroengine.chart -- public API: natal charts, aspects, retrogrades."""
import math
from . import core
from .core import (Vsop, jd_tt, julian_day, planet_apparent, sun_apparent,
                   moon_apparent, pluto_apparent, mean_node, true_node,
                   equatorial, ayanamsa, mean_lilith, topocentric_ecl,
                   true_obliquity, nutation, DEG)
from . import houses as H
from .ranges import chart_warnings as _chart_warnings

BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
          "uranus", "neptune", "pluto", "chiron", "mean_node", "true_node"]

# Computable on request (not in the default chart set). Asteroids load
# lazily from their Chebyshev packs (Horizons fits, 1850-2150).
ASTEROIDS = ["ceres", "pallas", "juno", "vesta", "pholus"]
URANIANS = ["cupido", "hades", "zeus", "kronos", "apollon", "admetos",
            "vulkanus", "poseidon"]
# Planets whose VSOP87D series a Horizons-fit Chebyshev pack may supersede
# when `{body}_cheb.json` is on disk (fit_planet.py; the Pluto pattern).
PLANET_PACK_BODIES = {"mercury", "venus", "mars", "jupiter", "saturn",
                      "uranus", "neptune"}
EXTRA_BODIES = (["mean_lilith", "true_lilith", "intp_apog"]
                + ASTEROIDS + URANIANS)

# Points: excluded from aspect search by default.
NOT_ASPECTABLE = {"mean_node", "true_node", "mean_lilith", "true_lilith",
                  "intp_apog"}

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
         "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

ASPECTS = {"conjunction": 0, "sextile": 60, "square": 90, "trine": 120, "opposition": 180}
DEFAULT_ORBS = {"conjunction": 8, "sextile": 4, "square": 7, "trine": 7, "opposition": 8}

KM_PER_AU = 149597870.7

HOUSE_FNS = {
    "porphyry": None, "equal": None, "whole_sign": None, "placidus": None,  # legacy paths
    "koch": H.houses_koch,
    "regiomontanus": H.houses_regiomontanus,
    "campanus": H.houses_campanus,
    "alcabitius": H.houses_alcabitius,
    "morinus": H.houses_morinus,
    "meridian": H.houses_meridian,
    "polich_page": H.houses_polich_page,
    "vehlow": H.houses_vehlow,
}
HOUSE_SYSTEMS = list(HOUSE_FNS.keys())


# Star-anchored ayanamsas: the named star sits at the fixed sidereal
# longitude by definition (Galactic Center at 0 Sagittarius; Spica at
# 0 Libra "citra").
STAR_AYANAMSAS = {"galcent_0sag": ("Galactic Center", 240.0),
                  "true_citra": ("Spica", 180.0)}


def _parse_zodiac(zodiac):
    """'tropical' or 'sidereal:<ayanamsa>' -> ayanamsa mode or None."""
    if zodiac == "tropical":
        return None
    if zodiac.startswith("sidereal:"):
        mode = zodiac[len("sidereal:"):]
        if mode in core.AYANAMSA_J2000 or mode in STAR_AYANAMSAS:
            return mode
    raise ValueError(f"unknown zodiac {zodiac!r}")


class Engine:
    def __init__(self, level="full"):
        self.vsop = Vsop(level)
        self._packs = {}

    def _has_pluto_pack(self):
        """True when a wide-range Pluto Chebyshev pack is available on disk."""
        return self._has_pack("pluto")

    def _has_pack(self, body):
        """True when a `{body}_cheb.json` Chebyshev pack is on disk."""
        import os
        return os.path.exists(os.path.join(core.DATA, f"{body}_cheb.json"))

    def _pack(self, body):
        if body not in self._packs:
            import json
            import os
            if body in URANIANS:
                with open(os.path.join(core.DATA, "uranian_kepler.json")) as f:
                    pack = json.load(f)
                for name, els in pack["bodies"].items():
                    self._packs[name] = core.KeplerOrbit(els, pack["epoch"])
            else:
                from .chebyshev import ChebSeries
                path = os.path.join(core.DATA, f"{body}_cheb.json")
                if not os.path.exists(path):
                    raise ValueError(f"no data pack for {body!r}")
                self._packs[body] = ChebSeries.load(path)
        return self._packs[body]

    def _ecliptic(self, body, jde):
        """Apparent geocentric (lon rad, lat rad, dist AU or None)."""
        if body == "sun":
            return sun_apparent(self.vsop, jde)
        if body == "moon":
            if core.moon_in_precise_range(jde):
                lon, lat, km = core.moon_apparent_precise(jde)
            else:
                lon, lat, km = moon_apparent(jde)
            return lon, lat, km / KM_PER_AU
        if body == "pluto":
            # A wide-range Chebyshev pack when one is present (same heliocentric
            # pipeline as the small bodies), else the Meeus ch.37 series (valid
            # 1885-2099, accuracy degrades outside).
            if self._has_pluto_pack():
                return core.smallbody_apparent(self.vsop, self._pack("pluto"), jde)
            return pluto_apparent(self.vsop, jde)
        if body == "chiron":
            return core.chiron_apparent(self.vsop, jde)
        if body == "mean_node":
            return mean_node(jde), 0.0, None
        if body == "true_node":
            if core.moon_in_precise_range(jde):
                return core.true_node_precise(jde), 0.0, None
            return true_node(jde), 0.0, None
        if body == "mean_lilith":
            lon, lat = mean_lilith(jde)
            return lon, lat, None
        if body == "true_lilith":
            if core.moon_in_precise_range(jde):
                lon, lat, km = core.osc_apogee_precise(jde)
            else:
                lon, lat, km = core.osc_apogee_series(jde)
            return lon, lat, km / KM_PER_AU
        if body == "intp_apog":
            # Interpolated ("natural") lunar apogee: a spline through the
            # Moon's real apogee passages, refit as a Chebyshev pack (concept:
            # Swiss Ephemeris General Documentation, Dieter Koch; construction:
            # fit_intp_apog.py, from the engine's own DE-derived precise Moon).
            # The pack stores true-ecliptic-of-date unit vectors, so no
            # precession/light-time/aberration applies -- like the Lilith
            # points. Raises ValueError outside the fitted range.
            x, y, z = self._pack("intp_apog").xyz(jde)
            r = math.sqrt(x * x + y * y + z * z)
            lon = math.atan2(y, x) % (2 * math.pi)
            return lon, math.asin(z / r), None
        if body in ASTEROIDS or body in URANIANS:
            return core.smallbody_apparent(self.vsop, self._pack(body), jde)
        if body in PLANET_PACK_BODIES and self._has_pack(body):
            # A wide-range Chebyshev pack (fit to the Horizons/DE441 system
            # barycenter -- fit_planet.py) supersedes the VSOP87D series when
            # present, exactly the Pluto pattern: VSOP87 represents DE200 and
            # drifts to 3-17" against the modern ephemeris at the 1000/3000
            # edges (range-expansion.md); the pack pins the source itself.
            # Inert until a pack is minted: no pack, no behaviour change.
            return core.smallbody_apparent(self.vsop, self._pack(body), jde)
        return planet_apparent(self.vsop, body, jde)

    def _ayan_shift(self, jde, mode):
        """Degrees to subtract from a true-equinox tropical longitude."""
        if mode in STAR_AYANAMSAS:
            name, anchor = STAR_AYANAMSAS[mode]
            from . import stars as ST
            lon, _ = ST.star_apparent(self.vsop, ST.catalog()["stars"][name], jde)
            return (lon / DEG - anchor) % 360
        return (nutation(jde)[0] / DEG + ayanamsa(jde, mode)) % 360

    def fixed_star(self, name, jd_ut, zodiac="tropical"):
        """Apparent place of a catalog star: lon/lat/ra/dec (deg), sign, mag."""
        from . import stars as ST
        s = ST.catalog()["stars"][name]
        mode = _parse_zodiac(zodiac)
        jde = jd_tt(jd_ut)
        lon_r, lat_r = ST.star_apparent(self.vsop, s, jde)
        ra, dec = equatorial(lon_r, lat_r, true_obliquity(jde))
        lon = lon_r / DEG
        if mode is not None:
            lon = (lon - self._ayan_shift(jde, mode)) % 360
        return {"lon": lon, "lat": lat_r / DEG, "ra": ra / DEG, "dec": dec / DEG,
                "mag": s["mag"], "sign": SIGNS[int(lon // 30)], "sign_deg": lon % 30}

    def stars(self):
        from . import stars as ST
        return sorted(ST.catalog()["stars"])

    def _lon_lat_only(self, body, jd_ut, mode, topo):
        jde = jd_tt(jd_ut)
        lon, lat, dist = self._ecliptic(body, jde)
        if topo is not None and dist is not None:
            lst = (H.gast(jd_ut) + topo[1] * DEG) % (2 * math.pi)
            lon, lat, dist = topocentric_ecl(lon, lat, dist, lst,
                                             topo[0] * DEG, topo[2],
                                             true_obliquity(jde))
        lon_deg = lon / DEG
        if mode is not None:
            lon_deg = (lon_deg - self._ayan_shift(jde, mode)) % 360
        return lon_deg, lat / DEG

    def _lon_only(self, body, jd_ut, mode, topo):
        return self._lon_lat_only(body, jd_ut, mode, topo)[0]

    def longitude(self, body, jd_ut, zodiac="tropical", topocentric=False, observer=None):
        """Apparent geocentric ecliptic longitude (deg). Tropical: true
        equinox of date. Sidereal: mean equinox minus ayanamsa."""
        mode = _parse_zodiac(zodiac)
        topo = observer if topocentric else None
        return self._lon_only(body, jd_ut, mode, topo)

    def heliocentric(self, body, jd_ut):
        """Geometric heliocentric ecliptic of date (deg, deg, AU)."""
        jde = jd_tt(jd_ut)
        if body == "pluto" and not self._has_pluto_pack():
            l, b, r = core.pluto_heliocentric(jde)
            l, b = core._precess_ecliptic(l, b, core.J2000, jde)
        elif body == "chiron":
            if core._CHIRON is None:
                core.chiron_apparent(self.vsop, jde)  # loads the fit
            x, y, z = core._CHIRON.xyz(jde)
            r = math.sqrt(x * x + y * y + z * z)
            l = math.atan2(y, x) % (2 * math.pi)
            b = math.atan2(z, math.hypot(x, y))
            l, b = core._precess_ecliptic(l, b, core.J2000, jde)
        elif body in ASTEROIDS or body in URANIANS or body == "pluto":
            x, y, z = self._pack(body).xyz(jde)
            r = math.sqrt(x * x + y * y + z * z)
            l = math.atan2(y, x) % (2 * math.pi)
            b = math.atan2(z, math.hypot(x, y))
            l, b = core._precess_ecliptic(l, b, core.J2000, jde)
        elif body in PLANET_PACK_BODIES and self._has_pack(body):
            x, y, z = self._pack(body).xyz(jde)
            r = math.sqrt(x * x + y * y + z * z)
            l = math.atan2(y, x) % (2 * math.pi)
            b = math.atan2(z, math.hypot(x, y))
            l, b = core._precess_ecliptic(l, b, core.J2000, jde)
        elif body in core.PLANET_NAMES or body == "earth":
            l, b, r = self.vsop.heliocentric(body, jde)
        else:
            raise ValueError(f"no heliocentric position for {body!r}")
        return {"lon": l / DEG, "lat": b / DEG, "dist": r}

    def position(self, body, jd_ut, zodiac="tropical", topocentric=False, observer=None):
        """Full position: lon/speed/retrograde/sign + lat, dist (AU), ra, dec."""
        mode = _parse_zodiac(zodiac)
        topo = observer if topocentric else None
        jde = jd_tt(jd_ut)
        lon_r, lat_r, dist = self._ecliptic(body, jde)
        if topo is not None and dist is not None:
            lst = (H.gast(jd_ut) + topo[1] * DEG) % (2 * math.pi)
            lon_r, lat_r, dist = topocentric_ecl(lon_r, lat_r, dist, lst,
                                                 topo[0] * DEG, topo[2],
                                                 true_obliquity(jde))
        ra, dec = equatorial(lon_r, lat_r, true_obliquity(jde))
        lon = lon_r / DEG
        if mode is not None:
            lon = (lon - self._ayan_shift(jde, mode)) % 360
        h = 0.25  # days; central difference
        l0, b0 = self._lon_lat_only(body, jd_ut - h, mode, topo)
        l1, b1 = self._lon_lat_only(body, jd_ut + h, mode, topo)
        speed = ((l1 - l0 + 540) % 360 - 180) / (2 * h)
        lat_speed = (b1 - b0) / (2 * h)
        return {"lon": lon, "speed": speed, "retrograde": speed < 0,
                "sign": SIGNS[int(lon // 30)], "sign_deg": lon % 30,
                "lat": lat_r / DEG, "lat_speed": lat_speed, "dist": dist,
                "ra": ra / DEG, "dec": dec / DEG}

    def chart(self, y, mo, d, h, mi, s, lat, lon_east, house_system="placidus",
              zodiac="tropical", topocentric=False, extra_bodies=None, orbs=None,
              separation="longitude", aspects=None):
        """Full natal chart from calendar fields. Time is UT. East longitude
        positive. For a chart directly from a Julian Day, use ``chart_at``."""
        return self.chart_at(
            julian_day(y, mo, d, h, mi, s), lat, lon_east,
            house_system=house_system, zodiac=zodiac, topocentric=topocentric,
            extra_bodies=extra_bodies, orbs=orbs,
            separation=separation, aspects=aspects,
        )

    def chart_at(self, jd_ut, lat, lon_east, house_system="placidus",
                 zodiac="tropical", topocentric=False, extra_bodies=None,
                 orbs=None, separation="longitude", aspects=None):
        """Full natal chart from a Julian Day (UT). Identical to ``chart`` but
        skips the calendar round-trip. East longitude positive."""
        mode = _parse_zodiac(zodiac)
        observer = (lat, lon_east, 0.0) if topocentric else None
        names = BODIES + [b for b in (extra_bodies or []) if b not in BODIES]
        # A body outside its fitted span is reported, not crashed on (the TS
        # engine's RangeError -> Chart.unavailable, mirrored): the chart
        # computes with what covers the instant.
        bodies = {}
        unavailable = []
        for b in names:
            try:
                bodies[b] = self.position(b, jd_ut, zodiac=zodiac,
                                          topocentric=topocentric,
                                          observer=observer)
            except ValueError:
                unavailable.append(b)
        asc, mc, armc, eps = H.angles(jd_ut, lat, lon_east)
        vtx, east = H.vertex_east_point(armc, lat * DEG, eps)
        phi = lat * DEG
        used = house_system
        try:
            if house_system == "placidus":
                if abs(lat) < 66.0:
                    cusps = H.houses_placidus(armc, phi, eps)
                else:
                    raise ValueError("placidus undefined above polar circles")
            elif house_system == "porphyry":
                cusps = H.houses_porphyry(asc, mc)
            elif house_system == "equal":
                cusps = H.houses_equal(asc)
            elif house_system == "whole_sign":
                cusps = H.houses_whole_sign(asc)
            elif house_system in HOUSE_FNS and HOUSE_FNS[house_system]:
                cusps = HOUSE_FNS[house_system](armc, phi, eps)
            else:
                raise KeyError(house_system)
        except ValueError:
            used = "whole_sign"
            cusps = H.houses_whole_sign(asc)
        jde = jd_tt(jd_ut)
        shift = 0.0
        if mode is not None:
            shift = self._ayan_shift(jde, mode)

        def out_deg(rad):
            return (rad / DEG - shift) % 360

        if mode is not None and used == "whole_sign":
            # whole-sign cusps must stay sign-aligned in the sidereal zodiac
            sid_asc = out_deg(asc)
            first = (int(sid_asc // 30)) * 30.0
            cusps_deg = [(first + i * 30.0) % 360 for i in range(12)]
        else:
            cusps_deg = [out_deg(c) for c in cusps]
        return {
            "jd_ut": jd_ut,
            "zodiac": zodiac,
            "house_system": used,
            "house_system_requested": house_system,
            "bodies": bodies,
            "unavailable": unavailable,
            "angles": {"asc": out_deg(asc), "mc": out_deg(mc),
                       "vertex": out_deg(vtx), "east_point": out_deg(east)},
            "cusps": cusps_deg,
            "aspects": find_aspects(bodies, orbs, separation=separation,
                                    aspects=aspects),
            # Validity statements, mirrored from chart.ts chartWarnings text
            # for text -- the canonical digest pins the two engines equal.
            "warnings": _chart_warnings(jd_ut, list(bodies.keys()), self),
        }


def find_aspects(bodies, orbs=None, separation="longitude", aspects=None):
    """Aspects between bodies (mirrors TS findAspects).

    ``separation``: "longitude" (zodiacal, the default) or "spatial" (true
    great-circle separation via spherical.angular_separation_3d, accounting
    for ecliptic latitude). A partial ``orbs`` dict merges over DEFAULT_ORBS;
    a custom ``aspects`` table replaces ASPECTS and reads ``orbs`` for its
    own names only (a name with no orb entry is skipped).
    """
    from .spherical import angular_separation_3d
    table = aspects if aspects is not None else ASPECTS
    if aspects is not None:
        orb_table = orbs or {}
    else:
        orb_table = {**DEFAULT_ORBS, **(orbs or {})}
    spatial = separation == "spatial"
    h = 0.25  # days; central difference for the spatial-phase rate
    out = []
    names = [b for b in bodies if b not in NOT_ASPECTABLE]
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            e = (bodies[a]["lon"] - bodies[b]["lon"] + 180) % 360 - 180  # signed
            if spatial:
                sep = angular_separation_3d(bodies[a]["lon"], bodies[a]["lat"],
                                            bodies[b]["lon"], bodies[b]["lat"])
            else:
                sep = abs(e)
            for asp, angle in table.items():
                limit = orb_table.get(asp)
                if limit is None:
                    continue
                orb = abs(sep - angle)
                if orb <= limit:
                    orb_r = round(orb, 2)
                    # applying/separating from the closing of the signed orb;
                    # strength from the same rounded orb (mirrors TS findAspects).
                    signed_orb = sep - angle
                    if abs(signed_orb) < 1e-9:
                        phase = "exact"
                    elif spatial:
                        # No closed-form rate from longitude speeds alone:
                        # differentiate the 3D separation along each body's
                        # lon/lat rates (lat_speed absent -> 0).
                        def sep_at(dt):
                            return angular_separation_3d(
                                bodies[a]["lon"] + bodies[a]["speed"] * dt,
                                bodies[a]["lat"] + bodies[a].get("lat_speed", 0.0) * dt,
                                bodies[b]["lon"] + bodies[b]["speed"] * dt,
                                bodies[b]["lat"] + bodies[b].get("lat_speed", 0.0) * dt)
                        d_sep = (sep_at(h) - sep_at(-h)) / (2 * h)
                        d = (1 if signed_orb >= 0 else -1) * d_sep
                        phase = "applying" if d < 0 else "separating"
                    else:
                        d = ((1 if signed_orb >= 0 else -1) * (1 if e >= 0 else -1)
                             * (bodies[a]["speed"] - bodies[b]["speed"]))
                        phase = "applying" if d < 0 else "separating"
                    out.append({"a": a, "b": b, "aspect": asp, "orb": orb_r,
                                "phase": phase,
                                "strength": max(0.0, 1 - orb_r / limit)})
    return out


def fmt_lon(deg):
    sign = SIGNS[int(deg // 30)]
    d = deg % 30
    m = (d % 1) * 60
    return f"{int(d):2d}°{int(m):02d}' {sign}"
