import type { ReactNode } from "react";
import Link from "next/link";
import PageClose from "../components/PageClose";
import Cta from "../components/Cta";
import CodeBlock, { type CodeBlockTab } from "../components/CodeBlock";
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
import { NPM, PYPI, SITE } from "../lib/site";
import { INSTRUMENTS } from "../lib/instruments";
import { pageMetadata } from "../lib/seo";
import { nycCivilNow } from "../lib/nycNow";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Deterministic ephemeris and astrology engine",
  description:
    "Deterministic, sub-millisecond astronomical and astrological ephemeris engine in TypeScript, Python, and MCP with zero runtime dependencies, zero network I/O, and MIT licensing.",
  path: "/",
});

// Measured credibility figures on the first screen. Every figure links to its
// verification page or source artifact.
const PROOF: Array<{ num: string; label: string; href: string; src: string }> = [
  { num: formatWorstNano(), label: "Nano-arcsec TS/Python delta", href: "/validation", src: "Validation" },
  { num: formatGoldenChecks(), label: "Golden checks in CI", href: "/validation", src: "Validation" },
  { num: String(FACTS.mcpTools), label: "Offline MCP tools", href: "/docs/mcp", src: "MCP setup" },
  { num: "~153 KB", label: "Engine + data, gzipped", href: "/docs/data-tiers", src: "Data tiers" },
  { num: "1000–3000", label: "AD JPL-validated span", href: "/validation", src: "JPL Horizons" },
  { num: "0 / MIT", label: "Runtime deps · no AGPL", href: `${SITE.repo}/blob/main/LICENSE`, src: "LICENSE" },
];

// Three core developer workflows Caelus serves.
const TRACKS: Array<{
  id: string;
  badge: string;
  title: string;
  summary: string;
  bullets: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}> = [
  {
    id: "APP",
    badge: "Web · Edge · Mobile",
    title: "Astronomy and chart apps",
    summary:
      "Compute natal, transit, synastry, and locational charts directly in the browser or at the edge so birth data stays on the user's device.",
    bullets: [
      `${FACTS.defaultBodies} default bodies, ${FACTS.houseSystems} house systems, and ${FACTS.zodiacModes} zodiac modes`,
      "SSR-safe SVG wheels, 3D spheres, astrocartography maps, and ephemeris graphs",
      "MIT licensed with bundled data and zero external ephemeris files",
    ],
    primaryHref: "/docs/quickstart",
    primaryLabel: "Quickstart →",
    secondaryHref: "/playground",
    secondaryLabel: "Open Playground",
  },
  {
    id: "MCP",
    badge: "AI Agents · Forensics",
    title: "AI agents, MCP, and field verification",
    summary:
      "Give language models and multimodal agents deterministic sky geometry, shadow verification, and structured chart facts without API keys or network calls.",
    bullets: [
      `${FACTS.mcpTools} MCP tools over stdio or Streamable HTTP via caelus-mcp`,
      "Verify outdoor shadows, twilight, and lunar bright-limb tilt with verifyObservation",
      "Emit compact local diurnal context headers and audit LLM chart citations",
    ],
    primaryHref: "/docs/mcp",
    primaryLabel: "MCP setup →",
    secondaryHref: "/docs/observation",
    secondaryLabel: "Observation guide",
  },
  {
    id: "LAB",
    badge: "Deep Time · Traditions",
    title: "Historical and comparative research",
    summary:
      "Query multi-century windows with explicit ΔT uncertainty bounds, invert planetary constraints to dates, and compare classical systems side by side.",
    bullets: [
      "Validated AD 1000–3000 against JPL Horizons, with an optional pack back to 3000 BC",
      "Inverse sky dating (dateSky), birth-time stability sweeps, and heliacal visibility",
      "Hellenistic time-lords, Vedic dashas and vargas, and canonical SHA-256 digests",
    ],
    primaryHref: "/instruments",
    primaryLabel: "Try Instruments →",
    secondaryHref: "/validation",
    secondaryLabel: "Accuracy tables",
  },
];

