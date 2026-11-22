"use client";

import { useRef, useState, type ReactNode } from "react";
import { highlightCode, type HighlightLang } from "../lib/highlight";
import { runBlocks, type RunOutcome } from "../lib/runnable-client";

export type CodeBlockLang = HighlightLang | "python";

export type CodeBlockTab = {
  id: string;
  label: string;
  lang: CodeBlockLang;
  code: string;
  fileLabel?: string;
  run?: boolean;
};

const LANG_LABEL: Record<CodeBlockLang, string> = {
  typescript: "TypeScript",
  tsx: "TSX",
  json: "JSON",
  bash: "Terminal",
  python: "Python",
};

const PY_KEYWORDS = new Set([
  "from", "import", "as", "def", "return", "for", "in", "if", "else", "elif",
  "True", "False", "None", "and", "or", "not", "with", "print",
]);

function pySpan(color: string, text: string, key: string) {
  return <span key={key} style={{ color }}>{text}</span>;
}

function highlightPythonLine(line: string, keyBase: number): ReactNode[] {
  if (!line) return [];
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) {
    return [pySpan("var(--syntax-muted)", line, `${keyBase}-c`)];
  }
  const tokens = line.split(/(\s+|"[^"]*"|'[^']*'|#.*$|[()[\]{},:=.])/);
  return tokens
    .filter((tok) => tok.length > 0)
    .map((tok, i) => {
      const k = `${keyBase}-${i}`;
      if (tok.startsWith("#")) return pySpan("var(--syntax-muted)", tok, k);
      if (tok.startsWith('"') || tok.startsWith("'")) return pySpan("var(--syntax-string)", tok, k);
      if (/^-?\d+(?:\.\d+)?$/.test(tok)) return pySpan("var(--syntax-number)", tok, k);
      if (PY_KEYWORDS.has(tok)) return pySpan("var(--syntax-keyword)", tok, k);
      if (/^[A-Z][\w]*$/.test(tok)) return pySpan("var(--syntax-fn)", tok, k);
      if (/^[()[\]{},:=.]$/.test(tok)) return pySpan("var(--syntax-punct)", tok, k);
      return pySpan("var(--syntax-text)", tok, k);
    });
}

function renderHighlighted(code: string, lang: CodeBlockLang): ReactNode {
  if (lang !== "python") return highlightCode(code, lang);
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {highlightPythonLine(line, i)}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </>
  );
}

type CodeBlockProps = {
  code?: string;
  lang?: CodeBlockLang;
  label?: string;
  /**
   * Adds a Run control that executes the block in the reader's browser and
   * shows the value of its last expression. Set by the `run` flag on a code
   * fence (```ts run) or directly on the element. The block may import only
   * `caelus` and `caelus/data-embedded`; see lib/runnable-core.mjs.
   */
  run?: boolean;
  /** Optional multi-runtime tabs for side-by-side comparison. */
  tabs?: CodeBlockTab[];
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

export default function CodeBlock({
  code = "",
  lang = "typescript",
  label,
  run = false,
  tabs,
}: CodeBlockProps) {
  const [activeTabId, setActiveTabId] = useState(tabs?.[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<RunState>({ status: "idle" });
  const figure = useRef<HTMLElement>(null);

  const activeTab = tabs?.find((t) => t.id === activeTabId) ?? tabs?.[0];
  const currentCode = activeTab ? activeTab.code : code;
  const currentLang = activeTab ? activeTab.lang : lang;
  const currentLabel = activeTab ? (activeTab.fileLabel ?? LANG_LABEL[activeTab.lang]) : (label ?? LANG_LABEL[lang]);
  const currentRun = activeTab ? Boolean(activeTab.run) : run;

  const copy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const runExample = async () => {
    if (!figure.current || state.status === "running") return;
    setState({ status: "running" });
    setState(await runBlocks(blocksThrough(figure.current)));
  };

  const selectTab = (id: string) => {
    setActiveTabId(id);
    setCopied(false);
    setState({ status: "idle" });
  };

  const output = describe(state);
  const running = state.status === "running";

  const figureEl = (
    <figure className="codeblock" ref={figure} data-run-block={currentRun ? "" : undefined}>
      <figcaption className="codeblock__h">
        <span>{currentLabel}</span>
        <span className="row">
          {currentRun && (
            <button type="button" onClick={runExample} disabled={running} aria-busy={running}>
              {running ? "Running" : "Run"}
            </button>
          )}
          <button type="button" onClick={copy} data-copied={copied ? "" : undefined}>
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </figcaption>
      <pre data-run-code={currentRun ? "" : undefined}>
        <code>{renderHighlighted(currentCode, currentLang)}</code>
      </pre>
      {currentRun && (
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

  if (!tabs || tabs.length === 0) return figureEl;

  return (
    <div className="code-compare">
      <div className="tabs__list" role="tablist" aria-label="Runtime code examples">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tab.id === activeTab?.id}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {figureEl}
    </div>
  );
}
