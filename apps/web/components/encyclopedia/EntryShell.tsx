import type { ReactElement, ReactNode } from "react";
import EntryContents from "./EntryContents";
import KindMark, { type EntryKind } from "./KindMark";

/**
 * The entry page frame: kind mark, title, and the "also known as" line
 * above the body; the contents rail in the left margin; the body on the
 * measure. Entry MDX wraps itself in this once; the rail reads the
 * rendered section heads after hydration.
 */
export default function EntryShell({
  kind,
  title,
  aka,
  children,
}: {
  kind: EntryKind;
  title: string;
  /** The "also known as" line under the title (hōroskopos · ASC). */
  aka?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="ency-main--entry">
      <EntryContents />
      <article className="ency-entry ency-measure">
        <header className="ency-entry__header">
          <KindMark kind={kind} />
          <h1>{title}</h1>
          {aka && <p className="ency-entry__aka">{aka}</p>}
        </header>
        {children}
      </article>
    </div>
  );
}
