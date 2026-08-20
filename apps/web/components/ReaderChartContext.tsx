"use client";
/**
 * Site-wide reader's-chart context (the Playground pattern): one birth
 * entry, stored in the URL fragment or localStorage, computed in the
 * browser, never sent to a server. Every widget accepts the reader's
 * chart as a params override; anonymous readers get the article's
 * example chart, so the provider defaulting to null is the resting
 * state, not an error.
 *
 * Entry channels, in precedence order:
 *   1. `#rc=<b64url Share>` in the URL fragment — a Playground share
 *      payload, so "use as my chart" is just a link. Fragments never
 *      reach the server. Arrival persists to localStorage: one entry,
 *      site-wide.
 *   2. localStorage (`caelus:reader-chart`) from a previous visit.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import type { ChartParams } from "caelus-widgets";
import { decodeShare, isShare, type Share } from "../lib/share";
import {
  READER_CHART_HASH, READER_CHART_KEY, shareToChartParams,
} from "../lib/reader-chart";

export interface ReaderChartValue {
  /** The stored record, or null when the reader hasn't entered one. */
  share: Share | null;
  /** The record as widget params, or null (also null on a malformed
   *  stored record — widgets then fall back to the article's chart). */
  params: ChartParams | null;
  /** False until the first client read of hash and storage; the server
   *  render and the first client render both see null. */
  ready: boolean;
  /** Set (persist) or clear the reader's chart. */
  setShare: (share: Share | null) => void;
}

const ReaderChartContext = createContext<ReaderChartValue>({
  share: null, params: null, ready: false, setShare: () => {},
});

export function ReaderChartProvider({ children }: { children: ReactNode }) {
  const [share, setShareState] = useState<Share | null>(null);
  const [ready, setReady] = useState(false);

  const setShare = useCallback((s: Share | null) => {
    setShareState(s);
    try {
      if (s) localStorage.setItem(READER_CHART_KEY, JSON.stringify(s));
      else localStorage.removeItem(READER_CHART_KEY);
    } catch {
      /* storage blocked (private mode): the chart lives for this page */
    }
  }, []);

  useEffect(() => {
    const fromHash = (): Share | null => {
      const raw = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      ).get(READER_CHART_HASH);
      return raw ? decodeShare(raw) : null;
    };
    const fromStorage = (): Share | null => {
      try {
        const raw = localStorage.getItem(READER_CHART_KEY);
        if (!raw) return null;
        const s: unknown = JSON.parse(raw);
        return isShare(s) ? s : null;
      } catch {
        return null;
      }
    };
    const initial = fromHash();
    if (initial) setShare(initial);
    else setShareState(fromStorage());
    setReady(true);

    const onHash = () => {
      const s = fromHash();
      if (s) setShare(s);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [setShare]);

  const value = useMemo<ReaderChartValue>(() => ({
    share,
    params: share ? shareToChartParams(share) : null,
    ready,
    setShare,
  }), [share, ready, setShare]);

  return (
    <ReaderChartContext.Provider value={value}>
      {children}
    </ReaderChartContext.Provider>
  );
}

export function useReaderChart(): ReaderChartValue {
  return useContext(ReaderChartContext);
}
