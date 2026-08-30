import type { ReactNode } from "react";
import { A } from "./Prose";
import { formatMcpToolsProse, SITE } from "../lib/site";

const MCP_TOOLS_PROSE = formatMcpToolsProse();

/**
 * Each item carries the display answer (with links) and a plain-text twin for
 * the FAQPage structured data. They must stay in sync; the schema text mirrors
 * what a visitor reads, which is what Google expects for rich results.
 */
type QA = { q: string; a: ReactNode; text: string };

const ITEMS: QA[] = [
  {
    q: "Is Caelus free to use in commercial projects?",
    a: (
      <>
        Yes. The published packages (`caelus`, `caelus-mcp`, `caelus-birth`,
        `caelus-wheel`, and `caelus-delineations-pd`) are{" "}
        <A href={`${SITE.repo}/blob/main/LICENSE`}>MIT licensed</A>, with no Swiss
        Ephemeris dependency and no AGPL obligations, so you can ship them in
        closed-source and commercial apps. The four lockstep packages version
        together; `caelus-delineations-pd` ships on its own semver.
      </>
    ),
    text:
      "Yes. The published packages (caelus, caelus-mcp, caelus-birth, caelus-wheel, and caelus-delineations-pd) are MIT licensed, with no Swiss Ephemeris dependency and no AGPL obligations, so you can ship them in closed-source and commercial apps. The four lockstep packages version together; caelus-delineations-pd ships on its own semver.",
  },
  {
    q: "How accurate is it?",
    a: (
      <>
        Every body's deviation from a reference ephemeris is measured and
        published, then replayed against thousands of golden checks in CI. The
        full tables are on the <A href="/validation">Validation</A> page.
      </>
    ),
    text:
      "Every body's deviation from a reference ephemeris is measured and published, then replayed against thousands of golden checks in CI. The full tables are on the Validation page.",
  },
  {
    q: "Do I need Swiss Ephemeris or ephemeris files?",
    a: (
      <>
        No. The planetary data is embedded in the package, so there are no files
        to download or deploy. See <A href="/docs/data-tiers">Data Tiers</A> for
        what ships in the bundle.
      </>
    ),
    text:
      "No. The planetary data is embedded in the package, so there are no files to download or deploy.",
  },
  {
    q: "What date range does it cover?",
    a: (
      <>
        The planets, Pluto, and the Moon are validated for the years
        1000&ndash;3000, and the small bodies (asteroids and Chiron) for
        1600&ndash;2484. A body outside its fitted range is omitted from the
        chart and listed under its <code>unavailable</code> field rather than
        guessed. See <A href="/docs/edge-cases">Edge Cases</A>.
      </>
    ),
    text:
      "The planets, Pluto, and the Moon are validated for the years 1000-3000, and the small bodies (asteroids and Chiron) for 1600-2484. A body outside its fitted range is omitted from the chart and listed under its unavailable field rather than guessed.",
  },
  {
    q: "Does it support Vedic astrology, or only Western?",
    a: (
      <>
        Both. Alongside the Western chart it computes nakshatras, the Vimshottari,
        Yogini, and Ashtottari dashas, the divisional charts (vargas), and the
        yogas. See <A href="/docs/vedic">Vedic &amp; Jyotish</A>.
      </>
    ),
    text:
      "Both. Alongside the Western chart it computes nakshatras, the Vimshottari, Yogini, and Ashtottari dashas, the divisional charts (vargas), and the yogas.",
  },
  {
    q: "Can charts be computed without sending birth data to a server?",
    a: (
      <>
        Yes. The engine does no I/O and runs in the browser, so an app can compute
        a chart entirely on the client and never transmit birth data. Try the{" "}
        <A href="/playground">Playground</A>; details on{" "}
        <A href="/privacy">Privacy</A>.
      </>
    ),
    text:
      "Yes. The engine does no I/O and runs in the browser, so an app can compute a chart entirely on the client and never transmit birth data.",
  },
  {
    q: "Can I use it with AI assistants like Claude or Cursor?",
    a: (
      <>
        Yes. <code>caelus-mcp</code> exposes {MCP_TOOLS_PROSE} chart tools over the Model
        Context Protocol, available hosted or as a local stdio server. See{" "}
        <A href="/docs/mcp">MCP Setup</A>.
      </>
    ),
    text:
      `Yes. The caelus-mcp package exposes ${MCP_TOOLS_PROSE} chart tools over the Model Context Protocol, available hosted or as a local stdio server.`,
  },
  {
    q: "Does it interpret a chart, or just compute it?",
    a: (
      <>
        The engine computes, and the interpretation is left to you. It stops at
        validated geometry and ships no delineation text of its own. For
        generated readings there is an{" "}
        <A href="/docs/interpretation">interpretation layer</A>, which projects
        a chart into ranked, citable fact atoms that a rule corpus or an LLM can
        consume, and audits the citations afterwards so a generated reading
        stays tied to the chart it came from.
      </>
    ),
    text:
      "The engine computes, and the interpretation is left to you. It stops at validated geometry and ships no delineation text of its own. For generated readings there is an interpretation layer, which projects a chart into ranked, citable fact atoms that a rule corpus or an LLM can consume, and audits the citations afterwards so a generated reading stays tied to the chart it came from.",
  },
  {
    q: "Can it chart a forecast, a fictional character, or an archetype?",
    a: (
      <>
        Yes. The{" "}
        <A href="/docs/provenance">provenance layer</A> declares what the chart
        is (<code>Realm</code>) and how its time and place are known.{" "}
        <code>realize()</code> routes to the ephemeris or the geometric compiler,
        and passes certainty into the{" "}
        <A href="/docs/interpretation">interpretation layer</A> so a forecast
        reads as provisional and an inexact birth time down-weights the Moon
        and angles.
      </>
    ),
    text:
      "Yes. The provenance layer declares what the chart is (Realm) and how its time and place are known. realize() routes to the ephemeris or the geometric compiler, and passes certainty into the interpretation layer so a forecast reads as provisional and an inexact birth time down-weights the Moon and angles.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ITEMS.map(({ q, text }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text },
  })),
};

export default function FAQ() {
  return (
    <section aria-labelledby="faq-heading" style={{ marginTop: "2.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h2 id="faq-heading">Frequently asked questions</h2>
      <div className="faq">
        {ITEMS.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <div>{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
