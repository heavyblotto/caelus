"use client";

import { useRef, useState } from "react";
import { highlightCode, type HighlightLang } from "../lib/highlight";
import { runBlocks, type RunOutcome } from "../lib/runnable-client";

const LANG_LABEL: Record<HighlightLang, string> = {
  typescript: "TypeScript",
  tsx: "TSX",
  json: "JSON",
  bash: "Terminal",
};

type CodeBlockProps = {
  code: string;
  lang: HighlightLang;
  label?: string;
  /**
   * Adds a Run control that executes the block in the reader's browser and
   * shows the value of its last expression. Set by the `run` flag on a code
   * fence (```ts run) or directly on the element. The block may import only
   * `caelus` and `caelus/data-embedded`; see lib/runnable-core.mjs.
   */
  run?: boolean;
};

type RunState = { status: "idle" } | { status: "running" } | RunOutcome;

/**
 * The code of every runnable block on the page from the first down to this
 * one. A block sees the names the runnable blocks above it declared, so they
 * run first. Read from the DOM, so it holds across separately hydrated blocks.
 */
function blocksThrough(figure: HTMLElement): string[] {
  const codes: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("[data-run-block]")) {
    codes.push(el.querySelector("[data-run-code]")?.textContent ?? "");
    if (el === figure) break;
  }
  return codes;
}

function describe(state: RunState): { label: string; text: string } | null {
  switch (state.status) {
    case "idle":
    case "running":
      return null;
    case "timeout":
      return {
        label: "Stopped",
        text: `Stopped after ${state.seconds} seconds. The example did not finish in the time this page allows.`,
      };
    case "error":
      return { label: "Error", text: [...state.logs, state.error].join("\n") };
    case "done": {
      const value = state.result ?? "No value: the block ends in a declaration, not an expression.";
      return { label: `Result · ${state.ms} ms`, text: [...state.logs, value].join("\n") };
    }
  }
}

export default function CodeBlock({ code, lang, label, run = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<RunState>({ status: "idle" });
  const figure = useRef<HTMLElement>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const runExample = async () => {
    if (!figure.current || state.status === "running") return;
    setState({ status: "running" });
    setState(await runBlocks(blocksThrough(figure.current)));
  };

  const output = describe(state);
  const running = state.status === "running";

  return (
    <figure className="codeblock" ref={figure} data-run-block={run ? "" : undefined}>
      <figcaption className="codeblock__h">
        <span>{label ?? LANG_LABEL[lang]}</span>
        <span style={{ display: "flex", gap: "1rem" }}>
          {run && (
            <button type="button" onClick={runExample} disabled={running} aria-busy={running}>
              {running ? "Running" : "Run"}
            </button>
          )}
          <button type="button" onClick={copy} data-copied={copied ? "" : undefined}>
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </figcaption>
      <pre data-run-code={run ? "" : undefined}>
        <code>{highlightCode(code, lang)}</code>
      </pre>
      {run && (
        <div role="status" aria-live="polite">
          {output && (
            <>
              <div className="codeblock__h" style={{ borderTop: "1px solid var(--line)" }}>
                <span>{output.label}</span>
              </div>
              <pre
                style={{
                  color: state.status === "done" ? "var(--text)" : "var(--bad)",
                  maxHeight: "22rem",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {output.text}
              </pre>
            </>
          )}
        </div>
      )}
    </figure>
  );
}