// Multi-runtime comparison showing identical astronomical computation across
// TypeScript (runnable in the browser), Python, and MCP JSON-RPC.
const RUNTIME_TABS: CodeBlockTab[] = [
  {
    id: "ts",
    label: "TypeScript (runnable)",
    lang: "typescript",
    fileLabel: "scene-and-chart.ts",
    run: true,
    code: `import { Engine, fmtLon, julianDay, sceneGeometry } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const engine = new Engine(embeddedData);
const jd = julianDay(2026, 6, 21, 18, 0, 0);

const chart = engine.chart(2026, 6, 21, 18, 0, 0, 40.71, -74.01, "placidus");
const scene = sceneGeometry(engine, jd, 40.71, -74.01);

({
  sun: fmtLon(chart.bodies.sun.lon),
  ascendant: fmtLon(chart.angles.ascendant),
  sunAltDeg: Number(scene.sun.altitudeApparentDeg.toFixed(2)),
  shadowBearingDeg: Number(scene.shadow.bearingDeg.toFixed(2)),
  chronosense: scene.chronosense.line,
});`,
  },
  {
    id: "py",
    label: "Python",
    lang: "python",
    fileLabel: "chart.py",
    code: `from astroengine import Engine, julian_day

engine = Engine("full")
jd = julian_day(2026, 6, 21, 18, 0, 0)

sun_lon = engine.longitude("sun", jd)
moon_lon = engine.longitude("moon", jd)
houses = engine.houses(jd, 40.71, -74.01, "placidus")

print(f"Sun: {sun_lon:.4f} deg | Moon: {moon_lon:.4f} deg")
print(f"ASC: {houses['ascendant']:.4f} deg | MC: {houses['mc']:.4f} deg")`,
  },
  {
    id: "mcp",
    label: "MCP JSON",
    lang: "json",
    fileLabel: "verify_observation.json",
    code: `{
  "tool": "verify_observation",
  "arguments": {
    "date": "2026-06-21",
    "time": "18:00:00",
    "lat": 40.7128,
    "lon": -74.006,
    "observed": {
      "shadowBearingDeg": 15.8,
      "shadowLengthRatio": 0.32
    }
  }
}`,
  },
];

// Twelve core capabilities (3 complete rows of 4 tiles on desktop).
const CAPABILITIES: Array<{ title: string; href: string; tag: string; desc: ReactNode }> = [
  {
    title: "Charts and houses",
    href: "/docs/charts",
    tag: "Core",
    desc: <>Sun through Pluto, Chiron, and the lunar nodes across {formatHouseSystemsProse()} house systems, tropical zodiac, and {formatSiderealProse()} sidereal ayanamsas.</>,
  },
  {
    title: "Physical observation",
    href: "/docs/observation",
    tag: "Forensics",
    desc: <>Compute 3D shadow vectors, twilight stages, and lunar bright-limb tilt, verify outdoor metadata, and invert observations to timestamps or coordinates.</>,
  },
  {
    title: "Events and eclipses",
    href: "/docs/eclipses",
    tag: "Sky",
    desc: <>Find rise, set, meridian transit, planetary stations, lunar phases, and solar or lunar eclipses with central shadow paths and local contact times.</>,
  },
  {
    title: "Sky dating",
    href: "/docs/sky-dating",
    tag: "Inverse",
    desc: <>Search multi-century ranges with <code>dateSky</code> for every date interval matching planetary sign placements, aspects, lunar phases, or visibility rules.</>,
  },
  {
    title: "Uncertain times",
    href: "/docs/uncertain-time",
    tag: "Stability",
    desc: <>Sweep an approximate birth-time window with <code>chartStability</code> to separate invariant placements from cusps or signs that shift inside the interval.</>,
  },
  {
    title: "First visibility",
    href: "/docs/heliacal",
    tag: "Heliacal",
    desc: <>Calculate heliacal risings and settings, inner-planet apparitions, and first lunar crescents with explicit atmospheric clarity bounds.</>,
  },
  {
    title: "Derived charts",
    href: "/docs/derived",
    tag: "Methods",
    desc: <>Solar and lunar returns, secondary progressions, solar arc directions, composite and Davison charts, harmonics, draconic transforms, dignities, and sect.</>,
  },
  {
    title: "Hellenistic time-lords",
    href: "/docs/hellenistic",
    tag: "Traditional",
    desc: <>Seven sect-aware Hermetic lots, annual and monthly profections, 75-year firdaria periods, four-level zodiacal releasing, and primary directions.</>,
  },
  {
    title: "Vedic and Jyotish",
    href: "/docs/vedic",
    tag: "Sidereal",
    desc: <>Nakshatras with padas, Vimshottari, Yogini, and Ashtottari dashas, Parashari divisional charts (vargas), Ashtakavarga, and classical yogas.</>,
  },
  {
    title: "Interpretation and briefs",
    href: "/docs/interpretation",
    tag: "Audited",
    desc: <>Project charts into ranked, citable fact atoms, match them against a rule corpus, and verify LLM output against cited placements with <code>auditCitations</code>.</>,
  },
  {
    title: "Synthetic and canonical",
    href: "/docs/synthetic",
    tag: "Portable",
    desc: <>Author custom periodic or 3D Keplerian orbits inside the real sky engine, and emit quantized JSON with SHA-256 <code>chartDigest</code> hashes.</>,
  },
  {
    title: "MCP server",
    href: "/docs/mcp",
    tag: `${FACTS.mcpTools} tools`,
    desc: <>Connect <code>caelus-mcp</code> over stdio or Streamable HTTP so Claude, Cursor, and custom agents call {formatMcpToolsProse()} local astronomical tools.</>,
  },
];

