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
    line: "Describe a sky by the sign of each planet and get every date on which it occurred.",
    status: "live",
  },
  {
    id: "I-02",
    href: "/instruments/uncertain-time",
    title: "Uncertain time",
    line: "Give a stated time and how far off it could be, and see which facts of the chart hold and when the others change.",
    status: "live",
  },
  {
    id: "I-03",
    href: "/instruments/eclipses",
    title: "Eclipses",
    line: "List the solar and lunar eclipses in a span of years, with what one place sees of each and the central path of a solar eclipse.",
    status: "live",
  },
  {
    id: "I-04",
    href: "/instruments/first-visibility",
    title: "First visibility",
    line: "Find the days in a year on which a star, a planet, or the Moon is last seen and first seen again from one place.",
    status: "live",
  },
];
