# Corpus embeddings

Local embedding pipeline for the corpus essays. One vector per essay,
keyed by cell id. No chunking: the essays are already chunk-sized
(median ~361 words).

## Model

BAAI/bge-m3. 1024 dimensions, normalized float32, max sequence 512,
batch 24. Runs on MPS when available, CPU otherwise. Same setup as the
Steiner pipeline.

## Run

```bash
cd packages/caelus-corpus/pipeline/embeddings
uv sync
uv run python embed.py                    # ~3 min on M5 Pro (MPS)
uv run python report_semantic_echoes.py   # backlog/semantic-echoes.md
uv run python neighbors.py                # artifacts/embeddings/neighbors.json
```

Measured: 3,056 essays in 187 s (16.3/s) on MPS, M5 Pro. First run
downloads the model (~2 GB) to the Hugging Face cache.

## Outputs

- `artifacts/embeddings/essays.parquet` — id, family, vector.
  Regenerable, ~11 MB, **gitignored**.
- `artifacts/embeddings/embeddings_manifest.json` — model, dim,
  normalized, max_seq, count, generated, elapsed_s. Committed.
- `artifacts/embeddings/neighbors.json` — top 8 nearest neighbors per
  essay with cosine scores. Small. **Committed.**
- `backlog/semantic-echoes.md` — cross-cutting pairs above the
  threshold, worklist format. Committed.

## Semantic echoes

Full pairwise cosine over the normalized vectors. Pairs within the same
family sharing the same first body are excluded; siblings resemble each
other by design. Threshold 0.88, chosen from the distribution
(p50 0.633, p90 0.709, p99 0.779, max 0.935) to yield 168 pairs.
`--probe` prints the distribution without writing the report. If the
corpus changes shape, re-probe before trusting the constant.
