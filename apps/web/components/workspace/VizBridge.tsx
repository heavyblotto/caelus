"use client";

import type { ComponentType } from "react";
import {
  ChartWheel,
  ChartSphere,
  Kundli,
  AstroMap,
  EphemerisGraph,
  type ChartWheelProps,
  type ChartSphereProps,
  type KundliProps,
  type AstroMapProps,
  type EphemerisGraphProps,
  type WheelAspect,
} from "caelus-wheel";
import SkyViewTab from "../SkyViewTab";
import type { Engine } from "caelus";

/**
 * Shared interactive selection/hover contract aligned with caelus-wheel's
 * backwards-compatible prop upgrades (selectedBody / hoveredBody / callbacks).
 * Casting via ComponentType keeps isolated share branches compiling cleanly
 * before branch integration while forwarding the exact runtime props.
 */
export interface InteractiveSelectionProps {
  selectedBody?: string | null;
  hoveredBody?: string | null;
  onSelectBody?: (body: string | null) => void;
  onHoverBody?: (body: string | null) => void;
}

export interface InteractiveChartWheelExtra extends InteractiveSelectionProps {
  selectedAspect?: { a: string; b: string; aspect?: string } | null;
  onSelectAspect?: (aspect: WheelAspect | null) => void;
  onHoverAspect?: (aspect: WheelAspect | null) => void;
}

export interface InteractiveChartSphereExtra extends InteractiveSelectionProps {
  flatten?: number;
  showDeclinationBands?: boolean;
  aspects?: WheelAspect[];
  showAspects?: boolean;
}

export interface InteractiveAstroMapExtra extends InteractiveSelectionProps {
  observer?: { lat: number; lonEast: number; label?: string };
}

export interface InteractiveEphemerisGraphExtra extends InteractiveSelectionProps {
  yUnit?: string;
  xLabels?: boolean;
  showZeroLine?: boolean;
  smallMultiples?: boolean;
}

export interface InteractiveSkyViewTabProps extends InteractiveSelectionProps {
  engine: Engine;
  jdUt: number;
  lat: number;
  lonEast: number;
  extraBodies?: string[];
}

export const InteractiveChartWheel = ChartWheel as ComponentType<
  ChartWheelProps & InteractiveChartWheelExtra
>;

export const InteractiveChartSphere = ChartSphere as ComponentType<
  ChartSphereProps & InteractiveChartSphereExtra
>;

export const InteractiveKundli = Kundli as ComponentType<
  KundliProps & { layout?: "north" | "south" } & InteractiveSelectionProps
>;

export const InteractiveAstroMap = AstroMap as ComponentType<
  AstroMapProps & InteractiveAstroMapExtra
>;

export const InteractiveEphemerisGraph = EphemerisGraph as ComponentType<
  EphemerisGraphProps & InteractiveEphemerisGraphExtra
>;

export const InteractiveSkyViewTab = SkyViewTab as ComponentType<InteractiveSkyViewTabProps>;
