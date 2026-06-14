"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DOCS_NAV } from "../lib/site";
import Search from "./Search";

export default function DocsSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="docs-sidebar">
      <Search />
      <button
        type="button"
        className="docs-sidebar__toggle"
        aria-expanded={open}
        aria-controls="docs-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Browse docs</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <nav
        id="docs-nav"
        className={`docs-sidebar__nav${open ? " is-open" : ""}`}
        aria-label="Documentation"
      >
        {DOCS_NAV.map((group) => (
          <div key={group.title}>
            <h5>{group.title}</h5>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
