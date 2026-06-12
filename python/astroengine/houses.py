"""astroengine.houses -- sidereal time, angles, house systems."""
import math
from .core import J2000, DEG, nutation, true_obliquity, jd_tt

TWO_PI = 2 * math.pi


def gmst(jd_ut):
    """Greenwich mean sidereal time, radians (IAU 1982 / Meeus 12.4)."""
    T = (jd_ut - J2000) / 36525.0
    deg = (280.46061837 + 360.98564736629 * (jd_ut - J2000)
           + 0.000387933 * T * T - T**3 / 38710000.0)
    return (deg % 360.0) * DEG


def gast(jd_ut):
    """Greenwich apparent sidereal time (adds equation of the equinoxes)."""
    jde = jd_tt(jd_ut)
    dpsi, _ = nutation(jde)
    eps = true_obliquity(jde)
    return (gmst(jd_ut) + dpsi * math.cos(eps)) % TWO_PI


def house_cusp(ra, pole, eps):
    """Ecliptic longitude where the house circle with pole `pole` crosses the
    ecliptic; `ra` measured like ARMC. The Ascendant is house_cusp(armc+90,
    phi); the MC is house_cusp(armc, 0)."""
    return math.atan2(
        math.sin(ra), math.cos(ra) * math.cos(eps) - math.sin(eps) * math.tan(pole)
    ) % TWO_PI


def _mc_of(armc, eps):
    return math.atan2(math.sin(armc), math.cos(armc) * math.cos(eps)) % TWO_PI


def _asc_of(armc, phi, eps):
    """Ascendant with the polar-latitude convention: the ASC always lies in
    the half-circle (MC, MC+180). Above ~66 deg the raw horizon intersection
    can be the setting one; Swiss Ephemeris applies the same correction."""
    asc = house_cusp(armc + math.pi / 2, phi, eps)
    if (asc - _mc_of(armc, eps)) % TWO_PI >= math.pi:
        asc = (asc + math.pi) % TWO_PI
    return asc


def angles(jd_ut, lat_deg, lon_deg):
    """Ascendant, MC, ARMC, obliquity. East longitude positive."""
    jde = jd_tt(jd_ut)
    eps = true_obliquity(jde)
    armc = (gast(jd_ut) + lon_deg * DEG) % TWO_PI  # local apparent ST
    phi = lat_deg * DEG
    mc = _mc_of(armc, eps)
    asc = _asc_of(armc, phi, eps)
    return asc, mc, armc, eps


def vertex_east_point(armc, phi, eps):
    """Vertex (western crossing of prime vertical and ecliptic) and east
    point (equatorial ascendant). Radians in, radians out."""
    colat = (math.pi / 2 - phi) if phi >= 0 else (-math.pi / 2 - phi)
    vtx = house_cusp(armc + 3 * math.pi / 2, colat, eps)
    # pick the western intersection: equatorial direction . east-point < 0
    dx = math.cos(vtx)
    dy = math.sin(vtx) * math.cos(eps)
    if dx * -math.sin(armc) + dy * math.cos(armc) > 0:
        vtx = (vtx + math.pi) % TWO_PI
    east = house_cusp(armc + math.pi / 2, 0.0, eps)
    return vtx, east


def houses_whole_sign(asc):
    first = (int(asc / (30 * DEG))) * 30 * DEG
    return [(first + i * 30 * DEG) % TWO_PI for i in range(12)]


def houses_equal(asc):
    return [(asc + i * 30 * DEG) % TWO_PI for i in range(12)]


def houses_porphyry(asc, mc):
    ic = (mc + math.pi) % TWO_PI
    dsc = (asc + math.pi) % TWO_PI
    def span(a, b):
        return (b - a) % TWO_PI
    q1 = span(asc, ic) if False else span(mc, asc)  # MC->ASC quadrant
    cusps = [0.0] * 12
    cusps[0] = asc
    cusps[9] = mc
    s = span(mc, asc) / 3.0           # houses 10,11,12
    cusps[10] = (mc + s) % TWO_PI
    cusps[11] = (mc + 2 * s) % TWO_PI
    s = span(asc, ic) / 3.0           # houses 1,2,3
    cusps[1] = (asc + s) % TWO_PI
    cusps[2] = (asc + 2 * s) % TWO_PI
    cusps[3] = ic
    cusps[6] = dsc
    for i in range(3):                # opposite cusps
        cusps[4 + i] = (cusps[10 + i if 10 + i < 12 else 10 + i - 12] + math.pi) % TWO_PI
    cusps[4] = (cusps[10] + math.pi) % TWO_PI
    cusps[5] = (cusps[11] + math.pi) % TWO_PI
    cusps[7] = (cusps[1] + math.pi) % TWO_PI
    cusps[8] = (cusps[2] + math.pi) % TWO_PI
    return cusps


