import { Engine, julianDay } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel } from "caelus-wheel";
import { WHEEL_THEME } from "../../lib/wheelTheme";
import { DocFigure } from "./DocFigure";

const engine = new Engine(embeddedData);
const jd = julianDay(1990, 6, 10, 18, 30);
const at = (minutes: number) => engine.chartAt(jd + minutes / 1440, 27.95, -82.46);

/**
 * The guides' worked birth (Tampa, 10 June 1990, 18:30 UT) drawn with an
 * hour of uncertainty either way: the same call the code sample beside it
 * shows, rendered on the server from the embedded engine.
 */
export function UncertaintyWheel() {
  const samples = [-60, -30, 0, 30, 60].map(at);
  return (
    <DocFigure
      center
      caption={
        <>
          The sample chart for 18:30 UT with a &plusmn;1 hour birth-time window.
          The Ascendant moves 27° and the Midheaven moves 28°, and both cross a
          sign boundary, so their arcs along the outer rim are drawn heavier with a
          square marker at the cusp. The Moon moves 1°, visible as a short arc
          beneath its tick mark, while the remaining planets move by at most 0.13°.
        </>
      }
    >
      <div className="chart-fluid" style={{ maxWidth: 420, width: "100%" }}>
        <ChartWheel chart={at(0)} size={420} theme={WHEEL_THEME} uncertainty={{ samples }} />
      </div>
    </DocFigure>
  );
}
