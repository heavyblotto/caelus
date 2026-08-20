"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Item = { id: string; text: string; level: 2 | 3 };

/**
 * The marginal contents rail. Reads the rendered section heads out of
 * `.ency-entry` after navigation and numbers them to match the sheet's
 * CSS counters (1, 1.1). The current section sets in oxblood — the one
 * job the accent does. Renders nothing when the page is not an entry.
 */
export default function EntryContents(): ReactElement | null {
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const root = document.querySelector(".ency-entry");
    if (!root) {
      setItems([]);
      return;
    }
    const next: Item[] = [];
    for (const h of Array.from(root.querySelectorAll<HTMLElement>("h2, h3"))) {
      if (h.classList.contains("ency-plain")) continue;
      const text = (h.textContent ?? "").trim();
      if (!text || !h.id) continue;
      next.push({ id: h.id, text, level: h.tagName === "H3" ? 3 : 2 });
    }
    setItems(next);
    setActive(next[0]?.id ?? "");
  }, [pathname]);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).id);
        }
      },
      { rootMargin: "-32px 0px -68% 0px", threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  let sec = 0;
  let sub = 0;
  const numbered = items.map((item) => {
    if (item.level === 2) {
      sec += 1;
      sub = 0;
      return { ...item, label: `${sec}.` };
    }
    sub += 1;
    return { ...item, label: `${sec}.${sub}` };
  });

  return (
    <div className="ency-rail">
      <nav className="ency-rail__nav" aria-label="Contents">
        <span className="ency-label">Contents</span>
        <ol>
          {numbered.map((item) => (
            <li key={item.id} className={item.level === 3 ? "ency-rail__sub" : undefined}>
              <a href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>
                {item.label} {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
