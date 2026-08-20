/**
 * Build-time data for the Encyclopedia shell: the entry list from
 * app/encyclopedia/<slug>/page.mdx sources, and plate counts from the
 * registry artifact the scan emits (packages/widgets/test/plate-registry.json).
 * Server-only: reads the filesystem during static prerender.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = process.cwd();
const ENCY_DIR = join(WEB_ROOT, "app", "encyclopedia");
const REGISTRY = join(
  WEB_ROOT, "..", "..", "packages", "widgets", "test", "plate-registry.json",
);

export interface EntryMeta {
  slug: string;
  title: string;
  /** First running paragraph of the entry, used as the index gloss. */
  gloss: string;
  plates: number;
}

interface RegistryPlate {
  id: string;
  location?: { entry?: string };
}

function registryPlates(): RegistryPlate[] {
  if (!existsSync(REGISTRY)) return [];
  const parsed = JSON.parse(readFileSync(REGISTRY, "utf8"));
  return Array.isArray(parsed.plates) ? parsed.plates : [];
}

function titleOf(mdx: string): string {
  const heading = mdx.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const shell = mdx.match(/<EntryShell[^>]*\stitle="([^"]+)"/);
  return shell ? shell[1].trim() : "";
}

function glossOf(mdx: string): string {
  const body = mdx
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/export const metadata = \{[\s\S]*?\};/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/^(?:import|export)\s.*$/gm, " ");
  const para = body
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .find((s) => s.length > 0);
  if (!para) return "";
  const sentence = para.match(/^(.{20,160}?[.!?])(?:\s|$)/);
  return (sentence ? sentence[1] : para.slice(0, 160)).trim();
}

/** Every entry route, alphabetically, with its plate count. */
export function listEntries(): EntryMeta[] {
  if (!existsSync(ENCY_DIR)) return [];
  const plates = registryPlates();
  const out: EntryMeta[] = [];
  for (const slug of readdirSync(ENCY_DIR).sort()) {
    const page = join(ENCY_DIR, slug, "page.mdx");
    if (!existsSync(page)) continue;
    const mdx = readFileSync(page, "utf8");
    out.push({
      slug,
      title: titleOf(mdx) || slug,
      gloss: glossOf(mdx),
      plates: plates.filter((p) => p.location?.entry === slug).length,
    });
  }
  return out;
}

export function plateCount(): number {
  return registryPlates().length;
}
