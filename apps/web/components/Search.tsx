"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Entry = { title: string; kind: string; url: string; text: string };

const DIRECT_KINDS = new Set(["function", "class", "method", "heading", "interface"]);

function score(entry: Entry, q: string, terms: string[]): number {
  const title = entry.title.toLowerCase();
  const text = entry.text.toLowerCase();
  const url = entry.url.toLowerCase();
  let s = 0;
  if (title === q) s += 100;
  if (title.startsWith(q)) s += 50;
  if (title.includes(q)) s += 30;
  for (const t of terms) {
    if (title.includes(t)) s += 12;
    if (text.includes(t)) s += 3;
    if (url.includes(t)) s += 2;
  }
  if (s > 0 && DIRECT_KINDS.has(entry.kind)) s += 2;
  return s;
}

export default function Search() {
  const router = useRouter();
  const titleId = useId();
  const listboxId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
  }, []);

  const load = useCallback(() => {
    if (index) return;
    fetch("/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Entry[]) => setIndex(data))
      .catch(() => setIndex([]));
  }, [index]);

  const openModal = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    load();
    setActive(0);
    dialog.showModal();
    inputRef.current?.focus();
  }, [load]);

  const closeModal = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, []);

  // Global Cmd/Ctrl+K toggle. Native <dialog> handles Esc and focus return.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (dialog.open) dialog.close();
        else openModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal]);

  // Light-dismiss fallback for browsers without native <dialog closedby="any">
  // (e.g., Safari). Tests pointer coordinates on both pointerdown and pointerup
  // so dragging a text selection onto the backdrop does not close the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = outside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) dialog.close();
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !index) return [];
    const terms = q.split(/\s+/);
    return index
      .map((e) => ({ e, s: score(e, q, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.e);
  }, [query, index]);

  const go = useCallback(
    (entry: Entry) => {
      closeModal();
      router.push(entry.url);
    },
    [closeModal, router],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const activeId = results[active] ? `search-opt-${active}` : undefined;
  const closedByProps = { closedby: "any" } as Record<string, string>;

  return (
    <>
      <button
        type="button"
        className="docs-search-trigger"
        onClick={openModal}
        aria-label="Search documentation"
      >
        <span>Search docs</span>
        <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="search-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          setQuery("");
          setActive(0);
        }}
        {...closedByProps}
      >
        <div className="search-head">
          <span className="search-head__title" id={titleId}>
            <b>SEARCH</b>
            <span>Docs &amp; API</span>
          </span>
          <button
            type="button"
            className="search-close"
            onClick={closeModal}
            aria-label="Close search"
          >
            Esc
          </button>
        </div>

        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search functions, guides, recipes..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
          aria-label="Search query"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />

        {query.trim() && results.length === 0 ? (
          <p className="search-empty" role="status">
            {index === null ? "Loading search index..." : "No matching documentation entries."}
          </p>
        ) : (
          <ul
            className="search-results"
            id={listboxId}
            role="listbox"
            aria-label="Search results"
          >
            {results.map((entry, i) => (
              <li
                key={entry.url}
                id={`search-opt-${i}`}
                className="search-result"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(entry);
                }}
              >
                <span className="search-text">
                  <strong>{entry.title}</strong>
                  {entry.text && <span className="search-snip">{entry.text}</span>}
                </span>
                <span className="search-kind">{entry.kind}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="search-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate · <kbd>↵</kbd> open
          </span>
          <span role="status" aria-live="polite">
            {query.trim()
              ? `${results.length} ${results.length === 1 ? "result" : "results"}`
              : index
                ? `${index.length} entries indexed`
                : "Type to filter"}
          </span>
        </div>
      </dialog>
    </>
  );
}
