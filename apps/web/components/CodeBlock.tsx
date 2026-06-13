"use client";

import { useState } from "react";
import { highlightCode, type HighlightLang } from "../lib/highlight";

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
};

export default function CodeBlock({ code, lang, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <figure
      style={{
        margin: "1rem 0 1.25rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        background: "var(--bg-elev)",
      }}
    >
      <figcaption
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.45rem 0.85rem",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.72rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-mute)",
        }}
      >
        <span className="mono">{label ?? LANG_LABEL[lang]}</span>
        <button
          type="button"
          onClick={copy}
          className="mono"
          style={{
            font: "inherit",
            letterSpacing: "inherit",
            textTransform: "inherit",
            color: copied ? "var(--good)" : "var(--accent)",
            background: "transparent",
            border: "none",
            padding: "0.15rem 0.35rem",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre
        style={{
          margin: 0,
          border: "none",
          borderRadius: 0,
          background: "var(--surface)",
          color: "var(--syntax-text)",
        }}
      >
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </figure>
  );
}
