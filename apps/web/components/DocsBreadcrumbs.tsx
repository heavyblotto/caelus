"use client";

import { usePathname } from "next/navigation";
import { SITE, DOCS_NAV } from "../lib/site";

const LABELS: Record<string, string> = Object.fromEntries(
  DOCS_NAV.flatMap((g) => g.items.map((i) => [i.href, i.label])),
);

/** Readable label for a docs route, including generated API symbol pages. */
function labelFor(path: string): string {
  if (LABELS[path]) return LABELS[path];
  const seg = decodeURIComponent(path.split("/").pop() ?? "");
  // typedoc slugs look like "Class.Engine"; show the symbol.
  return seg.split(".").slice(1).join(".") || seg || "Docs";
}

/**
 * Emits BreadcrumbList JSON-LD for /docs routes so search engines can render a
 * breadcrumb trail. Rendered server-side via usePathname during SSR.
 */
export default function DocsBreadcrumbs() {
  const pathname = usePathname();
  if (!pathname) return null;

  const items: Array<{ name: string; url: string }> = [
    { name: "Home", url: SITE.url },
    { name: "Documentation", url: `${SITE.url}/docs` },
  ];

  if (pathname !== "/docs") {
    if (pathname.startsWith("/docs/api/")) {
      items.push({ name: "API Reference", url: `${SITE.url}/docs/api` });
    }
    items.push({ name: labelFor(pathname), url: `${SITE.url}${pathname}` });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
