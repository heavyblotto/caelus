import { A, Eyebrow, H2, P, Note } from "../../components/Prose";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Methods",
  description:
    "How Caelus implements published astronomical algorithms, verifies positions against Swiss Ephemeris and JPL Horizons, and validates derived calculations with golden fixtures.",
  path: "/methods",
});

export default function Methods() {
  return (
    <main className="container page">
      <Eyebrow>Methods</Eyebrow>
      <h1>Methods</h1>
      <P>
        Caelus implements published astronomical algorithms and validates every
        calculation against independent ephemerides. Per-body accuracy tables
        appear on <A href="/validation">Validation</A>, and source citations are
        listed on <A href="/provenance">Provenance</A>. This page explains the
        development and verification workflow.
      </P>

      <H2>Reference-first development</H2>
      <P>
        Every mathematical model is implemented first in the Python reference
        package, which generates JSON golden fixtures for positions and events
        at fixed timestamps. The TypeScript engine implements the same formulas,
        and CI replays every fixture against it on each commit. Features merge
        only when the Python reference, golden fixtures, and TypeScript engine
        match.
      </P>
      <P>
        Because the core engine performs no file or network I/O and bundles or
        loads coefficient tables as plain data, the same implementation runs in
        browsers, edge workers, and Node.js.
      </P>

      <H2>Two independent benchmarks</H2>
      <P>
        <A href="https://www.astro.com/swisseph/swephinfo_e.htm">
          Swiss Ephemeris
        </A>{" "}
        2.10 is the primary calibration target because it shares the
        apparent-place definition used here (geocentric ecliptic longitude at
        the true equinox of date). Sampling random timestamps across
        1000&ndash;3000 checks alignment with standard astrological software.
        Caelus uses Swiss Ephemeris only in automated tests and ships none of
        its code or data files.
      </P>
      <P>
        <A href="https://ssd.jpl.nasa.gov/horizons/">JPL Horizons</A> provides
        an independent benchmark derived from different underlying integrations
        and expressed in equatorial right ascension and declination. Verifying
        against both references catches frame errors or shared textbook biases.
        Compared with Horizons, Caelus matches within ~0.1&Prime; for the Sun
        and inner planets, ~0.2&Prime; for the Moon, and a few arcseconds for
        the outer planets.
      </P>

      <H2>Validating astrological conventions</H2>
      <P>
        Hellenistic timing systems and Vedic calculations are deterministic, but
        classical texts sometimes disagree on minor conventions. Where sources
        diverge, Caelus documents its chosen convention (such as Brihat
        Parashara Hora Shastra or P.V.R. Narasimha Rao&apos;s JHora
        definitions) and locks it into the <code>validate_jyotish</code> test
        suite with source citations, keeping verification self-contained with no
        Swiss Ephemeris dependency.
      </P>

      <Note>
        Swiss Ephemeris in Moshier mode carries its own approximation error. When
        a benchmark compares against that built-in lunar theory instead of JPL
        integration files, the gap reflects the Moshier model: the
        true lunar node agrees within 1&Prime; of JPL DE431 and up to ~1&prime;
        against Moshier.
      </Note>

      <H2>Fitted models and empirical constants</H2>
      <P>
        Where closed-form formulas are unavailable or too large to bundle,
        coefficients are fit directly to reference ephemerides and committed
        alongside the raw sample data for reproducibility:
      </P>
      <ul>
        <li>
          <strong>Minor bodies.</strong> Chiron and the major asteroids use
          Chebyshev polynomials fit to JPL Horizons geometric states across
          1600&ndash;2484 (residuals under 5&times;10&#8315;&#8310; AU), passed
          through the same geocentric reduction pipeline as the planets.
        </li>
        <li>
          <strong>Lunar eclipse magnitude.</strong> Earth&apos;s atmospheric
          shadow enlargement (Danjon effect) is fit empirically against Swiss
          Ephemeris, matching lunar magnitudes within 0.0013.
        </li>
        <li>
          <strong>Uranian points.</strong> Trans-Neptunian hypothetical bodies
          use fixed orbital elements matched to the Hamburg School definitions in
          Swiss Ephemeris.
        </li>
        <li>
          <strong>Rise, set, and Gauquelin sectors.</strong> Disc-center
          altitude and standard atmospheric refraction parameters match the Swiss
          Ephemeris horizon event convention.
        </li>
      </ul>

      <H2>Summary of verification checks</H2>
      <table className="data-table table-auto" style={{ fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Verification scope</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Planet and Moon longitudes</td>
            <td>JPL Horizons (DE441) across 1000&ndash;3000; 1850&ndash;2150 benchmarked against Swiss Ephemeris</td>
          </tr>
          <tr>
            <td>House cusps (additional systems)</td>
            <td>Matched against <code>swe_houses_armc</code>, including high-latitude cases</td>
          </tr>
          <tr>
            <td>Vertex and east point</td>
            <td>Matched against <code>swe_houses_armc</code></td>
          </tr>
          <tr>
            <td>Rise, set, meridian transit</td>
            <td>Root-finding matched against <code>swe_rise_trans</code></td>
          </tr>
          <tr>
            <td>Crossings and lunar phases</td>
            <td>Matched against <code>swe_solcross</code> and <code>swe_mooncross</code></td>
          </tr>
          <tr>
            <td>Eclipse classifications</td>
            <td>Verified across 1990&ndash;2030 with zero type mismatches</td>
          </tr>
        </tbody>
      </table>
      <P dim>
        See <A href="/validation">Validation</A> for full per-body maximum and
        RMS error figures.
      </P>

      <H2>Numerical limits and sensitivity</H2>
      <P>
        Some astronomical events are numerically sensitive by nature, and the
        validation tables document their actual tolerance. Near planetary
        stations, orbital acceleration is roughly 0.01&deg; per day squared, so a
        sub-arcsecond longitude difference can shift a station timestamp by
        several seconds to a minute, while the osculating lunar apogee
        (&quot;true Lilith&quot;) amplifies underlying lunar theory errors by
        roughly 1/e, meaning slight differences between ephemerides at that scale
        are expected across all software packages.
      </P>

      <P dim>
        <A href="/validation">Validation tables &rarr;</A>{" "}
        <A href="/provenance">Sources &rarr;</A>{" "}
        <A href="/notes">Build Notes &rarr;</A>
      </P>
    </main>
  );
}
