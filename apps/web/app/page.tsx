import type { ReactNode } from "react";
import Link from "next/link";
import PageClose from "../components/PageClose";
import PageHero from "../components/PageHero";
import FAQ from "../components/FAQ";
import { A, Lead, P, H2 } from "../components/Prose";
import HomeLiveIsland from "../components/home/HomeLiveIsland";
import {
  FACTS,
  formatGoldenChecks,
  formatHouseSystemsProse,
  formatMcpToolsProse,
  formatMcpToolsTitle,
  formatSiderealProse,
  formatWorstNano,
  formatWorstNanoProse,
} from "../lib/facts";
import { NPM, SITE } from "../lib/site";
import { pageMetadata } from "../lib/seo";
import { nycCivilNow } from "../lib/nycNow";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Validated astrology computation",
  description: SITE.description,
  path: "/",
});

const PACKAGES: Array<[keyof typeof NPM, string, string]> = [
  ["caelus", "caelus", "The chart math: positions, houses, and aspects. It has no runtime dependencies and is ~153 KB gzipped with the embedded data."],
  ["mcp", "caelus-mcp", `${formatMcpToolsTitle()} chart tools for AI agents: natal charts, transits, synastry, event search, electional, lots, time-lords, directions, and the Vedic layer (nakshatras, dashas, vargas, yogas).`],
  ["birth", "caelus-birth", "Resolves a local birth time and place to UT, applying DST and historical timezone rules."],
  ["wheel", "caelus-wheel", "React SVG chart wheel (SSR-safe), ChartSphere (3D), AstroMap (astrocartography), and EphemerisGraph (~2.2 KB gzipped for the flat wheel)."],
  ["delineationsPd", "caelus-delineations-pd", "Public-domain delineations and correspondence data for the interpretation layer, versioned on its own semver."],
];

// Credibility numbers surfaced above the fold. Each links to its proof.
const PROOF: Array<{ num: string; label: string; href: string }> = [
  { num: formatWorstNano(), label: "Nano-arcsec worst deviation", href: "/validation" },
  { num: formatGoldenChecks(), label: "Golden checks in CI", href: "/validation" },
  { num: String(FACTS.mcpTools), label: "MCP tools for AI clients", href: "/docs/mcp" },
  { num: "~153 KB", label: "Engine + data, gzipped", href: "/docs/data-tiers" },
  { num: "0", label: "Runtime dependencies", href: NPM.caelus },
  { num: "MIT", label: "Licensed, no AGPL", href: `${SITE.repo}/blob/main/LICENSE` },
];

// What the engine computes, as titled entries a reader can scan. Each links to
// the doc page that covers it; the one-liner carries the specifics.
const CAPABILITIES: Array<{ title: string; href: string; desc: ReactNode }> = [
  {
    title: "Charts",
    href: "/docs/charts",
    desc: <>Sun through Pluto, Chiron, and the nodes; {formatHouseSystemsProse()} house systems; tropical and {formatSiderealProse()} sidereal zodiacs.</>,
  },
  {
    title: "Events",
    href: "/features",
    desc: <>Rise, set, and transit; stations; lunar phases; solar and lunar eclipses with local circumstances.</>,
  },
  {
    title: "Derived charts",
    href: "/docs/derived",
    desc: <>Returns, progressions, solar arc, composite, Davison, harmonics, draconic, dignities, and sect.</>,
  },
  {
    title: "Hellenistic time-lords",
    href: "/docs/hellenistic",
    desc: <>Lots, profections, firdaria, zodiacal releasing, and primary directions.</>,
  },
  {
    title: "Vedic & Jyotish",
    href: "/docs/vedic",
    desc: <>Nakshatras, the Vimshottari, Yogini, and Ashtottari dashas, divisional charts, and yogas.</>,
  },
  {
    title: "Interpretation layer",
    href: "/docs/interpretation",
    desc: <>Ranked, citable fact atoms, a pluggable rule corpus, and LLM briefs with citation auditing.</>,
  },
  {
    title: "Sky View",
    href: "/docs/visualizations",
    desc: <>The visible sky from a place and moment as a pixel-precise prompt for AI image generation.</>,
  },
  {
    title: "Chart provenance",
    href: "/docs/provenance",
    desc: <>Declare what a chart is (forecast, mythic, archetypal) and route to the ephemeris or the compiler.</>,
  },
  {
    title: "MCP server",
    href: "/docs/mcp",
    desc: <><code>caelus-mcp</code> gives Claude, Cursor, and other MCP clients {formatMcpToolsProse()} chart tools.</>,
  },
  {
    title: "In-browser computation",
    href: "/privacy",
    desc: <>Charts compute entirely in the browser, so an app never has to send birth data to a server.</>,
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "Caelus",
  description: SITE.description,
  url: SITE.url,
  codeRepository: SITE.repo,
  programmingLanguage: "TypeScript",
  license: "https://opensource.org/licenses/MIT",
  keywords: "ephemeris, astrology, natal chart, MCP, TypeScript",
};

export default function Home() {
  return (
    <main className="container page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHero
        eyebrow="TypeScript · browser, edge, Node, and MCP"
        title={SITE.tagline.replace(/\.$/, "")}
        cta="hero"
        after={
          <div className="feature-stats" style={{ marginBottom: "0.5rem" }}>
            {PROOF.map((s) =>
              s.href.startsWith("/") ? (
                <Link key={s.label} href={s.href} className="card stat">
                  <span className="stat__num">{s.num}</span>
                  <span className="stat__label">{s.label}</span>
                </Link>
              ) : (
                <a key={s.label} href={s.href} className="card stat" target="_blank" rel="noreferrer">
                  <span className="stat__num">{s.num}</span>
                  <span className="stat__label">{s.label}</span>
                </a>
              ),
            )}
          </div>
        }
      >
        <Lead>{SITE.description}</Lead>
      </PageHero>

      <HomeLiveIsland civil={nycCivilNow()} />

      <H2>What it computes</H2>
      <ul className="capability-grid">
        {CAPABILITIES.map((c) => (
          <li key={c.title}>
            <Link href={c.href} className="capability-grid__title">{c.title}</Link>
            <p className="capability-grid__desc">{c.desc}</p>
          </li>
        ))}
      </ul>
      <P dim>
        The full capability list, along with a comparison against the other
        engines, is on <A href="/features">Features</A>.
      </P>

      <H2>The packages</H2>
      <div className="grid grid-2">
        {PACKAGES.map(([key, name, desc]) => (
          <a key={name} href={NPM[key]} className="card card-interactive">
            <code style={{ color: "var(--accent)" }}>{name}</code>
            <p className="dim small" style={{ margin: "0.5rem 0 0" }}>{desc}</p>
          </a>
        ))}
      </div>

      <H2>How it is checked</H2>
      <P>
        CI checks the engine in two stages. A Python reference engine is first
        calibrated against Swiss Ephemeris, and the TypeScript port is then
        replayed against {formatGoldenChecks()} golden checks derived from it.
        The worst deviation recorded across that suite is{" "}
        {formatWorstNanoProse()}, which sits far below any astronomically
        relevant scale, so a porting bug fails the build instead of reaching a
        release. The tables and the methodology behind them are on{" "}
        <A href="/validation">Validation</A>, and the bugs this suite has
        caught are written up in the <A href="/notes">Build Notes</A>.
      </P>

      <FAQ />

      <PageClose />
    </main>
  );
}
