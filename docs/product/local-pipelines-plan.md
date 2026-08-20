# Local pipelines plan

2026-08-20

Maintainer decision: local pipeline work belongs to a fourth agent
track, Cursor, resident on the maintainer's machine. This document
records the split, what the local track covers, and the artifacts
that connect it to the other three tracks (widget/engine,
corpus/Encyclopedia, visual design), which run remotely.

## The split

The boundary is hardware and rights, not product area.

**Runs anywhere, and the remote tracks run it as part of their own
work:** the corpus write loop (`gen-briefs`, the check scripts,
`register-sets`, the harness), the KB build and its drift test, the
figure and plate scans, the root build and test gates. All of it is
public-repo Node with no special hardware.

**Runs only on the maintainer's machine:** the embeddings pipeline
(sentence-transformers on MPS), the library ingestion path end to
end (capture, OCR, QA, the private store that never enters the
public repo, per `docs/product/library-ingestion-plan.md`), the
text-mining layer wherever it reads private-store text, and the
Memorativa oracle fixtures derived from in-copyright scans. Remote
agents cannot reach any of this; the rights boundary is the machine.

## The local track

Cursor runs and maintains the local side:

- The embeddings pipeline (`pipeline/embeddings/`): essay vectors,
  `neighbors.json`, the semantic-echo report, and the library chunk
  vectors as scans land.
- Library ingestion: OCR runs, escalation passes, the QA harness,
  the private store layout, and the catalog columns that record scan
  status and QA results in `docs/product/library.csv`.
- The text-mining layer over private-store text: annotations,
  concept occurrences, statistics, and the mined-attestation queues.
- Memorativa's hash-pinned private fixtures.

Long batch jobs (OCR across ~365 titles, corpus-wide annotation
runs) suit scripts on a scheduler better than an interactive agent
session; the local track authors the scripts, the machine grinds,
and the agent works the queues and results.

## The interface

The committed artifacts are how the tracks meet. The local track
produces, the remote tracks consume:

- `neighbors.json` and the semantic-echo report
- catalog rows, scan status, and QA scores in `library.csv`
- the aggregate text-mining reports and occurrence datasets
  (committed side only; derivatives of in-copyright text stay in the
  private store)
- fixture manifests for Memorativa's private oracles

Remote tracks treat these as inputs they cannot refresh; a refresh
is a request to the local track. In the other direction, the local
track consumes the repo as any contributor does: the corpus data,
the KB, the engines.

## Coordination

`openmemory.md` is the shared file, now with four writers; edits
stay additive. The local track's state that other agents need
(embeddings currency, scan progress, queue sizes) lives in the
committed artifacts and the catalog, since Cursor and the Claude
tracks do not share session context.

## Current state

The essay embeddings are stale by B5's 600 essays (written
2026-08-20); regenerating them and the semantic-echo report is the
local track's first task. Library scanning has not started;
`library.csv` carries the inventory.
