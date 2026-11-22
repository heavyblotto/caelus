/**
 * The instruments, in ID order. The index page and anything else that lists
 * them reads this, so adding an instrument is one entry here plus its page.
 */
export type InstrumentPresetLink = {
  id: string;
  label: string;
};

export type Instrument = {
  id: string;
  href: string;
  title: string;
  /** One sentence on the question the instrument answers. */
  line: string;
  status: "live";
  category: string;
  apiCalls: string[];
  mcpTool: string;
  spanNote: string;
  presets: InstrumentPresetLink[];
};

export const INSTRUMENTS: Instrument[] = [
  {
    id: "I-01",
    href: "/instruments/sky-dating",
    title: "Sky dating",
    line: "Specify planetary sign placements, aspects, or retrograde states and find every historical date range that matches.",
    status: "live",
    category: "Inverse search",
    apiCalls: ["when()", "dateSky()", "inSign()"],
    mcpTool: "find_aspect_dates",
    spanNote: "3000 BCE to 3000 CE",
    presets: [
      { id: "babylon", label: "Babylonian tablet" },
      { id: "hadrian", label: "Hadrian ceiling" },
      { id: "venus", label: "Venus visibility" },
    ],
  },
  {
    id: "I-02",
    href: "/instruments/uncertain-time",
    title: "Uncertain time",
    line: "Enter a birth time and uncertainty window to see which chart placements stay fixed and when cusps or signs shift.",
    status: "live",
    category: "Sensitivity analysis",
    apiCalls: ["chartStability()", "sweptArc()"],
    mcpTool: "rectification_grid",
    spanNote: "+/-5m to +/-12h window",
    presets: [
      { id: "tampa-1h", label: "Tampa +/-1h" },
      { id: "london-day", label: "London 24h scan" },
      { id: "delhi-sidereal", label: "Delhi Lahiri +/-1h" },
    ],
  },
  {
    id: "I-03",
    href: "/instruments/eclipses",
    title: "Eclipses",
    line: "Browse solar and lunar eclipses over a range of years, inspect local visibility for any coordinates, and map central eclipse paths.",
    status: "live",
    category: "Eclipse geometry",
    apiCalls: ["solarEclipses()", "solarEclipseLocal()", "solarEclipseLimits()"],
    mcpTool: "sky_events",
    spanNote: "Local contacts + umbra path",
    presets: [
      { id: "2024", label: "2024 North America" },
      { id: "2026", label: "2026 Spain & Iceland" },
      { id: "2027", label: "2027 Luxor 6m23s" },
    ],
  },
  {
    id: "I-04",
    href: "/instruments/first-visibility",
    title: "First visibility",
    line: "Find the dates in a year when a star, planet, or the Moon disappears into solar glare and reappears from a given location.",
    status: "live",
    category: "Heliacal & crescent",
    apiCalls: ["heliacal()", "lunarCrescent()"],
    mcpTool: "sky_events",
    spanNote: "Schaefer + Yallop models",
    presets: [
      { id: "sirius", label: "Sirius at Memphis" },
      { id: "venus", label: "Venus at Babylon" },
      { id: "crescent", label: "Lunar crescent" },
    ],
  },
];
