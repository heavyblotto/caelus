"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { NAV, SITE, formatGoldenChecks } from "../lib/site";

/**
 * The status bar, the single top chrome of the Workbench shell
 * (apps/web/DESIGN.md): wordmark, primary navigation, golden check count,
 * GitHub link, version, MIT licence, and theme toggle. Below 900px navigation
 * moves cleanly to a second row; below 640px optional telemetry cells drop out.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="bar">
      <div className="bar__in">
        <Link href="/" className="bar__cell bar__mark" aria-label="Caelus home">
          Caelus
        </Link>
        <nav className="bar__nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="bar__sp" aria-hidden="true" />
        <Link href="/validation" className="bar__cell bar__opt">
          <span className="led led--ok" aria-hidden="true" />
          {formatGoldenChecks()} checks
        </Link>
        <a
          href={SITE.repo}
          className="bar__cell bar__opt"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <span className="bar__cell bar__ver" aria-label="Current version">
          v{SITE.version}
        </span>
        <a
          href={`${SITE.repo}/blob/main/LICENSE`}
          className="bar__cell bar__opt"
          target="_blank"
          rel="noreferrer"
        >
          MIT
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
