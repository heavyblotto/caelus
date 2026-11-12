"use client";

import dynamic from "next/dynamic";
import type { NycCivil } from "../../lib/nycNow";
import HomeSkyLoading from "./HomeSkyLoading";

const HomeLive = dynamic(() => import("./HomeLive"), {
  ssr: false,
  loading: HomeSkyLoading,
});

export default function HomeLiveIsland({ civil }: { civil: NycCivil }) {
  return <HomeLive civil={civil} />;
}
