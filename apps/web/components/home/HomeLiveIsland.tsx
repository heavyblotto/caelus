"use client";

import dynamic from "next/dynamic";
import type { NycCivil } from "../../lib/nycNow";

const HomeLive = dynamic(() => import("./HomeLive"), {
  ssr: false,
  loading: () => <p className="dim small">computing the New York sky…</p>,
});

export default function HomeLiveIsland({ civil }: { civil: NycCivil }) {
  return <HomeLive civil={civil} />;
}
