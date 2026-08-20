import type { ReactElement } from "react";
import { listEntries, type EntryMeta } from "../../../lib/encyclopedia";
import EntryLink from "../../../components/encyclopedia/EntryLink";

export const metadata = {
  title: "Index of entries",
  description:
    "Every entry in the Encyclopedia of Hermes in one alphabetical sequence.",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function letterOf(entry: EntryMeta): string {
  const c = entry.title.charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default async function EncyclopediaIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<ReactElement> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const all = listEntries();
  const entries = query
    ? all.filter((e) =>
        `${e.title} ${e.gloss}`.toLowerCase().includes(query.toLowerCase()),
      )
    : all;
  const live = new Set(entries.map(letterOf));

  return (
    <div className="ency-measure">
      <h1 className="ency-page-title">Index of entries</h1>
      <p>
        {query
          ? `${entries.length} result${entries.length === 1 ? "" : "s"} for “${query}”.`
          : `All ${entries.length} entries in one alphabetical sequence. A gloss in italic beginning see is a redirect, not an entry.`}
      </p>

      {!query && (
        <nav className="ency-letters" aria-label="Entries by letter">
          {LETTERS.map((letter) =>
            live.has(letter) ? (
              <a key={letter} href={`#ency-letter-${letter}`}>
                {letter}
              </a>
            ) : (
              <span key={letter} className="ency-letters__dead">
                {letter}
              </span>
            ),
          )}
        </nav>
      )}

      <ul className="ency-indexlist">
        {entries.map((e, i) => {
          const letter = letterOf(e);
          const firstOfLetter =
            !query && (i === 0 || letterOf(entries[i - 1]) !== letter);
          return (
            <li
              key={e.slug}
              id={firstOfLetter ? `ency-letter-${letter}` : undefined}
              className={firstOfLetter ? "ency-indexlist__letter" : undefined}
            >
              <EntryLink slug={e.slug} title={e.title} gloss={e.gloss} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
