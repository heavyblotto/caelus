import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import { ReaderChartProvider } from "../../components/ReaderChartContext";
import Masthead from "../../components/encyclopedia/Masthead";
import Colophon from "../../components/encyclopedia/Colophon";
import { SITE } from "../../lib/site";
import "./encyclopedia.css";

/*
 * The Encyclopedia is a second site inside the app: its own root layout,
 * its own fonts, its own ground. Nothing visual is shared with the
 * developer site (DS-02). EB Garamond carries what a reader reads; IBM
 * Plex Mono carries what a reader looks up. latin-ext covers the
 * diacritics the sources carry (hōroskopos); greek covers the quoted
 * author names. The font-loading decision (next/font versus self-hosted,
 * weights, subsetting) is the maintainer's open decision 1.
 */
const serif = EB_Garamond({
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-ency-serif",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ency-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Encyclopedia of Hermes",
    template: "%s · Encyclopedia of Hermes",
  },
  description:
    "A reference work on the history, technique, and language of the Western esoteric traditions, with figures computed by the Caelus engine.",
};

export default function EncyclopediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body className="ency">
        <a href="#content" className="ency-skip">
          Skip to content
        </a>
        <Masthead />
        {/* Plates on entry pages read the reader's chart; the provider
            renders no DOM and touches only the fragment and localStorage. */}
        <ReaderChartProvider>
          <main className="ency-main" id="content" tabIndex={-1}>
            {children}
          </main>
        </ReaderChartProvider>
        <Colophon />
      </body>
    </html>
  );
}
