"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyTheme(resolved: Theme, stored: Theme | null) {
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? "dark light";
  }
}

/**
 * Two-state color-scheme toggle in the status bar. Follows the OS color scheme
 * by default; choosing the opposite of the currently rendered theme pins an
 * explicit override in localStorage and <meta name="color-scheme">, while
 * toggling back to match the current OS scheme clears the stored override so
 * the page resumes following the OS automatically. Syncs across tabs via the
 * storage event and never retroactively clears a pinned override when the OS
 * switches schemes.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const syncFromEnvironment = () => {
      const stored = readStoredTheme();
      const resolved = stored ?? getSystemTheme();
      applyTheme(resolved, stored);
      setTheme(resolved);
    };

    syncFromEnvironment();

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      // Only update when the user has not pinned an explicit override.
      const stored = readStoredTheme();
      if (stored !== null) return;
      const resolved = mq.matches ? "light" : "dark";
      applyTheme(resolved, null);
      setTheme(resolved);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        syncFromEnvironment();
      }
    };

    mq.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const current: Theme = theme ?? (document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const target: Theme = current === "light" ? "dark" : "light";
    const system = getSystemTheme();
    const nextStored: Theme | null = target === system ? null : target;

    try {
      if (nextStored === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, nextStored);
      }
    } catch {
      /* private mode: still apply in-page theme */
    }

    applyTheme(target, nextStored);
    setTheme(target);
  }

  // Reserve the 44px bar slot before mount to prevent layout shift.
  if (theme === null) {
    return <span className="theme-toggle theme-toggle--placeholder" aria-hidden="true" />;
  }

  const toLight = theme === "dark";
  const label = toLight ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {toLight ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
