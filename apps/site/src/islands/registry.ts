/**
 * Name -> loader for every nested island. Each loader resolves to the real
 * component (not its wrapper), fetched as its own chunk the first time a
 * marker with that name becomes visible.
 *
 * Keep the names in step with the `nested("Name", ...)` calls in ./web.
 */
import type { ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<ComponentType<any>>;

export const registry: Record<string, Loader> = {
  Cta: () => import("@web/components/Cta").then((m) => m.default),
  CodeBlock: () => import("@web/components/CodeBlock").then((m) => m.default),
  HomeLive: () => import("./HomeLiveClient").then((m) => m.default),
  SkyNow: () => import("@web/components/PlaygroundPanels").then((m) => m.SkyNow),
  SynastryPanel: () => import("@web/components/PlaygroundPanels").then((m) => m.SynastryPanel),
  PlaygroundExamples: () => import("@web/components/PlaygroundPanels").then((m) => m.PlaygroundExamples),
  PlaygroundStickyBar: () => import("@web/components/PlaygroundStickyBar").then((m) => m.default),
  SkyDating: () => import("@web/app/instruments/sky-dating/SkyDatingIsland").then((m) => m.default),
  ChartStability: () => import("@web/app/instruments/uncertain-time/ChartStabilityIsland").then((m) => m.default),
  Eclipses: () => import("@web/app/instruments/eclipses/EclipsesIsland").then((m) => m.default),
  FirstVisibility: () => import("@web/app/instruments/first-visibility/FirstVisibilityIsland").then((m) => m.default),
  FieldVerifier: () => import("@web/app/instruments/field-verifier/FieldVerifierIsland").then((m) => m.default),
};
