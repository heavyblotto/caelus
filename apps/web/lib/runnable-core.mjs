/**
 * Runnable docs examples: the part shared by the browser worker, the MDX
 * plugins, and the Node test (scripts/test-docs-examples.mjs).
 *
 * A guide marks a code block runnable with the `run` flag on its fence
 * (```ts run) or the `run` prop on <CodeBlock>. Pressing Run executes the
 * block against the engine and shows the value of its last expression.
 *
 * Plain JavaScript on purpose. It is imported by next.config.mjs and
 * astro.config.mjs, which Node loads without a compiler, by the Node test,
 * and by the worker bundle. It touches no DOM and no Node API.
 *
 * Three rules shape the design:
 *
 *  - A block never evaluates a module specifier. Its `import` lines are
 *    rewritten into reads from a fixed table of modules the host has already
 *    loaded, and any other specifier is an error (and fails the site build).
 *  - Blocks on a page share state the way a reader assumes: a block sees the
 *    names the runnable blocks above it declared. Running block N executes
 *    blocks 0..N in order, each nested in the scope of the one before, so a
 *    later block may also redeclare a name.
 *  - Examples are JavaScript. A block marked runnable may not use
 *    TypeScript-only syntax, because nothing here compiles it.
 */

/** The only modules a runnable block may import. */
export const RUNNABLE_MODULES = ["caelus", "caelus/data-embedded"];

/** Fence languages that can carry the `run` flag. */
const RUNNABLE_LANGS = new Set(["ts", "typescript", "js", "javascript"]);

