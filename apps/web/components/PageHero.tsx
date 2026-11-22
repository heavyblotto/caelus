import type { ReactNode } from "react";
import Cta from "./Cta";
import { Eyebrow } from "./Prose";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  cta?: "hero" | "compact";
  after?: ReactNode;
  badge?: string;
  meta?: ReactNode;
};

/**
 * The title tile of a page: label and title at the left, lead and actions at
 * the right (apps/web/DESIGN.md). Optional badge and meta props let pages
 * attach status indicators without inline styling.
 */
export default function PageHero({
  eyebrow,
  title,
  children,
  cta,
  after,
  badge,
  meta,
}: PageHeroProps) {
  return (
    <header className="page-hero">
      <div className="page-hero__title">
        <div className="page-hero__head-meta">
          <Eyebrow>{eyebrow}</Eyebrow>
          {badge ? <span className="badge badge--accent">{badge}</span> : null}
          {meta}
        </div>
        <h1>{title}</h1>
      </div>
      <div className="page-hero__body">
        {children}
        {cta ? <Cta variant={cta} /> : null}
      </div>
      {after ? <div className="page-hero__after">{after}</div> : null}
    </header>
  );
}
