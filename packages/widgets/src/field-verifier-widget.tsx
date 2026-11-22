/**
 * caelus-widgets - Instrument I-05 (SHADOWPROOF / Field Verifier & Chronolocator), React widget half.
 *
 * Split from field-verifier.ts because this component uses React hooks; hosts
 * with React Server Components import it across a client boundary.
 *
 * Emits Workbench layout classes (apps/web/DESIGN.md) plus SHADOWPROOF `.fv-*`
 * hooks styled by the host stylesheet (`apps/web/app/globals.css`). All SVG
 * data figures are 100% inert, deterministic, and rounded to 0.1 SVG units.
 */
import type { ChangeEvent, DragEvent, KeyboardEvent, PointerEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VERSION,
  type Engine,
  type ObservationCheck,
  type ObservedConstraints,
  type TwilightObservation,
} from "caelus";
import {
  cleanObserved,
  compassDialGeometry,
  computeAnalemmaHeatmap,
  countObservations,
  FIELD_VERIFIER_MAX_SPAN_DAYS,
  FIELD_VERIFIER_PLACES,
  FIELD_VERIFIER_PRESETS,
  fieldVerifierQueryOk,
  fieldVerifierReturned,
  fieldVerifierSource,
  fixMapGeometry,
  isoToJdUt,
  jdUtToIso,
  parseJpegExif,
  r1,
  runFieldVerifier,
  shortUtcLabel,
  timelineGeometry,
  type AnalemmaHeatmap,
  type CompassDialGeometry,
  type ExifExtraction,
  type FieldVerifierMode,
  type FieldVerifierPreset,
  type FieldVerifierQuery,
  type FixMapGeometry,
  type TimelineGeometry,
} from "./field-verifier.js";

export interface FieldVerifierProps {
  engine: Engine;
  /** Preset ID to load on mount. Defaults to "nyc-summer-authentic". */
  initialPreset?: string;
  /** Initial active mode tab. Defaults to the preset's defaultMode or "verify". */
  initialMode?: FieldVerifierMode;
}

const MODES: ReadonlyArray<{ id: FieldVerifierMode; label: string; api: string }> = [
  { id: "verify", label: "Verify", api: "verifyObservation" },
  { id: "chronolocate", label: "Chronolocate", api: "chronolocate" },
  { id: "geolocate", label: "Geolocate", api: "geolocate" },
];

const TWILIGHT_OPTIONS: ReadonlyArray<{ id: "" | TwilightObservation; label: string }> = [
  { id: "", label: "Any lighting" },
  { id: "day", label: "Day (Sun > 0 deg)" },
  { id: "civil", label: "Civil twilight (-6 to 0 deg)" },
  { id: "nautical", label: "Nautical twilight (-12 to -6 deg)" },
  { id: "astronomical", label: "Astronomical twilight (-18 to -12 deg)" },
  { id: "night", label: "Astronomical night (< -18 deg)" },
  { id: "daylight", label: "Daylight or civil (> -6 deg)" },
  { id: "dark", label: "Dark sky (< -6 deg)" },
];

const DEG = Math.PI / 180;
const STAGE_W = 480;
const STAGE_H = 260;

interface StageHandles {
  baseX: number;
  baseY: number;
  poleX: number;
  poleY: number;
  tipX: number;
  tipY: number;
}

function mod360(x: number): number {
  const m = x % 360;
  return m < 0 ? m + 360 : m;
}

function handlesFromObservation(
  obs: ObservedConstraints,
  compassNorthDeg: number,
): StageHandles {
  const baseX = 240;
  const baseY = 178;
  const poleLen = 78;
  const poleX = baseX;
  const poleY = baseY - poleLen;
  const bearing = obs.shadowBearingDeg ?? 71.8;
  const ratio = obs.shadowLengthRatio ?? 0.73;
  const screenDeg = mod360(bearing - compassNorthDeg);
  const clampedLen = Math.max(18, Math.min(138, ratio * poleLen));
  const rad = screenDeg * DEG;
  const tipX = r1(Math.max(20, Math.min(STAGE_W - 20, baseX + clampedLen * Math.sin(rad))));
  const tipY = r1(Math.max(20, Math.min(STAGE_H - 18, baseY - clampedLen * Math.cos(rad))));
  return { baseX, baseY, poleX, poleY, tipX, tipY };
}

function verdictBadgeClass(verdict: string): string {
  if (verdict === "consistent") return "badge badge--ok";
  if (verdict === "marginal") return "badge badge--warm";
  if (verdict === "inconsistent" || verdict === "impossible") return "badge badge--bad";
  return "badge badge--muted";
}

function statusBadgeClass(status: ObservationCheck["status"]): string {
  if (status === "consistent") return "badge badge--ok";
  if (status === "marginal") return "badge badge--warm";
  if (status === "inconsistent" || status === "impossible") return "badge badge--bad";
  return "badge badge--muted";
}

function fmtCheckValue(v: number | string | boolean | null): string {
  if (v === null) return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return v;
}

