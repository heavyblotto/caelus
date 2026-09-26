"""Write the top-8 nearest neighbors for every essay.

Loads artifacts/embeddings/essays.parquet and emits
artifacts/embeddings/neighbors.json: for each cell id, the eight
most-similar other essay ids with cosine scores rounded to 3 decimals.
Keys are sorted for stable diffs; this file is committed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import polars as pl

PKG = Path(__file__).resolve().parents[2]
EMB = PKG / "artifacts" / "embeddings"
K = 8


def main() -> None:
    df = pl.read_parquet(EMB / "essays.parquet")
    ids = df["id"].to_list()
    vecs = np.stack(df["vector"].to_numpy())
    sim = vecs @ vecs.T
    np.fill_diagonal(sim, -1.0)

    top = np.argpartition(-sim, K, axis=1)[:, :K]
    neighbors: dict[str, list[list[object]]] = {}
    for row, cell_id in enumerate(ids):
        ranked = top[row][np.argsort(-sim[row, top[row]])]
        neighbors[cell_id] = [
            [ids[j], round(float(sim[row, j]), 3)] for j in ranked
        ]

    out = EMB / "neighbors.json"
    out.write_text(
        json.dumps({k: neighbors[k] for k in sorted(neighbors)}, indent=1) + "\n"
    )
    print(f"wrote {out.relative_to(PKG)} ({len(neighbors)} keys)", file=sys.stderr)


if __name__ == "__main__":
    main()
