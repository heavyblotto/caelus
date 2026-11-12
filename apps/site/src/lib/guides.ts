/**
 * The MDX guides, read in place from apps/web/app/docs/<guide>/page.mdx and
 * keyed by route segment. Each module exposes `Content` plus the file's own
 * `metadata` export (built with pageMetadata).
 */
import type { MDXInstance } from "astro";

export type Guide = MDXInstance<Record<string, unknown>> & { metadata?: object };

const files = import.meta.glob<Guide>("../../../web/app/docs/*/page.mdx", { eager: true });

export const guides = new Map(
  Object.entries(files).map(([file, guide]) => [file.split("/").at(-2) as string, guide]),
);
