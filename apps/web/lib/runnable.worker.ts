/**
 * Web Worker that runs a docs example (see runnable-core.mjs).
 *
 * The engine and the embedded dataset are imported here and nowhere on the
 * page, so they download when the reader first presses Run and not before.
 * Running off the main thread keeps the page responsive during a long search,
 * and lets the page stop a runaway example by terminating the worker.
 */
import * as caelus from "caelus";
import * as dataEmbedded from "caelus/data-embedded";
import { execute, formatValue } from "./runnable-core.mjs";

/** The module table: the only specifiers an example can import. */
const MODULES: Record<string, unknown> = {
  caelus,
  "caelus/data-embedded": dataEmbedded,
};

export type RunRequest = { id: number; blocks: string[] };
export type RunResponse =
  | { id: number; ok: true; result: string | null; logs: string[]; ms: number }
  | { id: number; ok: false; error: string; logs: string[]; ms: number };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RunRequest>) => void) | null;
  postMessage: (message: RunResponse) => void;
};

scope.onmessage = async (event) => {
  const { id, blocks } = event.data;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  let logs: string[] = [];
  try {
    const ran = execute(blocks, MODULES);
    logs = ran.logs;
    const value = await ran.value;
    scope.postMessage({ id, ok: true, result: value === undefined ? null : formatValue(value), logs, ms: elapsed() });
  } catch (err) {
    const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    scope.postMessage({ id, ok: false, error, logs, ms: elapsed() });
  }
};
