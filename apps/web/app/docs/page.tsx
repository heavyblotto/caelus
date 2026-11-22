import Link from "next/link";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { Lead, P } from "../../components/Prose";
import { SITE, formatMcpToolsProse } from "../../lib/site";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Documentation",
  description:
    "Guides and API reference for Caelus: charts, houses and zodiacs, data tiers, MCP setup, recipes, interpretation facts, and package APIs.",
  path: "/docs",
});

// Grouped to mirror the sidebar (lib/site.ts DOCS_NAV), so the card wall and
// the nav teach the same taxonomy. Each entry: href, title, one-line summary.
type Card = [string, string, string];

const GROUPS: Array<{ label: string; cards: Card[] }> = [
  {
    label: "Getting started",
    cards: [
      ["/docs/quickstart", "Quickstart", "Install caelus and compute your first chart in the browser or Node.js."],
      ["/docs/charts", "Computing Charts", "Learn the Chart object structure (bodies, angles, cusps, aspects) and how to handle UTC conversion."],
      ["/docs/cookbook", "Common Tasks", "Ready-to-use snippets for house placements, dignities, stations, ingresses, lunar phases, and local birth times."],
    ],
  },
  {
    label: "Guides",
    cards: [
      ["/docs/architecture", "Architecture", "How caelus, caelus-birth, caelus-wheel, and caelus-mcp fit together end to end."],
      ["/docs/houses-and-zodiacs", "Houses & Zodiacs", "Compare the 12 house systems, tropical vs. sidereal zodiacs, and high-latitude fallbacks."],
      ["/docs/derived", "Derived Charts", "Compute returns, progressions, solar arcs, composite and Davison charts, harmonics, dignities, and sect."],
      ["/docs/hellenistic", "Hellenistic Time-Lords", "Calculate Hermetic lots, annual and monthly profections, firdaria, zodiacal releasing, and primary directions."],
      ["/docs/vedic", "Vedic & Jyotish", "Work with nakshatras, Vimshottari/Yogini/Ashtottari dashas, divisional charts (vargas), and classical yogas."],
      ["/docs/data-tiers", "Data Tiers", "Understand embedded vs. loadable data packs, bundle sizes, and extended date coverage."],
      ["/docs/recipes", "Recipes", "End-to-end examples combining transits, when() queries, event scans, and chart rendering."],
      ["/docs/electional", "Electional Search", "Scan a date range with rankMoments, score candidate times, and render the top result."],
      ["/docs/visualizations", "Visualizations", "Render 2D wheels, 3D spheres, astrocartography maps, graphic ephemerides, and Sky View prompts."],
      ["/docs/interpretation", "Interpretation Layer", "Extract citable chart facts across natal, transit, synastry, dignity, and Vedic layers, and audit LLM citations."],
      ["/docs/corpus", "Building a Corpus", "Use PassageRecords, rule extractors, validation checks, and the public-domain delineations package."],
      ["/docs/provenance", "Chart Provenance", "Track whether a chart is observed, forecasted, or synthetic using Realm, TemporalAnchor, and SpatialAnchor."],
      ["/docs/synthetic", "Synthetic Ephemeris", "Define custom periodic or Keplerian bodies for fictional worlds, register them on Engine, and render them in SkyView or MCP."],
      ["/docs/astrocartography", "Astrocartography", "Calculate planetary horizon and meridian lines, evaluate locations against lines, and render AstroMap."],
      ["/docs/eclipses", "Eclipses", "Search for solar and lunar eclipses, map central shadow tracks, and compute local contact times and magnitude."],
      ["/docs/sky-events", "Rise, Set & Sky Events", "Find rise, set, and transit times, lunar phases, planetary stations, and degree crossings."],
      ["/docs/time-queries", "Time Queries", "Build declarative when() queries for signs, aspects, and retrogrades with allOf, anyOf, and notOf combinators."],
      ["/docs/sky-dating", "Sky Dating", "Find historical date windows matching planetary sign placements, longitude arcs, lunar phases, or visibility events."],
      ["/docs/heliacal", "First & Last Visibility", "Compute heliacal risings and settings, inner-planet apparitions, and first lunar crescents from any location with atmospheric uncertainty windows."],
      ["/docs/observation", "Physical Observation", "Compute solar/lunar scene geometry and shadows, verify metadata with counterfactual diagnostics, and invert observations to timestamps or coordinates."],
      ["/docs/uncertain-time", "Uncertain Times", "Identify which chart placements stay valid across an approximate birth-time window and when others change."],
      ["/docs/minted-bodies", "Minted Bodies", "Fit any numbered asteroid to JPL Horizons on demand, publish an error certificate, and load packs with SHA-256 verification."],
      ["/docs/deep-time", "Deep Time", "Work with historical dates before AD 1000: deep ephemeris packs, Julian calendar conversions, and ΔT uncertainty bounds."],
      ["/docs/canonical", "Canonical Mode", "Produce quantized, content-addressable JSON output with SHA-256 digests for reproducible comparisons."],
    ],
  },
  {
    label: "Integrations",
    cards: [
      ["/docs/mcp", "MCP Setup", `Connect ${formatMcpToolsProse()} chart tools to Claude, Cursor, and other MCP clients.`],
      ["https://github.com/heavyblotto/caelus-starter", "Starter template", "Clone a complete Next.js app with birth forms, timezone resolution, and SVG wheels."],
    ],
  },
  {
    label: "Reference",
    cards: [
      ["/docs/api", "API Reference", "Full generated TypeScript API documentation for the caelus package."],
      ["/docs/edge-cases", "Edge Cases & Stability", "Details on supported date ranges, polar house fallbacks, civil-time edge cases, and versioning."],
      ["/changelog", "Changelog", "Release history across all four lockstep packages."],
    ],
  },
];

export default function DocsHome() {
  return (
    <>
      <PageHero eyebrow="Documentation" title="Documentation">
        <Lead>{SITE.shortDescription}</Lead>
        <P>
          New here? Start with the <Link href="/docs/quickstart">Quickstart</Link>, then
          read <Link href="/docs/charts">Computing Charts</Link>. The full package surface
          is in the <Link href="/docs/api">API Reference</Link>.
        </P>
      </PageHero>
      {GROUPS.map(({ label, cards }) => (
        <section key={label} className="feature-group">
          <h2 className="feature-group__label">{label}</h2>
          <div className="grid grid-2">
            {cards.map(([href, title, desc]) => {
              const inner = (
                <>
                  <strong>{title}</strong>
                  <p className="dim small" style={{ margin: "0.4rem 0 0" }}>{desc}</p>
                </>
              );
              return href.startsWith("http") ? (
                <a key={href} href={href} target="_blank" rel="noreferrer" className="card card-interactive">
                  {inner}
                </a>
              ) : (
                <Link key={href} href={href} className="card card-interactive">
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <PageClose />
    </>
  );
}
