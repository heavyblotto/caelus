import type { ReactElement, ReactNode } from "react";

/**
 * Note marker: a bracketed number in the text that resolves in the notes
 * below the 2px rule, never in a hover card (DS-02). Oxblood, per the
 * accent brief (the apparatus that binds a claim to a source).
 */
export function NoteRef({ n }: { n: number }): ReactElement {
  return (
    <a className="ency-noteref" href={`#ency-note-${n}`}>
      [{n}]
    </a>
  );
}

export function Note({ n, children }: { n: number; children: ReactNode }): ReactElement {
  return <li id={`ency-note-${n}`} value={n}>{children}</li>;
}

/** The notes block: an ordered list under the 2px rule at the entry's foot. */
export function Notes({ children }: { children: ReactNode }): ReactElement {
  return (
    <section className="ency-notes" aria-label="Notes">
      <ol>{children}</ol>
    </section>
  );
}
