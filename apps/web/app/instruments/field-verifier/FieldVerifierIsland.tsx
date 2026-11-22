"use client";

import { useEffect, useMemo, useState } from "react";
import { Engine, type ObservedConstraints } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import {
  FIELD_VERIFIER_PRESETS,
  fieldVerifierSource,
  runFieldVerifier,
  type FieldVerifierMode,
  type FieldVerifierQuery,
} from "caelus-widgets/field-verifier";
import { FieldVerifier } from "caelus-widgets/field-verifier-widget";
import InstrumentWorkbench, {
  useUrlPreset,
  type InstrumentCodeBundle,
  type InstrumentPresetOption,
} from "../InstrumentWorkbench";

const VALID_MODES: readonly FieldVerifierMode[] = ["verify", "chronolocate", "geolocate"];

const PRESET_OPTIONS: InstrumentPresetOption[] = FIELD_VERIFIER_PRESETS.map((p) => ({
  id: p.id,
  label: p.shortLabel || p.label,
  summary: p.summary,
}));
const VALID_PRESETS = PRESET_OPTIONS.map((p) => p.id);
const DEFAULT_PRESET = FIELD_VERIFIER_PRESETS[0]?.id ?? "nyc-summer-authentic";

function toSnakeObserved(obs: ObservedConstraints): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obs.shadowBearingDeg !== undefined) out.shadow_bearing_deg = obs.shadowBearingDeg;
  if (obs.shadowLengthRatio !== undefined) out.shadow_length_ratio = obs.shadowLengthRatio;
  if (obs.sunAzimuthDeg !== undefined) out.sun_azimuth_deg = obs.sunAzimuthDeg;
  if (obs.sunAltitudeDeg !== undefined) out.sun_altitude_deg = obs.sunAltitudeDeg;
  if (obs.twilight !== undefined) out.twilight = obs.twilight;
  if (obs.sunVisible !== undefined) out.sun_visible = obs.sunVisible;
  if (obs.moonVisible !== undefined) out.moon_visible = obs.moonVisible;
  if (obs.moonAzimuthDeg !== undefined) out.moon_azimuth_deg = obs.moonAzimuthDeg;
  if (obs.moonAltitudeDeg !== undefined) out.moon_altitude_deg = obs.moonAltitudeDeg;
  if (obs.moonIllum !== undefined) out.moon_illum = obs.moonIllum;
  if (obs.moonWaxing !== undefined) out.moon_waxing = obs.moonWaxing;
  if (obs.moonBrightLimbDeg !== undefined) out.moon_bright_limb_deg = obs.moonBrightLimbDeg;
  if (obs.bodiesVisible !== undefined) out.bodies_visible = obs.bodiesVisible;
  if (obs.shadowSweep !== undefined) {
    out.shadow_sweep = {
      dt_minutes: obs.shadowSweep.dtMinutes,
      delta_bearing_deg: obs.shadowSweep.deltaBearingDeg,
      ...(obs.shadowSweep.toleranceDeg !== undefined
        ? { tolerance_deg: obs.shadowSweep.toleranceDeg }
        : {}),
    };
  }
  return out;
}

function isoToPyJd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "julian_day(2026, 7, 4, 19, 30, 0)";
  return `julian_day(${d.getUTCFullYear()}, ${d.getUTCMonth() + 1}, ${d.getUTCDate()}, ${d.getUTCHours()}, ${d.getUTCMinutes()}, ${d.getUTCSeconds()})`;
}

