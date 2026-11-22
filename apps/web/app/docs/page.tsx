import Link from "next/link";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { Lead, P } from "../../components/Prose";
import { FACTS, SITE, formatMcpToolsProse } from "../../lib/site";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Documentation",
  description:
    "Task-oriented guides and API reference for Caelus: build charts, verify shadows and run MCP tools, query dates and eclipses, and compare traditions.",
  path: "/docs",
});

type DocCard = { href: string; title: string; desc: string };

type TaskTrack = {
  id: string;
  badge: string;
  title: string;
  summary: string;
  links: DocCard[];
};

// Task-oriented onboarding map: organizes every guide around what a developer
// is trying to build instead of a flat alphabetical wall.
const TASK_TRACKS: TaskTrack[] = [
  {
    id: "01",
    badge: "Charts & UI",
    title: "Build a chart",
    summary:
      "Install the package, convert local civil birth times to UTC, compute houses and aspects, and render SSR-safe SVG wheels or spheres.",
    links: [
      {
        href: "/docs/quickstart",
        title: "Quickstart",
        desc: "Install caelus and compute your first chart in the browser or Node.js.",
      },
      {
        href: "/docs/charts",
        title: "Computing Charts",
        desc: "Inspect the Chart object structure (bodies, angles, cusps, aspects) and UTC handling.",
      },
      {
        href: "/docs/houses-and-zodiacs",
        title: "Houses & Zodiacs",
        desc: `Compare all ${FACTS.houseSystems} house systems, tropical vs. sidereal zodiacs, and high-latitude fallbacks.`,
      },
      {
        href: "/docs/visualizations",
        title: "Visualizations",
        desc: "Render 2D wheels, 3D spheres, astrocartography maps, graphic ephemerides, and Sky View frames.",
      },
      {
        href: "/docs/cookbook",
        title: "Common Tasks",
        desc: "Copy-paste recipes for house placements, dignities, stations, ingresses, lunar phases, and local times.",
      },
    ],
  },
  {
    id: "02",
    badge: "Agents & Forensics",
    title: "Verify sky, shadows, and run MCP",
    summary:
      "Connect AI clients to offline astronomical tools, verify outdoor scene geometry and shadow bearings, and emit auditable or content-addressed outputs.",
    links: [
      {
        href: "/docs/mcp",
        title: "MCP Setup",
        desc: `Connect ${formatMcpToolsProse()} local chart and observation tools to Claude, Cursor, and stdio or HTTP clients.`,
      },
      {
        href: "/docs/observation",
        title: "Physical Observation",
        desc: "Compute solar and lunar scene geometry and shadows, verify metadata, chronolocate, and geolocate.",
      },
      {
        href: "/docs/chronosense",
        title: "Chronosense Middleware",
        desc: "Emit physical-horizon agent headers, audit write-back cursors, and compact memory across physical strata.",
      },
      {
        href: "/docs/interpretation",
        title: "Interpretation Layer",
        desc: "Project charts into ranked, citable facts and audit LLM-generated briefs against computed IDs.",
      },
      {
        href: "/docs/canonical",
        title: "Canonical Mode",
        desc: "Produce integer-quantized, content-addressable JSON output with SHA-256 chart digests.",
      },
      {
        href: "/docs/provenance",
        title: "Chart Provenance",
        desc: "Tag observed, forecast, mythic, or archetypal charts using Realm, TemporalAnchor, and SpatialAnchor.",
      },
    ],
  },
  {
    id: "03",
    badge: "Search & Astronomy",
    title: "Query dates, eclipses, and visibility",
    summary:
      "Run declarative interval searches, solve inverse sky-dating queries, inspect eclipse paths, and handle historical dates with explicit ΔT uncertainty.",
    links: [
      {
        href: "/docs/time-queries",
        title: "Time Queries",
        desc: "Build declarative when() queries for signs, aspects, and retrogrades with allOf, anyOf, and notOf.",
      },
      {
        href: "/docs/sky-dating",
        title: "Sky Dating",
        desc: "Find historical date windows matching planetary sign placements, longitude arcs, or visibility rules.",
      },
      {
        href: "/docs/eclipses",
        title: "Eclipses",
        desc: "Search solar and lunar eclipses, map central shadow tracks, and compute local contact times.",
      },
      {
        href: "/docs/sky-events",
        title: "Rise, Set & Sky Events",
        desc: "Compute rise, set, and transit times, lunar phases, planetary stations, and degree crossings.",
      },
      {
        href: "/docs/heliacal",
        title: "First & Last Visibility",
        desc: "Calculate heliacal risings and settings, inner-planet apparitions, and first lunar crescents.",
      },
      {
        href: "/docs/uncertain-time",
        title: "Uncertain Times",
        desc: "Sweep an approximate birth-time window to see which placements stay fixed and when others shift.",
      },
      {
        href: "/docs/deep-time",
        title: "Deep Time",
        desc: "Work before AD 1000 using deep ephemeris packs, Julian calendar conversions, and ΔT bounds.",
      },
    ],
  },
  {
    id: "04",
    badge: "Traditions & Worlds",
    title: "Compare traditions and custom worlds",
    summary:
      "Compute classical Western, Hellenistic, Vedic, and locational techniques on the same coordinates, or register custom Keplerian bodies and asteroid packs.",
    links: [
      {
        href: "/docs/derived",
        title: "Derived Charts",
        desc: "Compute returns, progressions, solar arcs, composite and Davison charts, harmonics, dignities, and sect.",
      },
      {
        href: "/docs/hellenistic",
        title: "Hellenistic Time-Lords",
        desc: "Calculate Hermetic lots, annual and monthly profections, firdaria, zodiacal releasing, and primary directions.",
      },
      {
        href: "/docs/vedic",
        title: "Vedic & Jyotish",
        desc: "Work with nakshatras, Vimshottari, Yogini, and Ashtottari dashas, divisional vargas, and classical yogas.",
      },
      {
        href: "/docs/astrocartography",
        title: "Astrocartography",
        desc: "Calculate planetary horizon and meridian lines, score locations against lines, and render AstroMap.",
      },
      {
        href: "/docs/electional",
        title: "Electional Search",
        desc: "Scan date windows with rankMoments, score candidate timestamps, and extract top intervals.",
      },
      {
        href: "/docs/synthetic",
        title: "Synthetic Ephemeris",
        desc: "Define custom periodic or 3D Keplerian bodies, register them on Engine, and render them in Sky View or MCP.",
      },
      {
        href: "/docs/minted-bodies",
        title: "Minted Bodies",
        desc: "Fit any numbered asteroid to JPL Horizons, publish an error certificate, and load verified CPK1 packs.",
      },
    ],
  },
];

