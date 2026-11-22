#!/usr/bin/env python3
"""Self-check for astroengine.observe (physical spacetime observation,
verification, chronolocation, geolocation, and chronosense).

Covers forward physics invariants, 3D sloped-ground ray-plane shadows,
zenith-frame lunar bright-limb parity with astroengine.skyview, diurnal and
polar edge cases, Lahaina noon and full/new Moon indeterminate handling,
counterfactual diagnostics (whole-hour, half-hour UTC+5:30, hemisphere flip,
seasonal shift), chronolocate pruning soundness and <1s edge bisection,
Path A closed-form analytical geolocation (including 2-root ambiguity), and
Path B global spherical grid geolocation (antimeridian wrap, double altitude,
shadow + bright-limb, region classification).

Run: python3 python/test_observe.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import DEG, julian_day
from astroengine import electional as EL
from astroengine import events as EV
from astroengine import observe as OB
from astroengine import pheno as PH
from astroengine import skyview as SV

eng = Engine("embedded")

checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def wrap180(x):
    r = (x + 180.0) % 360.0 - 180.0
    return 180.0 if r == -180.0 else r


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = lat1 * DEG, lat2 * DEG
    dp, dl = (lat2 - lat1) * DEG, wrap180(lon2 - lon1) * DEG
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2.0 * 6371.0 * math.asin(min(1.0, math.sqrt(max(0.0, a))))


def assert_all_finite(obj, path="root"):
    if isinstance(obj, float):
        ok(math.isfinite(obj), f"{path} is finite ({obj})")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            assert_all_finite(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            assert_all_finite(v, f"{path}[{idx}]")


# ============================================================================
# 1. scene_geometry: forward solar, shadow, refraction, elevation invariants
# ============================================================================
jd_nyc = julian_day(2026, 6, 21, 18, 0, 0)  # NYC summer afternoon
sc_nyc = OB.scene_geometry(
    eng, jd_nyc, 40.7128, -74.0060,
    camera_aim_az_deg=180.0, camera_aim_alt_deg=5.0,
    prev_jd_ut=jd_nyc - 0.8, deadline_jd_ut=jd_nyc + 45.0 / 1440.0,
)
assert_all_finite(sc_nyc, "nyc")

# Exact agreement with pheno.az_alt and skyview helpers
sun_p = eng.position("sun", jd_nyc)
ref_az, ref_alt = PH.az_alt(sun_p["lon"], sun_p["lat"], jd_nyc, 40.7128, -74.0060)
ref_app = PH.refract_true_to_apparent(ref_alt)
ok(abs(sc_nyc["sun"]["azimuth_deg"] - ref_az) < 1e-12, "sun az matches pheno.az_alt")
ok(abs(sc_nyc["sun"]["altitude_true_deg"] - ref_alt) < 1e-12, "sun alt_true matches pheno.az_alt")
ok(abs(sc_nyc["sun"]["altitude_apparent_deg"] - ref_app) < 1e-12, "sun alt_app matches refraction")
ok(abs(sc_nyc["sun"]["airmass"] - SV.airmass(ref_app)) < 1e-12, "airmass matches skyview")
ok(abs(sc_nyc["sun"]["extinction_mag"] - SV.extinction_mag(ref_app)) < 1e-12, "extinction matches skyview")
ok(sc_nyc["sun"]["is_day"] is True and sc_nyc["sun"]["twilight_stage"] == "day", "NYC summer afternoon is day")
ok(sc_nyc["sun"]["trend"] == "setting", "NYC 18:00 UT (14:00 EDT) Sun is setting")
ok(sc_nyc["sun"]["rate_alt_deg_per_min"] < 0.0, "setting Sun has negative alt rate")
ok(sc_nyc["sun"]["rate_az_deg_per_min"] > 0.0, "Northern Hemisphere Sun sweeps clockwise (+)")
ok(0.5 < sc_nyc["sun"]["angular_diameter_deg"] < 0.56, "Sun angular diameter ~0.53 deg")

# Flat-ground shadow invariants
shd = sc_nyc["shadow"]
ok(shd["cast"] is True and shd["self_shadowed"] is False, "NYC afternoon casts flat shadow")
ok(abs(wrap180(shd["bearing_deg"] - (ref_az + 180.0))) < 1e-12, "flat shadow bearing opposite Sun")
ok(abs(shd["length_ratio"] - 1.0 / math.tan(ref_app * DEG)) < 1e-12, "flat length_ratio == 1/tan(alt_app)")
ok(abs(shd["horizontal_length_ratio"] - shd["length_ratio"]) < 1e-12, "flat horiz == length_ratio")
ok(abs(shd["penumbra_deg"] - sc_nyc["sun"]["angular_diameter_deg"]) < 1e-12, "penumbra == sun diameter")
ok(shd["rate_bearing_deg_per_min"] > 0.0, "Northern Hemisphere shadow sweeps clockwise (+)")
ok(shd["rate_length_ratio_per_min"] > 0.0, "afternoon shadow is lengthening (+)")

# Independent finite-diff check of rate_length_ratio_per_min
sc_m = OB.scene_geometry(eng, jd_nyc - 1.0 / 1440.0, 40.7128, -74.0060)
sc_p = OB.scene_geometry(eng, jd_nyc + 1.0 / 1440.0, 40.7128, -74.0060)
fd_len = (sc_p["shadow"]["length_ratio"] - sc_m["shadow"]["length_ratio"]) * 0.5
ok(abs(shd["rate_length_ratio_per_min"] - fd_len) < 1e-4,
   f"flat rate_length_ratio matches finite diff ({shd['rate_length_ratio_per_min']:.6f} vs {fd_len:.6f})")

# Southern Hemisphere clockwise/counterclockwise shadow sweep check (Sydney midday)
jd_syd = julian_day(2026, 1, 15, 2, 0, 0)  # ~13:00 AEDT
sc_syd = OB.scene_geometry(eng, jd_syd, -33.8688, 151.2093)
ok(sc_syd["sun"]["is_day"] is True, "Sydney midday is day")
ok(sc_syd["sun"]["rate_az_deg_per_min"] < 0.0, "Southern Hemisphere Sun sweeps counterclockwise (-)")
ok(sc_syd["shadow"]["rate_bearing_deg_per_min"] < 0.0, "Southern Hemisphere shadow sweeps counterclockwise (-)")

# Morning rising vs solar noon culminating vs solar midnight nadir
noon_jd = sc_nyc["diurnal"]["solar_noon_jd"]
ok(noon_jd is not None, "NYC solar_noon_jd present")
sc_noon = OB.scene_geometry(eng, noon_jd, 40.7128, -74.0060)
ok(sc_noon["sun"]["trend"] == "culminating", f"at solar noon trend is culminating ({sc_noon['sun']['trend']})")
sc_morn = OB.scene_geometry(eng, noon_jd - 3.0 / 24.0, 40.7128, -74.0060)
ok(sc_morn["sun"]["trend"] == "rising" and sc_morn["shadow"]["rate_length_ratio_per_min"] < 0.0,
   "morning Sun rises and shadow shrinks")
nadir_jd = EV.rise_set(eng, "sun", noon_jd, 40.7128, -74.0060, kind="itransit")
sc_nadir = OB.scene_geometry(eng, nadir_jd, 40.7128, -74.0060)
ok(sc_nadir["sun"]["trend"] == "nadir" and sc_nadir["sun"]["is_day"] is False,
   f"at lower transit trend is nadir ({sc_nadir['sun']['trend']})")
ok(sc_nadir["shadow"]["cast"] is False and sc_nadir["shadow"]["bearing_deg"] is None
   and sc_nadir["shadow"]["length_ratio"] is None and sc_nadir["shadow"]["penumbra_deg"] is None,
   "night scene casts no shadow")

# All 5 twilight stages consistency with is_day
seen_stages = set()
for h_off in range(0, 24 * 6):
    t_test = julian_day(2026, 3, 21, 0, 0, 0) + h_off / 144.0
    st_sc = OB.scene_geometry(eng, t_test, 45.0, 0.0)
    st = st_sc["sun"]["twilight_stage"]
    seen_stages.add(st)
    if st == "day":
        ok(st_sc["sun"]["is_day"] is True, "twilight=day implies is_day=True")
    else:
        ok(st_sc["sun"]["is_day"] is False, "twilight!=day implies is_day=False")
    if len(seen_stages) == 5:
        break
ok(seen_stages == {"day", "civil", "nautical", "astronomical", "night"},
   f"all 5 twilight stages reached ({seen_stages})")

# Elevation effect: 3000m elevation has smaller refraction than sea level at low Sun
jd_low_nyc = julian_day(2026, 3, 21, 22, 45, 0)
sc_sea = OB.scene_geometry(eng, jd_low_nyc, 40.7128, -74.0060, elevation_m=0.0)
sc_mtn = OB.scene_geometry(eng, jd_low_nyc, 40.7128, -74.0060, elevation_m=3000.0)
ok(sc_sea["sun"]["altitude_apparent_deg"] > sc_mtn["sun"]["altitude_apparent_deg"] > sc_sea["sun"]["altitude_true_deg"],
   "3000m elevation reduces atmospheric refraction relative to sea level")


# ============================================================================
# 2. Sloped terrain 3D shadow geometry & self-shadowing
# ============================================================================
jd_late = julian_day(2026, 3, 21, 22, 0, 0)  # Sun low in WSW (~12.3 deg)
sc_flat = OB.scene_geometry(eng, jd_late, 40.7128, -74.0060)
s_az = sc_flat["sun"]["azimuth_deg"]
s_alt = sc_flat["sun"]["altitude_apparent_deg"]
flat_l = sc_flat["shadow"]["length_ratio"]

# Sun-facing slope (downhill faces Sun -> shadow runs uphill -> shorter!)
sc_uphill = OB.scene_geometry(eng, jd_late, 40.7128, -74.0060,
                              slope_deg=15.0, slope_azimuth_deg=s_az)
ok(sc_uphill["shadow"]["cast"] is True and sc_uphill["shadow"]["self_shadowed"] is False,
   "sun-facing slope casts shadow")
ok(sc_uphill["shadow"]["length_ratio"] < flat_l, "uphill shadow is shorter than flat shadow")
ok(sc_uphill["shadow"]["horizontal_length_ratio"] < sc_uphill["shadow"]["length_ratio"],
   "sloped horizontal_length_ratio < 3D length_ratio")

# Verify exact 3D plane orthogonality n . Q == 0 for sloped shadow
sig, alp = 15.0 * DEG, s_az * DEG
n_vec = (math.sin(sig) * math.sin(alp), math.sin(sig) * math.cos(alp), math.cos(sig))
s_vec = SV.dir_from_az_alt(s_az, s_alt)
t_ray = n_vec[2] / sum(a * b for a, b in zip(n_vec, s_vec))
q_vec = (-t_ray * s_vec[0], -t_ray * s_vec[1], 1.0 - t_ray * s_vec[2])
ok(abs(sum(a * b for a, b in zip(n_vec, q_vec))) < 1e-12, "3D ray-plane Q lies on sloped plane")
ok(abs(sc_uphill["shadow"]["length_ratio"] - math.sqrt(sum(c * c for c in q_vec))) < 1e-12,
   "sloped length_ratio == ||Q||")
ok(abs(sc_uphill["shadow"]["horizontal_length_ratio"] - math.hypot(q_vec[0], q_vec[1])) < 1e-12,
   "sloped horizontal_length_ratio == hypot(Qx, Qy)")

# Check sloped rate_length_ratio_per_min against finite difference
sc_up_m = OB.scene_geometry(eng, jd_late - 1.0 / 1440.0, 40.7128, -74.0060,
                            slope_deg=15.0, slope_azimuth_deg=s_az)
sc_up_p = OB.scene_geometry(eng, jd_late + 1.0 / 1440.0, 40.7128, -74.0060,
                            slope_deg=15.0, slope_azimuth_deg=s_az)
fd_sloped = (sc_up_p["shadow"]["length_ratio"] - sc_up_m["shadow"]["length_ratio"]) * 0.5
ok(abs(sc_uphill["shadow"]["rate_length_ratio_per_min"] - fd_sloped) < 1e-3,
   f"sloped rate_length_ratio matches finite diff ({sc_uphill['shadow']['rate_length_ratio_per_min']:.5f} vs {fd_sloped:.5f})")

# Downhill shadow (gentle anti-sun slope < sun_alt -> longer!)
opp_az = (s_az + 180.0) % 360.0
sc_downhill = OB.scene_geometry(eng, jd_late, 40.7128, -74.0060,
                                slope_deg=5.0, slope_azimuth_deg=opp_az)
ok(sc_downhill["shadow"]["cast"] is True and sc_downhill["shadow"]["length_ratio"] > flat_l,
   "downhill shadow is longer than flat shadow")

# Steep anti-sun slope (slope > sun_alt -> self-shadowed!)
sc_self = OB.scene_geometry(eng, jd_late, 40.7128, -74.0060,
                            slope_deg=25.0, slope_azimuth_deg=opp_az)
ok(sc_self["shadow"]["cast"] is False and sc_self["shadow"]["self_shadowed"] is True,
   "steep anti-sun slope is self-shadowed")
ok(sc_self["shadow"]["length_ratio"] is None and sc_self["shadow"]["bearing_deg"] is None,
   "self-shadowed slope has null length and bearing")

# Night on steep sun-facing slope is NOT cast and NOT self-shadowed
sc_night_slope = OB.scene_geometry(eng, nadir_jd, 40.7128, -74.0060,
                                   slope_deg=45.0, slope_azimuth_deg=sc_nadir["sun"]["azimuth_deg"])
ok(sc_night_slope["shadow"]["cast"] is False and sc_night_slope["shadow"]["self_shadowed"] is False,
   "below-horizon Sun on steep slope is night, not self-shadowed")


# ============================================================================
# 3. Camera lighting & glare risk
# ============================================================================
ok(OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060)["lighting"] is None,
   "lighting is None when camera_aim_az_deg omitted")
sc_glare_direct = OB.scene_geometry(
    eng, jd_nyc, 40.7128, -74.0060,
    camera_aim_az_deg=ref_az, camera_aim_alt_deg=ref_app,
)
ok(abs(sc_glare_direct["lighting"]["sun_relative_az_deg"]) < 1e-9, "camera at Sun has rel_az=0")
ok(abs(abs(sc_glare_direct["lighting"]["shadow_screen_az_deg"]) - 180.0) < 1e-9,
   "camera at Sun has shadow_screen_az=180")
ok(sc_glare_direct["lighting"]["glare_risk"] == "direct", "aimed directly at Sun -> direct glare")

sc_glare_away = OB.scene_geometry(
    eng, jd_nyc, 40.7128, -74.0060,
    camera_aim_az_deg=(ref_az + 180.0) % 360.0, camera_aim_alt_deg=0.0,
)
ok(abs(abs(sc_glare_away["lighting"]["sun_relative_az_deg"]) - 180.0) < 1e-9, "back-to-Sun rel_az=180")
ok(abs(sc_glare_away["lighting"]["shadow_screen_az_deg"]) < 1e-9, "back-to-Sun shadow straight ahead")
ok(sc_glare_away["lighting"]["glare_risk"] == "none", "back-to-Sun -> none glare")

sc_glare_right = OB.scene_geometry(
    eng, jd_nyc, 40.7128, -74.0060,
    camera_aim_az_deg=(ref_az - 90.0) % 360.0, camera_aim_alt_deg=0.0,
)
ok(abs(sc_glare_right["lighting"]["sun_relative_az_deg"] - 90.0) < 1e-9, "Sun to right -> +90")
ok(abs(sc_glare_right["lighting"]["shadow_screen_az_deg"] + 90.0) < 1e-9, "shadow to left -> -90")

sc_glare_night = OB.scene_geometry(
    eng, nadir_jd, 40.7128, -74.0060,
    camera_aim_az_deg=sc_nadir["sun"]["azimuth_deg"], camera_aim_alt_deg=0.0,
)
ok(sc_glare_night["lighting"]["glare_risk"] == "none"
   and sc_glare_night["lighting"]["shadow_screen_az_deg"] is None,
   "night camera lighting has no glare and no shadow")


# ============================================================================
# 4. Moon geometry, zenith-frame bright limb parity with skyview, moon shadow
# ============================================================================
# Cross-module parity: when skyview aims directly at the Moon, bright_limb_angle_deg
# must equal observe's lens-independent bright_limb_zenith_deg (within skyview's 0.1 deg rounding)
jd_moon = julian_day(2024, 3, 20, 22, 0, 0)
sc_lon = OB.scene_geometry(eng, jd_moon, 51.5, -0.12)
m_az = sc_lon["moon"]["azimuth_deg"]
m_alt_t = sc_lon["moon"]["altitude_true_deg"]
sv_lon = SV.sky_bodies(eng, jd_moon, {
    "observer": {"lat": 51.5, "lon_east": -0.12},
    "aim": {"azimuth": m_az, "altitude": m_alt_t},
    "lens": "normal",
    "image": {"width": 1024, "height": 683},
})
sv_moon = [b for b in sv_lon["bodies"] if b["id"] == "moon"][0]
ok(abs(wrap180(sc_lon["moon"]["bright_limb_zenith_deg"] - sv_moon["bright_limb_angle_deg"])) <= 0.06,
   f"bright_limb_zenith_deg matches skyview ({sc_lon['moon']['bright_limb_zenith_deg']:.2f} vs {sv_moon['bright_limb_angle_deg']})")

# Hemisphere tilt flip for waxing crescent evening Moon (2026-06-18, ~3 days after new Moon)
# Evening west sky at lon=0 (~21:00 UT): compare +40N, 0N (equator), -40S
jd_cres = julian_day(2026, 6, 18, 20, 30, 0)
sc_c_n = OB.scene_geometry(eng, jd_cres, 40.0, 0.0)
sc_c_eq = OB.scene_geometry(eng, jd_cres, 0.0, 0.0)
sc_c_s = OB.scene_geometry(eng, jd_cres, -35.0, 0.0)
ok(sc_c_n["moon"]["waxing"] is True and 0.05 < sc_c_n["moon"]["illum"] < 0.30,
   "2026-06-18 is a waxing crescent Moon")
# Northern hemisphere: bright limb points lower-right (270..360 deg); Southern: lower-left (180..270 deg)
ok(270.0 < sc_c_n["moon"]["bright_limb_zenith_deg"] < 360.0,
   f"North waxing crescent points lower-right ({sc_c_n['moon']['bright_limb_zenith_deg']:.1f})")
ok(180.0 < sc_c_s["moon"]["bright_limb_zenith_deg"] < 270.0,
   f"South waxing crescent points lower-left ({sc_c_s['moon']['bright_limb_zenith_deg']:.1f})")
ok(abs(wrap180(sc_c_eq["moon"]["bright_limb_zenith_deg"] - 270.0)) < 25.0,
   f"Equator waxing crescent points nearly straight down ({sc_c_eq['moon']['bright_limb_zenith_deg']:.1f})")

# Moonlight shadow: cast at night with bright Moon (>= 0.5), NOT in daylight
ok(sc_lon["moon"]["shadow_cast"] is True and sc_lon["moon"]["shadow_bearing_deg"] is not None
   and sc_lon["moon"]["shadow_length_ratio"] is not None,
   "London night gibbous Moon casts lunar shadow")
ok(abs(wrap180(sc_lon["moon"]["shadow_bearing_deg"] - (sc_lon["moon"]["azimuth_deg"] + 180.0))) < 1e-12,
   "lunar shadow bearing opposite Moon")
ok(sc_nyc["moon"]["shadow_cast"] is False, "daytime Moon casts no shadow")
ok(sc_c_n["moon"]["shadow_cast"] is False, "thin crescent (<0.5 illum) casts no shadow")


# ============================================================================
# 5. Visible planets & Bortle limiting_mag
# ============================================================================
sc_dark = OB.scene_geometry(eng, jd_moon, 51.5, -0.12, bortle=1)
sc_city = OB.scene_geometry(eng, jd_moon, 51.5, -0.12, bortle=9)
ok(all(p["altitude_apparent_deg"] > 0.0 for p in sc_dark["visible_planets"]),
   "all visible_planets are above horizon")
ok(len(sc_dark["visible_planets"]) == len(sc_city["visible_planets"]),
   "above-horizon planet list independent of Bortle")
ok(sum(1 for p in sc_dark["visible_planets"] if p["naked_eye"])
   >= sum(1 for p in sc_city["visible_planets"] if p["naked_eye"]),
   "Bortle 1 sees at least as many naked-eye planets as Bortle 9")


# ============================================================================
# 6. Diurnal, polar edge cases, and chronosense
# ============================================================================
diu = sc_nyc["diurnal"]
ok(diu["sunrise_jd"] < diu["solar_noon_jd"] < diu["sunset_jd"],
   "NYC diurnal order: sunrise < solar_noon < sunset")
ok(diu["next_transition_kind"] == "sunset" and diu["minutes_to_next_twilight"] > 0.0,
   f"NYC afternoon next transition is sunset ({diu['next_transition_kind']})")
# Verify transition instant sits right on the day/civil boundary
t_set_pred = jd_nyc + diu["minutes_to_next_twilight"] / 1440.0
sc_before_set = OB.scene_geometry(eng, t_set_pred - 5.0 / 86400.0, 40.7128, -74.0060)
sc_after_set = OB.scene_geometry(eng, t_set_pred + 5.0 / 86400.0, 40.7128, -74.0060)
ok(sc_before_set["sun"]["is_day"] is True and sc_before_set["sun"]["altitude_apparent_deg"] < 0.05,
   f"5s before predicted sunset is still day near horizon ({sc_before_set['sun']['altitude_apparent_deg']:.4f} deg)")
ok(sc_after_set["sun"]["is_day"] is False and sc_after_set["sun"]["twilight_stage"] == "civil",
   f"5s after predicted sunset is civil twilight ({sc_after_set['sun']['twilight_stage']})")
ok(diu["planetary_hour"] == EL.planetary_hour(eng, jd_nyc, 40.7128, -74.0060),
   "diurnal planetary_hour matches electional.planetary_hour")

# Polar midnight sun, polar night, and exact poles (lat = +/-90)
for label, jd_p, la_p, lo_p in (
    ("polar-summer-svalbard", julian_day(2026, 6, 21, 23, 0, 0), 78.2, 15.6),
    ("polar-winter-svalbard", julian_day(2026, 12, 21, 11, 0, 0), 78.2, 15.6),
    ("north-pole-summer", julian_day(2026, 6, 21, 12, 0, 0), 90.0, 0.0),
    ("south-pole-winter", julian_day(2026, 6, 21, 12, 0, 0), -90.0, 0.0),
):
    sc_p = OB.scene_geometry(eng, jd_p, la_p, lo_p)
    assert_all_finite(sc_p, label)
    ok(sc_p["diurnal"]["sunrise_jd"] is None and sc_p["diurnal"]["sunset_jd"] is None,
       f"{label}: no sunrise/sunset")
    ok(sc_p["diurnal"]["planetary_hour"] is None, f"{label}: no planetary_hour")
    ok(sc_p["diurnal"]["minutes_to_next_twilight"] is None, f"{label}: no twilight transition")

# Chronosense night_crossed, deadline phases, compact line
cs = sc_nyc["chronosense"]
ok(cs["night_crossed"] is True, "prev_jd_ut 19.2h earlier crossed solar midnight")
ok(cs["deadline"]["phase"] == "applying" and abs(cs["deadline"]["minutes_remaining"] - 45.0) < 1e-6,
   "deadline +45m is applying")
sc_same_day = OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060,
                                prev_jd_ut=jd_nyc - 3.0 / 24.0,
                                deadline_jd_ut=jd_nyc + 0.5 / 1440.0)
ok(sc_same_day["chronosense"]["night_crossed"] is False, "3h earlier same afternoon did not cross night")
ok(sc_same_day["chronosense"]["deadline"]["phase"] == "exact", "deadline within 1m is exact")
sc_past = OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060,
                            deadline_jd_ut=jd_nyc - 20.0 / 1440.0)
ok(sc_past["chronosense"]["deadline"]["phase"] == "separating", "deadline -20m is separating")
ok("\u2014" not in cs["line"], "chronosense line contains no em-dash")
ok(10 <= len(cs["line"].split()) <= 45, f"chronosense line is compact ({len(cs['line'].split())} words)")


# ============================================================================
# 7. verify_observation: oracle, authentic, uncertainty widening, edge cases,
#    impossibilities, and counterfactual diagnostics
# ============================================================================
# Unconstrained pure oracle mode
v_oracle = OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060})
ok(v_oracle["verdict"] == "unconstrained" and v_oracle["consistency_score"] is None
   and v_oracle["checks"] == [] and v_oracle["diagnostics"] is None,
   "verify_observation without observed returns unconstrained oracle")
ok(v_oracle["scene"]["chronosense"]["line"] == OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060)["chronosense"]["line"],
   "oracle scene matches scene_geometry")

# Authentic global scenes
for city, jd_c, la_c, lo_c in (
    ("NYC", julian_day(2026, 6, 21, 18, 0, 0), 40.7128, -74.0060),
    ("London", julian_day(2026, 4, 15, 10, 0, 0), 51.5074, -0.1278),
    ("Sydney", julian_day(2026, 1, 15, 2, 0, 0), -33.8688, 151.2093),
    ("Tokyo", julian_day(2026, 9, 22, 4, 0, 0), 35.6762, 139.6503),
    ("Quito", julian_day(2026, 3, 21, 15, 0, 0), -0.1807, -78.4678),
    ("CapeTown", julian_day(2026, 11, 10, 12, 0, 0), -33.9249, 18.4241),
):
    sc_c = OB.scene_geometry(eng, jd_c, la_c, lo_c)
    obs_c = {
        "shadow_bearing_deg": sc_c["shadow"]["bearing_deg"],
        "shadow_length_ratio": sc_c["shadow"]["length_ratio"],
        "sun_azimuth_deg": sc_c["sun"]["azimuth_deg"],
        "sun_altitude_deg": sc_c["sun"]["altitude_apparent_deg"],
        "twilight": sc_c["sun"]["twilight_stage"],
        "sun_visible": sc_c["sun"]["is_day"],
    }
    vc = OB.verify_observation(eng, {"jd_ut": jd_c, "lat": la_c, "lon_east": lo_c}, obs_c)
    ok(vc["verdict"] == "consistent" and vc["consistency_score"] > 0.999 and vc["diagnostics"] is None,
       f"authentic {city} verifies consistent (score={vc['consistency_score']})")

# Time and place tolerance widening
obs_nyc_shd = {
    "shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
    "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
}
v_tight = OB.verify_observation(
    eng, {"jd_ut": jd_nyc + 35.0 / 1440.0, "lat": 40.7128, "lon_east": -74.0060}, obs_nyc_shd)
v_wide = OB.verify_observation(
    eng, {"jd_ut": jd_nyc + 35.0 / 1440.0, "lat": 40.7128, "lon_east": -74.0060,
          "time_tolerance_min": 40.0}, obs_nyc_shd)
ok(v_tight["verdict"] in ("inconsistent", "marginal"), "35 min shift fails without time tolerance")
ok(v_wide["verdict"] == "consistent", "35 min shift passes with time_tolerance_min=40")

v_place_tight = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -85.0}, obs_nyc_shd)
v_place_wide = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -85.0,
          "place_tolerance_deg": 12.0}, obs_nyc_shd)
ok(v_place_tight["verdict"] == "inconsistent", "11 deg lon shift fails without place tolerance")
ok(v_place_wide["verdict"] == "consistent", "11 deg lon shift passes with place_tolerance_deg=12")

# Lahaina noon (subsolar zenith > 89.5 deg): shadow bearing indeterminate, no false fail
g_tmp = OB.geolocate(eng, jd_nyc, obs_nyc_shd)
sub_s = g_tmp["subsolar"]
v_lahaina = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": sub_s["lat"], "lon_east": sub_s["lon"]},
    {"shadow_bearing_deg": 237.0, "shadow_length_ratio": 0.01},
)
ok(v_lahaina["verdict"] == "consistent", f"Lahaina noon verdict consistent ({v_lahaina['verdict']})")
bl_chk = [c for c in v_lahaina["checks"] if c["field"] == "shadow_bearing_deg"][0]
ok(bl_chk["status"] == "indeterminate", "Lahaina noon shadow_bearing_deg marked indeterminate")

# Full Moon (> 0.98) and New Moon (< 0.02): above horizon -> bright_limb_deg & waxing
# indeterminate; below horizon -> moon_bright_limb_deg is impossible (regression check).
phases_2026 = EV.lunar_phases(eng, julian_day(2026, 6, 1), julian_day(2026, 7, 15))
full_jd = [t for t, name in phases_2026 if name == "full"][0]
new_jd = [t for t, name in phases_2026 if name == "new"][0]
for tag, p_jd in (("full-moon", full_jd), ("new-moon", new_jd)):
    sub_l = OB.geolocate(eng, p_jd, {"twilight": "day"})["sublunar"]
    v_ph = OB.verify_observation(
        eng, {"jd_ut": p_jd, "lat": sub_l["lat"], "lon_east": sub_l["lon"]},
        {"moon_bright_limb_deg": 123.0, "moon_waxing": True},
    )
    ok(v_ph["verdict"] == "unconstrained", f"{tag} above horizon: only indeterminate moon checks -> unconstrained")
    ok(all(c["status"] == "indeterminate" for c in v_ph["checks"]),
       f"{tag} above horizon: bright_limb & waxing marked indeterminate")
    v_ph_below = OB.verify_observation(
        eng, {"jd_ut": p_jd, "lat": -sub_l["lat"], "lon_east": wrap180(sub_l["lon"] + 180.0)},
        {"moon_bright_limb_deg": 123.0},
    )
    ok(v_ph_below["verdict"] == "impossible"
       and v_ph_below["checks"][0]["status"] == "impossible",
       f"{tag} below horizon: bright_limb_deg is impossible, not indeterminate")

# Regression: 2026-03-03T11:33:00Z full Moon at sublunar antipode
jd_ecl_full = julian_day(2026, 3, 3, 11, 33, 0)
sub_l_ecl = OB.geolocate(eng, jd_ecl_full, {"twilight": "day"})["sublunar"]
v_ecl_below = OB.verify_observation(
    eng, {"jd_ut": jd_ecl_full, "lat": -sub_l_ecl["lat"], "lon_east": wrap180(sub_l_ecl["lon"] + 180.0)},
    {"moon_bright_limb_deg": 90.0},
)
ok(v_ecl_below["verdict"] == "impossible"
   and v_ecl_below["checks"][0]["status"] == "impossible",
   "2026-03-03 full Moon below horizon rejects moon_bright_limb_deg as impossible")

# Impossible physical claims
v_imp_night = OB.verify_observation(
    eng, {"jd_ut": nadir_jd, "lat": 40.7128, "lon_east": -74.0060},
    {"shadow_bearing_deg": 45.0, "shadow_length_ratio": 1.2},
)
ok(v_imp_night["verdict"] == "impossible" and v_imp_night["consistency_score"] <= 0.25,
   "solar shadow at midnight is impossible")

v_imp_slope = OB.verify_observation(
    eng, {"jd_ut": jd_late, "lat": 40.7128, "lon_east": -74.0060,
          "slope_deg": 25.0, "slope_azimuth_deg": opp_az},
    {"shadow_bearing_deg": sc_flat["shadow"]["bearing_deg"], "shadow_length_ratio": 4.5},
)
ok(v_imp_slope["verdict"] == "impossible", "shadow on self-shadowed slope is impossible")

v_imp_twi = OB.verify_observation(
    eng, {"jd_ut": nadir_jd, "lat": 40.7128, "lon_east": -74.0060},
    {"twilight": "day"},
)
ok(v_imp_twi["verdict"] == "impossible", "claiming day at midnight is impossible")

v_imp_wax = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060},
    {"moon_waxing": not sc_nyc["moon"]["waxing"]},
)
ok(v_imp_wax["verdict"] == "impossible", "wrong moon_waxing at half-moon is impossible")

v_imp_illum = OB.verify_observation(
    eng, {"jd_ut": new_jd, "lat": 40.7128, "lon_east": -74.0060},
    {"moon_illum": 0.95},
)
ok(v_imp_illum["verdict"] == "impossible", "claiming full moon at new moon is impossible")

v_imp_sat = OB.verify_observation(
    eng, {"jd_ut": noon_jd, "lat": 40.7128, "lon_east": -74.0060},
    {"bodies_visible": ["saturn"]},
)
ok(v_imp_sat["verdict"] == "impossible", "Saturn naked-eye at solar noon is impossible")

# Shadow sweep: authentic vs reversed video (both N & S hemispheres)
sc_nyc_30 = OB.scene_geometry(eng, jd_nyc + 30.0 / 1440.0, 40.7128, -74.0060)
true_sweep_n = wrap180(sc_nyc_30["shadow"]["bearing_deg"] - sc_nyc["shadow"]["bearing_deg"])
ok(true_sweep_n > 10.0, f"NYC 30m shadow sweep is positive clockwise ({true_sweep_n:.2f} deg)")
v_sw_ok = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060},
    {"shadow_sweep": {"dt_minutes": 30.0, "delta_bearing_deg": true_sweep_n}},
)
v_sw_rev = OB.verify_observation(
    eng, {"jd_ut": jd_nyc, "lat": 40.7128, "lon_east": -74.0060},
    {"shadow_sweep": {"dt_minutes": 30.0, "delta_bearing_deg": -true_sweep_n}},
)
ok(v_sw_ok["verdict"] == "consistent", "authentic NYC shadow_sweep passes")
ok(v_sw_rev["verdict"] == "impossible", "reversed-video NYC shadow_sweep caught as impossible")

sc_syd_30 = OB.scene_geometry(eng, jd_syd + 30.0 / 1440.0, -33.8688, 151.2093)
true_sweep_s = wrap180(sc_syd_30["shadow"]["bearing_deg"] - sc_syd["shadow"]["bearing_deg"])
ok(true_sweep_s < -10.0, f"Sydney 30m shadow sweep is negative counterclockwise ({true_sweep_s:.2f} deg)")
v_sw_s_rev = OB.verify_observation(
    eng, {"jd_ut": jd_syd, "lat": -33.8688, "lon_east": 151.2093},
    {"shadow_sweep": {"dt_minutes": 30.0, "delta_bearing_deg": -true_sweep_s}},
)
ok(v_sw_s_rev["verdict"] == "impossible", "reversed-video Sydney shadow_sweep caught as impossible")

# Counterfactual diagnostics: whole-hour (-4h), half-hour (India UTC+5:30), hemisphere flip, seasonal
# (a) Whole-hour -4h timezone spoof
v_tz4 = OB.verify_observation(
    eng, {"jd_ut": jd_nyc - 4.0 / 24.0, "lat": 40.7128, "lon_east": -74.0060}, obs_nyc_shd)
ok(v_tz4["verdict"] in ("inconsistent", "impossible") and v_tz4["diagnostics"] is not None,
   "-4h spoof flagged with diagnostics")
ts4 = v_tz4["diagnostics"]["time_shift"]
ok(abs(ts4["offset_minutes"] - 240.0) < 2.0 and ts4["nearest_whole_hour_offset"] == 4
   and ts4["fit_score"] > 0.98,
   f"-4h spoof diagnostic recovered +{ts4['offset_minutes']:.1f}m (hr={ts4['nearest_whole_hour_offset']})")

# (b) Half-hour India UTC+5:30 (+330 min / -330 min) spoof
jd_del = julian_day(2026, 3, 21, 4, 30, 0)  # 10:00 IST in Delhi
sc_del = OB.scene_geometry(eng, jd_del, 28.6139, 77.2090)
obs_del = {
    "shadow_bearing_deg": sc_del["shadow"]["bearing_deg"],
    "shadow_length_ratio": sc_del["shadow"]["length_ratio"],
}
v_ist = OB.verify_observation(
    eng, {"jd_ut": jd_del + 5.5 / 24.0, "lat": 28.6139, "lon_east": 77.2090}, obs_del)
ts_ist = v_ist["diagnostics"]["time_shift"]
ok(abs(ts_ist["offset_minutes"] - (-330.0)) < 2.0 and ts_ist["fit_score"] > 0.98,
   f"India UTC+5:30 spoof recovered {ts_ist['offset_minutes']:.2f} min")

# (c) Hemisphere sign-flip spoof (real scene at -33.87S Sydney, claimed at +33.87N)
obs_syd = {
    "shadow_bearing_deg": sc_syd["shadow"]["bearing_deg"],
    "shadow_length_ratio": sc_syd["shadow"]["length_ratio"],
}
v_hf = OB.verify_observation(
    eng, {"jd_ut": jd_syd, "lat": +33.8688, "lon_east": 151.2093}, obs_syd)
ok(v_hf["verdict"] in ("inconsistent", "impossible") and v_hf["diagnostics"] is not None,
   "hemisphere flip spoof flagged")
hf = v_hf["diagnostics"]["hemisphere_flip"]
ok(hf["verdict"] == "consistent" and hf["fit_score"] > 0.99,
   f"hemisphere_flip recovers -lat cleanly (score={hf['fit_score']:.3f})")
ok("hemisphere" in v_hf["diagnostics"]["summary"].lower(),
   f"diagnostic summary identifies hemisphere flip ({v_hf['diagnostics']['summary']})")

# (d) Seasonal date-shift spoof (June NYC solar noon claimed in December at same UTC time)
jd_jun_noon = julian_day(2026, 6, 21, 17, 0, 0)
sc_jun = OB.scene_geometry(eng, jd_jun_noon, 40.7128, -74.0060)
v_seas = OB.verify_observation(
    eng, {"jd_ut": jd_jun_noon - 182.0, "lat": 40.7128, "lon_east": -74.0060},
    {"sun_altitude_deg": sc_jun["sun"]["altitude_apparent_deg"],
     "shadow_length_ratio": sc_jun["shadow"]["length_ratio"],
     "shadow_bearing_deg": sc_jun["shadow"]["bearing_deg"]},
)
ok(v_seas["verdict"] in ("inconsistent", "impossible") and v_seas["diagnostics"]["date_shift"] is not None,
   "seasonal spoof produces date_shift diagnostic")
ds = v_seas["diagnostics"]["date_shift"]
ok(ds["fit_score"] > 0.95 and abs(abs(ds["offset_days"]) - 182) <= 12,
   f"seasonal date_shift recovers ~182d offset ({ds['offset_days']}d, score={ds['fit_score']:.3f})")


# ============================================================================
# 8. chronolocate: pruning, accuracy, edge bisection, midnight wrap, truncation
# ============================================================================
# (a) 30-day multi-constraint recovery (solar shadow + Moon phase)
ch30 = OB.chronolocate(
    eng, {"lat": 40.7128, "lon_east": -74.0060},
    {
        "shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
        "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
        "moon_illum": sc_nyc["moon"]["illum"],
        "moon_waxing": sc_nyc["moon"]["waxing"],
    },
    jd_nyc - 15.0, jd_nyc + 15.0,
)
ok(ch30["days_pruned"] >= 20, f"30-day search pruned >=20 days (pruned={ch30['days_pruned']})")
ok(ch30["days_scanned"] + ch30["days_pruned"] == 30, "scanned + pruned == total days")
hit_w = [w for w in ch30["windows"] if w["jd_start"] <= jd_nyc <= w["jd_end"]]
ok(len(hit_w) == 1, f"true instant recovered inside 1 window ({len(hit_w)})")
if hit_w:
    w0 = hit_w[0]
    ok(abs(w0["best_jd"] - jd_nyc) * 1440.0 < 1.0,
       f"best_jd within 1 min of true instant ({(w0['best_jd'] - jd_nyc) * 1440:.3f}m)")
    ok(w0["fit_score"] > 0.99, f"best_jd fit_score > 0.99 ({w0['fit_score']:.4f})")
    ok(abs(w0["duration_minutes"] - (w0["jd_end"] - w0["jd_start"]) * 1440.0) < 1e-9,
       "duration_minutes matches jd_end - jd_start")
    # Edge bisection accuracy (< 5s on each side)
    v_in_l = OB.verify_observation(
        eng, {"jd_ut": w0["jd_start"] + 5.0 / 86400.0, "lat": 40.7128, "lon_east": -74.0060},
        {"shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
         "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
         "moon_illum": sc_nyc["moon"]["illum"],
         "moon_waxing": sc_nyc["moon"]["waxing"]})
    v_out_l = OB.verify_observation(
        eng, {"jd_ut": w0["jd_start"] - 5.0 / 86400.0, "lat": 40.7128, "lon_east": -74.0060},
        {"shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
         "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
         "moon_illum": sc_nyc["moon"]["illum"],
         "moon_waxing": sc_nyc["moon"]["waxing"]})
    ok(v_in_l["verdict"] == "consistent", "5s inside left bisected edge is consistent")
    ok(v_out_l["verdict"] != "consistent", "5s outside left bisected edge is not consistent")

# (b) Midnight-crossing window NOT split across day boundary
# At NYC (lon=-74), midnight UTC (00:00 UT) is 20:00 EDT (sunset/civil twilight in June -> night runs across 04:00-08:00 UT).
# At London (lon=0), night runs across 00:00 UTC!
jd_lon_mid = julian_day(2026, 3, 21, 0, 0, 0)
ch_mid = OB.chronolocate(
    eng, {"lat": 51.5, "lon_east": 0.0},
    {"twilight": "night"},
    jd_lon_mid - 0.5, jd_lon_mid + 0.5,
)
ok(len(ch_mid["windows"]) == 1, f"London night crossing 00:00 UTC is 1 contiguous window ({len(ch_mid['windows'])})")
if ch_mid["windows"]:
    ok(ch_mid["windows"][0]["jd_start"] < jd_lon_mid < ch_mid["windows"][0]["jd_end"],
       "midnight UTC sits cleanly inside the single night window")

# (c) Narrow sub-step window rescue (tight 1.0 deg bearing tolerance, coarse 15m step)
ch_narrow = OB.chronolocate(
    eng, {"lat": 40.7128, "lon_east": -74.0060},
    {"shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
     "tolerances": {"shadow_bearing_deg": 1.0}},
    jd_nyc - 0.25, jd_nyc + 0.25,
    step_minutes=15.0,
)
ok(len(ch_narrow["windows"]) == 1
   and ch_narrow["windows"][0]["jd_start"] <= jd_nyc <= ch_narrow["windows"][0]["jd_end"],
   "narrow ~4 min sub-step window rescued cleanly with step_minutes=15")

# (d) Polar winter solar shadow: 100% of days pruned
ch_polar = OB.chronolocate(
    eng, {"lat": 78.2, "lon_east": 15.6},
    {"shadow_bearing_deg": 0.0, "shadow_length_ratio": 2.0},
    julian_day(2026, 12, 15, 0, 0, 0), julian_day(2026, 12, 25, 0, 0, 0),
)
ok(ch_polar["days_pruned"] == 10 and ch_polar["days_scanned"] == 0 and ch_polar["windows"] == [],
   "polar winter solar shadow prunes all 10 days")

# (e) max_windows truncation
ch_trunc = OB.chronolocate(
    eng, {"lat": 40.7128, "lon_east": -74.0060},
    {"twilight": "day"},
    julian_day(2026, 6, 1), julian_day(2026, 6, 10),
    max_windows=3,
)
ok(len(ch_trunc["windows"]) == 3 and ch_trunc["truncated"] is True,
   "max_windows=3 truncates and sets truncated=True")


# ============================================================================
# 9. geolocate: Path A (analytical) and Path B (grid, antimeridian, double-alt)
# ============================================================================
# (a) Subsolar & sublunar GP points have altitude == 90 deg
g_sub = OB.geolocate(eng, jd_nyc, obs_nyc_shd)
for name, gp, body in (("subsolar", g_sub["subsolar"], "sun"),
                       ("sublunar", g_sub["sublunar"], "moon")):
    pos = eng.position(body, jd_nyc)
    _, alt_gp = PH.az_alt(pos["lon"], pos["lat"], jd_nyc, gp["lat"], gp["lon"])
    ok(abs(alt_gp - 90.0) < 1e-3, f"{name} point has altitude 90 deg ({alt_gp:.5f})")

# (b) Path A exact recovery (< 0.5 km!) across 10 diverse global locations
global_sites = [
    ("NYC", julian_day(2026, 6, 21, 18, 0, 0), 40.7128, -74.0060),
    ("London", julian_day(2026, 4, 15, 10, 0, 0), 51.5074, -0.1278),
    ("Sydney", julian_day(2026, 1, 15, 2, 0, 0), -33.8688, 151.2093),
    ("Tokyo", julian_day(2026, 9, 22, 4, 0, 0), 35.6762, 139.6503),
    ("Quito", julian_day(2026, 3, 21, 15, 0, 0), -0.1807, -78.4678),
    ("Reykjavik", julian_day(2026, 6, 21, 14, 0, 0), 64.1466, -21.9426),
    ("CapeTown", julian_day(2026, 11, 10, 12, 0, 0), -33.9249, 18.4241),
    ("BuenosAires", julian_day(2026, 2, 10, 18, 0, 0), -34.6037, -58.3816),
    ("Delhi", julian_day(2026, 3, 21, 4, 30, 0), 28.6139, 77.2090),
    ("Fiji-Antimeridian", julian_day(2026, 6, 21, 2, 0, 0), -16.8000, 179.9000),
]
for name, jd_s, la_s, lo_s in global_sites:
    sc_s = OB.scene_geometry(eng, jd_s, la_s, lo_s)
    # Shadow bearing + shadow length ratio
    g_shd = OB.geolocate(eng, jd_s, {
        "shadow_bearing_deg": sc_s["shadow"]["bearing_deg"],
        "shadow_length_ratio": sc_s["shadow"]["length_ratio"],
    })
    ok(g_shd["method"] == "analytical" and len(g_shd["candidates"]) >= 1,
       f"Path A shadow fix for {name}")
    err_km = min(haversine_km(la_s, lo_s, c["lat"], c["lon"]) for c in g_shd["candidates"])
    ok(err_km < 0.5, f"Path A shadow fix {name} error {err_km:.4f} km < 0.5 km")
    # Sun az + sun alt with tight tolerances -> region_kind == "point"
    g_sun = OB.geolocate(eng, jd_s, {
        "sun_azimuth_deg": sc_s["sun"]["azimuth_deg"],
        "sun_altitude_deg": sc_s["sun"]["altitude_apparent_deg"],
        "tolerances": {"sun_azimuth_deg": 1.0, "sun_altitude_deg": 0.5},
    })
    ok(g_sun["method"] == "analytical" and len(g_sun["candidates"]) >= 1,
       f"Path A tight sun fix for {name}")
    best_c = min(g_sun["candidates"], key=lambda c: haversine_km(la_s, lo_s, c["lat"], c["lon"]))
    ok(haversine_km(la_s, lo_s, best_c["lat"], best_c["lon"]) < 0.5,
       f"Path A tight sun fix {name} exact")
    ok(best_c["region_kind"] == "point" and best_c["radius_km"] <= 250.0,
       f"Path A tight sun fix {name} classified as point (r={best_c['radius_km']:.1f} km)")

# (c) Path A two-root ambiguity (summer WNW low Sun has tropical + high-latitude roots)
jd_2r = julian_day(2026, 6, 21, 18, 0, 0)
g_2r = OB.geolocate(
    eng, jd_2r,
    {"sun_azimuth_deg": 290.0, "sun_altitude_deg": 20.0,
     "tolerances": {"sun_azimuth_deg": 1.0, "sun_altitude_deg": 1.0}},
    lat_min=-85.0, lat_max=85.0,
)
ok(g_2r["method"] == "analytical" and len(g_2r["candidates"]) == 2,
   f"summer WNW Sun yields 2 exact analytical roots ({len(g_2r['candidates'])})")
if len(g_2r["candidates"]) == 2:
    lats_2r = sorted(c["lat"] for c in g_2r["candidates"])
    ok(lats_2r[0] < 25.0 and lats_2r[1] > 70.0,
       f"2 analytical roots span tropics and Arctic ({lats_2r[0]:.1f}, {lats_2r[1]:.1f})")

# (d) Path B: Sun + Moon double-altitude fix across antimeridian (Fiji lon=179.9)
jd_fiji = julian_day(2026, 6, 21, 2, 0, 0)
sc_fiji = OB.scene_geometry(eng, jd_fiji, -16.8, 179.9)
g_fiji_b = OB.geolocate(
    eng, jd_fiji,
    {
        "sun_altitude_deg": sc_fiji["sun"]["altitude_apparent_deg"],
        "moon_altitude_deg": sc_fiji["moon"]["altitude_apparent_deg"],
        "tolerances": {"sun_altitude_deg": 1.5, "moon_altitude_deg": 1.5},
    },
)
ok(g_fiji_b["method"] == "grid" and len(g_fiji_b["candidates"]) == 2,
   f"Fiji double-altitude grid finds 2 circle intersections ({len(g_fiji_b['candidates'])})")
fiji_hits = [c for c in g_fiji_b["candidates"] if haversine_km(-16.8, 179.9, c["lat"], c["lon"]) < 25.0]
ok(len(fiji_hits) == 1, "antimeridian cluster NOT split into two duplicates")
if fiji_hits:
    fh = fiji_hits[0]
    ok(fh["lon_range"][0] > 170.0 and fh["lon_range"][1] < -170.0,
       f"antimeridian lon_range wraps cleanly across +/-180 ({fh['lon_range']})")
    ok(fh["region_kind"] == "point" and fh["radius_km"] <= 250.0,
       f"tight double-altitude fix classified as point (r={fh['radius_km']:.1f} km)")

# (e) Path B: shadow bearing + Moon bright-limb tilt (no altitude!)
sc_m_nyc = OB.scene_geometry(eng, jd_nyc, 40.7128, -74.0060)
g_sbl = OB.geolocate(
    eng, jd_nyc,
    {
        "shadow_bearing_deg": sc_m_nyc["shadow"]["bearing_deg"],
        "moon_bright_limb_deg": sc_m_nyc["moon"]["bright_limb_zenith_deg"],
        "moon_visible": True,
    },
)
ok(g_sbl["method"] == "grid" and len(g_sbl["candidates"]) >= 1,
   "Path B shadow_bearing + moon_bright_limb finds candidate(s)")
ok(any(
    c["lat_range"][0] - 5.0 <= 40.7128 <= c["lat_range"][1] + 5.0
    for c in g_sbl["candidates"]
), "shadow_bearing + moon_bright_limb region covers NYC latitude")

# (f) Path B: region classification (arc vs band)
g_arc = OB.geolocate(
    eng, jd_nyc,
    {"sun_azimuth_deg": 180.0, "twilight": "day",
     "tolerances": {"sun_azimuth_deg": 4.0}},
)
ok(g_arc["method"] == "grid" and len(g_arc["candidates"]) >= 1
   and g_arc["candidates"][0]["region_kind"] == "arc",
   f"solar-noon meridian locus classified as arc ({g_arc['candidates'][0]['region_kind'] if g_arc['candidates'] else None})")

g_band = OB.geolocate(eng, jd_nyc, {"twilight": "day"})
ok(g_band["method"] == "grid" and len(g_band["candidates"]) >= 1
   and g_band["candidates"][0]["region_kind"] == "band",
   f"daylight hemisphere classified as band ({g_band['candidates'][0]['region_kind'] if g_band['candidates'] else None})")

# (g) Path B: sloped ground geolocation
g_slope = OB.geolocate(
    eng, jd_late,
    {"shadow_bearing_deg": sc_uphill["shadow"]["bearing_deg"],
     "shadow_length_ratio": sc_uphill["shadow"]["length_ratio"],
     "tolerances": {"shadow_bearing_deg": 5.0, "shadow_length_ratio": 0.15}},
    slope_deg=15.0, slope_azimuth_deg=s_az,
    lat_min=20.0, lat_max=60.0, lon_min=-100.0, lon_max=-50.0,
    grid_step_deg=3.0,
)
ok(g_slope["method"] == "grid" and len(g_slope["candidates"]) >= 1,
   "sloped terrain geolocation routes to Path B grid and finds candidate")
if g_slope["candidates"]:
    err_sl = min(haversine_km(40.7128, -74.0060, c["lat"], c["lon"]) for c in g_slope["candidates"])
    ok(err_sl < 50.0, f"sloped terrain geolocation recovers NYC ({err_sl:.1f} km)")


# Grazing Sun (<0.05 deg above horizon): cast=True, bearing defined, length_ratio=None
sc_graze = OB.scene_geometry(eng, t_set_pred - 5.0 / 86400.0, 40.7128, -74.0060)
ok(0.0 < sc_graze["sun"]["altitude_apparent_deg"] < 0.05, "grazing instant has 0 < alt_app < 0.05")
ok(sc_graze["shadow"]["cast"] is True and sc_graze["shadow"]["bearing_deg"] is not None
   and sc_graze["shadow"]["length_ratio"] is None,
   "grazing Sun casts shadow with bearing but null length_ratio")

# Civil dusk transition verification
sc_civil = OB.scene_geometry(eng, t_set_pred + 10.0 / 1440.0, 40.7128, -74.0060)
ok(sc_civil["diurnal"]["next_transition_kind"] == "civil_dusk",
   f"during evening civil twilight next transition is civil_dusk ({sc_civil['diurnal']['next_transition_kind']})")
t_dusk = (t_set_pred + 10.0 / 1440.0) + sc_civil["diurnal"]["minutes_to_next_twilight"] / 1440.0
sc_at_dusk = OB.scene_geometry(eng, t_dusk, 40.7128, -74.0060)
ok(abs(sc_at_dusk["sun"]["altitude_apparent_deg"] - (-6.0)) < 0.02,
   f"civil_dusk sits at -6 deg ({sc_at_dusk['sun']['altitude_apparent_deg']:.4f})")

# Chronolocate pruning soundness: independent brute-force 5m scan over 10 days
bf_start = jd_nyc - 5.0
bf_end = jd_nyc + 5.0
bf_obs = {
    "shadow_bearing_deg": sc_nyc["shadow"]["bearing_deg"],
    "shadow_length_ratio": sc_nyc["shadow"]["length_ratio"],
    "moon_illum": sc_nyc["moon"]["illum"],
    "moon_waxing": sc_nyc["moon"]["waxing"],
}
ch_bf = OB.chronolocate(eng, {"lat": 40.7128, "lon_east": -74.0060}, bf_obs, bf_start, bf_end)
bf_missed = 0
t_cur = bf_start
while t_cur <= bf_end:
    # Fast check via verify_observation only near the afternoon window (or _snapshot_at)
    snap_bf = OB._snapshot_at(eng, t_cur, need_moon=True)
    _, _, _, _, m_bf = OB._eval_snap_at_place(
        snap_bf, 40.7128, -74.0060, OB._validate_observed(bf_obs), chronolocate_mode=True)
    if m_bf > 0.05:
        if not any(w["jd_start"] - 1e-4 <= t_cur <= w["jd_end"] + 1e-4 for w in ch_bf["windows"]):
            bf_missed += 1
    t_cur += 15.0 / 1440.0
ok(bf_missed == 0, f"chronolocate missed 0 feasible points vs brute-force scan ({bf_missed})")


# Regression: shadow_sweep catching mid-sweep sunset (24h sweep) & slope self-shadowing
jd_nyc_16 = julian_day(2026, 6, 21, 16, 0, 0)
v_sw_24h = OB.verify_observation(
    eng, {"jd_ut": jd_nyc_16, "lat": 40.7128, "lon_east": -74.0060},
    {"shadow_sweep": {"dt_minutes": 1440.0, "delta_bearing_deg": 360.0}},
)
ok(v_sw_24h["verdict"] == "impossible" and v_sw_24h["checks"][0]["status"] == "impossible",
   "24h shadow_sweep at mid-latitude fails as impossible due to mid-sweep sunset")

# Sloped terrain: Sun is above slope at start (east-facing 45 deg slope at morning),
# then crosses behind the slope during a 4h sweep into afternoon
jd_nyc_morn = julian_day(2026, 6, 21, 13, 0, 0)  # morning: Sun in E/ESE (~36 deg alt)
sc_sl_morn = OB.scene_geometry(eng, jd_nyc_morn, 40.7128, -74.0060,
                               slope_deg=45.0, slope_azimuth_deg=90.0)
ok(sc_sl_morn["shadow"]["cast"] is True, "east-facing 45 deg slope is sunlit in morning")
v_sw_slope = OB.verify_observation(
    eng, {"jd_ut": jd_nyc_morn, "lat": 40.7128, "lon_east": -74.0060,
          "slope_deg": 45.0, "slope_azimuth_deg": 90.0},
    {"shadow_sweep": {"dt_minutes": 480.0, "delta_bearing_deg": 180.0}},
)
ok(v_sw_slope["verdict"] == "impossible" and v_sw_slope["checks"][0]["status"] == "impossible",
   "shadow_sweep crossing into slope self-shadowing mid-window fails as impossible")

# Regression: geolocate Path A -> Path B fallback on low-Sun due-E/W observations
g_eq_a = OB.geolocate(
    eng, julian_day(2026, 3, 25, 18, 0, 0),
    {"sun_azimuth_deg": 270.0, "sun_altitude_deg": 0.0},
)
ok(g_eq_a["method"] == "grid" and len(g_eq_a["candidates"]) >= 1,
   f"low-Sun due-W geolocate falls back to Path B grid and finds candidate(s) ({g_eq_a['method']}, {len(g_eq_a['candidates'])})")
if g_eq_a["candidates"]:
    c0 = g_eq_a["candidates"][0]
    v_eq_a = OB.verify_observation(
        eng, {"jd_ut": julian_day(2026, 3, 25, 18, 0, 0), "lat": c0["lat"], "lon_east": c0["lon"]},
        {"sun_azimuth_deg": 270.0, "sun_altitude_deg": 0.0},
    )
    ok(v_eq_a["verdict"] == "consistent", "Path B fallback candidate verifies consistent (Repro A)")

g_eq_b = OB.geolocate(
    eng, julian_day(2026, 4, 5, 18, 0, 0),
    {"shadow_bearing_deg": 90.0, "sun_altitude_deg": 1.0},
)
ok(g_eq_b["method"] == "grid" and len(g_eq_b["candidates"]) >= 1,
   f"low-Sun due-E shadow geolocate falls back to Path B grid ({g_eq_b['method']}, {len(g_eq_b['candidates'])})")
if g_eq_b["candidates"]:
    c0 = g_eq_b["candidates"][0]
    v_eq_b = OB.verify_observation(
        eng, {"jd_ut": julian_day(2026, 4, 5, 18, 0, 0), "lat": c0["lat"], "lon_east": c0["lon"]},
        {"shadow_bearing_deg": 90.0, "sun_altitude_deg": 1.0},
    )
    ok(v_eq_b["verdict"] == "consistent", "Path B fallback candidate verifies consistent (Repro B)")


# ============================================================================
# 10. Input validation
# ============================================================================
bad_calls = [
    ("lat > 90", lambda: OB.scene_geometry(eng, jd_nyc, 95.0, 0.0)),
    ("slope >= 90", lambda: OB.scene_geometry(eng, jd_nyc, 40.0, 0.0, slope_deg=90.0)),
    ("slope < 0", lambda: OB.scene_geometry(eng, jd_nyc, 40.0, 0.0, slope_deg=-5.0)),
    ("bad twilight", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"twilight": "midnight"})),
    ("neg shadow ratio", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"shadow_length_ratio": -1.0})),
    ("illum > 1", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"moon_illum": 1.2})),
    ("unknown body", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"bodies_visible": ["nibiru"]})),
    ("sweep dt <= 0", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"shadow_sweep": {"dt_minutes": 0, "delta_bearing_deg": 5}})),
    ("unknown obs key", lambda: OB.verify_observation(eng, {"jd_ut": jd_nyc, "lat": 40.0, "lon_east": 0.0}, {"bogus": 1})),
    ("chronolocate empty obs", lambda: OB.chronolocate(eng, {"lat": 40.0, "lon_east": 0.0}, {}, jd_nyc, jd_nyc + 1)),
    ("chronolocate inverted span", lambda: OB.chronolocate(eng, {"lat": 40.0, "lon_east": 0.0}, {"twilight": "day"}, jd_nyc + 1, jd_nyc)),
    ("geolocate empty obs", lambda: OB.geolocate(eng, jd_nyc, {})),
    ("geolocate inverted lat", lambda: OB.geolocate(eng, jd_nyc, {"twilight": "day"}, lat_min=40.0, lat_max=20.0)),
]
for why, fn in bad_calls:
    try:
        fn()
        ok(False, f"should reject: {why}")
    except ValueError:
        ok(True, f"rejects {why}")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
