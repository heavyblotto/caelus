import Link from "next/link";
import { A, H2, P } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { SITE, formatHouseSystemsProse } from "../../lib/site";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Provenance",
  description:
    "Sources for Caelus's ephemeris coefficients, how the MIT license avoids Swiss Ephemeris AGPL obligations, and how Caelus compares to other JavaScript and Python libraries.",
  path: "/provenance",
});

const FIELD: Array<[string, string, string, string, string]> = [
  ["Swiss Ephemeris (sweph, WASM ports)", "https://www.astro.com/swisseph/swephinfo_e.htm",
    "AGPL-3.0 / 700 CHF", "0.001″",
    "houses, Chiron, nodes; native Node or 250 KB–1.7 MB WASM, plus data files"],
  ["astronomy-engine", "https://github.com/cosinekitty/astronomy",
    "MIT", "±60″",
    "no houses, Chiron, or nodes; 41 KB gz, browser and edge"],
  ["astronomia", "https://www.npmjs.com/package/astronomia",
    "MIT", "sub-arcsecond planets",
    "no astrology layer; 48 KB gz plus VSOP data"],
  ["ephemeris (Moshier port)", "https://www.npmjs.com/package/ephemeris",
    "GPL-3.0", "<0.1″ planets, ~3″ Moon",
    "no houses; 235 KB minified, stale since ~2020"],
  ["celestine", "https://github.com/Anonyfox/celestine",
    "MIT", "sub-arcsecond (claimed)",
    "houses (7 systems), Chiron, nodes; 59 KB gz, v0.2.x since Jan 2026"],
  ["Skyfield", "https://rhodesmill.org/skyfield/",
    "MIT", "milliarcsecond (JPL)",
    "no astrology layer; Python only, 32 MB–3.1 GB BSP files"],
];

const SOURCES: Array<[string, string, React.ReactNode]> = [
  ["Planets", "VSOP87D analytical theory", "Bretagnon & Francou, 1988, Bureau des Longitudes"],
  ["Moon", "Chebyshev fit of JPL DE423 (2010)", "NASA JPL (public domain); differs from DE440 by <0.1″ here; re-fit planned"],
  ["Moon (embedded)", "ELP2000-82 abridged series", "Chapront-Touzé & Chapront, as published in Meeus ch. 47"],
  ["Pluto", "Published periodic series and Horizons barycenter pack", "Meeus, Astronomical Algorithms, ch. 37; JPL Horizons DE441 pack"],
  ["Chiron", "Chebyshev fit of JPL Horizons", "NASA JPL small-body system (public domain); raw Horizons samples committed in-repo"],
  ["Nutation", "IAU 1980 theory, 63-term abridged table", "Meeus ch. 22; terms ≥ 0.0003″ of the 106-term series"],
  ["Precession", "IAU 1976 / Vondrák 2011 formulations", "Lieske et al.; Vondrák, Capitaine & Wallace (2011)"],
  ["ΔT", "IERS observed values; spline and tidal forecast", <>International Earth Rotation Service; see <A href="/notes">Build Notes</A></>],
  ["Houses", "Spherical trigonometry from first principles", "semi-arc definitions, closed-form angles"],
];

