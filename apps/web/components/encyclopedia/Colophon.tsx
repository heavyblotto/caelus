import type { ReactElement } from "react";
import { VERSION } from "caelus";
import { listEntries, plateCount } from "../../lib/encyclopedia";

/**
 * The edition colophon at the foot of every Encyclopedia page. Counts are
 * read from the entry sources and the plate registry at build time, so
 * the stamp cannot drift from what the build actually shipped.
 */
export default function Colophon(): ReactElement {
  const entries = listEntries().length;
  const plates = plateCount();
  return (
    <footer className="ency-colophon">
      <div className="ency-colophon__inner">
        <p>
          Entries are signed, dated, and revised in place; superseded
          revisions stay readable. Figures are computed rather than drawn,
          and each names the engine version that produced it. Where the
          sources disagree, the entry says so instead of choosing.
        </p>
        <div className="ency-colophon__stamp">
          <span>{entries} entries</span>
          <span>{plates} computed plates</span>
          <span>CC BY-SA 4.0</span>
          <span>Figures · caelus {VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