const REFERENCE_CARDS: DocCard[] = [
  {
    href: "/docs/architecture",
    title: "Architecture",
    desc: "How caelus, caelus-birth, caelus-wheel, caelus-mcp, and the Python reference fit together.",
  },
  {
    href: "/docs/data-tiers",
    title: "Data Tiers",
    desc: "Embedded vs. loadable coefficient packs, measured bundle sizes, and extended date coverage.",
  },
  {
    href: "/docs/recipes",
    title: "Recipes",
    desc: "End-to-end workflows combining transits, when() queries, similarity search, and SVG rendering.",
  },
  {
    href: "/docs/corpus",
    title: "Building a Corpus",
    desc: "Use PassageRecords, rule extractors, validation checks, and the public-domain delineations package.",
  },
  {
    href: "/docs/api",
    title: "API Reference",
    desc: "Full TypeDoc-generated TypeScript API reference for the caelus package.",
  },
  {
    href: "/docs/edge-cases",
    title: "Edge Cases & Stability",
    desc: "Supported date ranges, polar house fallbacks, civil-time edge cases, and versioning policy.",
  },
  {
    href: "/changelog",
    title: "Changelog",
    desc: "Release history across the lockstep TypeScript packages and Python reference.",
  },
  {
    href: SITE.starter,
    title: "Starter template",
    desc: "Clone a complete Next.js application with birth forms, timezone resolution, and SVG chart wheels.",
  },
];

export default function DocsHome() {
  return (
    <>
      <PageHero eyebrow="Documentation" title="Documentation">
        <Lead>
          Task-oriented guides, runnable TypeScript examples, and complete API
          documentation for Caelus across browser, edge, Node.js, Python, and MCP.
        </Lead>
        <P>
          Start with the <Link href="/docs/quickstart">Quickstart</Link> to
          compute your first chart in two minutes, jump straight to{" "}
          <Link href="/docs/mcp">MCP Setup</Link> for AI clients, or browse the
          generated <Link href="/docs/api">API Reference</Link>.
        </P>
      </PageHero>

      <section className="feature-group" aria-label="Task-oriented onboarding map">
        <h2 className="feature-group__label">Choose a task</h2>
        <div className="docs-hub-grid">
          {TASK_TRACKS.map((track) => (
            <section key={track.id} className="card stack">
              <div className="row row--between">
                <span className="lab">Track {track.id}</span>
                <span className="badge badge--accent">{track.badge}</span>
              </div>
              <h3>{track.title}</h3>
              <p className="dim small">{track.summary}</p>
              <div className="stack stack--sm">
                {track.links.map((item) => (
                  <Link key={item.href} href={item.href} className="card card-interactive">
                    <strong>{item.title}</strong>
                    <p className="dim small">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="feature-group">
        <h2 className="feature-group__label">Architecture, recipes, and reference</h2>
        <div className="grid grid-2">
          {REFERENCE_CARDS.map((card) => {
            const inner = (
              <>
                <strong>{card.title}</strong>
                <p className="dim small">{card.desc}</p>
              </>
            );
            return card.href.startsWith("http") ? (
              <a key={card.href} href={card.href} target="_blank" rel="noreferrer" className="card card-interactive">
                {inner}
              </a>
            ) : (
              <Link key={card.href} href={card.href} className="card card-interactive">
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      <PageClose />
    </>
  );
}
