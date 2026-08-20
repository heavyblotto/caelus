/**
 * The reader's chart: one birth entry, site-wide, never sent to a server.
 *
 * The record is the Playground's `Share` shape, so the same encoding works in
 * three places: the Playground's own permalinks, the `#rc=` URL fragment that
 * hands a chart to the Encyclopedia, and the localStorage slot that keeps it
 * across pages. Widgets take the reader's chart as a params override
 * (`caelus-widgets` ChartParams), so determinism holds: the reader's chart is
 * just params, computed in the browser from the embedded data tier.
 */
import type { ChartParams } from "caelus-widgets";
import type { Share } from "./share";

/** localStorage slot for the reader's chart. */
export const READER_CHART_KEY = "caelus:reader-chart";

/** URL-fragment parameter carrying a b64url `Share` (`#rc=...`). The
 *  fragment is never transmitted to the server, same as `#c=`. */
export const READER_CHART_HASH = "rc";

/**
 * A `Share` as widget params, or null if the record doesn't parse. `t` is a
 * UT instant (`YYYY-MM-DDTHH:MM`), so the conversion is arithmetic-free; the
 * nickname becomes the place label the caption prints.
 */
export function shareToChartParams(s: Share): ChartParams | null {
  if (typeof s?.t !== "string") return null;
  const m = s.t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const latDeg = Number(s.la);
  const lonEastDeg = Number(s.lo);
  if (!m || !Number.isFinite(latDeg) || !Number.isFinite(lonEastDeg)) return null;
  if (latDeg < -90 || latDeg > 90 || lonEastDeg < -180 || lonEastDeg > 180) return null;
  return {
    instant: { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: 0 },
    place: {
      latDeg,
      lonEastDeg,
      ...(s.n?.trim() ? { label: s.n.trim() } : {}),
    },
    ...(s.h ? { houseSystem: s.h } : {}),
  };
}
