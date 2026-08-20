# Backlog — semantic echoes

Pairs of essays whose **whole-essay embeddings** are close, found by
cosine similarity over BGE-M3 vectors (one vector per essay). Unlike
the near-duplicate and echo lints, this sees paraphrase: two essays
can share no sentence and still say the same thing.

Pairs within the same family that share the same first body are
excluded — siblings legitimately resemble each other. So are mirror
pairs within the same family (the same unordered body pair and
aspect, e.g. transit:saturn:trine:pluto vs transit:pluto:trine:saturn):
they describe the same sky geometry from swapped roles, and repair
on both sides does not move their similarity. Everything reported
here is cross-cutting.

## Method

- Model: BAAI/bge-m3, 1024-dim, normalized; full pairwise cosine over
  3,056 essays (4,618,712 eligible pairs after the sibling
  and mirror exclusions).
- Similarity distribution of eligible pairs: p50 0.633, p90 0.708,
  p99 0.777, max 0.880.
- Threshold: **0.88**, chosen from that distribution to yield a
  reviewable list. At this cutoff: **0 pairs**.
- Regenerate: `uv run python report_semantic_echoes.py` in
  `pipeline/embeddings/` (after `embed.py`).

**0 findings across the corpus, 0 distinct pairs.**
Each pair is reported against both of its entries, so the pair count
is the number of repairs owed.

## By family

| family | findings |
|---|---|

## By file — this is the worklist

One reviewer per file, or per group of files sharing a first body.
Edit only the files in your own scope; when a finding names an entry
in someone else's file, fix your side and leave theirs.

| file | findings |
|---|---|

## Findings
