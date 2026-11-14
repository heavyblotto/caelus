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
          The chart for 18:30 UT with an hour of uncertainty either way. The
          Ascendant sweeps 27° and the Midheaven 28°, and each crosses a sign
          boundary, so their arcs near the rim are heavy and carry a square.
          The Moon moves 1°, which shows as a short arc under its tick. No
          planet moves more than 0.13°, so their arcs are too short to see.
        </>
      }
    >
      <div className="chart-fluid" style={{ maxWidth: 420, width: "100%" }}>
        <ChartWheel chart={at(0)} size={420} theme={WHEEL_THEME} uncertainty={{ samples }} />
      </div>
    </DocFigure>
  );
}
