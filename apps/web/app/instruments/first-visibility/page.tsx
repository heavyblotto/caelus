import FirstVisibilityIsland from "./FirstVisibilityIsland";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "First visibility",
  description:
    "Find the days in a year on which a star, a planet, or the Moon is last seen and first seen again from one place: heliacal risings and settings and the first lunar crescent. Runs in your browser on the Caelus engine, with the call that produced it.",
  path: "/instruments/first-visibility",
});

export default function FirstVisibilityPage() {
  return (
    <main>
      <FirstVisibilityIsland />
    </main>
  );
}
