"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  angularity, dignityScore, ephemeris, fmtLon,
  type BodyId, type Chart, type Engine, type Zodiac,
} from "caelus";
import { GLYPHS, type WheelChart } from "caelus-wheel";
import BiWheel, { type SynContact } from "../BiWheel";
import { WHEEL_LINE_COLORS, WHEEL_THEME } from "../../lib/wheelTheme";
import type { KundliStyle, Tradition } from "../../lib/share";
import {
  CLASSICAL, speedRegime,
  type CompanionView, type DocKind, type FigureView, type PlaygroundChartParams,
} from "./util";
import {
  InteractiveChartSphere,
  InteractiveChartWheel,
  InteractiveEphemerisGraph,
  InteractiveKundli,
  InteractiveSkyViewTab,
} from "./VizBridge";
import LocationalMap from "./LocationalMap";

const HouseComparatorSlot = dynamic(() => import("./widgets/HouseComparatorSlot"), { ssr: false });
const SectFlipSlot = dynamic(() => import("./widgets/SectFlipSlot"), { ssr: false });
const DerivationSlot = dynamic(() => import("./widgets/DerivationSlot"), { ssr: false });
const RetrogradeSlot = dynamic(() => import("./widgets/RetrogradeSlot"), { ssr: false });
const AspectDialSlot = dynamic(() => import("./widgets/AspectDialSlot"), { ssr: false });

const COMPANION_OPTS: Array<{ id: CompanionView; label: string }> = [
  { id: "sphere", label: "3D Sphere" },
  { id: "sky", label: "Sky View" },
  { id: "map", label: "Astrocartography" },
  { id: "ephemeris", label: "Ephemeris Graph" },
];

export interface VizStageProps {
  engine: Engine;
  docKind: DocKind;
  tradition: Tradition;
  kundliStyle: KundliStyle;
  advanced: boolean;
  chart: Chart | null;
  formWheel: WheelChart | null;
  figureChart: WheelChart | null;
  figure: FigureView;
  setFigure: (v: FigureView) => void;
  figureOpts: Array<[FigureView, string]>;
  paired: boolean;
  setPaired: (v: boolean) => void;
  companion: CompanionView;
  setCompanion: (v: CompanionView) => void;
  harmonicN: number;
  setHarmonicN: (n: number) => void;
  natalJd: number | null;
  targetJd: number | null;
  lat: number;
  lon: number;
  place: string;
  zodiac: Zodiac;
  extraBodies: string[];
  widgetParams: PlaygroundChartParams | null;
  transit: { chart: Chart; contacts: SynContact[] } | null;
  progressed: { chart: Chart; stamp: "directed" | "progressed" } | null;
  focusBodies?: string[];
  selectedBody: string | null;
  hoveredBody: string | null;
  onSelectBody: (body: string | null) => void;
  onHoverBody: (body: string | null) => void;
  onRelocate: (lat: number, lon: number, name?: string) => void;
  onJumpToCode: () => void;
  stamp: string;
  ms: number;
}

