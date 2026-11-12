/**
 * Stand-in for `next/link`. The Astro build is a multi-page site, so an
 * internal link is a plain anchor; the Next-only props are dropped.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
};

export default function Link({ href, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...rest }: LinkProps) {
  return <a href={href} {...rest} />;
}
