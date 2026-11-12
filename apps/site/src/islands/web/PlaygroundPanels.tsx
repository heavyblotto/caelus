/**
 * Server-side replacement for apps/web/components/PlaygroundPanels (see
 * plugins/web-bridge.mjs). The originals are `dynamic(..., { ssr: false })`
 * components, so the static page carries only their loading placeholders and
 * the panels render in the browser.
 */
import * as Panels from "@web/components/PlaygroundPanels";
import { nested } from "../nested";

export const SkyNow = nested("SkyNow", Panels.SkyNow);
export const SynastryPanel = nested("SynastryPanel", Panels.SynastryPanel);
export const PlaygroundExamples = nested("PlaygroundExamples", Panels.PlaygroundExamples);
