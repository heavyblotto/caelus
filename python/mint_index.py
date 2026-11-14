#!/usr/bin/env python3
"""Write index.json for a directory of minted bodies: one row per
certificate, so a client can list what has been minted without fetching each
certificate. Every certificate is checked against the pack beside it first,
and a pair that does not match stops the run.

    python3 mint_index.py minted/
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astroengine.minted import check_certificate, verify_minted_pack

INDEX_FORMAT = "caelus-mint-index"


def build_index(directory):
    rows = []
    for name in sorted(os.listdir(directory)):
        if not name.endswith(".cert.json"):
            continue
        with open(os.path.join(directory, name)) as f:
            cert = check_certificate(json.load(f))
        with open(os.path.join(directory, cert["pack"]["file"]), "rb") as f:
            verify_minted_pack(f.read(), cert)
        rows.append({
            "id": cert["id"], "number": cert["number"], "name": cert["name"],
            "from": cert["span"]["from"], "to": cert["span"]["to"],
            "angle_bound_arcsec": cert["error"]["angle_bound_arcsec"],
            "bytes": cert["pack"]["bytes"], "certificate": name,
        })
    rows.sort(key=lambda r: (r["number"], r["from"]))
    return {"format": INDEX_FORMAT, "version": 1, "bodies": rows}


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    directory = sys.argv[1]
    index = build_index(directory)
    with open(os.path.join(directory, "index.json"), "w") as f:
        json.dump(index, f, indent=1)
        f.write("\n")
    print(f"{len(index['bodies'])} minted bodies -> {os.path.join(directory, 'index.json')}")


if __name__ == "__main__":
    main()
