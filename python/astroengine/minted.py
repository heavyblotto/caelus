"""astroengine.minted -- bodies minted on demand.

The engine ships packs for a handful of small bodies. Any other numbered
asteroid can be minted: python/mint_body.py fits a pack to JPL Horizons and
writes it with a certificate, a small JSON file that states the span, the
source, the error measured against Horizons at epochs the fit never saw, and
the SHA-256 of the pack's bytes.

This module is the loading half. It checks that a pack's bytes are the bytes
the certificate was written for, and registers the body on an engine under
the certificate's id. A pack that fails the check is never decoded.
Mirrors minted.ts in the TypeScript engine.
"""
import hashlib
import json
import os

from . import packbin
from .chebyshev import ChebSeries

CERT_FORMAT = "caelus-mint-certificate"
CERT_VERSION = 1


class MintIntegrityError(ValueError):
    """A minted pack did not match its certificate."""


def check_certificate(cert):
    """Raise ValueError unless `cert` is a mint certificate this engine
    reads; return it."""
    if not isinstance(cert, dict) or cert.get("format") != CERT_FORMAT \
            or cert.get("version") != CERT_VERSION:
        raise ValueError(f"not a caelus mint certificate (format {CERT_FORMAT}, "
                         f"version {CERT_VERSION})")
    for key in ("id", "span", "error", "pack"):
        if key not in cert:
            raise ValueError(f"mint certificate has no {key!r}")
    for key in ("file", "bytes", "sha256"):
        if key not in cert["pack"]:
            raise ValueError(f"mint certificate's pack has no {key!r}")
    return cert


def verify_minted_pack(blob, cert):
    """The decoded pack, once its length and SHA-256 match the certificate.
    Raises MintIntegrityError otherwise, before anything is decoded."""
    check_certificate(cert)
    want = cert["pack"]
    if len(blob) != want["bytes"]:
        raise MintIntegrityError(f"{want['file']}: {len(blob)} bytes, the "
                                 f"certificate says {want['bytes']}")
    if hashlib.sha256(blob).hexdigest() != str(want["sha256"]).lower():
        raise MintIntegrityError(f"{want['file']}: its SHA-256 does not match "
                                 "the certificate")
    return packbin.decode_pack(blob)


def register_minted_body(engine, blob, cert):
    """Verify a minted pack and register its body on the engine under the
    certificate's id. Returns the certificate. The body then answers
    position(), longitude(), and heliocentric() inside the certificate's
    span, and raises outside it."""
    pack = verify_minted_pack(blob, cert)
    engine.register_source(cert["id"], ChebSeries(pack))
    engine.minted[cert["id"]] = cert
    return cert


def load_minted_body(engine, cert_path):
    """Read a certificate and the pack beside it from disk, verify, and
    register. Returns the certificate."""
    with open(cert_path) as f:
        cert = check_certificate(json.load(f))
    name = cert["pack"]["file"]
    if os.path.basename(name) != name:
        raise ValueError(f"pack file name {name!r} is not a plain file name")
    with open(os.path.join(os.path.dirname(cert_path), name), "rb") as f:
        blob = f.read()
    return register_minted_body(engine, blob, cert)
