import Link from "next/link";
import { A, H2, P, Code } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import accuracy from "caelus/accuracy.json";
import {
  FACTS,
  formatGoldenChecks,
  formatHouseSystemsProse,
  formatWorstNano,
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

const SUMMARY_STATS: Array<{ num: string; label: string; src: string }> = [
  { num: formatGoldenChecks(), label: "Golden checks in CI", src: "conformance-stats.json" },
  { num: `${formatWorstNano()} nas`, label: "Worst TS vs Python delta", src: "IEEE 754 parity" },
  { num: "≤ 1″", label: "Sun through Saturn max error", src: "vs Swiss Eph 2.10" },
  { num: "AD 1000–3000", label: "JPL-validated span", src: "JPL Horizons DE441" },
  { num: String(FACTS.houseSystems), label: "House systems verified", src: "Polar-inclusive" },
  { num: "0", label: "Eclipse type mismatches", src: "1990–2030 (181 eclipses)" },
];

export default function Validation() {
  return (
    <main className="container page">
      <PageHero eyebrow="Validation · Empirical Receipts" title="Validation">
        <P>
          Accuracy is verified in two stages. First, the Python reference
          implementation is calibrated against Swiss Ephemeris 2.10 and JPL
          Horizons (DE441). Second, the TypeScript engine replays{" "}
          {formatGoldenChecks()} golden fixtures exported from that reference on
          every commit. The summary and per-body tables below report the
          measured residuals directly from <code>accuracy.json</code>.
        </P>
      </PageHero>

      <div className="feature-stats">
        {SUMMARY_STATS.map((s) => (
          <div key={s.label} className="card stat">
            <span className="stat__num num">{s.num}</span>
            <span className="stat__label">{s.label}</span>
            <span className="lab">{s.src}</span>
          </div>
        ))}
      </div>

      <H2>Reference vs Swiss Ephemeris 2.10</H2>
      <P>
        The Python reference was compared against Swiss Ephemeris 2.10 across
        hundreds of random timestamps between 1850 and 2150. Measurements cover
        apparent geocentric ecliptic longitude (true equinox of date) for every
        body, along with angles and house cusps at six latitudes including high
        northern latitudes in Iceland. The table reports maximum and RMS
        differences in arcseconds.
      </P>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table table-auto mono">
          <thead>
            <tr><th>Body</th><th>Max</th><th>RMS</th><th>Note</th></tr>
          </thead>
          <tbody>
            {accuracy.bodies.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="num">{fmt(row.max)}</td>
                <td className="num">{fmt(row.rms)}</td>
                <td className="dim">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P dim>
        For context, astrology software typically displays longitudes to the
        nearest arcminute (60″), and small uncertainties in a recorded birth
        time shift angles and the Moon by much more than the residuals above.
        Dates after 2025 also depend on future ΔT extrapolation; see{" "}
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
        codebases execute matching IEEE 754 floating-point operations,
        regressions fail the build before release.
      </P>

      <H2>Independent cross-checks</H2>
      <P>
        The lunar Chebyshev fit against JPL DE423 has a residual of 0.19 km
        (about 0.1″). The Chiron fit from JPL Horizons agrees with the Swiss
        Ephemeris asteroid file within 0.85″ in the worst case. The MCP
        aspect-date search was cross-checked against an independent scan and
        matched all nine Mars sextiles over a seven-year window to the minute,
        including a retrograde triple pass.
      </P>

      <H2>Reproduce locally</H2>
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
        houses there and flags the fallback on the returned chart.
      </P>
      <div className="row row--wrap">
        <Link href="/methods" className="btn btn-sm btn-secondary">Methods →</Link>
        <Link href="/provenance" className="btn btn-sm btn-ghost">Provenance</Link>
        <Link href="/notes" className="btn btn-sm btn-ghost">Build Notes</Link>
        <Link href="/how-it-was-built" className="btn btn-sm btn-ghost">How it was built</Link>
      </div>

      <PageClose
        title="Ship validated charts"
        secondaryHref="/docs/quickstart"
        secondaryLabel="Quickstart →"
      />
    </main>
  );
}
