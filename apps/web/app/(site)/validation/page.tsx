import { A, H2, P, Code } from "../../../components/Prose";
import PageClose from "../../../components/PageClose";
import PageHero from "../../../components/PageHero";
import accuracy from "caelus/accuracy.json";
import {
  formatGoldenChecks,
  formatHouseSystemsProse,
  formatWorstNanoProse,
} from "../../../lib/facts";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Validation",
  description: `The Python reference engine is checked against Swiss Ephemeris, and the TypeScript port against ${formatGoldenChecks()} golden checks. Both suites run in CI on every commit.`,
  path: "/validation",
});

// Canonical per-body accuracy lives in packages/caelus/accuracy.json so prose,
// SkyNow, and the MCP description derive from one source (lint:claims gate).
const fmt = (v: string) => (v === "—" ? "—" : `${v}″`);

export default function Validation() {
  return (
    <main className="container page">
      <PageHero eyebrow="Validation" title="Validation">
        <P>
          Accuracy here is measured in two stages. The Python reference engine
          is compared against Swiss Ephemeris, and the TypeScript port is
          compared against golden fixtures written by that reference. Both
          suites run in CI on every commit, and the tables below report what
          they measure.
        </P>
      </PageHero>

      <H2>Reference vs Swiss Ephemeris 2.10</H2>
      <P>
        The Python reference was compared against Swiss Ephemeris at hundreds
        of random instants across 1000–3000. The quantity compared is
        apparent geocentric ecliptic longitude at the true equinox of date, for
        every body, together with the angles and cusps at six latitudes that
        include polar Iceland. The table gives the maximum and root-mean-square
        disagreement in arcseconds.
      </P>
      <div className="table-scroll">
        <table className="data-table table-auto mono" style={{ fontSize: "0.85rem" }}>
          <thead>
            <tr><th>Body</th><th>Max</th><th>RMS</th><th>Note</th></tr>
          </thead>
          <tbody>
            {accuracy.bodies.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{fmt(row.max)}</td>
                <td>{fmt(row.rms)}</td>
                <td className="dim">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P dim>
        For scale, chart software usually displays positions to the arcminute
        (60″), and uncertainty in a recorded birth time moves a chart by more
        than any of the deltas above. Instants after 2025 also depend on how
        each engine extrapolates ΔT, which no model can pin down; the reasoning
        is in the <A href="/notes">Build Notes</A>.
      </P>

      <H2>TypeScript port vs reference</H2>
      <P>
        The port is replayed against{" "}
        <strong>{formatGoldenChecks()} golden checks</strong>, covering bodies,
        timescales, nutation, the {formatHouseSystemsProse()} house systems,
        fixed stars, Gauquelin sectors, eclipses, speeds, retrograde flags, and
        the polar Placidus fallback. The worst deviation recorded across that
        suite is {formatWorstNanoProse()}. Because both implementations run the
        same algorithms in IEEE doubles, a tolerance this far below
        astronomical relevance is achievable, and a porting bug fails the build
        rather than reaching a release.
      </P>

      <H2>Cross-checks</H2>
      <P>
        The Moon fit to JPL DE423 leaves a residual of 0.19 km, or about 0.1″.
        The Chiron fit from Horizons agrees with the Swiss Ephemeris asteroid
        file to 0.85″ in the worst case. The MCP aspect-date search was checked
        hit for hit against an independent scan, which found the same nine Mars
        sextiles to the minute, including a retrograde triple pass.
      </P>

      <H2>Reproduce</H2>
      <P>
        Clone the <A href="https://github.com/heavyblotto/caelus">repo</A> and run{" "}
        <Code>npm install &amp;&amp; npm run build &amp;&amp; npm test</Code> to
        reproduce every figure on this page. If you find a discrepancy against
        any professional ephemeris, please open an issue with the UTC instant
        and the coordinates you used.
      </P>
      <P dim>
        The validated range runs from 1000 to 3000 for the planets, Pluto, and
        the Moon, all checked against JPL Horizons. The small bodies span 1600
        to 2484, which is the widest window Horizons serves for them, and the
        hosted edge API covers a narrower window still because of its embedded
        Moon tier. Placidus is undefined above the polar circles, so the engine
        falls back to whole-sign there and reports that fallback in the
        response. <A href="/methods">Methods →</A> <A href="/notes">Build notes →</A>
      </P>

      <PageClose
        title="Ship validated charts"
        secondaryHref="/docs/quickstart"
        secondaryLabel="Quickstart →"
      />
    </main>
  );
}
