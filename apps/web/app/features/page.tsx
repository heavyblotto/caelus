import type { ReactNode } from "react";
import Link from "next/link";
import { Engine, ephemeris, julianDay, type BodyId } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel, ChartSphere, EphemerisGraph } from "caelus-wheel";
import { A, P } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import {
  FACTS,
  formatCountProse,
  formatGoldenChecks,
  formatHouseSystemsProse,
  formatMcpToolsProse,
  formatSiderealProse,
  formatWorstNano,
} from "../../lib/facts";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../lib/wheelTheme";
import { pageMetadata } from "../../lib/seo";
import { INSTRUMENTS } from "../../lib/instruments";

const MCP_TOOLS_PROSE = formatMcpToolsProse();

export const metadata = pageMetadata({
  title: "Features",
  description:
    "Full capability matrix for Caelus: planetary positions, 12 house systems, 7 sidereal ayanamsas, eclipses, physical observation forensics, Hellenistic and Vedic timing, query search, MCP tools, and a library comparison.",
  path: "/features",
});

// Live engine renders for the figures below; deterministic at build time.
const engine = new Engine(embeddedData);
const wheelChart = engine.chart(1990, 6, 10, 14, 30, 0, 27.95, -82.46, "placidus");
const sphereChart = engine.chart(2026, 6, 13, 12, 0, 0, 40.71, -74.01, "placidus");
const GRAPH_BODIES: BodyId[] = ["mars", "jupiter", "saturn"];
const graphSeries = ephemeris(engine, GRAPH_BODIES, {
  start: julianDay(2026, 1, 1),
  end: julianDay(2028, 1, 1),
  step: 7,
  value: "longitude",
});

type Stat = { num: string; label: string; src: string; href: string };

const STATS: Stat[] = [
  { num: String(FACTS.defaultBodies), label: "Bodies in default chart", src: "accuracy.json", href: "/validation" },
  { num: String(FACTS.houseSystems), label: "House systems", src: "Houses guide", href: "/docs/houses-and-zodiacs" },
  { num: String(FACTS.zodiacModes), label: `Zodiacs (tropical + ${formatSiderealProse()} sidereal)`, src: "Houses guide", href: "/docs/houses-and-zodiacs" },
  { num: String(FACTS.mcpTools), label: "MCP tools for AI clients", src: "caelus-mcp", href: "/docs/mcp" },
  { num: formatGoldenChecks(), label: "Golden checks in CI", src: `${formatWorstNano()} nas max`, href: "/validation" },
  { num: "0", label: "Runtime dependencies", src: "MIT licensed", href: "/docs/data-tiers" },
];

const JUMP_LINKS: Array<{ href: string; label: string }> = [
  { href: "#positions", label: "Positions & Houses" },
  { href: "#techniques", label: "Timing & Traditions" },
  { href: "#search", label: "Search & Forensics" },
  { href: "#delivery", label: "Visuals, MCP & Packages" },
  { href: "#compare", label: "Library Comparison" },
];

function Feature({
  title,
  tag,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  tag?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="card feature-card">
      {tag ? <div className="lab">{tag}</div> : null}
      <h3>{title}</h3>
      <p>{children}</p>
      {href && hrefLabel ? (
        <p className="small">
          <A href={href}>{hrefLabel} →</A>
        </p>
      ) : null}
    </div>
  );
}

function Group({
  id,
  label,
  lead,
  children,
}: {
  id: string;
  label: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="feature-group">
      <h2 className="feature-group__label">{label}</h2>
      {lead}
      <div className="feature-grid">{children}</div>
    </section>
  );
}

// ---- comparison data ---------------------------------------------------------
// Subjects are developer-facing engines and libraries. Facts are taken from each
// project's own docs and license (linked under the tables). A check marks the
// developer-friendly answer; "–" means the capability is outside scope.

const TOOLS = [
  "Caelus",
  "Swiss Ephemeris",
  "Kerykeion",
  "Immanuel",
  "Circular Natal JS",
  "Astronomy Engine",
];

type Row = { label: string; cells: string[] };

const PLATFORM_ROWS: Row[] = [
  { label: "License\u00b9", cells: ["MIT", "AGPL / paid", "AGPL", "AGPL", "Unlicense", "MIT"] },
  { label: "Languages", cells: ["TS + Python", "C", "Python", "Python", "JavaScript", "TS / multi"] },
  { label: "Runs in the browser", cells: ["yes", "no", "no", "no", "yes", "yes"] },
  { label: "Ships without ephemeris files\u00b2", cells: ["yes", "no", "no", "no", "yes", "yes"] },
  { label: "Independent of Swiss Ephemeris\u2074", cells: ["yes", "—", "optional backend", "no", "yes", "yes"] },
  { label: "MCP server for AI clients\u00b3", cells: ["yes", "no", "no", "no", "no", "no"] },
];

