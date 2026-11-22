import type { Metadata } from "next";
import { SITE } from "./site";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: `/${string}`;
  type?: "website" | "article";
  noIndex?: boolean;
  keywords?: string[];
};

const DEFAULT_KEYWORDS = [
  "ephemeris",
  "astronomy",
  "astrology",
  "natal chart",
  "JPL Horizons",
  "Swiss Ephemeris",
  "TypeScript",
  "Python",
  "MCP",
  "Model Context Protocol",
  "chronolocation",
  "heliacal visibility",
];

export function absoluteUrl(path: `/${string}`): string {
  return `${SITE.url}${path}`;
}

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  noIndex = false,
  keywords,
}: PageMetadataOptions): Metadata {
  const resolvedTitle = path === "/" ? SITE.title : `${title} · ${SITE.name}`;
  const ogImageUrl = `${SITE.url}/opengraph-image?v=${SITE.version}`;
  const robots = noIndex
    ? {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      }
    : undefined;

  return {
    title: path === "/" ? { absolute: SITE.title } : title,
    description,
    keywords: keywords ?? DEFAULT_KEYWORDS,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE.name,
      url: absoluteUrl(path),
      title: resolvedTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: resolvedTitle,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [ogImageUrl],
    },
    ...(robots ? { robots } : {}),
  };
}