export default function Provenance() {
  return (
    <main className="container page">
      <PageHero eyebrow="Provenance · Ephemeris Sources & MIT License" title="Sources and licensing">
        <P>
          Caelus is implemented from published astronomical literature and
          public-domain NASA/JPL ephemerides under the MIT license, with no
          Swiss Ephemeris code, no AGPL copyleft obligations, and no external
          ephemeris files required at runtime.
        </P>
      </PageHero>

      <H2>Why independent sources matter</H2>
      <P>
        Most astrology software computes positions with{" "}
        <A href="https://www.astro.com/swisseph/swephinfo_e.htm">Swiss Ephemeris</A>.
        Since v2.10.1 (June 2021) it is AGPL-3.0, dual-licensed at{" "}
        <A href="https://www.astro.com/swisseph/swephprice_e.htm">700 CHF</A> for
        closed source.{" "}
        <A href="https://groups.io/g/swisseph/topic/change_of_license_from_gpl_to/82255295">
          Astrodienst&apos;s stated position
        </A>{" "}
        is that an application serving its results over a network must
        open-source the complete stack or buy the license. Open-source astrology
        libraries (kerykeion, immanuel, flatlib) sit on it and inherit those
        terms. Most commercial astrology APIs do not say what engine they run.
      </P>

      <H2>Astronomical sources</H2>
      <P>
        Every coefficient table and reduction formula in Caelus traces directly
        to published astronomical literature or public-domain NASA/JPL data:
      </P>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table table-auto">
          <thead>
            <tr><th>Component</th><th>Model</th><th>Reference</th></tr>
          </thead>
          <tbody>
            {SOURCES.map(([what, src, cite], i) => (
              <tr key={i}>
                <td>{what}</td>
                <td>{src}</td>
                <td className="dim">{cite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Other engines</H2>
      <P>
        The table below compares Caelus with the most common TypeScript,
        JavaScript, and Python ephemeris libraries. Specifications were reviewed
        between February and June 2026, using published gzipped bundle sizes
        where available.
      </P>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table table-auto">
          <thead>
            <tr><th>Engine</th><th>License</th><th>Accuracy</th><th>Coverage and runtime</th></tr>
          </thead>
          <tbody>
            {FIELD.map(([name, href, lic, acc, cov]) => (
              <tr key={name}>
                <td><A href={href}>{name}</A></td>
                <td>{lic}</td>
                <td>{acc}</td>
                <td className="dim">{cov}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P dim>
        Among MIT-licensed JavaScript libraries, celestine (v0.2.1, January
        2026) is the closest match because it also calculates houses, Chiron,
        and lunar nodes without external data files. Caelus differs by
        publishing full per-body error tables on <A href="/validation">Validation</A>,
        providing an MCP server and edge API, and supporting{" "}
        {formatHouseSystemsProse()} house systems compared to celestine&apos;s seven.
      </P>

      <H2>Swiss Ephemeris as a test benchmark</H2>
      <P>
        During development and CI, Caelus longitudes are compared against Swiss
        Ephemeris 2.10 across 1000–3000, but no Swiss Ephemeris code or
        coefficients are included in the distributed packages. While an early
        prototype sampled Chiron from the Swiss asteroid file, the released fit
        comes directly from JPL Horizons; the two integrations agree within
        0.85″ in the worst case across 1900–2099.
      </P>

      <H2>License and client-side privacy</H2>
      <P>
        Caelus is MIT licensed, so you can ship it in commercial SaaS, mobile,
        browser, and edge applications without AGPL obligations or external
        ephemeris files. The engine plus embedded ephemeris data measures ~153 KB
        gzipped and powers client-side charts, the edge API, and the{" "}
        <A href="https://www.npmjs.com/package/caelus-mcp">MCP Server</A>.
      </P>
      <P>
        Because the entire library runs in the browser, applications can compute
        charts locally on the user&apos;s device without transmitting birth times
        or coordinates to a server. The <A href={SITE.starter}>caelus-starter</A>{" "}
        template uses this architecture to reduce backend storage and GDPR
        compliance scope, whereas stacks built on Swiss Ephemeris require AGPL
        disclosure or commercial licensing once results are served over a
        network and rely on large ephemeris files on disk.
      </P>
      <div className="row row--wrap">
        <Link href="/validation" className="btn btn-sm btn-secondary">Validation tables →</Link>
        <Link href="/methods" className="btn btn-sm btn-ghost">Methods</Link>
        <Link href="/docs/data-tiers" className="btn btn-sm btn-ghost">Data Tiers</Link>
      </div>

      <PageClose
        title="Build without AGPL restrictions"
        secondaryHref="/docs/quickstart"
        secondaryLabel="Quickstart →"
      />
    </main>
  );
}