// Six packages (2 complete rows of 3 tiles on desktop, including PyPI).
const PACKAGES: Array<{
  registry: "npm" | "PyPI";
  name: string;
  href: string;
  desc: string;
}> = [
  {
    registry: "npm",
    name: "caelus",
    href: NPM.caelus,
    desc: "Core ephemeris, chart calculations, physical observation, and query solvers with zero runtime dependencies (~153 KB gzipped including embedded data).",
  },
  {
    registry: "PyPI",
    name: "caelus-engine",
    href: PYPI.caelusEngine,
    desc: "The Python reference implementation running on the standard library alone. Exports the golden fixtures that pin the TypeScript build in CI.",
  },
  {
    registry: "npm",
    name: "caelus-mcp",
    href: NPM.mcp,
    desc: `${formatMcpToolsTitle()} chart and physical-sky tools for AI clients over stdio and Streamable HTTP: charts, transits, synastry, eclipses, observation, and Vedic timing.`,
  },
  {
    registry: "npm",
    name: "caelus-birth",
    href: NPM.birth,
    desc: "Resolves local civil birth dates, times, and coordinates to UTC using historical IANA timezone and daylight saving rules.",
  },
  {
    registry: "npm",
    name: "caelus-wheel",
    href: NPM.wheel,
    desc: "SSR-safe React SVG visualizations: flat ChartWheel (~4.3 KB gzipped), tilted 3D ChartSphere, AstroMap, Kundli, and EphemerisGraph.",
  },
  {
    registry: "npm",
    name: "caelus-delineations-pd",
    href: NPM.delineationsPd,
    desc: "Public-domain delineations and correspondence tables for the optional interpretation layer, versioned independently from core math.",
  },
];

const PLAYGROUND_MODES = [
  "Natal & Transits",
  "3D Celestial Sphere",
  "Sky View & Shadows",
  "Astrocartography",
  "Vedic Dashas & Vargas",
  "Synastry & Composite",
  "Copy TS / Python / MCP Call",
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "Caelus",
  description:
    "Deterministic astronomical and astrological ephemeris engine in TypeScript, Python, and MCP with zero runtime dependencies and MIT licensing.",
  url: SITE.url,
  codeRepository: SITE.repo,
  programmingLanguage: ["TypeScript", "Python"],
  license: "https://opensource.org/licenses/MIT",
  keywords: "ephemeris, astronomy, astrology, natal chart, MCP, TypeScript, Python, JPL Horizons",
};

/**
 * Home orients and routes in five seconds: live computed sky beside a crisp
 * value proposition, one-click install tabs (npm, Python, MCP), measured proof
 * figures, workflow tracks, multi-runtime code comparison, interactive
 * Playground and Instruments, and package links.
 */
