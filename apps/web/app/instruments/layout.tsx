import type { ReactNode } from "react";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "../workbench.css";

// Workbench type: Barlow for prose, Barlow Condensed for titles. JetBrains
// Mono, for data and labels, is already loaded by the root layout.
const bench = Barlow({
  subsets: ["latin"], weight: ["400", "500"], variable: "--font-bench", display: "swap",
});
const cond = Barlow_Condensed({
  subsets: ["latin"], weight: ["600"], variable: "--font-cond", display: "swap",
});

/** Instrument pages follow the Workbench grammar (apps/web/DESIGN.md) ahead
 *  of the site-wide restyle, inside the scoped `.wb` root. */
export default function InstrumentsLayout({ children }: { children: ReactNode }) {
  return <div className={`wb ${bench.variable} ${cond.variable}`}>{children}</div>;
}
