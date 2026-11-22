"use client";

import dynamic from "next/dynamic";

export const SkyNow = dynamic(() => import("./SkyNow"), {
  ssr: false,
  loading: () => (
    <div className="bench playground-bench">
      <div className="tile s12">
        <div className="tile__h"><b>DOC</b><span>Loading playground</span></div>
        <div className="tile__b">
          <p className="dim small">Loading client-side ephemeris bench...</p>
        </div>
      </div>
    </div>
  ),
});

export const SynastryPanel = dynamic(() => import("./SynastryPanel"), {
  ssr: false,
  loading: () => (
    <div className="tile s12">
      <div className="tile__h"><b>PAIR</b><span>Synastry</span></div>
      <div className="tile__b">
        <p className="dim small">Loading synastry...</p>
      </div>
    </div>
  ),
});

export const PlaygroundExamples = dynamic(() => import("./PlaygroundExamples"), {
  ssr: false,
  loading: () => (
    <div className="tile s12">
      <div className="tile__b">
        <p className="dim small">Loading example charts...</p>
      </div>
    </div>
  ),
});
