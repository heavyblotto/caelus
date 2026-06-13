import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "content", "api");

/** Basenames (without .md) of every generated API page except the index. */
export function listApiDocs(): string[] {
  if (!existsSync(API_DIR)) return [];
  return readdirSync(API_DIR)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .map((f) => f.slice(0, -3));
}

/** Read a generated API markdown file by basename; null if absent. */
export function readApiDoc(name: string): string | null {
  const path = join(API_DIR, `${name}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

/** A readable title from a typedoc filename like "Class.Engine". */
export function apiTitle(name: string): string {
  const [kind, ...rest] = name.split(".");
  const symbol = rest.join(".") || kind;
  const kinds: Record<string, string> = {
    Class: "class",
    Interface: "interface",
    Function: "function",
    TypeAlias: "type",
    Variable: "const",
  };
  const label = kinds[kind];
  return label ? `${symbol} · ${label}` : symbol;
}
