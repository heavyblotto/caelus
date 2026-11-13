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
];
