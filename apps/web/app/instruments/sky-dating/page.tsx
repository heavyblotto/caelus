import SkyDatingIsland from "./SkyDatingIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Sky Dating",
  description:
    "Describe a sky by the sign of each planet and get every date it occurred across 6,000 years. Runs in your browser on the Caelus engine, with the search funnel and the call that produced it.",
  path: "/instruments/sky-dating",
});

export default function SkyDatingPage() {
  return (
    <main>
      <SkyDatingIsland />
    </main>
  );
}
