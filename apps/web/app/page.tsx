import type { ReactNode } from "react";
import Link from "next/link";
import PageClose from "../components/PageClose";
import Cta from "../components/Cta";
import FAQ from "../components/FAQ";
import { A } from "../components/Prose";
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
import { INSTRUMENTS } from "../lib/instruments";
import { pageMetadata } from "../lib/seo";
import { nycCivilNow } from "../lib/nycNow";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Validated astrology computation",
  description: SITE.description,
  path: "/",
});

const PACKAGES: Array<[keyof typeof NPM, string, string]> = [
  ["caelus", "caelus", "Core ephemeris and chart calculations (positions, houses, and aspects) with zero runtime dependencies (~153 KB gzipped including embedded data)."],
  ["mcp", "caelus-mcp", `${formatMcpToolsTitle()} chart tools for AI assistants: natal charts, transits, synastry, event search, electional search, lots, time-lords, directions, and Vedic calculations.`],
  ["birth", "caelus-birth", "Resolves local birth dates, times, and coordinates to UTC using historical timezone and daylight saving time rules."],
  ["wheel", "caelus-wheel", "SSR-safe React SVG components: flat ChartWheel (~3 KB gzipped), 3D ChartSphere, AstroMap, and EphemerisGraph."],
  ["delineationsPd", "caelus-delineations-pd", "Public-domain delineations and correspondence tables for the interpretation layer, versioned independently."],
];

// Credibility numbers on the first screen. Each links to its proof and names
// the page or file that carries it.
const PROOF: Array<{ num: string; label: string; href: string; src: string }> = [
  { num: formatWorstNano(), label: "Nano-arcsec worst deviation", href: "/validation", src: "Validation" },
  { num: formatGoldenChecks(), label: "Golden checks in CI", href: "/validation", src: "Validation" },
  { num: String(FACTS.mcpTools), label: "MCP tools for AI clients", href: "/docs/mcp", src: "MCP setup" },
  { num: "~153 KB", label: "Engine + data, gzipped", href: "/docs/data-tiers", src: "Data tiers" },
  { num: "0", label: "Runtime dependencies", href: NPM.caelus, src: "npm" },
  { num: "MIT", label: "Licensed, no AGPL", href: `${SITE.repo}/blob/main/LICENSE`, src: "LICENSE" },
];

