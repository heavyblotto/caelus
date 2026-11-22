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
        Yes. All published packages (<code>caelus</code>, <code>caelus-mcp</code>,{" "}
        <code>caelus-birth</code>, <code>caelus-wheel</code>, and{" "}
        <code>caelus-delineations-pd</code>) are{" "}
        <A href={`${SITE.repo}/blob/main/LICENSE`}>MIT licensed</A> with no Swiss
        Ephemeris dependency and no AGPL restrictions, so you can ship them in
        commercial or closed-source products. The four core packages share lockstep
        versions, while <code>caelus-delineations-pd</code> follows its own semver.
      </>
    ),
    text:
      "Yes. All published packages (caelus, caelus-mcp, caelus-birth, caelus-wheel, and caelus-delineations-pd) are MIT licensed with no Swiss Ephemeris dependency and no AGPL restrictions, so you can ship them in commercial or closed-source products. The four core packages share lockstep versions, while caelus-delineations-pd follows its own semver.",
  },
  {
    q: "How accurate is it?",
    a: (
      <>
        Every planetary position is benchmarked against JPL Horizons and Swiss
        Ephemeris, and verified in CI against thousands of golden test cases. You
        can inspect the full accuracy tables and methodology on the{" "}
        <A href="/validation">Validation</A> page.
      </>
    ),
    text:
      "Every planetary position is benchmarked against JPL Horizons and Swiss Ephemeris, and verified in CI against thousands of golden test cases. You can inspect the full accuracy tables and methodology on the Validation page.",
  },
  {
    q: "Do I need Swiss Ephemeris or ephemeris files?",
    a: (
      <>
        No. Ephemeris coefficients are bundled directly in the package, so there are
        no separate binary files to download or configure at runtime. See{" "}
        <A href="/docs/data-tiers">Data Tiers</A> for bundle details and extended
        date-range packs.
      </>
    ),
    text:
      "No. Ephemeris coefficients are bundled directly in the package, so there are no separate binary files to download or configure at runtime.",
  },
  {
    q: "What date range does it cover?",
    a: (
      <>
        The standard ephemeris tier validates the Sun, Moon, major planets, and
        Pluto across AD 1000&ndash;3000, and major asteroids plus Chiron across
        1600&ndash;2484. If you query a body outside its valid range, Caelus omits it
        from <code>bodies</code> and records the reason in{" "}
        <code>unavailable</code> instead of extrapolating unreliable coordinates. See{" "}
        <A href="/docs/edge-cases">Edge Cases</A> or{" "}
        <A href="/docs/deep-time">Deep Time</A> for the 3000 BC&ndash;AD 3000 pack.
      </>
    ),
    text:
      "The standard ephemeris tier validates the Sun, Moon, major planets, and Pluto across AD 1000-3000, and major asteroids plus Chiron across 1600-2484. If you query a body outside its valid range, Caelus omits it from bodies and records the reason in unavailable instead of extrapolating unreliable coordinates.",
  },
  {
    q: "Does it support Vedic astrology, or only Western?",
    a: (
      <>
        It supports both. Alongside Western tropical charts, Caelus calculates
        nakshatras, Vimshottari, Yogini, and Ashtottari dashas, divisional charts
        (vargas), Ashtakavarga, and classical yogas. See{" "}
        <A href="/docs/vedic">Vedic &amp; Jyotish</A>.
      </>
    ),
    text:
      "It supports both. Alongside Western tropical charts, Caelus calculates nakshatras, Vimshottari, Yogini, and Ashtottari dashas, divisional charts (vargas), Ashtakavarga, and classical yogas.",
  },
  {
    q: "Can charts be computed without sending birth data to a server?",
    a: (
      <>
        Yes. The engine has zero network or filesystem dependencies, so your app can
        calculate charts entirely client-side without transmitting birth details to a
        backend. You can test client-side execution in the{" "}
        <A href="/playground">Playground</A> or read more on{" "}
        <A href="/privacy">Privacy</A>.
      </>
    ),
    text:
      "Yes. The engine has zero network or filesystem dependencies, so your app can calculate charts entirely client-side without transmitting birth details to a backend.",
  },
  {
    q: "Can I use it with AI assistants like Claude or Cursor?",
    a: (
      <>
        Yes. The <code>caelus-mcp</code> package provides {MCP_TOOLS_PROSE} chart
        tools over the Model Context Protocol, available both as a hosted endpoint
        and as a local stdio server. See <A href="/docs/mcp">MCP Setup</A>.
      </>
    ),
    text:
      `Yes. The caelus-mcp package provides ${MCP_TOOLS_PROSE} chart tools over the Model Context Protocol, available both as a hosted endpoint and as a local stdio server.`,
  },
  {
    q: "Does it interpret a chart, or just compute it?",
    a: (
      <>
        By default, Caelus computes astronomical positions, houses, and aspects
        without embedding opinionated delineation text. When you need structured
        interpretations, the optional{" "}
        <A href="/docs/interpretation">interpretation layer</A> extracts typed chart
        facts that you can match against a rule corpus or pass to an LLM with
        citation auditing so generated readings trace back to verified placements.
      </>
    ),
    text:
      "By default, Caelus computes astronomical positions, houses, and aspects without embedding opinionated delineation text. When you need structured interpretations, the optional interpretation layer extracts typed chart facts that you can match against a rule corpus or pass to an LLM with citation auditing so generated readings trace back to verified placements.",
  },
  {
    q: "Can it chart a forecast, a fictional character, or an archetype?",
    a: (
      <>
        Yes. Through the <A href="/docs/provenance">provenance layer</A>, you can
        declare a chart&rsquo;s context (<code>Realm</code>) along with the precision
        of its date, time, and location. Calling <code>realize()</code> routes the
        request to either the ephemeris or the synthetic chart compiler and forwards
        those precision flags to the{" "}
        <A href="/docs/interpretation">interpretation layer</A>, ensuring forecasts
        are appropriately qualified and uncertain birth times down-weight angles and
        the Moon.
      </>
    ),
    text:
      "Yes. Through the provenance layer, you can declare a chart's context (Realm) along with the precision of its date, time, and location. Calling realize() routes the request to either the ephemeris or the synthetic chart compiler and forwards those precision flags to the interpretation layer, ensuring forecasts are appropriately qualified and uncertain birth times down-weight angles and the Moon.",
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="band">
        <h2 id="faq-heading">Frequently asked questions</h2>
      </div>
      <section className="tile s12" aria-labelledby="faq-heading">
        <div className="faq">
          {ITEMS.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <div>{a}</div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