def _fill_opposites(cusps):
    for k in (3, 4, 5):
        cusps[k] = (cusps[k + 6] + math.pi) % TWO_PI
    for k in (6, 7, 8):
        cusps[k] = (cusps[k - 6] + math.pi) % TWO_PI
    return cusps


def _quadrant_frame(armc, phi, eps, flip_mc=False):
    """Cusps 1 and 10. With flip_mc (Regiomontanus, Campanus, Polich-Page),
    the MC moves to the IC when the polar ASC correction fires, keeping the
    cusps in zodiacal order; Swiss Ephemeris does the same. Alcabitius and
    Koch keep the astronomical MC."""
    out = [0.0] * 12
    mc = _mc_of(armc, eps)
    asc = house_cusp(armc + math.pi / 2, phi, eps)
    if (asc - mc) % TWO_PI >= math.pi:
        asc = (asc + math.pi) % TWO_PI
        if flip_mc:
            mc = (mc + math.pi) % TWO_PI
    out[0] = asc
    out[9] = mc
    return out


def _signed(x):
    return ((x + math.pi) % TWO_PI) - math.pi


def _norm_arc(lon, lo, d):
    """Force a cusp candidate onto the short arc from lo spanning the signed
    angle d; the house-circle formula returns one of two antipodal
    intersections. d is negative when the polar ASC correction reverses the
    zodiacal direction of the house sequence."""
    off = _signed(lon - lo)
    inside = (0 <= off <= d) if d >= 0 else (d <= off <= 0)
    return lon if inside else (lon + math.pi) % TWO_PI


def _norm_quadrants(out):
    """Snap intermediate cusps onto their quadrants (11,12 between MC and
    ASC; 2,3 between ASC and IC) and fill opposites."""
    mc, asc = out[9], out[0]
    d_up = _signed(asc - mc)
    d_dn = _signed((mc + math.pi) % TWO_PI - asc)
    for k in (10, 11):
        out[k] = _norm_arc(out[k], mc, d_up)
    for k in (1, 2):
        out[k] = _norm_arc(out[k], asc, d_dn)
    return _fill_opposites(out)


def houses_koch(armc, phi, eps):
    """Koch (birthplace): cusps are ascendants at ARMC +/- k/3 of the MC
    degree's diurnal semi-arc. Undefined where the MC degree is circumpolar
    (|phi| >= 90 - eps, matching Swiss Ephemeris)."""
    if abs(phi) >= math.pi / 2 - eps:
        raise ValueError("koch undefined at polar latitudes")
    out = _quadrant_frame(armc, phi, eps)
    dec_mc = math.asin(math.sin(eps) * math.sin(out[9]))
    x = math.tan(phi) * math.tan(dec_mc)
    if abs(x) > 1:
        raise ValueError("koch undefined: MC degree circumpolar")
    sa = math.pi / 2 + math.asin(x)  # diurnal semi-arc of the MC degree
    out[10] = _asc_of(armc - 2 * sa / 3, phi, eps)
    out[11] = _asc_of(armc - sa / 3, phi, eps)
    out[1] = _asc_of(armc + sa / 3, phi, eps)
    out[2] = _asc_of(armc + 2 * sa / 3, phi, eps)
    return _fill_opposites(out)


def _east_of_meridian(lon, armc, eps):
    """Every quadrant-system house circle passes through the horizon's
    north/south points, so its two ecliptic crossings sit east and west of
    the meridian. Cusps 11, 12, 2, 3 are the eastern ones."""
    ra = math.atan2(math.sin(lon) * math.cos(eps), math.cos(lon))
    if math.sin(armc - ra) > 0:  # west of meridian: take the antipode
        return (lon + math.pi) % TWO_PI
    return lon


