import type { ReactElement } from "react";
import { VERSION } from "caelus";

/**
 * The revision stamp: every Encyclopedia page ends with it. The figures
 * line names the engine version that computed the page's plates — the
 * same runtime VERSION the figure harness verifies. Revision and review
 * date arrive with the corpus stream's article program; until then the
 * stamp carries only what is mechanically true.
 */
export default function RevisionStamp({
  revision,
  reviewed,
}: {
  revision?: number;
  reviewed?: string;
}): ReactElement {
  return (
    <footer className="ency-stamp">
      {revision !== undefined && <span>Revision {revision}</span>}
      {reviewed && <span>Reviewed {reviewed}</span>}
      <span>Figures · caelus {VERSION}</span>
      <span>CC BY-SA 4.0</span>
    </footer>
  );
}