function pyLit(val: unknown): string {
  if (val === null || val === undefined) return "None";
  if (typeof val === "boolean") return val ? "True" : "False";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(pyLit).join(", ")}]`;
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${pyLit(v)}`).join(", ")}}`;
  }
  return String(val);
}

function pythonSnippet(q: FieldVerifierQuery): string {
  const obs = toSnakeObserved(q.observed);
  const obsLines = Object.entries(obs).map(([k, v]) => `    ${JSON.stringify(k)}: ${pyLit(v)},`);

  if (q.mode === "chronolocate") {
    const placeEntries: string[] = [
      `"lat": ${q.place.lat}`,
      `"lon_east": ${q.place.lonEast}`,
    ];
    if (q.place.elevationM) placeEntries.push(`"elevation_m": ${q.place.elevationM}`);
    if (q.place.slopeDeg) {
      placeEntries.push(`"slope_deg": ${q.place.slopeDeg}`);
      placeEntries.push(`"slope_azimuth_deg": ${q.place.slopeAzimuthDeg}`);
    }
    return [
      `from astroengine import Engine`,
      `from astroengine.core import julian_day`,
      `from astroengine.observe import chronolocate`,
      ``,
      `engine = Engine()`,
      `observed = {`,
      ...obsLines,
      `}`,
      `result = chronolocate(`,
      `    engine,`,
      `    {${placeEntries.join(", ")}},`,
      `    observed,`,
      `    ${isoToPyJd(q.searchStartUtc)},`,
      `    ${isoToPyJd(q.searchEndUtc)},`,
      `)`,
    ].join("\n");
  }

  if (q.mode === "geolocate") {
    const extras: string[] = [];
    if (q.place.elevationM) extras.push(`    elevation_m=${q.place.elevationM},`);
    if (q.place.slopeDeg) {
      extras.push(`    slope_deg=${q.place.slopeDeg},`);
      extras.push(`    slope_azimuth_deg=${q.place.slopeAzimuthDeg},`);
    }
    if (q.gridStepDeg) extras.push(`    grid_step_deg=${q.gridStepDeg},`);
    return [
      `from astroengine import Engine`,
      `from astroengine.core import julian_day`,
      `from astroengine.observe import geolocate`,
      ``,
      `engine = Engine()`,
      `observed = {`,
      ...obsLines,
      `}`,
      `result = geolocate(`,
      `    engine,`,
      `    ${isoToPyJd(q.utc)},`,
      `    observed,`,
      ...extras,
      `)`,
    ].join("\n");
  }

  const claimLines: string[] = [
    `    "jd_ut": ${isoToPyJd(q.utc)},`,
    `    "lat": ${q.place.lat},`,
    `    "lon_east": ${q.place.lonEast},`,
  ];
  if (q.place.elevationM) claimLines.push(`    "elevation_m": ${q.place.elevationM},`);
  if (q.place.slopeDeg) {
    claimLines.push(`    "slope_deg": ${q.place.slopeDeg},`);
    claimLines.push(`    "slope_azimuth_deg": ${q.place.slopeAzimuthDeg},`);
  }
  if (q.timeToleranceMin) claimLines.push(`    "time_tolerance_min": ${q.timeToleranceMin},`);
  if (q.placeToleranceDeg) claimLines.push(`    "place_tolerance_deg": ${q.placeToleranceDeg},`);

  return [
    `from astroengine import Engine`,
    `from astroengine.core import julian_day`,
    `from astroengine.observe import verify_observation`,
    ``,
    `engine = Engine()`,
    `claim = {`,
    ...claimLines,
    `}`,
    `observed = {`,
    ...obsLines,
    `}`,
    `result = verify_observation(engine, claim, observed)`,
  ].join("\n");
}

function mcpSnippet(q: FieldVerifierQuery): string {
  const observed = toSnakeObserved(q.observed);

  if (q.mode === "chronolocate") {
    const args: Record<string, unknown> = {
      lat: q.place.lat,
      lon: q.place.lonEast,
      start: q.searchStartUtc,
      end: q.searchEndUtc,
      observed,
    };
    if (q.place.elevationM) args.elevation_m = q.place.elevationM;
    if (q.place.slopeDeg) {
      args.slope_deg = q.place.slopeDeg;
      args.slope_azimuth_deg = q.place.slopeAzimuthDeg;
    }
    return JSON.stringify({ tool: "chronolocate", arguments: args }, null, 2);
  }

  if (q.mode === "geolocate") {
    const args: Record<string, unknown> = {
      date: q.utc,
      observed,
    };
    if (q.place.elevationM) args.elevation_m = q.place.elevationM;
    if (q.place.slopeDeg) {
      args.slope_deg = q.place.slopeDeg;
      args.slope_azimuth_deg = q.place.slopeAzimuthDeg;
    }
    if (q.gridStepDeg) args.grid_step_deg = q.gridStepDeg;
    return JSON.stringify({ tool: "geolocate", arguments: args }, null, 2);
  }

  const args: Record<string, unknown> = {
    date: q.utc,
    lat: q.place.lat,
    lon: q.place.lonEast,
  };
  if (q.place.elevationM) args.elevation_m = q.place.elevationM;
  if (q.place.slopeDeg) {
    args.slope_deg = q.place.slopeDeg;
    args.slope_azimuth_deg = q.place.slopeAzimuthDeg;
  }
  if (q.timeToleranceMin) args.time_tolerance_min = q.timeToleranceMin;
  if (q.placeToleranceDeg) args.place_tolerance_deg = q.placeToleranceDeg;
  if (Object.keys(observed).length > 0) args.observed = observed;

  return JSON.stringify({ tool: "verify_observation", arguments: args }, null, 2);
}

export default function FieldVerifierIsland() {
  const engine = useMemo(() => new Engine(embeddedData), []);
  const [preset, setPreset] = useUrlPreset(VALID_PRESETS, DEFAULT_PRESET);
  const [urlMode, setUrlMode] = useState<FieldVerifierMode | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("mode");
    if (raw && (VALID_MODES as readonly string[]).includes(raw)) {
      setUrlMode(raw as FieldVerifierMode);
    }
  }, []);

  const selectedPreset =
    FIELD_VERIFIER_PRESETS.find((p) => p.id === preset) ?? FIELD_VERIFIER_PRESETS[0];
  const effectiveMode: FieldVerifierMode = urlMode ?? selectedPreset.defaultMode;

  function handleSelectPreset(nextPreset: string) {
    setPreset(nextPreset);
    setUrlMode(undefined);
  }

  const code = useMemo<InstrumentCodeBundle>(() => {
    const query: FieldVerifierQuery = {
      ...selectedPreset.query,
      mode: effectiveMode,
    };

    return {
      ts: fieldVerifierSource(query),
      python: pythonSnippet(query),
      mcp: mcpSnippet(query),
      // Lazy thunk: never execute observation solvers during SSR or initial render.
      json: () => {
        try {
          const res = runFieldVerifier(engine, query);
          if (res.mode === "chronolocate" && res.chronolocate) {
            return {
              preset: selectedPreset.id,
              mode: res.mode,
              place: query.place,
              span: [query.searchStartUtc, query.searchEndUtc],
              daysScanned: res.chronolocate.daysScanned,
              daysPruned: res.chronolocate.daysPruned,
              windowCount: res.chronolocate.windows.length,
              windows: res.chronolocate.windows.slice(0, 10).map((w) => ({
                jdStart: Number(w.jdStart.toFixed(5)),
                bestJd: Number(w.bestJd.toFixed(5)),
                jdEnd: Number(w.jdEnd.toFixed(5)),
                durationMinutes: Number(w.durationMinutes.toFixed(1)),
                fitScore: Number(w.fitScore.toFixed(3)),
              })),
            };
          }
          if (res.mode === "geolocate" && res.geolocate) {
            return {
              preset: selectedPreset.id,
              mode: res.mode,
              utc: query.utc,
              method: res.geolocate.method,
              subsolar: {
                lat: Number(res.geolocate.subsolar.lat.toFixed(3)),
                lon: Number(res.geolocate.subsolar.lon.toFixed(3)),
              },
              sublunar: {
                lat: Number(res.geolocate.sublunar.lat.toFixed(3)),
                lon: Number(res.geolocate.sublunar.lon.toFixed(3)),
              },
              candidateCount: res.geolocate.candidates.length,
              candidates: res.geolocate.candidates.slice(0, 8).map((c) => ({
                lat: Number(c.lat.toFixed(3)),
                lon: Number(c.lon.toFixed(3)),
                radiusKm: Math.round(c.radiusKm),
                regionKind: c.regionKind,
                fitScore: Number(c.fitScore.toFixed(3)),
              })),
            };
          }
          if (res.verify) {
            return {
              preset: selectedPreset.id,
              mode: res.mode,
              utc: query.utc,
              place: query.place,
              verdict: res.verify.verdict,
              consistencyScore:
                res.verify.consistencyScore != null
                  ? Number(res.verify.consistencyScore.toFixed(3))
                  : null,
              chronosense: res.verify.scene.chronosense.line,
              checks: res.verify.checks.map((c) => ({
                field: c.field,
                status: c.status,
                observed: c.observed,
                expected: c.expected,
                residual: c.residual != null ? Number(c.residual.toFixed(3)) : null,
                tolerance: c.tolerance != null ? Number(c.tolerance.toFixed(3)) : null,
              })),
              diagnostics: res.verify.diagnostics
                ? {
                    summary: res.verify.diagnostics.summary,
                    timeShift: res.verify.diagnostics.timeShift,
                    hemisphereFlip: res.verify.diagnostics.hemisphereFlip,
                    dateShift: res.verify.diagnostics.dateShift,
                  }
                : null,
            };
          }
          return { preset: selectedPreset.id, mode: query.mode, utc: query.utc };
        } catch {
          return { preset: selectedPreset.id, mode: query.mode, utc: query.utc };
        }
      },
    };
  }, [engine, selectedPreset, effectiveMode]);

  return (
    <InstrumentWorkbench
      id="I-05"
      title="Field verifier"
      presets={PRESET_OPTIONS}
      activePreset={preset}
      onSelectPreset={handleSelectPreset}
      code={code}
    >
      <FieldVerifier
        key={`${preset}:${effectiveMode}`}
        engine={engine}
        initialPreset={preset}
        initialMode={effectiveMode}
      />
    </InstrumentWorkbench>
  );
}
