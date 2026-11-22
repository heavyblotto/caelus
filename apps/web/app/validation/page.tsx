import { A, H2, P, Code } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import accuracy from "caelus/accuracy.json";
import {
  formatGoldenChecks,
  formatHouseSystemsProse,
  formatWorstNanoProse,
} from "../../lib/facts";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Validation",
  description: `How Caelus is verified: the Python reference is calibrated against Swiss Ephemeris and JPL Horizons, and the TypeScript engine passes ${formatGoldenChecks()} golden checks in CI.`,
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
          Accuracy is verified in two stages. First, the Python reference
          implementation is calibrated against Swiss Ephemeris and JPL
          Horizons. Second, the TypeScript engine is checked against golden
          fixtures exported from that reference. Both test suites run in CI on
          every commit, and the tables below summarize the measured residuals.
        </P>
      </PageHero>

      <H2>Reference vs Swiss Ephemeris 2.10</H2>
      <P>
        The Python reference was compared against Swiss Ephemeris 2.10 across
        hundreds of random timestamps between 1850 and 2150. Measurements cover
        apparent geocentric ecliptic longitude (true equinox of date) for every
        body, along with angles and house cusps at six latitudes including high
        northern latitudes in Iceland. The table reports maximum and RMS
        differences in arcseconds.
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
        For context, astrology software typically displays longitudes to the
        nearest arcminute (60″), and even small uncertainties in a recorded
        birth time shift angles and the Moon by much more than the differences
        above. Dates after 2025 also depend on future ΔT extrapolation; see{" "}
        <A href="/notes">Build Notes</A> for details on how Caelus models ΔT.
      </P>

      <H2>TypeScript port vs reference</H2>
      <P>
        The TypeScript engine is verified against{" "}
        <strong>{formatGoldenChecks()} golden checks</strong> covering body
        longitudes, timescales, nutation, all {formatHouseSystemsProse()} house
        systems, fixed stars, Gauquelin sectors, eclipses, speeds, retrograde
        flags, and high-latitude Placidus fallbacks. The largest recorded
        difference across the suite is {formatWorstNanoProse()}. Because both
        codebases implement identical IEEE 754 floating-point math, regressions
        immediately fail the build before release.
      </P>

      <H2>Cross-checks</H2>
      <P>
        The lunar Chebyshev fit against JPL DE423 has a residual of 0.19 km
        (about 0.1″). The Chiron fit from JPL Horizons agrees with the Swiss
        Ephemeris asteroid file within 0.85″ in the worst case. The MCP
        aspect-date search was cross-checked against an independent scan and
        matched all nine Mars sextiles over a seven-year window to the minute,
        including a retrograde triple pass.
      </P>

      <H2>Reproduce</H2>
      <P>
        Clone the <A href="https://github.com/heavyblotto/caelus">repository</A>{" "}
        and run{" "}
        <Code>npm install &amp;&amp; npm run build &amp;&amp; npm test</Code> to
        verify every figure locally. If you spot a discrepancy against another
        ephemeris, open an issue with the UTC timestamp and coordinates used.
      </P>
      <P dim>
        Validated coverage spans AD 1000–3000 for the Sun, Moon, major planets,
        and Pluto (checked against JPL Horizons), and 1600–2484 for asteroids
        and Chiron (Horizons&apos; available span for those bodies). The hosted
        edge API uses the embedded Moon tier (1920–2080). Because Placidus is
        undefined above the polar circles, Caelus falls back to whole-sign
        houses there and flags the fallback on the returned chart.{" "}
        <A href="/methods">Methods →</A> <A href="/notes">Build notes →</A>
      </P>

      <PageClose
        title="Ship validated charts"
        secondaryHref="/docs/quickstart"
        secondaryLabel="Quickstart →"
      />
    </main>
  );
}
