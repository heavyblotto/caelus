"use client";

import { useState } from "react";
import { JetBrains_Mono } from "next/font/google";
import { highlightCode, type HighlightLang } from "../lib/highlight";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
        border: "1px solid #2a2438",
        borderRadius: 8,
        overflow: "hidden",
        background: "#0f0d18",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.45rem 0.85rem",
          background: "#161322",
          borderBottom: "1px solid #2a2438",
          fontSize: "0.72rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#8b849e",
        }}
      >
        <span>{label ?? LANG_LABEL[lang]}</span>
        <button
          type="button"
          onClick={copy}
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            letterSpacing: "inherit",
            textTransform: "inherit",
            color: copied ? "#9fdc9f" : "#8a7fd4",
            background: "transparent",
            border: "none",
            padding: "0.15rem 0.35rem",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className={mono.className}
        style={{
          margin: 0,
          padding: "1rem 1.1rem",
          overflow: "auto",
          fontSize: "0.8125rem",
          lineHeight: 1.65,
          tabSize: 2,
          background: "#13101e",
          color: "#d8d4e8",
        }}
      >
        <code style={{ fontFamily: "inherit" }}>{highlightCode(code, lang)}</code>
      </pre>
    </figure>
  );
}
