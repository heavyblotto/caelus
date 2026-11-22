"use client";

import dynamic from "next/dynamic";
import type { NycCivil } from "../../lib/nycNow";
import type { HomeLiveProps } from "./HomeLive";
import HomeSkyLoading from "./HomeSkyLoading";

const HomeLive = dynamic(() => import("./HomeLive"), {
  ssr: false,
  loading: HomeSkyLoading,
});

export default function HomeLiveIsland({
  civil,
  variant,
}: {
  civil: NycCivil;
  variant?: HomeLiveProps["variant"];
}) {
  return <HomeLive civil={civil} variant={variant} />;
}
