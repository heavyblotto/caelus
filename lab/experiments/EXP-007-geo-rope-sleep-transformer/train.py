#!/usr/bin/env python3
"""EXP-007: Trained Tiny-Transformer Hybrid Dual-Clock Geo-RoPE + Google SLEEP Continual Learning Study.

Run via:
  uv run --python 3.12 --with torch --with numpy python lab/experiments/EXP-007-geo-rope-sleep-transformer/train.py

Strictly self-contained inside lab/experiments/EXP-007-geo-rope-sleep-transformer/.
Generates all ephemeris phases directly from Caelus's zero-dep python/astroengine/ reference engine,
trains 5 parameter-matched (1,427,136-param) autoregressive causal transformers (Part A) across
3 independent seeds (20261122, 20261123, 20261124):
  1. Standard-RoPE
  2. Hybrid-Unix-Fourier-RoPE
  3. Hybrid-Unix-Fourier+LatLon        (location-aware control eliminating the location information gap)
  4. Hybrid-NOAA20-RoPE                (20-line Spencer/NOAA solar-only baseline, zero Moon/ephemeris)
  5. Hybrid-Dual-Geo-RoPE              (Caelus python/astroengine/ physical torus)

Runs a 5-cycle sequential Wake -> Sleep continual consolidation benchmark on actual trained weights
and matched rank-16 LoRA adapters (Part B) across 6 arms x 3 seeds:
  1. Naive-Online-FT
  2. SLEEP-Fixed24h-LRU
  3. Diag-SLEEP-GeoRoPE-LRU
  4. SLEEP-Reservoir-Random            (Vitter's Algorithm R uniform reservoir sampling, B = 250)
  5. SLEEP-NOAA20-Stratified           (20-line NOAA solar horizon + season + lon stratification, B = 250)
  6. SLEEP-Caelus-Circadian-Stratified (Caelus astroengine horizon + season + lon stratification, B = 250)

Emits:
  - training_receipt.json (compact reproducible provenance, multi-seed mean +/- std, loss curves, split SHA-256 hashes)
"""

from __future__ import annotations

import copy
import datetime
import hashlib
import json
import math
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

SEEDS = [20261122, 20261123, 20261124]
PRIMARY_SEED = SEEDS[0]
TWO_PI = 2.0 * math.pi
SEC_PER_DAY = 86400.0
DT_MIN = 1.0 / 1440.0
JD_EPOCH = julian_day(2026, 9, 22, 0, 0, 0)

# During NYC -> Tokyo travel, the agent carries its home profile token (LOC_NYC = 54)
# while physical coordinates relocate to Tokyo (35.68N, 139.65E), avoiding untrained token IDs
# and modeling real home-timezone travel drift.
CITIES = {
    "Oslo": {"lat": 59.9139, "lon": 10.7522, "tok": 53},
    "NYC": {"lat": 40.7128, "lon": -74.0060, "tok": 54},
    "Tokyo": {"lat": 35.6762, "lon": 139.6503, "tok": 54},
}

# Vocabulary (V = 128)
VOCAB_SIZE = 128
TOK_PAD = 0
TOK_BOS = 1
TOK_RESET = 2
TOK_SEP = 3

TOK_Q_REG = 4
TOK_Q_STALE = 5
TOK_Q_REGIME = 6
TOK_Q_PHOTO = 7
TOK_Q_WEEK = 8
TOK_Q_POLICY = 9

REG_BASE = 10      # R0..R7 (10..17)
VAL_BASE = 18      # V0..V15 (18..33)
MEM_BASE = 34      # M0..M7 (34..41)
TOK_OP_SET = 42
TOK_OP_MEM = 43
TOK_V_REFRESH = 44
TOK_EVT_SYNC = 45

# Task 2 targets
TOK_STALE_FRESH = 46
TOK_STALE_NIGHT = 47
TOK_STALE_MULTI = 48

# Task 3A physical daylight/twilight/deadline targets
TOK_REG_NIGHT = 49
TOK_REG_DAWN = 50
TOK_REG_DAY = 51
TOK_REG_DUSK = 52
REGIME_TOKENS = [TOK_REG_NIGHT, TOK_REG_DAWN, TOK_REG_DAY, TOK_REG_DUSK]

# Part B shared semantic work events: 56..59
EVT_BASE = 56
# Part B policy action tokens: 64..79 (ACT_0..ACT_15)
ACT_BASE = 64

MAX_SEQ_LEN = 36
HEAD_DIM = 64
PLANES = HEAD_DIM // 2      # 32 rotary 2D planes
HALF_PLANES = PLANES // 2   # 16 fast + 16 slow planes

MODEL_CFG = {
    "vocab_size": VOCAB_SIZE,
    "d_model": 192,
    "n_layers": 4,
    "n_heads": 3,
    "d_ff": 512,
    "head_dim": HEAD_DIM,
    "dropout": 0.05,
    "max_seq_len": MAX_SEQ_LEN,
}

ENCODER_NAMES = [
    "Standard-RoPE",
    "Hybrid-Unix-Fourier-RoPE",
    "Hybrid-Unix-Fourier+LatLon",
    "Hybrid-NOAA20-RoPE",
    "Hybrid-Dual-Geo-RoPE",
]

PART_B_ARM_NAMES = [
    "Naive-Online-FT",
    "SLEEP-Fixed24h-LRU",
    "Diag-SLEEP-GeoRoPE-LRU",
    "SLEEP-Reservoir-Random",
    "SLEEP-NOAA20-Stratified",
    "SLEEP-Caelus-Circadian-Stratified",
]


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


def mean_std(vals: Sequence[float]) -> Tuple[float, float]:
    arr = np.asarray(vals, dtype=np.float64)
    m = float(np.mean(arr))
    s = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
    return round(m, 4), round(s, 4)


# ----------------------------------------------- 20-Line NOAA Solar Formula

def noaa20_solar(jd_ut: float, lat: float, lon: float) -> Dict[str, float]:
    """20-line Spencer (1971) / NOAA solar declination + equation-of-time formula (zero Moon, zero refraction, zero ephemeris)."""
    unix_sec = (jd_ut - 2440587.5) * SEC_PER_DAY
    dt = datetime.datetime.fromtimestamp(unix_sec, tz=datetime.timezone.utc)
    doy = dt.timetuple().tm_yday - 1
    utc_hr = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
    gamma = (TWO_PI / 365.0) * (doy + (utc_hr - 12.0) / 24.0)
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                       - 0.014615 * math.cos(2.0 * gamma) - 0.040849 * math.sin(2.0 * gamma))
    decl = (0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
            - 0.006758 * math.cos(2.0 * gamma) + 0.000907 * math.sin(2.0 * gamma)
            - 0.002697 * math.cos(3.0 * gamma) + 0.00148 * math.sin(3.0 * gamma))
    lat_r = lat * DEG
    tst = (utc_hr * 60.0 + eqtime + 4.0 * lon) % 1440.0
    ha = (tst / 4.0 - 180.0) * DEG
    sin_alt = max(-1.0, min(1.0, math.sin(lat_r) * math.sin(decl) + math.cos(lat_r) * math.cos(decl) * math.cos(ha)))
    alt_deg = math.degrees(math.asin(sin_alt))
    sin_p = max(-1.0, min(1.0, math.sin(lat_r) * math.sin(decl) + math.cos(lat_r) * math.cos(decl) * math.cos(ha + 0.25 * DEG)))
    rate_alt = math.degrees(math.asin(sin_p)) - alt_deg
    cos_ha0 = (math.cos(90.833 * DEG) - math.sin(lat_r) * math.sin(decl)) / max(1e-9, math.cos(lat_r) * math.cos(decl))
    if -1.0 <= cos_ha0 <= 1.0:
        ha0_deg = math.degrees(math.acos(cos_ha0))
        sr_tst, ss_tst = 720.0 - 4.0 * ha0_deg, 720.0 + 4.0 * ha0_deg
        if sr_tst <= tst < ss_tst:
            ph_rad = math.pi * (tst - sr_tst) / max(1e-6, ss_tst - sr_tst)
        else:
            ph_rad = math.pi + math.pi * (((tst - ss_tst) % 1440.0) / max(1e-6, 1440.0 - (ss_tst - sr_tst)))
    else:
        ph_rad = (TWO_PI * (tst / 1440.0)) % TWO_PI
    approx_sun_lon = ((doy + utc_hr / 24.0 - 79.5) * 360.0 / 365.25) % 360.0
    return {
        "sun_alt_deg": alt_deg,
        "sun_alt_rate": rate_alt,
        "sun_alt_phase": 2.0 * alt_deg * DEG,
        "sun_trend_phase": math.atan2(rate_alt, 0.15),
        "ph_rad": ph_rad,
        "approx_sun_lon": approx_sun_lon,
    }


# ----------------------------------------------- Caelus Ephemeris Extractor

class CaelusPhaseExtractor:
    """Computes real geocentric phases directly from python/astroengine/ plus cached 20-line NOAA solar baseline."""

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

        noaa = noaa20_solar(jd_ut, lat, lon)
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
            "noaa_sun_alt_deg": noaa["sun_alt_deg"],
            "noaa_sun_alt_phase": noaa["sun_alt_phase"],
            "noaa_sun_trend_phase": noaa["sun_trend_phase"],
            "noaa_ph_rad": noaa["ph_rad"],
            "noaa_approx_sun_lon": noaa["approx_sun_lon"],
        }
        self._point_cache[q_key] = out
        return out

    def classify_regime(self, phys: Dict[str, float]) -> int:
        alt = phys["sun_alt_deg"]
        rate = phys["sun_alt_rate"]
        ph = phys["ph_rad"]
        if alt < -6.0:
            return TOK_REG_NIGHT
        if rate >= 0.0 and (alt < 0.0 or ph < 0.25 * math.pi):
            return TOK_REG_DAWN
        if rate < 0.0 and (alt < 0.0 or ph > 0.75 * math.pi):
            return TOK_REG_DUSK
        return TOK_REG_DAY


# ----------------------------------------------- Rotary Phase Schedules (32 planes)

FREQS_32 = np.array([10000.0 ** (-2.0 * p / 64.0) for p in range(PLANES)], dtype=np.float32)
FREQS_16 = np.array([10000.0 ** (-2.0 * p / 32.0) for p in range(HALF_PLANES)], dtype=np.float32)


