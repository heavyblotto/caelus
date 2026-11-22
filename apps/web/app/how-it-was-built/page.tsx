import Link from "next/link";
import { A, H2, P, Note } from "../../components/Prose";
import CaelusMark from "../../components/CaelusMark";
import PageClose from "../../components/PageClose";
import PageHero from "../../components/PageHero";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "How this was built",
  description:
    "How Caelus was built using AI coding agents under human review, backed by a Python reference implementation and automated ephemeris benchmarks.",
  path: "/how-it-was-built",
});

export default function HowItWasBuilt() {
  return (
    <main className="container page">
      <PageHero eyebrow="Process · Engineering Workflow" title="How this was built">
        <P>
          Most of Caelus (the Python reference engine, TypeScript library, tests,
          documentation, and website) was implemented with AI coding agents
          under human direction and review. Because astronomical computation
          demands strict numerical correctness, every calculation is checked
          against independent ephemerides, and CI fails the build if the
          TypeScript code diverges from the Python reference.
        </P>
      </PageHero>

      <H2>Reference-first verification</H2>
      <P>
        Each astronomical model is built in the Python reference first and
        verified against published benchmarks. That reference exports JSON
        golden fixtures for planetary positions and events at fixed timestamps,
        which CI replays against the TypeScript engine on every commit. Matching
        the reference down to IEEE floating-point precision ensures ports cannot
        introduce silent rounding or sign errors.
      </P>

      <H2>Independent ephemeris benchmarks</H2>
      <P>
        Swiss Ephemeris 2.10 verifies modern-era apparent ecliptic coordinates,
        while JPL Horizons (DE441) provides an independent equatorial benchmark
        spanning AD 1000&ndash;3000. All per-body maximum and RMS errors are
        measured directly from those comparisons and published on{" "}
        <A href="/validation">Validation</A>, with full details on{" "}
        <A href="/methods">Methods</A>.
      </P>

      <H2>Human review and scope control</H2>
      <P>
        While agents wrote most of the code and tests, architectural decisions,
        benchmark targets, and release merges stayed under human review. Approaches
        that regressed accuracy or bloated the browser bundle were reverted. For
        example, an experimental lunar data pack increased bundle size while
        degrading reference accuracy, so it was dropped in favor of the
        existing DE423 Chebyshev fit.
      </P>

      <H2>Documentation and claim checks</H2>
      <P>
        Automated checks also cover the documentation: CI runs a claims registry
        linter that cross-checks bundle sizes, supported counts, and accuracy
        figures against generated build artifacts, executes runnable MDX code
        examples against the compiled library, and runs Vale prose checks across
        docs and website copy.
      </P>

      <Note>
        Human ownership shifts from writing boilerplate by hand to designing the
        interfaces, auditing edge cases, and relying on strict automated
        benchmarks to catch subtle regressions.
      </Note>

      <H2>Why the name Caelus?</H2>
      <div className="row row--wrap">
        <figure className="card">
          <div style={{ color: "var(--accent)", textAlign: "center" }}>
            <CaelusMark size={132} />
          </div>
          <figcaption className="dim small">
            An original drawing based on the Carnuntum altar.
          </figcaption>
        </figure>
        <div style={{ flex: "1 1 18rem" }}>
          <P>
            Caelus is the Roman god of the sky, representing the vault of the
            heavens. Roman reliefs depict him holding his cloak in an arch above
            his head, a gesture known as <em>velificatio</em>. The emblem above
            is drawn from a third-century altar at Carnuntum showing Caelus
            beneath the four seasons, fitting for a library dedicated to
            computing positions on the celestial sphere.
          </P>
        </div>
      </div>

      <div className="row row--wrap">
        <Link href="/validation" className="btn btn-sm btn-secondary">Validation tables →</Link>
        <Link href="/methods" className="btn btn-sm btn-ghost">Methods</Link>
        <Link href="/notes" className="btn btn-sm btn-ghost">Build Notes</Link>
        <a href="https://github.com/heavyblotto/caelus" target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
          Source ↗
        </a>
      </div>

      <PageClose
        title="Inspect the source and tests"
        secondaryHref="/validation"
        secondaryLabel="Validation →"
      />
    </main>
  );
}
