import type { ReactElement, ReactNode } from "react";

export interface InfoboxRow {
  label: string;
  value: ReactNode;
  /** The knowledge-base node identifier sets in oxblood (the oxblood
   *  brief: it marks the apparatus that binds a claim to a source). */
  node?: boolean;
}

/**
 * The KB-fed infobox: a framed panel on the plate ground, labels in mono
 * caps, values in apparatus type. Rows are authored (or, once the KB
 * consumer wiring lands, generated) — the component only sets them.
 */
export default function Infobox({
  title,
  rows,
}: {
  title: string;
  rows: InfoboxRow[];
}): ReactElement {
  return (
    <aside className="ency-infobox">
      <div className="ency-infobox__title">{title}</div>
      <dl className="ency-infobox__rows">
        {rows.map((row) => (
          <div
            key={row.label}
            className={
              row.node ? "ency-infobox__row ency-infobox__row--node" : "ency-infobox__row"
            }
          >
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
