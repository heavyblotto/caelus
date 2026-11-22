import Link from "next/link";
import { A, H2, P, Code } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { formatGoldenChecks, formatWorstNanoProse } from "../../lib/facts";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Build Notes",
  description:
    "Postmortems on four bugs the validation suite caught: ΔT extrapolation, a node frame error, a double-counted Chiron light-time, and the geometry of the aspect search.",
  path: "/notes",
  type: "article",
});

export default function Notes() {
  return (
    <main className="container page">
      <PageHero eyebrow="Build Notes · Defect Postmortems" title="Build Notes">
        <P>
          Implementing VSOP87 takes only a few hundred lines of code and matched
          reference ephemerides immediately. The subtle bugs surfaced later in
          timescale conversions, coordinate frames, and search geometry. Spot
          checks on individual charts missed them, while sweeping thousands of
          test cases against Swiss Ephemeris and JPL Horizons exposed every one.
        </P>
      </PageHero>

      <H2>ΔT: textbook polynomials vs. post-2016 Earth rotation</H2>
      <P>
        Ephemerides compute positions in Terrestrial Time (TT), while civil
        timestamps follow Earth&apos;s rotation (UT); ΔT bridges the two. The
        widely copied{" "}
        <A href="https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html">
          Espenak–Meeus (2006) polynomials
        </A>{" "}
        assume steady tidal deceleration and predict ΔT &approx; 158 s by 2080.
        In reality, Earth&apos;s rotation began{" "}
        <A href="https://www.cbsnews.com/news/earth-spinning-faster-than-usual-shortest-day-ever/">
          speeding up around 2016
        </A>
        , holding observed ΔT near 69 s since 2020 with a slight downward
        trend. That puts the older polynomial curve roughly 6 s high today and
        nearly 90 s high by 2080. Because the Moon moves 0.55″ per second of
        ΔT error, extrapolating the old curve introduces tens of arcseconds of
        lunar error within a few decades. Caelus interpolates IERS measurements
        through 2025, projects the flat modern trend gradually back toward
        long-term tidal slowing, and avoids false precision given the{" "}
        <A href="https://www.ucolick.org/~sla/leapsecs/year2100.html">
          &plusmn;37 s uncertainty
        </A>{" "}
        (Huber 2006) on an 80-year ΔT forecast.
      </P>

      <H2>Node longitude: 11× frame sensitivity</H2>
      <P>
        The lunar nodes mark where the Moon&apos;s orbital plane crosses the
        ecliptic, and the ecliptic of date precesses at roughly 47″ per century.
        Because the lunar orbit is inclined by only 5.1°, any reference-plane
        mistake amplifies node longitude error by 1/sin(5.1°), or about 11×.
        Using J2000 instead of the ecliptic of date caused ~500″ of lunar node
        drift even though planetary longitudes barely showed a difference.
      </P>

      <H2>Chiron fit: double light-time correction</H2>
      <P>
        An early Chebyshev fit sampled JPL Horizons &ldquo;heliocentric&rdquo;
        states that already included Sun-to-body light-time (~6,900 seconds, or
        55,000 km of motion). When the geocentric reduction pipeline applied
        Earth-to-body light-time on top, the double subtraction produced a
        steady 9″ offset. Fitting pure geometric states and verifying Earth and
        Chiron vectors independently resolved the bias.
      </P>

      <H2>Aspect dates: missing ±90° quadrants</H2>
      <P>
        A code review caught that <Code>find_aspect_dates</Code> was only
        solving for +90° separations, missing half of all sextile, square, and
        trine occurrences. While the underlying ephemeris angles were exact, the
        MCP search wrapper filtered out negative signed separations. Testing
        against a seven-year Mars sextile benchmark confirmed that all nine hits
        matched the reference scan to the minute, including a retrograde triple
        pass.
      </P>

      <H2>Golden suite</H2>
      <P>
        Swiss Ephemeris validates the Python reference, and {formatGoldenChecks()}{" "}
        exported fixtures pin the TypeScript implementation with a maximum delta
        of {formatWorstNanoProse()}. CI runs both suites on every commit, which
        made it safe to develop the TypeScript port with AI coding agents
        because any mathematical regression failed the build immediately.
      </P>
      <P>
        See <A href="/how-it-was-built">How this was built</A> for more on the
        development workflow and validation safeguards.
      </P>

      <div className="row row--wrap">
        <Link href="/playground" className="btn btn-sm btn-secondary">Open Playground →</Link>
        <Link href="/validation" className="btn btn-sm btn-ghost">Validation</Link>
        <Link href="/provenance" className="btn btn-sm btn-ghost">Provenance</Link>
        <a href="https://github.com/heavyblotto/caelus" target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
          GitHub ↗
        </a>
      </div>

      <PageClose
        title="Try the engine"
        secondaryHref="/playground"
        secondaryLabel="Playground →"
      />
    </main>
  );
}
