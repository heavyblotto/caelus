/**
 * The instruments, in ID order. The index page and anything else that lists
 * them reads this, so adding an instrument is one entry here plus its page.
 */
export type Instrument = {
  id: string;
  href: string;
  title: string;
  /** One sentence on the question the instrument answers. */
  line: string;
  status: "live";
};

export const INSTRUMENTS: Instrument[] = [
  {
    id: "I-01",
    href: "/instruments/sky-dating",
    title: "Sky dating",
    line: "Specify planetary sign placements, aspects, or retrograde states and find every historical date range that matches.",
    status: "live",
  },
  {
    id: "I-02",
    href: "/instruments/uncertain-time",
    title: "Uncertain time",
    line: "Enter a birth time and uncertainty window to see which chart placements stay fixed and when cusps or signs shift.",
    status: "live",
  },
  {
    id: "I-03",
    href: "/instruments/eclipses",
    title: "Eclipses",
    line: "Browse solar and lunar eclipses over a range of years, inspect local visibility for any coordinates, and map central eclipse paths.",
    status: "live",
  },
  {
    id: "I-04",
    href: "/instruments/first-visibility",
    title: "First visibility",
    line: "Find the dates in a year when a star, planet, or the Moon disappears into solar glare and reappears from a given location.",
    status: "live",
  },
];
