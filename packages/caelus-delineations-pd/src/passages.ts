/**
 * The compiled passage corpus: extracted {@link PassageRecord}s grouped by the
 * work they came from. Each set becomes one {@link InterpretationSource}, so a
 * reading can attribute and reconcile claims per source.
 *
 * Sets are added here as their extractors land (see `scripts/extract/*`).
 * Alan Leo *Key* is quarantined: the DLI scan is unrestorable symbol salad.
 */
import saintGermain from "../data/passages/saint-germain.json" with { type: "json" };
import alanLeoJudge from "../data/passages/alan-leo-judge.json" with { type: "json" };
import alanLeoSigns from "../data/passages/alan-leo-signs.json" with { type: "json" };
import heindelAspects from "../data/passages/heindel-aspects.json" with { type: "json" };
import heindelRising from "../data/passages/heindel-rising.json" with { type: "json" };
import robsonStars from "../data/passages/robson-stars.json" with { type: "json" };
import brihatNakshatras from "../data/passages/brihat-nakshatras.json" with { type: "json" };
import georgeSigns from "../data/passages/george-signs.json" with { type: "json" };
import sepharialRising from "../data/passages/sepharial-rising.json" with { type: "json" };
import ptolemyDignities from "../data/passages/ptolemy-dignities.json" with { type: "json" };
import wilsonDignities from "../data/passages/wilson-dignities.json" with { type: "json" };
import { isShippable } from "./quality.js";
import type { PassageRecord } from "./types.js";

export interface PassageSet {
  /** Stable source id, used as the {@link InterpretationSource.id}. */
  id: string;
  version: string;
  passages: PassageRecord[];
}

function keep(recs: PassageRecord[]): PassageRecord[] {
  return recs.filter((p) => isShippable(p.text));
}

const saintGermainShipped = keep(saintGermain as PassageRecord[]);
const georgeShipped = keep(georgeSigns as PassageRecord[]);

export const passageSets: PassageSet[] = [
  ...(saintGermainShipped.length ? [{
    id: "saint-germain-practical-astrology",
    version: "0.1.0",
    passages: saintGermainShipped,
  }] : []),
  {
    id: "alan-leo-astrology-for-all",
    version: "0.1.0",
    passages: keep(alanLeoSigns as PassageRecord[]),
  },
  {
    id: "alan-leo-how-to-judge-nativity",
    version: "0.1.0",
    passages: alanLeoJudge as PassageRecord[],
  },
  {
    id: "heindel-message-of-the-stars",
    version: "0.1.0",
    passages: [...heindelAspects, ...heindelRising] as PassageRecord[],
  },
  {
    id: "robson-fixed-stars",
    version: "0.1.0",
    passages: robsonStars as PassageRecord[],
  },
  {
    id: "varahamihira-brihat-jataka",
    version: "0.1.0",
    passages: brihatNakshatras as PassageRecord[],
  },
  {
    id: "sepharial-horoscope",
    version: "0.1.0",
    passages: sepharialRising as PassageRecord[],
  },
  {
    id: "ptolemy-tetrabiblos",
    version: "0.1.0",
    passages: ptolemyDignities as PassageRecord[],
  },
  {
    id: "wilson-dictionary",
    version: "0.1.0",
    passages: wilsonDignities as PassageRecord[],
  },
  // Segregated: rights "gratis-not-pd". Omitted when no cell meets the
  // quality floor. Filter this source out (by id, or by the passages' rights)
  // for a strict public-domain-only reading.
  ...(georgeShipped.length ? [{
    id: "george-az-horoscope-delineator",
    version: "0.1.0",
    passages: georgeShipped,
  }] : []),
];

/** Every passage across all sets, flattened. */
export const passages: PassageRecord[] = passageSets.flatMap((s) => s.passages);
