"use client";

import { useEffect, useId, useRef, useState } from "react";

export type City = { name: string; country: string; lat: number; lon: number };

type Row = [name: string, country: string, lat: number, lon: number];

// The gazetteer (~350 KB gzipped) is fetched once, on first interaction, and
// shared across every CityPicker via this module-level promise. It never sits
// in the main bundle, and the request is the only one this feature makes.
let cache: Promise<Row[]> | null = null;
function loadCities(): Promise<Row[]> {
  if (!cache) {
    cache = fetch("/gazetteer.json")
      .then((r) => (r.ok ? r.json() : { cities: [] }))
      .then((d: { cities?: Row[] }) => d.cities ?? [])
      .catch(() => []);
  }
  return cache;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Prefix matches first (ranked by population via array order), then substring. */
function search(rows: Row[], query: string, limit = 8): Row[] {
  const q = norm(query.trim());
  if (!q) return [];
  const starts: Row[] = [];
  const contains: Row[] = [];
  for (const row of rows) {
    const n = norm(row[0]);
    if (n.startsWith(q)) starts.push(row);
    else if (n.includes(q)) contains.push(row);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

const inp: React.CSSProperties = {
  background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)", padding: "0.35rem 0.55rem", font: "inherit", fontSize: "0.85rem",
};

export default function CityPicker({
  onSelect,
  placeholder = "search a city…",
  width = "13rem",
}: {
  onSelect: (city: City) => void;
  placeholder?: string;
  width?: string | number;
}) {
  const listId = useId();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close when focus leaves the whole widget (input + list).
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const results = rows ? search(rows, query) : [];

  function choose(row: Row) {
    onSelect({ name: row[0], country: row[1], lat: row[2], lon: row[3] });
    setQuery(`${row[0]}, ${row[1]}`);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <input
        style={{ ...inp, width }}
        type="text"
        value={query}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="birth place"
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          if (!rows) loadCities().then(setRows);
          if (query.trim()) setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKey}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" aria-label="City matches" className="city-results">
          {results.map((row, i) => (
            <li
              key={`${row[0]}-${row[2]}-${row[3]}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="city-option"
              data-active={i === active || undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(row);
              }}
            >
              <span>{row[0]}</span>
              <span className="mute" style={{ marginLeft: "0.5rem", fontSize: "0.85em" }}>{row[1]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
