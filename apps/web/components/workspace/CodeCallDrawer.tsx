"use client";

import { useId, useRef, useState } from "react";
import type { Chart } from "caelus";
import type { GeneratedCode } from "./codeGen";

type CodeLang = "ts" | "python" | "mcp" | "json";

const LANG_TABS: Array<{ id: CodeLang; label: string }> = [
  { id: "ts", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "mcp", label: "MCP" },
  { id: "json", label: "JSON" },
];

export default function CodeCallDrawer({
  code,
  chart,
  open,
  onClose,
  selectedBody,
}: {
  code: GeneratedCode;
  chart: Chart | null;
  open: boolean;
  onClose: () => void;
  selectedBody: string | null;
}) {
  const [lang, setLang] = useState<CodeLang>("ts");
  const [statusMsg, setStatusMsg] = useState("");
  const tabBaseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!open) return null;

  const jsonText = chart ? JSON.stringify(chart, null, 2) : "{}";
  const activeText =
    lang === "ts"
      ? code.ts
      : lang === "python"
        ? code.python
        : lang === "mcp"
          ? code.mcp
          : jsonText;

  function selectLang(next: CodeLang) {
    setLang(next);
    setStatusMsg("");
  }

  function onTabKeyDown(e: React.KeyboardEvent, idx: number) {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % LANG_TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + LANG_TABS.length) % LANG_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = LANG_TABS.length - 1;
    if (nextIdx != null) {
      e.preventDefault();
      selectLang(LANG_TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  }

  async function copyActive() {
    try {
      await navigator.clipboard.writeText(activeText);
      setStatusMsg(`Copied ${lang.toUpperCase()} snippet.`);
      setTimeout(() => setStatusMsg(""), 2200);
    } catch {
      setStatusMsg("Copy failed: clipboard unavailable.");
    }
  }

  function downloadJson() {
    if (!chart) return;
    try {
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caelus-chart-${chart.jdUt.toFixed(2)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg("Downloaded chart JSON.");
      setTimeout(() => setStatusMsg(""), 2200);
    } catch {
      setStatusMsg("Download unavailable.");
    }
  }

  return (
    <section className="tile s12 code-drawer" aria-label="Reproducible code call">
      <div className="tile__h">
        <b>CODE</b>
        <span>
          Reproducible call{selectedBody ? ` (${selectedBody})` : ""}
        </span>
        <button type="button" onClick={onClose} aria-label="Close code drawer">
          Hide
        </button>
      </div>
      <div className="tile__b stack--sm">
        <div className="row row--between row--wrap">
          <div className="tabs__list" role="tablist" aria-label="Code language">
            {LANG_TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                id={`${tabBaseId}-${t.id}`}
                type="button"
                role="tab"
                className="tabs__tab"
                aria-selected={lang === t.id}
                tabIndex={lang === t.id ? 0 : -1}
                onClick={() => selectLang(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="row row--wrap">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyActive()}>
              Copy {lang.toUpperCase()}
            </button>
            {chart && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadJson}>
                Download JSON
              </button>
            )}
          </div>
        </div>
        <p className="status-live dim small" role="status" aria-live="polite">
          {statusMsg || "Runs locally with zero network I/O."}
        </p>
        <div
          role="tabpanel"
          aria-labelledby={`${tabBaseId}-${lang}`}
          tabIndex={0}
          className="code-drawer__panel"
        >
          <pre className="code"><code>{activeText}</code></pre>
        </div>
      </div>
    </section>
  );
}