def houses_regiomontanus(armc, phi, eps):
    """Regiomontanus: equal divisions of the celestial equator; cusp poles
    tan P = tan(phi) sin(H)."""
    out = _quadrant_frame(armc, phi, eps, flip_mc=True)
    for k, h in ((10, 30), (11, 60), (1, 120), (2, 150)):
        pole = math.atan(math.tan(phi) * math.sin(h * DEG))
        out[k] = _east_of_meridian(house_cusp(armc + h * DEG, pole, eps), armc, eps)
    return _fill_opposites(out)


def houses_campanus(armc, phi, eps):
    """Campanus: equal divisions of the prime vertical. House circles run
    through the horizon's north/south points; cusps are their ecliptic
    crossings, assigned in zodiacal order MC->ASC->IC."""
    out = _quadrant_frame(armc, phi, eps, flip_mc=True)
    n = (-math.sin(phi) * math.cos(armc), -math.sin(phi) * math.sin(armc), math.cos(phi))
    zen = (math.cos(phi) * math.cos(armc), math.cos(phi) * math.sin(armc), math.sin(phi))
    east = (-math.sin(armc), math.cos(armc), 0.0)
    pole = (0.0, -math.sin(eps), math.cos(eps))  # ecliptic pole, equatorial frame

    def cusp(theta):
        t = theta * DEG
        v = tuple(east[i] * math.cos(t) + zen[i] * math.sin(t) for i in range(3))
        m = (n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0])
        d = (m[1] * pole[2] - m[2] * pole[1], m[2] * pole[0] - m[0] * pole[2],
             m[0] * pole[1] - m[1] * pole[0])
        return math.atan2(d[1] * math.cos(eps) + d[2] * math.sin(eps), d[0]) % TWO_PI

    for k, theta in ((10, 30), (11, 60), (1, 120), (2, 150)):
        out[k] = cusp(theta)
    out = _norm_quadrants(out)
    # within each quadrant the two cusps must be in house order (away
    # from MC, away from ASC)
    mc, asc = out[9], out[0]
    if abs(_signed(out[10] - mc)) > abs(_signed(out[11] - mc)):
        out[10], out[11] = out[11], out[10]
    if abs(_signed(out[1] - asc)) > abs(_signed(out[2] - asc)):
        out[1], out[2] = out[2], out[1]
    return _fill_opposites(out)


def houses_alcabitius(armc, phi, eps):
    """Alcabitius: trisect the Ascendant degree's semi-arcs in right
    ascension; project cusps along meridians."""
    out = _quadrant_frame(armc, phi, eps)
    dec = math.asin(math.sin(eps) * math.sin(out[0]))
    x = max(-1.0, min(1.0, math.tan(phi) * math.tan(dec)))
    ad = math.asin(x)
    sda = math.pi / 2 + ad   # diurnal semi-arc of the ASC degree
    sna = math.pi / 2 - ad
    for k, ra in ((10, armc + sda / 3), (11, armc + 2 * sda / 3),
                  (1, armc + math.pi - 2 * sna / 3), (2, armc + math.pi - sna / 3)):
        out[k] = math.atan2(math.sin(ra), math.cos(ra) * math.cos(eps)) % TWO_PI
    return _fill_opposites(out)


def houses_morinus(armc, phi, eps):
    """Morinus: equal RA divisions projected onto the ecliptic by great
    circles through the ecliptic poles. Latitude-independent."""
    return [math.atan2(math.sin(armc + (n + 3) * 30 * DEG) * math.cos(eps),
                       math.cos(armc + (n + 3) * 30 * DEG)) % TWO_PI
            for n in range(12)]


def houses_meridian(armc, phi, eps):
    """Meridian (axial rotation): equal RA divisions projected along hour
    circles. Latitude-independent."""
    return [math.atan2(math.sin(armc + (n + 3) * 30 * DEG),
                       math.cos(armc + (n + 3) * 30 * DEG) * math.cos(eps)) % TWO_PI
            for n in range(12)]