def compute_thetas_all(m: int, jd_ut: float, phys: Dict[str, float]) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return 5 rotary phase vectors each of shape (32,) float32."""
    th_std = (m * FREQS_32).astype(np.float32)
    fast_16 = (m * FREQS_16).astype(np.float32)

    t_sec = (jd_ut - JD_EPOCH) * SEC_PER_DAY
    p24 = TWO_PI * t_sec / SEC_PER_DAY
    p7d = TWO_PI * t_sec / (7.0 * SEC_PER_DAY)
    p365 = TWO_PI * t_sec / (365.25 * SEC_PER_DAY)
    lat = phys["lat"]
    lon = phys["lon"]
    p_lmt = TWO_PI * ((jd_ut - JD_EPOCH + lon / 360.0) % 1.0)
    lat_r = lat * DEG
    lon_r = lon * DEG

    # 1. Hybrid-Unix-Fourier-RoPE (pure UTC 24h / 7d / 365.25d)
    utc_16 = np.array([
        p24, p24, 2.0 * p24, 2.0 * p24, 3.0 * p24, 4.0 * p24,
        p7d, 2.0 * p7d, 4.0 * p7d, 8.0 * p7d, p7d, 2.0 * p7d,
        p365, 2.0 * p365, 4.0 * p365, 8.0 * p365,
    ], dtype=np.float32)
    th_unix = np.concatenate([fast_16, utc_16])

    # 2. Hybrid-Unix-Fourier+LatLon (location-aware control matching EXP-012 Arm2b: LMT + UTC + 7d + 365.25d + lat/lon)
    latlon_16 = np.array([
        p_lmt, 2.0 * p_lmt, 3.0 * p_lmt, 4.0 * p_lmt,
        p24, 2.0 * p24,
        p7d, 2.0 * p7d, 4.0 * p7d,
        p365, 2.0 * p365, 4.0 * p365, 8.0 * p365,
        lat_r, 2.0 * lat_r, lon_r,
    ], dtype=np.float32)
    th_latlon = np.concatenate([fast_16, latlon_16])

    # 3. Hybrid-NOAA20-RoPE (20-line NOAA solar altitude + trend + photoperiod arc + rational 7d/365.25d; ZERO Moon/ephemeris)
    sa_n = phys["noaa_sun_alt_phase"]
    st_n = phys["noaa_sun_trend_phase"]
    ph_n = phys["noaa_ph_rad"]
    noaa_16 = np.array([
        p_lmt, p24,
        sa_n, 2.0 * sa_n, st_n,
        ph_n, 2.0 * ph_n, 3.0 * ph_n,
        p7d, 2.0 * p7d, 4.0 * p7d, 8.0 * p7d,
        p365, 2.0 * p365, 4.0 * p365, 8.0 * p365,
    ], dtype=np.float32)
    th_noaa = np.concatenate([fast_16, noaa_16])

    # 4. Hybrid-Dual-Geo-RoPE (Caelus python/astroengine/ physical torus with lunar incommensurate frequencies)
    g = phys["gast_rad"]
    asc = phys["asc_rad"]
    sa = phys["sun_alt_phase"]
    st = phys["sun_trend_phase"]
    php = phys["ph_rad"]
    ml = phys["moon_lon_rad"]
    el = phys["elong_rad"]
    sl = phys["sun_lon_rad"]
    geo_16 = np.array([
        g, asc,
        sa, 2.0 * sa, st,
        php, 2.0 * php, 3.0 * php,
        ml, 2.0 * ml, 4.0 * ml, 8.0 * ml,
        el, 4.0 * el,
        sl, 4.0 * sl,
    ], dtype=np.float32)
    th_geo = np.concatenate([fast_16, geo_16])
    return th_std, th_unix, th_latlon, th_noaa, th_geo


def build_sequence_tensors(
    tokens: List[int],
    m_steps: List[int],
    jds: List[float],
    phys_list: List[Optional[Dict[str, float]]],
    target_positions: List[Tuple[int, int]],
) -> Dict:
    seq_len = len(tokens)
    assert seq_len <= MAX_SEQ_LEN, f"Sequence len {seq_len} > {MAX_SEQ_LEN}"

    ids = np.full(MAX_SEQ_LEN, TOK_PAD, dtype=np.int64)
    labels = np.full(MAX_SEQ_LEN, -100, dtype=np.int64)
    th_std = np.zeros((MAX_SEQ_LEN, PLANES), dtype=np.float32)
    th_unix = np.zeros((MAX_SEQ_LEN, PLANES), dtype=np.float32)
    th_latlon = np.zeros((MAX_SEQ_LEN, PLANES), dtype=np.float32)
    th_noaa = np.zeros((MAX_SEQ_LEN, PLANES), dtype=np.float32)
    th_geo = np.zeros((MAX_SEQ_LEN, PLANES), dtype=np.float32)

    for i in range(seq_len):
        ids[i] = tokens[i]
        if i == 0:
            continue
        s, u, ll, noaa, g = compute_thetas_all(m_steps[i], jds[i], phys_list[i])
        th_std[i] = s
        th_unix[i] = u
        th_latlon[i] = ll
        th_noaa[i] = noaa
        th_geo[i] = g

    for pos, tok in target_positions:
        assert 1 <= pos < seq_len
        labels[pos - 1] = tok

    return {
        "ids": ids,
        "labels": labels,
        "thetas": {
            "Standard-RoPE": th_std,
            "Hybrid-Unix-Fourier-RoPE": th_unix,
            "Hybrid-Unix-Fourier+LatLon": th_latlon,
            "Hybrid-NOAA20-RoPE": th_noaa,
            "Hybrid-Dual-Geo-RoPE": th_geo,
        },
        "target_positions": target_positions,
    }


def stack_examples(examples: List[Dict]) -> Dict:
    return {
        "ids": torch.tensor(np.stack([e["ids"] for e in examples]), dtype=torch.long),
        "labels": torch.tensor(np.stack([e["labels"] for e in examples]), dtype=torch.long),
        "thetas": {
            name: torch.tensor(np.stack([e["thetas"][name] for e in examples]), dtype=torch.float32)
            for name in ENCODER_NAMES
        },
        "meta": [e.get("meta", {}) for e in examples],
    }


# ----------------------------------------- Precomputed Ephemeris Regime Pools

def build_regime_pools(
    extractor: CaelusPhaseExtractor,
    city_name: str,
    start_ymd: Tuple[int, int, int],
    n_days: int,
    step_minutes: int = 20,
) -> Tuple[Dict[int, List[Tuple[float, Dict[str, float]]]], List[Tuple[float, Dict[str, float]]]]:
    c = CITIES[city_name]
    lat, lon = c["lat"], c["lon"]
    jd0 = julian_day(start_ymd[0], start_ymd[1], start_ymd[2], 0, 0, 0)
    by_regime: Dict[int, List[Tuple[float, Dict[str, float]]]] = {r: [] for r in REGIME_TOKENS}
    all_pts: List[Tuple[float, Dict[str, float]]] = []
    steps_per_day = (24 * 60) // step_minutes
    for d in range(n_days):
        for s in range(steps_per_day):
            jd = jd0 + d + (s * step_minutes) / 1440.0
            phys = extractor.extract(jd, lat, lon)
            reg = extractor.classify_regime(phys)
            by_regime[reg].append((jd, phys))
            all_pts.append((jd, phys))
    return by_regime, all_pts


def hash_jds(items: Sequence[Tuple[str, float]]) -> str:
    h = hashlib.sha256()
    for city, jd in sorted(set((c, round(j, 4)) for c, j in items)):
        h.update(f"{city}:{jd:.4f}\n".encode("utf-8"))
    return h.hexdigest()[:16]


# ----------------------------------------------- Part A Task Generators

def gen_task1_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    base_pool: List[Tuple[str, float, Dict[str, float]]],
    n_examples: int,
) -> List[Dict]:
    out = []
    for _ in range(n_examples):
        city, jd0, _ = rng.choice(base_pool)
        lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]

        tokens = [TOK_BOS]
        m_steps = [0]
        jds = [jd0]
        phys_list: List[Optional[Dict[str, float]]] = [None]
        target_positions: List[Tuple[int, int]] = []

        state: Dict[int, int] = {}
        m = 1

        def push(tok: int) -> int:
            nonlocal m
            t_cur = jd0 + (m * 0.07) / SEC_PER_DAY
            tokens.append(tok)
            m_steps.append(m)
            jds.append(t_cur)
            phys_list.append(extractor.extract(t_cur, lat, lon))
            pos = len(tokens) - 1
            m += 1
            return pos

        for _ in range(4):
            last_overwritten = None
            for _ in range(2):
                reg = rng.randint(0, 3)
                val = rng.randint(0, 7)
                if reg in state and state[reg] == val:
                    val = (val + rng.randint(1, 7)) % 8
                if reg in state:
                    last_overwritten = reg
                state[reg] = val
                push(REG_BASE + reg)
                push(VAL_BASE + val)

            q_reg = last_overwritten if last_overwritten is not None else rng.choice(list(state.keys()))
            ans_tok = VAL_BASE + state[q_reg]
            push(TOK_Q_REG)
            push(REG_BASE + q_reg)
            ans_pos = push(ans_tok)
            target_positions.append((ans_pos, ans_tok))

        ex = build_sequence_tensors(tokens, m_steps, jds, phys_list, target_positions=target_positions)
        ex["meta"] = {"task": "task1_intra_turn", "city": city, "jd": jd0}
        out.append(ex)
    return out


def gen_task2_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    evening_pool: List[Tuple[str, float, Dict[str, float]]],
    n_examples: int,
) -> List[Dict]:
    out = []
    gap_modes = ["fresh_5m", "sleep_14h", "dormancy_multi_day"]
    for idx in range(n_examples):
        mode = gap_modes[idx % 3]
        city, jd1, phys1 = rng.choice(evening_pool)
        lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]

        if mode == "fresh_5m":
            dt_days = rng.uniform(3.0, 15.0) / 1440.0
            stale_tok = TOK_STALE_FRESH
        elif mode == "sleep_14h":
            dt_days = rng.uniform(11.5, 16.0) / 24.0
            stale_tok = TOK_STALE_NIGHT
        else:
            dt_days = rng.uniform(3.2, 9.8)
            stale_tok = TOK_STALE_MULTI

        jd2 = jd1 + dt_days
        phys2 = extractor.extract(jd2, lat, lon)

        reg = rng.randint(0, 3)
        val = rng.randint(0, 7)
        val_tok = VAL_BASE + val
        state_ans = val_tok if mode == "fresh_5m" else TOK_V_REFRESH

        tokens = [
            TOK_BOS,
            TOK_OP_SET, REG_BASE + reg, val_tok, TOK_EVT_SYNC,
            TOK_RESET, TOK_Q_STALE, stale_tok,
            TOK_Q_REG, REG_BASE + reg, state_ans,
        ]
        m_steps = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5]
        jds = [jd1, jd1, jd1, jd1, jd1, jd2, jd2, jd2, jd2, jd2, jd2]
        phys_list: List[Optional[Dict[str, float]]] = [
            None, phys1, phys1, phys1, phys1,
            phys2, phys2, phys2, phys2, phys2, phys2,
        ]

        ex = build_sequence_tensors(
            tokens, m_steps, jds, phys_list,
            target_positions=[(7, stale_tok), (10, state_ans)],
        )
        ex["meta"] = {"task": "task2_post_sleep", "mode": mode, "city": city, "jd1": jd1, "jd2": jd2}
        out.append(ex)
    return out


def gen_task3a_examples(
    rng: random.Random,
    pools_by_city: Dict[str, Dict[int, List[Tuple[float, Dict[str, float]]]]],
    n_examples: int,
    split_tag: str,
) -> List[Dict]:
    cities = list(pools_by_city.keys())
    out = []
    for idx in range(n_examples):
        city = cities[idx % len(cities)]
        reg_tok = REGIME_TOKENS[(idx // len(cities)) % len(REGIME_TOKENS)]
        cand_list = pools_by_city[city][reg_tok]
        if not cand_list:
            reg_tok = rng.choice([r for r in REGIME_TOKENS if pools_by_city[city][r]])
            cand_list = pools_by_city[city][reg_tok]
        jd, phys = rng.choice(cand_list)

        tokens = [TOK_BOS, CITIES[city]["tok"], TOK_EVT_SYNC, TOK_Q_REGIME, reg_tok]
        m_steps = [0, 1, 2, 3, 4]
        jds = [jd, jd, jd, jd, jd]
        phys_list: List[Optional[Dict[str, float]]] = [None, phys, phys, phys, phys]

        ex = build_sequence_tensors(
            tokens, m_steps, jds, phys_list, target_positions=[(4, reg_tok)]
        )
        ex["meta"] = {"task": "task3a_regime", "split": split_tag, "city": city, "jd": jd, "regime": reg_tok}
        out.append(ex)
    return out


def gen_task3b_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    query_city: str,
    query_pools: Dict[int, List[Tuple[float, Dict[str, float]]]],
    bank_city: str,
    bank_pools: Dict[int, List[Tuple[float, Dict[str, float]]]],
    n_examples: int,
    adversarial_same_utc: bool,
    split_tag: str,
) -> List[Dict]:
    bank_lat, bank_lon = CITIES[bank_city]["lat"], CITIES[bank_city]["lon"]
    out = []
    attempts = 0
    while len(out) < n_examples and attempts < n_examples * 30:
        attempts += 1
        target_reg = REGIME_TOKENS[attempts % len(REGIME_TOKENS)]
        if not query_pools[target_reg] or not bank_pools[target_reg]:
            target_reg = rng.choice([r for r in REGIME_TOKENS if query_pools[r] and bank_pools[r]])
        jd_q, phys_q = rng.choice(query_pools[target_reg])
        jd_match, phys_match = rng.choice(bank_pools[target_reg])

        other_regs = [r for r in REGIME_TOKENS if r != target_reg]
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
            rem_regs = [r for r in other_regs if r != adv_reg]
            for r in rem_regs:
                distractors.append(rng.choice(bank_pools[r]))
        else:
            for r in other_regs:
                distractors.append(rng.choice(bank_pools[r]))

        vals = rng.sample(range(8), 4)
        entries = [(jd_match, phys_match, VAL_BASE + vals[0], True)] + [
            (distractors[i][0], distractors[i][1], VAL_BASE + vals[i + 1], False)
            for i in range(3)
        ]
        rng.shuffle(entries)
        match_val_tok = next(v for _, _, v, is_m in entries if is_m)

        tokens = [TOK_BOS]
        m_steps = [0]
        jds = [jd_q]
        phys_list: List[Optional[Dict[str, float]]] = [None]

        for slot_i, (jd_m, phys_m, v_tok, _) in enumerate(entries):
            tokens.extend([TOK_RESET, TOK_OP_MEM, MEM_BASE + slot_i, v_tok])
            m_steps.extend([0, 1, 2, 3])
            jds.extend([jd_m, jd_m, jd_m, jd_m])
            phys_list.extend([phys_m, phys_m, phys_m, phys_m])

        tokens.extend([TOK_RESET, CITIES[query_city]["tok"], TOK_Q_PHOTO, match_val_tok])
        m_steps.extend([0, 1, 2, 3])
        jds.extend([jd_q, jd_q, jd_q, jd_q])
        phys_list.extend([phys_q, phys_q, phys_q, phys_q])

        ex = build_sequence_tensors(
            tokens, m_steps, jds, phys_list, target_positions=[(len(tokens) - 1, match_val_tok)]
        )
        ex["meta"] = {
            "task": "task3b_photoperiod_retrieval",
            "split": split_tag,
            "query_city": query_city,
            "bank_city": bank_city,
            "adversarial_same_utc": adversarial_same_utc,
            "jd_q": jd_q,
        }
        out.append(ex)
    assert len(out) == n_examples, f"Only generated {len(out)}/{n_examples} for {split_tag}"
    return out


def gen_task4_examples(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
    base_start_jds: List[float],
    n_examples: int,
    jitter_min_max: float,
    day_offsets: Sequence[int],
    split_tag: str,
) -> List[Dict]:
    lat, lon = CITIES["Oslo"]["lat"], CITIES["Oslo"]["lon"]
    n_slots = len(day_offsets)
    out = []
    for _ in range(n_examples):
        d0 = rng.choice(base_start_jds)
        utc_hour = rng.choice([8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0])
        base_jd = d0 + utc_hour / 24.0

        vals = rng.sample(range(8), n_slots)
        target_slot = rng.randint(0, n_slots - 1)

        entries = []
        for idx, off in enumerate(day_offsets):
            jd_m = base_jd + off
            phys_m = extractor.extract(jd_m, lat, lon)
            entries.append((jd_m, phys_m, VAL_BASE + vals[idx], idx == target_slot, off))
        rng.shuffle(entries)

        jd_target = base_jd + day_offsets[target_slot]
        jitter_days = rng.uniform(-jitter_min_max, jitter_min_max) / 1440.0 if jitter_min_max > 0 else 0.0
        jd_q = jd_target + jitter_days
        phys_q = extractor.extract(jd_q, lat, lon)
        target_val_tok = VAL_BASE + vals[target_slot]

        tokens = [TOK_BOS]
        m_steps = [0]
        jds = [jd_q]
        phys_list: List[Optional[Dict[str, float]]] = [None]

        for slot_i, (jd_m, phys_m, v_tok, _, _) in enumerate(entries):
            tokens.extend([TOK_RESET, TOK_OP_MEM, MEM_BASE + slot_i, v_tok])
            m_steps.extend([0, 1, 2, 3])
            jds.extend([jd_m, jd_m, jd_m, jd_m])
            phys_list.extend([phys_m, phys_m, phys_m, phys_m])

        tokens.extend([TOK_RESET, TOK_Q_WEEK, target_val_tok])
        m_steps.extend([0, 1, 2])
        jds.extend([jd_q, jd_q, jd_q])
        phys_list.extend([phys_q, phys_q, phys_q])

        ex = build_sequence_tensors(
            tokens, m_steps, jds, phys_list, target_positions=[(len(tokens) - 1, target_val_tok)]
        )
        ex["meta"] = {
            "task": "task4_multiweek",
            "split": split_tag,
            "jitter_min_max": jitter_min_max,
            "target_offset_days": day_offsets[target_slot],
            "jd_q": jd_q,
        }
        out.append(ex)
    return out


# ----------------------------------------- PyTorch Causal Transformer + LoRA

class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        norm = torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        return x * norm * self.weight


class LoRALinear(nn.Module):
    """Wraps a frozen nn.Linear with a trainable low-rank LoRA specialist block."""

    def __init__(self, base_linear: nn.Linear, rank: int = 16, alpha: float = 16.0):
        super().__init__()
        self.base = base_linear
        for p in self.base.parameters():
            p.requires_grad = False
        self.rank = rank
        self.scale = alpha / rank
        in_f = base_linear.in_features
        out_f = base_linear.out_features
        self.lora_a = nn.Parameter(torch.empty(rank, in_f))
        self.lora_b = nn.Parameter(torch.zeros(out_f, rank))
        nn.init.kaiming_uniform_(self.lora_a, a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        base_out = self.base(x)
        lora_out = F.linear(F.linear(x, self.lora_a), self.lora_b) * self.scale
        return base_out + lora_out


def apply_rotary_emb(q: torch.Tensor, k: torch.Tensor, thetas: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
    """Exact SO(2)^32 block-diagonal 2D rotary transform on q, k: [B, H, T, 64], thetas: [B, T, 32]."""
    cos = torch.cos(thetas).unsqueeze(1)
    sin = torch.sin(thetas).unsqueeze(1)

    q0, q1 = q[..., 0::2], q[..., 1::2]
    k0, k1 = k[..., 0::2], k[..., 1::2]

    q_rot = torch.stack([q0 * cos - q1 * sin, q0 * sin + q1 * cos], dim=-1).flatten(-2)
    k_rot = torch.stack([k0 * cos - k1 * sin, k0 * sin + k1 * cos], dim=-1).flatten(-2)
    return q_rot, k_rot


class CausalSelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % n_heads == 0
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads
        self.dropout_p = dropout
        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        self.o_proj = nn.Linear(d_model, d_model, bias=False)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, thetas: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        q = self.q_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)

        q, k = apply_rotary_emb(q, k, thetas)

        y = F.scaled_dot_product_attention(
            q, k, v,
            attn_mask=None,
            dropout_p=self.dropout_p if self.training else 0.0,
            is_causal=True,
        )
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.drop(self.o_proj(y))


class TransformerBlock(nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.norm1 = RMSNorm(d_model)
        self.attn = CausalSelfAttention(d_model, n_heads, dropout=dropout)
        self.norm2 = RMSNorm(d_model)
        self.fc1 = nn.Linear(d_model, d_ff, bias=False)
        self.fc2 = nn.Linear(d_ff, d_model, bias=False)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, thetas: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.norm1(x), thetas)
        h = self.drop(F.gelu(self.fc1(self.norm2(x))))
        x = x + self.drop(self.fc2(h))
        return x


class TinyCausalTransformer(nn.Module):
    def __init__(self, cfg: Dict):
        super().__init__()
        drop = cfg.get("dropout", 0.1)
        self.tok_emb = nn.Embedding(cfg["vocab_size"], cfg["d_model"])
        self.emb_drop = nn.Dropout(drop)
        self.blocks = nn.ModuleList([
            TransformerBlock(cfg["d_model"], cfg["n_heads"], cfg["d_ff"], dropout=drop)
            for _ in range(cfg["n_layers"])
        ])
        self.norm_f = RMSNorm(cfg["d_model"])
        self.lm_head = nn.Linear(cfg["d_model"], cfg["vocab_size"], bias=False)
        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(m: nn.Module) -> None:
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)

    def forward(self, ids: torch.Tensor, thetas: torch.Tensor) -> torch.Tensor:
        x = self.emb_drop(self.tok_emb(ids))
        for blk in self.blocks:
            x = blk(x, thetas)
        return self.lm_head(self.norm_f(x))


def attach_sleep_lora(model: TinyCausalTransformer, rank: int = 16, alpha: float = 16.0) -> Tuple[int, int]:
    for p in model.parameters():
        p.requires_grad = False

    for blk in model.blocks:
        blk.attn.q_proj = LoRALinear(blk.attn.q_proj, rank=rank, alpha=alpha)
        blk.attn.k_proj = LoRALinear(blk.attn.k_proj, rank=rank, alpha=alpha)
        blk.attn.v_proj = LoRALinear(blk.attn.v_proj, rank=rank, alpha=alpha)
        blk.attn.o_proj = LoRALinear(blk.attn.o_proj, rank=rank, alpha=alpha)
        blk.fc1 = LoRALinear(blk.fc1, rank=rank, alpha=alpha)
        blk.fc2 = LoRALinear(blk.fc2, rank=rank, alpha=alpha)
    model.lm_head = LoRALinear(model.lm_head, rank=rank, alpha=alpha)

    frozen_params = sum(p.numel() for p in model.parameters() if not p.requires_grad)
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return frozen_params, trainable_params


def count_params(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


# ----------------------------------------- Device Benchmark & Train/Eval Utils

def select_best_device() -> Tuple[torch.device, Dict[str, float]]:
    timings: Dict[str, float] = {}
    candidates = ["cpu"]
    if torch.backends.mps.is_available():
        candidates.append("mps")

    for dev_name in candidates:
        dev = torch.device(dev_name)
        set_all_seeds(PRIMARY_SEED)
        m = TinyCausalTransformer(MODEL_CFG).to(dev)
        ids = torch.randint(0, VOCAB_SIZE, (192, MAX_SEQ_LEN), device=dev)
        thetas = torch.randn(192, MAX_SEQ_LEN, PLANES, device=dev)
        labels = torch.full((192, MAX_SEQ_LEN), -100, dtype=torch.long, device=dev)
        labels[:, -2] = torch.randint(0, VOCAB_SIZE, (192,), device=dev)
        opt = torch.optim.AdamW(m.parameters(), lr=1e-3)

        for _ in range(3):
            opt.zero_grad(set_to_none=True)
            logits = m(ids, thetas)
            loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), labels.view(-1), ignore_index=-100)
            loss.backward()
            opt.step()
        if dev_name == "mps":
            torch.mps.synchronize()

        t0 = time.perf_counter()
        n_steps = 12
        for _ in range(n_steps):
            opt.zero_grad(set_to_none=True)
            logits = m(ids, thetas)
            loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), labels.view(-1), ignore_index=-100)
            loss.backward()
            opt.step()
        if dev_name == "mps":
            torch.mps.synchronize()
        timings[dev_name] = round((time.perf_counter() - t0) * 1000.0 / n_steps, 3)

    best_name = min(timings, key=lambda k: timings[k])
    return torch.device(best_name), timings


@torch.no_grad()
def eval_dataset(
    model: nn.Module,
    ds: Dict,
    enc_name: str,
    device: torch.device,
    batch_size: int = 256,
) -> Dict[str, float]:
    model.eval()
    ids_all = ds["ids"]
    labels_all = ds["labels"]
    thetas_all = ds["thetas"][enc_name]
    n = ids_all.shape[0]
    total_loss = 0.0
    total_tokens = 0
    correct_tokens = 0
    seq_exact = 0
    margin_sum = 0.0

    for start in range(0, n, batch_size):
        ids = ids_all[start:start + batch_size].to(device)
        labels = labels_all[start:start + batch_size].to(device)
        thetas = thetas_all[start:start + batch_size].to(device)

        logits = model(ids, thetas)
        loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), labels.view(-1), ignore_index=-100, reduction="sum")
        mask = labels != -100
        preds = logits.argmax(dim=-1)
        correct = (preds == labels) & mask

        if mask.any():
            m_logits = logits[mask]
            m_labels = labels[mask]
            true_l = m_logits.gather(1, m_labels.unsqueeze(1)).squeeze(1)
            comp = m_logits.clone()
            comp.scatter_(1, m_labels.unsqueeze(1), float("-inf"))
            best_other = comp.max(dim=1).values
            margin_sum += float((true_l - best_other).sum().item())

        total_loss += float(loss.item())
        total_tokens += int(mask.sum().item())
        correct_tokens += int(correct.sum().item())
        seq_ok = ((preds == labels) | (~mask)).all(dim=-1)
        seq_exact += int(seq_ok.sum().item())

    return {
        "token_acc": round(correct_tokens / max(1, total_tokens), 4),
        "seq_exact_acc": round(seq_exact / max(1, n), 4),
        "loss": round(total_loss / max(1, total_tokens), 4),
        "mean_logit_margin": round(margin_sum / max(1, total_tokens), 4),
        "n_examples": n,
    }


def train_part_a_model(
    seed: int,
    enc_name: str,
    init_state: Dict,
    train_ds: Dict,
    val_ds: Dict,
    device: torch.device,
    epochs: int = 28,
    batch_size: int = 192,
    lr: float = 2.1e-3,
) -> Tuple[TinyCausalTransformer, Dict]:
    set_all_seeds(seed + ENCODER_NAMES.index(enc_name) * 17)
    model = TinyCausalTransformer(MODEL_CFG).to(device)
    model.load_state_dict(copy.deepcopy(init_state))

    n_train = train_ds["ids"].shape[0]
    # Stage full training tensors directly on device once (~60 MB) for fast MPS throughput
    ids_dev = train_ds["ids"].to(device)
    labels_dev = train_ds["labels"].to(device)
    thetas_dev = train_ds["thetas"][enc_name].to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.02)
    total_steps = epochs * ((n_train + batch_size - 1) // batch_size)
    warmup = min(100, total_steps // 10)

    def lr_lambda(step: int) -> float:
        if step < warmup:
            return float(step + 1) / float(max(1, warmup))
        prog = float(step - warmup) / float(max(1, total_steps - warmup))
        return 0.05 + 0.95 * 0.5 * (1.0 + math.cos(math.pi * prog))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_lambda)

    loss_curve = []
    val_curve = []
    t0 = time.perf_counter()
    step = 0

    for ep in range(1, epochs + 1):
        model.train()
        perm = torch.randperm(n_train, device=device)
        ep_loss_sum = 0.0
        ep_tok_sum = 0
        ep_gnorm = 0.0
        n_batches = 0

        for start in range(0, n_train, batch_size):
            idx = perm[start:start + batch_size]
            ids = ids_dev[idx]
            labels = labels_dev[idx]
            thetas = thetas_dev[idx]

            opt.zero_grad(set_to_none=True)
            logits = model(ids, thetas)
            loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), labels.view(-1), ignore_index=-100)
            loss.backward()
            gn = float(torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item())
            opt.step()
            sched.step()
            step += 1

            n_tok = int((labels != -100).sum().item())
            ep_loss_sum += float(loss.item()) * n_tok
            ep_tok_sum += n_tok
            ep_gnorm += gn
            n_batches += 1

        ep_loss = round(ep_loss_sum / max(1, ep_tok_sum), 4)
        loss_curve.append({
            "epoch": ep,
            "train_loss": ep_loss,
            "mean_grad_norm": round(ep_gnorm / max(1, n_batches), 4),
        })
        if ep in (1, 7, 14, 21, epochs):
            val_m = eval_dataset(model, val_ds, enc_name, device)
            val_curve.append({"epoch": ep, "val_loss": val_m["loss"], "val_token_acc": val_m["token_acc"]})

    if device.type == "mps":
        torch.mps.synchronize()
    wall_s = round(time.perf_counter() - t0, 2)

    del ids_dev, labels_dev, thetas_dev
    return model, {
        "encoder": enc_name,
        "param_count": count_params(model),
        "epochs": epochs,
        "batch_size": batch_size,
        "optimizer_steps": step,
        "wall_time_sec": wall_s,
        "initial_train_loss": loss_curve[0]["train_loss"],
        "final_train_loss": loss_curve[-1]["train_loss"],
        "loss_curve": loss_curve,
        "val_curve": val_curve,
    }


# ----------------------------------------- Part B: Google SLEEP Continual Study

def phase_stratum_key(phys: Dict[str, float]) -> Tuple[int, int, int]:
    """Unsupervised Caelus physical phase stratum key (zero task labels)."""
    alt = phys["sun_alt_deg"]
    d_bin = 0 if alt < -6.0 else (1 if alt <= 6.0 else 2)
    s_bin = int(((phys["sun_lon_deg"] + 45.0) % 360.0) // 90.0) % 4
    lon_bin = int(((phys["lon"] + 180.0) % 360.0) // 60.0) % 6
    return (d_bin, s_bin, lon_bin)


def noaa_phase_stratum_key(phys: Dict[str, float]) -> Tuple[int, int, int]:
    """Unsupervised 20-line NOAA solar-only phase stratum key (zero Moon/ephemeris, zero labels)."""
    alt = phys["noaa_sun_alt_deg"]
    d_bin = 0 if alt < -6.0 else (1 if alt <= 6.0 else 2)
    s_bin = int(((phys["noaa_approx_sun_lon"] + 45.0) % 360.0) // 90.0) % 4
    lon_bin = int(((phys["lon"] + 180.0) % 360.0) // 60.0) % 6
    return (d_bin, s_bin, lon_bin)


def compact_lru_buffer(buffer: List[Dict], new_items: List[Dict], capacity: int) -> List[Dict]:
    combined = buffer + new_items
    return combined if len(combined) <= capacity else combined[-capacity:]


def compact_stratified_buffer(
    buffer: List[Dict], new_items: List[Dict], capacity: int, stratum_field: str
) -> List[Dict]:
    combined = buffer + new_items
    if len(combined) <= capacity:
        return combined

    strata: Dict[Tuple[int, int, int], List[Dict]] = {}
    for item in reversed(combined):
        k = item["meta"][stratum_field]
        strata.setdefault(k, []).append(item)

    selected: List[Dict] = []
    keys = sorted(strata.keys())
    idx = 0
    while len(selected) < capacity and any(strata[k] for k in keys):
        k = keys[idx % len(keys)]
        if strata[k]:
            selected.append(strata[k].pop(0))
        idx += 1
    return selected


def update_reservoir_vitter_r(
    buffer: List[Dict],
    new_items: List[Dict],
    capacity: int,
    n_seen: int,
    res_rng: random.Random,
) -> Tuple[List[Dict], int]:
    """Exact Vitter's Algorithm R uniform reservoir sampling across the cumulative wake stream."""
    buf = list(buffer)
    for item in new_items:
        n_seen += 1
        if len(buf) < capacity:
            buf.append(item)
        else:
            j = res_rng.randint(0, n_seen - 1)
            if j < capacity:
                buf[j] = item
    return buf, n_seen


