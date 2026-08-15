import { A, H2, P, Code } from "../../components/Prose";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { formatGoldenChecks, formatWorstNanoProse } from "../../lib/facts";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Build Notes",
  description: "Postmortems on four bugs the validation suite caught: ΔT extrapolation, a node frame error, a double-counted Chiron light-time, and the geometry of the aspect search.",
  path: "/notes",
  type: "article",
});

export default function Notes() {
  return (
    <main className="container page">
      <PageHero eyebrow="Build Notes" title="Build Notes">
        <P>
          Evaluating VSOP87 takes a few hundred lines, and it matched
          professional ephemerides on the first pass. The bugs worth writing up
          were all elsewhere, in the handling of timescales, reference frames,
          and geometry. None of them showed up in a spot check of a single
          chart, and all of them showed up once the golden suite compared
          thousands of values against a reference.
        </P>
      </PageHero>

      <H2>ΔT: textbook extrapolation vs Earth since 2016</H2>
      <P>
        Ephemerides are computed in TT, while civil time follows the rotation
        of the Earth, and ΔT is the quantity that bridges the two. The{" "}
        <A href="https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html">
          Espenak–Meeus (2006) polynomials
        </A>, copied into decades of software, assume Earth&apos;s spin keeps
        slowing: they predict ΔT ≈ 158 s for 2080. Earth&apos;s rotation began{" "}
        <A href="https://www.cbsnews.com/news/earth-spinning-faster-than-usual-shortest-day-ever/">
          accelerating around 2016
        </A>; observed ΔT has sat near 69 s since 2020 and is drifting down. The
        textbook curve is already ~6 s high today and runs ~90 s high by 2080.
        The Moon moves 0.55″ per second of ΔT error, so a faithful
        implementation of the old formula misses the Moon by tens of arcseconds
        within a lifetime. Caelus interpolates IERS observations through 2025,
        continues the observed near-flat trend, and rejoins the slow tidal
        rise decades out: an 80-year ΔT forecast carries roughly{" "}
        <A href="https://www.ucolick.org/~sla/leapsecs/year2100.html">
          ±37 s of uncertainty
        </A>{" "}
        (Huber 2006), so a steeper slope would be false precision.
      </P>

      <H2>Node longitude: 11× frame sensitivity</H2>
      <P>
        The lunar nodes mark where the Moon&apos;s plane crosses the ecliptic,
        and the ecliptic of date drifts by about 47″ per century. Because the
        Moon is inclined by only 5.1°, an error in the reference plane is
        amplified in node longitude by a factor of 1/sin(5.1°), or roughly 11.
        Using J2000 in place of the ecliptic of date produced about 500″ of
        node error at a point where the planetary longitudes had barely moved
        at all.
      </P>

      <H2>Chiron fit: double light-time</H2>
      <P>
        The first Chebyshev fit sampled the Horizons
        &ldquo;heliocentric&rdquo; positions, which already include the
        Sun-to-body light-time, worth about 6,900 seconds of motion or 55,000
        km. The pipeline then applied the Earth-to-body light-time on top of
        that, and the double count showed up as a steady bias of about 9″. The
        fix was to fit geometric states instead, and to validate the fit and
        the Earth vector separately before assembling geocentric positions from
        the oracle&apos;s own parts.
      </P>

      <H2>Aspect dates: ±90° geometry</H2>
      <P>
        A code review found that <Code>find_aspect_dates</Code> was root-finding
        only the +90° separations, which dropped half of the sextile, square,
        and trine hits. The engine was computing correctly here; the bug lived
        in the MCP search layer above it. The fix was checked against a
        seven-year Mars sextile oracle, where all nine hits matched an
        independent scan to the minute, including a retrograde triple pass.
      </P>

      <H2>Golden suite</H2>
      <P>
        Swiss Ephemeris checks the Python reference, and {formatGoldenChecks()}{" "}
        fixtures pin the TypeScript port to it, with a worst recorded delta of{" "}
        {formatWorstNanoProse()}. CI runs both suites on every commit. The
        TypeScript port was written mostly by agents, and the condition it had
        to meet was that the suite stayed green.
      </P>
      <P>
        The fuller account of an engine written mostly by agents, and what kept
        it honest, is on <A href="/how-it-was-built">How this was built</A>.
      </P>
      <P dim>
        Playground: <A href="/playground">/playground</A>.{" "}
        <A href="/provenance">Provenance</A> · <A href="/validation">Validation</A> ·{" "}
        <A href="https://github.com/heavyblotto/caelus">GitHub</A>.
      </P>

      <PageClose
        title="Try the engine"
        secondaryHref="/playground"
        secondaryLabel="Playground →"
      />
    </main>
  );
}
