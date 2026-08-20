"""Report semantic echoes across the corpus from the essay embeddings.

Loads artifacts/embeddings/essays.parquet, computes full pairwise cosine
(a single matrix multiply on the normalized vectors), and writes
backlog/semantic-echoes.md in the worklist style of the other backlog
files.

Pairs within the same family that share the same first body are excluded:
siblings legitimately resemble each other. The first body of a cell id is
the first segment after the scope that names a body (natal:mars:sign:aries
-> mars; natal:aspect:sun:conjunction:moon -> sun). Ids with no body
segment (timelord:zr:l1:aries, natal:signature:element:fire) fall back to
their second segment, which collapses each of those families into one
sibling group.

Mirror pairs within the same family are also excluded: two cells with the
same unordered body pair and the same aspect (transit:saturn:trine:pluto
vs transit:pluto:trine:saturn) describe the same sky geometry from swapped
transiter/receiver roles. The B1/B2 repair wave showed their whole-essay
similarity survives sentence-level repair on both sides — the resemblance
is the content, not the writing. Cross-family mirrors (a natal aspect vs
the matching transit aspect) stay reportable: those are different subjects
whose convergence is a genuine writing problem.

Run with --probe to print the similarity distribution and candidate
cutoffs without writing the report. THRESHOLD below was chosen from that
probe to yield a reviewable list.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import polars as pl

PKG = Path(__file__).resolve().parents[2]
PASSAGES = PKG / "data" / "passages"
EMB = PKG / "artifacts" / "embeddings"
REPORT = PKG / "backlog" / "semantic-echoes.md"

THRESHOLD = 0.88  # set from the --probe distribution; see report header

BODIES = {
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
    "uranus", "neptune", "pluto", "chiron", "true_node", "asc", "mc",
}


def first_body(cell_id: str) -> str:
    parts = cell_id.split(":")
    for part in parts[1:]:
        if part in BODIES:
            return part
    return parts[1]


def mirror_key(cell_id: str, family: str) -> str | None:
    """Canonical key for two-body relational cells: family plus the
    unordered body pair plus the aspect. Ids without a body-aspect-body
    triple have no mirror."""
    parts = cell_id.split(":")
    for i in range(len(parts) - 2):
        if parts[i] in BODIES and parts[i + 2] in BODIES and parts[i + 1] not in BODIES:
            a, asp, b = parts[i], parts[i + 1], parts[i + 2]
            return f"{family}|{min(a, b)}~{max(a, b)}|{asp}"
    return None


def id_to_file() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for path in sorted(PASSAGES.glob("*.json")):
        for passage in json.loads(path.read_text()):
            mapping[passage["id"]] = path.name
    return mapping


def eligible_pairs() -> tuple[pl.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    df = pl.read_parquet(EMB / "essays.parquet")
    vecs = np.stack(df["vector"].to_numpy())
    sim = vecs @ vecs.T

    # Sibling key: same family and same first body means the pair is
    # expected to resemble itself and is not reportable.
    keys = [f"{fam}|{first_body(i)}" for i, fam in zip(df["id"], df["family"])]
    codes = np.array([hash(k) for k in keys])

    # Mirror key: same family, same unordered body pair, same aspect.
    # None (no mirror possible) hashes to a per-row unique sentinel.
    mirrors = [mirror_key(i, fam) for i, fam in zip(df["id"], df["family"])]
    mcodes = np.array([hash(m) if m is not None else -1 - n for n, m in enumerate(mirrors)])

    i_idx, j_idx = np.triu_indices(df.height, k=1)
    mask = (codes[i_idx] != codes[j_idx]) & (mcodes[i_idx] != mcodes[j_idx])
    return df, i_idx[mask], j_idx[mask], sim[i_idx[mask], j_idx[mask]]


def probe(scores: np.ndarray) -> None:
    p50, p90, p99 = np.percentile(scores, [50, 90, 99])
    print(f"eligible pairs: {scores.size:,}")
    print(f"p50={p50:.3f} p90={p90:.3f} p99={p99:.3f} max={scores.max():.3f}")
    for cut in np.arange(0.86, 0.96, 0.01):
        print(f"  >= {cut:.2f}: {(scores >= cut).sum():,} pairs")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--probe", action="store_true", help="print distribution only")
    args = ap.parse_args()

    df, i_idx, j_idx, scores = eligible_pairs()
    p50, p90, p99 = np.percentile(scores, [50, 90, 99])
    probe(scores)
    if args.probe:
        return

    hits = np.where(scores >= THRESHOLD)[0]
    order = hits[np.argsort(-scores[hits])]
    ids = df["id"].to_list()
    fams = df["family"].to_list()
    pairs = [(ids[i_idx[k]], fams[i_idx[k]], ids[j_idx[k]], fams[j_idx[k]], float(scores[k])) for k in order]
    print(f"threshold {THRESHOLD}: {len(pairs)} pairs", file=sys.stderr)

    files = id_to_file()

    # Report each pair against both of its entries, grouped by file, so the
    # per-file table is the reviewer assignment — same convention as the
    # other backlog worklists.
    by_file: dict[str, list[str]] = {}
    fam_counts: dict[str, int] = {}
    for id_a, fam_a, id_b, fam_b, score in pairs:
        for me, my_fam, other, other_fam in ((id_a, fam_a, id_b, fam_b), (id_b, fam_b, id_a, fam_a)):
            line = (
                f"- **{me}** — {my_fam} echoes {other_fam} -- "
                f"cosine {score:.3f} with {other}"
            )
            by_file.setdefault(files[me], []).append(line)
            fam_counts[my_fam] = fam_counts.get(my_fam, 0) + 1

    lines = [
        "# Backlog — semantic echoes",
        "",
        "Pairs of essays whose **whole-essay embeddings** are close, found by",
        "cosine similarity over BGE-M3 vectors (one vector per essay). Unlike",
        "the near-duplicate and echo lints, this sees paraphrase: two essays",
        "can share no sentence and still say the same thing.",
        "",
        "Pairs within the same family that share the same first body are",
        "excluded — siblings legitimately resemble each other. So are mirror",
        "pairs within the same family (the same unordered body pair and",
        "aspect, e.g. transit:saturn:trine:pluto vs transit:pluto:trine:saturn):",
        "they describe the same sky geometry from swapped roles, and repair",
        "on both sides does not move their similarity. Everything reported",
        "here is cross-cutting.",
        "",
        "## Method",
        "",
        "- Model: BAAI/bge-m3, 1024-dim, normalized; full pairwise cosine over",
        f"  {df.height:,} essays ({scores.size:,} eligible pairs after the sibling",
        "  and mirror exclusions).",
        f"- Similarity distribution of eligible pairs: p50 {p50:.3f}, p90 {p90:.3f},",
        f"  p99 {p99:.3f}, max {scores.max():.3f}.",
        f"- Threshold: **{THRESHOLD}**, chosen from that distribution to yield a",
        f"  reviewable list. At this cutoff: **{len(pairs)} pairs**.",
        "- Regenerate: `uv run python report_semantic_echoes.py` in",
        "  `pipeline/embeddings/` (after `embed.py`).",
        "",
        f"**{2 * len(pairs)} findings across the corpus, {len(pairs)} distinct pairs.**",
        "Each pair is reported against both of its entries, so the pair count",
        "is the number of repairs owed.",
        "",
        "## By family",
        "",
        "| family | findings |",
        "|---|---|",
    ]
    for fam, n in sorted(fam_counts.items(), key=lambda kv: -kv[1]):
        lines.append(f"| {fam} | {n} |")
    lines += [
        "",
        "## By file — this is the worklist",
        "",
        "One reviewer per file, or per group of files sharing a first body.",
        "Edit only the files in your own scope; when a finding names an entry",
        "in someone else's file, fix your side and leave theirs.",
        "",
        "| file | findings |",
        "|---|---|",
    ]
    for fname, items in sorted(by_file.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        lines.append(f"| `{fname}` | {len(items)} |")
    lines += ["", "## Findings", ""]
    for fname in sorted(by_file):
        lines.append(f"### {fname}")
        lines.append("")
        lines.extend(by_file[fname])
        lines.append("")

    REPORT.write_text("\n".join(lines).rstrip() + "\n")
    print(f"wrote {REPORT.relative_to(PKG)}", file=sys.stderr)


if __name__ == "__main__":
    main()
