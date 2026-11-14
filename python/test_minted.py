#!/usr/bin/env python3
"""Self-check for astroengine.minted, on the fixture mint (433 Eros, 1990 to
2030). The pack must verify against its certificate and register; a pack with
one bit changed must be refused before it is decoded; and the certificate's
own arithmetic must hold. Needs no network: mint_body.py is the part that
talks to JPL Horizons. Run: python3 test_minted.py
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from astroengine import Engine
from astroengine.core import julian_day
from astroengine.minted import (MintIntegrityError, check_certificate,
                                load_minted_body, register_minted_body,
                                verify_minted_pack)

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                       "packages", "caelus", "test", "fixtures", "minted")
checks = 0
fails = 0


def ok(cond, msg):
    global checks, fails
    checks += 1
    if not cond:
        fails += 1
        print(f"FAIL {msg}")


def raises(fn, kind, msg):
    try:
        fn()
    except kind:
        ok(True, msg)
    except Exception as e:  # noqa: BLE001 - the wrong error is a failure
        ok(False, f"{msg} (raised {type(e).__name__})")
    else:
        ok(False, msg)


eng = Engine("embedded")
cert = load_minted_body(eng, os.path.join(FIXTURE, "eros.cert.json"))
with open(os.path.join(FIXTURE, "eros.cpk"), "rb") as f:
    blob = f.read()

ok(cert["id"] == "eros" and cert["number"] == 433 and eng.minted["eros"] is cert,
   "the body registers under the certificate's id")
p = eng.position("eros", julian_day(2012, 1, 31, 11))
ok(0.17 < p["dist"] < 0.19, f"Eros passed {p['dist']:.4f} AU from the Earth on 31 January 2012")
ok(abs(p["dist"] - cert["error"]["min_geocentric_au"]) < 0.002,
   "which is the closest approach the certificate records")
h = eng.heliocentric("eros", julian_day(2012, 1, 31))
ok(1.13 < h["dist"] < 1.78, "its heliocentric distance is inside Eros's orbit")
raises(lambda: eng.position("eros", julian_day(1989, 6, 1)), ValueError, "before the span raises")
raises(lambda: eng.position("eros", julian_day(2031, 6, 1)), ValueError, "after the span raises")

e = cert["error"]
ok(e["max_au"] < e["target_au"] <= 5e-6, "the measured error is inside the target")
ok(abs(e["target_au"] - 0.5 * math.pi / 648000 * e["min_geocentric_au"]) < 1e-15,
   "the target is half an arcsecond at the closest approach")
ok(abs(e["angle_bound_arcsec"] - e["max_au"] / e["min_geocentric_au"] * 648000 / math.pi) < 1e-12,
   "the angle bound is the error seen from the closest approach")
ok(cert["pack"]["bytes"] == len(blob), "the certificate states the pack's length")

bad = bytearray(blob)
bad[-5] ^= 1
raises(lambda: verify_minted_pack(bytes(bad), cert), MintIntegrityError, "one changed bit is refused")
raises(lambda: verify_minted_pack(blob[:-1], cert), MintIntegrityError, "a short pack is refused")
fresh = Engine("embedded")
raises(lambda: register_minted_body(fresh, bytes(bad), cert), MintIntegrityError, "a refused pack is not registered")
ok(fresh.minted == {}, "and leaves the engine as it was")
raises(lambda: fresh.position("eros", julian_day(2012, 1, 31)), Exception, "so the body has no position there")
other = json.loads(json.dumps(cert))
other["pack"]["sha256"] = "0" * 64
raises(lambda: verify_minted_pack(blob, other), MintIntegrityError, "a certificate for other bytes is refused")
ok(len(verify_minted_pack(blob, cert)["segments"]) == 40, "the right bytes decode")
raises(lambda: check_certificate({"format": "something-else", "version": 1}), ValueError, "another format is not a certificate")
raises(lambda: check_certificate(dict(cert, version=2)), ValueError, "another version is not read")
raises(lambda: check_certificate(dict(cert, pack={"file": "eros.cpk"})), ValueError, "a certificate with no hash is not read")

print(f"{checks} checks, {fails} failures")
sys.exit(1 if fails else 0)
