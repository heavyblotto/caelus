"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface InstrumentPresetOption {
  id: string;
  label: string;
  summary: string;
}

export interface InstrumentCodeBundle {
  ts: string;
  python: string;
  mcp: string;
  json: unknown;
}

type CodeTab = "ts" | "python" | "mcp" | "json";

const TABS: Array<{ id: CodeTab; label: string }> = [
  { id: "ts", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "mcp", label: "MCP" },
  { id: "json", label: "Live JSON" },
];

export function useUrlPreset(validIds: string[], fallback: string): [string, (id: string) => void] {
  const [preset, setPreset] = useState(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("preset");
    if (raw && validIds.includes(raw)) {
      setPreset(raw);
    }
  }, [validIds]);

  return [preset, setPreset];
}

export default function InstrumentWorkbench({
  id,
  title,
  presets,
  activePreset,
  onSelectPreset,
  code,
  children,
}: {
  id: string;
  title: string;
  presets: InstrumentPresetOption[];
  activePreset: string;
  onSelectPreset: (presetId: string) => void;
  code: InstrumentCodeBundle;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<CodeTab>("ts");
  const [status, setStatus] = useState("");
  const tabBaseId = useId();
  const codeSectionId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const jsonText = JSON.stringify(code.json, null, 2);
  const activeText =
    tab === "ts"
      ? code.ts
      : tab === "python"
        ? code.python
        : tab === "mcp"
          ? code.mcp
          : jsonText;

  function onTabKeyDown(e: React.KeyboardEvent, idx: number) {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = TABS.length - 1;
    if (nextIdx != null) {
      e.preventDefault();
      setTab(TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(activeText);
      setStatus(`Copied ${tab.toUpperCase()} output.`);
      setTimeout(() => setStatus(""), 2200);
    } catch {
      setStatus("Clipboard unavailable.");
    }
  }

  function downloadJson() {
    try {
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caelus-${id.toLowerCase()}-${activePreset}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Downloaded JSON output.");
      setTimeout(() => setStatus(""), 2200);
    } catch {
      setStatus("Download unavailable.");
    }
  }

  return (
    <div className="inst-shell">
      <div className="bench">
        <div className="tile s12">
          <div className="tile__h">
            <b>{id}</b>
            <span>Quick presets · {title}</span>
            <div className="tile__actions">
              <a href={`#${codeSectionId}`} className="btn btn-ghost btn-sm">
                Code &amp; JSON &darr;
              </a>
              <Link href="/instruments" className="btn btn-ghost btn-sm">
                All instruments
              </Link>
              <Link href="/playground" className="btn btn-secondary btn-sm">
                Playground
              </Link>
            </div>
          </div>
          <div className="tile__b tile__b--compact">
            <div className="preset-bar inst-presets" role="group" aria-label={`${title} presets`}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip preset-chip"
                  aria-pressed={activePreset === p.id}
                  title={p.summary}
                  onClick={() => onSelectPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {children}

      <div className="bench" id={codeSectionId}>
        <section className="tile s12 code-drawer" aria-label={`${title} reproducible API and JSON output`}>
          <div className="tile__h">
            <b>API</b>
            <span>Reproducible call &amp; live JSON ({activePreset})</span>
            <div className="tile__actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyCode()}>
                Copy {tab.toUpperCase()}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadJson}>
                Download JSON
              </button>
            </div>
          </div>
          <div className="tile__b stack--sm">
            <div className="row row--between row--wrap">
              <div className="tabs__list" role="tablist" aria-label="Output format">
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    id={`${tabBaseId}-${t.id}`}
                    type="button"
                    role="tab"
                    className="tabs__tab"
                    aria-selected={tab === t.id}
                    tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    onKeyDown={(e) => onTabKeyDown(e, i)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="status-live dim small" role="status" aria-live="polite">
                {status || "Computed locally from the embedded ephemeris."}
              </p>
            </div>
            <div
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-${tab}`}
              tabIndex={0}
              className="code-drawer__panel"
            >
              <pre className="code"><code>{activeText}</code></pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
