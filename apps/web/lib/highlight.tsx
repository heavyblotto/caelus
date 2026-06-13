import type { ReactNode } from "react";

export type HighlightLang = "typescript" | "tsx" | "json" | "bash";

const C = {
  text: "#d8d4e8",
  muted: "#8b849e",
  keyword: "#c4b5fd",
  string: "#9fdc9f",
  number: "#f0a878",
  fn: "#7dcfff",
  punct: "#89ddff",
  prop: "#e2d9ff",
} as const;

const TS_KEYWORDS = new Set([
  "const", "let", "import", "from", "export", "new", "return", "true", "false",
  "async", "await", "type", "interface", "null", "undefined",
]);

function span(color: string, text: string, key: string) {
  return <span key={key} style={{ color }}>{text}</span>;
}

function highlightString(line: string, quote: "'" | '"', start: number, keyBase: number): [ReactNode[], number] {
  const out: ReactNode[] = [];
  let i = start + 1;
  let chunk = quote;
  while (i < line.length) {
    if (line[i] === "\\" && i + 1 < line.length) {
      chunk += line[i] + line[i + 1];
      i += 2;
      continue;
    }
    if (line[i] === quote) {
      chunk += quote;
      out.push(span(C.string, chunk, `${keyBase}-s`));
      return [out, i + 1];
    }
    chunk += line[i];
    i++;
  }
  out.push(span(C.string, chunk, `${keyBase}-s`));
  return [out, line.length];
}

function highlightTsLine(line: string, keyBase: number): ReactNode[] {
  if (!line) return [];
  const comment = line.match(/^(\s*)(\/\/.*)$/);
  if (comment) {
    return [
      span(C.text, comment[1], `${keyBase}-w`),
      span(C.muted, comment[2], `${keyBase}-c`),
    ];
  }

  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < line.length) {
    const ch = line[i];

    if (ch === "/" && line[i + 1] === "/") {
      out.push(span(C.text, line.slice(0, i), `${keyBase}-${k++}-pre`));
      out.push(span(C.muted, line.slice(i), `${keyBase}-${k++}-cmt`));
      return out;
    }

    if (ch === "'" || ch === '"') {
      if (i > 0) out.push(span(C.text, line.slice(0, i), `${keyBase}-${k++}-pre`));
      const [nodes, next] = highlightString(line, ch, i, keyBase * 100 + k);
      out.push(...nodes);
      const rest = highlightTsLine(line.slice(next), keyBase * 100 + k + 1);
      return [...out, ...rest];
    }

    if (/[0-9]/.test(ch)) {
      const m = line.slice(i).match(/^-?\d+(?:\.\d+)?/);
      if (m) {
        if (i > 0) out.push(span(C.text, line.slice(0, i), `${keyBase}-${k++}-pre`));
        out.push(span(C.number, m[0], `${keyBase}-${k++}-n`));
        return [...out, ...highlightTsLine(line.slice(i + m[0].length), keyBase * 100 + k)];
      }
    }

    if (/[A-Za-z_$]/.test(ch)) {
      const m = line.slice(i).match(/^[A-Za-z_$][\w$]*/);
      if (m) {
        if (i > 0) out.push(span(C.text, line.slice(0, i), `${keyBase}-${k++}-pre`));
        const word = m[0];
        const color = TS_KEYWORDS.has(word)
          ? C.keyword
          : /^[A-Z]/.test(word)
            ? C.fn
            : C.text;
        out.push(span(color, word, `${keyBase}-${k++}-w`));
        return [...out, ...highlightTsLine(line.slice(i + word.length), keyBase * 100 + k)];
      }
    }

    if ("{}[](),:;".includes(ch)) {
      if (i > 0) out.push(span(C.text, line.slice(0, i), `${keyBase}-${k++}-pre`));
      out.push(span(C.punct, ch, `${keyBase}-${k++}-p`));
      return [...out, ...highlightTsLine(line.slice(i + 1), keyBase * 100 + k)];
    }

    i++;
  }

  if (out.length === 0) return [span(C.text, line, `${keyBase}-all`)];
  return out;
}

function highlightJsonLine(line: string, keyBase: number): ReactNode[] {
  if (!line) return [];
  const trimmed = line.trimStart();
  const pad = line.slice(0, line.length - trimmed.length);
  const out: ReactNode[] = pad ? [span(C.text, pad, `${keyBase}-pad`)] : [];

  const keyMatch = trimmed.match(/^"([^"\\]|\\.)*"\s*:/);
  if (keyMatch) {
    out.push(span(C.prop, keyMatch[0], `${keyBase}-key`));
    return [...out, ...highlightJsonLine(trimmed.slice(keyMatch[0].length), keyBase + 1)];
  }

  if (trimmed.startsWith('"')) {
    const [nodes, next] = highlightString(trimmed, '"', 0, keyBase);
    out.push(...nodes);
    const rest = trimmed.slice(next);
    if (rest) out.push(...highlightJsonLine(rest, keyBase + 2));
    return out;
  }

  const num = trimmed.match(/^-?\d+(?:\.\d+)?/);
  if (num) {
    out.push(span(C.number, num[0], `${keyBase}-n`));
    const rest = trimmed.slice(num[0].length);
    if (rest) out.push(...highlightJsonLine(rest, keyBase + 1));
    return out;
  }

  return [span(C.text, line, `${keyBase}-plain`)];
}

function highlightBashLine(line: string, keyBase: number): ReactNode[] {
  if (line.trimStart().startsWith("#")) {
    return [span(C.muted, line, `${keyBase}-cmt`)];
  }
  const parts = line.split(/(\s+)/);
  return parts.map((part, i) => {
    if (/^\s+$/.test(part)) return span(C.text, part, `${keyBase}-${i}-sp`);
    if (i === 0 && /^[a-z][\w-]*$/i.test(part)) return span(C.fn, part, `${keyBase}-${i}-cmd`);
    if (part.startsWith('"') || part.startsWith("'")) return span(C.string, part, `${keyBase}-${i}-s`);
    return span(C.text, part, `${keyBase}-${i}-t`);
  });
}

export function highlightCode(code: string, lang: HighlightLang): ReactNode {
  const lines = code.replace(/\n$/, "").split("\n");
  const highlightLine =
    lang === "json"
      ? highlightJsonLine
      : lang === "bash"
        ? highlightBashLine
        : highlightTsLine;

  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {highlightLine(line, i)}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </>
  );
}
