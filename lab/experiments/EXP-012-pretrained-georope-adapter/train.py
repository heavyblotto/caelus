#!/usr/bin/env python3
"""EXP-012: Pretrained Frozen LLM Transfer Test for Physical Slow-Clock Adapters.

Run via:
  uv run --python 3.12 --with torch --with transformers --with numpy \
    python lab/experiments/EXP-012-pretrained-georope-adapter/train.py

Evaluates 6 arms on the EXACT SAME frozen pretrained RoPE LLM
(Qwen/Qwen2.5-0.5B-Instruct, 494,032,768 frozen params) on Apple M5 Pro MPS:
  1. Arm0-Frozen-ISO-Prompt              (0 trained params; passive UTC ISO text header)
  2. Arm1-Frozen-Caelus-TextPrompt       (0 trained params; compact FACT-002 physical text envelope)
  3. Arm1b-LoRA-TextPrompt               (rank-8 LoRA on FACT-002 text envelope; isolates LoRA capacity)
  4. Arm2-LoRA-UnixFourier-Adapter       (rank-8 LoRA + 2-token MLP adapter fed 32-D 24h/7d/365.25d UTC Fourier)
  5. Arm2b-LoRA-UnixFourier+LatLon-Adapter (exact 0-param parity; fed LMT=UTC+lon/15, 7d, 365.25d, and (lat, lon))
  6. Arm3-LoRA-Caelus-GeoAdapter         (rank-8 LoRA + 2-token MLP adapter fed 32-D Caelus physical torus;
                                          exact 0-parameter difference with Arm2 and Arm2b)

All astronomical phases and daylight/night boundaries are computed directly from
Caelus's zero-dependency python/astroengine/ reference engine, with zero train/ID/OOD
date overlap verified by SHA-256 across every timestamp in every task.
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import json
import math
import os
import platform
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(ROOT / "python"))

from astroengine.chart import Engine
from astroengine.core import DEG, julian_day
from astroengine.events import rise_set
from astroengine.houses import angles as house_angles
from astroengine.houses import gast
from astroengine.pheno import az_alt, refract_true_to_apparent

# ----------------------------------------------------------------- Constants

SEED = 20261122
MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"
TWO_PI = 2.0 * math.pi
SEC_PER_DAY = 86400.0
DT_MIN = 1.0 / 1440.0
JD_EPOCH = julian_day(2026, 9, 22, 0, 0, 0)

# Two unused special tokens in Qwen2.5 tokenizer acting as per-event continuous clock slots
SLOT_START_TOK = "<|box_start|>"
SLOT_END_TOK = "<|box_end|>"
SLOT_PAIR_STR = SLOT_START_TOK + SLOT_END_TOK
N_SOFT_TOKENS = 2
FEAT_DIM = 32
ADAPTER_HIDDEN = 256
LORA_RANK = 8
LORA_ALPHA = 16.0

CITIES = {
    "Oslo": {"lat": 59.9139, "lon": 10.7522, "home_label": "Oslo"},
    "NYC": {"lat": 40.7128, "lon": -74.0060, "home_label": "NYC"},
    # During NYC -> Tokyo travel, agent profile retains home="NYC" while physical sky relocates to Tokyo
    "Tokyo": {"lat": 35.6762, "lon": 139.6503, "home_label": "NYC"},
}

REGIMES = ["night", "dawn", "day", "dusk"]
REGIME_CHOICES = [" night", " dawn", " day", " dusk"]
RETRIEVAL_CHOICES = [" A", " B", " C", " D"]
COMPACTION_CHOICES = [" fresh", " overnight", " multi"]

# Training / evaluation budgets
N_TRAIN_REGIME = 800
N_TRAIN_RETRIEVAL = 800
N_TRAIN_COMPACTION = 800
TRAIN_EPOCHS = 3
BATCH_SIZE = 16
EVAL_BATCH_SIZE = 32
LR_LORA = 3.0e-4
LR_ADAPTER = 1.5e-3
WEIGHT_DECAY = 0.01

N_ID_REGIME = 200
N_ID_RETRIEVAL = 200
N_ID_COMPACTION = 180

N_OOD_PER_REGIME = 160
N_OOD_PER_RETRIEVAL = 160
N_OOD_COMPACTION = 180  # 60 Oslo Winter, 60 Oslo Summer, 60 Tokyo


def set_all_seeds(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.backends.mps.is_available():
        torch.mps.manual_seed(seed)


def get_git_sha() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(ROOT),
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return out.strip()
    except Exception:
        return "unknown"


def jd_to_utc_iso(jd_ut: float) -> str:
    """Convert JD (UT) to compact UTC ISO-8601 string YYYY-MM-DDTHH:MMZ."""
    unix_sec = (jd_ut - 2440587.5) * SEC_PER_DAY
    dt = datetime.datetime.fromtimestamp(unix_sec, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%MZ")


def hash_day_set(items: Sequence[Tuple[str, float]]) -> str:
    h = hashlib.sha256()
    for city, jd in sorted(set((c, round(j, 4)) for c, j in items)):
        h.update(f"{city}:{jd:.4f}\n".encode("utf-8"))
    return h.hexdigest()[:16]


def wilson_ci(k: int, n: int, z: float = 1.959963984540054) -> List[float]:
    """Exact 95% Wilson score confidence interval [lo, hi] for binomial proportion k/n."""
    if n <= 0:
        return [0.0, 0.0]
    p = k / n
    z2 = z * z
    denom = 1.0 + z2 / n
    center = (p + z2 / (2.0 * n)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + z2 / (4.0 * n)) / n)) / denom
    return [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]


# ----------------------------------------------- Caelus Ephemeris Extractor

class CaelusPhaseExtractor:
    """Computes real geocentric phases and FACT-002 physical envelopes from python/astroengine/."""

    def __init__(self, engine: Engine):
        self.engine = engine
        self._day_cache: Dict[Tuple[int, float, float], Tuple[Optional[float], Optional[float], Optional[float]]] = {}
        self._point_cache: Dict[Tuple[int, float, float], Dict[str, float]] = {}

    def _day_sun_bounds(
        self, jd_ut: float, lat: float, lon: float
    ) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        local_day = math.floor(jd_ut + lon / 360.0 + 0.5)
        key = (local_day, round(lat, 4), round(lon, 4))
        if key in self._day_cache:
            return self._day_cache[key]

        day_start = local_day - 0.5 - lon / 360.0
        noon = rise_set(self.engine, "sun", day_start, lat, lon, kind="mtransit", search_days=1.05)
        sr = None
        ss = None
        nxt_sr = None
        if noon is not None:
            sr_cand = rise_set(self.engine, "sun", noon - 0.55, lat, lon, kind="rise", search_days=0.6)
            if sr_cand is not None and sr_cand <= noon + 1e-6:
                sr = sr_cand
            ss_cand = rise_set(self.engine, "sun", noon - 0.02, lat, lon, kind="set", search_days=0.6)
            if ss_cand is not None and ss_cand >= noon - 1e-6:
                ss = ss_cand
            if ss is not None:
                nxt_sr = rise_set(self.engine, "sun", ss + 0.01, lat, lon, kind="rise", search_days=1.2)
        self._day_cache[key] = (sr, ss, nxt_sr)
        return sr, ss, nxt_sr

    def extract(self, jd_ut: float, lat: float, lon: float) -> Dict[str, float]:
        q_key = (int(round((jd_ut - JD_EPOCH) * SEC_PER_DAY)), round(lat, 4), round(lon, 4))
        if q_key in self._point_cache:
            return self._point_cache[q_key]

        g_rad = gast(jd_ut)
        asc_rad, _, _, _ = house_angles(jd_ut, lat, lon)

        sp = self.engine.position("sun", jd_ut)
        mp = self.engine.position("moon", jd_ut)
        sun_lon_deg = sp["lon"] % 360.0
        moon_lon_deg = mp["lon"] % 360.0
        elong_deg = (moon_lon_deg - sun_lon_deg) % 360.0

        _, sun_alt_true = az_alt(sun_lon_deg, sp["lat"], jd_ut, lat, lon)
        sun_alt_app = refract_true_to_apparent(sun_alt_true)

        sp_m = self.engine.position("sun", jd_ut - DT_MIN)
        sp_p = self.engine.position("sun", jd_ut + DT_MIN)
        _, alt_m = az_alt(sp_m["lon"] % 360.0, sp_m["lat"], jd_ut - DT_MIN, lat, lon)
        _, alt_p = az_alt(sp_p["lon"] % 360.0, sp_p["lat"], jd_ut + DT_MIN, lat, lon)
        rate_alt = 0.5 * (alt_p - alt_m)

        sr, ss, nxt_sr = self._day_sun_bounds(jd_ut, lat, lon)
        if sr is not None and ss is not None and nxt_sr is not None:
            if jd_ut < sr:
                _, prev_ss, _ = self._day_sun_bounds(jd_ut - 1.0, lat, lon)
                if prev_ss is not None and sr > prev_ss:
                    frac = max(0.0, min(1.0, (jd_ut - prev_ss) / (sr - prev_ss)))
                    ph_rad = math.pi + math.pi * frac
                else:
                    ph_rad = (TWO_PI * ((jd_ut + lon / 360.0) % 1.0)) % TWO_PI
            elif jd_ut < ss:
                frac = max(0.0, min(1.0, (jd_ut - sr) / (ss - sr)))
                ph_rad = math.pi * frac
            else:
                frac = max(0.0, min(1.0, (jd_ut - ss) / (nxt_sr - ss)))
                ph_rad = math.pi + math.pi * frac
        else:
            ph_rad = (TWO_PI * ((jd_ut + lon / 360.0) % 1.0)) % TWO_PI

        out = {
            "gast_rad": g_rad,
            "asc_rad": asc_rad,
            "sun_alt_deg": sun_alt_app,
            "sun_alt_rate": rate_alt,
            "sun_alt_phase": 2.0 * sun_alt_app * DEG,
            "sun_trend_phase": math.atan2(rate_alt, 0.15),
            "ph_rad": ph_rad,
            "moon_lon_rad": moon_lon_deg * DEG,
            "elong_rad": elong_deg * DEG,
            "sun_lon_rad": sun_lon_deg * DEG,
            "sun_lon_deg": sun_lon_deg,
            "lat": lat,
            "lon": lon,
        }
        self._point_cache[q_key] = out
        return out

    def classify_regime(self, phys: Dict[str, float]) -> str:
        alt = phys["sun_alt_deg"]
        rate = phys["sun_alt_rate"]
        ph = phys["ph_rad"]
        if alt < -6.0:
            return "night"
        if rate >= 0.0 and (alt < 0.0 or ph < 0.25 * math.pi):
            return "dawn"
        if rate < 0.0 and (alt < 0.0 or ph > 0.75 * math.pi):
            return "dusk"
        return "day"

    def interval_night_check(self, jd_prev: float, jd_now: float, lat: float, lon: float) -> Tuple[bool, float]:
        """Return (night_crossed, min_sun_alt_deg) across [jd_prev, jd_now]."""
        dt_days = jd_now - jd_prev
        assert dt_days > 0.0
        if dt_days >= 1.0:
            return True, -90.0
        # Check sunrise inside (jd_prev, jd_now]
        sr = rise_set(self.engine, "sun", jd_prev + 1e-4, lat, lon, kind="rise", search_days=dt_days + 0.02)
        sunrise_crossed = sr is not None and (jd_prev < sr <= jd_now)
        # Sample apparent altitude along the interval (every <= 20 min)
        n_steps = max(12, int(math.ceil(dt_days * 24.0 * 3.0)))
        min_alt = 90.0
        for i in range(n_steps + 1):
            t = jd_prev + dt_days * (i / n_steps)
            sp = self.engine.position("sun", t)
            _, alt_t = az_alt(sp["lon"] % 360.0, sp["lat"], t, lat, lon)
            alt_app = refract_true_to_apparent(alt_t)
            if alt_app < min_alt:
                min_alt = alt_app
        night_crossed = sunrise_crossed or (min_alt < -6.0)
        return night_crossed, min_alt


# ----------------------------------------------- Feature Vectors (Exact 32-D Parity)

def compute_unix_fourier_32(jd_ut: float) -> np.ndarray:
    """32-D unit-bounded [cos, sin] of 16 distinct fixed UTC Fourier frequencies (24h, 7d, 365.25d)."""
    t_sec = (jd_ut - JD_EPOCH) * SEC_PER_DAY
    p24 = TWO_PI * t_sec / SEC_PER_DAY
    p7d = TWO_PI * t_sec / (7.0 * SEC_PER_DAY)
    p365 = TWO_PI * t_sec / (365.25 * SEC_PER_DAY)
    angles = np.array([
        p24, 2.0 * p24, 3.0 * p24, 4.0 * p24, 6.0 * p24, 8.0 * p24,
        p7d, 2.0 * p7d, 4.0 * p7d, 8.0 * p7d, 12.0 * p7d, 16.0 * p7d,
        p365, 2.0 * p365, 4.0 * p365, 8.0 * p365,
    ], dtype=np.float32)
    return np.concatenate([np.cos(angles), np.sin(angles)]).astype(np.float32)


def compute_unix_latlon_32(jd_ut: float, lat: float, lon: float) -> np.ndarray:
    """32-D unit-bounded [cos, sin] of 16 location-aware clock+coordinate angles.

    Eliminates any location information gap vs Arm3 by providing exact observer (lat, lon)
    plus local mean solar time (UTC + lon/15 deg/h), UTC 24h, 7d, and 365.25d harmonics
    with exact 0-parameter parity against Arm2 and Arm3.
    """
    t_sec = (jd_ut - JD_EPOCH) * SEC_PER_DAY
    p_lmt = TWO_PI * ((jd_ut - JD_EPOCH + lon / 360.0) % 1.0)
    p24_utc = TWO_PI * t_sec / SEC_PER_DAY
    p7d = TWO_PI * t_sec / (7.0 * SEC_PER_DAY)
    p365 = TWO_PI * t_sec / (365.25 * SEC_PER_DAY)
    lat_r = lat * DEG
    lon_r = lon * DEG
    angles = np.array([
        p_lmt, 2.0 * p_lmt, 3.0 * p_lmt, 4.0 * p_lmt,
        p24_utc, 2.0 * p24_utc,
        p7d, 2.0 * p7d, 4.0 * p7d,
        p365, 2.0 * p365, 4.0 * p365, 8.0 * p365,
        lat_r, 2.0 * lat_r, lon_r,
    ], dtype=np.float32)
    return np.concatenate([np.cos(angles), np.sin(angles)]).astype(np.float32)


def compute_caelus_geo_32(phys: Dict[str, float]) -> np.ndarray:
    """32-D unit-bounded [cos, sin] of 16 Caelus python/astroengine/ physical torus angles."""
    g = phys["gast_rad"]
    asc = phys["asc_rad"]
    sa = phys["sun_alt_phase"]
    st = phys["sun_trend_phase"]
    php = phys["ph_rad"]
    ml = phys["moon_lon_rad"]
    el = phys["elong_rad"]
    sl = phys["sun_lon_rad"]
    angles = np.array([
        g, asc,
        sa, 2.0 * sa, st,
        php, 2.0 * php, 3.0 * php,
        ml, 2.0 * ml, 4.0 * ml, 8.0 * ml,
        el, 4.0 * el,
        sl, 4.0 * sl,
    ], dtype=np.float32)
    return np.concatenate([np.cos(angles), np.sin(angles)]).astype(np.float32)


def format_caelus_text_clock(jd_ut: float, phys: Dict[str, float]) -> str:
    """Compact FACT-002 physical-horizon text envelope (no answer-label leakage)."""
    alt = phys["sun_alt_deg"]
    trend = "rising" if phys["sun_alt_rate"] >= 0.0 else "falling"
    if alt < -6.0:
        sky = "night"
    elif alt < 0.0:
        sky = "twilight"
    else:
        sky = "daylight"
    ph = phys["ph_rad"]
    if ph < math.pi:
        slot_num = min(12, max(1, int(math.floor((ph / math.pi) * 12.0)) + 1))
        slot = f"D{slot_num:02d}/12"
    else:
        slot_num = min(12, max(1, int(math.floor(((ph - math.pi) / math.pi) * 12.0)) + 1))
        slot = f"N{slot_num:02d}/12"
    return f"[CAELUS t={jd_to_utc_iso(jd_ut)} sun={alt:+.1f}deg {trend} sky={sky} slot={slot}]"


# ----------------------------------------------- Prompt Builders (All 5 Arms)

SYS_REGIME_BASE = (
    "You are a sky-regime classifier. Classify the observer's current physical sky regime "
    "as exactly one word: night, dawn, day, or dusk."
)
SYS_REGIME_CAELUS_LEGEND = (
    "You are a sky-regime classifier. Classify the observer's current physical sky regime "
    "as exactly one word: night, dawn, day, or dusk.\n"
    "Header rules: night if sky=night (sun<-6deg); dawn if rising and (sky=twilight or slot D01..D03); "
    "dusk if falling and (sky=twilight or slot D10..D12); otherwise day."
)

SYS_RETRIEVAL_BASE = (
    "You are a temporal memory retriever. Select the single archived memory letter (A, B, C, or D) "
    "recorded during the same physical sky regime (night, dawn, day, or dusk) as Now."
)
SYS_RETRIEVAL_CAELUS_LEGEND = (
    "You are a temporal memory retriever. Select the single archived memory letter (A, B, C, or D) "
    "recorded during the same physical sky regime as Now.\n"
    "Regime rules: night if sky=night; dawn if rising and (sky=twilight or D01..D03); "
    "dusk if falling and (sky=twilight or D10..D12); otherwise day."
)

SYS_COMPACTION_BASE = (
    "You are a post-compaction cache auditor. Classify cache staleness between Prev and Now "
    "as exactly one word: fresh, overnight, or multi."
)
SYS_COMPACTION_CAELUS_LEGEND = (
    "You are a post-compaction cache auditor. Classify cache staleness between Prev and Now "
    "as exactly one word: fresh, overnight, or multi.\n"
    "Rules: multi if dt>=48.0h; overnight if dt<48.0h and night_crossed=true; "
    "fresh if dt<48.0h and night_crossed=false."
)


def chat_wrap(sys_msg: str, user_msg: str) -> str:
    return (
        f"<|im_start|>system\n{sys_msg}<|im_end|>\n"
        f"<|im_start|>user\n{user_msg}<|im_end|>\n"
        f"<|im_start|>assistant\nAnswer:"
    )


def _feat_for_mode(mode: str, jd_ut: float, phys: Dict[str, float]) -> np.ndarray:
    if mode == "unix_adapter":
        return compute_unix_fourier_32(jd_ut)
    if mode == "unix_latlon_adapter":
        return compute_unix_latlon_32(jd_ut, phys["lat"], phys["lon"])
    if mode == "caelus_adapter":
        return compute_caelus_geo_32(phys)
    raise ValueError(f"Unsupported adapter mode: {mode}")


def render_example_for_arm(ex: Dict, mode: str) -> Tuple[str, List[np.ndarray]]:
    """Build exact prompt text and per-slot continuous features for mode in {'iso', 'caelus_text', 'unix_adapter', 'unix_latlon_adapter', 'caelus_adapter'}."""
    task = ex["task"]
    home = ex["home_label"]

    if task == "regime":
        jd = ex["jds"][0]
        phys = ex["phys"][0]
        if mode == "iso":
            user = f"Observer home={home}. Clock: t={jd_to_utc_iso(jd)}.\nReply with one word (night, dawn, day, dusk)."
            return chat_wrap(SYS_REGIME_BASE, user), []
        elif mode == "caelus_text":
            user = f"Observer home={home}. Clock: {format_caelus_text_clock(jd, phys)}.\nReply with one word (night, dawn, day, dusk)."
            return chat_wrap(SYS_REGIME_CAELUS_LEGEND, user), []
        else:
            user = f"Observer home={home}. Clock: {SLOT_PAIR_STR}.\nReply with one word (night, dawn, day, dusk)."
            feat = _feat_for_mode(mode, jd, phys)
            return chat_wrap(SYS_REGIME_BASE, user), [feat]

    elif task == "photo_retrieval":
        jds = ex["jds"]
        phys_list = ex["phys"]
        letters = ["A", "B", "C", "D"]
        if mode == "iso":
            lines = [f"Observer home={home}. Archived memories:"]
            for i, let in enumerate(letters):
                lines.append(f"[{let}] t={jd_to_utc_iso(jds[i])}")
            lines.append(f"Now: t={jd_to_utc_iso(jds[4])}")
            lines.append("Which memory letter matches Now's physical sky regime (A, B, C, or D)?")
            return chat_wrap(SYS_RETRIEVAL_BASE, "\n".join(lines)), []
        elif mode == "caelus_text":
            lines = [f"Observer home={home}. Archived memories:"]
            for i, let in enumerate(letters):
                lines.append(f"[{let}] {format_caelus_text_clock(jds[i], phys_list[i])}")
            lines.append(f"Now: {format_caelus_text_clock(jds[4], phys_list[4])}")
            lines.append("Which memory letter matches Now's physical sky regime (A, B, C, or D)?")
            return chat_wrap(SYS_RETRIEVAL_CAELUS_LEGEND, "\n".join(lines)), []
        else:
            lines = [f"Observer home={home}. Archived memories:"]
            for let in letters:
                lines.append(f"[{let}] {SLOT_PAIR_STR}")
            lines.append(f"Now: {SLOT_PAIR_STR}")
            lines.append("Which memory letter matches Now's physical sky regime (A, B, C, or D)?")
            feats = [_feat_for_mode(mode, jds[i], phys_list[i]) for i in range(5)]
            return chat_wrap(SYS_RETRIEVAL_BASE, "\n".join(lines)), feats

    elif task == "compaction":
        jd_prev, jd_now = ex["jds"]
        phys_prev, phys_now = ex["phys"]
        dt_h = (jd_now - jd_prev) * 24.0
        nc_str = "true" if ex["night_crossed"] else "false"
        if mode == "iso":
            user = (
                f"Observer home={home}. Prev: t={jd_to_utc_iso(jd_prev)}. Now: t={jd_to_utc_iso(jd_now)}.\n"
                f"Reply with one word (fresh, overnight, multi)."
            )
            return chat_wrap(SYS_COMPACTION_BASE, user), []
        elif mode == "caelus_text":
            user = (
                f"Observer home={home}. Prev: {format_caelus_text_clock(jd_prev, phys_prev)} "
                f"Now: {format_caelus_text_clock(jd_now, phys_now)} dt={dt_h:.1f}h night_crossed={nc_str}.\n"
                f"Reply with one word (fresh, overnight, multi)."
            )
            return chat_wrap(SYS_COMPACTION_CAELUS_LEGEND, user), []
        else:
            user = (
                f"Observer home={home}. Prev: {SLOT_PAIR_STR} Now: {SLOT_PAIR_STR}.\n"
                f"Reply with one word (fresh, overnight, multi)."
            )
            feats = [
                _feat_for_mode(mode, jd_prev, phys_prev),
                _feat_for_mode(mode, jd_now, phys_now),
            ]
            return chat_wrap(SYS_COMPACTION_BASE, user), feats

    raise ValueError(f"Unknown task: {task}")


# ----------------------------------------------- Dataset Generators (Zero Leakage)

def build_regime_pools(
    extractor: CaelusPhaseExtractor,
    city_name: str,
    start_ymd: Tuple[int, int, int],
    n_days: int,
    step_minutes: int = 20,
) -> Tuple[Dict[str, List[Tuple[float, Dict[str, float]]]], List[Tuple[float, Dict[str, float]]], float, float]:
    c = CITIES[city_name]
    lat, lon = c["lat"], c["lon"]
    jd0 = julian_day(start_ymd[0], start_ymd[1], start_ymd[2], 0, 0, 0)
    by_regime: Dict[str, List[Tuple[float, Dict[str, float]]]] = {r: [] for r in REGIMES}
    all_pts: List[Tuple[float, Dict[str, float]]] = []
    steps_per_day = (24 * 60) // step_minutes
    for d in range(n_days):
        for s in range(steps_per_day):
            jd = jd0 + d + (s * step_minutes) / 1440.0
            phys = extractor.extract(jd, lat, lon)
            reg = extractor.classify_regime(phys)
            by_regime[reg].append((jd, phys))
            all_pts.append((jd, phys))
    return by_regime, all_pts, jd0, jd0 + n_days


def merge_pools(
    pool_list: Sequence[Dict[str, List[Tuple[float, Dict[str, float]]]]]
) -> Dict[str, List[Tuple[float, Dict[str, float]]]]:
    out = {r: [] for r in REGIMES}
    for p in pool_list:
        for r in REGIMES:
            out[r].extend(p[r])
    return out


def gen_regime_examples(
    rng: random.Random,
    pools_by_city: Dict[str, Dict[str, List[Tuple[float, Dict[str, float]]]]],
    n_examples: int,
    split_tag: str,
) -> List[Dict]:
    cities = list(pools_by_city.keys())
    out = []
    for idx in range(n_examples):
        city = cities[idx % len(cities)]
        reg = REGIMES[(idx // len(cities)) % len(REGIMES)]
        cands = pools_by_city[city][reg]
        if not cands:
            reg = rng.choice([r for r in REGIMES if pools_by_city[city][r]])
            cands = pools_by_city[city][reg]
        jd, phys = rng.choice(cands)
        out.append({
            "task": "regime",
            "split": split_tag,
            "city": city,
            "home_label": CITIES[city]["home_label"],
            "jds": [jd],
            "phys": [phys],
            "choices": REGIME_CHOICES,
            "target_idx": REGIMES.index(reg),
            "target_str": f" {reg}",
        })
    return out


def gen_retrieval_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    query_city: str,
    query_pools: Dict[str, List[Tuple[float, Dict[str, float]]]],
    bank_city: str,
    bank_pools: Dict[str, List[Tuple[float, Dict[str, float]]]],
    n_examples: int,
    adversarial_same_utc: bool,
    split_tag: str,
) -> List[Dict]:
    bank_lat, bank_lon = CITIES[bank_city]["lat"], CITIES[bank_city]["lon"]
    out = []
    attempts = 0
    while len(out) < n_examples and attempts < n_examples * 40:
        attempts += 1
        target_reg = REGIMES[attempts % len(REGIMES)]
        if not query_pools[target_reg] or not bank_pools[target_reg]:
            continue
        jd_q, phys_q = rng.choice(query_pools[target_reg])
        jd_match, phys_match = rng.choice(bank_pools[target_reg])
        other_regs = [r for r in REGIMES if r != target_reg]
        distractors: List[Tuple[float, Dict[str, float]]] = []

        if adversarial_same_utc:
            q_utc_frac = (jd_q - math.floor(jd_q + 0.5) + 0.5) % 1.0
            bank_day_0 = math.floor(jd_match + 0.5) - 0.5
            jd_adv = bank_day_0 + q_utc_frac
            phys_adv = extractor.extract(jd_adv, bank_lat, bank_lon)
            adv_reg = extractor.classify_regime(phys_adv)
            if adv_reg == target_reg:
                continue
            distractors.append((jd_adv, phys_adv))
            for r in other_regs:
                if r != adv_reg:
                    distractors.append(rng.choice(bank_pools[r]))
        else:
            for r in other_regs:
                distractors.append(rng.choice(bank_pools[r]))

        entries = [(jd_match, phys_match, True)] + [(d[0], d[1], False) for d in distractors]
        rng.shuffle(entries)
        match_idx = next(i for i, e in enumerate(entries) if e[2])
        out.append({
            "task": "photo_retrieval",
            "split": split_tag,
            "city": query_city,
            "bank_city": bank_city,
            "home_label": CITIES[query_city]["home_label"],
            "jds": [e[0] for e in entries] + [jd_q],
            "phys": [e[1] for e in entries] + [phys_q],
            "choices": RETRIEVAL_CHOICES,
            "target_idx": match_idx,
            "target_str": RETRIEVAL_CHOICES[match_idx],
            "adversarial_same_utc": adversarial_same_utc,
        })
    assert len(out) == n_examples, f"Generated only {len(out)}/{n_examples} for {split_tag}"
    return out


def gen_compaction_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    windows: List[Tuple[str, float, float]],  # (city, jd_start, jd_end)
    n_examples: int,
    split_tag: str,
) -> List[Dict]:
    """Generate zero-leakage post-sleep compaction examples strictly inside [jd_start, jd_end).

    Balanced 3 classes:
      0 = fresh     (50% short 15m..3h, 50% same-day long 3.5h..9.0h with night_crossed=False)
      1 = overnight (7.0h..18.5h crossing physical local night/sunrise with night_crossed=True)
      2 = multiday  (2.0d..6.5d; 50% exact same local clock hour +48/+72/+96/+120h +/- 4m)
    """
    out = []
    classes = ["fresh", "overnight", "multiday"]
    for idx in range(n_examples):
        cls_idx = idx % 3
        cls_name = classes[cls_idx]
        city, jd_start, jd_end = windows[(idx // 3) % len(windows)]
        lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]
        span_days = jd_end - jd_start
        subtag = cls_name

        found = None
        for _ in range(300):
            if cls_name == "fresh":
                is_long = (idx // 3) % 2 == 1
                day_off = rng.uniform(0.0, max(0.5, span_days - 1.0))
                local_noon_approx = math.floor(jd_start + day_off + 0.5) - 0.5 + (0.5 - lon / 360.0)
                if is_long:
                    # Pick morning -> afternoon inside same daylight span
                    sr, ss, _ = extractor._day_sun_bounds(local_noon_approx, lat, lon)
                    if sr is None or ss is None:
                        continue
                    day_len_h = (ss - sr) * 24.0
                    # Leave 15m margin inside daylight
                    avail_h = max(0.0, day_len_h - 0.5)
                    if avail_h < 3.5:
                        continue
                    dt_h = rng.uniform(min(5.5, avail_h * 0.7), min(9.0, avail_h * 0.95))
                    start_max = ss - 0.25 / 24.0 - dt_h / 24.0
                    start_min = sr + 0.25 / 24.0
                    if start_max <= start_min:
                        continue
                    jd_prev = rng.uniform(start_min, start_max)
                    jd_now = jd_prev + dt_h / 24.0
                    subtag = "fresh_long_sameday"
                else:
                    # Short 15m..2.5h during daylight or twilight without crossing night
                    sr, ss, _ = extractor._day_sun_bounds(local_noon_approx, lat, lon)
                    if sr is None or ss is None:
                        continue
                    dt_h = rng.uniform(0.25, 2.5)
                    start_max = ss - dt_h / 24.0
                    if start_max <= sr:
                        continue
                    jd_prev = rng.uniform(sr, start_max)
                    jd_now = jd_prev + dt_h / 24.0
                    subtag = "fresh_short"
                if not (jd_start <= jd_prev < jd_now < jd_end):
                    continue
                nc, min_alt = extractor.interval_night_check(jd_prev, jd_now, lat, lon)
                if not nc and min_alt >= -2.0:
                    found = (jd_prev, jd_now, False, subtag)
                    break

            elif cls_name == "overnight":
                day_off = rng.uniform(0.0, max(0.5, span_days - 2.0))
                local_noon_approx = math.floor(jd_start + day_off + 0.5) - 0.5 + (0.5 - lon / 360.0)
                sr, ss, nxt_sr = extractor._day_sun_bounds(local_noon_approx, lat, lon)
                if ss is None or nxt_sr is None:
                    continue
                # Prev in late afternoon / evening before sunset or early evening; Now after next sunrise
                jd_prev = rng.uniform(ss - 2.5 / 24.0, ss + 1.5 / 24.0)
                jd_now = rng.uniform(nxt_sr + 0.3 / 24.0, nxt_sr + 3.5 / 24.0)
                dt_h = (jd_now - jd_prev) * 24.0
                if not (6.5 <= dt_h <= 20.5 and jd_start <= jd_prev < jd_now < jd_end):
                    continue
                nc, _ = extractor.interval_night_check(jd_prev, jd_now, lat, lon)
                if nc:
                    same_utc_date = jd_to_utc_iso(jd_prev)[:10] == jd_to_utc_iso(jd_now)[:10]
                    subtag = "overnight_same_utc_date" if same_utc_date else "overnight_standard"
                    found = (jd_prev, jd_now, True, subtag)
                    break

            else:
                same_clock = (idx // 3) % 2 == 1
                max_dt = min(6.5, span_days - 1.5)
                if same_clock:
                    whole_days = rng.choice([d for d in (2, 3, 4, 5, 6) if d <= max_dt])
                    dt_days = float(whole_days) + rng.uniform(-4.0, 4.0) / 1440.0
                    subtag = "multiday_same_clock"
                else:
                    dt_days = rng.uniform(2.1, max_dt)
                    subtag = "multiday_random"
                jd_prev = rng.uniform(jd_start + 0.05, jd_end - dt_days - 0.05)
                jd_now = jd_prev + dt_days
                if jd_start <= jd_prev < jd_now < jd_end:
                    found = (jd_prev, jd_now, True, subtag)
                    break

        assert found is not None, f"Failed to generate compaction example cls={cls_name} city={city} split={split_tag}"
        jd_prev, jd_now, nc, subtag = found
        out.append({
            "task": "compaction",
            "split": split_tag,
            "subtag": subtag,
            "city": city,
            "home_label": CITIES[city]["home_label"],
            "jds": [jd_prev, jd_now],
            "phys": [extractor.extract(jd_prev, lat, lon), extractor.extract(jd_now, lat, lon)],
            "night_crossed": nc,
            "choices": COMPACTION_CHOICES,
            "target_idx": cls_idx,
            "target_str": COMPACTION_CHOICES[cls_idx],
        })
    return out


# ----------------------------------------------- LoRA + Soft-Token Adapter

class LoRALinear(nn.Module):
    """Wraps a frozen bf16/fp16 nn.Linear with float32 trainable low-rank LoRA matrices."""

    def __init__(self, base_linear: nn.Linear, rank: int = LORA_RANK, alpha: float = LORA_ALPHA):
        super().__init__()
        self.base = base_linear
        for p in self.base.parameters():
            p.requires_grad = False
        self.rank = rank
        self.scale = alpha / rank
        in_f = base_linear.in_features
        out_f = base_linear.out_features
        self.lora_a = nn.Parameter(torch.empty(rank, in_f, dtype=torch.float32))
        self.lora_b = nn.Parameter(torch.zeros(out_f, rank, dtype=torch.float32))
        nn.init.kaiming_uniform_(self.lora_a, a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        base_out = self.base(x)
        x_f = x.float()
        lora_out = F.linear(F.linear(x_f, self.lora_a), self.lora_b) * self.scale
        return base_out + lora_out.to(base_out.dtype)


class TemporalClockAdapter(nn.Module):
    """Lightweight trainable 2-layer MLP projecting 32-D periodic clock features to M soft tokens."""

    def __init__(
        self,
        in_dim: int = FEAT_DIM,
        hidden_dim: int = ADAPTER_HIDDEN,
        out_dim: int = 896,
        n_tokens: int = N_SOFT_TOKENS,
        init_scale: float = 0.02,
    ):
        super().__init__()
        self.n_tokens = n_tokens
        self.out_dim = out_dim
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.GELU(),
            nn.LayerNorm(hidden_dim),
            nn.Linear(hidden_dim, n_tokens * out_dim),
        )
        self.out_norm = nn.LayerNorm(out_dim)
        # Match Qwen2.5-0.5B embed_tokens RMS (~0.01525) at init
        self.scale = nn.Parameter(torch.tensor(init_scale, dtype=torch.float32))

    def forward(self, feats: torch.Tensor) -> torch.Tensor:
        # feats: [N_events, 32] float32 -> [N_events, n_tokens, out_dim] float32
        h = self.net(feats).view(-1, self.n_tokens, self.out_dim)
        return self.out_norm(h) * self.scale


def attach_lora(model: nn.Module, rank: int = LORA_RANK, alpha: float = LORA_ALPHA, device: torch.device = torch.device("mps")) -> List[nn.Parameter]:
    """Attach fresh rank-r LoRA wrappers to q_proj/k_proj/v_proj/o_proj in every layer."""
    lora_params: List[nn.Parameter] = []
    for layer in model.model.layers:
        attn = layer.self_attn
        for name in ("q_proj", "k_proj", "v_proj", "o_proj"):
            mod = getattr(attn, name)
            base_lin = mod.base if isinstance(mod, LoRALinear) else mod
            wrapped = LoRALinear(base_lin, rank=rank, alpha=alpha).to(device)
            setattr(attn, name, wrapped)
            lora_params.extend([wrapped.lora_a, wrapped.lora_b])
    return lora_params


def detach_lora(model: nn.Module) -> None:
    """Restore original frozen nn.Linear projections cleanly."""
    for layer in model.model.layers:
        attn = layer.self_attn
        for name in ("q_proj", "k_proj", "v_proj", "o_proj"):
            mod = getattr(attn, name)
            if isinstance(mod, LoRALinear):
                setattr(attn, name, mod.base)


# ----------------------------------------------- Pre-Tokenization & Fast Last-Token Forward

def prepare_encoded_dataset(
    examples: List[Dict],
    mode: str,
    tokenizer,
    slot_start_id: int,
    slot_end_id: int,
    choice_id_cache: Dict[str, int],
) -> List[Dict]:
    encoded = []
    for ex in examples:
        prompt, feats = render_example_for_arm(ex, mode)
        ids = tokenizer.encode(prompt, add_special_tokens=False)
        slot_positions: List[Tuple[int, int]] = []
        if feats:
            for pos in range(len(ids) - 1):
                if ids[pos] == slot_start_id and ids[pos + 1] == slot_end_id:
                    slot_positions.append((pos, pos + 1))
            assert len(slot_positions) == len(feats), (
                f"Slot count mismatch: {len(slot_positions)} vs {len(feats)} in {ex['task']}"
            )
        choice_ids = [choice_id_cache[c] for c in ex["choices"]]
        encoded.append({
            "input_ids": ids,
            "slot_positions": slot_positions,
            "feats": np.stack(feats).astype(np.float32) if feats else None,
            "choice_ids": choice_ids,
            "target_idx": ex["target_idx"],
            "target_tok_id": choice_ids[ex["target_idx"]],
            "task": ex["task"],
            "split": ex["split"],
            "subtag": ex.get("subtag", ""),
            "n_tokens": len(ids),
            "n_events": len(ex["jds"]),
        })
    return encoded


def forward_last_logits(
    base_model: nn.Module,
    batch: List[Dict],
    device: torch.device,
    pad_token_id: int,
    adapter: Optional[TemporalClockAdapter] = None,
) -> torch.Tensor:
    """Compute next-token logits ONLY at the final non-pad position of each example (exact, ~2.5x faster)."""
    bsz = len(batch)
    lengths = [len(item["input_ids"]) for item in batch]
    max_len = max(lengths)

    input_ids = torch.full((bsz, max_len), pad_token_id, dtype=torch.long, device=device)
    attn_mask = torch.zeros((bsz, max_len), dtype=torch.long, device=device)
    for i, item in enumerate(batch):
        l = lengths[i]
        input_ids[i, :l] = torch.tensor(item["input_ids"], dtype=torch.long, device=device)
        attn_mask[i, :l] = 1

    if adapter is not None:
        with torch.no_grad():
            embeds = base_model.model.embed_tokens(input_ids).clone()
        # Gather all event feature vectors across the batch into a single batched MLP call
        all_feats = []
        b_indices = []
        pos0_indices = []
        pos1_indices = []
        for i, item in enumerate(batch):
            if item["feats"] is not None:
                all_feats.append(item["feats"])
                for p0, p1 in item["slot_positions"]:
                    b_indices.append(i)
                    pos0_indices.append(p0)
                    pos1_indices.append(p1)
        if all_feats:
            feats_t = torch.tensor(np.concatenate(all_feats, axis=0), dtype=torch.float32, device=device)
            soft = adapter(feats_t).to(embeds.dtype)  # [N_ev, 2, D]
            b_idx = torch.tensor(b_indices, dtype=torch.long, device=device)
            p0_idx = torch.tensor(pos0_indices, dtype=torch.long, device=device)
            p1_idx = torch.tensor(pos1_indices, dtype=torch.long, device=device)
            embeds[b_idx, p0_idx] = soft[:, 0, :]
            embeds[b_idx, p1_idx] = soft[:, 1, :]
        out = base_model.model(inputs_embeds=embeds, attention_mask=attn_mask, use_cache=False)
    else:
        out = base_model.model(input_ids=input_ids, attention_mask=attn_mask, use_cache=False)

    last_idx = torch.tensor([l - 1 for l in lengths], dtype=torch.long, device=device)
    last_hidden = out.last_hidden_state[torch.arange(bsz, device=device), last_idx]
    logits = base_model.lm_head(last_hidden).float()
    return logits


@torch.no_grad()
def evaluate_slices(
    base_model: nn.Module,
    encoded_slices: Dict[str, List[Dict]],
    device: torch.device,
    pad_token_id: int,
    adapter: Optional[TemporalClockAdapter] = None,
) -> Tuple[Dict[str, Dict], float]:
    base_model.eval()
    if adapter is not None:
        adapter.eval()

    results: Dict[str, Dict] = {}
    total_examples = 0
    if device.type == "mps":
        torch.mps.synchronize()
    t0 = time.perf_counter()

    for slice_name, items in encoded_slices.items():
        n = len(items)
        total_examples += n
        choice_correct = 0
        full_correct = 0
        choice_ce_sum = 0.0
        full_ce_sum = 0.0
        sub_stats: Dict[str, List[int]] = {}

        for start in range(0, n, EVAL_BATCH_SIZE):
            batch = items[start : start + EVAL_BATCH_SIZE]
            logits = forward_last_logits(base_model, batch, device, pad_token_id, adapter=adapter)
            targets_full = torch.tensor([x["target_tok_id"] for x in batch], dtype=torch.long, device=device)
            full_losses = F.cross_entropy(logits, targets_full, reduction="none")
            full_preds = logits.argmax(dim=-1)

            for i, x in enumerate(batch):
                c_ids = x["choice_ids"]
                c_logits = logits[i, c_ids]
                t_idx = x["target_idx"]
                c_loss = float(F.cross_entropy(c_logits.unsqueeze(0), torch.tensor([t_idx], device=device)).item())
                c_ok = int(int(c_logits.argmax().item()) == t_idx)
                f_ok = int(int(full_preds[i].item()) == x["target_tok_id"])
                choice_correct += c_ok
                full_correct += f_ok
                choice_ce_sum += c_loss
                full_ce_sum += float(full_losses[i].item())

                st = x.get("subtag", "")
                if st:
                    if st not in sub_stats:
                        sub_stats[st] = [0, 0]
                    sub_stats[st][0] += c_ok
                    sub_stats[st][1] += 1

        rec = {
            "n": n,
            "choice_correct": choice_correct,
            "choice_acc": round(choice_correct / n, 4),
            "choice_ci95": wilson_ci(choice_correct, n),
            "choice_ce": round(choice_ce_sum / n, 4),
            "full_vocab_correct": full_correct,
            "full_vocab_acc": round(full_correct / n, 4),
            "full_vocab_ci95": wilson_ci(full_correct, n),
            "full_vocab_ce": round(full_ce_sum / n, 4),
            "mean_prompt_tokens": round(sum(x["n_tokens"] for x in items) / n, 2),
        }
        if sub_stats:
            rec["by_subtag"] = {
                k: {
                    "n": v[1],
                    "choice_correct": v[0],
                    "choice_acc": round(v[0] / v[1], 4),
                    "choice_ci95": wilson_ci(v[0], v[1]),
                }
                for k, v in sorted(sub_stats.items())
            }
        results[slice_name] = rec

    if device.type == "mps":
        torch.mps.synchronize()
    elapsed_s = time.perf_counter() - t0
    ms_per_ex = round((elapsed_s * 1000.0) / max(1, total_examples), 3)

    # Compute composites (plus pooled exact Wilson 95% CIs)
    id_keys = ["id_regime", "id_photo_retrieval", "id_compaction"]
    ood_st_keys = [
        "ood_oslo_winter_regime",
        "ood_oslo_summer_regime",
        "ood_tokyo_travel_regime",
        "ood_oslo_winter_retrieval",
        "ood_oslo_summer_retrieval",
        "ood_tokyo_travel_retrieval",
    ]
    ood_solstice_only_keys = [
        "ood_oslo_winter_regime",
        "ood_oslo_summer_regime",
        "ood_oslo_winter_retrieval",
        "ood_oslo_summer_retrieval",
    ]
    ood_tokyo_only_keys = [
        "ood_tokyo_travel_regime",
        "ood_tokyo_travel_retrieval",
    ]
    ood_all_keys = ood_st_keys + ["ood_compaction"]

    def macro(keys: Sequence[str], field: str) -> float:
        return round(sum(results[k][field] for k in keys) / len(keys), 4)

    def pooled_ci(keys: Sequence[str], corr_field: str = "choice_correct") -> List[float]:
        k_sum = sum(results[k][corr_field] for k in keys)
        n_sum = sum(results[k]["n"] for k in keys)
        return wilson_ci(k_sum, n_sum)

    summary = {
        "id_composite_choice_acc": macro(id_keys, "choice_acc"),
        "id_composite_choice_ci95": pooled_ci(id_keys),
        "id_composite_choice_ce": macro(id_keys, "choice_ce"),
        "id_composite_full_acc": macro(id_keys, "full_vocab_acc"),
        "ood_solstice_travel_choice_acc": macro(ood_st_keys, "choice_acc"),
        "ood_solstice_travel_choice_ci95": pooled_ci(ood_st_keys),
        "ood_solstice_travel_choice_ce": macro(ood_st_keys, "choice_ce"),
        "ood_solstice_travel_full_acc": macro(ood_st_keys, "full_vocab_acc"),
        "ood_solstice_travel_full_ce": macro(ood_st_keys, "full_vocab_ce"),
        "ood_oslo_solstices_choice_acc": macro(ood_solstice_only_keys, "choice_acc"),
        "ood_oslo_solstices_choice_ci95": pooled_ci(ood_solstice_only_keys),
        "ood_tokyo_travel_choice_acc": macro(ood_tokyo_only_keys, "choice_acc"),
        "ood_tokyo_travel_choice_ci95": pooled_ci(ood_tokyo_only_keys),
        "ood_compaction_choice_acc": results["ood_compaction"]["choice_acc"],
        "ood_compaction_choice_ci95": results["ood_compaction"]["choice_ci95"],
        "ood_compaction_choice_ce": results["ood_compaction"]["choice_ce"],
        "ood_all_choice_acc": macro(ood_all_keys, "choice_acc"),
        "ood_all_choice_ci95": pooled_ci(ood_all_keys),
        "ood_all_choice_ce": macro(ood_all_keys, "choice_ce"),
        "ood_all_full_acc": macro(ood_all_keys, "full_vocab_acc"),
        "mean_prompt_tokens_all": round(
            sum(results[k]["mean_prompt_tokens"] for k in id_keys + ood_all_keys) / len(id_keys + ood_all_keys), 2
        ),
        "inference_ms_per_example": ms_per_ex,
    }
    return {"slices": results, "summary": summary}, ms_per_ex


def train_arm(
    arm_name: str,
    base_model: nn.Module,
    train_data: List[Dict],
    device: torch.device,
    pad_token_id: int,
    use_adapter: bool,
    seed: int,
) -> Tuple[Optional[TemporalClockAdapter], Dict]:
    """Train LoRA (+ optional TemporalClockAdapter) on frozen Qwen2.5-0.5B-Instruct."""
    set_all_seeds(seed)
    detach_lora(base_model)
    lora_params = attach_lora(base_model, rank=LORA_RANK, alpha=LORA_ALPHA, device=device)

    adapter: Optional[TemporalClockAdapter] = None
    param_groups = [{"params": lora_params, "lr": LR_LORA, "weight_decay": WEIGHT_DECAY}]
    adapter_param_count = 0
    if use_adapter:
        adapter = TemporalClockAdapter(
            in_dim=FEAT_DIM,
            hidden_dim=ADAPTER_HIDDEN,
            out_dim=base_model.config.hidden_size,
            n_tokens=N_SOFT_TOKENS,
            init_scale=0.02,
        ).to(device)
        adapter_params = list(adapter.parameters())
        adapter_param_count = sum(p.numel() for p in adapter_params)
        param_groups.append({"params": adapter_params, "lr": LR_ADAPTER, "weight_decay": WEIGHT_DECAY})

    lora_param_count = sum(p.numel() for p in lora_params)
    all_trainable = [p for g in param_groups for p in g["params"]]

    n_train = len(train_data)
    steps_per_epoch = n_train // BATCH_SIZE
    total_steps = steps_per_epoch * TRAIN_EPOCHS
    warmup_steps = max(10, int(0.05 * total_steps))

    optimizer = torch.optim.AdamW(param_groups)

    def lr_lambda(step: int) -> float:
        if step < warmup_steps:
            return float(step + 1) / float(warmup_steps)
        prog = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.05 + 0.95 * 0.5 * (1.0 + math.cos(math.pi * prog))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

    base_model.train()
    if adapter is not None:
        adapter.train()

    loss_curve = []
    step_idx = 0
    window_losses: List[float] = []
    window_grads: List[float] = []
    initial_loss: Optional[float] = None

    if device.type == "mps":
        torch.mps.synchronize()
    t0 = time.perf_counter()

    rng = random.Random(seed + 101)
    indices = list(range(n_train))
    for epoch in range(TRAIN_EPOCHS):
        rng.shuffle(indices)
        for b in range(steps_per_epoch):
            batch_idx = indices[b * BATCH_SIZE : (b + 1) * BATCH_SIZE]
            batch = [train_data[i] for i in batch_idx]

            optimizer.zero_grad(set_to_none=True)
            logits = forward_last_logits(base_model, batch, device, pad_token_id, adapter=adapter)
            targets = torch.tensor([x["target_tok_id"] for x in batch], dtype=torch.long, device=device)
            loss = F.cross_entropy(logits, targets)
            loss.backward()
            grad_norm = float(torch.nn.utils.clip_grad_norm_(all_trainable, 1.0).item())
            optimizer.step()
            scheduler.step()

            step_idx += 1
            lv = float(loss.item())
            if initial_loss is None:
                initial_loss = lv
            window_losses.append(lv)
            window_grads.append(grad_norm)

            if step_idx % 45 == 0 or step_idx == total_steps:
                mean_l = sum(window_losses) / len(window_losses)
                mean_g = sum(window_grads) / len(window_grads)
                loss_curve.append({
                    "step": step_idx,
                    "epoch": round(step_idx / steps_per_epoch, 2),
                    "mean_loss": round(mean_l, 4),
                    "mean_grad_norm": round(mean_g, 4),
                })
                print(
                    f"  [{arm_name}] step {step_idx:3d}/{total_steps} | "
                    f"loss={mean_l:.4f} | grad={mean_g:.3f}",
                    flush=True,
                )
                window_losses.clear()
                window_grads.clear()

    if device.type == "mps":
        torch.mps.synchronize()
    wall_s = time.perf_counter() - t0
    final_loss = loss_curve[-1]["mean_loss"]

    receipt = {
        "lora_trainable_params": lora_param_count,
        "adapter_trainable_params": adapter_param_count,
        "total_trainable_params": lora_param_count + adapter_param_count,
        "epochs": TRAIN_EPOCHS,
        "batch_size": BATCH_SIZE,
        "total_steps": total_steps,
        "initial_train_loss": round(float(initial_loss or 0.0), 4),
        "final_train_loss": round(float(final_loss), 4),
        "wall_seconds": round(wall_s, 2),
        "ms_per_step": round((wall_s * 1000.0) / max(1, total_steps), 2),
        "loss_curve": loss_curve,
    }
    return adapter, receipt


# ----------------------------------------------- Main Study Execution

def main() -> None:
    t_total = time.perf_counter()
    set_all_seeds(SEED)

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"EXP-012 starting on device={device} | model={MODEL_ID} | seed={SEED}", flush=True)

    # 1. Build real-ephemeris pools directly from python/astroengine/ (exact EXP-007 disjoint dates)
    t_eph = time.perf_counter()
    eng = Engine()
    extractor = CaelusPhaseExtractor(eng)

    # Train windows: Oslo & NYC Spring (Mar 10 - Apr 24, 45d) & Autumn (Sep 10 - Oct 24, 45d)
    oslo_spr_p, _, oslo_spr_s, oslo_spr_e = build_regime_pools(extractor, "Oslo", (2026, 3, 10), 45)
    oslo_aut_p, _, oslo_aut_s, oslo_aut_e = build_regime_pools(extractor, "Oslo", (2026, 9, 10), 45)
    nyc_spr_p, _, nyc_spr_s, nyc_spr_e = build_regime_pools(extractor, "NYC", (2026, 3, 10), 45)
    nyc_aut_p, _, nyc_aut_s, nyc_aut_e = build_regime_pools(extractor, "NYC", (2026, 9, 10), 45)

    # Held-out ID windows: Oslo & NYC Apr 26 - May 5 (10d) & Oct 26 - Nov 4 (10d)
    oslo_id1_p, _, oslo_id1_s, oslo_id1_e = build_regime_pools(extractor, "Oslo", (2026, 4, 26), 10)
    oslo_id2_p, _, oslo_id2_s, oslo_id2_e = build_regime_pools(extractor, "Oslo", (2026, 10, 26), 10)
    nyc_id1_p, _, nyc_id1_s, nyc_id1_e = build_regime_pools(extractor, "NYC", (2026, 4, 26), 10)
    nyc_id2_p, _, nyc_id2_s, nyc_id2_e = build_regime_pools(extractor, "NYC", (2026, 10, 26), 10)

    # Held-out OOD Solstice + Tokyo Travel windows
    oslo_win_p, _, oslo_win_s, oslo_win_e = build_regime_pools(extractor, "Oslo", (2026, 12, 10), 22)
    oslo_sum_p, _, oslo_sum_s, oslo_sum_e = build_regime_pools(extractor, "Oslo", (2026, 6, 10), 21)
    tokyo_trv_p, _, tokyo_trv_s, tokyo_trv_e = build_regime_pools(extractor, "Tokyo", (2026, 9, 15), 30)

    train_pools = {
        "Oslo": merge_pools([oslo_spr_p, oslo_aut_p]),
        "NYC": merge_pools([nyc_spr_p, nyc_aut_p]),
    }
    id_pools = {
        "Oslo": merge_pools([oslo_id1_p, oslo_id2_p]),
        "NYC": merge_pools([nyc_id1_p, nyc_id2_p]),
    }

    # Verify exact zero date overlap across train / ID / OOD
    def day_ints(city: str, y: int, m: int, d: int, n_days: int) -> List[Tuple[str, float]]:
        jd0 = julian_day(y, m, d, 0, 0, 0)
        return [(city, float(int(math.floor(jd0 + off + 0.5)))) for off in range(n_days)]

    train_days = set(
        day_ints("Oslo", 2026, 3, 10, 45)
        + day_ints("Oslo", 2026, 9, 10, 45)
        + day_ints("NYC", 2026, 3, 10, 45)
        + day_ints("NYC", 2026, 9, 10, 45)
    )
    id_days = set(
        day_ints("Oslo", 2026, 4, 26, 10)
        + day_ints("Oslo", 2026, 10, 26, 10)
        + day_ints("NYC", 2026, 4, 26, 10)
        + day_ints("NYC", 2026, 10, 26, 10)
    )
    ood_days = set(
        day_ints("Oslo", 2026, 12, 10, 22)
        + day_ints("Oslo", 2026, 6, 10, 21)
        + day_ints("Tokyo", 2026, 9, 15, 30)
    )
    assert len(train_days & id_days) == 0
    assert len(train_days & ood_days) == 0

    # 2. Generate train and held-out datasets
    rng = random.Random(SEED)
    train_regime = gen_regime_examples(rng, train_pools, N_TRAIN_REGIME, "train")
    train_ret_oslo = gen_retrieval_examples(
        rng, extractor, "Oslo", train_pools["Oslo"], "Oslo", train_pools["Oslo"],
        N_TRAIN_RETRIEVAL // 2, adversarial_same_utc=False, split_tag="train",
    )
    train_ret_nyc = gen_retrieval_examples(
        rng, extractor, "NYC", train_pools["NYC"], "NYC", train_pools["NYC"],
        N_TRAIN_RETRIEVAL // 2, adversarial_same_utc=False, split_tag="train",
    )
    train_compaction = gen_compaction_examples(
        rng, extractor,
        [
            ("Oslo", oslo_spr_s, oslo_spr_e),
            ("Oslo", oslo_aut_s, oslo_aut_e),
            ("NYC", nyc_spr_s, nyc_spr_e),
            ("NYC", nyc_aut_s, nyc_aut_e),
        ],
        N_TRAIN_COMPACTION, "train",
    )
    train_examples = train_regime + train_ret_oslo + train_ret_nyc + train_compaction
    rng.shuffle(train_examples)

    eval_slices_raw: Dict[str, List[Dict]] = {
        "id_regime": gen_regime_examples(rng, id_pools, N_ID_REGIME, "id_regime"),
        "id_photo_retrieval": (
            gen_retrieval_examples(
                rng, extractor, "Oslo", id_pools["Oslo"], "Oslo", id_pools["Oslo"],
                N_ID_RETRIEVAL // 2, adversarial_same_utc=False, split_tag="id_photo_retrieval",
            )
            + gen_retrieval_examples(
                rng, extractor, "NYC", id_pools["NYC"], "NYC", id_pools["NYC"],
                N_ID_RETRIEVAL // 2, adversarial_same_utc=False, split_tag="id_photo_retrieval",
            )
        ),
        "id_compaction": gen_compaction_examples(
            rng, extractor,
            [
                ("Oslo", oslo_id1_s, oslo_id1_e),
                ("Oslo", oslo_id2_s, oslo_id2_e),
                ("NYC", nyc_id1_s, nyc_id1_e),
                ("NYC", nyc_id2_s, nyc_id2_e),
            ],
            N_ID_COMPACTION, "id_compaction",
        ),
        "ood_oslo_winter_regime": gen_regime_examples(rng, {"Oslo": oslo_win_p}, N_OOD_PER_REGIME, "ood_oslo_winter_regime"),
        "ood_oslo_summer_regime": gen_regime_examples(rng, {"Oslo": oslo_sum_p}, N_OOD_PER_REGIME, "ood_oslo_summer_regime"),
        "ood_tokyo_travel_regime": gen_regime_examples(rng, {"Tokyo": tokyo_trv_p}, N_OOD_PER_REGIME, "ood_tokyo_travel_regime"),
        "ood_oslo_winter_retrieval": gen_retrieval_examples(
            rng, extractor, "Oslo", oslo_win_p, "Oslo", id_pools["Oslo"],
            N_OOD_PER_RETRIEVAL, adversarial_same_utc=True, split_tag="ood_oslo_winter_retrieval",
        ),
        "ood_oslo_summer_retrieval": gen_retrieval_examples(
            rng, extractor, "Oslo", oslo_sum_p, "Oslo", id_pools["Oslo"],
            N_OOD_PER_RETRIEVAL, adversarial_same_utc=True, split_tag="ood_oslo_summer_retrieval",
        ),
        "ood_tokyo_travel_retrieval": gen_retrieval_examples(
            rng, extractor, "Tokyo", tokyo_trv_p, "NYC", id_pools["NYC"],
            N_OOD_PER_RETRIEVAL, adversarial_same_utc=True, split_tag="ood_tokyo_travel_retrieval",
        ),
        "ood_compaction": gen_compaction_examples(
            rng, extractor,
            [
                ("Oslo", oslo_win_s, oslo_win_e),
                ("Oslo", oslo_sum_s, oslo_sum_e),
                ("Tokyo", tokyo_trv_s, tokyo_trv_e),
            ],
            N_OOD_COMPACTION, "ood_compaction",
        ),
    }

    # Verify zero example-level date leakage between train and held-out ID/OOD query/compaction days
    def extract_used_days(exs: Sequence[Dict]) -> set:
        s = set()
        for e in exs:
            if e["task"] == "photo_retrieval":
                # Query is jds[-1] in city; bank memories for OOD retrieval are from held-out ID bank (0 train overlap!)
                s.add((e["city"], float(int(math.floor(e["jds"][-1] + 0.5)))))
                for j in e["jds"][:-1]:
                    s.add((e["bank_city"], float(int(math.floor(j + 0.5)))))
            else:
                for j in e["jds"]:
                    s.add((e["city"], float(int(math.floor(j + 0.5)))))
        return s

    used_train = extract_used_days(train_examples)
    used_eval = extract_used_days([x for lst in eval_slices_raw.values() for x in lst])
    assert len(used_train & used_eval) == 0, f"Leakage detected: {len(used_train & used_eval)} overlapping city-days!"
    print(
        f"Ephemeris & zero-leakage splits built in {time.perf_counter() - t_eph:.1f}s | "
        f"train={len(train_examples)}, eval={sum(len(v) for v in eval_slices_raw.values())}, overlap=0",
        flush=True,
    )

    # 3. Load frozen pretrained LLM once on MPS
    t_load = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token_id = tokenizer.eos_token_id
    pad_token_id = int(tokenizer.pad_token_id)

    slot_start_id = tokenizer.encode(SLOT_START_TOK, add_special_tokens=False)
    slot_end_id = tokenizer.encode(SLOT_END_TOK, add_special_tokens=False)
    assert len(slot_start_id) == 1 and len(slot_end_id) == 1
    slot_start_id, slot_end_id = slot_start_id[0], slot_end_id[0]

    choice_id_cache: Dict[str, int] = {}
    for tok_str in REGIME_CHOICES + RETRIEVAL_CHOICES + COMPACTION_CHOICES:
        ids = tokenizer.encode(tok_str, add_special_tokens=False)
        assert len(ids) == 1, f"Choice {tok_str!r} is not 1 token: {ids}"
        choice_id_cache[tok_str] = ids[0]

    base_model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.bfloat16).to(device)
    for p in base_model.parameters():
        p.requires_grad = False
    frozen_base_params = sum(p.numel() for p in base_model.parameters())
    print(
        f"Loaded frozen {MODEL_ID} ({frozen_base_params:,} params) in {time.perf_counter() - t_load:.2f}s",
        flush=True,
    )

    # Pre-encode datasets for each input modality
    enc_eval_by_mode: Dict[str, Dict[str, List[Dict]]] = {}
    for mode in ("iso", "caelus_text", "unix_adapter", "unix_latlon_adapter", "caelus_adapter"):
        enc_eval_by_mode[mode] = {
            sname: prepare_encoded_dataset(slist, mode, tokenizer, slot_start_id, slot_end_id, choice_id_cache)
            for sname, slist in eval_slices_raw.items()
        }

    # Measure exact per-task prompt token counts and temporal token overhead
    token_accounting: Dict[str, Dict[str, float]] = {}
    for mode in ("iso", "caelus_text", "unix_adapter", "unix_latlon_adapter", "caelus_adapter"):
        by_task = {}
        for tname, sname in [
            ("regime", "ood_oslo_winter_regime"),
            ("photo_retrieval", "ood_oslo_winter_retrieval"),
            ("compaction", "ood_compaction"),
        ]:
            arr = [x["n_tokens"] for x in enc_eval_by_mode[mode][sname]]
            by_task[tname] = round(sum(arr) / len(arr), 2)
        by_task["macro_mean"] = round(sum(by_task.values()) / 3.0, 2)
        token_accounting[mode] = by_task

    # Also measure pure temporal clock-field tokens per event (excluding shared task instructions)
    sample_jd = julian_day(2026, 12, 21, 9, 0, 0)
    sample_phys = extractor.extract(sample_jd, CITIES["Oslo"]["lat"], CITIES["Oslo"]["lon"])
    iso_clock_tokens = len(tokenizer.encode(f"t={jd_to_utc_iso(sample_jd)}", add_special_tokens=False))
    caelus_text_clock_tokens = len(tokenizer.encode(format_caelus_text_clock(sample_jd, sample_phys), add_special_tokens=False))
    caelus_compaction_extra_tokens = len(tokenizer.encode("dt=10.0h night_crossed=true", add_special_tokens=False))
    adapter_clock_tokens = N_SOFT_TOKENS

    arms_eval: Dict[str, Dict] = {}
    arms_train: Dict[str, Dict] = {}

    # ---------------- Arm 0: Frozen ISO Prompt (0 trained params)
    print("\n--- Evaluating Arm0-Frozen-ISO-Prompt (0 trained params) ---", flush=True)
    detach_lora(base_model)
    arms_eval["Arm0-Frozen-ISO-Prompt"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["iso"], device, pad_token_id, adapter=None
    )
    arms_train["Arm0-Frozen-ISO-Prompt"] = {
        "lora_trainable_params": 0,
        "adapter_trainable_params": 0,
        "total_trainable_params": 0,
        "wall_seconds": 0.0,
    }
    print("  Arm0 summary:", arms_eval["Arm0-Frozen-ISO-Prompt"]["summary"], flush=True)

    # ---------------- Arm 1: Frozen Caelus TextPrompt (0 trained params; FACT-002 Steelman)
    print("\n--- Evaluating Arm1-Frozen-Caelus-TextPrompt (0 trained params; FACT-002 Steelman) ---", flush=True)
    detach_lora(base_model)
    arms_eval["Arm1-Frozen-Caelus-TextPrompt"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["caelus_text"], device, pad_token_id, adapter=None
    )
    arms_train["Arm1-Frozen-Caelus-TextPrompt"] = {
        "lora_trainable_params": 0,
        "adapter_trainable_params": 0,
        "total_trainable_params": 0,
        "wall_seconds": 0.0,
    }
    print("  Arm1 summary:", arms_eval["Arm1-Frozen-Caelus-TextPrompt"]["summary"], flush=True)

    # ---------------- Arm 1b: LoRA + Caelus TextPrompt (isolates LoRA capacity on text envelope)
    print("\n--- Training & Evaluating Arm1b-LoRA-TextPrompt ---", flush=True)
    train_enc_text = prepare_encoded_dataset(train_examples, "caelus_text", tokenizer, slot_start_id, slot_end_id, choice_id_cache)
    _, arms_train["Arm1b-LoRA-TextPrompt"] = train_arm(
        "Arm1b-LoRA-TextPrompt", base_model, train_enc_text, device, pad_token_id, use_adapter=False, seed=SEED
    )
    arms_eval["Arm1b-LoRA-TextPrompt"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["caelus_text"], device, pad_token_id, adapter=None
    )
    print("  Arm1b summary:", arms_eval["Arm1b-LoRA-TextPrompt"]["summary"], flush=True)

    # ---------------- Arm 2: LoRA + Unix-Fourier Soft-Token Adapter (Exact param parity with Arm3)
    print("\n--- Training & Evaluating Arm2-LoRA-UnixFourier-Adapter ---", flush=True)
    train_enc_unix = prepare_encoded_dataset(train_examples, "unix_adapter", tokenizer, slot_start_id, slot_end_id, choice_id_cache)
    adapter_unix, arms_train["Arm2-LoRA-UnixFourier-Adapter"] = train_arm(
        "Arm2-LoRA-UnixFourier-Adapter", base_model, train_enc_unix, device, pad_token_id, use_adapter=True, seed=SEED
    )
    arms_eval["Arm2-LoRA-UnixFourier-Adapter"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["unix_adapter"], device, pad_token_id, adapter=adapter_unix
    )
    print("  Arm2 summary:", arms_eval["Arm2-LoRA-UnixFourier-Adapter"]["summary"], flush=True)
    del adapter_unix

    # ---------------- Arm 2b: LoRA + Location-Aware Unix+LatLon Adapter (Exact param parity; zero location info gap!)
    print("\n--- Training & Evaluating Arm2b-LoRA-UnixFourier+LatLon-Adapter ---", flush=True)
    train_enc_unix_ll = prepare_encoded_dataset(train_examples, "unix_latlon_adapter", tokenizer, slot_start_id, slot_end_id, choice_id_cache)
    adapter_unix_ll, arms_train["Arm2b-LoRA-UnixFourier+LatLon-Adapter"] = train_arm(
        "Arm2b-LoRA-UnixFourier+LatLon-Adapter", base_model, train_enc_unix_ll, device, pad_token_id, use_adapter=True, seed=SEED
    )
    arms_eval["Arm2b-LoRA-UnixFourier+LatLon-Adapter"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["unix_latlon_adapter"], device, pad_token_id, adapter=adapter_unix_ll
    )
    print("  Arm2b summary:", arms_eval["Arm2b-LoRA-UnixFourier+LatLon-Adapter"]["summary"], flush=True)
    del adapter_unix_ll

    # ---------------- Arm 3: LoRA + Caelus Physical Geo-Adapter (Exact param parity with Arm2 & Arm2b)
    print("\n--- Training & Evaluating Arm3-LoRA-Caelus-GeoAdapter ---", flush=True)
    train_enc_geo = prepare_encoded_dataset(train_examples, "caelus_adapter", tokenizer, slot_start_id, slot_end_id, choice_id_cache)
    adapter_geo, arms_train["Arm3-LoRA-Caelus-GeoAdapter"] = train_arm(
        "Arm3-LoRA-Caelus-GeoAdapter", base_model, train_enc_geo, device, pad_token_id, use_adapter=True, seed=SEED
    )
    arms_eval["Arm3-LoRA-Caelus-GeoAdapter"], _ = evaluate_slices(
        base_model, enc_eval_by_mode["caelus_adapter"], device, pad_token_id, adapter=adapter_geo
    )
    print("  Arm3 summary:", arms_eval["Arm3-LoRA-Caelus-GeoAdapter"]["summary"], flush=True)
    del adapter_geo
    detach_lora(base_model)

    # Verify exact 0-parameter difference across Arm2, Arm2b, and Arm3
    p_arm2 = arms_train["Arm2-LoRA-UnixFourier-Adapter"]["total_trainable_params"]
    p_arm2b = arms_train["Arm2b-LoRA-UnixFourier+LatLon-Adapter"]["total_trainable_params"]
    p_arm3 = arms_train["Arm3-LoRA-Caelus-GeoAdapter"]["total_trainable_params"]
    assert p_arm2 == p_arm2b == p_arm3 and p_arm2 > 0

    receipt = {
        "schema_version": "exp012-training-receipt-v1",
        "id": "EXP-012",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "git_sha": get_git_sha(),
        "seed": SEED,
        "hardware": {
            "platform": platform.platform(),
            "machine": platform.machine(),
            "selected_device": str(device),
            "torch_version": torch.__version__,
            "dtype": "bfloat16_frozen_base_float32_adapters",
        },
        "base_model": {
            "model_id": MODEL_ID,
            "frozen_base_params": frozen_base_params,
            "hidden_size": int(base_model.config.hidden_size),
            "num_hidden_layers": int(base_model.config.num_hidden_layers),
            "num_attention_heads": int(base_model.config.num_attention_heads),
            "num_key_value_heads": int(base_model.config.num_key_value_heads),
            "lora_rank": LORA_RANK,
            "lora_alpha": LORA_ALPHA,
            "lora_target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
            "adapter_in_dim": FEAT_DIM,
            "adapter_hidden_dim": ADAPTER_HIDDEN,
            "adapter_soft_tokens_per_event": N_SOFT_TOKENS,
        },
        "parameter_parity": {
            "Arm0-Frozen-ISO-Prompt": 0,
            "Arm1-Frozen-Caelus-TextPrompt": 0,
            "Arm1b-LoRA-TextPrompt": arms_train["Arm1b-LoRA-TextPrompt"]["total_trainable_params"],
            "Arm2-LoRA-UnixFourier-Adapter": p_arm2,
            "Arm2b-LoRA-UnixFourier+LatLon-Adapter": p_arm2b,
            "Arm3-LoRA-Caelus-GeoAdapter": p_arm3,
            "arm2_arm3_param_diff": abs(p_arm3 - p_arm2),
            "arm2b_arm3_param_diff": abs(p_arm3 - p_arm2b),
            "trainable_pct_of_base_arm2_arm3": round(100.0 * p_arm3 / frozen_base_params, 4),
        },
        "dataset_splits": {
            "train_examples": len(train_examples),
            "train_by_task": {
                "regime": N_TRAIN_REGIME,
                "photo_retrieval": N_TRAIN_RETRIEVAL,
                "compaction": N_TRAIN_COMPACTION,
            },
            "eval_examples_total": sum(len(v) for v in eval_slices_raw.values()),
            "eval_slice_counts": {k: len(v) for k, v in eval_slices_raw.items()},
            "train_day_set_sha256_16": hash_day_set(list(train_days)),
            "id_day_set_sha256_16": hash_day_set(list(id_days)),
            "ood_day_set_sha256_16": hash_day_set(list(ood_days)),
            "train_id_day_overlap": len(train_days & id_days),
            "train_ood_day_overlap": len(train_days & ood_days),
            "example_level_train_eval_day_overlap": len(used_train & used_eval),
        },
        "token_accounting": {
            "per_event_clock_tokens": {
                "iso_text": iso_clock_tokens,
                "caelus_fact002_text": caelus_text_clock_tokens,
                "caelus_compaction_delta_extra": caelus_compaction_extra_tokens,
                "continuous_soft_adapter": adapter_clock_tokens,
                "adapter_vs_caelus_text_reduction_pct": round(
                    100.0 * (1.0 - adapter_clock_tokens / caelus_text_clock_tokens), 2
                ),
            },
            "mean_prompt_tokens_by_mode": token_accounting,
        },
        "training": arms_train,
        "evaluation": arms_eval,
        "total_wall_seconds": round(time.perf_counter() - t_total, 2),
    }

    out_path = HERE / "training_receipt.json"
    out_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"\nEXP-012 complete in {receipt['total_wall_seconds']}s -> wrote {out_path}", flush=True)


if __name__ == "__main__":
    main()