// What the engine computes, as titled entries a reader can scan. Each links to
// the doc page that covers it; the one-liner carries the specifics.
// `unreleased` marks what is in the repository after the published version.
const CAPABILITIES: Array<{ title: string; href: string; desc: ReactNode; unreleased?: boolean }> = [
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
    title: "Sky dating",
    href: "/docs/sky-dating",
    desc: <>Search historical date ranges for intervals matching planetary sign placements, aspects, or retrograde states.</>,
    unreleased: true,
  },
  {
    title: "Uncertain times",
    href: "/docs/uncertain-time",
    desc: <>Identify which chart placements remain fixed across an uncertain birth-time window and when others change.</>,
    unreleased: true,
  },
  {
    title: "First and last visibility",
    href: "/docs/heliacal",
    desc: <>Compute heliacal risings and settings, inner-planet apparitions, and first lunar crescents for a location across atmospheric clarity bounds.</>,
    unreleased: true,
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
    desc: <>Nakshatras, Vimshottari, Yogini, and Ashtottari dashas, divisional charts, and yogas.</>,
  },
  {
    title: "Interpretation layer",
    href: "/docs/interpretation",
    desc: <>Ranked, citable chart facts, a pluggable rule corpus, and LLM briefs with citation verification.</>,
  },
  {
    title: "Sky View",
    href: "/docs/visualizations",
    desc: <>Generate an accurate sky description from any coordinates and timestamp as a prompt for AI image generation.</>,
  },
  {
    title: "Chart provenance",
    href: "/docs/provenance",
    desc: <>Tag a chart&apos;s context (observed, forecast, mythic, or archetypal) and route it to the ephemeris or synthetic compiler.</>,
  },
  {
    title: "MCP server",
    href: "/docs/mcp",
    desc: <><code>caelus-mcp</code> gives Claude, Cursor, and other MCP clients {formatMcpToolsProse()} chart tools.</>,
  },
  {
    title: "Client-side execution",
    href: "/privacy",
    desc: <>Charts compute locally in the browser, so your application never needs to send birth data to a server.</>,
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

/**
 * Home orients and routes. It opens on the computed New York sky, with the
 * claim, the install command, and the proof figures beside it on the first
 * screen (apps/web/DESIGN.md, principle 2).
 */
export default function Home() {
  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="bench home">
        <section className="tile claim" aria-labelledby="home-title">
          <div className="tile__h">
            <b>WHAT</b>
            <span>Caelus {SITE.version}</span>
          </div>
          <div className="tile__b">
            <div className="lab">TypeScript · browser, edge, Node, and MCP</div>
            <h1 id="home-title">{SITE.tagline.replace(/\.$/, "")}</h1>
            <p>{SITE.description}</p>
            <Cta variant="hero" />
          </div>
        </section>

        <section className="tile proof-tile" aria-label="Proof figures">
          <div className="tile__h">
            <b>PROOF</b>
            <span>Measured, with source</span>
          </div>
          <div className="proof">
            {PROOF.map((s) => {
              const body = (
                <>
                  <span className="lab">{s.label}</span>
                  <b>{s.num}</b>
                  <em>src: {s.src}</em>
                </>
              );
              return s.href.startsWith("/") ? (
                <Link key={s.label} href={s.href}>{body}</Link>
              ) : (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{body}</a>
              );
            })}
          </div>
        </section>

        <HomeLiveIsland civil={nycCivilNow()} />

        <div className="band">
          <h2>What it computes</h2>
        </div>
        {CAPABILITIES.map((c) => (
          <Link key={c.title} href={c.href} className="tile s3">
            <div className="tile__b">
              {c.unreleased ? <div className="lab">Unreleased</div> : null}
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          </Link>
        ))}
        <section className="tile s12">
          <div className="tile__b">
            <p>
              See the full capability list and library comparison on{" "}
              <A href="/features">Features</A>. Items marked Unreleased are
              available on the development branch and have not yet shipped in{" "}
              {SITE.version}.
            </p>
          </div>
        </section>

        <div className="band">
          <h2>Instruments</h2>
          <p>Interactive browser tools powered by Caelus, paired with the TypeScript call used to produce each result.</p>
        </div>
        {INSTRUMENTS.map((inst) => (
          <Link key={inst.id} href={inst.href} className="tile s4">
            <div className="tile__h">
              <b>{inst.id}</b>
              <span>Instrument</span>
              <i><span className="led led--live" aria-hidden />{inst.status}</i>
            </div>
            <div className="tile__b">
              <h3>{inst.title}</h3>
              <p>{inst.line}</p>
            </div>
          </Link>
        ))}

        <div className="band">
          <h2>The packages</h2>
        </div>
        {PACKAGES.map(([key, name, desc], i) => (
          <a key={name} href={NPM[key]} className={`tile ${i === 0 ? "s8" : "s4"}`}>
            <div className="tile__h">
              <b>npm</b>
              <span>{name}</span>
            </div>
            <div className="tile__b">
              <p>{desc}</p>
            </div>
          </a>
        ))}

        <div className="band">
          <h2>Verification and testing</h2>
        </div>
        <section className="tile s12">
          <div className="tile__b">
            <p>
              CI verifies the engine in two stages. First, the Python reference
              implementation is calibrated against Swiss Ephemeris. Next, the
              TypeScript engine runs against {formatGoldenChecks()} golden test
              cases exported from that reference. The largest deviation across the
              suite is {formatWorstNanoProse()}, well below astronomical
              tolerance, ensuring regressions fail the build before release. You
              can inspect the accuracy tables on <A href="/validation">Validation</A>{" "}
              and past bug investigations in <A href="/notes">Build Notes</A>.
            </p>
          </div>
        </section>

        <FAQ />

        <PageClose />
      </div>
    </main>
  );
}