def build_part_b_cycles(
    rng: random.Random,
    extractor: CaelusPhaseExtractor,
) -> Tuple[List[Dict], Dict]:
    """Build 5 sequential Wake -> Sleep continual learning regimes grounded in astroengine."""

    def policy_action(cycle_id: int, evt: int, reg_val: int) -> int:
        parity = reg_val % 2
        if cycle_id == 1:
            return ACT_BASE + ((evt + parity) % 4)
        if cycle_id == 2:
            return ACT_BASE + 4 + ((evt + parity) % 3)
        if cycle_id == 3:
            return ACT_BASE + 7 + ((evt + parity) % 3)
        if cycle_id == 4:
            return ACT_BASE + 10 + ((evt + parity) % 3)
        return ACT_BASE + 13 + ((evt + parity) % 3)

    specs = [
        {
            "cycle_id": 1,
            "name": "Cycle-1 Daytime Coding (Oslo Autumn)",
            "short": "C1:Day-Code",
            "city": "Oslo",
            "wake_start": (2026, 9, 14), "wake_days": 10,
            "eval_start": (2026, 9, 25), "eval_days": 5,
            "filter": lambda jd, p: p["sun_alt_deg"] >= 8.0,
        },
        {
            "cycle_id": 2,
            "name": "Cycle-2 Dusk Handoff (Oslo Autumn)",
            "short": "C2:Dusk-Hand",
            "city": "Oslo",
            "wake_start": (2026, 10, 1), "wake_days": 10,
            "eval_start": (2026, 10, 12), "eval_days": 5,
            "filter": lambda jd, p: (-6.0 <= p["sun_alt_deg"] <= 6.0 and p["sun_alt_rate"] < 0.0),
        },
        {
            "cycle_id": 3,
            "name": "Cycle-3 Nocturnal Maintenance (Oslo Autumn)",
            "short": "C3:Noct-Maint",
            "city": "Oslo",
            "wake_start": (2026, 10, 18), "wake_days": 10,
            "eval_start": (2026, 10, 29), "eval_days": 5,
            "filter": lambda jd, p: p["sun_alt_deg"] <= -8.0,
        },
        {
            "cycle_id": 4,
            "name": "Cycle-4 Oslo Winter Shift (5.9h Daylight)",
            "short": "C4:Oslo-Wint",
            "city": "Oslo",
            "wake_start": (2026, 12, 11), "wake_days": 10,
            "eval_start": (2026, 12, 22), "eval_days": 6,
            "filter": lambda jd, p: (12.5 <= (((jd - math.floor(jd + 0.5) + 0.5) % 1.0) * 24.0) <= 15.5),
        },
        {
            "cycle_id": 5,
            "name": "Cycle-5 Tokyo Travel Handoff (+9h UTC)",
            "short": "C5:Tokyo-Trv",
            "city": "Tokyo",
            "wake_start": (2026, 11, 22), "wake_days": 10,
            "eval_start": (2026, 12, 3), "eval_days": 6,
            "filter": lambda jd, p: p["sun_alt_deg"] >= 8.0,
        },
    ]

    cycles = []
    gate_audit = []

    for sp in specs:
        city = sp["city"]
        lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]

        def sample_window(ymd: Tuple[int, int, int], n_days: int) -> List[Tuple[float, Dict[str, float]]]:
            jd0 = julian_day(ymd[0], ymd[1], ymd[2], 0, 0, 0)
            pts = []
            for d in range(n_days):
                for m_step in range(0, 24 * 60, 10):
                    jd = jd0 + d + m_step / 1440.0
                    p = extractor.extract(jd, lat, lon)
                    if sp["filter"](jd, p):
                        pts.append((jd, p))
            return pts

        wake_pts = sample_window(sp["wake_start"], sp["wake_days"])
        eval_pts = sample_window(sp["eval_start"], sp["eval_days"])
        assert len(wake_pts) >= 20 and len(eval_pts) >= 10

        jd_gate0 = julian_day(sp["wake_start"][0], sp["wake_start"][1], sp["wake_start"][2], 0, 0, 0)
        fixed_triggers = 0
        fixed_safe_night = 0
        noaa_triggers = 0
        noaa_safe_night = 0
        caelus_triggers = 0
        caelus_safe_night = 0
        for d in range(5):
            for h in range(24):
                jd_h = jd_gate0 + d + (h + 0.5) / 24.0
                p_h = extractor.extract(jd_h, lat, lon)
                is_true_night = p_h["sun_alt_deg"] < -6.0
                if h >= 22 or h < 6:
                    fixed_triggers += 1
                    if is_true_night:
                        fixed_safe_night += 1
                if p_h["noaa_sun_alt_deg"] < -6.0:
                    noaa_triggers += 1
                    if is_true_night:
                        noaa_safe_night += 1
                if is_true_night:
                    caelus_triggers += 1
                    caelus_safe_night += 1

        gate_audit.append({
            "cycle_id": sp["cycle_id"],
            "name": sp["short"],
            "city": city,
            "fixed24h_utc_gate_nocturnal_safety": round(fixed_safe_night / max(1, fixed_triggers), 4),
            "noaa20_horizon_gate_nocturnal_safety": round(noaa_safe_night / max(1, noaa_triggers), 4),
            "caelus_horizon_gate_nocturnal_safety": round(caelus_safe_night / max(1, caelus_triggers), 4),
            "fixed24h_daytime_interruptions_pct": round(1.0 - fixed_safe_night / max(1, fixed_triggers), 4),
        })

        def make_episodes(pts: List[Tuple[float, Dict[str, float]]], n_ep: int) -> List[Dict]:
            eps = []
            for i in range(n_ep):
                jd, phys = rng.choice(pts)
                evt = i % 4
                reg = rng.randint(0, 3)
                val = rng.randint(0, 7)
                act_tok = policy_action(sp["cycle_id"], evt, val)
                tokens = [
                    TOK_BOS,
                    CITIES[city]["tok"],
                    EVT_BASE + evt,
                    REG_BASE + reg,
                    VAL_BASE + val,
                    TOK_Q_POLICY,
                    act_tok,
                ]
                m_steps = [0, 1, 2, 3, 4, 5, 6]
                jds = [jd] * len(tokens)
                phys_list: List[Optional[Dict[str, float]]] = [None] + [phys] * (len(tokens) - 1)
                ex = build_sequence_tensors(
                    tokens, m_steps, jds, phys_list, target_positions=[(len(tokens) - 1, act_tok)]
                )
                ex["meta"] = {
                    "cycle_id": sp["cycle_id"],
                    "city": city,
                    "jd": jd,
                    "phase_stratum": phase_stratum_key(phys),
                    "noaa_stratum": noaa_phase_stratum_key(phys),
                }
                eps.append(ex)
            return eps

        wake_eps = make_episodes(wake_pts, 200)
        eval_eps = make_episodes(eval_pts, 120)
        buffer_ingest = wake_eps[:125]

        cycles.append({
            "cycle_id": sp["cycle_id"],
            "name": sp["name"],
            "short": sp["short"],
            "city": city,
            "wake_eps": wake_eps,
            "buffer_ingest": buffer_ingest,
            "eval_eps": eval_eps,
            "eval_ds": stack_examples(eval_eps),
        })

    return cycles, {
        "by_cycle": gate_audit,
        "overall_fixed24h_nocturnal_safety": round(float(np.mean([g["fixed24h_utc_gate_nocturnal_safety"] for g in gate_audit])), 4),
        "overall_noaa20_nocturnal_safety": round(float(np.mean([g["noaa20_horizon_gate_nocturnal_safety"] for g in gate_audit])), 4),
        "overall_caelus_nocturnal_safety": round(float(np.mean([g["caelus_horizon_gate_nocturnal_safety"] for g in gate_audit])), 4),
    }


