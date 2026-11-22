"use client";

import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel } from "caelus-wheel";
import { WHEEL_THEME } from "../lib/wheelTheme";
import { b64urlEncode, type BirthShare } from "../lib/share";

const engine = new Engine(embeddedData);

const EXAMPLES: Array<{
  id: string;
  title: string;
  tag: string;
  caption: string;
  args: Parameters<Engine["chart"]>;
  share: BirthShare;
}> = [
  {
    id: "EX-01",
    title: "Four Royal Stars",
    tag: "2000-08-22",
    caption: "Sun and Mercury on Regulus, the Moon on Algol, Pluto on Antares.",
    args: [2000, 8, 22, 12, 0, 0, 51.5, -0.12, "placidus"],
    share: { v: 1, t: "2000-08-22T12:00", la: "51.5", lo: "-0.12", h: "placidus", z: "tropical", n: "Royal stars" },
  },
  {
    id: "EX-02",
    title: "Jupiter on Sirius",
    tag: "1990-06-10",
    caption: "Jupiter conjunct Sirius, the brightest fixed star in the sky.",
    args: [1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1990-06-10T18:30", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Jupiter on Sirius" },
  },
  {
    id: "EX-03",
    title: "Aquarius Stellium",
    tag: "1962-02-05",
    caption: "A five-body Aquarius stellium during a total solar eclipse, with Uranus on Regulus.",
    args: [1962, 2, 5, 0, 0, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1962-02-05T00:00", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Aquarius stellium" },
  },
  {
    id: "EX-04",
    title: "Star Wars Opening",
    tag: "1977-05-25",
    caption: "The Moon on Regulus and the lunar node on Spica over Los Angeles.",
    args: [1977, 5, 25, 19, 0, 0, 34.05, -118.24, "placidus"],
    share: { v: 1, t: "1977-05-25T19:00", la: "34.05", lo: "-118.24", h: "placidus", z: "tropical", n: "1977-05-25" },
  },
  {
    id: "EX-05",
    title: "Total Solar Eclipse",
    tag: "2024-04-08",
    caption: "Sun, Moon, and Chiron aligned in Aries at greatest eclipse over Mazatlan.",
    args: [2024, 4, 8, 18, 17, 0, 23.24, -106.41, "placidus"],
    share: { v: 1, t: "2024-04-08T18:17", la: "23.24", lo: "-106.41", h: "placidus", z: "tropical", n: "Eclipse 2024" },
  },
  {
    id: "EX-06",
    title: "Untimed Birth",
    tag: "rectification",
    caption: "11 June 1990 in Tampa with the clock unmarked to inspect 24h rising windows.",
    args: [1990, 6, 11, 12, 0, 0, 27.95, -82.46, "placidus"],
    share: {
      v: 1, t: "1990-06-11T12:00", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical",
      n: "Unknown time", time: "unknown",
    },
  },
];

export default function PlaygroundExamples() {
  return (
    <div className="bench">
      {EXAMPLES.map((ex) => (
        <a
          key={ex.id}
          href={`/playground#c=${b64urlEncode(ex.share)}`}
          className="tile s4 example-card"
        >
          <div className="tile__h">
            <b>{ex.id}</b>
            <span>{ex.title}</span>
            <i>{ex.tag}</i>
          </div>
          <div className="tile__b stack--sm">
            <div className="example-card__wheel chart-fluid">
              <ChartWheel chart={engine.chart(...ex.args)} size={220} theme={WHEEL_THEME} />
            </div>
            <p className="dim small">{ex.caption}</p>
            <span className="example-card__cta mono small">Load in playground &rarr;</span>
          </div>
        </a>
      ))}
    </div>
  );
}
