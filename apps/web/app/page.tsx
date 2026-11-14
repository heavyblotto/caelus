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
  ["caelus", "caelus", "The chart math: positions, houses, and aspects. It has no runtime dependencies and is ~153 KB gzipped with the embedded data."],
  ["mcp", "caelus-mcp", `${formatMcpToolsTitle()} chart tools for AI agents: natal charts, transits, synastry, event search, electional, lots, time-lords, directions, and the Vedic layer (nakshatras, dashas, vargas, yogas).`],
  ["birth", "caelus-birth", "Resolves a local birth time and place to UT, applying DST and historical timezone rules."],
  ["wheel", "caelus-wheel", "React SVG chart wheel (SSR-safe), ChartSphere (3D), AstroMap (astrocartography), and EphemerisGraph (~2.2 KB gzipped for the flat wheel)."],
  ["delineationsPd", "caelus-delineations-pd", "Public-domain delineations and correspondence data for the interpretation layer, versioned on its own semver."],
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
    desc: <>From a description of a sky, such as the sign of each planet, to every date on which it occurred.</>,
    unreleased: true,
  },
  {
    title: "Uncertain times",
    href: "/docs/uncertain-time",
    desc: <>Which facts of a chart hold across an uncertain time, and the instants at which the others change.</>,
    unreleased: true,
  },
  {
    title: "First and last visibility",
    href: "/docs/heliacal",
    desc: <>Heliacal risings and settings and the first lunar crescent, from one place, with the range of dates the sky allows.</>,
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
              The full capability list, along with a comparison against the
              other engines, is on <A href="/features">Features</A>. An entry
              marked Unreleased is in the repository and not yet in the
              published {SITE.version} packages.
            </p>
          </div>
        </section>

        <div className="band">
          <h2>Instruments</h2>
          <p>Each one answers one question in your browser and shows the call that produced the result.</p>
        </div>
        {INSTRUMENTS.map((inst) => (
          <Link key={inst.id} href={inst.href} className="tile s3">
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
          <h2>How it is checked</h2>
        </div>
        <section className="tile s12">
          <div className="tile__b">
            <p>
              CI checks the engine in two stages. A Python reference engine is first
              calibrated against Swiss Ephemeris, and the TypeScript port is then
              replayed against {formatGoldenChecks()} golden checks derived from it.
              The worst deviation recorded across that suite is{" "}
              {formatWorstNanoProse()}, which sits far below any astronomically
              relevant scale, so a porting bug fails the build instead of reaching a
              release. The tables and the methodology behind them are on{" "}
              <A href="/validation">Validation</A>, and the bugs this suite has
              caught are written up in the <A href="/notes">Build Notes</A>.
            </p>
          </div>
        </section>

        <FAQ />

        <PageClose />
      </div>
    </main>
  );
}
