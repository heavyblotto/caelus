/**
 * Turns the `metadata` object a page in apps/web exports (the Next Metadata
 * shape produced by `pageMetadata()`) into the same <head> tags Next emits, so
 * titles, canonicals, and social cards are unchanged by the move.
 */
import { SITE } from "@web/lib/site";

type Robots = { index?: boolean; follow?: boolean; googleBot?: { index?: boolean; follow?: boolean } };

/** The subset of Next's Metadata that apps/web uses. */
export type PageMeta = {
  title?: string | { absolute: string };
  description?: string;
  alternates?: { canonical?: string };
  openGraph?: { type?: string; siteName?: string; url?: string; title?: string; description?: string };
  twitter?: { card?: string; title?: string; description?: string };
  robots?: Robots;
};

export type HeadTag =
  | { tag: "meta"; name?: string; property?: string; content: string }
  | { tag: "link"; rel: string; href: string };

/**
 * Site-wide Open Graph image: app/opengraph-image.tsx, prerendered at
 * /opengraph-image. Next appends a content hash so scrapers refetch a changed
 * card; the card's only variable text is the version, so that is the key here.
 */
const OG_IMAGE = {
  url: `${SITE.url}/opengraph-image?v=${SITE.version}`,
  alt: SITE.title,
  type: "image/png",
  width: "1200",
  height: "630",
};

function robotsContent(r: { index?: boolean; follow?: boolean }): string {
  return `${r.index === false ? "noindex" : "index"}, ${r.follow === false ? "nofollow" : "follow"}`;
}

export function resolveTitle(meta: PageMeta): string {
  if (!meta.title) return SITE.title;
  if (typeof meta.title === "object") return meta.title.absolute;
  return `${meta.title} · ${SITE.name}`;
}

export function headTags(meta: PageMeta): HeadTag[] {
  const title = resolveTitle(meta);
  const description = meta.description ?? SITE.description;
  const tags: HeadTag[] = [
    { tag: "meta", name: "description", content: description },
    { tag: "meta", name: "application-name", content: SITE.name },
    { tag: "meta", name: "author", content: "Caelus" },
    { tag: "meta", name: "creator", content: "Caelus" },
    { tag: "meta", name: "publisher", content: "Caelus" },
  ];

  if (meta.robots) {
    tags.push({ tag: "meta", name: "robots", content: robotsContent(meta.robots) });
    if (meta.robots.googleBot) {
      tags.push({ tag: "meta", name: "googlebot", content: robotsContent(meta.robots.googleBot) });
    }
  }
  // Next writes the home page's URLs without the trailing slash.
  const isHome = meta.alternates?.canonical === "/";
  if (meta.alternates?.canonical) {
    tags.push({ tag: "link", rel: "canonical", href: isHome ? SITE.url : `${SITE.url}${meta.alternates.canonical}` });
  }

  // Next merges metadata shallowly per key, and the image file sits in the
  // root segment. So the home page carries the site image; a page in a child
  // segment that sets its own `openGraph` or `twitter` (everything built with
  // pageMetadata) replaces the root object, image included; and a page that
  // sets neither inherits the root values and the image. All three cases are
  // reproduced as they are today.
  const og = meta.openGraph;
  const withImage = (own: object | undefined) => !own || isHome;
  tags.push({ tag: "meta", property: "og:title", content: og?.title ?? title });
  tags.push({ tag: "meta", property: "og:description", content: og?.description ?? description });
  if (og?.url) tags.push({ tag: "meta", property: "og:url", content: isHome ? SITE.url : og.url });
  tags.push({ tag: "meta", property: "og:site_name", content: og?.siteName ?? SITE.name });
  if (withImage(og)) {
    tags.push(
      { tag: "meta", property: "og:image:alt", content: OG_IMAGE.alt },
      { tag: "meta", property: "og:image:type", content: OG_IMAGE.type },
      { tag: "meta", property: "og:image", content: OG_IMAGE.url },
      { tag: "meta", property: "og:image:width", content: OG_IMAGE.width },
      { tag: "meta", property: "og:image:height", content: OG_IMAGE.height },
    );
  }
  tags.push({ tag: "meta", property: "og:type", content: og?.type ?? "website" });

  const tw = meta.twitter;
  tags.push({ tag: "meta", name: "twitter:card", content: tw?.card ?? "summary_large_image" });
  tags.push({ tag: "meta", name: "twitter:title", content: tw?.title ?? title });
  tags.push({ tag: "meta", name: "twitter:description", content: tw?.description ?? description });
  if (withImage(tw)) {
    tags.push(
      { tag: "meta", name: "twitter:image:alt", content: OG_IMAGE.alt },
      { tag: "meta", name: "twitter:image:type", content: OG_IMAGE.type },
      { tag: "meta", name: "twitter:image", content: OG_IMAGE.url },
      { tag: "meta", name: "twitter:image:width", content: OG_IMAGE.width },
      { tag: "meta", name: "twitter:image:height", content: OG_IMAGE.height },
    );
  }
  return tags;
}

/** `Astro.url.pathname` as a site route: no trailing slash, no `.html`. */
export function routePath(pathname: string): string {
  const clean = pathname.replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}
