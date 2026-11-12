/**
 * The home page's live New York sky, rendered only in the browser.
 *
 * On the Next deployment the server read the New York wall clock on every
 * request and passed it down, which forced the home page to be dynamic. Here
 * the page is static and the clock is read on mount instead, so the reader
 * always sees the sky for the moment they opened the page.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { nycCivilNow, type NycCivil } from "@web/lib/nycNow";

const loading = () => <p className="dim small">computing the New York sky…</p>;

const HomeLive = dynamic(() => import("@web/components/home/HomeLive"), { ssr: false, loading });

export default function HomeLiveClient() {
  const [civil, setCivil] = useState<NycCivil | null>(null);
  useEffect(() => {
    setCivil(nycCivilNow());
  }, []);
  return civil ? <HomeLive civil={civil} /> : loading();
}
