"""astroengine.packbin -- the binary form of a Chebyshev pack.

A pack as JSON spends most of its bytes on decimal digits the fit cannot
justify: a coefficient is printed to 16 significant figures, and the series it
belongs to is good to seven or eight. The binary form stores each coefficient
as an integer multiple of a quantum chosen well below the pack's own fit
residual, so the rounding it adds is under 2% of the error already there.

Layout (all integers little-endian):

    bytes 0-3   the magic "CPK1"
    bytes 4-7   H, the header length in bytes (unsigned 32-bit)
    H bytes     the header, UTF-8 JSON
    payload     for each channel, for each coefficient order: one byte w
                (1 to 8), then nseg signed integers of w bytes each

The header carries jd0, seg_days, scale, nseg, nch, ncoef, qexp, the SHA-256
of the JSON the pack was made from, and the pack's provenance. A column holds
one coefficient order of one channel across all segments, stored as
differences from the segment before (the first value is itself). A
coefficient is the running sum of its column times 2**qexp.

The quantum is a power of two, so the multiplication is exact and a decoded
pack is the same list of doubles in every language. Decoding uses only
integer addition and that one exact scaling. Mirrors packbin.ts in the
TypeScript engine.
"""
import hashlib
import json
import math
import sys
from array import array
from itertools import accumulate

MAGIC = b"CPK1"
FORMAT = "caelus-pack"
VERSION = 1

# The quantum sits at least this factor below the pack's fit residual. With
# at most 37 coefficients a series, the worst rounding a decoded position can
# carry is 37 half-quanta, about 7% of the residual; measured, it is under 2%.
RESIDUAL_FACTOR = 256.0

_ARRAY_CODES = {1: "b", 2: "h", 4: "i", 8: "q"}


def residual_units(pack):
    """The pack's fit residual in the units its coefficients are stored in,
    or None when the provenance states none."""
    prov = pack.get("provenance") or {}
    resid = prov.get("fit_residual_au")
    if resid is None:
        resid = prov.get("fit_residual_km")
    if resid is None:
        return None
    return resid / pack.get("scale", 1.0)


def quantum_exponent(pack, factor=RESIDUAL_FACTOR):
    """The exponent e such that the quantum 2**e is the largest power of two
    at or below the fit residual divided by `factor`."""
    resid = residual_units(pack)
    if resid is None or not resid > 0:
        raise ValueError("pack has no fit residual to derive a quantum from")
    return math.floor(math.log2(resid / factor))


def _width(max_abs):
    """Bytes needed for a signed integer of this magnitude."""
    for w in range(1, 9):
        if max_abs < (1 << (8 * w - 1)):
            return w
    raise ValueError(f"delta {max_abs} does not fit in 8 bytes")


def encode_pack(pack, qexp=None, source_sha256=None):
    """A pack dict ({jd0, seg_days, scale, segments, provenance}) as CPK1
    bytes. `qexp` defaults to quantum_exponent(pack)."""
    segs = pack["segments"]
    nseg, nch, ncoef = len(segs), len(segs[0]), len(segs[0][0])
    for s in segs:
        if len(s) != nch or any(len(ch) != ncoef for ch in s):
            raise ValueError("pack segments are not a uniform block")
    if qexp is None:
        qexp = quantum_exponent(pack)
    q = math.ldexp(1.0, qexp)
    header = {
        "format": FORMAT, "version": VERSION,
        "jd0": pack["jd0"], "seg_days": pack["seg_days"],
        "scale": pack.get("scale", 1.0),
        "nseg": nseg, "nch": nch, "ncoef": ncoef, "qexp": qexp,
    }
    if source_sha256 is not None:
        header["source_sha256"] = source_sha256
    if pack.get("provenance") is not None:
        header["provenance"] = pack["provenance"]
    head = json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    out = bytearray(MAGIC)
    out += len(head).to_bytes(4, "little")
    out += head
    for c in range(nch):
        for k in range(ncoef):
            prev = 0
            deltas = []
            for s in range(nseg):
                v = round(segs[s][c][k] / q)
                deltas.append(v - prev)
                prev = v
            w = _width(max(abs(d) for d in deltas))
            out.append(w)
            for d in deltas:
                out += d.to_bytes(w, "little", signed=True)
    return bytes(out)


def _read_column(buf, pos, nseg, w):
    """nseg signed little-endian integers of w bytes each, from buf[pos:]."""
    end = pos + nseg * w
    if w in _ARRAY_CODES:
        col = array(_ARRAY_CODES[w])
        if col.itemsize == w:
            col.frombytes(buf[pos:end])
            if sys.byteorder != "little":
                col.byteswap()
            return col
    from_bytes = int.from_bytes
    return [from_bytes(buf[i:i + w], "little", signed=True)
            for i in range(pos, end, w)]


def decode_header(buf):
    """(header dict, offset of the payload) for CPK1 bytes."""
    if bytes(buf[:4]) != MAGIC:
        raise ValueError("not a CPK1 pack")
    hlen = int.from_bytes(buf[4:8], "little")
    header = json.loads(bytes(buf[8:8 + hlen]).decode("utf-8"))
    if header.get("format") != FORMAT or header.get("version") != VERSION:
        raise ValueError(f"unsupported pack format {header.get('format')!r} "
                         f"version {header.get('version')!r}")
    return header, 8 + hlen


def decode_pack(buf):
    """CPK1 bytes as a pack dict, the same shape the JSON packs load to. The
    coefficients are exact multiples of the quantum."""
    header, pos = decode_header(buf)
    nseg, nch, ncoef = header["nseg"], header["nch"], header["ncoef"]
    q = math.ldexp(1.0, header["qexp"])
    segments = [[[0.0] * ncoef for _ in range(nch)] for _ in range(nseg)]
    for c in range(nch):
        for k in range(ncoef):
            w = buf[pos]
            if not 1 <= w <= 8:
                raise ValueError(f"bad column width {w}")
            pos += 1
            col = _read_column(buf, pos, nseg, w)
            pos += nseg * w
            for s, v in enumerate(accumulate(col)):
                segments[s][c][k] = v * q
    if pos != len(buf):
        raise ValueError("pack has trailing or missing bytes")
    pack = {"jd0": header["jd0"], "seg_days": header["seg_days"],
            "scale": header["scale"], "segments": segments}
    if "provenance" in header:
        pack["provenance"] = header["provenance"]
    pack["quantum_exponent"] = header["qexp"]
    return pack


def load_pack(path):
    """A pack from disk: CPK1 when the file ends in .cpk, JSON otherwise."""
    if path.endswith(".cpk"):
        with open(path, "rb") as f:
            return decode_pack(f.read())
    with open(path) as f:
        return json.load(f)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
