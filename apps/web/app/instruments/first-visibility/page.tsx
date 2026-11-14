import FirstVisibilityIsland from "./FirstVisibilityIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "First visibility",
  description:
    "Find the dates in a year when a star, planet, or the Moon disappears into solar glare and reappears from a given location, including heliacal risings, settings, and the first lunar crescent.",
  path: "/instruments/first-visibility",
});

export default function FirstVisibilityPage() {
  return (
    <main>
      <FirstVisibilityIsland />
    </main>
  );
}
