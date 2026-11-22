import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { SITE } from "../lib/site";
import "./globals.css";

// Workbench type (apps/web/DESIGN.md): Barlow for prose, Barlow Condensed for
// titles, JetBrains Mono for data, labels, and code.
const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
const cond = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-cond",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  colorScheme: "dark light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: "%s · Caelus",
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: "Caelus" }],
  creator: "Caelus",
  publisher: "Caelus",
  openGraph: {
    type: "website",
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
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

// Apply stored theme override or OS preference before first paint so neither
// custom properties nor native color-scheme surfaces flash on load.
const NO_FLASH = `(function(){try{var s=localStorage.getItem('theme');var m=document.querySelector('meta[name="color-scheme"]');if(s==='light'||s==='dark'){document.documentElement.dataset.theme=s;if(m)m.content=s;}else{var os=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=os;if(m)m.content='dark light';}}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${cond.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <div id="content" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
