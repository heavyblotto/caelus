"use client";

import type { Dispatch, SetStateAction } from "react";
import type { HouseSystem, Zodiac } from "caelus";
import CityPicker, { type City } from "./CityPicker";
import type { Share } from "../lib/share";

const SYSTEMS: HouseSystem[] = [
  "placidus", "whole_sign", "equal", "porphyry",
  "koch", "regiomontanus", "campanus", "alcabitius",
  "morinus", "meridian", "polich_page", "vehlow",
];
const ZODIACS: Array<[string, Zodiac]> = [
  ["tropical", "tropical"],
  ["sidereal · lahiri", "sidereal:lahiri"],
  ["sidereal · fagan/bradley", "sidereal:fagan_bradley"],
  ["sidereal · krishnamurti", "sidereal:krishnamurti"],
  ["sidereal · raman", "sidereal:raman"],
  ["sidereal · yukteshwar", "sidereal:yukteshwar"],
];

export interface ChartControlsProps {
  iso: string; setIso: Dispatch<SetStateAction<string>>;
  lat: string; setLat: Dispatch<SetStateAction<string>>;
  lon: string; setLon: Dispatch<SetStateAction<string>>;
  sys: HouseSystem; setSys: Dispatch<SetStateAction<HouseSystem>>;
  zodiac: Zodiac; setZodiac: Dispatch<SetStateAction<Zodiac>>;
  tzMode: "utc" | "local"; setTzMode: Dispatch<SetStateAction<"utc" | "local">>;
  label: string; setLabel: Dispatch<SetStateAction<string>>;
  setPlace: Dispatch<SetStateAction<string>>;
  set: Share[];
  hasChart: boolean;
  copied: boolean;
  collectionCopied: boolean;
  onShare: () => void;
  onAddToSet: () => void;
  onShareSet: () => void;
  onLoadShare: (s: Share) => void;
  onRemoveFromSet: (i: number) => void;
  /** Advanced house/zodiac pickers. Hidden in Casual. Default true. */
  showHouseZodiac?: boolean;
  timeUnknown?: boolean;
  setTimeUnknown?: Dispatch<SetStateAction<boolean>>;
}

/**
 * The playground's input header: the place/time/coordinate controls, the share
 * and "add to my charts" actions, the privacy note, and the "my charts" tray.
 * A controlled form — all state lives in the parent (SkyNow); this renders it.
 * Every control is a labelled .field so a wrapped row still reads as columns.
 */
export default function ChartControls({
  iso, setIso, lat, setLat, lon, setLon, sys, setSys, zodiac, setZodiac,
  tzMode, setTzMode, label, setLabel, setPlace, set, hasChart,
  copied, collectionCopied, onShare, onAddToSet, onShareSet, onLoadShare, onRemoveFromSet,
  showHouseZodiac = true, timeUnknown = false, setTimeUnknown,
}: ChartControlsProps) {
  return (
    <>
      <div className="controls">
        <div className="field">
          <span className="field__label">birthplace</span>
          <CityPicker
            onSelect={(c: City) => {
              setLat(String(c.lat));
              setLon(String(c.lon));
              setPlace(`${c.name}, ${c.country}`);
              setTzMode("local"); // picking a place means the typed time is local there
            }}
          />
        </div>
        <div className="field">
          <span className="field__label">date &amp; time</span>
          <div className="field__row">
            <select
              className="control"
              value={tzMode}
              onChange={(e) => setTzMode(e.target.value as "utc" | "local")}
              aria-label="how to read the time"
            >
              <option value="utc">UTC</option>
              <option value="local">local</option>
            </select>
            <input
              className="control"
              type={timeUnknown ? "date" : "datetime-local"}
              value={timeUnknown ? iso.slice(0, 10) : iso}
              onChange={(e) => {
                const v = e.target.value;
                if (timeUnknown) setIso(v.length === 10 ? `${v}T12:00` : v);
                else setIso(v);
              }}
              aria-label={timeUnknown ? "birth date" : tzMode === "local" ? "local birth time" : "time in UTC"}
            />
          </div>
          {setTimeUnknown && (
            <label className="field" style={{ marginTop: "0.35rem" }}>
              <span className="field__label">
                <input
                  type="checkbox"
                  checked={timeUnknown}
                  onChange={(e) => setTimeUnknown(e.target.checked)}
                  style={{ accentColor: "var(--accent)", marginRight: "0.35rem" }}
                />
                clock unknown
              </span>
            </label>
          )}
        </div>
        <div className="field">
          <span className="field__label">lat</span>
          <input
            className="control"
            style={{ width: "5.5rem" }}
            value={lat}
            onChange={(e) => { setLat(e.target.value); setPlace(""); }}
            aria-label="latitude"
          />
        </div>
        <div className="field">
          <span className="field__label">lon</span>
          <input
            className="control"
            style={{ width: "5.5rem" }}
            value={lon}
            onChange={(e) => { setLon(e.target.value); setPlace(""); }}
            aria-label="longitude, east positive"
          />
        </div>
        {showHouseZodiac && (
          <div className="field">
            <span className="field__label">houses</span>
            <select className="control" value={sys} onChange={(e) => setSys(e.target.value as HouseSystem)} aria-label="house system">
              {SYSTEMS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        {showHouseZodiac && (
          <div className="field">
            <span className="field__label">zodiac</span>
            <select className="control" value={zodiac} onChange={(e) => setZodiac(e.target.value as Zodiac)} aria-label="zodiac">
              {ZODIACS.map(([zlabel, value]) => <option key={value} value={value}>{zlabel}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <span className="field__label">name</span>
          <input
            className="control"
            style={{ width: "8rem" }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="optional"
            aria-label="chart nickname"
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onShare}>
          {copied ? "Link copied ✓" : "Copy link"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onAddToSet}
          disabled={!hasChart}
          title="Add this chart to a labelled set you can share as one link"
        >
          + Add to my charts
        </button>
      </div>

      {set.length > 0 && (
        <div className="chart-tray" aria-label="My charts">
          <span className="mute small" style={{ alignSelf: "center" }}>My charts:</span>
          {set.map((s, i) => (
            <span key={i} className="chart-chip">
              <button
                type="button"
                className="chart-chip__load"
                onClick={() => onLoadShare(s)}
                title="Load this chart"
              >
                {s.n || `Chart ${i + 1}`}
              </button>
              <button
                type="button"
                className="chart-chip__remove"
                onClick={() => onRemoveFromSet(i)}
                aria-label={`Remove ${s.n || `chart ${i + 1}`}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onShareSet}>
            {collectionCopied ? "Set link copied ✓" : `Copy link to ${set.length} chart${set.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </>
  );
}
