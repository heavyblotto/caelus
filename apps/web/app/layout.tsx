import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { SITE } from "../lib/site";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Caelus · MIT astrological ephemeris engine",
    template: "%s · Caelus",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "ephemeris", "astrology", "natal chart", "TypeScript", "MCP",
    "Swiss Ephemeris alternative", "houses", "aspects", "MIT",
  ],
  authors: [{ name: "Caelus" }],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: "Caelus · MIT astrological ephemeris engine",
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Caelus · MIT astrological ephemeris engine",
    description: SITE.description,
  },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
      sameAs: [SITE.repo],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
