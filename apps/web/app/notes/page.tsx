import { A, H2, P, Nav } from "../../components/Prose";

export const metadata = {
  title: "caelus — build notes",
  description: "Build notes: ΔT extrapolation, node frame sensitivity, Chiron light-time double-count, aspect-search geometry.",
};

export default function Notes() {
  return (
    <main>
      <Nav current="/notes" />
      <h1 style={{ letterSpacing: "0.05em" }}>build notes</h1>
      <P>
        The orbital mechanics were never the hard part. Reading the VSOP87
        theory and evaluating its series is a few hundred lines; it matched
        professional ephemerides to the arcsecond on the first run. Every
        real bug lived somewhere subtler — in timescales, reference frames,
        and geometry. These notes exist because each bug was invisible to
        eyeballing, visible to the conformance suite.
      </P>

      <H2>the ΔT trap: Earth changed and the textbooks didn&rsquo;t</H2>
      <P>
        Ephemerides run on uniform atomic-style time (TT); civil time follows
        Earth&rsquo;s slightly irregular rotation. The difference, ΔT, must be
        modeled — and the standard reference polynomials (Espenak–Meeus 2006),
        copied faithfully across decades of software, predict Earth&rsquo;s
        spin steadily slowing. Around 2016, Earth instead <em>sped up</em>.
        By 2080 the textbook extrapolation overshoots by over 70 seconds —
        and the Moon moves 0.55″ per second of ΔT error, so a &ldquo;correct&rdquo;
        implementation of the published formula yields Moon positions tens of
        arcseconds wrong for dates people compute every day. caelus uses
        observed IERS values through 2025 with a modern extrapolation. The
        lesson generalizes: in this domain the danger isn&rsquo;t exotic math,
        it&rsquo;s confidently citing a reference that reality has since
        amended.
      </P>

      <H2>the 11× node amplifier</H2>
      <P>
        The lunar nodes — widely used in chart work — are where the
        Moon&rsquo;s orbital plane crosses the ecliptic. But <em>which</em>
        ecliptic? The ecliptic plane itself drifts about 47″ per century, and
        because the Moon&rsquo;s orbit is inclined only 5.1°, any error in the
        reference plane is amplified by 1/sin(5.1°) ≈ 11× in node longitude.
        Computing the node against the J2000 ecliptic instead of the ecliptic
        of date produced errors near 500″ — half the width of the Moon — from
        a frame choice that shifts every <em>planet&rsquo;s</em> position by
        almost nothing. Shallow inclinations are error amplifiers; the node is
        the most sensitive quantity in the whole system.
      </P>

      <H2>the 55,000 km that wasn&rsquo;t there</H2>
      <P>
        Chiron&rsquo;s coefficients are fit by sampling a high-precision
        source. The first fit was silently poisoned: the source API returned
        &ldquo;heliocentric&rdquo; positions with Sun→body light-time already
        applied — Chiron as the Sun <em>sees</em> it, displaced by ~6,900
        seconds of orbital motion, about 55,000 km. Our pipeline then applied
        Earth→body light-time on top: double-counted, a steady 9″ error that
        no single position check would flag as absurd. The staged diagnosis —
        validate the fit, then the Earth vector, then assemble geocentric
        positions from the oracle&rsquo;s own parts — isolated it in three
        steps. Always fit <em>geometric</em> states. Read an ephemeris API&rsquo;s
        frame docs before sampling.
      </P>

      <H2>a square has two sides</H2>
      <P>
        Found in external code review, not by the suite: the aspect-date
        search (&ldquo;when does Saturn square my natal Moon?&rdquo;)
        root-found separations of +90° but not −90°, silently dropping half of
        all sextile, square, and trine events. The engine beneath it was
        flawless — the bug was in the question being asked of it, a layer the
        engine&rsquo;s conformance suite structurally cannot see. The fix
        came with its own oracle test: seven years of Mars sextiles verified
        hit-for-hit against an independent scan, agreeing to the minute on
        all nine events including a retrograde triple-pass.
      </P>

      <H2>the test suite</H2>
      <P>
        Each bug above was caught by a measurable contract, not inspection.
        Swiss Ephemeris comparison checks the reference engine; 1,438 golden
        fixtures pin the TypeScript port at nano-arcsecond tolerance; CI
        re-runs the chain on every commit. The TS port was largely delegated
        to coding agents with one criterion — <em>the suite stays green</em> —
        and matched the reference to 1.6 nano-arcseconds. Contributions
        (human or agent) ship when the suite passes.
      </P>

      <P dim>
        The engine these notes produced runs in your browser{" "}
        <A href="/">on the playground</A> — ~85 KB, ~2 ms per chart.
        Sources and methodology: <A href="/provenance">provenance</A> ·{" "}
        <A href="/validation">validation</A> ·{" "}
        <A href="https://github.com/heavyblotto/caelus">github</A>.
      </P>
    </main>
  );
}
