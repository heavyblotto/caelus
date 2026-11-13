/**
 * Page-side handle on the example worker (runnable.worker.ts).
 *
 * One worker serves every runnable block on a page. It is created the first
 * time a reader presses Run, which is also when the engine downloads. A run
 * that exceeds the time limit is stopped by terminating the worker; the next
 * run starts a fresh one.
 */
import type { RunRequest, RunResponse } from "./runnable.worker";

/** How long one run may take before it is stopped. */
export const RUN_TIME_LIMIT_MS = 15_000;

export type RunOutcome =
  | { status: "done"; result: string | null; logs: string[]; ms: number }
  | { status: "error"; error: string; logs: string[]; ms: number }
  | { status: "timeout"; seconds: number };

type Pending = { resolve: (outcome: RunOutcome) => void; timer: ReturnType<typeof setTimeout> };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function settle(id: number, outcome: RunOutcome) {
  const entry = pending.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.resolve(outcome);
}

function stopWorker(outcomeFor: (id: number) => RunOutcome) {
  worker?.terminate();
  worker = null;
  for (const id of [...pending.keys()]) settle(id, outcomeFor(id));
}

function getWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL("./runnable.worker.ts", import.meta.url), { type: "module" });
  created.onmessage = (event: MessageEvent<RunResponse>) => {
    const r = event.data;
    settle(
      r.id,
      r.ok
        ? { status: "done", result: r.result, logs: r.logs, ms: r.ms }
        : { status: "error", error: r.error, logs: r.logs, ms: r.ms },
    );
  };
  created.onerror = (event) => {
    event.preventDefault?.();
    const error = event.message || "The example runner failed to load.";
    stopWorker(() => ({ status: "error", error, logs: [], ms: 0 }));
  };
  worker = created;
  return created;
}

/**
 * Run a page's runnable blocks up to and including the last one given, and
 * resolve with what the last block produced. Never rejects.
 */
export function runBlocks(blocks: string[]): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      stopWorker(() => ({ status: "timeout", seconds: RUN_TIME_LIMIT_MS / 1000 }));
    }, RUN_TIME_LIMIT_MS);
    pending.set(id, { resolve, timer });
    try {
      getWorker().postMessage({ id, blocks } satisfies RunRequest);
    } catch (err) {
      settle(id, { status: "error", error: err instanceof Error ? err.message : String(err), logs: [], ms: 0 });
    }
  });
}