const IMPORT_RE = /^[ \t]*import\s+(type\s+)?([\s\S]*?)\s+from\s+(["'])([^"']+)\3[ \t]*;?[ \t]*$/gm;
const SIDE_EFFECT_IMPORT_RE = /^[ \t]*import\s+(["'])([^"']+)\1[ \t]*;?[ \t]*$/gm;

/**
 * Read a code fence's info string. Returns null unless the block is flagged
 * runnable: `ts run`, or `ts run label="chart.ts"`.
 * @param {string | null | undefined} lang
 * @param {string | null | undefined} meta
 * @returns {{ label?: string } | null}
 */
export function parseRunMeta(lang, meta) {
  if (!lang || !RUNNABLE_LANGS.has(lang) || !meta) return null;
  if (!/(^|\s)run(\s|$)/.test(meta)) return null;
  const label = meta.match(/(?:^|\s)label=(?:"([^"]*)"|'([^']*)'|(\S+))/);
  return label ? { label: label[1] ?? label[2] ?? label[3] } : {};
}

/**
 * Module specifiers a block imports.
 * @param {string} code
 * @returns {string[]}
 */
export function importsOf(code) {
  const found = [];
  for (const m of code.matchAll(IMPORT_RE)) found.push(m[4]);
  for (const m of code.matchAll(SIDE_EFFECT_IMPORT_RE)) found.push(m[2]);
  return found;
}

/**
 * The specifiers a block imports that the runner does not provide.
 * @param {string} code
 * @returns {string[]}
 */
export function disallowedImports(code) {
  return importsOf(code).filter((spec) => !RUNNABLE_MODULES.includes(spec));
}

/**
 * Rewrite a block's static imports into reads from the module table:
 * `import { a, b as c } from "caelus"` becomes
 * `const { a, b: c } = __mod("caelus");`. Type-only imports are dropped.
 * @param {string} code
 * @returns {string}
 */
export function rewriteImports(code) {
  return code
    .replace(IMPORT_RE, (_all, typeOnly, clause, _q, spec) => {
      if (typeOnly) return "";
      const mod = `__mod(${JSON.stringify(spec)})`;
      const out = [];
      let rest = clause.trim();
      const named = rest.match(/\{([\s\S]*)\}/);
      if (named) {
        const bindings = named[1]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("type "))
          .map((s) => s.replace(/\s+as\s+/, ": "));
        out.push(`const { ${bindings.join(", ")} } = ${mod};`);
        rest = rest.replace(named[0], "").replace(/,\s*$/, "").replace(/^\s*,/, "").trim();
      }
      const star = rest.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (star) {
        out.push(`const ${star[1]} = ${mod};`);
        rest = rest.replace(star[0], "").replace(/,/g, "").trim();
      }
      if (rest) out.push(`const ${rest.replace(/,/g, "").trim()} = ${mod}.default;`);
      return out.join(" ");
    })
    .replace(SIDE_EFFECT_IMPORT_RE, (_all, _q, spec) => `__mod(${JSON.stringify(spec)});`);
}

/**
 * Join a page's blocks into one program. Each block after the first is nested
 * in a brace scope inside the previous one, so it sees every earlier name and
 * may shadow one. `__target()` runs just before the last block: it starts log
 * capture and, by evaluating to undefined, resets the completion value, so
 * the program's value is that of the last block's final expression and never
 * a leftover from an earlier block.
 * @param {string[]} blocks Runnable blocks in page order; the last one is the block being run.
 * @returns {string}
 */
export function assembleProgram(blocks) {
  const last = blocks.length - 1;
  let program = '"use strict";\n';
  blocks.forEach((block, i) => {
    if (i > 0) program += "{\n";
    if (i === last) program += "__target();\n";
    program += rewriteImports(block) + "\n";
  });
  return program + "}\n".repeat(last);
}

/**
 * Run a page's blocks up to and including the last one given.
 *
 * The program is evaluated with a direct `eval` inside a function whose
 * parameters shadow the network globals, so an example cannot reach the
 * network by accident and behaves the same in a worker and in Node.
 *
 * @param {string[]} blocks
 * @param {Record<string, unknown>} modules The module table, keyed by specifier.
 * @returns {{ value: unknown, logs: string[] }} `value` is the completion value of the last block.
 */
export function execute(blocks, modules) {
  for (const block of blocks) {
    const bad = disallowedImports(block);
    if (bad.length) throw new Error(unavailableMessage(bad[0]));
  }

  const logs = [];
  let capturing = false;
  const log = (...args) => {
    if (capturing) logs.push(args.map((a) => (typeof a === "string" ? a : formatValue(a))).join(" "));
  };
  const consoleShim = { log, info: log, warn: log, error: log, debug: log, table: log };
  const mod = (spec) => {
    if (!Object.prototype.hasOwnProperty.call(modules, spec)) throw new Error(unavailableMessage(spec));
    return modules[spec];
  };
  const target = () => {
    capturing = true;
  };

  const program = assembleProgram(blocks);
  const run = new Function(
    "__mod", "__target", "console",
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts",
    `return eval(${JSON.stringify(program)});`,
  );
  const value = run(mod, target, consoleShim);
  return { value, logs };
}

function unavailableMessage(spec) {
  return (
    `This example imports "${spec}", which the in-page runner does not provide. ` +
    `Runnable examples can import ${RUNNABLE_MODULES.map((m) => `"${m}"`).join(" and ")}.`
  );
}

const LIMITS = { depth: 6, items: 20, keys: 40, string: 300, chars: 8000, inline: 76 };

/**
 * Format a value as indented JSON, cut to a readable size: long arrays, wide
 * objects, deep nesting, and long strings are abbreviated with a "…" marker,
 * and a small array or object prints on one line. Values JSON cannot carry
 * (undefined, NaN, functions, class instances) print as a bare word.
 * @param {unknown} value
 * @returns {string}
 */
export function formatValue(value) {
  const seen = new Set();

  const fmt = (v, depth, indent) => {
    if (v === null) return "null";
    switch (typeof v) {
      case "undefined": return "undefined";
      case "number": return Number.isFinite(v) ? String(Object.is(v, -0) ? 0 : v) : String(v);
      case "boolean": return String(v);
      case "bigint": return `${v}n`;
      case "symbol": return v.toString();
      case "function": return `[Function ${v.name || "anonymous"}]`;
      case "string":
        return JSON.stringify(v.length > LIMITS.string ? `${v.slice(0, LIMITS.string)}… (${v.length} characters)` : v);
    }
    if (v instanceof Date) return JSON.stringify(Number.isNaN(v.getTime()) ? "Invalid Date" : v.toISOString());
    if (v instanceof Error) return `[${v.name}: ${v.message}]`;
    if (seen.has(v)) return "[Circular]";

    const isArray = Array.isArray(v);
    const isTyped = ArrayBuffer.isView(v) && !(v instanceof DataView);
    const proto = Object.getPrototypeOf(v);
    if (v instanceof Map) return fmt(Object.fromEntries(v), depth, indent);
    if (v instanceof Set) return fmt([...v], depth, indent);
    if (!isArray && !isTyped && proto !== Object.prototype && proto !== null) {
      return `[${proto?.constructor?.name || "Object"}]`;
    }
    if (depth >= LIMITS.depth) return isArray || isTyped ? '["…"]' : '{ "…": "…" }';

    seen.add(v);
    const inner = indent + "  ";
    let parts;
    if (isArray || isTyped) {
      const list = Array.from(v);
      parts = list.slice(0, LIMITS.items).map((x) => fmt(x, depth + 1, inner));
      if (list.length > LIMITS.items) parts.push(`"… ${list.length - LIMITS.items} more"`);
    } else {
      const keys = Object.keys(v);
      parts = keys.slice(0, LIMITS.keys).map((k) => `${JSON.stringify(k)}: ${fmt(v[k], depth + 1, inner)}`);
      if (keys.length > LIMITS.keys) parts.push(`"…": "${keys.length - LIMITS.keys} more keys"`);
    }
    seen.delete(v);

    const [open, close] = isArray || isTyped ? ["[", "]"] : ["{", "}"];
    if (parts.length === 0) return open + close;
    const oneLine = isArray || isTyped ? `[${parts.join(", ")}]` : `{ ${parts.join(", ")} }`;
    if (!oneLine.includes("\n") && indent.length + oneLine.length <= LIMITS.inline) return oneLine;
    return `${open}\n${parts.map((p) => inner + p).join(",\n")}\n${indent}${close}`;
  };

  const out = fmt(value, 0, "");
  return out.length > LIMITS.chars ? `${out.slice(0, LIMITS.chars)}\n… output cut at ${LIMITS.chars} characters` : out;
}

/**
 * Find the runnable blocks in an MDX source, in page order. Used by the Node
 * test; the builds find the same blocks through the MDX plugins.
 *
 * Two forms are recognised: a fence flagged `run`, and a `<CodeBlock run … />`
 * whose `code` prop is a template literal.
 * @param {string} source
 * @returns {{ code: string, line: number }[]}
 */
export function extractRunnable(source) {
  const blocks = [];
  const lineOf = (index) => source.slice(0, index).split("\n").length;

  for (const m of source.matchAll(/^```([\w-]+)[ \t]+([^\n]*)\n([\s\S]*?)\n```[ \t]*$/gm)) {
    if (parseRunMeta(m[1], m[2])) blocks.push({ code: m[3], line: lineOf(m.index) });
  }
  for (const m of source.matchAll(/<CodeBlock\b((?:[^>`]|`(?:[^`\\]|\\.)*`)*?)\/>/g)) {
    const attrs = m[1];
    if (!/(^|\s)run(\s|=|$)/.test(attrs.replace(/`(?:[^`\\]|\\.)*`/g, "``"))) continue;
    const code = attrs.match(/code=\{`((?:[^`\\]|\\.)*)`\}/);
    if (!code) continue;
    // The prop is a template literal with no interpolation; evaluate its escapes.
    blocks.push({ code: new Function(`return \`${code[1]}\`;`)(), line: lineOf(m.index) });
  }
  return blocks.sort((a, b) => a.line - b.line);
}