const CAPABILITY_ROWS: Row[] = [
  { label: "Positions & aspects", cells: ["yes", "yes", "yes", "yes", "yes", "positions only"] },
  { label: "House systems", cells: ["12", "many", "several", "several", "7", "—"] },
  { label: "Sidereal zodiacs", cells: ["7 ayanamsas", "yes", "yes", "yes", "yes", "—"] },
  { label: "Eclipses, rise/set, stations", cells: ["yes", "yes", "yes", "—", "—", "yes"] },
  { label: "Physical shadow & observation forensics", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Derived charts (returns, progressions)", cells: ["yes", "—", "yes", "yes", "—", "—"] },
  { label: "Hellenistic time-lords (lots, profections, releasing)", cells: ["yes", "—", "yes", "—", "—", "—"] },
  { label: "Vedic / Jyotish (dashas, vargas, yogas)", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Pattern detection (T-square, grand trine, yod)", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Sky dating & inverse search", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Uncertain birth-time stability analysis", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Canonical SHA-256 chart digests", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Accuracy published & CI-pinned", cells: ["yes", "reference", "depends on backend", "via Swiss Eph", "—", "yes"] },
];

function Cmp({ v, me }: { v: string; me: boolean }) {
  const cls = me ? "cmp-c cmp-c--me" : "cmp-c";
  if (v === "yes") {
    return (
      <td className={cls}>
        <span className="cmp-yes" aria-label="Yes">✓</span>
      </td>
    );
  }
  if (v === "no" || v === "—") {
    return (
      <td className={cls}>
        <span className="cmp-no" aria-label={v === "no" ? "No" : "Not built in"}>
          –
        </span>
      </td>
    );
  }
  return <td className={cls}>{v}</td>;
}

function ComparisonTable({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <div className="cmp-block">
      <p className="cmp-caption">{caption}</p>
      <div className="table-scroll" tabIndex={0}>
        <table className="cmp-table">
          <thead>
            <tr>
              <th scope="col" />
              {TOOLS.map((t, i) => (
                <th scope="col" key={t} className={i === 0 ? "cmp-me" : undefined}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((c, i) => (
                  <Cmp key={TOOLS[i]} v={c} me={i === 0} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <main className="container page page--bench">
      <PageHero
        eyebrow="Validated · MIT · TypeScript, Python & MCP"
        title="Features"
        cta="compact"
        after={
          <nav className="preset-bar" aria-label="Feature sections">
            {JUMP_LINKS.map((j) => (
              <a key={j.href} href={j.href} className="chip">
                {j.label}
              </a>
            ))}
          </nav>
        }
      >
        <P>
          This page inventories every astronomical, astrological, and physical
          observation module built into Caelus. Package counts are read from
          build artifacts so documentation stays synchronized with releases.
          Planetary positions are verified against Swiss Ephemeris and JPL
          Horizons using the workflow in <A href="/methods">Methods</A>, with
          per-body bounds published on <A href="/validation">Validation</A>.
        </P>
      </PageHero>

      <div className="feature-stats">
        {STATS.map((s) => (
          <Link key={s.label} href={s.href} className="card stat">
            <span className="stat__num num">{s.num}</span>
            <span className="stat__label">{s.label}</span>
            <span className="lab">{s.src}</span>
          </Link>
        ))}
      </div>

      <Group
        id="positions"
        label="Chart and positions"
        lead={
          <figure className="feature-figure">
            <div className="chart-fluid">
              <ChartWheel chart={wheelChart} size={340} theme={WHEEL_THEME} />
            </div>
            <figcaption>
              A natal wheel drawn by <code>caelus-wheel</code> from the engine&apos;s
              bodies, houses, angles, and aspects: 1990-06-10 14:30 UT, Tampa.
            </figcaption>
          </figure>
        }
      >
        <Feature title="Bodies and fixed stars" tag="≤ 1″ Sun–Saturn" href="/docs/charts" hrefLabel="Computing Charts">
          {formatCountProse(FACTS.defaultBodies).charAt(0).toUpperCase()}
          {formatCountProse(FACTS.defaultBodies).slice(1)} in the default chart: Sun, Moon, Mercury, Venus, Mars,
          Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, and the mean and true
          lunar node. On request: mean and true Lilith (lunar apogee), five
          asteroids (Ceres, Pallas, Juno, Vesta, Pholus), the Uranian/Hamburg
          points, minted asteroid packs, and a 319-star fixed catalog.
        </Feature>
        <Feature title="Houses, angles, and zodiacs" tag="12 systems · 7 ayanamsas" href="/docs/houses-and-zodiacs" hrefLabel="Houses & Zodiacs">
          {formatHouseSystemsProse().charAt(0).toUpperCase()}
          {formatHouseSystemsProse().slice(1)} house systems: Placidus, Koch, Porphyry, Equal, Whole-sign,
          Regiomontanus, Campanus, Alcabitius, Morinus, Meridian, Polich-Page,
          and Vehlow, with an explicit whole-sign fallback above the polar
          circles. Angles include Ascendant, Midheaven, vertex, and east point.
          Zodiac modes cover tropical and {formatSiderealProse()} sidereal
          ayanamsas (Lahiri, Fagan/Bradley, Krishnamurti, Raman, Yukteshwar,
          Galactic Center, and Spica).
        </Feature>
        <Feature title="Aspects and coordinate frames" tag="Apparent · Topocentric" href="/docs/charts" hrefLabel="Chart structure">
          Major and minor aspects with configurable orbs plus 3D great-circle
          angular separations. Apparent geocentric or topocentric positions in
          ecliptic longitude and latitude or right ascension and declination,
          including light-time, annual aberration, IAU 1980 nutation, and
          Vondrák 2011 precession.
        </Feature>
        <Feature title="Events and eclipses" tag="≤ 0.5 s rise/set" href="/docs/eclipses" hrefLabel="Eclipses & Events">
          Rise, set, and meridian transit; longitude crossings; lunar phases;
          planetary stations; Gauquelin sectors; parans (co-angular bodies); and
          solar and lunar eclipses with greatest-eclipse coordinates, central
          totality paths, and local magnitude, obscuration, and contact times.
        </Feature>
      </Group>

      <Group id="techniques" label="Timing and traditions">
        <Feature title="Derived charts and dignities" tag="Returns · Progressions" href="/docs/derived" hrefLabel="Derived Charts">
          Solar and lunar returns, secondary progressions, solar arc directions,
          composite and Davison charts, harmonics, draconic transforms, antiscia
          and contra-antiscia, declination parallels, out-of-bounds status,
          essential dignities (qualitative and Lilly&apos;s five-fold weighted
          score with degree almuten), and sect.
        </Feature>
        <Feature title="Hellenistic time-lords" tag="Traditional" href="/docs/hellenistic" hrefLabel="Hellenistic Time-Lords">
          Traditional timing methods calculated deterministically from validated
          positions: the seven sect-aware Hermetic lots (Fortune, Spirit, and
          five others), annual and monthly profections with lord of the year,
          75-year firdaria periods, four-level zodiacal releasing with loosing
          of the bond, and primary directions using Ptolemy or Naibod keys.
        </Feature>
        <Feature title="Vedic and Jyotish" tag="Sidereal" href="/docs/vedic" hrefLabel="Vedic & Jyotish">
          Sidereal calculations built on top of the engine: nakshatras with padas
          and ruling lords; Vimshottari (120-year), Yogini (36-year), and
          Ashtottari (108-year) dashas with sub-periods; Parashari divisional
          charts (vargas) D1, D2, D3, D9, D10, D12, and D30; Ashtakavarga; and
          classical yogas tested against documented authority conventions.
        </Feature>
        <Feature title="Electional and patterns" tag="Configuration search" href="/docs/electional" hrefLabel="Electional Search">
          Applying and separating aspects, solar phase (cazimi, combust, under
          the beams), planetary hours, void-of-course Moon windows, and angular
          house placements. <code>detectPatterns</code> finds T-squares, grand
          trines, grand crosses, yods, kites, mystic rectangles, and stelliums,
          while <code>chartSignature</code> summarizes element and modality
          distributions.
        </Feature>
      </Group>

      <Group
        id="search"
        label="Search, forensics, and reproducibility"
        lead={
          <figure className="feature-figure feature-figure--wide">
            <EphemerisGraph
              series={graphSeries}
              width={760}
              height={260}
              wrap={360}
              theme={WHEEL_THEME}
              colors={WHEEL_LINE_COLORS}
            />
            <figcaption>
              A graphic ephemeris plotting the longitudes of Mars, Jupiter, and
              Saturn over two years. The query engine and Chebyshev turbo tier
              scan trajectories like these to bisect exact entry and exit windows.
            </figcaption>
          </figure>
        }
      >
        <Feature title="Physical observation and forensics" tag="Scene · Verify · Locate" href="/docs/observation" hrefLabel="Physical Observation">
          <code>sceneGeometry</code> computes refracted Sun and Moon altitude
          and azimuth, flat or sloped-ground 3D shadow vectors, camera glare
          angles, zenith-frame lunar bright-limb tilt, and compact diurnal{" "}
          <code>chronosense</code> headers. <code>verifyObservation</code> checks
          claimed timestamps and coordinates with counterfactual diagnostics,
          while <code>chronolocate</code> and <code>geolocate</code> invert
          physical cues back to UTC windows or Earth coordinates.
        </Feature>
        <Feature title="Query, turbo, and search" tag="Declarative when()" href="/docs/time-queries" hrefLabel="Time Queries">
          A declarative <code>when()</code> API locates time intervals where
          celestial predicates hold using <code>allOf</code>, <code>anyOf</code>,
          and <code>notOf</code> combinators with bisected boundaries. For
          multi-decade scans, the turbo tier evaluates segmented Chebyshev
          polynomials, while <code>rankMoments</code> scores candidate windows
          and <code>compileForm</code> solves weighted placement constraints.
        </Feature>
        <Feature title="Sky dating" tag="Instrument I-01" href="/instruments/sky-dating" hrefLabel="Open Sky Dating">
          <code>dateSky</code> searches a date range for intervals matching a set
          of planetary constraints (sign placements, longitude orbs, arcs, lunar
          phases, or visibility rules) and returns every matching window
          alongside a filter funnel showing which constraints narrowed the
          candidates.
        </Feature>
        <Feature title="Uncertain times" tag="Instrument I-02" href="/instruments/uncertain-time" hrefLabel="Open Uncertain Time">
          <code>chartStability</code> sweeps a birth-time window around a nominal
          chart and reports which placements stay invariant across the full range
          (angle signs, sect, planet signs, houses, directions, and aspects),
          along with stability percentages and transition timestamps resolved to
          roughly one second.
        </Feature>
        <Feature title="First and last visibility" tag="Instrument I-04" href="/instruments/first-visibility" hrefLabel="Open First Visibility">
          Compute heliacal risings and settings, inner-planet apparitions, and
          first lunar crescents for any observer coordinates across atmospheric
          clarity bounds, returning visibility windows rather than single
          overconfident dates.
        </Feature>
        <Feature title="Historical deep time" tag="3000 BC – AD 3000" href="/docs/deep-time" hrefLabel="Deep Time">
          <code>julianDay</code> and <code>calendarDate</code> support Julian
          calendar dates prior to October 15, 1582. For UT inputs before 1948,
          ΔT follows the Morrison, Stephenson, Hohenkerk, and Zawilski spline
          back to 720 BC, with explicit uncertainty bounds propagated alongside
          ephemeris errors.
        </Feature>
        <Feature title="Interpretation and provenance" tag="Citable facts" href="/docs/interpretation" hrefLabel="Interpretation Layer">
          <code>interpretationContext</code> projects charts into ranked,
          citable fact atoms, and <code>auditCitations</code> verifies that LLM
          briefs reference only computed IDs. <code>Realm</code>,{" "}
          <code>TemporalAnchor</code>, and <code>SpatialAnchor</code> track
          whether a chart is observed, forecast, mythic, or synthetic.
        </Feature>
        <Feature title="Canonical mode and synthetic orbits" tag="SHA-256 · Kepler" href="/docs/canonical" hrefLabel="Canonical Mode">
          <code>canonicalChart</code> and <code>chartDigest</code> emit
          quantized, content-addressable JSON with SHA-256 hashes and boundary
          flip warnings. For worldbuilding or custom rhythms,{" "}
          <code>synthetic.ts</code> registers authored periodic or 3D Keplerian
          bodies straight into the real sky engine, and minted CPK1 packs add
          any numbered JPL asteroid with SHA-256 verification.
        </Feature>
      </Group>

      <Group
        id="delivery"
        label="Visualization, MCP, and delivery"
        lead={
          <figure className="feature-figure">
            <div className="chart-fluid">
              <ChartSphere chart={sphereChart} size={320} tilt={64} theme={WHEEL_THEME} />
            </div>
            <figcaption>
              A tilted 3D celestial sphere showing each body at its ecliptic
              latitude. Wheels, spheres, kundlis, maps, and ephemeris plots all
              render as SSR-safe SVG. See{" "}
              <A href="/docs/visualizations">Visualizations</A>.
            </figcaption>
          </figure>
        }
      >
        <Feature title="SSR-safe SVG visualizations" tag="caelus-wheel" href="/docs/visualizations" hrefLabel="Visualizations">
          Render charts as a traditional 2D wheel, a tilted 3D celestial sphere,
          North or South Indian kundlis, an astrocartography world map of angle
          lines, or a graphic ephemeris plot. Sky View emits structured sky
          coordinates and image-generation prompts including magnitudes, Moon
          phase, twilight, and Milky Way geometry.
        </Feature>
        <Feature title="Interactive instruments" tag={`${INSTRUMENTS.length} live tools`} href="/instruments" hrefLabel="Browse Instruments">
          {INSTRUMENTS.length} focused browser tools run directly on embedded
          ephemeris data and show the TypeScript call used for each result:{" "}
          {INSTRUMENTS.map((inst, i) => (
            <span key={inst.id}>
              {i > 0 ? (i === INSTRUMENTS.length - 1 ? ", and " : ", ") : ""}
              <A href={inst.href}>{inst.title}</A>
            </span>
          ))}
          .
        </Feature>
        <Feature title="MCP and edge APIs" tag={`${FACTS.mcpTools} MCP tools`} href="/docs/mcp" hrefLabel="MCP Setup">
          <code>caelus-mcp</code> exposes {MCP_TOOLS_PROSE} chart and physical
          observation tools over stdio and Streamable HTTP at{" "}
          <A href="/api/mcp">/api/mcp</A>, alongside a REST endpoint at{" "}
          <A href="/api/chart?lat=27.94&lon=-82.46">/api/chart</A>. Because the
          engine performs no filesystem or network I/O by default, it runs
          identically in browsers, edge workers, and Node.js.
        </Feature>
        <Feature title="Packages, range, and license" tag="MIT · AD 1000–3000" href="/provenance" hrefLabel="Provenance">
          Five npm packages (<code>caelus</code>, <code>caelus-birth</code>,{" "}
          <code>caelus-wheel</code>, <code>caelus-mcp</code>,{" "}
          <code>caelus-delineations-pd</code>) plus{" "}
          <A href="https://pypi.org/project/caelus-engine/">caelus-engine</A> on
          PyPI. Validated AD 1000&ndash;3000 for the Sun, Moon, major planets,
          and Pluto against JPL Horizons, and 1600&ndash;2484 for asteroids and
          Chiron, under the MIT license with no AGPL restrictions.
        </Feature>
      </Group>

      <section id="compare" className="feature-group">
        <h2 className="feature-group__label">How it compares</h2>
        <P>
          The comparison below covers developer-facing ephemeris and astrology
          libraries using facts from each project&apos;s documentation and
          license. Swiss Ephemeris and Astronomy Engine compute planetary
          positions and astronomical events without built-in house, zodiac, or
          timing calculations. A checkmark indicates built-in support, while a
          dash marks capabilities outside that library&apos;s scope.
        </P>
      </section>

      <div className="feature-compare">
        <div className="feature-compare__inner">
          <ComparisonTable caption="License and platform" rows={PLATFORM_ROWS} />
          <ComparisonTable caption="What it computes" rows={CAPABILITY_ROWS} />
          <ol className="cmp-notes">
            <li>
              <sup>1</sup> Swiss Ephemeris is dual-licensed: AGPL-3.0, or a paid
              Professional License from Astrodienst.
            </li>
            <li>
              <sup>2</sup> Swiss Ephemeris uses <code>.se1</code> data files for
              full precision (a built-in Moshier mode runs without them at lower
              precision). Immanuel builds on it. Kerykeion&apos;s default tier
              uses JPL DE440s.
            </li>
            <li>
              <sup>3</sup> <code>caelus-mcp</code> exposes {MCP_TOOLS_PROSE} tools over
              the Model Context Protocol. Kerykeion serializes charts to XML for
              LLM prompts without shipping an MCP server.
            </li>
            <li>
              <sup>4</sup> Kerykeion 6.1 uses libephemeris as its default
              backend and offers Swiss Ephemeris as an optional one.
            </li>
          </ol>
          <P dim>
            Sources:{" "}
            <A href="https://www.astro.com/swisseph/">Swiss Ephemeris</A>,{" "}
            <A href="https://kerykeion.net/">Kerykeion</A>,{" "}
            <A href="https://github.com/theriftlab/immanuel-python">Immanuel</A>,{" "}
            <A href="https://github.com/0xStarcat/CircularNatalHoroscopeJS">
              circular-natal-horoscope-js
            </A>
            , and{" "}
            <A href="https://github.com/cosinekitty/astronomy">Astronomy Engine</A>.
          </P>
        </div>
      </div>

      <PageClose />
    </main>
  );
}
