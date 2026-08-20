/**
 * Reader-chart conversion checks: a Playground `Share` becomes widget
 * params exactly (UT instant, east-positive longitude, optional house
 * system and label), and malformed records become null rather than a
 * chart at the wrong place.
 */
import { shareToChartParams } from "./reader-chart";
import type { Share } from "./share";

let checks = 0;
let failures = 0;
function assert(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
}

const share: Share = {
  v: 1, t: "1990-06-10T14:30", la: "27.95", lo: "-82.46",
  h: "placidus", z: "tropical", n: "Tampa",
};

{
  const p = shareToChartParams(share);
  assert(p !== null, "well-formed share converts");
  assert(p!.instant.y === 1990 && p!.instant.mo === 6 && p!.instant.d === 10,
    "date fields carried");
  assert(p!.instant.h === 14 && p!.instant.mi === 30 && p!.instant.s === 0,
    "time fields carried, seconds zero");
  assert(p!.place.latDeg === 27.95 && p!.place.lonEastDeg === -82.46,
    "place carried east-positive");
  assert(p!.place.label === "Tampa", "nickname becomes the place label");
  assert(p!.houseSystem === "placidus", "house system carried");
}

{
  const p = shareToChartParams({ ...share, n: undefined, h: undefined as never });
  assert(p !== null && p.place.label === undefined,
    "no nickname, no label key");
  assert(p !== null && !("houseSystem" in p),
    "no house system, key absent (widget default applies)");
}

{
  assert(shareToChartParams({ ...share, t: "not-a-date" }) === null,
    "malformed instant rejected");
  assert(shareToChartParams({ ...share, la: "91" }) === null,
    "latitude out of range rejected");
  assert(shareToChartParams({ ...share, lo: "x" }) === null,
    "non-numeric longitude rejected");
  assert(shareToChartParams({} as Share) === null,
    "empty record rejected");
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
