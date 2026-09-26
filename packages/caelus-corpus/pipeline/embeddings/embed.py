"""Embed every corpus essay with BGE-M3 on Apple Silicon (MPS).

Reads data/passages/*.json (one JSON array of passages per file), embeds
each essay's text as a single vector keyed by cell id — essays are already
chunk-sized, so there is no chunking. Emits
artifacts/embeddings/essays.parquet with normalized float32 dense vectors
(1024-dim) and a JSON manifest alongside.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import polars as pl
import torch
from sentence_transformers import SentenceTransformer

PKG = Path(__file__).resolve().parents[2]
PASSAGES = PKG / "data" / "passages"
OUT = PKG / "artifacts" / "embeddings"

MODEL = "BAAI/bge-m3"
DIM = 1024
BATCH = 24
MAX_SEQ = 512


def load_essays() -> tuple[list[str], list[str], list[str]]:
    ids: list[str] = []
    families: list[str] = []
    texts: list[str] = []
    for path in sorted(PASSAGES.glob("*.json")):
        for passage in json.loads(path.read_text()):
            ids.append(passage["id"])
            families.append(passage["family"])
            texts.append(passage["text"])
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate cell ids in data/passages")
    return ids, families, texts


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ids, families, texts = load_essays()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = SentenceTransformer(MODEL, device=device)
    model.max_seq_length = MAX_SEQ
    print(f"device={device} essays={len(ids)}", file=sys.stderr)

    t0 = time.time()
    vecs = model.encode(
        texts,
        batch_size=BATCH,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32)
    elapsed = time.time() - t0
    if vecs.shape != (len(ids), DIM):
        raise SystemExit(f"unexpected embedding shape {vecs.shape}")

    pl.DataFrame(
        {"id": ids, "family": families, "vector": [v for v in vecs]}
    ).write_parquet(OUT / "essays.parquet")

    manifest = {
        "model": MODEL,
        "dim": DIM,
        "normalized": True,
        "max_seq": MAX_SEQ,
        "count": len(ids),
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "elapsed_s": round(elapsed, 1),
    }
    (OUT / "embeddings_manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(
        f"done: {len(ids)} essays in {elapsed:.0f}s ({len(ids) / elapsed:.1f}/s)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
