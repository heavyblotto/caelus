import { A, Eyebrow, H2, P, Note } from "../../components/Prose";
import CaelusMark from "../../components/CaelusMark";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "How this was built",
  description:
    "Caelus was written almost entirely by AI coding agents, under human direction, with a validation harness as the backstop. How the process kept an AI-built engine trustworthy.",
  path: "/how-it-was-built",
});

export default function HowItWasBuilt() {
  return (
    <main className="container page">
      <Eyebrow>Process</Eyebrow>
      <h1>How this was built</h1>
      <P>
        Caelus was written almost entirely by AI coding agents. The Python
        reference, the TypeScript port, the tests, the website, and most of
        this prose came from agents working under human direction. That is
        worth stating openly, because the claim it invites is one this project
        has to answer: every number the engine produces is checked against two
        independent references, and a golden suite fails the build as soon as
        the code drifts away from them. An engine written by machines earns
        trust the same way any other does, through the checks it has to pass.
      </P>

      <H2>Reference-first, checked to the last digit</H2>
      <P>
        Every model landed in the Python reference first. That reference writes
        golden fixtures: positions and events at fixed instants, stored as JSON.
        The TypeScript engine is a port of the same math, and a conformance suite
        replays the fixtures against it on every commit, to the last digit the
        fixture records. A model is not shipped until the reference, its
        fixtures, and the port all agree. This is also what lets an agent work
        quickly, because a red suite identifies the exact moment a port stopped
        matching its reference.
      </P>

      <H2>Two oracles, not the author&apos;s word</H2>
      <P>
        Swiss Ephemeris 2.10 is the same-frame oracle over the modern era; JPL
        Horizons (DE441) is the independent reference, and the sole oracle over
        the 1000&ndash;3000 span where the built-in Swiss theories drift. The
        per-body bounds are published on <A href="/validation">Validation</A>,
        and the methodology behind them on <A href="/methods">Methods</A>. For
        an engine written by a machine, the evidence has to come from the
        oracles rather than from the author, which is the standard a
        human-written engine should be held to as well.
      </P>

      <H2>Direction stayed human</H2>
      <P>
        The agents wrote the code, and a person chose what shipped. Work lands
        on a development branch and is promoted to the main branch by hand, so
        someone signs off before anything reaches users. Dead ends were
        reverted rather than shipped. When a heavier lunar data pack broke the
        browser bundle and lost accuracy against the reference, the work went
        back to the existing fit, which was already sitting at the reference
        floor. What the agents supplied was speed, and the judgment about what
        was correct and what belonged in the project stayed with a person.
      </P>

      <H2>The prose has the same gate</H2>
      <P>
        Prose written by an agent has its own tells, so the repository runs a
        prose linter against the site copy and the docs. Its rule set covers
        the em-dash used as a connective, the three-verb drumroll, the
        manufactured conclusion, the closing pleasantry, and the clipped
        verbless fragment that agents reach for when they are trying to sound
        authoritative. A violation fails continuous integration the way a
        failing test does, and this page is checked by the same gate as the
        rest of the site.
      </P>

      <Note>
        None of this removes the human. It moves the human from typing to
        directing and reviewing, and it leans on a test harness and two ephemeris
        oracles to catch what review alone would miss.
      </Note>

      <H2>Why the name Caelus?</H2>
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap", margin: "1rem 0" }}>
        <figure style={{ margin: 0, flex: "none", textAlign: "center", color: "var(--accent)" }}>
          <CaelusMark size={132} />
          <figcaption className="dim small" style={{ marginTop: "0.4rem", maxWidth: 150 }}>
            An original drawing, after the Carnuntum altar.
          </figcaption>
        </figure>
        <div style={{ flex: "1 1 18rem" }}>
          <P>
            Caelus is the Roman god of the sky, the personification of the heavens.
            Roman art shows him as a bearded figure holding his cloak in a
            billowing arch above his head, a gesture called <em>velificatio</em>{" "}
            that signals the vault of the firmament. The face here is drawn from one
            such figure on a third-century altar from Carnuntum, where Caelus
            kneels beneath the four seasons and their winds. The name suited an
            engine whose whole task is to compute the positions on that vault.
          </P>
        </div>
      </div>

      <P dim>
        <A href="/validation">Validation tables &rarr;</A>{" "}
        <A href="/methods">Methods &rarr;</A>{" "}
        <A href="/notes">Build Notes &rarr;</A>{" "}
        <A href="https://github.com/heavyblotto/caelus">Source &rarr;</A>
      </P>
    </main>
  );
}