function placeIdOf(place: FieldVerifierQuery["place"]): string {
  const hit = FIELD_VERIFIER_PLACES.find(
    (p) => Math.abs(p.lat - place.lat) < 1e-4 && Math.abs(p.lonEast - place.lonEast) < 1e-4,
  );
  return hit ? hit.id : "custom";
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// -------------------------------------------------- Inert SVG Figure 1: Compass & Shadow Dial

function CompassDialFigure({ geom }: { geom: CompassDialGeometry }): ReactElement {
  const { size, cx, cy, radius, sun, predictedShadow, observedShadow, moon, ratioBar } = geom;
  const barW = 240;
  const barH = 56;
  const bx0 = 24;
  const bx1 = 224;
  const bSpan = bx1 - bx0;
  const xRatio = (v: number): number => r1(bx0 + (Math.min(v, ratioBar.domainMax) / ratioBar.domainMax) * bSpan);

  return (
    <div className="fv-dial">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Compass and shadow dial. Sun azimuth ${sun.azimuthDeg} degrees, altitude ${sun.altitudeDeg} degrees.`}
      >
        {/* Minimal outer compass ring and cardinal ticks (Tufte B5) */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--wheel-ring, var(--line2))" strokeWidth={1} />
        <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="var(--line2)" strokeWidth={0.8} />
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="var(--line2)" strokeWidth={0.8} />

        {/* Cardinal ticks and mixed-case labels */}
        <line x1={cx} y1={cy - radius} x2={cx} y2={cy - radius - 5} stroke="var(--line2)" strokeWidth={1} />
        <line x1={cx + radius} y1={cy} x2={cx + radius + 5} y2={cy} stroke="var(--line2)" strokeWidth={1} />
        <line x1={cx} y1={cy + radius} x2={cx} y2={cy + radius + 5} stroke="var(--line2)" strokeWidth={1} />
        <line x1={cx - radius} y1={cy} x2={cx - radius - 5} y2={cy} stroke="var(--line2)" strokeWidth={1} />
        <text x={cx} y={cy - radius - 9} textAnchor="middle" fill="var(--dim)" fontSize={10} fontFamily="var(--mono)">N</text>
        <text x={cx + radius + 12} y={cy + 3.5} textAnchor="middle" fill="var(--dim)" fontSize={10} fontFamily="var(--mono)">E</text>
        <text x={cx} y={cy + radius + 16} textAnchor="middle" fill="var(--dim)" fontSize={10} fontFamily="var(--mono)">S</text>
        <text x={cx - radius - 12} y={cy + 3.5} textAnchor="middle" fill="var(--dim)" fontSize={10} fontFamily="var(--mono)">W</text>

        {/* Calibrated radial scale note on outer ring */}
        <text x={cx} y={size - 3} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
          Outer ring L/H = {geom.radialScaleMax.toFixed(1)}
        </text>

        {/* Observed shadow tolerance wedge (translucent --warm, no cross-hatch) */}
        {observedShadow.present && observedShadow.wedgePath && (
          <path d={observedShadow.wedgePath} fill="var(--warm)" fillOpacity={0.18} stroke="none" />
        )}

        {/* Predicted shadow vector (solid --accent) */}
        {predictedShadow.cast && (
          <g>
            <line
              x1={cx} y1={cy} x2={predictedShadow.rimX} y2={predictedShadow.rimY}
              stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={0.8} strokeDasharray="2 3"
            />
            <line
              x1={cx} y1={cy} x2={predictedShadow.x} y2={predictedShadow.y}
              stroke="var(--accent)" strokeWidth={2.2}
            />
            <circle cx={predictedShadow.x} cy={predictedShadow.y} r={3.2} fill="var(--accent)" />
            {predictedShadow.clipped && (
              <text x={predictedShadow.x} y={predictedShadow.y - 6} textAnchor="middle" fill="var(--accent)" fontSize={9} fontFamily="var(--mono)">
                &gt;4x
              </text>
            )}
          </g>
        )}

        {/* Observed shadow vector (dashed --warm) */}
        {observedShadow.present && (
          <g>
            <line
              x1={cx} y1={cy} x2={observedShadow.x} y2={observedShadow.y}
              stroke="var(--warm)" strokeWidth={1.8} strokeDasharray="4 2.5"
            />
            <circle cx={observedShadow.x} cy={observedShadow.y} r={3} fill="var(--warm)" />
          </g>
        )}

        {/* Sun azimuth marker on rim */}
        <g>
          <circle
            cx={sun.x} cy={sun.y} r={4.5}
            fill={sun.aboveHorizon ? "var(--wheel-planet-sun, var(--warm))" : "none"}
            stroke="var(--wheel-planet-sun, var(--warm))" strokeWidth={1.5}
          />
          <text
            x={sun.labelX} y={sun.labelY + 3}
            textAnchor={sun.labelX < cx - 10 ? "end" : sun.labelX > cx + 10 ? "start" : "middle"}
            fill="var(--text)" fontSize={9.5} fontFamily="var(--mono)"
          >
            Sun
          </text>
        </g>

        {/* Moon azimuth marker + bright-limb orientation arrows (when visible or constrained) */}
        {(moon.visible || moon.observedLimbDeg !== null) && (
          <g>
            <circle
              cx={moon.x} cy={moon.y} r={4}
              fill={moon.visible ? "var(--wheel-planet-moon, var(--dim))" : "none"}
              stroke="var(--wheel-planet-moon, var(--dim))" strokeWidth={1.2}
            />
            {moon.predLimbArrow && (
              <line
                x1={moon.predLimbArrow.x1} y1={moon.predLimbArrow.y1}
                x2={moon.predLimbArrow.x2} y2={moon.predLimbArrow.y2}
                stroke="var(--accent)" strokeWidth={1.8}
              />
            )}
            {moon.obsLimbArrow && (
              <line
                x1={moon.obsLimbArrow.x1} y1={moon.obsLimbArrow.y1}
                x2={moon.obsLimbArrow.x2} y2={moon.obsLimbArrow.y2}
                stroke="var(--warm)" strokeWidth={1.8} strokeDasharray="3 2"
              />
            )}
            <text
              x={moon.labelX} y={moon.labelY + 3}
              textAnchor={moon.labelX < cx - 10 ? "end" : moon.labelX > cx + 10 ? "start" : "middle"}
              fill="var(--dim)" fontSize={9.5} fontFamily="var(--mono)"
            >
              Moon
            </text>
          </g>
        )}
      </svg>

      {/* Paired 1-D range-frame shadow length ratio bar (Tufte B1 zero lie factor) */}
      {ratioBar.show && (
        <svg
          viewBox={`0 0 ${barW} ${barH}`}
          role="img"
          aria-label={`Shadow length ratio comparison on 0 to ${ratioBar.domainMax} scale.`}
        >
          <text x={bx0} y={11} fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
            Shadow ratio L/H (predicted violet, observed peach)
          </text>
          {/* Range-frame horizontal baseline */}
          <line x1={bx0} y1={30} x2={bx1} y2={30} stroke="var(--line2)" strokeWidth={1} />
          <line x1={bx0} y1={27} x2={bx0} y2={33} stroke="var(--line2)" strokeWidth={1} />
          <line x1={bx1} y1={27} x2={bx1} y2={33} stroke="var(--line2)" strokeWidth={1} />
          <text x={bx0} y={45} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">0</text>
          <text x={bx1} y={45} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
            {ratioBar.domainMax.toFixed(1)}x
          </text>

          {/* Observed tolerance interval */}
          {ratioBar.tolLo !== null && ratioBar.tolHi !== null && (
            <rect
              x={xRatio(ratioBar.tolLo)}
              y={24}
              width={r1(Math.max(2, xRatio(ratioBar.tolHi) - xRatio(ratioBar.tolLo)))}
              height={12}
              fill="var(--warm)"
              fillOpacity={0.22}
            />
          )}

          {/* Predicted marker (solid --accent bar + tick) */}
          {ratioBar.predicted !== null && (
            <g>
              <line x1={bx0} y1={27} x2={xRatio(ratioBar.predicted)} y2={27} stroke="var(--accent)" strokeWidth={2} />
              <circle cx={xRatio(ratioBar.predicted)} cy={27} r={3} fill="var(--accent)" />
              <text x={xRatio(ratioBar.predicted)} y={21} textAnchor="middle" fill="var(--accent)" fontSize={8.5} fontFamily="var(--mono)">
                {ratioBar.clippedPred ? ">6.0" : ratioBar.predicted.toFixed(2)}
              </text>
            </g>
          )}

          {/* Observed marker (hollow/solid --warm diamond) */}
          {ratioBar.observed !== null && (
            <g>
              <line x1={xRatio(ratioBar.observed)} y1={23} x2={xRatio(ratioBar.observed)} y2={37} stroke="var(--warm)" strokeWidth={2} />
              <text x={xRatio(ratioBar.observed)} y={52} textAnchor="middle" fill="var(--warm)" fontSize={8.5} fontFamily="var(--mono)">
                {ratioBar.clippedObs ? ">6.0" : ratioBar.observed.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

// -------------------------------------------------- Inert SVG Figure 2A: 12x24 Analemma Feasibility Heatmap

function AnalemmaHeatmapFigure({ map }: { map: AnalemmaHeatmap }): ReactElement {
  const padL = 36;
  const padT = 22;
  const padR = 14;
  const padB = 26;
  const cellW = 24;
  const cellH = 14;
  const W = padL + 24 * cellW + padR;
  const H = padT + 12 * cellH + padB;
  const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21, 23];

  return (
    <div className="fv-heatmap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`12-month by 24-hour UTC solar analemma feasibility grid for ${map.year}. ${map.feasibleCount} feasible month-hour windows.`}
      >
        {/* Top direct summary label */}
        <text x={padL} y={13} fill="var(--dim)" fontSize={10} fontFamily="var(--mono)">
          Solar analemma feasibility ({map.year}) | {map.feasibleCount} feasible month-hour bins
          {map.peak ? ` | Peak ${map.months[map.peak.month - 1]} ${String(map.peak.hourUtc).padStart(2, "0")}:00 UT` : ""}
        </text>

        {/* Month rows */}
        {map.months.map((mLabel, mi) => (
          <text
            key={mLabel}
            x={padL - 5}
            y={r1(padT + mi * cellH + cellH * 0.76)}
            textAnchor="end"
            fill="var(--faint)"
            fontSize={9.5}
            fontFamily="var(--mono)"
          >
            {mLabel}
          </text>
        ))}

        {/* 12x24 cells */}
        {map.cells.map((c) => {
          const x = r1(padL + c.hourUtc * cellW);
          const y = r1(padT + (c.month - 1) * cellH);
          const isPeak = map.peak !== null && map.peak.month === c.month && map.peak.hourUtc === c.hourUtc;
          const fill = c.feasible
            ? "var(--warm)"
            : c.score > 0.05
              ? "var(--accent)"
              : c.sunAltDeg > 0
                ? "var(--panel2)"
                : "var(--panel-inset)";
          const fillOpacity = c.feasible
            ? r1(0.45 + 0.55 * c.score)
            : c.score > 0.05
              ? r1(0.15 + 0.55 * c.score)
              : 1;
          return (
            <rect
              key={`${c.month}-${c.hourUtc}`}
              x={x + 0.5}
              y={y + 0.5}
              width={cellW - 1}
              height={cellH - 1}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={isPeak ? "var(--text)" : "var(--line)"}
              strokeWidth={isPeak ? 1.4 : 0.4}
              data-peak={isPeak ? "true" : undefined}
              data-feasible={c.feasible ? "true" : undefined}
            />
          );
        })}

        {/* UTC Hour axis ticks */}
        {hourTicks.map((h) => (
          <text
            key={h}
            x={r1(padL + h * cellW + cellW / 2)}
            y={r1(padT + 12 * cellH + 14)}
            textAnchor="middle"
            fill="var(--faint)"
            fontSize={9}
            fontFamily="var(--mono)"
          >
            {String(h).padStart(2, "0")}h
          </text>
        ))}
        <text x={r1(padL + 12 * cellW)} y={H - 2} textAnchor="middle" fill="var(--faint)" fontSize={8.5} fontFamily="var(--mono)">
          UTC hour of day (peach = feasible match, violet = near match, shaded = daylight)
        </text>
      </svg>
    </div>
  );
}

// -------------------------------------------------- Inert SVG Figure 2B: Chronolocate Timeline Track

function TimelineFigure({ geom }: { geom: TimelineGeometry }): ReactElement {
  const { width, height, padL, padT, plotW, plotH, horizonY, minAlt, maxAlt } = geom;
  const botY = r1(padT + plotH);

  return (
    <div className="fv-timeline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Chronolocation timeline from ${geom.startLabel} to ${geom.endLabel} with ${geom.windows.length} matching windows.`}
      >
        {/* Range-frame y-axis (exact minAlt..maxAlt) */}
        <line x1={padL} y1={padT} x2={padL} y2={botY} stroke="var(--line2)" strokeWidth={1} />
        <text x={padL - 5} y={padT + 4} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
          {maxAlt}°
        </text>
        <text x={padL - 5} y={botY + 3} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
          {minAlt}°
        </text>

        {/* Horizon 0 deg reference line */}
        {horizonY !== null && (
          <g>
            <line x1={padL} y1={horizonY} x2={r1(padL + plotW)} y2={horizonY} stroke="var(--line2)" strokeWidth={0.8} strokeDasharray="3 3" />
            <text x={padL - 5} y={horizonY + 3} textAnchor="end" fill="var(--dim)" fontSize={9} fontFamily="var(--mono)">
              0°
            </text>
            <text x={r1(padL + plotW - 2)} y={horizonY - 4} textAnchor="end" fill="var(--faint)" fontSize={8.5} fontFamily="var(--mono)">
              Horizon 0 deg
            </text>
          </g>
        )}

        {/* Solar altitude envelope */}
        <polyline points={geom.solarCurvePoints} fill="none" stroke="var(--accent)" strokeWidth={1.1} strokeOpacity={0.75} />
        {geom.solarLowerPoints && (
          <polyline points={geom.solarLowerPoints} fill="none" stroke="var(--line2)" strokeWidth={0.9} strokeDasharray="2 3" />
        )}

        {/* Matching UTC windows: separate true-width intervals from sub-2px point hits (Tufte B1) */}
        {geom.windows.map((w) =>
          w.isPointHit ? (
            <g key={w.index} data-point-hit="true">
              <line x1={w.peakX} y1={padT + 4} x2={w.peakX} y2={botY} stroke="var(--warm)" strokeWidth={1.4} />
              <polygon
                points={`${w.peakX},${padT} ${r1(w.peakX + 3.2)},${padT + 4} ${w.peakX},${padT + 8} ${r1(w.peakX - 3.2)},${padT + 4}`}
                fill="var(--warm)"
              />
            </g>
          ) : (
            <g key={w.index}>
              <rect x={w.x1} y={padT} width={w.width} height={plotH} fill="var(--warm)" fillOpacity={0.28} />
              <line x1={w.peakX} y1={padT} x2={w.peakX} y2={botY} stroke="var(--warm)" strokeWidth={1.4} />
            </g>
          ),
        )}

        {/* Deconflicted top peak labels (Tufte B4) */}
        {geom.placedPeaks.map((p) => (
          <g key={p.index}>
            <line x1={p.anchorX} y1={padT} x2={p.x} y2={p.y + 3} stroke="var(--warm)" strokeWidth={0.7} strokeOpacity={0.7} />
            <text x={p.x} y={p.y} textAnchor="middle" fill="var(--text)" fontSize={9} fontFamily="var(--mono)">
              {p.text}
            </text>
          </g>
        ))}

        {/* Range-frame horizontal rail and ticks */}
        <line x1={padL} y1={botY} x2={r1(padL + plotW)} y2={botY} stroke="var(--line2)" strokeWidth={1} />
        {geom.ticks.map((t, i) => (
          <g key={`${t.label}-${i}`}>
            <line x1={t.x} y1={botY} x2={t.x} y2={botY + 4} stroke="var(--line2)" strokeWidth={1} />
            <text
              x={t.x}
              y={botY + 15}
              textAnchor={i === 0 ? "start" : i === geom.ticks.length - 1 ? "end" : "middle"}
              fill="var(--faint)"
              fontSize={9}
              fontFamily="var(--mono)"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>
      {geom.hasPointHits && (
        <p className="note">Marks narrower than 2 px denote short windows rendered as vertical stems with a diamond apex.</p>
      )}
    </div>
  );
}

// -------------------------------------------------- Inert SVG Figure 3: Equirectangular Global Fix Plot

function FixMapFigure({ geom }: { geom: FixMapGeometry }): ReactElement {
  const { width, height, padL, padT, plotW, plotH, lonLines, latLines, subsolar, sublunar, terminatorPolylines, candidates } = geom;

  return (
    <div className="fv-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Equirectangular global fix plot with ${candidates.length} candidate locations, sub-solar point at ${subsolar.lat} deg latitude, ${subsolar.lon} deg longitude.`}
      >
        {/* Muted graticule hairlines (60 deg lon / 30 deg lat, Tufte B5) */}
        {lonLines.map((ln) => (
          <g key={`lon-${ln.lon}`}>
            <line
              x1={ln.x} y1={padT} x2={ln.x} y2={r1(padT + plotH)}
              stroke="var(--line2)" strokeWidth={ln.lon === 0 ? 0.7 : 0.5} strokeOpacity={0.35}
            />
            <text x={ln.x} y={r1(padT + plotH + 14)} textAnchor="middle" fill="var(--faint)" fontSize={8.5} fontFamily="var(--mono)">
              {ln.label}°
            </text>
          </g>
        ))}
        {latLines.map((lt) => (
          <g key={`lat-${lt.lat}`}>
            <line
              x1={padL} y1={lt.y} x2={r1(padL + plotW)} y2={lt.y}
              stroke="var(--line2)" strokeWidth={lt.lat === 0 ? 0.8 : 0.5} strokeOpacity={lt.lat === 0 ? 0.45 : 0.3}
            />
            <text x={padL - 5} y={lt.y + 3} textAnchor="end" fill="var(--faint)" fontSize={8.5} fontFamily="var(--mono)">
              {lt.label}°
            </text>
          </g>
        ))}

        {/* Range-frame axes (bottom and left only, erasing 4-sided box) */}
        <line x1={padL} y1={padT} x2={padL} y2={r1(padT + plotH)} stroke="var(--line2)" strokeWidth={1} />
        <line x1={padL} y1={r1(padT + plotH)} x2={r1(padL + plotW)} y2={r1(padT + plotH)} stroke="var(--line2)" strokeWidth={1} />

        {/* Daylight terminator (antimeridian-safe polylines) */}
        {terminatorPolylines.map((pts, i) => (
          <polyline
            key={`term-${i}`}
            points={pts}
            fill="none"
            stroke="var(--wheel-horizon, var(--dim))"
            strokeWidth={0.9}
            strokeOpacity={0.55}
            strokeDasharray="4 3"
          />
        ))}

        {/* Candidate fixes: bounding rects + spherical equal-distance contours (antimeridian-safe) */}
        {candidates.map((c) => (
          <g key={`cand-${c.index}`}>
            {c.bboxRects.map((b, bi) => (
              <rect
                key={`bb-${bi}`}
                x={b.x} y={b.y} width={b.width} height={b.height}
                fill="var(--warm)" fillOpacity={c.index === 0 ? 0.14 : 0.08}
                stroke="none"
              />
            ))}
            {c.contourPolylines.map((pts, pi) => (
              <polyline
                key={`ct-${pi}`}
                points={pts}
                fill="none"
                stroke={c.index === 0 ? "var(--warm)" : "var(--accent)"}
                strokeWidth={c.index === 0 ? 1.5 : 1.0}
                strokeOpacity={c.index === 0 ? 0.95 : 0.65}
              />
            ))}
            <circle
              cx={c.x} cy={c.y} r={c.index === 0 ? 4.2 : 3}
              fill={c.index === 0 ? "var(--warm)" : "var(--accent)"}
              stroke="var(--panel)" strokeWidth={1}
            />
            {c.index < 3 && (
              <text
                x={c.labelX} y={c.labelY}
                textAnchor={c.labelX < c.x ? "end" : "start"}
                fill="var(--text)" fontSize={9.5} fontFamily="var(--mono)"
              >
                Fix #{c.index + 1}
              </text>
            )}
          </g>
        ))}

        {/* Sub-solar point */}
        <g>
          <circle cx={subsolar.x} cy={subsolar.y} r={4.5} fill="var(--wheel-planet-sun, var(--warm))" stroke="var(--panel)" strokeWidth={1} />
          <text
            x={subsolar.labelX} y={subsolar.labelY}
            textAnchor={subsolar.labelX < subsolar.x ? "end" : "start"}
            fill="var(--dim)" fontSize={9} fontFamily="var(--mono)"
          >
            Sub-solar
          </text>
        </g>

        {/* Sub-lunar point */}
        <g>
          <circle cx={sublunar.x} cy={sublunar.y} r={3.8} fill="var(--wheel-planet-moon, var(--dim))" stroke="var(--panel)" strokeWidth={1} />
          <text
            x={sublunar.labelX} y={sublunar.labelY}
            textAnchor={sublunar.labelX < sublunar.x ? "end" : "start"}
            fill="var(--faint)" fontSize={9} fontFamily="var(--mono)"
          >
            Sub-lunar
          </text>
        </g>
      </svg>
      <p className="note">
        Equirectangular grid (distance contours projected spherically with antimeridian splitting). Dashed curve marks the solar terminator.
      </p>
    </div>
  );
}

// -------------------------------------------------- Main FieldVerifier Component

export function FieldVerifier({
  engine,
  initialPreset = "nyc-summer-authentic",
  initialMode,
}: FieldVerifierProps): ReactElement {
  const firstPreset: FieldVerifierPreset =
    FIELD_VERIFIER_PRESETS.find((p) => p.id === initialPreset) ?? FIELD_VERIFIER_PRESETS[0];

  const [presetId, setPresetId] = useState<string>(firstPreset.id);
  const [query, setQuery] = useState<FieldVerifierQuery>(() => ({
    ...firstPreset.query,
    mode: initialMode ?? firstPreset.defaultMode,
    place: { ...firstPreset.query.place },
    observed: { ...firstPreset.query.observed },
  }));

  // Zero-upload local photo + EXIF state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [exifInfo, setExifInfo] = useState<ExifExtraction | null>(null);
  const [exifMessage, setExifMessage] = useState<string>("Procedural calibration scene active. Drop a local JPEG or PNG to measure your own photo.");
  const [dragOver, setDragOver] = useState(false);

  // Interactive calibration handles + compass North rotation
  const [compassNorthDeg, setCompassNorthDeg] = useState<number>(firstPreset.calibration.compassNorthDeg);
  const [handles, setHandles] = useState<StageHandles>(() =>
    handlesFromObservation(firstPreset.query.observed, firstPreset.calibration.compassNorthDeg),
  );
  const [draggingHandle, setDraggingHandle] = useState<"pole" | "shadow" | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [copied, setCopied] = useState(false);

  // Revoke local object URL on unmount or swap (zero leaks, zero uploads)
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const validation = useMemo(() => fieldVerifierQueryOk(query), [query]);

  // Synchronous client-side computation (< 1 ms verify, ~4 ms geolocate, ~15 ms 7-day chronolocate)
  const result = useMemo(() => {
    if (!validation.ok) return null;
    try {
      return runFieldVerifier(engine, query);
    } catch {
      return null;
    }
  }, [engine, query, validation.ok]);

  // Derived inert SVG geometries
  const dialGeom = useMemo(() => {
    if (!result?.verify) return null;
    return compassDialGeometry(result.verify.scene, query.observed);
  }, [result, query.observed]);

  const analemmaMap = useMemo(() => {
    if (query.mode !== "chronolocate" || !validation.ok) return null;
    const startYear = Number(query.searchStartUtc.slice(0, 4)) || 2026;
    return computeAnalemmaHeatmap(engine, query.place, query.observed, startYear);
  }, [engine, query.mode, query.place, query.observed, query.searchStartUtc, validation.ok]);

  const timelineGeom = useMemo(() => {
    if (!result?.chronolocate) return null;
    return timelineGeometry(engine, result.chronolocate);
  }, [engine, result]);

  const fixMapGeom = useMemo(() => {
    if (!result?.geolocate) return null;
    return fixMapGeometry(result.geolocate);
  }, [result]);

  const source = useMemo(() => fieldVerifierSource(query), [query]);
  const returned = useMemo(() => fieldVerifierReturned(result), [result]);

  const activePreset = FIELD_VERIFIER_PRESETS.find((p) => p.id === presetId) ?? null;

  // Apply measurement from interactive calibration handles -> query.observed
  const syncHandlesToQuery = useCallback((nextHandles: StageHandles, northDeg: number) => {
    const polePx = Math.hypot(nextHandles.poleX - nextHandles.baseX, nextHandles.poleY - nextHandles.baseY);
    const shadowPx = Math.hypot(nextHandles.tipX - nextHandles.baseX, nextHandles.tipY - nextHandles.baseY);
    const ratio = Math.round((shadowPx / Math.max(8, polePx)) * 1000) / 1000;
    const screenAngle = mod360(Math.atan2(nextHandles.tipX - nextHandles.baseX, -(nextHandles.tipY - nextHandles.baseY)) / DEG);
    const bearing = r1(mod360(screenAngle + northDeg));
    setQuery((prev) => ({
      ...prev,
      observed: {
        ...prev.observed,
        shadowBearingDeg: bearing,
        shadowLengthRatio: ratio,
      },
    }));
    setPresetId("custom");
  }, []);

  const choosePreset = (id: string): void => {
    const p = FIELD_VERIFIER_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(p.id);
    setQuery((prev) => ({
      ...p.query,
      mode: prev.mode,
      place: { ...p.query.place },
      observed: { ...p.query.observed },
    }));
    setCompassNorthDeg(p.calibration.compassNorthDeg);
    setHandles(handlesFromObservation(p.query.observed, p.calibration.compassNorthDeg));
  };

  const setMode = (mode: FieldVerifierMode): void => {
    setQuery((prev) => ({ ...prev, mode }));
  };

  const updatePlace = (patch: Partial<FieldVerifierQuery["place"]>): void => {
    setQuery((prev) => ({ ...prev, place: { ...prev.place, ...patch } }));
    setPresetId("custom");
  };

  const updateObserved = (patch: Partial<ObservedConstraints>): void => {
    setQuery((prev) => {
      const nextObs = { ...prev.observed, ...patch };
      if (patch.shadowBearingDeg !== undefined || patch.shadowLengthRatio !== undefined) {
        setHandles(handlesFromObservation(nextObs, compassNorthDeg));
      }
      return { ...prev, observed: nextObs };
    });
    setPresetId("custom");
  };

  const choosePlace = (id: string): void => {
    const p = FIELD_VERIFIER_PLACES.find((x) => x.id === id);
    if (!p) return;
    updatePlace({
      lat: p.lat,
      lonEast: p.lonEast,
      elevationM: p.elevationM,
      slopeDeg: p.slopeDeg,
      slopeAzimuthDeg: p.slopeAzimuthDeg,
    });
  };

  // Counterfactual one-click alignment
  const applyTimeShift = (jdUt: number): void => {
    setQuery((prev) => ({ ...prev, utc: jdUtToIso(jdUt, true) }));
    setPresetId("custom");
  };

  const applyHemisphereFlip = (lat: number): void => {
    setQuery((prev) => ({ ...prev, place: { ...prev.place, lat } }));
    setPresetId("custom");
  };

  // Local photo drop / file pick (zero network upload)
  const loadLocalFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setExifMessage("Select a local JPEG, PNG, or WebP image.");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return nextUrl;
    });
    setPhotoName(file.name);
    const buf = await file.arrayBuffer();
    const exif = parseJpegExif(buf);
    setExifInfo(exif);
    if (exif && (exif.utc || exif.lat !== null || exif.lonEast !== null)) {
      setQuery((prev) => ({
        ...prev,
        utc: exif.utc ?? prev.utc,
        place: {
          ...prev.place,
          lat: exif.lat ?? prev.place.lat,
          lonEast: exif.lonEast ?? prev.place.lonEast,
        },
      }));
      setPresetId("custom");
      const bits: string[] = [];
      if (exif.utc) bits.push(exif.utcVerified ? `UTC ${exif.utc}` : `EXIF time ${exif.utc} (no TZ offset)`);
      if (exif.lat !== null && exif.lonEast !== null) bits.push(`GPS ${exif.lat.toFixed(4)}, ${exif.lonEast.toFixed(4)}`);
      if (exif.make || exif.model) bits.push([exif.make, exif.model].filter(Boolean).join(" "));
      setExifMessage(`Parsed locally (zero upload): ${bits.join(" | ")}.`);
    } else {
      setExifMessage(`Loaded "${file.name}" locally (no EXIF GPS or timestamp found). Drag handles to measure shadow.`);
    }
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    if (f) void loadLocalFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void loadLocalFile(f);
  };

  const clearPhoto = (): void => {
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setPhotoName(null);
    setExifInfo(null);
    setExifMessage("Procedural calibration scene active. Drop a local JPEG or PNG to measure your own photo.");
  };

  // Pointer dragging for calibration handles (attached to outer div, keeping SVG 100% inert)
  const stageCoordsFromPointer = (e: PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = r1(Math.max(12, Math.min(STAGE_W - 12, ((e.clientX - rect.left) / rect.width) * STAGE_W)));
    const y = r1(Math.max(12, Math.min(STAGE_H - 12, ((e.clientY - rect.top) / rect.height) * STAGE_H)));
    return { x, y };
  };

  const onStagePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingHandle) return;
    const pt = stageCoordsFromPointer(e);
    if (!pt) return;
    const next: StageHandles = draggingHandle === "pole"
      ? { ...handles, poleX: handles.baseX, poleY: Math.min(handles.baseY - 12, pt.y) }
      : { ...handles, tipX: pt.x, tipY: pt.y };
    setHandles(next);
    syncHandlesToQuery(next, compassNorthDeg);
  };

  const onStagePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (!draggingHandle) return;
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggingHandle(null);
  };

  const startHandleDrag = (kind: "pole" | "shadow") => (e: PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    stageRef.current?.setPointerCapture(e.pointerId);
    setDraggingHandle(kind);
  };

  const nudgeHandle = (kind: "pole" | "shadow") => (e: KeyboardEvent<HTMLButtonElement>): void => {
    const step = e.shiftKey ? 10 : 2;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    const next: StageHandles = kind === "pole"
      ? { ...handles, poleY: Math.max(14, Math.min(handles.baseY - 12, handles.poleY + dy)) }
      : {
          ...handles,
          tipX: Math.max(12, Math.min(STAGE_W - 12, handles.tipX + dx)),
          tipY: Math.max(12, Math.min(STAGE_H - 12, handles.tipY + dy)),
        };
    setHandles(next);
    syncHandlesToQuery(next, compassNorthDeg);
  };

  const copySource = (): void => {
    void navigator.clipboard?.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Live handle measurements for telemetry strip
  const livePolePx = Math.hypot(handles.poleX - handles.baseX, handles.poleY - handles.baseY);
  const liveShadowPx = Math.hypot(handles.tipX - handles.baseX, handles.tipY - handles.baseY);
  const liveRatio = liveShadowPx / Math.max(8, livePolePx);
  const liveBearing = mod360(
    Math.atan2(handles.tipX - handles.baseX, -(handles.tipY - handles.baseY)) / DEG + compassNorthDeg,
  );
  const obsCount = countObservations(cleanObserved(query.observed));

  const verify = result?.verify ?? null;
  const chrono = result?.chronolocate ?? null;
  const geo = result?.geolocate ?? null;
  const skyTint = activePreset?.calibration.skyTint ?? (verify && !verify.scene.sun.isDay ? "night" : "day");

  return (
    <div className="bench">
      <div className="head">
        <div>
          <span className="lab"><span className="led led--live" />Instrument I-05</span>
          <h1>Field verifier</h1>
        </div>
        <div>
          <p>
            Verify whether a photograph or field report matches solar and lunar
            ephemeris geometry at a claimed date and location, recover plausible
            capture windows when time is unknown, or triangulate Earth
            coordinates from shadows and sky cues. Everything runs in this
            browser on the embedded ephemeris with zero image upload.
          </p>
        </div>
      </div>

      {/* Mode Switcher Bar */}
      <div className="tile s12 fv-modes">
        <div className="tile__h">
          <b>MODE</b>
          <span>Forensic solver</span>
          <i>{MODES.find((m) => m.id === query.mode)?.api}</i>
        </div>
        <div className="tile__b tile__b--compact row row--between row--wrap">
          <div className="seg" role="tablist" aria-label="Field verifier mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                className="tabs__tab"
                aria-selected={query.mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="telemetry">
            <span>{obsCount} {obsCount === 1 ? "constraint" : "constraints"} active</span>
            <span>{result ? `${result.elapsedMs.toFixed(1)} ms in browser` : "check inputs"}</span>
            <span className="badge badge--ok">100% local, never uploaded</span>
          </div>
        </div>
      </div>

      <div className="app">
        {/* LEFT COLUMN: INPUT FORM */}
        <form className="tile" onSubmit={(e) => e.preventDefault()}>
          <div className="tile__h">
            <b>IN</b>
            <span>Claim &amp; observations</span>
            <i>{query.mode}</i>
          </div>

          <div className="fld fld--opt">
            <span />
            <label htmlFor="fv-preset">Preset</label>
            <select id="fv-preset" value={presetId} onChange={(e) => choosePreset(e.target.value)}>
              {FIELD_VERIFIER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              {presetId === "custom" && <option value="custom">Custom input</option>}
            </select>
          </div>

          {(query.mode === "verify" || query.mode === "geolocate") && (
            <div className="fld">
              <span />
              <label htmlFor="fv-utc">UTC time</label>
              <input
                id="fv-utc"
                type="text"
                className="control"
                value={query.utc}
                onChange={(e) => { setQuery({ ...query, utc: e.target.value }); setPresetId("custom"); }}
                placeholder="2026-07-04T19:30:00Z"
              />
            </div>
          )}

          {query.mode === "chronolocate" && (
            <>
              <div className="fld">
                <span />
                <label htmlFor="fv-start">Start UT</label>
                <input
                  id="fv-start"
                  type="text"
                  className="control"
                  value={query.searchStartUtc}
                  onChange={(e) => { setQuery({ ...query, searchStartUtc: e.target.value }); setPresetId("custom"); }}
                />
              </div>
              <div className="fld">
                <span />
                <label htmlFor="fv-end">End UT</label>
                <input
                  id="fv-end"
                  type="text"
                  className="control"
                  value={query.searchEndUtc}
                  onChange={(e) => { setQuery({ ...query, searchEndUtc: e.target.value }); setPresetId("custom"); }}
                />
              </div>
            </>
          )}

          {query.mode !== "geolocate" && (
            <>
              <div className="fld fld--opt">
                <span />
                <label htmlFor="fv-place">Location</label>
                <select id="fv-place" value={placeIdOf(query.place)} onChange={(e) => choosePlace(e.target.value)}>
                  {FIELD_VERIFIER_PLACES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  {placeIdOf(query.place) === "custom" && <option value="custom">Custom coordinates</option>}
                </select>
              </div>
              <div className="fld fld--pair">
                <span />
                <label htmlFor="fv-lat">Lat, lon</label>
                <input
                  id="fv-lat" type="number" inputMode="decimal" step="any" min={-90} max={90}
                  aria-label="Latitude, north positive"
                  value={query.place.lat}
                  onChange={(e) => updatePlace({ lat: Number(e.target.value) })}
                />
                <input
                  type="number" inputMode="decimal" step="any" min={-180} max={180}
                  aria-label="Longitude, east positive"
                  value={query.place.lonEast}
                  onChange={(e) => updatePlace({ lonEast: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          <div className="fld fld--opt fld--pair">
            <span />
            <label htmlFor="fv-elev">Elev, slope</label>
            <input
              id="fv-elev" type="number" inputMode="decimal" step="10"
              aria-label="Elevation in meters"
              title="Elevation (m)"
              value={query.place.elevationM}
              onChange={(e) => updatePlace({ elevationM: Number(e.target.value) })}
            />
            <input
              type="number" inputMode="decimal" step="1" min={0} max={89}
              aria-label="Ground slope in degrees"
              title="Terrain slope (deg)"
              value={query.place.slopeDeg}
              onChange={(e) => updatePlace({ slopeDeg: Number(e.target.value) })}
            />
          </div>

          {query.place.slopeDeg > 0 && (
            <div className="fld fld--opt">
              <span />
              <label htmlFor="fv-slope-az">Slope az</label>
              <input
                id="fv-slope-az" type="number" inputMode="decimal" step="5" min={0} max={360}
                value={query.place.slopeAzimuthDeg}
                onChange={(e) => updatePlace({ slopeAzimuthDeg: Number(e.target.value) })}
              />
            </div>
          )}

          {query.mode === "verify" && (
            <div className="fld fld--opt fld--pair">
              <span />
              <label htmlFor="fv-ttol">Tol min, deg</label>
              <input
                id="fv-ttol" type="number" inputMode="decimal" step="1" min={0}
                aria-label="Time uncertainty tolerance in minutes"
                title="Time uncertainty (+/- min)"
                value={query.timeToleranceMin}
                onChange={(e) => { setQuery({ ...query, timeToleranceMin: Math.max(0, Number(e.target.value)) }); setPresetId("custom"); }}
              />
              <input
                type="number" inputMode="decimal" step="0.1" min={0}
                aria-label="Location uncertainty tolerance in degrees"
                title="Location uncertainty (+/- deg)"
                value={query.placeToleranceDeg}
                onChange={(e) => { setQuery({ ...query, placeToleranceDeg: Math.max(0, Number(e.target.value)) }); setPresetId("custom"); }}
              />
            </div>
          )}

          <div className="fv-obs-group">
            <div className="fld">
              <span />
              <label htmlFor="fv-shd-bear">Shadow az</label>
              <input
                id="fv-shd-bear" type="number" inputMode="decimal" step="0.5"
                placeholder="deg (0=N, 90=E)"
                value={query.observed.shadowBearingDeg ?? ""}
                onChange={(e) => updateObserved({ shadowBearingDeg: parseOptionalNumber(e.target.value) })}
              />
            </div>
            <div className="fld">
              <span />
              <label htmlFor="fv-shd-len">Shadow L/H</label>
              <input
                id="fv-shd-len" type="number" inputMode="decimal" step="0.01" min={0}
                placeholder="ratio e.g. 0.73"
                value={query.observed.shadowLengthRatio ?? ""}
                onChange={(e) => updateObserved({ shadowLengthRatio: parseOptionalNumber(e.target.value) })}
              />
            </div>
            <div className="fld fld--opt">
              <span />
              <label htmlFor="fv-twilight">Lighting</label>
              <select
                id="fv-twilight"
                value={query.observed.twilight ?? ""}
                onChange={(e) => updateObserved({ twilight: (e.target.value || undefined) as TwilightObservation | undefined })}
              >
                {TWILIGHT_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="fld fld--opt">
              <span />
              <label htmlFor="fv-sun-alt">Sun alt</label>
              <input
                id="fv-sun-alt" type="number" inputMode="decimal" step="0.5"
                placeholder="deg (optional)"
                value={query.observed.sunAltitudeDeg ?? ""}
                onChange={(e) => updateObserved({ sunAltitudeDeg: parseOptionalNumber(e.target.value) })}
              />
            </div>
            <div className="fld fld--opt">
              <span />
              <label htmlFor="fv-moon-vis">Moon seen</label>
              <select
                id="fv-moon-vis"
                value={query.observed.moonVisible === undefined ? "" : query.observed.moonVisible ? "yes" : "no"}
                onChange={(e) => updateObserved({
                  moonVisible: e.target.value === "" ? undefined : e.target.value === "yes",
                })}
              >
                <option value="">Unspecified</option>
                <option value="yes">Visible above horizon</option>
                <option value="no">Not visible / below horizon</option>
              </select>
            </div>
            <div className="fld fld--opt fld--pair">
              <span />
              <label htmlFor="fv-moon-limb">Limb, illum</label>
              <input
                id="fv-moon-limb" type="number" inputMode="decimal" step="1"
                placeholder="limb deg"
                aria-label="Moon bright-limb zenith angle in degrees"
                value={query.observed.moonBrightLimbDeg ?? ""}
                onChange={(e) => updateObserved({ moonBrightLimbDeg: parseOptionalNumber(e.target.value) })}
              />
              <input
                type="number" inputMode="decimal" step="0.02" min={0} max={1}
                placeholder="illum 0..1"
                aria-label="Moon illuminated fraction from 0 to 1"
                value={query.observed.moonIllum ?? ""}
                onChange={(e) => updateObserved({ moonIllum: parseOptionalNumber(e.target.value) })}
              />
            </div>
            <div className="fld fld--opt">
              <span />
              <label htmlFor="fv-moon-wax">Moon phase</label>
              <select
                id="fv-moon-wax"
                value={query.observed.moonWaxing === undefined ? "" : query.observed.moonWaxing ? "waxing" : "waning"}
                onChange={(e) => updateObserved({
                  moonWaxing: e.target.value === "" ? undefined : e.target.value === "waxing",
                })}
              >
                <option value="">Any phase side</option>
                <option value="waxing">Waxing</option>
                <option value="waning">Waning</option>
              </select>
            </div>
          </div>

          <p className="note">
            {!validation.ok && validation.issue ? `${validation.issue} ` : ""}
            {activePreset ? activePreset.note : `Chronolocate spans up to ${FIELD_VERIFIER_MAX_SPAN_DAYS} days. East longitude is positive.`}
          </p>
        </form>

        {/* CENTER COLUMN: OUTPUTS, CANVAS, FIGURES & TABLES */}
        <div className="col">
          {/* ===================== MODE 1: VERIFY ===================== */}
          {query.mode === "verify" && (
            <>
              {/* Interactive Zero-Upload Photo Shadow Calibration Canvas */}
              <section className="tile fv-canvas">
                <div className="tile__h">
                  <b>CAL</b>
                  <span>Zero-upload photo shadow calibration</span>
                  <i>100% local, never uploaded</i>
                </div>

                <div
                  className={`fv-dropzone${dragOver ? " fv-dropzone--drag" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <div className="row row--between row--wrap">
                    <span>
                      <span className="badge badge--ok">Local only</span>{" "}
                      {photoName ? `Measuring ${photoName}` : "Drop a local JPEG/PNG or drag handles on the calibration stage"}
                    </span>
                    <div className="row row--wrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onFileChange}
                        aria-label="Choose a local photo for shadow calibration"
                        hidden
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Pick local photo
                      </button>
                      {photoUrl && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={clearPhoto}>
                          Use calibration scene
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="note">{exifMessage}</p>
                </div>

                {/* Interactive Stage: Inert SVG overlay + native draggable HTML handle buttons */}
                <div
                  ref={stageRef}
                  className="fv-stage"
                  data-tint={skyTint}
                  onPointerMove={onStagePointerMove}
                  onPointerUp={onStagePointerUp}
                  onPointerCancel={onStagePointerUp}
                >
                  {photoUrl && (
                    <img src={photoUrl} alt="Local photo loaded in browser memory for shadow measurement" className="fv-stage__img" />
                  )}
                  <svg
                    className="fv-stage__svg"
                    viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
                    role="img"
                    aria-label={`Interactive shadow calibration stage. Measured bearing ${r1(liveBearing)} degrees, shadow length ratio ${liveRatio.toFixed(2)}.`}
                  >
                    {/* Procedural calibration backdrop when no local photo is loaded */}
                    {!photoUrl && (
                      <g>
                        <rect x={0} y={0} width={STAGE_W} height={116} fill="var(--panel-inset)" />
                        <rect x={0} y={116} width={STAGE_W} height={STAGE_H - 116} fill="var(--panel2)" />
                        <line x1={0} y1={116} x2={STAGE_W} y2={116} stroke="var(--line2)" strokeWidth={1} />
                        {query.place.slopeDeg > 0 && (
                          <line
                            x1={0} y1={r1(178 - Math.tan(query.place.slopeDeg * DEG) * 80)}
                            x2={STAGE_W} y2={r1(178 + Math.tan(query.place.slopeDeg * DEG) * 80)}
                            stroke="var(--line2)" strokeWidth={0.9} strokeDasharray="4 3"
                          />
                        )}
                        {/* Mini North indicator inside stage */}
                        <g>
                          <circle cx={42} cy={40} r={16} fill="none" stroke="var(--line2)" strokeWidth={0.8} />
                          <line
                            x1={42} y1={40}
                            x2={r1(42 + 12 * Math.sin(-compassNorthDeg * DEG))}
                            y2={r1(40 - 12 * Math.cos(-compassNorthDeg * DEG))}
                            stroke="var(--accent)" strokeWidth={1.6}
                          />
                          <text x={42} y={66} textAnchor="middle" fill="var(--faint)" fontSize={8.5} fontFamily="var(--mono)">
                            N {Math.round(compassNorthDeg)}°
                          </text>
                        </g>
                        {/* Crescent Moon visual cue when lunar constraints are active */}
                        {query.observed.moonBrightLimbDeg !== undefined && (
                          <g>
                            <circle cx={386} cy={54} r={18} fill="var(--panel)" stroke="var(--wheel-planet-moon, var(--dim))" strokeWidth={1.2} />
                            <line
                              x1={386} y1={54}
                              x2={r1(386 + 24 * Math.cos(query.observed.moonBrightLimbDeg * DEG))}
                              y2={r1(54 - 24 * Math.sin(query.observed.moonBrightLimbDeg * DEG))}
                              stroke="var(--warm)" strokeWidth={2}
                            />
                            <text x={386} y={84} textAnchor="middle" fill="var(--dim)" fontSize={9} fontFamily="var(--mono)">
                              Observed limb {r1(query.observed.moonBrightLimbDeg)}°
                            </text>
                          </g>
                        )}
                        <text x={STAGE_W - 10} y={STAGE_H - 8} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
                          {activePreset ? activePreset.calibration.caption : "Drag handles to measure pole height and shadow tip"}
                        </text>
                      </g>
                    )}

                    {/* Reference pole base cross */}
                    <line x1={handles.baseX - 7} y1={handles.baseY} x2={handles.baseX + 7} y2={handles.baseY} stroke="var(--text)" strokeWidth={1} />
                    <line x1={handles.baseX} y1={handles.baseY - 7} x2={handles.baseX} y2={handles.baseY + 7} stroke="var(--text)" strokeWidth={1} />

                    {/* Vertical pole vector (violet --accent) */}
                    <line
                      x1={handles.baseX} y1={handles.baseY}
                      x2={handles.poleX} y2={handles.poleY}
                      stroke="var(--accent)" strokeWidth={2.4}
                    />
                    <text x={handles.poleX + 10} y={r1((handles.baseY + handles.poleY) / 2)} fill="var(--accent)" fontSize={9.5} fontFamily="var(--mono)">
                      Pole H ({Math.round(livePolePx)} px)
                    </text>

                    {/* Cast shadow vector (peach --warm) */}
                    <line
                      x1={handles.baseX} y1={handles.baseY}
                      x2={handles.tipX} y2={handles.tipY}
                      stroke="var(--warm)" strokeWidth={2.4}
                    />
                    <text
                      x={r1((handles.baseX + handles.tipX) / 2)}
                      y={r1((handles.baseY + handles.tipY) / 2 - 8)}
                      textAnchor="middle"
                      fill="var(--warm)" fontSize={9.5} fontFamily="var(--mono)"
                    >
                      Shadow L ({Math.round(liveShadowPx)} px)
                    </text>
                  </svg>

                  {/* Accessible draggable handle buttons positioned via percentages */}
                  <button
                    type="button"
                    className="fv-handle fv-handle--pole"
                    style={{ left: `${(handles.poleX / STAGE_W) * 100}%`, top: `${(handles.poleY / STAGE_H) * 100}%` }}
                    aria-label="Drag or use arrow keys to adjust vertical pole height"
                    onPointerDown={startHandleDrag("pole")}
                    onKeyDown={nudgeHandle("pole")}
                  >
                    H
                  </button>
                  <button
                    type="button"
                    className="fv-handle fv-handle--shadow"
                    style={{ left: `${(handles.tipX / STAGE_W) * 100}%`, top: `${(handles.tipY / STAGE_H) * 100}%` }}
                    aria-label="Drag or use arrow keys to adjust cast shadow tip"
                    onPointerDown={startHandleDrag("shadow")}
                    onKeyDown={nudgeHandle("shadow")}
                  >
                    L
                  </button>
                </div>

                <div className="fv-stage__controls">
                  <label htmlFor="fv-north-offset">
                    Compass North offset: <strong>{Math.round(compassNorthDeg)}°</strong>
                  </label>
                  <input
                    id="fv-north-offset"
                    type="range"
                    min={0}
                    max={359}
                    step={1}
                    value={Math.round(compassNorthDeg)}
                    onChange={(e) => {
                      const nextNorth = Number(e.target.value);
                      setCompassNorthDeg(nextNorth);
                      syncHandlesToQuery(handles, nextNorth);
                    }}
                  />
                  <div className="telemetry">
                    <span>Measured L/H = {liveRatio.toFixed(3)}</span>
                    <span>Bearing = {r1(liveBearing)}°</span>
                    {exifInfo?.lat != null && exifInfo?.lonEast != null && (
                      <span>EXIF GPS {exifInfo.lat.toFixed(3)}, {exifInfo.lonEast.toFixed(3)}</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Verdict + Figure 1 Compass Dial */}
              <section className="tile">
                <div className="tile__h">
                  <b>OUT</b>
                  <span>Verification verdict &amp; compass dial</span>
                  <i>caelus {VERSION}, embedded tier</i>
                </div>
                {!verify ? (
                  <p className="empty">{validation.issue ?? "Enter a valid timestamp and coordinates to verify."}</p>
                ) : (
                  <>
                    <div className="fv-verdict">
                      <span className={verdictBadgeClass(verify.verdict)} data-verdict={verify.verdict}>
                        {verify.verdict}
                      </span>
                      <span className="fv-verdict__score">
                        Score: <strong>{verify.consistencyScore !== null ? verify.consistencyScore.toFixed(3) : "n/a"}</strong>
                      </span>
                      <span className="fv-verdict__line telemetry">{verify.scene.chronosense.line}</span>
                    </div>

                    {dialGeom && <CompassDialFigure geom={dialGeom} />}

                    <div className="telemetry">
                      <span>Sun az {verify.scene.sun.azimuthDeg.toFixed(1)}° / alt {verify.scene.sun.altitudeApparentDeg.toFixed(1)}°</span>
                      <span>
                        Predicted shadow {verify.scene.shadow.cast && verify.scene.shadow.bearingDeg !== null
                          ? `${verify.scene.shadow.bearingDeg.toFixed(1)}° (L/H ${verify.scene.shadow.lengthRatio?.toFixed(3) ?? "grazing"})`
                          : verify.scene.shadow.selfShadowed ? "self-shadowed slope" : "none (Sun below horizon)"}
                      </span>
                      <span>
                        Moon {verify.scene.moon.visible
                          ? `alt ${verify.scene.moon.altitudeApparentDeg.toFixed(1)}°, ${Math.round(verify.scene.moon.illum * 100)}% lit, limb ${verify.scene.moon.brightLimbZenithDeg?.toFixed(1) ?? "n/a"}°`
                          : "below horizon"}
                      </span>
                    </div>
                  </>
                )}
              </section>

              {/* Counterfactual Forensics Card (when inconsistent or impossible) */}
              {verify?.diagnostics && (
                <section className="tile fv-cf-card" aria-label="Counterfactual forensic diagnostics">
                  <div className="tile__h">
                    <b>CF</b>
                    <span>Counterfactual diagnostics</span>
                    <i>single-axis forensics</i>
                  </div>
                  <div className="tile__b">
                    <p>{verify.diagnostics.summary}</p>
                    <div className="fv-cf-list">
                      <div className="fv-cf-row">
                        <div>
                          <strong>Clock / timezone shift</strong>
                          <span className="telemetry">
                            {" "}
                            {verify.diagnostics.timeShift.offsetMinutes >= 0 ? "+" : ""}
                            {Math.round(verify.diagnostics.timeShift.offsetMinutes)} min
                            {" "}(nearest {verify.diagnostics.timeShift.nearestWholeHourOffset >= 0 ? "+" : ""}
                            {verify.diagnostics.timeShift.nearestWholeHourOffset}h) | score {verify.diagnostics.timeShift.fitScore.toFixed(2)}
                          </span>{" "}
                          <span className={verdictBadgeClass(verify.diagnostics.timeShift.verdict)}>
                            {verify.diagnostics.timeShift.verdict}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm fv-cf-apply"
                          onClick={() => applyTimeShift(verify.diagnostics!.timeShift.jdUt)}
                        >
                          Apply counterfactual
                        </button>
                      </div>

                      <div className="fv-cf-row">
                        <div>
                          <strong>Hemisphere latitude flip</strong>
                          <span className="telemetry">
                            {" "}lat {verify.diagnostics.hemisphereFlip.lat.toFixed(4)}° | score {verify.diagnostics.hemisphereFlip.fitScore.toFixed(2)}
                          </span>{" "}
                          <span className={verdictBadgeClass(verify.diagnostics.hemisphereFlip.verdict)}>
                            {verify.diagnostics.hemisphereFlip.verdict}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm fv-cf-apply"
                          onClick={() => applyHemisphereFlip(verify.diagnostics!.hemisphereFlip.lat)}
                        >
                          Apply counterfactual
                        </button>
                      </div>

                      {verify.diagnostics.dateShift && (
                        <div className="fv-cf-row">
                          <div>
                            <strong>Seasonal date shift</strong>
                            <span className="telemetry">
                              {" "}
                              {verify.diagnostics.dateShift.offsetDays >= 0 ? "+" : ""}
                              {Math.round(verify.diagnostics.dateShift.offsetDays)} days | score {verify.diagnostics.dateShift.fitScore.toFixed(2)}
                            </span>{" "}
                            <span className={verdictBadgeClass(verify.diagnostics.dateShift.verdict)}>
                              {verify.diagnostics.dateShift.verdict}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm fv-cf-apply"
                            onClick={() => applyTimeShift(verify.diagnostics!.dateShift!.jdUt)}
                          >
                            Apply counterfactual
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Per-check Residual Supertable (C6 Tufte table with inline 0..2x tolerance bar) */}
              {verify && (
                <section className="tile">
                  <div className="tile__h">
                    <b>CHK</b>
                    <span>Per-check residuals</span>
                    <i>{verify.checks.length} evaluated</i>
                  </div>
                  {verify.checks.length === 0 ? (
                    <p className="empty">Add at least one shadow, sky lighting, or lunar observation to evaluate residuals.</p>
                  ) : (
                    <div className="scroll">
                      <table className="rd">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th className="r">Observed</th>
                            <th className="r">Predicted</th>
                            <th className="r">Residual</th>
                            <th className="r">Tol</th>
                            <th>Ratio (0..2x)</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verify.checks.map((c) => {
                            const norm = c.normalizedResidual ?? (c.status === "impossible" ? 2 : 0);
                            const pct = Math.min(100, Math.max(0, (norm / 2) * 100));
                            const fillTone = c.status === "consistent"
                              ? "fv-resbar__fill--ok"
                              : c.status === "marginal"
                                ? "fv-resbar__fill--warn"
                                : "fv-resbar__fill--bad";
                            return (
                              <tr key={c.field}>
                                <td className="em">{c.field}</td>
                                <td className="r">{fmtCheckValue(c.observed)}</td>
                                <td className="r">{fmtCheckValue(c.expected)}</td>
                                <td className="r">{c.residual !== null ? c.residual.toFixed(2) : "n/a"}</td>
                                <td className="r">{c.tolerance !== null ? c.tolerance.toFixed(2) : "n/a"}</td>
                                <td>
                                  <div className="fv-resbar" title={`|residual| / tolerance = ${norm.toFixed(2)}x`}>
                                    <div className="fv-resbar__track">
                                      <i className={`fv-resbar__fill ${fillTone}`} style={{ width: `${pct}%` }} />
                                      <span className="fv-resbar__mark" aria-hidden="true" />
                                    </div>
                                  </div>
                                </td>
                                <td><span className={statusBadgeClass(c.status)}>{c.status}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* ===================== MODE 2: CHRONOLOCATE ===================== */}
          {query.mode === "chronolocate" && (
            <>
              <section className="tile">
                <div className="tile__h">
                  <b>OUT</b>
                  <span>Matching UTC windows</span>
                  <i>{chrono ? `${chrono.daysScanned} d scanned, ${chrono.daysPruned} d pruned` : ""}</i>
                </div>
                {!chrono ? (
                  <p className="empty">{validation.issue ?? "Enter a valid location, search span, and observation."}</p>
                ) : (
                  <>
                    <div className="count">
                      <b>{chrono.windows.length}</b>
                      <span>{chrono.windows.length === 1 ? "window" : "windows"}</span>
                      <i>
                        {chrono.windows.length > 0
                          ? `Best peak: ${shortUtcLabel(chrono.windows[0].bestJd)} (score ${chrono.windows[0].fitScore.toFixed(3)})`
                          : "No UTC window matches all active constraints in this span"}
                        <br />
                        {shortUtcLabel(chrono.jdStart)} to {shortUtcLabel(chrono.jdEnd)}
                      </i>
                    </div>
                    {timelineGeom && <TimelineFigure geom={timelineGeom} />}
                  </>
                )}
              </section>

              {analemmaMap && (
                <section className="tile">
                  <div className="tile__h">
                    <b>ANL</b>
                    <span>12x24 solar analemma feasibility grid</span>
                    <i>{analemmaMap.year} at {query.place.lat.toFixed(2)}°, {query.place.lonEast.toFixed(2)}°</i>
                  </div>
                  <AnalemmaHeatmapFigure map={analemmaMap} />
                </section>
              )}

              {chrono && (
                <section className="tile">
                  <div className="tile__h">
                    <b>TBL</b>
                    <span>Chronolocation windows</span>
                    <i>UTC, ranked by scan order</i>
                  </div>
                  {chrono.windows.length === 0 ? (
                    <p className="empty">No matching window in this search interval. Try widening the date span or relaxing one constraint.</p>
                  ) : (
                    <div className="scroll">
                      <table className="rd">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Start UT</th>
                            <th>Peak UT</th>
                            <th>End UT</th>
                            <th className="r">Duration (min)</th>
                            <th className="r">Fit score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chrono.windows.map((w, i) => (
                            <tr key={`${w.jdStart}-${i}`}>
                              <td className="up">{i + 1}</td>
                              <td>{shortUtcLabel(w.jdStart)}</td>
                              <td className="em">{shortUtcLabel(w.bestJd)}</td>
                              <td>{shortUtcLabel(w.jdEnd)}</td>
                              <td className="r">{w.durationMinutes.toFixed(1)}</td>
                              <td className="r">{w.fitScore.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* ===================== MODE 3: GEOLOCATE ===================== */}
          {query.mode === "geolocate" && (
            <>
              <section className="tile">
                <div className="tile__h">
                  <b>OUT</b>
                  <span>Global fix plot</span>
                  <i>{geo ? (geo.method === "analytical" ? "Path A analytical fix" : "Path B spherical grid") : ""}</i>
                </div>
                {!geo ? (
                  <p className="empty">{validation.issue ?? "Enter a UTC timestamp and physical observations to geolocate."}</p>
                ) : (
                  <>
                    <div className="count">
                      <b>{geo.candidates.length}</b>
                      <span>{geo.candidates.length === 1 ? "candidate" : "candidates"}</span>
                      <i>
                        {geo.candidates.length > 0
                          ? `Top fix: ${geo.candidates[0].lat.toFixed(2)}°, ${geo.candidates[0].lon.toFixed(2)}° (±${Math.round(geo.candidates[0].radiusKm)} km, ${geo.candidates[0].regionKind})`
                          : "No Earth coordinate fits all active constraints at this UTC instant"}
                        <br />
                        Sub-solar {geo.subsolar.lat.toFixed(1)}°, {geo.subsolar.lon.toFixed(1)}° | Sub-lunar {geo.sublunar.lat.toFixed(1)}°, {geo.sublunar.lon.toFixed(1)}°
                      </i>
                    </div>
                    {fixMapGeom && <FixMapFigure geom={fixMapGeom} />}
                  </>
                )}
              </section>

              {geo && (
                <section className="tile">
                  <div className="tile__h">
                    <b>TBL</b>
                    <span>Candidate coordinates</span>
                    <i>{geo.method}</i>
                  </div>
                  {geo.candidates.length === 0 ? (
                    <p className="empty">No candidate coordinates match at {query.utc}.</p>
                  ) : (
                    <div className="scroll">
                      <table className="rd">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th className="r">Latitude (deg)</th>
                            <th className="r">Longitude (deg)</th>
                            <th className="r">Radius (km)</th>
                            <th>Region</th>
                            <th className="r">Fit score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {geo.candidates.map((c, i) => (
                            <tr key={`${c.lat}-${c.lon}-${i}`}>
                              <td className="up">{i + 1}</td>
                              <td className="r em">{c.lat.toFixed(3)}</td>
                              <td className="r em">{c.lon.toFixed(3)}</td>
                              <td className="r">{c.radiusKm.toFixed(1)}</td>
                              <td>{c.regionKind}</td>
                              <td className="r">{c.fitScore.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: COPYABLE TYPESCRIPT CALL & RETURN VALUE */}
        <div className="col code">
          <section className="tile">
            <div className="tile__h">
              <b>TS</b>
              <span>TypeScript call</span>
              <button type="button" onClick={copySource}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre className="code">{source}</pre>
          </section>
          <section className="tile">
            <div className="tile__h">
              <b>RET</b>
              <span>Return value</span>
              <i>{query.mode}</i>
            </div>
            <pre className="code">{returned}</pre>
          </section>
        </div>
      </div>

      {/* BOTTOM METHOD & LIMITS TILES (M-1, M-2, M-3) */}
      <section className="tile s4 half">
        <div className="tile__h"><b>M-1</b><span>Forward shadow and refraction model</span></div>
        <div className="tile__b prose">
          <p>
            Solar and lunar horizontal coordinates include barometric
            atmospheric refraction scaled to observer elevation. On sloped
            terrain, cast shadow bearings and length ratios come from exact 3D
            ray-plane intersection against the tilted surface normal rather than
            flat-ground cotangent formulas. Lunar bright-limb orientation is
            projected in the Moon&apos;s local zenith tangent frame so camera lens
            focal length does not distort the angle.
          </p>
        </div>
      </section>

      <section className="tile s4 half">
        <div className="tile__h"><b>M-2</b><span>Tolerance widening and counterfactual forensics</span></div>
        <div className="tile__b prose">
          <p>
            When time or place uncertainty tolerances are supplied,{" "}
            <code>verifyObservation</code> widens each residual band using local
            angular drift rates before classifying a check. When a claim evaluates
            as inconsistent or impossible, the solver probes same-day clock shifts,
            latitude sign flips, and seasonal date shifts so single-axis metadata
            errors surface directly with one-click alignment.
          </p>
        </div>
      </section>

      <section className="tile s4">
        <div className="tile__h"><b>M-3</b><span>Embedded-tier browser limits and privacy</span></div>
        <div className="tile__b prose">
          <p>
            Every calculation, JPEG EXIF parse, and calibration drag runs locally
            in browser memory on Caelus&apos;s embedded ephemeris tier (solar and
            lunar accuracy suitable for AD 1920 to 2080 within 0.02 degrees). No
            photo bytes or coordinates ever leave your device. For historical
            dates outside the embedded lunar window or sub-arcsecond reference
            checks, run the generated call in Node or Python against the full
            JPL ephemeris packs.
          </p>
        </div>
      </section>
    </div>
  );
}