def run_part_b_arm(
    seed: int,
    arm_name: str,
    base_model: TinyCausalTransformer,
    enc_name: str,
    cycles: List[Dict],
    part_a_task1_ds: Dict,
    part_a_task2_ds: Dict,
    device: torch.device,
    use_sleep_lora: bool,
    buffer_mode: str,
    buffer_capacity: int = 250,
    lora_rank: int = 16,
    wake_steps: int = 40,
    sleep_steps: int = 300,
    batch_size: int = 32,
) -> Dict:
    set_all_seeds(seed + 999)
    res_rng = random.Random(seed + 4242)
    model = copy.deepcopy(base_model).to(device)

    if use_sleep_lora:
        frozen_p, trainable_p = attach_sleep_lora(model, rank=lora_rank, alpha=float(lora_rank))
        model = model.to(device)
        wake_lr = 6.0e-4
        sleep_lr = 1.2e-3
    else:
        for p in model.parameters():
            p.requires_grad = True
        frozen_p = 0
        trainable_p = count_params(model)
        wake_lr = 5.0e-4
        sleep_lr = 5.0e-4

    pre_t1 = eval_dataset(model, part_a_task1_ds, enc_name, device)["token_acc"]
    pre_t2 = eval_dataset(model, part_a_task2_ds, enc_name, device)["seq_exact_acc"]

    replay_buffer: List[Dict] = []
    n_stream_seen = 0
    acc_matrix: List[Dict[str, float]] = []
    buffer_composition: List[Dict[str, int]] = []
    cycle_losses: List[Dict[str, float]] = []
    t0 = time.perf_counter()

    for c_idx, cyc in enumerate(cycles):
        trainable = [p for p in model.parameters() if p.requires_grad]
        wake_opt = torch.optim.AdamW(trainable, lr=wake_lr, weight_decay=0.01)
        wake_ds = stack_examples(cyc["wake_eps"])
        w_ids = wake_ds["ids"].to(device)
        w_labels = wake_ds["labels"].to(device)
        w_thetas = wake_ds["thetas"][enc_name].to(device)
        n_w = w_ids.shape[0]

        # 1. WAKE PHASE
        model.train()
        wake_loss_start = None
        wake_loss_end = None
        n_w_steps = wake_steps if use_sleep_lora else 100
        for _ in range(n_w_steps):
            idx = torch.randint(0, n_w, (batch_size,), device=device)
            wake_opt.zero_grad(set_to_none=True)
            logits = model(w_ids[idx], w_thetas[idx])
            loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), w_labels[idx].view(-1), ignore_index=-100)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable, 1.0)
            wake_opt.step()
            lv = float(loss.item())
            if wake_loss_start is None:
                wake_loss_start = lv
            wake_loss_end = lv

        # 2. OFFLINE SLEEP CONSOLIDATION ("DREAMING" REHEARSAL)
        sleep_loss_end = wake_loss_end
        if use_sleep_lora and buffer_mode != "none":
            if buffer_mode == "lru":
                replay_buffer = compact_lru_buffer(replay_buffer, cyc["buffer_ingest"], buffer_capacity)
            elif buffer_mode == "reservoir":
                replay_buffer, n_stream_seen = update_reservoir_vitter_r(
                    replay_buffer, cyc["buffer_ingest"], buffer_capacity, n_stream_seen, res_rng
                )
            elif buffer_mode == "noaa_stratified":
                replay_buffer = compact_stratified_buffer(
                    replay_buffer, cyc["buffer_ingest"], buffer_capacity, stratum_field="noaa_stratum"
                )
            elif buffer_mode == "caelus_stratified":
                replay_buffer = compact_stratified_buffer(
                    replay_buffer, cyc["buffer_ingest"], buffer_capacity, stratum_field="phase_stratum"
                )
            else:
                raise ValueError(buffer_mode)

            comp = {f"C{k}": 0 for k in range(1, 6)}
            for ep in replay_buffer:
                comp[f"C{ep['meta']['cycle_id']}"] += 1
            buffer_composition.append(comp)

            dream_ds = stack_examples(replay_buffer)
            d_ids = dream_ds["ids"].to(device)
            d_labels = dream_ds["labels"].to(device)
            d_thetas = dream_ds["thetas"][enc_name].to(device)
            n_d = d_ids.shape[0]
            sleep_opt = torch.optim.AdamW(trainable, lr=sleep_lr, weight_decay=0.01)
            sleep_sched = torch.optim.lr_scheduler.CosineAnnealingLR(sleep_opt, T_max=sleep_steps, eta_min=1e-4)

            model.train()
            for _ in range(sleep_steps):
                d_idx = torch.randint(0, n_d, (batch_size,), device=device)
                thetas_dream = d_thetas[d_idx] + torch.randn((batch_size, MAX_SEQ_LEN, PLANES), device=device) * 0.008
                thetas_dream[:, 0, :] = 0.0

                sleep_opt.zero_grad(set_to_none=True)
                logits = model(d_ids[d_idx], thetas_dream)
                loss = F.cross_entropy(logits.view(-1, VOCAB_SIZE), d_labels[d_idx].view(-1), ignore_index=-100)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(trainable, 1.0)
                sleep_opt.step()
                sleep_sched.step()
                sleep_loss_end = float(loss.item())
        else:
            buffer_composition.append({f"C{k}": 0 for k in range(1, 6)})

        cycle_losses.append({
            "cycle": cyc["cycle_id"],
            "wake_loss_start": round(wake_loss_start or 0.0, 4),
            "wake_loss_end": round(wake_loss_end or 0.0, 4),
            "sleep_loss_end": round(sleep_loss_end or 0.0, 4),
        })

        row = {"after_cycle": cyc["cycle_id"]}
        seen_accs = []
        for eval_i in range(c_idx + 1):
            ec = cycles[eval_i]
            m_ev = eval_dataset(model, ec["eval_ds"], enc_name, device)
            row[f"C{ec['cycle_id']}"] = m_ev["seq_exact_acc"]
            seen_accs.append(m_ev["seq_exact_acc"])
        row["mean_seen_acc"] = round(float(np.mean(seen_accs)), 4)
        acc_matrix.append(row)

    if device.type == "mps":
        torch.mps.synchronize()
    wall_s = round(time.perf_counter() - t0, 2)

    final_row = acc_matrix[-1]
    final_c1_c5 = [final_row[f"C{k}"] for k in range(1, 6)]
    mean_final_retention = round(float(np.mean(final_c1_c5)), 4)
    ood_winter_travel_acc = round(0.5 * (final_row["C4"] + final_row["C5"]), 4)

    # Forgetting delta = mean over cycles c in {1..4} of max(0, peak_acc_c - final_acc_c)
    forgetting_deltas = []
    for k in range(1, 5):
        peak_k = max(row[f"C{k}"] for row in acc_matrix if f"C{k}" in row)
        final_k = final_row[f"C{k}"]
        forgetting_deltas.append(max(0.0, peak_k - final_k))
    mean_forgetting_delta = round(float(np.mean(forgetting_deltas)), 4)

    post_t1 = eval_dataset(model, part_a_task1_ds, enc_name, device)["token_acc"]
    post_t2 = eval_dataset(model, part_a_task2_ds, enc_name, device)["seq_exact_acc"]

    return {
        "arm": arm_name,
        "backbone_encoder": enc_name,
        "use_sleep_lora": use_sleep_lora,
        "buffer_mode": buffer_mode,
        "buffer_capacity": buffer_capacity if use_sleep_lora else 0,
        "frozen_core_params": frozen_p,
        "trainable_params": trainable_p,
        "wall_time_sec": wall_s,
        "acc_matrix": acc_matrix,
        "cycle_losses": cycle_losses,
        "buffer_composition_after_cycle": buffer_composition,
        "final_cycle_accs": {f"C{k}": final_row[f"C{k}"] for k in range(1, 6)},
        "final_mean_retention_c1_c5": mean_final_retention,
        "catastrophic_forgetting_delta_c1_c4": mean_forgetting_delta,
        "ood_winter_travel_acc": ood_winter_travel_acc,
        "base_skill_retention": {
            "pre_task1_acc": pre_t1,
            "post_task1_acc": post_t1,
            "pre_task2_acc": pre_t2,
            "post_task2_acc": post_t2,
        },
    }


