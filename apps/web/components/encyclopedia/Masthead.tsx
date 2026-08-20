import type { ReactElement } from "react";
import Link from "next/link";

/**
 * The Encyclopedia masthead. The design's full nav (Contents, Index,
 * Glossary, Sources, About this edition) grows as those surfaces land;
 * only built surfaces are linked.
 */
export default function Masthead(): ReactElement {
  return (
    <header className="ency-masthead">
      <div className="ency-masthead__inner">
        <Link href="/" className="ency-masthead__site ency-label">
          ephemengine.com
        </Link>
        <Link href="/encyclopedia" className="ency-masthead__title">
          Encyclopedia of Hermes
        </Link>
        <nav className="ency-masthead__nav" aria-label="Encyclopedia">
          <Link href="/encyclopedia/index">Index</Link>
        </nav>
      </div>
    </header>
  );
}
