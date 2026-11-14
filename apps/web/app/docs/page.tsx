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
      ["/docs/quickstart", "Quickstart", "Install caelus and compute your first chart in the browser or Node."],
      ["/docs/charts", "Computing Charts", "The chart object: bodies, angles, cusps, aspects, and the UT vs local-time hazard."],
      ["/docs/cookbook", "Common Tasks", "Copy-paste recipes: house placement, dignities, stations, ingresses, lunar phases, and a local birth time done right."],
    ],
  },
  {
    label: "Guides",
    cards: [
      ["/docs/architecture", "Architecture", "How the four packages compose end to end: birth time, engine, wheel, and MCP."],
      ["/docs/houses-and-zodiacs", "Houses & Zodiacs", "Twelve house systems, tropical and sidereal modes, and polar fallbacks."],
      ["/docs/derived", "Derived Charts", "Returns, progressions, solar arc, composite, Davison, harmonics, dignities, and sect."],
      ["/docs/hellenistic", "Hellenistic Time-Lords", "Lots, profections, firdaria, zodiacal releasing, and primary directions."],
      ["/docs/vedic", "Vedic & Jyotish", "Nakshatras, the Vimshottari/Yogini/Ashtottari dashas, the vargas, and the yogas."],
      ["/docs/data-tiers", "Data Tiers", "Embedded vs Node loader: what ships in the bundle and what loads lazily."],
      ["/docs/recipes", "Recipes", "Transits, the when() query language, event search, and chart wheels."],
      ["/docs/electional", "Electional Search", "Scan a window with rankMoments, score each instant with the electional primitives, and render the winning chart."],
      ["/docs/visualizations", "Visualizations", "Beyond the flat wheel: a 3D chart sphere, an astrocartography world map, a graphic ephemeris, and Sky View frames for AI image prompts, rendered live."],
      ["/docs/interpretation", "Interpretation Layer", "Project validated charts into citable fact atoms: natal, transits, time-lords, synastry/composite, dignities, Vedic structure. Match, interpret, and audit LLM citations."],
      ["/docs/corpus", "Building a Corpus", "Consume and construct interpretation corpora: PassageRecords, extractors, validation, and the public-domain delineations package."],
      ["/docs/provenance", "Chart Provenance", "Declare what a chart is and how time and place are known: realms, anchors, routing to ephemeris or compiler, and honest interpretation framing."],
      ["/docs/synthetic", "Synthetic Ephemeris", "Imaginary bodies that move: periodic and Kepler tiers, Engine registration, SkyView render attrs, and MCP tools for fictional skies."],
      ["/docs/astrocartography", "Astrocartography", "Where on Earth each planet is rising, setting, or on the meridian at one instant, how to test a place against a line, and the AstroMap component."],
      ["/docs/eclipses", "Eclipses", "Solar and lunar eclipse search, the ground path and its width, and contact times and magnitude for one place."],
      ["/docs/sky-events", "Rise, Set & Sky Events", "When a body rises, culminates, and sets, when the Moon changes phase, when a planet stations, and when a body crosses a degree."],
      ["/docs/time-queries", "Time Queries", "when(): predicates for signs, aspects, and retrogrades, combined with and, or, and not, returning the intervals in which they hold."],
      ["/docs/sky-dating", "Sky Dating", "From a description of a sky to its dates: planets by sign, longitude, or lunar phase in, every matching window across a date range out."],
      ["/docs/heliacal", "First & Last Visibility", "Heliacal risings and settings, the apparitions of Mercury and Venus, and the first lunar crescent: the day a body is first or last seen from one place."],
      ["/docs/uncertain-time", "Uncertain Times", "Which facts of a chart survive a rounded birth time, a date with no time, or an ancient clock error: every fact with the instants it changes."],
      ["/docs/minted-bodies", "Minted Bodies", "Any numbered asteroid, fitted to JPL Horizons on request and published with a certificate of its measured error; loaded with a hash check."],
      ["/docs/deep-time", "Deep Time", "Before 1000 CE: the era packs and which bodies have them, Julian calendar dates, the ΔT model, and what its uncertainty does to a chart."],
      ["/docs/canonical", "Canonical Mode", "Integer, hashable, precision-honest output: quantized grids, content-addressable digests, and remainder sets."],
    ],
  },
  {
    label: "Integrations",
    cards: [
      ["/docs/mcp", "MCP Setup", `Add ${formatMcpToolsProse()} chart tools to Claude, Cursor, and other MCP clients.`],
      ["https://github.com/heavyblotto/caelus-starter", "Starter template", "A full Next.js app: birth form, timezone handling, chart wheel. Clone and deploy."],
    ],
  },
  {
    label: "Reference",
    cards: [
      ["/docs/api", "API Reference", "Generated reference for the caelus package surface."],
      ["/docs/edge-cases", "Edge Cases & Stability", "Date range, polar fallback, civil-time hazards, longitude convention, and the versioning contract."],
      ["/changelog", "Changelog", "Release notes for all four packages, versioned in lockstep."],
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