# ----------------------------------------- Single-Seed Pipeline & Aggregation

def run_single_seed(
    seed: int,
    device: torch.device,
    extractor: CaelusPhaseExtractor,
    pools: Dict,
) -> Dict:
    t_seed = time.perf_counter()
    set_all_seeds(seed)
    rng = random.Random(seed)
    print(f"\n=== EXP-007 Seed {seed} ===")

    tr_t1 = gen_task1_examples(rng, extractor, pools["train_base_pts"], 5000)
    tr_t2 = gen_task2_examples(rng, extractor, pools["train_eve_pts"], 2000)
    tr_t3a = gen_task3a_examples(rng, {"Oslo": pools["oslo_tr_pool"], "NYC": pools["nyc_tr_pool"]}, 2000, "train")
    tr_t3b = (
        gen_task3b_examples(rng, extractor, "Oslo", pools["oslo_spr_tr"], "Oslo", pools["oslo_spr_tr"], 600, False, "train_same")
        + gen_task3b_examples(rng, extractor, "NYC", pools["nyc_aut_tr"], "NYC", pools["nyc_aut_tr"], 600, False, "train_same")
        + gen_task3b_examples(rng, extractor, "Oslo", pools["oslo_aut_tr"], "NYC", pools["nyc_aut_tr"], 600, True, "train_cross")
        + gen_task3b_examples(rng, extractor, "NYC", pools["nyc_spr_tr"], "Oslo", pools["oslo_spr_tr"], 600, True, "train_cross")
    )
    tr_t4 = gen_task4_examples(rng, extractor, pools["t4_train_jds"], 2000, jitter_min_max=60.0, day_offsets=[0, 7, 14, 21, 28], split_tag="train")

    train_all = tr_t1 + tr_t2 + tr_t3a + tr_t3b + tr_t4
    rng.shuffle(train_all)
    train_ds = stack_examples(train_all)

    te_t1 = gen_task1_examples(rng, extractor, pools["id_base_pts"], 400)
    te_t2_id = gen_task2_examples(rng, extractor, pools["id_eve_pts"], 300)
    te_t2_ood = gen_task2_examples(rng, extractor, pools["ood_eve_pts"], 300)
    te_t3a_id = gen_task3a_examples(rng, {"Oslo": pools["oslo_id_pool"], "NYC": pools["nyc_id_pool"]}, 400, "id_spring_autumn")

    te_t3a_win = gen_task3a_examples(rng, {"Oslo": pools["oslo_win_ood"]}, 240, "ood_oslo_winter")
    te_t3a_sum = gen_task3a_examples(rng, {"Oslo": pools["oslo_sum_ood"]}, 240, "ood_oslo_summer")
    te_t3a_tok = gen_task3a_examples(rng, {"Tokyo": pools["tokyo_ood"]}, 240, "ood_tokyo_travel")

    te_t3b_id = gen_task3b_examples(rng, extractor, "Oslo", pools["oslo_id_pool"], "Oslo", pools["oslo_id_pool"], 200, False, "id_same")
    te_t3b_win = gen_task3b_examples(rng, extractor, "Oslo", pools["oslo_win_ood"], "Oslo", pools["oslo_aut_tr"], 240, True, "ood_oslo_winter")
    te_t3b_sum = gen_task3b_examples(rng, extractor, "Oslo", pools["oslo_sum_ood"], "Oslo", pools["oslo_aut_tr"], 240, True, "ood_oslo_summer")
    te_t3b_tok = gen_task3b_examples(rng, extractor, "Tokyo", pools["tokyo_ood"], "NYC", pools["nyc_aut_tr"], 240, True, "ood_nyc_to_tokyo")

    te_t4_exact = gen_task4_examples(rng, extractor, pools["t4_ood_jds"], 300, jitter_min_max=0.0, day_offsets=[0, 7, 14, 21, 28], split_tag="ood_exact_utc")
    te_t4_jitter = gen_task4_examples(rng, extractor, pools["t4_ood_jds"], 300, jitter_min_max=90.0, day_offsets=[0, 7, 14, 21, 28], split_tag="ood_jitter_90m")
    te_t4_wrap52w = gen_task4_examples(rng, extractor, pools["t4_ood_jds"], 300, jitter_min_max=30.0, day_offsets=[0, 7, 14, 21, 364], split_tag="ood_52w_annual_wrap")
    te_t4_id = gen_task4_examples(rng, extractor, pools["t4_id_jds"], 300, jitter_min_max=60.0, day_offsets=[0, 7, 14, 21, 28], split_tag="id_jitter_60m")

    val_ds = stack_examples(te_t1[:100] + te_t2_id[:100] + te_t3a_id[:100] + te_t3b_id[:100] + te_t4_id[:100])
    eval_suites = {
        "task1_intra_turn": stack_examples(te_t1),
        "task2_post_sleep_id": stack_examples(te_t2_id),
        "task2_post_sleep_ood": stack_examples(te_t2_ood),
        "task2_post_sleep_all": stack_examples(te_t2_id + te_t2_ood),
        "task3a_id_spring_autumn": stack_examples(te_t3a_id),
        "task3b_id_same_season": stack_examples(te_t3b_id),
        "task3a_ood_oslo_winter": stack_examples(te_t3a_win),
        "task3a_ood_oslo_summer": stack_examples(te_t3a_sum),
        "task3a_ood_tokyo_travel": stack_examples(te_t3a_tok),
        "task3b_ood_oslo_winter": stack_examples(te_t3b_win),
        "task3b_ood_oslo_summer": stack_examples(te_t3b_sum),
        "task3b_ood_nyc_to_tokyo": stack_examples(te_t3b_tok),
        "task4_ood_exact_utc": stack_examples(te_t4_exact),
        "task4_ood_jitter_90m": stack_examples(te_t4_jitter),
        "task4_ood_52w_annual_wrap": stack_examples(te_t4_wrap52w),
        "task4_id_jitter_60m": stack_examples(te_t4_id),
    }

    set_all_seeds(seed)
    shared_init_model = TinyCausalTransformer(MODEL_CFG)
    shared_init_state = copy.deepcopy(shared_init_model.state_dict())

    trained_models: Dict[str, TinyCausalTransformer] = {}
    part_a_training: Dict[str, Dict] = {}
    part_a_eval: Dict[str, Dict[str, Dict]] = {}

    for enc_name in ENCODER_NAMES:
        model, train_log = train_part_a_model(
            seed, enc_name, shared_init_state, train_ds, val_ds, device, epochs=28, batch_size=192, lr=2.1e-3
        )
        trained_models[enc_name] = model
        part_a_training[enc_name] = train_log
        part_a_eval[enc_name] = {}
        for s_name, s_ds in eval_suites.items():
            part_a_eval[enc_name][s_name] = eval_dataset(model, s_ds, enc_name, device)

        ev = part_a_eval[enc_name]
        t1 = ev["task1_intra_turn"]["token_acc"]
        t1_seq = ev["task1_intra_turn"]["seq_exact_acc"]
        t2 = ev["task2_post_sleep_all"]["seq_exact_acc"]
        t3_oslo = round(float(np.mean([
            ev["task3a_ood_oslo_winter"]["seq_exact_acc"],
            ev["task3a_ood_oslo_summer"]["seq_exact_acc"],
            ev["task3b_ood_oslo_winter"]["seq_exact_acc"],
            ev["task3b_ood_oslo_summer"]["seq_exact_acc"],
        ])), 4)
        t3_tokyo = round(float(np.mean([
            ev["task3a_ood_tokyo_travel"]["seq_exact_acc"],
            ev["task3b_ood_nyc_to_tokyo"]["seq_exact_acc"],
        ])), 4)
        t3_ood = round(float(np.mean([
            ev["task3a_ood_oslo_winter"]["seq_exact_acc"],
            ev["task3a_ood_oslo_summer"]["seq_exact_acc"],
            ev["task3a_ood_tokyo_travel"]["seq_exact_acc"],
            ev["task3b_ood_oslo_winter"]["seq_exact_acc"],
            ev["task3b_ood_oslo_summer"]["seq_exact_acc"],
            ev["task3b_ood_nyc_to_tokyo"]["seq_exact_acc"],
        ])), 4)
        t3_id = round(0.5 * (
            ev["task3a_id_spring_autumn"]["seq_exact_acc"]
            + ev["task3b_id_same_season"]["seq_exact_acc"]
        ), 4)
        t4_30d = round(0.5 * (
            ev["task4_ood_exact_utc"]["seq_exact_acc"]
            + ev["task4_ood_jitter_90m"]["seq_exact_acc"]
        ), 4)
        t4_wrap = ev["task4_ood_52w_annual_wrap"]["seq_exact_acc"]
        t4_composite = round(float(np.mean([
            ev["task4_ood_exact_utc"]["seq_exact_acc"],
            ev["task4_ood_jitter_90m"]["seq_exact_acc"],
            t4_wrap,
        ])), 4)

        ev["summary"] = {
            "task1_intra_turn_acc": t1,
            "task1_intra_turn_seq3_exact": t1_seq,
            "task2_post_sleep_acc": t2,
            "task3_id_control_acc": t3_id,
            "task3_ood_oslo_solstices_acc": t3_oslo,
            "task3_ood_tokyo_travel_acc": t3_tokyo,
            "task3_ood_composite_acc": t3_ood,
            "task3a_ood_regime_acc": round(float(np.mean([
                ev["task3a_ood_oslo_winter"]["seq_exact_acc"],
                ev["task3a_ood_oslo_summer"]["seq_exact_acc"],
                ev["task3a_ood_tokyo_travel"]["seq_exact_acc"],
            ])), 4),
            "task3b_ood_retrieval_acc": round(float(np.mean([
                ev["task3b_ood_oslo_winter"]["seq_exact_acc"],
                ev["task3b_ood_oslo_summer"]["seq_exact_acc"],
                ev["task3b_ood_nyc_to_tokyo"]["seq_exact_acc"],
            ])), 4),
            "task4_multiweek_30d_acc": t4_30d,
            "task4_52w_annual_wrap_acc": t4_wrap,
            "task4_multiweek_ood_acc": t4_composite,
            "task4_ood_exact_utc_acc": ev["task4_ood_exact_utc"]["seq_exact_acc"],
            "task4_ood_jitter_90m_acc": ev["task4_ood_jitter_90m"]["seq_exact_acc"],
            "task4_30d_logit_margin": round(0.5 * (
                ev["task4_ood_exact_utc"]["mean_logit_margin"]
                + ev["task4_ood_jitter_90m"]["mean_logit_margin"]
            ), 4),
        }
        print(
            f"  [PartA s={seed}] {enc_name:28s} | loss {train_log['initial_train_loss']:.3f}->{train_log['final_train_loss']:.3f} "
            f"| T1={t1:.3f} T2={t2:.3f} T3-ID={t3_id:.3f} T3-OOD={t3_ood:.3f} (Oslo={t3_oslo:.3f} Tok={t3_tokyo:.3f}) "
            f"T4-30d={t4_30d:.3f} T4-52w={t4_wrap:.3f} ({train_log['wall_time_sec']}s)"
        )

    # Part B: 6 continual learning arms
    cycles, gate_audit = build_part_b_cycles(rng, extractor)
    arm_configs = [
        ("Naive-Online-FT", "Hybrid-Dual-Geo-RoPE", False, "none"),
        ("SLEEP-Fixed24h-LRU", "Hybrid-Unix-Fourier-RoPE", True, "lru"),
        ("Diag-SLEEP-GeoRoPE-LRU", "Hybrid-Dual-Geo-RoPE", True, "lru"),
        ("SLEEP-Reservoir-Random", "Hybrid-Dual-Geo-RoPE", True, "reservoir"),
        ("SLEEP-NOAA20-Stratified", "Hybrid-NOAA20-RoPE", True, "noaa_stratified"),
        ("SLEEP-Caelus-Circadian-Stratified", "Hybrid-Dual-Geo-RoPE", True, "caelus_stratified"),
    ]
    part_b_arms: Dict[str, Dict] = {}
    for arm_name, enc_name, use_lora, buf_mode in arm_configs:
        res = run_part_b_arm(
            seed=seed,
            arm_name=arm_name,
            base_model=trained_models[enc_name],
            enc_name=enc_name,
            cycles=cycles,
            part_a_task1_ds=eval_suites["task1_intra_turn"],
            part_a_task2_ds=eval_suites["task2_post_sleep_all"],
            device=device,
            use_sleep_lora=use_lora,
            buffer_mode=buf_mode,
            buffer_capacity=250,
        )
        part_b_arms[arm_name] = res
        print(
            f"  [PartB s={seed}] {arm_name:34s} | Final={res['final_mean_retention_c1_c5']:.3f} "
            f"| Forget={res['catastrophic_forgetting_delta_c1_c4']:.3f} | W+T={res['ood_winter_travel_acc']:.3f} "
            f"| Buf5={res['buffer_composition_after_cycle'][-1]} ({res['wall_time_sec']}s)"
        )

    return {
        "seed": seed,
        "wall_time_sec": round(time.perf_counter() - t_seed, 2),
        "n_train_examples": len(train_all),
        "n_eval_examples_total": sum(d["ids"].shape[0] for d in eval_suites.values()),
        "part_a_training": part_a_training,
        "part_a_eval": part_a_eval,
        "part_b_sleep": {
            "cycles": [
                {"cycle_id": c["cycle_id"], "name": c["name"], "short": c["short"], "city": c["city"]}
                for c in cycles
            ],
            "sleep_gate_audit": gate_audit,
            "arms": part_b_arms,
        },
    }


