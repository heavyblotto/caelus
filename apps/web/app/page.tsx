import SkyNow from "../components/SkyNow";
import Cta from "../components/Cta";
import CodeBlock from "../components/CodeBlock";
import { A, H2, P, Code, Nav } from "../components/Prose";

export const metadata = {
  title: "Caelus — MIT astrological ephemeris engine",
  description:
    "Free TypeScript library for natal charts: planetary positions, houses, aspects. Runs in the browser, on edge, and in Node. MCP tools for AI clients.",
};

const PACKAGES: Array<[string, string, string]> = [
  ["caelus", "https://www.npmjs.com/package/caelus",
    "Chart math: positions, houses, aspects. Zero dependencies, ~85 KB gzipped"],
  ["caelus-mcp", "https://www.npmjs.com/package/caelus-mcp",
    "Seven chart tools for AI agents: natal charts, transits, synastry, event search"],
  ["caelus-birth", "https://www.npmjs.com/package/caelus-birth",
    "Local birth time + place → UT, with DST and historical timezone rules"],
  ["caelus-wheel", "https://www.npmjs.com/package/caelus-wheel",
    "React SVG chart wheel. SSR-safe, ~3.4 KB gzipped"],
];

export default function Home() {
  const a = { color: "#8a7fd4" };
  const td = { padding: "0.25rem 0.9rem 0.25rem 0", verticalAlign: "top" as const };
  const bullet = { listStyle: "none", padding: 0, margin: "0.8rem 0", lineHeight: 2, opacity: 0.85 };
  return (
    <main>
      <Nav current="/" />
      <h1 style={{ letterSpacing: "0.05em" }}>Caelus</h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.92, lineHeight: 1.55 }}>
        MIT astrological ephemeris engine in TypeScript.
      </p>
      <P>
        Caelus computes natal charts: where each planet is in the zodiac, whether
        it is retrograde, the ascendant and midheaven, house cusps, and major
        aspects. You pass a date, UT time, latitude, and longitude; it returns a
        chart object for your app, API, or AI tool. The core library is ~85 KB,
        has no dependencies, and runs in the browser without ephemeris files on
        disk.
      </P>
      <P dim>
        Accuracy tables: <A href="/validation">Validation</A>.
        {" "}Coefficient sources: <A href="/provenance">Provenance</A>.
      </P>
      <ul style={bullet}>
        <li>🪐 Live chart below — change date, place, and house system</li>
        <li>📦 <Code>npm install caelus</Code> for browser, edge, or Node apps</li>
        <li>🤖 <Code>caelus-mcp</Code> for Claude, Cursor, and other MCP clients</li>
        <li>🆓 MIT licensed; coefficients embedded, no ephemeris files on disk</li>
      </ul>
      <Cta />
      <SkyNow />

      <H2>The Packages</H2>
      <P>
        Four npm packages, all MIT:
      </P>
      <table style={{ fontSize: "0.85em", lineHeight: 1.6, borderSpacing: 0 }}>
        <tbody>
          {PACKAGES.map(([name, href, desc]) => (
            <tr key={name}>
              <td style={td}><A href={href}><code>{name}</code></A></td>
              <td style={{ ...td, opacity: 0.7 }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H2 id="get-started">Get Started: Compute a Chart</H2>
      <CodeBlock lang="bash" code="npm install caelus" />
      <CodeBlock
        lang="typescript"
        label="chart.ts"
        code={`import { Engine, fmtLon } from "caelus";
import { embeddedData } from "caelus/data-embedded";

const engine = new Engine(embeddedData);

const chart = engine.chart(
  1990, 6, 10, 14, 30, 0,
  27.95, -82.46,
  "placidus",
);

fmtLon(chart.bodies.sun.lon);   // "19°27' Gemini"
chart.bodies.saturn.retrograde; // true

const sidereal = engine.chart(
  1990, 6, 10, 14, 30, 0,
  27.95, -82.46,
  {
    houseSystem: "koch",
    zodiac: "sidereal:lahiri",
    bodies: ["mean_lilith"],
  },
);`}
      />
      <P>
        Times are UT. For a user&apos;s local birth time, convert with{" "}
        <Code>caelus-birth</Code> (below). Extended bodies, fixed stars, and
        event search need the Node loader, <Code>loadNodeData</Code>. Full API:{" "}
        <A href="https://www.npmjs.com/package/caelus">package README</A>.
      </P>

      <H2 id="mcp">Get Started: Chart Tools for AI Clients</H2>
      <P>
        <Code>caelus-mcp</Code> exposes seven chart tools over MCP. Add to{" "}
        <Code>claude_desktop_config.json</Code> or <Code>.cursor/mcp.json</Code>:
      </P>
      <CodeBlock
        lang="json"
        label=".cursor/mcp.json"
        code={`{
  "mcpServers": {
    "caelus": {
      "command": "npx",
      "args": ["caelus-mcp"]
    }
  }
}`}
      />
      <P>Example prompts:</P>
      <ul style={{ lineHeight: 1.9, paddingLeft: "1.2rem", opacity: 0.78 }}>
        <li>&ldquo;Natal chart: born June 10 1990, 2:30pm, Tampa FL.&rdquo;</li>
        <li>&ldquo;When is Saturn square my natal Moon in the next two years?&rdquo;</li>
        <li>&ldquo;Compare my chart with my partner&apos;s.&rdquo;</li>
        <li>&ldquo;Next solar eclipse? Lunar eclipses in 2026?&rdquo;</li>
      </ul>
      <P>
        Tools: <Code>natal_chart</Code>, <Code>current_sky</Code>,{" "}
        <Code>transits</Code>, <Code>synastry</Code>,{" "}
        <Code>find_aspect_dates</Code>, <Code>rectification_grid</Code>,{" "}
        <Code>sky_events</Code>. Every answer is computed from the engine and
        is deterministic. Agent docs: <A href="/llms.txt">llms.txt</A>.
      </P>

      <H2>Get Started: Birth Times and a Chart Wheel</H2>
      <P>
        <Code>caelus-birth</Code> converts local birth time and place to UT.
        A four-hour timezone error moves the ascendant about 60°.{" "}
        <Code>caelus-wheel</Code> renders the chart as SVG (
        <A href="/wheel-demo">demo</A>).
      </P>
      <CodeBlock
        lang="tsx"
        label="Chart.tsx"
        code={`import { toUT } from "caelus-birth";
import { ChartWheel } from "caelus-wheel";

const t = toUT({
  year: 1990, month: 6, day: 10,
  hour: 14, minute: 30,
  lat: 27.95, lon: -82.46,
});

const chart = engine.chart(/* t.utc fields */);

<ChartWheel chart={chart} size={520} showAspects />;`}
      />
      <P>
        A Next.js app template is in{" "}
        <A href="https://github.com/heavyblotto/caelus/tree/main/templates/starter">
          <Code>templates/starter</Code>
        </A>
        : birth form, timezone handling, wheel, optional reading route.
      </P>

      <H2>What the Engine Covers</H2>
      <P>
        Core chart (always): Sun through Pluto, Chiron, both lunar nodes;
        speeds and retrograde flags; ASC, MC, vertex, east point; twelve house
        systems; major aspects. Valid 1800–2149.
      </P>
      <P>
        Optional (Node data packs): mean and true Lilith; Ceres, Pallas, Juno,
        Vesta, Pholus; eight Uranian bodies; 318 fixed stars; eight sidereal
        ayanamsas; Gauquelin sectors. Event search: rise/set, meridian
        transits, lunar phases, stations, zodiac crossings, solar and lunar
        eclipses. Also: topocentric positions, heliocentric queries,{" "}
        <Code>pheno()</Code>, <Code>azAlt()</Code>, refraction.
      </P>
      <P>
        Same engine in three places: this page (client-side),{" "}
        <Code>GET /api/chart</Code>, and Node via <Code>caelus-mcp</Code>.
      </P>

      <H2>How It Is Checked</H2>
      <P>
        Two-stage CI: a Python reference engine, then the TypeScript port against
        3,218 golden fixtures. Worst recorded deviation: 0.41 nano-arcseconds.
        Tables and methodology: <A href="/validation">Validation</A>. Bugs the
        suite caught: <A href="/notes">Build Notes</A>.
      </P>

      <p style={{ marginTop: "2rem", display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
        <a style={a} href="https://www.npmjs.com/package/caelus">npm install caelus</a>
        <a style={a} href="https://github.com/heavyblotto/caelus/tree/main/templates/starter">Starter Template</a>
        <a style={a} href="https://github.com/heavyblotto/caelus">GitHub</a>
        <a style={a} href="/api/chart?lat=27.94&lon=-82.46">REST API</a>
        <a style={a} href="https://www.npmjs.com/package/caelus-mcp">MCP Server</a>
        <a style={a} href="/llms.txt">llms.txt</a>
      </p>
    </main>
  );
}
