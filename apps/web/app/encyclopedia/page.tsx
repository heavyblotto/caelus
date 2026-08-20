import type { ReactElement } from "react";
import { listEntries, plateCount } from "../../lib/encyclopedia";
import EntryLink from "../../components/encyclopedia/EntryLink";

export const metadata = {
  title: "Encyclopedia of Hermes",
  description:
    "A reference work on the history, technique, and language of the Western esoteric traditions, with figures computed by the Caelus engine.",
};

export default function EncyclopediaHome(): ReactElement {
  const entries = listEntries();
  const plates = plateCount();
  return (
    <div>
      <section className="ency-hero">
        <span className="ency-label">ephemengine.com</span>
        <h1>Encyclopedia of Hermes</h1>
        <p className="ency-hero__sub">
          A reference work on the history, technique, and language of the
          Western esoteric traditions. Astrology is the engine-backed core
          division: its figures are computed, not drawn.
        </p>
        <form className="ency-lookup" action="/encyclopedia/index" method="get">
          <input
            type="search"
            name="q"
            placeholder="Look up an entry, a term, a person, a source"
            aria-label="Look up an entry"
          />
          <button type="submit">Look up</button>
        </form>
      </section>

      <div className="ency-stats">
        <div className="ency-stats__cell">
          <span className="ency-stats__n">{entries.length}</span>
          <span className="ency-stats__l ency-label">Entries</span>
        </div>
        <div className="ency-stats__cell">
          <span className="ency-stats__n">{plates}</span>
          <span className="ency-stats__l ency-label">Computed plates</span>
        </div>
      </div>

      <section aria-label="The entries">
        <ul className="ency-indexlist">
          {entries.map((e) => (
            <li key={e.slug}>
              <EntryLink slug={e.slug} title={e.title} gloss={e.gloss} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
