import SkyDatingIsland from "./SkyDatingIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Sky Dating",
  description:
    "Search across 6,000 years of planetary positions to find date ranges matching sign placements, aspects, or retrograde states, complete with a filter breakdown and runnable TypeScript snippet.",
  path: "/instruments/sky-dating",
});

export default function SkyDatingPage() {
  return (
    <main>
      <SkyDatingIsland />
    </main>
  );
}
