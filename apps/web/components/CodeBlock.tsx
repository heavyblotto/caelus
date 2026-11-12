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
    <figure className="codeblock">
      <figcaption className="codeblock__h">
        <span>{label ?? LANG_LABEL[lang]}</span>
        <button type="button" onClick={copy} data-copied={copied ? "" : undefined}>
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code>{highlightCode(code, lang)}</code>
      </pre>
    </figure>
  );
}
