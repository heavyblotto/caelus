"use client";

import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { ChartWheel } from "caelus-wheel";
import { WHEEL_THEME } from "../lib/wheelTheme";
import { b64urlEncode, type BirthShare } from "../lib/share";

const engine = new Engine(embeddedData);

const EXAMPLES: Array<{ caption: string; args: Parameters<Engine["chart"]>; share: BirthShare }> = [
  {
    caption: "Four Royal Stars lit at once: the Sun and Mercury on Regulus, the Moon on Algol, Pluto on Antares.",
    args: [2000, 8, 22, 12, 0, 0, 51.5, -0.12, "placidus"],
    share: { v: 1, t: "2000-08-22T12:00", la: "51.5", lo: "-0.12", h: "placidus", z: "tropical", n: "Royal stars" },
  },
  {
    caption: "Jupiter conjunct Sirius, the brightest star.",
    args: [1990, 6, 10, 18, 30, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1990-06-10T18:30", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Jupiter on Sirius" },
  },
  {
    caption: "A five-body Aquarius stellium, with Uranus on Regulus.",
    args: [1962, 2, 5, 0, 0, 0, 27.95, -82.46, "placidus"],
    share: { v: 1, t: "1962-02-05T00:00", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical", n: "Aquarius stellium" },
  },
  {
    caption: "The day Star Wars opened: the Moon on Regulus, the lunar node on Spica.",
    args: [1977, 5, 25, 19, 0, 0, 34.05, -118.24, "placidus"],
    share: { v: 1, t: "1977-05-25T19:00", la: "34.05", lo: "-118.24", h: "placidus", z: "tropical", n: "1977-05-25" },
  },
  {
    caption: "11 June 1990 in Tampa, with the birth time unmarked.",
    args: [1990, 6, 11, 12, 0, 0, 27.95, -82.46, "placidus"],
    share: {
      v: 1, t: "1990-06-11T12:00", la: "27.95", lo: "-82.46", h: "placidus", z: "tropical",
      n: "Unknown time", time: "unknown",
    },
  },
];

export default function PlaygroundExamples() {
  return (
    <div className="grid grid-2 example-card-grid">
      {EXAMPLES.map((ex) => (
        <a
          key={ex.caption}
          href={`/playground#c=${b64urlEncode(ex.share)}`}
          className="card card-interactive example-card"
        >
          <div className="example-card__wheel chart-fluid">
            <ChartWheel chart={engine.chart(...ex.args)} size={240} theme={WHEEL_THEME} />
          </div>
          <div className="example-card__text">
            {ex.caption}{" "}
            <span className="example-card__cta">Read this chart &rarr;</span>
          </div>
        </a>
      ))}
    </div>
  );
}
