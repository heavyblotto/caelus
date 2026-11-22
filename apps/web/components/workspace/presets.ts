import type { HouseSystem, Zodiac } from "caelus";
import type { BirthShare, KundliStyle, Share, Tradition } from "../../lib/share";
import type { CompanionView, FigureView, RailId } from "./util";

export interface PlaygroundPreset {
  id: string;
  label: string;
  summary: string;
  /** Live "now" preset computes current UTC instant on activation. */
  liveNow?: boolean;
  iso: string;
  lat: string;
  lon: string;
  place: string;
  sys: HouseSystem;
  zodiac: Zodiac;
  tradition: Tradition;
  kundliStyle?: KundliStyle;
  timeUnknown?: boolean;
  advanced?: boolean;
  figure?: FigureView;
  paired?: boolean;
  companion?: CompanionView;
  rail?: RailId;
  /** Optional partner or collection charts loaded into "My charts". */
  seedSet?: Share[];
  /** Optional target date override for transits/timing scrubber. */
  targetIso?: string;
}

export const DEFAULT_PRESET_ID = "royal-stars";

export const PLAYGROUND_PRESETS: PlaygroundPreset[] = [
  {
    id: "now",
    label: "Live sky (Now)",
    summary: "Current UTC sky over Greenwich with live planetary hour and transits.",
    liveNow: true,
    iso: "",
    lat: "51.48",
    lon: "0.00",
    place: "Greenwich, GB",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    figure: "natal",
    paired: false,
    rail: "placements",
  },
  {
    id: "royal-stars",
    label: "Royal Stars (2000)",
    summary: "Sun and Mercury on Regulus, Moon on Algol, Pluto on Antares.",
    iso: "2000-08-22T12:00",
    lat: "51.51",
    lon: "-0.13",
    place: "London, GB",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    figure: "natal",
    paired: false,
    rail: "reading",
  },
  {
    id: "eclipse-2024",
    label: "Solar Eclipse (2024)",
    summary: "Total solar eclipse at greatest eclipse over Mazatlan, Mexico.",
    iso: "2024-04-08T18:17",
    lat: "23.24",
    lon: "-106.41",
    place: "Mazatlan, MX",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    figure: "natal",
    paired: true,
    companion: "sphere",
    rail: "placements",
    targetIso: "2024-04-08T18:17",
  },
  {
    id: "synastry-pair",
    label: "Synastry Pair",
    summary: "Two births loaded for inter-chart aspects, house overlays, and composite.",
    iso: "1990-06-10T18:30",
    lat: "27.95",
    lon: "-82.46",
    place: "Tampa, US",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    advanced: true,
    figure: "natal",
    paired: false,
    rail: "compare",
    seedSet: [
      {
        v: 1,
        t: "1988-03-21T11:00",
        la: "40.71",
        lo: "-74.01",
        h: "placidus",
        z: "tropical",
        n: "New York 1988",
        trad: "western",
      } as BirthShare,
    ],
  },
  {
    id: "vedic-dashas",
    label: "Vedic Dashas",
    summary: "Sidereal Lahiri Kundli, nakshatra padas, D9 Navamsa, and active Vimshottari.",
    iso: "1990-06-10T18:30",
    lat: "28.61",
    lon: "77.21",
    place: "New Delhi, IN",
    sys: "whole_sign",
    zodiac: "sidereal:lahiri",
    tradition: "vedic",
    kundliStyle: "north",
    figure: "natal",
    paired: false,
    rail: "vedic",
  },
  {
    id: "uncertain-time",
    label: "Uncertain Time",
    summary: "Unmarked birth clock with 24h rising-sign rectification windows.",
    iso: "1990-06-11T12:00",
    lat: "27.95",
    lon: "-82.46",
    place: "Tampa, US",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    timeUnknown: true,
    figure: "natal",
    paired: false,
    rail: "rectify",
  },
  {
    id: "field-sky",
    label: "Field Sky Observation",
    summary: "Flagstaff Observatory evening twilight with topocentric sky frame.",
    iso: "2026-06-21T02:45",
    lat: "35.20",
    lon: "-111.65",
    place: "Flagstaff, US",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    advanced: true,
    figure: "natal",
    paired: true,
    companion: "sky",
    rail: "sky",
    targetIso: "2026-06-21T02:45",
  },
  {
    id: "stellium-1962",
    label: "Aquarius Stellium (1962)",
    summary: "Five classical bodies packed in Aquarius during a total solar eclipse.",
    iso: "1962-02-05T00:00",
    lat: "27.95",
    lon: "-82.46",
    place: "Tampa, US",
    sys: "placidus",
    zodiac: "tropical",
    tradition: "western",
    figure: "natal",
    paired: true,
    companion: "ephemeris",
    rail: "aspects",
    targetIso: "1962-02-05T00:00",
  },
];

export const QUICK_CITIES: Array<{ label: string; lat: string; lon: string; place: string }> = [
  { label: "London", lat: "51.51", lon: "-0.13", place: "London, GB" },
  { label: "New York", lat: "40.71", lon: "-74.01", place: "New York, US" },
  { label: "Tokyo", lat: "35.68", lon: "139.69", place: "Tokyo, JP" },
  { label: "New Delhi", lat: "28.61", lon: "77.21", place: "New Delhi, IN" },
  { label: "Flagstaff", lat: "35.20", lon: "-111.65", place: "Flagstaff, US" },
];
