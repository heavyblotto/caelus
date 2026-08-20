import type { ReactElement } from "react";
import Link from "next/link";

/**
 * Entry link: the title carries the link, the gloss follows in secondary
 * ink after the design's apparatus separator. A gloss beginning "see" is
 * a redirect and sets in italic (DS-02).
 */
export default function EntryLink({
  slug,
  title,
  gloss,
}: {
  slug: string;
  title: string;
  gloss: string;
}): ReactElement {
  const isSee = /^see\b/i.test(gloss.trim());
  return (
    <Link href={`/encyclopedia/${slug}`} className="ency-entry-link">
      <span className="ency-entry-link__title">{title}</span>
      {gloss && (
        <span
          className={
            isSee
              ? "ency-entry-link__gloss ency-entry-link__gloss--see"
              : "ency-entry-link__gloss"
          }
        >
          {" · "}
          {gloss}
        </span>
      )}
    </Link>
  );
}
