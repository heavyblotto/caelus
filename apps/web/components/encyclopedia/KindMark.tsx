import type { ReactElement } from "react";

/** The entry kinds the design names; the Hermes frame may grow more. */
export type EntryKind = "article" | "glossary" | "person" | "source" | "plate";

/** Kind mark: the entry's kind set in mono caps (DS-02 parts inventory). */
export default function KindMark({ kind }: { kind: EntryKind }): ReactElement {
  return <span className="ency-kind">{kind}</span>;
}
