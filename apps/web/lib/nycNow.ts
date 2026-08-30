/** New York City, used as the home-page observer. */
export const NYC = {
  lat: 40.7128,
  lonEast: -74.006,
  altM: 30,
  label: "New York",
} as const;

export interface NycCivil {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  /** Short zone name from Intl (`EST` / `EDT`). */
  zone: string;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** `EST` / `EDT`. Some ICU builds emit `GMT-4` for `timeZoneName: "short"`. */
function nycZoneAbbr(at: Date): string {
  const short = part(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
    hour: "numeric",
  }).formatToParts(at), "timeZoneName");
  if (short === "EST" || short === "EDT") return short;
  const long = part(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "long",
    hour: "numeric",
  }).formatToParts(at), "timeZoneName");
  if (/Daylight/i.test(long)) return "EDT";
  if (/Standard/i.test(long)) return "EST";
  return short || "ET";
}

/** Civil wall clock in `America/New_York` for an instant (defaults to now). */
export function nycCivilNow(at: Date = new Date()): NycCivil {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  return {
    y: Number(part(clock, "year")),
    mo: Number(part(clock, "month")),
    d: Number(part(clock, "day")),
    h: Number(part(clock, "hour")),
    mi: Number(part(clock, "minute")),
    zone: nycZoneAbbr(at),
  };
}

export function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}

export function formatNycStamp(c: NycCivil): string {
  return `${NYC.label} · ${c.y}-${pad2(c.mo)}-${pad2(c.d)} ${pad2(c.h)}:${pad2(c.mi)} ${c.zone}`;
}