def aggregate_multi_seed(seed_runs: List[Dict]) -> Tuple[Dict, Dict, Dict]:
    """Aggregate Part A training, Part A eval, and Part B sleep metrics (mean +/- sample std ddof=1)."""
    # Part A training aggregation
    agg_part_a_training: Dict[str, Dict] = {}
    for enc in ENCODER_NAMES:
        init_m, init_s = mean_std([r["part_a_training"][enc]["initial_train_loss"] for r in seed_runs])
        fin_m, fin_s = mean_std([r["part_a_training"][enc]["final_train_loss"] for r in seed_runs])
        wt_m, wt_s = mean_std([r["part_a_training"][enc]["wall_time_sec"] for r in seed_runs])
        r0 = seed_runs[0]["part_a_training"][enc]
        agg_part_a_training[enc] = {
            "encoder": enc,
            "param_count": r0["param_count"],
            "epochs": r0["epochs"],
            "batch_size": r0["batch_size"],
            "optimizer_steps": r0["optimizer_steps"],
            "wall_time_sec_mean": wt_m,
            "wall_time_sec_std": wt_s,
            "initial_train_loss": init_m,
            "initial_train_loss_std": init_s,
            "final_train_loss": fin_m,
            "final_train_loss_std": fin_s,
            "per_seed_final_train_loss": {str(r["seed"]): r["part_a_training"][enc]["final_train_loss"] for r in seed_runs},
            "loss_curve": r0["loss_curve"],
            "val_curve": r0["val_curve"],
        }

    # Part A eval aggregation
    slice_names = [k for k in seed_runs[0]["part_a_eval"][ENCODER_NAMES[0]].keys() if k != "summary"]
    summary_keys = list(seed_runs[0]["part_a_eval"][ENCODER_NAMES[0]]["summary"].keys())
    agg_part_a_eval: Dict[str, Dict] = {}
    for enc in ENCODER_NAMES:
        agg_part_a_eval[enc] = {}
        for s_name in slice_names:
            tok_m, tok_s = mean_std([r["part_a_eval"][enc][s_name]["token_acc"] for r in seed_runs])
            seq_m, seq_s = mean_std([r["part_a_eval"][enc][s_name]["seq_exact_acc"] for r in seed_runs])
            loss_m, loss_s = mean_std([r["part_a_eval"][enc][s_name]["loss"] for r in seed_runs])
            marg_m, marg_s = mean_std([r["part_a_eval"][enc][s_name]["mean_logit_margin"] for r in seed_runs])
            agg_part_a_eval[enc][s_name] = {
                "token_acc": tok_m,
                "token_acc_std": tok_s,
                "seq_exact_acc": seq_m,
                "seq_exact_acc_std": seq_s,
                "loss": loss_m,
                "loss_std": loss_s,
                "mean_logit_margin": marg_m,
                "mean_logit_margin_std": marg_s,
                "n_examples": seed_runs[0]["part_a_eval"][enc][s_name]["n_examples"],
            }
        summ_mean = {}
        summ_std = {}
        for sk in summary_keys:
            m, s = mean_std([r["part_a_eval"][enc]["summary"][sk] for r in seed_runs])
            summ_mean[sk] = m
            summ_std[sk] = s
        agg_part_a_eval[enc]["summary"] = summ_mean
        agg_part_a_eval[enc]["summary_std"] = summ_std
        agg_part_a_eval[enc]["per_seed_summary"] = {
            str(r["seed"]): r["part_a_eval"][enc]["summary"] for r in seed_runs
        }

    # Part B aggregation
    agg_part_b_arms: Dict[str, Dict] = {}
    for arm_name in PART_B_ARM_NAMES:
        a0 = seed_runs[0]["part_b_sleep"]["arms"][arm_name]
        ret_m, ret_s = mean_std([r["part_b_sleep"]["arms"][arm_name]["final_mean_retention_c1_c5"] for r in seed_runs])
        fgt_m, fgt_s = mean_std([r["part_b_sleep"]["arms"][arm_name]["catastrophic_forgetting_delta_c1_c4"] for r in seed_runs])
        wt_m, wt_s = mean_std([r["part_b_sleep"]["arms"][arm_name]["ood_winter_travel_acc"] for r in seed_runs])
        wall_m, wall_s = mean_std([r["part_b_sleep"]["arms"][arm_name]["wall_time_sec"] for r in seed_runs])

        final_cycle_accs = {}
        final_cycle_accs_std = {}
        for k in range(1, 6):
            ck = f"C{k}"
            cm, cs = mean_std([r["part_b_sleep"]["arms"][arm_name]["final_cycle_accs"][ck] for r in seed_runs])
            final_cycle_accs[ck] = cm
            final_cycle_accs_std[ck] = cs

        acc_matrix = []
        for c_idx in range(5):
            row: Dict[str, float] = {"after_cycle": c_idx + 1}
            for k in range(1, c_idx + 2):
                ck = f"C{k}"
                cm, cs = mean_std([r["part_b_sleep"]["arms"][arm_name]["acc_matrix"][c_idx][ck] for r in seed_runs])
                row[ck] = cm
                row[f"{ck}_std"] = cs
            mm, ms = mean_std([r["part_b_sleep"]["arms"][arm_name]["acc_matrix"][c_idx]["mean_seen_acc"] for r in seed_runs])
            row["mean_seen_acc"] = mm
            row["mean_seen_acc_std"] = ms
            acc_matrix.append(row)

        buf_comp = []
        for c_idx in range(5):
            comp_row = {}
            for k in range(1, 6):
                ck = f"C{k}"
                comp_row[ck] = round(float(np.mean([
                    r["part_b_sleep"]["arms"][arm_name]["buffer_composition_after_cycle"][c_idx][ck]
                    for r in seed_runs
                ])), 1)
            buf_comp.append(comp_row)

        base_skill = {}
        for bk in ("pre_task1_acc", "post_task1_acc", "pre_task2_acc", "post_task2_acc"):
            bm, bs = mean_std([r["part_b_sleep"]["arms"][arm_name]["base_skill_retention"][bk] for r in seed_runs])
            base_skill[bk] = bm
            base_skill[f"{bk}_std"] = bs

        agg_part_b_arms[arm_name] = {
            "arm": arm_name,
            "backbone_encoder": a0["backbone_encoder"],
            "use_sleep_lora": a0["use_sleep_lora"],
            "buffer_mode": a0["buffer_mode"],
            "buffer_capacity": a0["buffer_capacity"],
            "frozen_core_params": a0["frozen_core_params"],
            "trainable_params": a0["trainable_params"],
            "wall_time_sec_mean": wall_m,
            "wall_time_sec_std": wall_s,
            "acc_matrix": acc_matrix,
            "cycle_losses": a0["cycle_losses"],
            "buffer_composition_after_cycle": buf_comp,
            "final_cycle_accs": final_cycle_accs,
            "final_cycle_accs_std": final_cycle_accs_std,
            "final_mean_retention_c1_c5": ret_m,
            "final_mean_retention_c1_c5_std": ret_s,
            "catastrophic_forgetting_delta_c1_c4": fgt_m,
            "catastrophic_forgetting_delta_c1_c4_std": fgt_s,
            "ood_winter_travel_acc": wt_m,
            "ood_winter_travel_acc_std": wt_s,
            "base_skill_retention": base_skill,
            "per_seed": {
                str(r["seed"]): {
                    "final_mean_retention_c1_c5": r["part_b_sleep"]["arms"][arm_name]["final_mean_retention_c1_c5"],
                    "catastrophic_forgetting_delta_c1_c4": r["part_b_sleep"]["arms"][arm_name]["catastrophic_forgetting_delta_c1_c4"],
                    "ood_winter_travel_acc": r["part_b_sleep"]["arms"][arm_name]["ood_winter_travel_acc"],
                    "final_cycle_accs": r["part_b_sleep"]["arms"][arm_name]["final_cycle_accs"],
                    "final_buffer_composition": r["part_b_sleep"]["arms"][arm_name]["buffer_composition_after_cycle"][-1],
                }
                for r in seed_runs
            },
        }

    return agg_part_a_training, agg_part_a_eval, agg_part_b_arms


