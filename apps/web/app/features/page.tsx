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
} from "../../lib/facts";
import { WHEEL_THEME, WHEEL_LINE_COLORS } from "../../lib/wheelTheme";
import { pageMetadata } from "../../lib/seo";
import { INSTRUMENTS } from "../../lib/instruments";
import { SITE } from "../../lib/site";

const MCP_TOOLS_PROSE = formatMcpToolsProse();

export const metadata = pageMetadata({
  title: "Features",
  description:
    "Full capability overview for Caelus: planetary bodies, 12 house systems, sidereal ayanamsas, events, derived charts, Hellenistic time-lords, Vedic methods, query search, MCP tools, and a library comparison.",
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

type Stat = { num: string; label: string; href: string };

const STATS: Stat[] = [
  { num: String(FACTS.defaultBodies), label: "Bodies in the default chart", href: "/validation" },
  { num: String(FACTS.houseSystems), label: "House systems", href: "/docs/houses-and-zodiacs" },
  { num: String(FACTS.zodiacModes), label: `Zodiacs (tropical + ${formatSiderealProse()} sidereal)`, href: "/docs/houses-and-zodiacs" },
  { num: String(FACTS.mcpTools), label: "MCP tools for AI clients", href: "/docs/mcp" },
  { num: formatGoldenChecks(), label: "Golden checks in CI", href: "/validation" },
  { num: "0", label: "Runtime dependencies", href: "/docs/data-tiers" },
];

/** One capability. `unreleased` marks what is in the repository after the
 *  published version and not in an npm package yet. */
function Feature({ title, unreleased, children }: { title: string; unreleased?: boolean; children: ReactNode }) {
  return (
    <div className="card feature-card">
      {unreleased ? <div className="lab">Unreleased</div> : null}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function Group({ label, lead, children }: { label: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="feature-group">
      <h2 className="feature-group__label">{label}</h2>
      {lead}
      <div className="feature-grid">{children}</div>
    </section>
  );
}

// ---- comparison data ---------------------------------------------------------
// Subjects are developer-facing engines and libraries. Facts are taken from each
// project's own docs and license (linked under the tables). A check marks the
// developer-friendly answer; "–" means the capability is not built in.

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
  { label: "Language", cells: ["TypeScript", "C", "Python", "Python", "JavaScript", "TS / multi"] },
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
  { label: "Derived charts (returns, progressions)", cells: ["yes", "—", "yes", "yes", "—", "—"] },
  { label: "Hellenistic time-lords (lots, profections, releasing)", cells: ["yes", "—", "yes", "—", "—", "—"] },
  { label: "Vedic / Jyotish (dashas, vargas, yogas)", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Pattern detection (T-square, grand trine, yod)", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Sky dating: finding dates matching sky constraints\u2075", cells: ["yes", "—", "—", "—", "—", "—"] },
  { label: "Uncertain birth-time stability analysis\u2075", cells: ["yes", "—", "—", "—", "—", "—"] },
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
      <div className="table-scroll">
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
      <PageHero eyebrow="Validated · MIT · zero dependencies" title="Features" cta="compact">
        <P>
          This page lists the astronomical and astrological calculations built
          into Caelus. Package counts below are generated from build artifacts
          so documentation stays synchronized with releases. Planetary positions
          are verified against Swiss Ephemeris and JPL Horizons using the
          process documented in <A href="/methods">Methods</A>, and per-body error
          bounds are published on <A href="/validation">Validation</A>.
        </P>
      </PageHero>

      <div className="feature-stats">
        {STATS.map((s) => (
          <Link key={s.label} href={s.href} className="card stat">
            <span className="stat__num">{s.num}</span>
            <span className="stat__label">{s.label}</span>
          </Link>
        ))}
      </div>

      <P dim>
        Items marked Unreleased are available on the development branch and have
        not yet shipped in {SITE.version}.
      </P>

      <Group
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
        <Feature title="Bodies">
          {formatCountProse(FACTS.defaultBodies).charAt(0).toUpperCase()}
          {formatCountProse(FACTS.defaultBodies).slice(1)} in the default chart: Sun, Moon, Mercury, Venus, Mars,
          Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, and the mean and true
          lunar node. On request: mean and true Lilith (lunar apogee), five
          asteroids (Ceres, Pallas, Juno, Vesta, Pholus), the Uranian/Hamburg
          points, and a 319-star fixed catalog.
        </Feature>
        <Feature title="Houses, angles, and zodiacs">
          {formatHouseSystemsProse().charAt(0).toUpperCase()}
          {formatHouseSystemsProse().slice(1)} house systems: Placidus, Koch, Porphyry, Equal, Whole-sign,
          Regiomontanus, Campanus, Alcabitius, Morinus, Meridian, Polich-Page,
          and Vehlow, with a whole-sign fallback above the polar circles.
          Angles: Ascendant, Midheaven, vertex, and east point. Zodiac: tropical
          and {formatSiderealProse()} sidereal ayanamsas (Lahiri, Fagan/Bradley, Krishnamurti,
          Raman, Yukteshwar, Galactic Center, and Spica). See{" "}
          <A href="/docs/houses-and-zodiacs">Houses &amp; Zodiacs</A>.
        </Feature>
        <Feature title="Aspects and frames">
          Major aspects (conjunction, sextile, square, trine, opposition) with
          configurable orbs. Apparent geocentric or topocentric positions, in
          ecliptic longitude and latitude or right ascension and declination,
          with light-time, annual aberration, IAU 1980 nutation, and Vondrák
          2011 precession.
        </Feature>
        <Feature title="Events">
          Rise, set, and meridian transit; longitude crossings; lunar phases;
          stations; Gauquelin sectors; parans (co-angular bodies, two on the
          rising, setting, or meridian axis at once); and solar and lunar
          eclipses, with types, times, and geography: the sub-solar point of
          greatest eclipse, the path of totality (north and south limits and
          width), and local circumstances (magnitude, obscuration, and contact
          times) for any observer. Timing bounds are on{" "}
          <A href="/validation">Validation</A>.
        </Feature>
      </Group>

      <Group label="Techniques">
        <Feature title="Derived charts">
          Solar and lunar returns, secondary progressions, solar arc
          directions, composite and Davison charts, harmonics, antiscia and
          contra-antiscia, declination aspects and parallels, out-of-bounds
          status, essential dignities (qualitative and William Lilly&apos;s
          weighted five-fold score with degree almuten), and sect. See{" "}
          <A href="/docs/derived">Derived Charts</A>.
        </Feature>
        <Feature title="Hellenistic time-lords">
          Traditional timing methods calculated deterministically from validated
          positions: the seven sect-aware Hermetic lots (Fortune, Spirit, and
          five others), annual and monthly profections with the lord of the year,
          firdaria (the 75-year Persian planetary periods), zodiacal releasing
          across four levels including loosing of the bond, and primary
          directions using either the Ptolemy or Naibod time key. See{" "}
          <A href="/docs/hellenistic">Hellenistic Time-Lords</A>.
        </Feature>
        <Feature title="Vedic and Jyotish">
          Sidereal calculations built on top of the engine: nakshatras with padas
          and ruling lords; Vimshottari (120-year), Yogini (36-year), and
          Ashtottari (108-year) dashas with sub-periods; Parashari divisional
          charts (vargas) D1, D2, D3, D9, D10, D12, and D30; and classical
          yogas including Pancha Mahapurusha, Gajakesari, Budha-Aditya,
          Chandra-Mangala, Kemadruma, raja/dhana combinations, and yogakarakas.
          Where classical authorities differ on conventions, Caelus documents its
          chosen rule and tests it against the reference implementation. See{" "}
          <A href="/docs/vedic">Vedic &amp; Jyotish</A>.
        </Feature>
        <Feature title="Electional">
          Applying and separating aspects, solar phase (cazimi, combust, under
          the beams), planetary hours, void-of-course Moon periods, and angular
          house placements. Each metric matches the Python reference suite.
        </Feature>
      </Group>

      <Group
        label="Computation and search"
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
              Saturn over two years. The query engine and turbo tier scan curves
              like these to find intervals where target conditions hold.
            </figcaption>
          </figure>
        }
      >
        <Feature title="Query, turbo, and search">
          A declarative <code>when()</code> query API locates time intervals
          where celestial conditions hold. Combine predicates with{" "}
          <code>allOf</code>, <code>anyOf</code>, and <code>notOf</code>, and
          let the solver locate exact entry and exit boundaries by bisection.
          For multi-decade bulk scans, the turbo tier evaluates segmented
          Chebyshev polynomials fit to the engine, while <code>rankMoments</code>{" "}
          (including a non-blocking browser variant) scores and ranks timestamps
          within a search window. See <A href="/docs/recipes">Recipes</A>.
        </Feature>
        <Feature title="Matching and synthesis">
          Reduce any chart to a weighted unit-circle feature vector so
          configurations can be compared by cosine similarity, and use{" "}
          <code>searchConfigurations</code> to rank a date range by similarity
          to a target chart. Working in reverse, <code>compileForm</code> takes
          weighted placement constraints, solves for the longitudes that best
          satisfy them, reports the residual error, and flags impossible inputs.
          See <A href="/docs/recipes">Recipes</A>.
        </Feature>
        <Feature title="Sky dating" unreleased>
          <code>dateSky</code> searches a date range for intervals matching a set
          of planetary constraints (sign placements, longitude orbs, arcs, or
          inter-body elongations) and returns every matching window alongside a
          funnel showing how many candidates survived each filter. Try it in the{" "}
          <A href="/instruments/sky-dating">Sky Dating instrument</A> or read{" "}
          <A href="/docs/sky-dating">Sky Dating</A>.
        </Feature>
        <Feature title="Uncertain times" unreleased>
          <code>chartStability</code> evaluates a birth-time window around a
          nominal chart and reports which facts remain unchanged across the full
          range (angle signs, sect, planet signs, houses, directions, and
          aspects), along with stability percentages and transition timestamps
          resolved to roughly one second. Try it in the{" "}
          <A href="/instruments/uncertain-time">Uncertain Time instrument</A> or
          read <A href="/docs/uncertain-time">Uncertain Times</A>.
        </Feature>
        <Feature title="Historical dates" unreleased>
          <code>julianDay</code> accepts a calendar parameter and{" "}
          <code>calendarDate</code> converts Julian Days back to calendar dates,
          supporting historical dates prior to October 15, 1582 in the Julian
          calendar. For UT inputs before 1948, ΔT follows the Morrison,
          Stephenson, Hohenkerk, and Zawilski spline back to 720 BC. See{" "}
          <A href="/docs/deep-time">Deep Time</A>.
        </Feature>
        <Feature title="Patterns and chart signature">
          <code>detectPatterns</code> identifies classical chart configurations
          (T-squares, grand trines, grand crosses, yods, kites, mystic
          rectangles, and sign or house stelliums), deduplicating subsets such
          as T-squares inside a grand cross. <code>chartSignature</code>{" "}
          summarizes element, modality, quadrant, and hemisphere counts along
          with the dominant element, sign, and chart ruler. See{" "}
          <A href="/docs/cookbook">Common Tasks</A>.
        </Feature>
        <Feature title="Interpretation layer">
          While the core engine handles astronomical calculations only, the
          interpretation layer builds structured readings on top of them.{" "}
          <code>interpretationContext</code> projects a chart into ranked,
          citable facts (natal placements, dispositors, receptions, fixed stars,
          lots, transits, time-lords, synastry links, dignities, and Vedic
          factors), and <code>chartBrief</code> feeds only cited facts to an LLM
          with <code>auditCitations</code> checking that generated claims match
          source IDs. See <A href="/docs/interpretation">Interpretation</A>.
        </Feature>
        <Feature title="Chart provenance">
          Not every chart comes from a recorded birth time. <code>Realm</code>{" "}
          labels the chart&apos;s category (observed, forecast, mythic, or
          archetypal), while <code>TemporalAnchor</code> and{" "}
          <code>SpatialAnchor</code> capture how accurately the time and
          location are known. Passing them to <code>realize()</code> routes to
          either the ephemeris or synthetic compiler and weights angles and the
          Moon proportionally in downstream interpretations. See{" "}
          <A href="/docs/provenance">Provenance</A>.
        </Feature>
      </Group>

      <Group
        label="Output and delivery"
        lead={
          <figure className="feature-figure">
            <div className="chart-fluid">
              <ChartSphere chart={sphereChart} size={320} tilt={64} theme={WHEEL_THEME} />
            </div>
            <figcaption>
              The same chart rendered as a tilted 3D celestial sphere showing each
              planet at its ecliptic latitude. Every wheel, sphere, map, and
              ephemeris plot renders as SSR-safe SVG. See{" "}
              <A href="/docs/visualizations">Visualizations</A>.
            </figcaption>
          </figure>
        }
      >
        <Feature title="Visualization">
          Render charts as a traditional 2D wheel, a tilted 3D celestial sphere
          accounting for ecliptic latitude, an astrocartography world map of
          angle lines, or a graphic ephemeris plot. Sky View generates an accurate
          description of the visible sky for a given location and timestamp (including
          body positions, magnitudes, Moon phase, twilight state, Milky Way, and
          constellation overlays) for AI image generation. All graphics output
          clean, SSR-safe SVG with zero runtime dependencies. See{" "}
          <A href="/docs/visualizations">Visualizations</A>.
        </Feature>
        <Feature title="Instruments">
          {INSTRUMENTS.length} focused browser tools run directly on Caelus with
          embedded ephemeris data and show the TypeScript API call used for each
          result:{" "}
          {INSTRUMENTS.map((inst, i) => (
            <span key={inst.id}>
              {i > 0 ? (i === INSTRUMENTS.length - 1 ? ", and " : ", ") : ""}
              <A href={inst.href}>{inst.title}</A>
            </span>
          ))}
          . Browse them on <A href="/instruments">Instruments</A>.
        </Feature>
        <Feature title="Packages">
          Four core npm packages: <code>caelus</code> (ephemeris and chart math
          with zero runtime dependencies), <code>caelus-birth</code> (timezone
          and local-time conversion), <code>caelus-wheel</code> (SSR-safe SVG
          visualizations), and <code>caelus-mcp</code> (the MCP server), plus
          the Python reference implementation{" "}
          <A href="https://pypi.org/project/caelus-engine/">caelus-engine</A> on
          PyPI.
        </Feature>
        <Feature title="Integration">
          The MCP server provides {MCP_TOOLS_PROSE} chart tools over stdio and
          Streamable HTTP at <A href="/api/mcp">/api/mcp</A>, alongside a REST
          endpoint at <A href="/api/chart?lat=27.94&lon=-82.46">/api/chart</A>{" "}
          (with three tools, <code>date_sky</code>,{" "}
          <code>chart_stability</code>, and <code>heliacal</code>, still
          unreleased). Because the engine performs no filesystem or network I/O
          by default, it runs consistently across browsers, edge workers, and
          Node.js. See <A href="/docs/mcp">MCP Setup</A> and{" "}
          <A href="/docs/data-tiers">Data Tiers</A>.
        </Feature>
        <Feature title="Range and license">
          Supports AD 1000&ndash;3000 for the Sun, Moon, major planets, and
          Pluto (verified against JPL Horizons), and 1600&ndash;2484 for major
          asteroids and Chiron, with an optional pack extending planets to 3000
          BC&ndash;AD 3000. MIT licensed with no AGPL dependencies or external
          data files required. See <A href="/provenance">Provenance</A>.
        </Feature>
      </Group>

      <section className="feature-group">
        <h2 className="feature-group__label">How it compares</h2>
        <P>
          The comparison below covers developer-facing ephemeris and astrology
          libraries using information from each project&apos;s documentation and
          license. Swiss Ephemeris and Astronomy Engine provide planetary
          positions and astronomical events without built-in astrological house,
          zodiac, or timing calculations. A checkmark indicates built-in
          support, while a dash means the capability is outside that
          library&apos;s scope.
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
              full precision (a built-in mode runs without them at lower
              precision). Immanuel builds on it. Kerykeion&apos;s default tier
              uses JPL DE440s.
            </li>
            <li>
              <sup>3</sup> <code>caelus-mcp</code> exposes {MCP_TOOLS_PROSE} tools over
              the Model Context Protocol. Kerykeion serializes charts to XML for
              LLM prompts but ships no MCP server.
            </li>
            <li>
              <sup>4</sup> Kerykeion 6.1 uses libephemeris as its default
              backend and offers Swiss Ephemeris as an optional one.
            </li>
            <li>
              <sup>5</sup> Unreleased in Caelus. The other columns were checked
              against each project&apos;s README or programmer&apos;s
              documentation on 12 November 2026.
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
