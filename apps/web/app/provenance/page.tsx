import { A, H2, P, Nav } from "../../components/Prose";

export const metadata = {
  title: "caelus — provenance",
  description: "Every byte of code and data traced to public sources. Swiss Ephemeris used as a test oracle, never as a source.",
};

export default function Provenance() {
  const td = { padding: "0.2rem 0.9rem 0.2rem 0", verticalAlign: "top" as const };
  const dim = { ...td, opacity: 0.55 };
  return (
    <main>
      <Nav current="/provenance" />
      <h1 style={{ letterSpacing: "0.05em" }}>clean room</h1>
      <P>
        For twenty-five years, almost every piece of astrology software has sat
        on one foundation: the Swiss Ephemeris. It is excellent, and it is
        AGPL — use it in anything network-accessible and your codebase must be
        open-sourced under AGPL too, unless you license commercially. Most
        &ldquo;independent&rdquo; astrology APIs are wrappers around it,
        inheriting that obligation.
      </P>
      <P>
        caelus is not a wrapper, a port, or a translation. It was written from
        the published scientific record, and every coefficient it ships traces
        to a public source:
      </P>
      <table style={{ fontSize: "0.85em", lineHeight: 1.6, borderSpacing: 0 }}>
        <tbody>
          <tr><td style={td}>Planets</td><td style={td}>VSOP87D analytical theory</td><td style={dim}>Bretagnon &amp; Francou, 1988, Bureau des Longitudes</td></tr>
          <tr><td style={td}>Moon</td><td style={td}>Chebyshev fit of JPL DE423</td><td style={dim}>NASA JPL numerical integration (public domain)</td></tr>
          <tr><td style={td}>Moon (embedded)</td><td style={td}>ELP2000-82 abridged series</td><td style={dim}>Chapront-Touzé &amp; Chapront, as published in Meeus</td></tr>
          <tr><td style={td}>Pluto</td><td style={td}>Published periodic series</td><td style={dim}>Meeus, Astronomical Algorithms, ch. 37</td></tr>
          <tr><td style={td}>Chiron</td><td style={td}>Chebyshev fit of JPL Horizons</td><td style={dim}>NASA JPL small-body system (public domain)</td></tr>
          <tr><td style={td}>Nutation</td><td style={td}>IAU 1980 theory, 63 terms</td><td style={dim}>International Astronomical Union</td></tr>
          <tr><td style={td}>Precession</td><td style={td}>IAU 1976 / Meeus formulations</td><td style={dim}>Lieske et al.</td></tr>
          <tr><td style={td}>ΔT</td><td style={td}>IERS observed values + modern extrapolation</td><td style={dim}>International Earth Rotation Service</td></tr>
          <tr><td style={td}>Houses</td><td style={td}>Spherical trigonometry from first principles</td><td style={dim}>semi-arc definitions, closed-form angles</td></tr>
        </tbody>
      </table>
      <H2>the role Swiss Ephemeris does play</H2>
      <P>
        Test oracle. During development, every caelus position was compared
        against Swiss Ephemeris across two centuries of random instants — as a
        referee, never as a source. No Swiss Ephemeris code, data file, or
        derived coefficient ships in this package. The one temporary exception
        (an early Chiron fit sampled from its asteroid file while offline) was
        replaced by a direct JPL Horizons fit before release — and the two
        independent integrations agree to 0.85″ worst-case across 1900–2099,
        which is its own kind of confirmation.
      </P>
      <H2>what this buys you</H2>
      <P>
        MIT license, full stop. Ship caelus in closed-source products, SaaS,
        mobile apps, browser bundles, edge functions. No AGPL contagion, no
        commercial license to mail to Zurich, no ephemeris files to deploy.
        The engine plus its planetary data is ~85 KB gzipped and runs
        anywhere JavaScript runs — the same code in the browser, at the edge,
        and behind the <A href="https://www.npmjs.com/package/caelus-mcp">MCP server</A>.
      </P>
      <P dim>
        The numbers themselves — planetary theory coefficients, lunar series
        terms, IAU model constants — are scientific facts published for
        exactly this purpose. caelus&rsquo;s contribution is the
        implementation, the validation harness, and the packaging; that
        implementation is what the MIT license covers.{" "}
        <A href="/validation">How we know it&rsquo;s right →</A>
      </P>
    </main>
  );
}