export default function Home() {
  return (
    <main className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="bench home hero-bench">
        <section className="tile claim" aria-labelledby="home-title">
          <div className="tile__h">
            <b>WHAT</b>
            <span>Caelus {SITE.version}</span>
            <i><span className="led led--ok" aria-hidden />MIT · 0 deps</i>
          </div>
          <div className="tile__b">
            <div className="lab">TypeScript · Python · MCP · offline</div>
            <h1 id="home-title">Deterministic ephemeris and astrology engine</h1>
            <p>
              Sub-millisecond astronomical and astrological computation verified
              against JPL Horizons and Swiss Ephemeris. Compute charts,
              eclipses, physical shadows, and timing methods in browsers, edge
              workers, Node.js, Python, or MCP with zero network I/O and no
              external ephemeris files.
            </p>
            <Cta variant="hero" />
          </div>
        </section>

        <section className="tile proof-tile" aria-label="Measured proof figures">
          <div className="tile__h">
            <b>PROOF</b>
            <span>Measured in CI, with source</span>
          </div>
          <div className="proof">
            {PROOF.map((s) => {
              const body = (
                <>
                  <span className="lab">{s.label}</span>
                  <b className="num">{s.num}</b>
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
          <h2>Built for three workflows</h2>
          <p>One deterministic ephemeris kernel serving chart software, AI agents, and historical research.</p>
        </div>
        {TRACKS.map((track) => (
          <section key={track.id} className="tile s4 track-tile">
            <div className="tile__h">
              <b>{track.id}</b>
              <span>{track.badge}</span>
            </div>
            <div className="tile__b stack">
              <h3>{track.title}</h3>
              <p>{track.summary}</p>
              <ul className="track-list">
                {track.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="row row--wrap">
                <Link href={track.primaryHref} className="btn btn-sm btn-secondary">
                  {track.primaryLabel}
                </Link>
                <Link href={track.secondaryHref} className="btn btn-sm btn-ghost">
                  {track.secondaryLabel}
                </Link>
              </div>
            </div>
          </section>
        ))}

        <div className="band">
          <h2>Same engine across runtimes</h2>
          <p>Run the TypeScript example directly in your browser, or switch tabs to compare Python and MCP.</p>
        </div>
        <section className="tile s8">
          <div className="tile__h">
            <b>CODE</b>
            <span>TypeScript · Python · MCP</span>
            <i><span className="led led--live" aria-hidden />Runnable in browser</i>
          </div>
          <div className="tile__b">
            <CodeBlock tabs={RUNTIME_TABS} />
          </div>
        </section>
        <section className="tile s4">
          <div className="tile__h">
            <b>SPEC</b>
            <span>Runtime parity</span>
          </div>
          <div className="tile__b stack">
            <h3>Numerically pinned across languages</h3>
            <p>
              Every algorithm is implemented first in the Python reference
              package and verified against Swiss Ephemeris and JPL Horizons. The
              TypeScript engine replays {formatGoldenChecks()} exported golden
              fixtures in CI, holding worst-case deviation to{" "}
              {formatWorstNanoProse()}.
            </p>
            <div className="kv-list">
              <div className="kv-row">
                <span className="lab">Browser / Edge</span>
                <span className="mono">caelus (~153 KB gz)</span>
              </div>
              <div className="kv-row">
                <span className="lab">Python 3</span>
                <span className="mono">caelus-engine (stdlib)</span>
              </div>
              <div className="kv-row">
                <span className="lab">AI Clients</span>
                <span className="mono">caelus-mcp ({FACTS.mcpTools} tools)</span>
              </div>
              <div className="kv-row">
                <span className="lab">Network I/O</span>
                <span className="mono">None by default</span>
              </div>
            </div>
            <div className="row row--wrap">
              <Link href="/validation" className="btn btn-sm btn-secondary">
                Validation tables →
              </Link>
              <Link href="/docs/architecture" className="btn btn-sm btn-ghost">
                Architecture
              </Link>
            </div>
          </div>
        </section>

        <div className="band">
          <h2>Playground and instruments</h2>
          <p>Interactive browser tools powered directly by Caelus, paired with the reproducible code call for every result.</p>
        </div>
        <section className="tile s12 tile--accent">
          <div className="tile__h">
            <b>PLAYGROUND</b>
            <span>Full interactive workbench</span>
            <i><span className="led led--live" aria-hidden />Client-side</i>
          </div>
          <div className="tile__b stack">
            <div className="row row--between row--wrap">
              <div>
                <h3>Inspect any chart, sky dome, or planetary timeline in the browser</h3>
                <p>
                  Switch between Western tropical, Hellenistic, and Vedic views,
                  scrub time with keyboard shortcuts, inspect paired 2D wheel
                  and 3D sphere views, and copy the exact TypeScript, Python, or
                  MCP call for any configuration.
                </p>
              </div>
              <div className="row row--wrap">
                <Link href="/playground" className="btn btn-primary">
                  Launch Playground →
                </Link>
                <Link href="/instruments" className="btn btn-secondary">
                  All Instruments
                </Link>
              </div>
            </div>
            <div className="row row--wrap">
              {PLAYGROUND_MODES.map((mode) => (
                <span key={mode} className="badge badge--muted">
                  {mode}
                </span>
              ))}
            </div>
          </div>
        </section>
        {INSTRUMENTS.filter((inst) => inst.id === "I-05").map((inst) => (
          <section key={inst.id} className="tile s12 tile--live">
            <div className="tile__h">
              <b>{inst.id}</b>
              <span>{inst.category}</span>
              <i><span className="led led--live" aria-hidden />{inst.status} · client-side</i>
            </div>
            <div className="tile__b stack">
              <div className="row row--between row--wrap">
                <div>
                  <h3>{inst.title}: shadow forensics, chronolocation, and geolocation</h3>
                  <p>
                    {inst.line} Drop a local photo to measure pole and shadow
                    vectors in the browser with zero server upload, inspect
                    counterfactual diagnostics, and copy the matching API call.
                  </p>
                </div>
                <div className="row row--wrap">
                  <Link href={inst.href} className="btn btn-primary btn-sm">
                    Open Field verifier →
                  </Link>
                  <Link href="/docs/observation" className="btn btn-secondary btn-sm">
                    Observation guide
                  </Link>
                </div>
              </div>
              <div className="row row--wrap">
                {inst.apiCalls.map((fn) => (
                  <span key={fn} className="badge badge--accent mono">
                    {fn}
                  </span>
                ))}
                <span className="badge badge--muted mono">Zero-upload local EXIF</span>
                <span className="badge badge--muted mono">Analemma heatmap</span>
              </div>
            </div>
          </section>
        ))}
        {INSTRUMENTS.filter((inst) => inst.id !== "I-05").map((inst) => (
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
          <h2>What it computes</h2>
          <p>Twelve computation domains backed by published astronomical models and automated conformance tests.</p>
        </div>
        {CAPABILITIES.map((c) => (
          <Link key={c.title} href={c.href} className="tile s3">
            <div className="tile__h">
              <b>CAP</b>
              <span>{c.tag}</span>
            </div>
            <div className="tile__b">
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          </Link>
        ))}
        <section className="tile s12">
          <div className="tile__b row row--between row--wrap">
            <p>
              Browse the full capability matrix, live build-time SVG figures,
              and library comparison against Swiss Ephemeris, Kerykeion,
              Immanuel, and Astronomy Engine on <A href="/features">Features</A>.
            </p>
            <Link href="/features" className="btn btn-sm btn-secondary">
              Explore Features →
            </Link>
          </div>
        </section>

        <div className="band">
          <h2>The packages</h2>
          <p>Modular MIT-licensed packages across npm and PyPI with zero third-party runtime dependencies.</p>
        </div>
        {PACKAGES.map((pkg) => (
          <a key={pkg.name} href={pkg.href} target="_blank" rel="noreferrer" className="tile s4">
            <div className="tile__h">
              <b>{pkg.registry}</b>
              <span>{pkg.name}</span>
            </div>
            <div className="tile__b">
              <p>{pkg.desc}</p>
            </div>
          </a>
        ))}

        <div className="band">
          <h2>Verification and provenance</h2>
        </div>
        <section className="tile s8">
          <div className="tile__h">
            <b>CI</b>
            <span>Golden conformance suite</span>
          </div>
          <div className="tile__b">
            <p>
              Every release passes two verification stages. First, the Python
              reference implementation is calibrated against Swiss Ephemeris
              2.10 across 1850–2150 and validated against JPL Horizons (DE441)
              across AD 1000–3000. Second, the TypeScript engine runs{" "}
              {formatGoldenChecks()} golden fixtures exported from that
              reference on every commit. The largest deviation across the suite
              is {formatWorstNanoProse()}, so numerical regressions fail CI
              before a package publishes.
            </p>
          </div>
        </section>
        <section className="tile s4">
          <div className="tile__h">
            <b>REFS</b>
            <span>Evidence pages</span>
          </div>
          <div className="tile__b stack stack--sm">
            <Link href="/validation">Validation tables and error bounds →</Link>
            <Link href="/methods">Verification methodology →</Link>
            <Link href="/provenance">Ephemeris sources and MIT licensing →</Link>
            <Link href="/notes">Build notes and bug postmortems →</Link>
            <Link href="/how-it-was-built">How Caelus was built →</Link>
          </div>
        </section>

        <FAQ />

        <PageClose />
      </div>
    </main>
  );
}