def houses_polich_page(armc, phi, eps):
    """Polich-Page ('topocentric'): cusp poles tan P = (k/3) tan(phi)."""
    out = _quadrant_frame(armc, phi, eps, flip_mc=True)
    for k, h, w in ((10, 30, 1), (11, 60, 2), (1, 120, 2), (2, 150, 1)):
        pole = math.atan(math.tan(phi) * w / 3.0)
        out[k] = _east_of_meridian(house_cusp(armc + h * DEG, pole, eps), armc, eps)
    return _fill_opposites(out)


def houses_vehlow(armc, phi, eps):
    """Vehlow: equal houses with the ASC at the middle of house 1."""
    asc = _asc_of(armc, phi, eps)
    return [(asc - 15 * DEG + n * 30 * DEG) % TWO_PI for n in range(12)]


def _placidus_cusp(armc, phi, eps, f, above):
    """Solve a Placidus intermediate cusp by fixed-point iteration.
    f: fraction of semi-arc (1/3 or 2/3); above: True for houses 11,12 (RA
    offsets measured from ARMC), False for 2,3 (from ARMC+180)."""
    if above:
        ra0 = armc + f * math.pi / (1.5 if f == 1/3 else 3.0)  # placeholder
    # Standard iteration (e.g. Koch & many references):
    #   houses 11: H = armc + 30deg scaled... use classic scheme below.
    raise NotImplementedError


def houses_placidus(armc, phi, eps):
    """Placidus cusps via the classic iterative scheme.

    For cusp k with semi-arc fraction f and base point:
      11th: RA = ARMC + 30deg,  f = 1/3   (diurnal)
      12th: RA = ARMC + 60deg,  f = 2/3   (diurnal)
       2nd: RA = ARMC + 120deg, f = 2/3   (nocturnal)
       3rd: RA = ARMC + 150deg, f = 1/3   (nocturnal)
    Iterate: D = asin(sin eps * sin lambda); A = f * asin(tan phi tan D);
      diurnal:  RA' = base - A ... implemented in ecliptic-longitude form.
    Fails above polar circles (as Placidus does); caller should fall back."""
    cusps = [None] * 12

    def cusp(offset_deg, f):
        # Semi-arc derivation: cusp point's hour angle H = -(fraction of
        # diurnal/nocturnal semi-arc), which reduces for ALL four cusps to
        #   RA = ARMC + offset + f * AD,  AD = asin(tan(phi) tan(dec))
        # offsets 30/60/120/150 with f = 1/3, 2/3, 2/3, 1/3.
        lam = (armc + offset_deg * DEG) % TWO_PI
        for _ in range(50):
            dec = math.asin(math.sin(eps) * math.sin(lam))
            x = math.tan(phi) * math.tan(dec)
            x = max(-1.0, min(1.0, x))
            ad = math.asin(x)
            ra_i = (armc + offset_deg * DEG + f * ad) % TWO_PI
            lam_new = math.atan2(math.sin(ra_i), math.cos(ra_i) * math.cos(eps)) % TWO_PI
            if abs((lam_new - lam + math.pi) % TWO_PI - math.pi) < 1e-10:
                lam = lam_new
                break
            lam = lam_new
        return lam

    asc, mc = None, None
    mc = math.atan2(math.sin(armc), math.cos(armc) * math.cos(eps)) % TWO_PI
    asc = math.atan2(
        math.cos(armc),
        -(math.sin(armc) * math.cos(eps) + math.tan(phi) * math.sin(eps)),
    ) % TWO_PI
    cusps[0] = asc
    cusps[9] = mc
    cusps[10] = cusp(30, 1.0 / 3.0)    # 11th
    cusps[11] = cusp(60, 2.0 / 3.0)    # 12th
    cusps[1] = cusp(120, 2.0 / 3.0)     # 2nd
    cusps[2] = cusp(150, 1.0 / 3.0)     # 3rd
    cusps[3] = (mc + math.pi) % TWO_PI
    cusps[6] = (asc + math.pi) % TWO_PI
    cusps[4] = (cusps[10] + math.pi) % TWO_PI
    cusps[5] = (cusps[11] + math.pi) % TWO_PI
    cusps[7] = (cusps[1] + math.pi) % TWO_PI
    cusps[8] = (cusps[2] + math.pi) % TWO_PI
    return cusps
