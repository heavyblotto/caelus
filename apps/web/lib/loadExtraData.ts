import type { ChebData, EngineData, KeplerPack } from "caelus";

function asCheb(m: { default?: ChebData } | ChebData): ChebData {
  return ("default" in m && m.default ? m.default : m) as ChebData;
}

function asKepler(m: { default?: KeplerPack } | KeplerPack): KeplerPack {
  return ("default" in m && m.default ? m.default : m) as KeplerPack;
}

/** Asteroids, interpolated apogee, and Uranian Kepler packs. Not in the first-load bundle. */
export async function loadExtraPacks(): Promise<Pick<EngineData, "chebPacks" | "keplerPack" | "intpApog">> {
  const [ceres, pallas, juno, vesta, pholus, intp, kepler] = await Promise.all([
    import("../../../packages/caelus/data/ceres_cheb.json"),
    import("../../../packages/caelus/data/pallas_cheb.json"),
    import("../../../packages/caelus/data/juno_cheb.json"),
    import("../../../packages/caelus/data/vesta_cheb.json"),
    import("../../../packages/caelus/data/pholus_cheb.json"),
    import("../../../packages/caelus/data/intp_apog_cheb.json"),
    import("../../../packages/caelus/data/uranian_kepler.json"),
  ]);
  return {
    chebPacks: {
      ceres: asCheb(ceres),
      pallas: asCheb(pallas),
      juno: asCheb(juno),
      vesta: asCheb(vesta),
      pholus: asCheb(pholus),
    },
    intpApog: asCheb(intp),
    keplerPack: asKepler(kepler),
  };
}

export async function loadDeepStars(): Promise<NonNullable<EngineData["deepStars"]>> {
  const m = await import("../../../packages/caelus/data/fixed_stars_deep.json");
  return (("default" in m && m.default ? m.default : m) as NonNullable<EngineData["deepStars"]>);
}