export default function VizStage({
  engine,
  docKind,
  tradition,
  kundliStyle,
  advanced,
  chart,
  formWheel,
  figureChart,
  figure,
  setFigure,
  figureOpts,
  paired,
  setPaired,
  companion,
  setCompanion,
  harmonicN,
  setHarmonicN,
  natalJd,
  targetJd,
  lat,
  lon,
  place,
  zodiac,
  extraBodies,
  widgetParams,
  transit,
  progressed,
  focusBodies,
  selectedBody,
  hoveredBody,
  onSelectBody,
  onHoverBody,
  onRelocate,
  onJumpToCode,
  stamp,
  ms,
}: VizStageProps) {
  const activeBody = hoveredBody ?? selectedBody;
  const activeJd = targetJd ?? natalJd ?? chart?.jdUt ?? null;

  const ephemerisSeries = useMemo(() => {
    const needsEph = figure === "ephemeris" || (paired && companion === "ephemeris");
    if (!needsEph || activeJd == null) return null;
    try {
      return ephemeris(engine, ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"], {
        start: activeJd - 45,
        end: activeJd + 45,
        step: 2,
        zodiac,
      });
    } catch {
      return null;
    }
  }, [figure, paired, companion, activeJd, engine, zodiac]);

  const bodyTelemetry = useMemo(() => {
    if (!chart || !activeBody) return null;
    const p = chart.bodies[activeBody];
    if (!p) return null;
    const sun = chart.bodies.sun;
    const sect: "day" | "night" = sun && sun.house >= 7 ? "day" : "night";
    const isClassical = (CLASSICAL as readonly string[]).includes(activeBody);
    const dig = isClassical ? dignityScore(activeBody as BodyId, p.lon, sect) : null;
    const digLabel = dig
      ? dig.rulership
        ? "domicile"
        : dig.exaltation
          ? "exalted"
          : dig.detriment
            ? "detriment"
            : dig.fall
              ? "fall"
              : dig.peregrine
                ? "peregrine"
                : `score ${dig.total}`
      : null;
    const aspectCount = chart.aspects.filter((a) => a.a === activeBody || a.b === activeBody).length;
    return {
      body: activeBody,
      pos: p,
      digLabel,
      digScore: dig?.total ?? null,
      aspectCount,
      regime: speedRegime(p.speed, p.retrograde),
    };
  }, [chart, activeBody]);

  const handleSelectBody = (body: string | null) => {
    if (!body) {
      onSelectBody(null);
      return;
    }
    onSelectBody(selectedBody === body ? null : body);
  };

  const tileSpan = paired && docKind === "birth" ? "tile s12" : "tile s7";

  return (
    <section className={tileSpan} aria-label="Chart visualization stage">
      <div className="tile__h">
        <b>FIG</b>
        <span>{stamp}</span>
        <div className="tile__actions">
          {chart && (
            <span className="badge badge--muted mono num">{ms.toFixed(1)} ms</span>
          )}
          {docKind === "birth" && (
            <div className="seg" role="group" aria-label="Stage layout">
              <button
                type="button"
                className="seg__btn"
                aria-pressed={!paired}
                onClick={() => setPaired(false)}
              >
                Single
              </button>
              <button
                type="button"
                className="seg__btn"
                aria-pressed={paired}
                onClick={() => setPaired(true)}
              >
                Paired
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tile__b stack--sm">
        {docKind === "birth" && (
          <div className="viz-stage__toolbar">
            <div className="seg seg--wrap" role="group" aria-label="Primary figure">
              {figureOpts.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className="seg__btn"
                  aria-pressed={figure === id}
                  onClick={() => setFigure(id)}
                >
                  {name}
                </button>
              ))}
            </div>
            {paired && (
              <div className="seg" role="group" aria-label="Companion figure">
                {COMPANION_OPTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="seg__btn"
                    aria-pressed={companion === opt.id}
                    onClick={() => setCompanion(opt.id)}
                  >
                    + {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={paired && docKind === "birth" ? "viz-stage viz-stage--paired" : "viz-stage"}>
          <div className="viz-stage__pane">
            {docKind === "form" && formWheel && (
              <InteractiveChartWheel
                chart={formWheel}
                size={460}
                theme={WHEEL_THEME}
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={handleSelectBody}
                onHoverBody={onHoverBody}
              />
            )}

            {docKind === "birth" && chart && figure === "natal" && tradition === "western" && figureChart && (
              <InteractiveChartWheel
                chart={figureChart === chart ? chart : figureChart}
                size={460}
                bodies={focusBodies}
                theme={WHEEL_THEME}
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={handleSelectBody}
                onHoverBody={onHoverBody}
              />
            )}

            {docKind === "birth" && chart && figure === "natal" && tradition === "vedic" && (
              <div className="stack--sm">
                <InteractiveKundli
                  chart={chart}
                  layout={kundliStyle}
                  size={advanced ? 400 : 460}
                  theme={WHEEL_THEME}
                  bodies={focusBodies}
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                />
                {advanced && natalJd != null && (
                  <p className="dim small">D1 Rashi chart. Navamsa (D9) and all 16 vargas appear in the Vedic rail.</p>
                )}
              </div>
            )}

            {docKind === "birth" && chart && widgetParams && figure === "houses" && (
              <HouseComparatorSlot engine={engine} params={widgetParams} />
            )}
            {docKind === "birth" && chart && widgetParams && figure === "sect" && (
              <SectFlipSlot engine={engine} params={widgetParams} />
            )}
            {docKind === "birth" && chart && widgetParams && figure === "derive" && (
              <DerivationSlot engine={engine} params={widgetParams} />
            )}
            {docKind === "birth" && chart && widgetParams && figure === "retrograde" && (
              <RetrogradeSlot engine={engine} params={widgetParams} />
            )}
            {docKind === "birth" && chart && widgetParams && figure === "dial" && (
              <AspectDialSlot engine={engine} params={widgetParams} />
            )}

            {docKind === "birth" && chart && (figure === "harmonic" || figure === "antiscia" || figure === "heliocentric") && figureChart && (
              <div className="stack--sm">
                <InteractiveChartWheel
                  chart={figureChart}
                  size={460}
                  theme={WHEEL_THEME}
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                />
                {figure === "harmonic" && advanced && (
                  <div className="field field--compact">
                    <span className="field__label">harmonic n</span>
                    <input
                      className="control mono"
                      type="number"
                      min={2}
                      max={12}
                      value={harmonicN}
                      onChange={(e) => setHarmonicN(Number(e.target.value) || 5)}
                    />
                  </div>
                )}
              </div>
            )}

            {figure === "sphere" && chart && (
              <InteractiveChartSphere
                chart={chart}
                size={460}
                theme={WHEEL_THEME}
                showDeclinationBands
                aspects={chart.aspects}
                showAspects
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={handleSelectBody}
                onHoverBody={onHoverBody}
              />
            )}

            {figure === "map" && natalJd != null && (
              <LocationalMap
                engine={engine}
                natalJd={natalJd}
                lat={lat}
                lon={lon}
                place={place}
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={handleSelectBody}
                onHoverBody={onHoverBody}
                onRelocate={onRelocate}
              />
            )}

            {figure === "ephemeris" && ephemerisSeries && (
              <InteractiveEphemerisGraph
                series={ephemerisSeries}
                width={520}
                height={300}
                wrap={360}
                xLabels
                yUnit="°"
                theme={WHEEL_THEME}
                colors={WHEEL_LINE_COLORS}
                selectedBody={selectedBody}
                hoveredBody={hoveredBody}
                onSelectBody={handleSelectBody}
                onHoverBody={onHoverBody}
              />
            )}

            {figure === "transits" && transit && chart && (
              <BiWheel
                inner={chart}
                outer={transit.chart}
                contacts={transit.contacts}
                size={460}
                innerLabel="natal"
                outerLabel="transit"
              />
            )}

            {figure === "tri" && transit && chart && progressed && (
              <BiWheel
                inner={chart}
                mid={progressed.chart}
                outer={transit.chart}
                contacts={transit.contacts}
                size={460}
                innerLabel="natal"
                midLabel={progressed.stamp}
                outerLabel="transit"
              />
            )}
          </div>

          {paired && docKind === "birth" && chart && (
            <div className="viz-stage__pane">
              {companion === "sphere" && (
                <InteractiveChartSphere
                  chart={chart}
                  size={440}
                  theme={WHEEL_THEME}
                  showDeclinationBands
                  aspects={chart.aspects}
                  showAspects
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                />
              )}
              {companion === "sky" && (
                <InteractiveSkyViewTab
                  engine={engine}
                  jdUt={activeJd ?? chart.jdUt}
                  lat={lat}
                  lonEast={lon}
                  extraBodies={extraBodies}
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                />
              )}
              {companion === "map" && natalJd != null && (
                <LocationalMap
                  engine={engine}
                  natalJd={natalJd}
                  lat={lat}
                  lon={lon}
                  place={place}
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                  onRelocate={onRelocate}
                />
              )}
              {companion === "ephemeris" && ephemerisSeries && (
                <InteractiveEphemerisGraph
                  series={ephemerisSeries}
                  width={500}
                  height={320}
                  wrap={360}
                  xLabels
                  yUnit="°"
                  theme={WHEEL_THEME}
                  colors={WHEEL_LINE_COLORS}
                  selectedBody={selectedBody}
                  hoveredBody={hoveredBody}
                  onSelectBody={handleSelectBody}
                  onHoverBody={onHoverBody}
                />
              )}
            </div>
          )}
        </div>

        <div className="viz-stage__readout">
          {bodyTelemetry ? (
            <div className="row row--between row--wrap">
              <div className="telemetry">
                <div className="telemetry__item">
                  <span className="telemetry__label">Body</span>
                  <span className="telemetry__val mono">
                    {GLYPHS[bodyTelemetry.body] ? `${GLYPHS[bodyTelemetry.body]} ` : ""}
                    {bodyTelemetry.body}
                  </span>
                </div>
                <div className="telemetry__item">
                  <span className="telemetry__label">Longitude</span>
                  <span className="telemetry__val mono num">
                    {fmtLon(bodyTelemetry.pos.lon)}{bodyTelemetry.pos.retrograde ? " R" : ""}
                  </span>
                </div>
                <div className="telemetry__item">
                  <span className="telemetry__label">House</span>
                  <span className="telemetry__val mono num">
                    H{bodyTelemetry.pos.house} ({angularity(bodyTelemetry.pos.house)})
                  </span>
                </div>
                {bodyTelemetry.pos.speed != null && (
                  <div className="telemetry__item">
                    <span className="telemetry__label">Motion</span>
                    <span className="telemetry__val mono num">
                      {bodyTelemetry.pos.speed >= 0 ? "+" : ""}
                      {bodyTelemetry.pos.speed.toFixed(2)}°/d · {bodyTelemetry.regime}
                    </span>
                  </div>
                )}
                {bodyTelemetry.digLabel && (
                  <div className="telemetry__item">
                    <span className="telemetry__label">Dignity</span>
                    <span className="telemetry__val mono">
                      {bodyTelemetry.digLabel}
                      {bodyTelemetry.digScore != null ? ` (${bodyTelemetry.digScore >= 0 ? "+" : ""}${bodyTelemetry.digScore})` : ""}
                    </span>
                  </div>
                )}
                <div className="telemetry__item">
                  <span className="telemetry__label">Aspects</span>
                  <span className="telemetry__val mono num">{bodyTelemetry.aspectCount}</span>
                </div>
              </div>
              <div className="row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={onJumpToCode}>
                  Code call
                </button>
                {selectedBody && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectBody(null)}>
                    Clear focus
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="dim small">
              Click or hover any planet in the figure or placements table to cross-highlight its aspects, dignity, and code call.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