# ----------------------------------------- Main Orchestration

def main() -> None:
    t_total = time.perf_counter()
    set_all_seeds(PRIMARY_SEED)

    print("EXP-007 (Steelman 3-Seed): Benchmarking Apple M5 Pro CPU vs MPS on TinyCausalTransformer...")
    device, dev_timings = select_best_device()
    print(f"  Device benchmark (ms/step, bs=192, SDPA): {dev_timings} -> selected: {device}")

    print("EXP-007: Building shared ephemeris pools directly from python/astroengine/...")
    t_eph = time.perf_counter()
    eng = Engine()
    extractor = CaelusPhaseExtractor(eng)

    oslo_spr_tr, oslo_spr_all = build_regime_pools(extractor, "Oslo", (2026, 3, 10), 45, step_minutes=20)
    oslo_aut_tr, oslo_aut_all = build_regime_pools(extractor, "Oslo", (2026, 9, 10), 45, step_minutes=20)
    nyc_spr_tr, nyc_spr_all = build_regime_pools(extractor, "NYC", (2026, 3, 10), 45, step_minutes=20)
    nyc_aut_tr, nyc_aut_all = build_regime_pools(extractor, "NYC", (2026, 9, 10), 45, step_minutes=20)

    oslo_id_1, oslo_id_1_all = build_regime_pools(extractor, "Oslo", (2026, 4, 26), 10, step_minutes=20)
    oslo_id_2, oslo_id_2_all = build_regime_pools(extractor, "Oslo", (2026, 10, 26), 10, step_minutes=20)
    nyc_id_1, nyc_id_1_all = build_regime_pools(extractor, "NYC", (2026, 4, 26), 10, step_minutes=20)
    nyc_id_2, nyc_id_2_all = build_regime_pools(extractor, "NYC", (2026, 10, 26), 10, step_minutes=20)

    oslo_win_ood, oslo_win_all = build_regime_pools(extractor, "Oslo", (2026, 12, 10), 22, step_minutes=15)
    oslo_sum_ood, oslo_sum_all = build_regime_pools(extractor, "Oslo", (2026, 6, 10), 21, step_minutes=15)
    tokyo_ood, tokyo_all = build_regime_pools(extractor, "Tokyo", (2026, 9, 15), 30, step_minutes=15)

    def merge_pools(*ps: Dict[int, List]) -> Dict[int, List]:
        out = {r: [] for r in REGIME_TOKENS}
        for p in ps:
            for r in REGIME_TOKENS:
                out[r].extend(p[r])
        return out

    oslo_tr_pool = merge_pools(oslo_spr_tr, oslo_aut_tr)
    nyc_tr_pool = merge_pools(nyc_spr_tr, nyc_aut_tr)
    oslo_id_pool = merge_pools(oslo_id_1, oslo_id_2)
    nyc_id_pool = merge_pools(nyc_id_1, nyc_id_2)

    train_base_pts = (
        [("Oslo", j, p) for j, p in oslo_spr_all + oslo_aut_all]
        + [("NYC", j, p) for j, p in nyc_spr_all + nyc_aut_all]
    )
    id_base_pts = (
        [("Oslo", j, p) for j, p in oslo_id_1_all + oslo_id_2_all]
        + [("NYC", j, p) for j, p in nyc_id_1_all + nyc_id_2_all]
    )
    ood_base_pts = (
        [("Oslo", j, p) for j, p in oslo_win_all + oslo_sum_all]
        + [("Tokyo", j, p) for j, p in tokyo_all]
    )

    train_days_set = set((c, int(math.floor(j + 0.5))) for c, j, _ in train_base_pts)
    id_days_set = set((c, int(math.floor(j + 0.5))) for c, j, _ in id_base_pts)
    ood_days_set = set((c, int(math.floor(j + 0.5))) for c, j, _ in ood_base_pts)
    assert len(train_days_set & id_days_set) == 0, "Leakage between train and ID!"
    assert len(train_days_set & ood_days_set) == 0, "Leakage between train and OOD!"

    pools = {
        "oslo_spr_tr": oslo_spr_tr, "oslo_aut_tr": oslo_aut_tr,
        "nyc_spr_tr": nyc_spr_tr, "nyc_aut_tr": nyc_aut_tr,
        "oslo_tr_pool": oslo_tr_pool, "nyc_tr_pool": nyc_tr_pool,
        "oslo_id_pool": oslo_id_pool, "nyc_id_pool": nyc_id_pool,
        "oslo_win_ood": oslo_win_ood, "oslo_sum_ood": oslo_sum_ood, "tokyo_ood": tokyo_ood,
        "train_base_pts": train_base_pts, "id_base_pts": id_base_pts, "ood_base_pts": ood_base_pts,
        "train_eve_pts": [("Oslo", j, p) for j, p in oslo_tr_pool[TOK_REG_DUSK]] + [("NYC", j, p) for j, p in nyc_tr_pool[TOK_REG_DUSK]],
        "id_eve_pts": [("Oslo", j, p) for j, p in oslo_id_pool[TOK_REG_DUSK]] + [("NYC", j, p) for j, p in nyc_id_pool[TOK_REG_DUSK]],
        "ood_eve_pts": [("Oslo", j, p) for j, p in oslo_win_ood[TOK_REG_DUSK] + oslo_sum_ood[TOK_REG_DUSK]] + [("Tokyo", j, p) for j, p in tokyo_ood[TOK_REG_DUSK]],
        "t4_train_jds": [julian_day(2026, 3, 1, 0, 0, 0) + d for d in range(30)] + [julian_day(2026, 9, 1, 0, 0, 0) + d for d in range(30)],
        "t4_id_jds": [julian_day(2026, 4, 10, 0, 0, 0) + d for d in range(15)] + [julian_day(2026, 10, 10, 0, 0, 0) + d for d in range(15)],
        "t4_ood_jds": [julian_day(2026, 6, 1, 0, 0, 0) + d for d in range(20)] + [julian_day(2026, 12, 1, 0, 0, 0) + d for d in range(20)],
    }
    print(f"  Ephemeris pools built in {time.perf_counter() - t_eph:.2f}s (0 train/ID/OOD date overlap verified).")

    seed_runs = [run_single_seed(s, device, extractor, pools) for s in SEEDS]
    agg_part_a_training, agg_part_a_eval, agg_part_b_arms = aggregate_multi_seed(seed_runs)

    split_hashes = {
        "train_day_set_sha256_16": hash_jds([(c, float(d)) for c, d in train_days_set]),
        "id_day_set_sha256_16": hash_jds([(c, float(d)) for c, d in id_days_set]),
        "ood_day_set_sha256_16": hash_jds([(c, float(d)) for c, d in ood_days_set]),
        "train_id_day_overlap": len(train_days_set & id_days_set),
        "train_ood_day_overlap": len(train_days_set & ood_days_set),
        "n_train_examples_per_seed": seed_runs[0]["n_train_examples"],
        "n_eval_examples_per_seed": seed_runs[0]["n_eval_examples_total"],
        "n_seeds": len(SEEDS),
    }

    param_counts = {enc: agg_part_a_training[enc]["param_count"] for enc in ENCODER_NAMES}
    lora_arms = [a for a in PART_B_ARM_NAMES if a != "Naive-Online-FT"]
    lora_trainable_set = {agg_part_b_arms[a]["trainable_params"] for a in lora_arms}

    receipt = {
        "schema_version": "exp007-training-receipt-v2",
        "id": "EXP-007",
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "git_sha": get_git_sha(),
        "seed": PRIMARY_SEED,
        "seeds": SEEDS,
        "std_convention": "sample_std_ddof1_across_3_seeds",
        "hardware": {
            "platform": platform.platform(),
            "machine": platform.machine(),
            "python_version": platform.python_version(),
            "torch_version": torch.__version__,
            "selected_device": str(device),
            "device_benchmark_ms_per_step": dev_timings,
            "total_wall_time_sec": round(time.perf_counter() - t_total, 2),
        },
        "model_config": MODEL_CFG,
        "parameter_parity": {
            **param_counts,
            "exact_parity": len(set(param_counts.values())) == 1,
            "sleep_lora_frozen_core_params": agg_part_b_arms["SLEEP-Caelus-Circadian-Stratified"]["frozen_core_params"],
            "sleep_lora_trainable_params": agg_part_b_arms["SLEEP-Caelus-Circadian-Stratified"]["trainable_params"],
            "sleep_lora_parity": len(lora_trainable_set) == 1,
        },
        "dataset_splits": split_hashes,
        "part_a_training": agg_part_a_training,
        "part_a_eval": agg_part_a_eval,
        "part_b_sleep": {
            "forgetting_delta_definition": "mean over cycles c in {1, 2, 3, 4} of max(0, max_{t >= c} acc(t, c) - acc(5, c))",
            "cycles": seed_runs[0]["part_b_sleep"]["cycles"],
            "sleep_gate_audit": seed_runs[0]["part_b_sleep"]["sleep_gate_audit"],
            "arms": agg_part_b_arms,
        },
    }

    receipt_path = HERE / "training_receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved {receipt_path} ({receipt_path.stat().st_size / 1024:.1f} KB) in {receipt['hardware']['total_wall_time_sec']}s.")


if __name__ == "__main__":
    main()
