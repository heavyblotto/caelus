#!/usr/bin/env python3
"""EXP-012: Stdlib-only Verifier, Ephemeris Cross-Checker, and Tufte Chart Renderer.

Default execution (zero external pip deps, < 0.3s, safe for `node lab/scripts/lab.mjs run all`):
  python3 lab/experiments/EXP-012-pretrained-georope-adapter/experiment.py

Optional re-training trigger via uv (requires PyTorch + Transformers + NumPy in ephemeral uv env):
  python3 lab/experiments/EXP-012-pretrained-georope-adapter/experiment.py --train
"""

from __future__ import annotations

import datetime
import hashlib
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(ROOT / "python"))

from astroengine.chart import Engine
from astroengine.core import DEG, julian_day
from astroengine.events import rise_set
from astroengine.houses import angles as house_angles
from astroengine.houses import gast
from astroengine.pheno import az_alt, refract_true_to_apparent

TWO_PI = 2.0 * math.pi
SEC_PER_DAY = 86400.0
JD_EPOCH = julian_day(2026, 9, 22, 0, 0, 0)

CITIES = {
    "Oslo": {"lat": 59.9139, "lon": 10.7522},
    "NYC": {"lat": 40.7128, "lon": -74.0060},
    "Tokyo": {"lat": 35.6762, "lon": 139.6503},
}

ALL_ARMS = [
    "Arm0-Frozen-ISO-Prompt",
    "Arm1-Frozen-Caelus-TextPrompt",
    "Arm1b-LoRA-TextPrompt",
    "Arm2-LoRA-UnixFourier-Adapter",
    "Arm2b-LoRA-UnixFourier+LatLon-Adapter",
    "Arm3-LoRA-Caelus-GeoAdapter",
]


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


def hash_day_set(items: Sequence[Tuple[str, float]]) -> str:
    h = hashlib.sha256()
    for city, jd in sorted(set((c, round(j, 4)) for c, j in items)):
        h.update(f"{city}:{jd:.4f}\n".encode("utf-8"))
    return h.hexdigest()[:16]


def wilson_ci(k: int, n: int, z: float = 1.959963984540054) -> List[float]:
    if n <= 0:
        return [0.0, 0.0]
    p = k / n
    z2 = z * z
    denom = 1.0 + z2 / n
    center = (p + z2 / (2.0 * n)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + z2 / (4.0 * n)) / n)) / denom
    return [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]


def verify_ephemeris_invariants() -> Dict:
    """Live cross-check of python/astroengine/ physics invariants, 32-D norm parity, and split hashes."""
    eng = Engine()

    def daylight_hours(city: str, y: int, m: int, d: int) -> float:
        lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]
        day_start = julian_day(y, m, d, 0, 0, 0) - lon / 360.0
        noon = rise_set(eng, "sun", day_start, lat, lon, kind="mtransit", search_days=1.05)
        sr = rise_set(eng, "sun", noon - 0.55, lat, lon, kind="rise", search_days=0.6)
        ss = rise_set(eng, "sun", noon - 0.02, lat, lon, kind="set", search_days=0.6)
        return round((ss - sr) * 24.0, 2)

    oslo_spr_h = daylight_hours("Oslo", 2026, 3, 21)
    oslo_aut_h = daylight_hours("Oslo", 2026, 9, 22)
    oslo_win_h = daylight_hours("Oslo", 2026, 12, 21)
    oslo_sum_h = daylight_hours("Oslo", 2026, 6, 21)

    # Verify NYC -> Tokyo horizon inversion at 2026-11-23 01:30 UTC
    jd_trv = julian_day(2026, 11, 23, 1, 30, 0)
    sp = eng.position("sun", jd_trv)
    _, nyc_alt_t = az_alt(sp["lon"] % 360.0, sp["lat"], jd_trv, CITIES["NYC"]["lat"], CITIES["NYC"]["lon"])
    _, tok_alt_t = az_alt(sp["lon"] % 360.0, sp["lat"], jd_trv, CITIES["Tokyo"]["lat"], CITIES["Tokyo"]["lon"])
    nyc_alt = round(refract_true_to_apparent(nyc_alt_t), 2)
    tok_alt = round(refract_true_to_apparent(tok_alt_t), 2)
    assert nyc_alt < -30.0 and tok_alt > 20.0, f"Unexpected NYC/Tokyo inversion: {nyc_alt}, {tok_alt}"

    # Verify exact L2 = 4.0000 norm parity across all three 32-D [cos, sin] periodic feature maps
    t_sec = (jd_trv - JD_EPOCH) * SEC_PER_DAY
    p24 = TWO_PI * t_sec / SEC_PER_DAY
    p7d = TWO_PI * t_sec / (7.0 * SEC_PER_DAY)
    p365 = TWO_PI * t_sec / (365.25 * SEC_PER_DAY)
    lat, lon = CITIES["Tokyo"]["lat"], CITIES["Tokyo"]["lon"]
    p_lmt = TWO_PI * ((jd_trv - JD_EPOCH + lon / 360.0) % 1.0)
    g_rad = gast(jd_trv)
    asc_rad, _, _, _ = house_angles(jd_trv, lat, lon)
    mp = eng.position("moon", jd_trv)
    sl = (sp["lon"] % 360.0) * DEG
    ml = (mp["lon"] % 360.0) * DEG
    el = ((mp["lon"] - sp["lon"]) % 360.0) * DEG
    sa = 2.0 * tok_alt * DEG

    def vec_norm(angles: Sequence[float]) -> float:
        assert len(angles) == 16
        return math.sqrt(sum(math.cos(a) ** 2 + math.sin(a) ** 2 for a in angles))

    unix_ang = [p24, 2 * p24, 3 * p24, 4 * p24, 6 * p24, 8 * p24, p7d, 2 * p7d, 4 * p7d, 8 * p7d, 12 * p7d, 16 * p7d, p365, 2 * p365, 4 * p365, 8 * p365]
    unix_ll_ang = [p_lmt, 2 * p_lmt, 3 * p_lmt, 4 * p_lmt, p24, 2 * p24, p7d, 2 * p7d, 4 * p7d, p365, 2 * p365, 4 * p365, 8 * p365, lat * DEG, 2 * lat * DEG, lon * DEG]
    geo_ang = [g_rad, asc_rad, sa, 2 * sa, 0.3, 1.1, 2.2, 3.3, ml, 2 * ml, 4 * ml, 8 * ml, el, 4 * el, sl, 4 * sl]

    max_norm_err = max(abs(vec_norm(a) - 4.0) for a in (unix_ang, unix_ll_ang, geo_ang))
    assert max_norm_err < 1e-12, f"32-D periodic norm parity violated: {max_norm_err}"

    # Recompute train / ID / OOD day-set hashes independently
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

    return {
        "oslo_spring_daylight_h": oslo_spr_h,
        "oslo_autumn_daylight_h": oslo_aut_h,
        "oslo_winter_solstice_daylight_h": oslo_win_h,
        "oslo_summer_solstice_daylight_h": oslo_sum_h,
        "nyc_to_tokyo_20261123_0130z_sun_alt_deg": {"NYC": nyc_alt, "Tokyo": tok_alt},
        "feature_32d_l2_norm_error": max_norm_err,
        "recomputed_train_day_sha256_16": hash_day_set(list(train_days)),
        "recomputed_id_day_sha256_16": hash_day_set(list(id_days)),
        "recomputed_ood_day_sha256_16": hash_day_set(list(ood_days)),
    }


def verify_receipt(receipt: Dict, live_eph: Dict) -> Dict:
    """Validate training_receipt.json integrity, 3-way parameter parity, Wilson CIs, and zero leakage."""
    checks: Dict[str, bool] = {}
    assert receipt.get("schema_version") == "exp012-training-receipt-v1", "Unexpected receipt schema"
    assert receipt.get("id") == "EXP-012", "Receipt ID mismatch"

    bm = receipt["base_model"]
    checks["real_frozen_pretrained_lm"] = (
        bm["model_id"] == "Qwen/Qwen2.5-0.5B-Instruct" and bm["frozen_base_params"] >= 400_000_000
    )

    pp = receipt["parameter_parity"]
    checks["exact_adapter_3way_param_parity"] = (
        pp["Arm0-Frozen-ISO-Prompt"] == 0
        and pp["Arm1-Frozen-Caelus-TextPrompt"] == 0
        and pp["Arm2-LoRA-UnixFourier-Adapter"]
        == pp["Arm2b-LoRA-UnixFourier+LatLon-Adapter"]
        == pp["Arm3-LoRA-Caelus-GeoAdapter"]
        and pp["arm2_arm3_param_diff"] == 0
        and pp["arm2b_arm3_param_diff"] == 0
        and pp["Arm3-LoRA-Caelus-GeoAdapter"] > 1_000_000
    )

    # Verify gradient descent convergence across all 4 trained arms
    conv_ok = True
    for arm in (
        "Arm1b-LoRA-TextPrompt",
        "Arm2-LoRA-UnixFourier-Adapter",
        "Arm2b-LoRA-UnixFourier+LatLon-Adapter",
        "Arm3-LoRA-Caelus-GeoAdapter",
    ):
        tr = receipt["training"][arm]
        curve = tr["loss_curve"]
        if not (len(curve) >= 10 and tr["final_train_loss"] < tr["initial_train_loss"] * 0.25):
            conv_ok = False
        if not all(pt["mean_grad_norm"] > 0.0 for pt in curve):
            conv_ok = False
    checks["all_trained_arms_converged"] = conv_ok

    # Verify zero leakage and exact day-set SHA-256 parity with live astroengine recomputation
    ds = receipt["dataset_splits"]
    checks["zero_train_id_ood_leakage"] = (
        ds["train_id_day_overlap"] == 0
        and ds["train_ood_day_overlap"] == 0
        and ds["example_level_train_eval_day_overlap"] == 0
        and ds["train_day_set_sha256_16"] == live_eph["recomputed_train_day_sha256_16"]
        and ds["id_day_set_sha256_16"] == live_eph["recomputed_id_day_sha256_16"]
        and ds["ood_day_set_sha256_16"] == live_eph["recomputed_ood_day_sha256_16"]
    )

    # Recompute and cross-check every slice's 95% Wilson CI from raw counts
    ci_ok = True
    for arm in ALL_ARMS:
        slices = receipt["evaluation"][arm]["slices"]
        for sdata in slices.values():
            recomp = wilson_ci(sdata["choice_correct"], sdata["n"])
            if recomp != sdata["choice_ci95"]:
                ci_ok = False
                break
    checks["wilson_ci95_recomputed_exact"] = ci_ok

    for k, ok in checks.items():
        if not ok:
            raise AssertionError(f"EXP-012 receipt verification failed: {k}")
    return checks


def render_tufte_svg(receipt: Dict, out_path: Path) -> None:
    """Render an inert, zero-chartjunk two-panel Tufte SVG directly from training_receipt.json."""
    ev = receipt["evaluation"]
    tok_acc = receipt["token_accounting"]["per_event_clock_tokens"]

    W, H = 1080, 540
    # Colorblind-safe Tufte palette (no red-vs-green reliance)
    COL_TEXT_LORA = "#1a1a1a"   # Arm1b: Text+LoRA winner (near-black ink)
    COL_CAELUS_AD = "#164e7a"   # Arm3: Caelus GeoAdapter (deep ocean blue)
    COL_UNIX_LL = "#b86b14"     # Arm2b: Unix+LatLon control (ochre/amber)
    COL_UNIX = "#8d7b68"        # Arm2: Unix-UTC control (muted taupe)
    COL_TEXT_ZERO = "#3f6e86"   # Arm1: Frozen FACT-002 text (steel blue, AA contrast)
    COL_ISO_ZERO = "#737373"    # Arm0: Frozen ISO null (medium neutral gray, AA contrast)
    COL_AXIS = "#444444"
    COL_MUTE = "#595959"
    COL_FAINT = "#e8e8e8"

    arm_meta = [
        ("Arm1b-LoRA-TextPrompt", "Arm1b: Text+LoRA", COL_TEXT_LORA),
        ("Arm3-LoRA-Caelus-GeoAdapter", "Arm3: Caelus-Geo", COL_CAELUS_AD),
        ("Arm2b-LoRA-UnixFourier+LatLon-Adapter", "Arm2b: Unix+LatLon", COL_UNIX_LL),
        ("Arm1-Frozen-Caelus-TextPrompt", "Arm1: Frozen Text", COL_TEXT_ZERO),
        ("Arm2-LoRA-UnixFourier-Adapter", "Arm2: Unix-UTC", COL_UNIX),
        ("Arm0-Frozen-ISO-Prompt", "Arm0: Frozen ISO", COL_ISO_ZERO),
    ]

    lines: List[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="et-book, ET-Bembo, Palatino, Georgia, serif" font-size="12">',
        f'  <rect width="{W}" height="{H}" fill="white"/>',
        '  <text x="30" y="28" font-size="16" fill="#111">EXP-012: Frozen Qwen2.5-0.5B Transfer Test (Physical Slow-Clock Adapter vs. FACT-002 Text)</text>',
        f'  <text x="30" y="46" font-size="11.5" fill="{COL_MUTE}">494M frozen base on Apple MPS; exact 1.55M-param parity across Arm2/Arm2b/Arm3; 95% Wilson CIs; Verdict: KILLED (-6.8 pp Solstice+Travel, -8.5 pp OOD All vs Arm1b)</text>',
    ]

    # ------------------ PANEL A (Left): 4-Slice Accuracy with 95% Wilson CI Whiskers (Honest 0%..100%)
    ax0, ax1 = 170.0, 472.0
    ay0, ay1 = 92.0, 444.0
    lines.append('  <text x="30" y="74" font-size="13" fill="#111">Panel A: Held-Out Accuracy by Split (with 95% Wilson CIs)</text>')

    for frac, lbl in ((0.0, "0%"), (0.5, "50%"), (1.0, "100%")):
        xv = ax0 + frac * (ax1 - ax0)
        if frac > 0.0:
            lines.append(f'  <line x1="{xv:.1f}" y1="{ay0 - 4:.1f}" x2="{xv:.1f}" y2="{ay1 + 4:.1f}" stroke="{COL_FAINT}" stroke-width="0.8"/>')
        lines.append(f'  <text x="{xv:.1f}" y="{ay1 + 20:.1f}" text-anchor="middle" font-size="10.5" fill="{COL_MUTE}">{lbl}</text>')
    lines.append(f'  <line x1="{ax0:.1f}" y1="{ay1 + 4:.1f}" x2="{ax1:.1f}" y2="{ay1 + 4:.1f}" stroke="{COL_AXIS}" stroke-width="0.9"/>')
    lines.append(f'  <line x1="{ax0:.1f}" y1="{ay0 - 4:.1f}" x2="{ax0:.1f}" y2="{ay1 + 4:.1f}" stroke="{COL_AXIS}" stroke-width="0.9"/>')

    panel_a_rows = [
        ("ID Control", "Oslo+NYC Spr/Aut (n=580)", "id_composite_choice_acc", "id_composite_choice_ci95"),
        ("OOD Solstices", "Oslo 5.9h / 18.8h (n=640)", "ood_oslo_solstices_choice_acc", "ood_oslo_solstices_choice_ci95"),
        ("OOD Tokyo Travel", "Home NYC, +14h lon (n=320)", "ood_tokyo_travel_choice_acc", "ood_tokyo_travel_choice_ci95"),
        ("OOD Compaction", "Night-crossed/clock (n=180)", "ood_compaction_choice_acc", "ood_compaction_choice_ci95"),
    ]

    row_h = (ay1 - ay0) / len(panel_a_rows)
    bar_step = 11.2
    bar_h = 6.2

    for r_idx, (r_title, r_sub, acc_k, ci_k) in enumerate(panel_a_rows):
        yc = ay0 + (r_idx + 0.5) * row_h
        lines.append(f'  <text x="{ax0 - 10:.1f}" y="{yc - 3:.1f}" text-anchor="end" font-size="11.5" fill="#111">{r_title}</text>')
        lines.append(f'  <text x="{ax0 - 10:.1f}" y="{yc + 10:.1f}" text-anchor="end" font-size="9.5" fill="{COL_MUTE}">{r_sub}</text>')

        offsets = [(i - 2.5) * bar_step for i in range(6)]
        for (arm_key, _, col), dy in zip(arm_meta, offsets):
            val = float(ev[arm_key]["summary"][acc_k])
            ci_lo, ci_hi = ev[arm_key]["summary"][ci_k]
            xv = ax0 + val * (ax1 - ax0)
            xlo = ax0 + ci_lo * (ax1 - ax0)
            xhi = ax0 + ci_hi * (ax1 - ax0)
            yb = yc + dy
            lines.append(f'  <rect x="{ax0:.1f}" y="{yb - bar_h / 2:.1f}" width="{max(1.0, xv - ax0):.1f}" height="{bar_h:.1f}" fill="{col}"/>')
            # Thin crisp 95% Wilson CI whisker
            lines.append(f'  <line x1="{xlo:.1f}" y1="{yb:.1f}" x2="{xhi:.1f}" y2="{yb:.1f}" stroke="#222" stroke-width="0.9"/>')
            tx = max(xv, xhi) + 4.5
            lines.append(f'  <text x="{tx:.1f}" y="{yb + 3.0:.1f}" font-size="9.0" fill="{col}">{val * 100:.1f}%</text>')

    # Compact inline color key beneath Panel A (two clean rows, zero border box)
    key_items = [
        (30, 484, COL_TEXT_LORA, "■ Arm1b Text+LoRA"),
        (170, 484, COL_CAELUS_AD, "■ Arm3 Caelus-Geo"),
        (312, 484, COL_UNIX_LL, "■ Arm2b Unix+LatLon"),
        (30, 501, COL_TEXT_ZERO, "■ Arm1 Frozen Text"),
        (170, 501, COL_UNIX, "■ Arm2 Unix-UTC"),
        (312, 501, COL_ISO_ZERO, "■ Arm0 Frozen ISO"),
    ]
    for kx, ky, kcol, klbl in key_items:
        lines.append(f'  <text x="{kx}" y="{ky}" font-size="10.0" fill="{kcol}">{klbl}</text>')

    # ------------------ PANEL B (Right): Accuracy vs. Mean Prompt Tokens (Tufte C2 Range-Frame)
    bx0, bx1 = 620.0, 965.0
    by0, by1 = 104.0, 412.0
    lines.append('  <text x="556" y="74" font-size="13" fill="#111">Panel B: OOD Accuracy vs. Prompt Tokens (Pareto Frontier)</text>')

    pts = []
    for arm_key, short_lbl, col in arm_meta:
        s = ev[arm_key]["summary"]
        pts.append({
            "arm": arm_key,
            "lbl": short_lbl,
            "col": col,
            "tok": float(s["mean_prompt_tokens_all"]),
            "acc": float(s["ood_all_choice_acc"]),
            "ci": s["ood_all_choice_ci95"],
            "ms": float(s["inference_ms_per_example"]),
        })

    tok_min = min(p["tok"] for p in pts)
    tok_max = max(p["tok"] for p in pts)
    acc_min = min(p["acc"] for p in pts)
    acc_max = max(p["acc"] for p in pts)

    # Map strictly over exact data domain (Tufte B2 Range-Frame: axes span observed min..max only!)
    def mx(t: float) -> float:
        return bx0 + (t - tok_min) / max(1e-9, tok_max - tok_min) * (bx1 - bx0)

    def my(a: float) -> float:
        return by1 - (a - acc_min) / max(1e-9, acc_max - acc_min) * (by1 - by0)

    # Range-frame axes (offset slightly from data box so dots sit cleanly inside frame)
    ax_y_line = by1 + 16.0
    ax_x_line = bx0 - 16.0
    lines.append(f'  <line x1="{mx(tok_min):.1f}" y1="{ax_y_line:.1f}" x2="{mx(tok_max):.1f}" y2="{ax_y_line:.1f}" stroke="{COL_AXIS}" stroke-width="0.9"/>')
    lines.append(f'  <line x1="{ax_x_line:.1f}" y1="{my(acc_min):.1f}" x2="{ax_x_line:.1f}" y2="{my(acc_max):.1f}" stroke="{COL_AXIS}" stroke-width="0.9"/>')

    # Exact range-frame ticks on x (min=89.8, mid=134.8, max=247.7)
    for tv in (tok_min, 134.8, tok_max):
        xv = mx(tv)
        lines.append(f'  <line x1="{xv:.1f}" y1="{ax_y_line:.1f}" x2="{xv:.1f}" y2="{ax_y_line + 4:.1f}" stroke="{COL_AXIS}" stroke-width="0.8"/>')
        lines.append(f'  <text x="{xv:.1f}" y="{ax_y_line + 17:.1f}" text-anchor="middle" font-size="10.0" fill="{COL_MUTE}">{tv:.1f}</text>')
    lines.append(f'  <text x="{(bx0 + bx1) / 2:.1f}" y="{ax_y_line + 33:.1f}" text-anchor="middle" font-size="10.5" fill="{COL_AXIS}">Mean Prompt Tokens per Example (fewer is faster)</text>')

    # Exact range-frame ticks on y (min, 50%, max)
    for av in (acc_min, 0.50, acc_max):
        yv = my(av)
        lines.append(f'  <line x1="{ax_x_line - 4:.1f}" y1="{yv:.1f}" x2="{ax_x_line:.1f}" y2="{yv:.1f}" stroke="{COL_AXIS}" stroke-width="0.8"/>')
        lines.append(f'  <text x="{ax_x_line - 7:.1f}" y="{yv + 3.5:.1f}" text-anchor="end" font-size="10.0" fill="{COL_MUTE}">{av * 100:.1f}%</text>')

    # Pre-registered kill threshold line (Arm1b - 3.0 pp)
    bar_acc = ev["Arm1b-LoRA-TextPrompt"]["summary"]["ood_all_choice_acc"] - 0.03
    y_bar = my(bar_acc)
    lines.append(f'  <line x1="{bx0:.1f}" y1="{y_bar:.1f}" x2="{bx1:.1f}" y2="{y_bar:.1f}" stroke="#8a3b3b" stroke-width="0.9" stroke-dasharray="4,3"/>')
    lines.append(f'  <text x="{bx0 + 4:.1f}" y="{y_bar - 4:.1f}" font-size="9.5" fill="#8a3b3b">Pre-registered Razor bar (Arm1b - 3.0 pp = {bar_acc * 100:.1f}%)</text>')

    # Pareto connector between Arm3 (fast/compact) and Arm1b (most accurate)
    p_a3 = next(p for p in pts if p["arm"] == "Arm3-LoRA-Caelus-GeoAdapter")
    p_a1b = next(p for p in pts if p["arm"] == "Arm1b-LoRA-TextPrompt")
    lines.append(
        f'  <line x1="{mx(p_a3["tok"]):.1f}" y1="{my(p_a3["acc"]):.1f}" '
        f'x2="{mx(p_a1b["tok"]):.1f}" y2="{my(p_a1b["acc"]):.1f}" '
        f'stroke="{COL_CAELUS_AD}" stroke-width="1.1" stroke-dasharray="2,2" opacity="0.65"/>'
    )

    # Plot each arm dot + vertical 95% Wilson CI + collision-free direct label
    label_nudges = {
        "Arm1b-LoRA-TextPrompt": (-8.0, -9.0, "end"),
        "Arm3-LoRA-Caelus-GeoAdapter": (10.0, 4.0, "start"),
        "Arm2b-LoRA-UnixFourier+LatLon-Adapter": (10.0, 3.0, "start"),
        "Arm1-Frozen-Caelus-TextPrompt": (-8.0, 4.0, "end"),
        "Arm2-LoRA-UnixFourier-Adapter": (10.0, 3.0, "start"),
        "Arm0-Frozen-ISO-Prompt": (10.0, 3.0, "start"),
    }
    for p in pts:
        xp = mx(p["tok"])
        yp = my(p["acc"])
        ylo = my(max(acc_min, p["ci"][0]))
        yhi = my(min(acc_max, p["ci"][1]))
        lines.append(f'  <line x1="{xp:.1f}" y1="{ylo:.1f}" x2="{xp:.1f}" y2="{yhi:.1f}" stroke="{p["col"]}" stroke-width="1.2"/>')
        lines.append(f'  <circle cx="{xp:.1f}" cy="{yp:.1f}" r="4.0" fill="{p["col"]}"/>')
        dx, dy, anchor = label_nudges[p["arm"]]
        lbl_txt = f'{p["lbl"]} {p["acc"] * 100:.1f}% ({p["ms"]:.1f} ms)'
        lines.append(f'  <text x="{xp + dx:.1f}" y="{yp + dy:.1f}" text-anchor="{anchor}" font-size="10.0" fill="{p["col"]}">{lbl_txt}</text>')

    # Concise Panel B trade-off annotation below x-axis (comfortable right margin)
    speedup = p_a1b["ms"] / max(1e-6, p_a3["ms"])
    lines.append(
        f'  <text x="556" y="484" font-size="10.0" fill="{COL_AXIS}">'
        f'Trade-off: Arm3 cuts clock tokens by {tok_acc["adapter_vs_caelus_text_reduction_pct"]:.1f}% (2 vs 43/event) and runs {speedup:.2f}x faster,</text>'
    )
    lines.append(
        f'  <text x="556" y="500" font-size="10.0" fill="{COL_MUTE}">'
        f'but Arm1b Text+LoRA dominates accuracy (+{(p_a1b["acc"] - p_a3["acc"]) * 100:.1f} pp OOD All, +18.9 pp Compaction), -471K params.</text>'
    )

    lines.append(
        f'  <text x="30" y="528" font-size="9.5" fill="{COL_MUTE}">'
        f'Source: lab/experiments/EXP-012-pretrained-georope-adapter/training_receipt.json (seed={receipt["seed"]}, 1,720 held-out prompts, 0 train/eval date overlap)</text>'
    )
    lines.append("</svg>\n")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def build_results_json(receipt: Dict, live_eph: Dict, checks: Dict) -> Dict:
    ev = receipt["evaluation"]
    s0 = ev["Arm0-Frozen-ISO-Prompt"]["summary"]
    s1 = ev["Arm1-Frozen-Caelus-TextPrompt"]["summary"]
    s1b = ev["Arm1b-LoRA-TextPrompt"]["summary"]
    s2 = ev["Arm2-LoRA-UnixFourier-Adapter"]["summary"]
    s2b = ev["Arm2b-LoRA-UnixFourier+LatLon-Adapter"]["summary"]
    s3 = ev["Arm3-LoRA-Caelus-GeoAdapter"]["summary"]

    tok_red_pct = receipt["token_accounting"]["per_event_clock_tokens"]["adapter_vs_caelus_text_reduction_pct"]
    gain_st_vs_arm2 = round(s3["ood_solstice_travel_choice_acc"] - s2["ood_solstice_travel_choice_acc"], 4)
    gain_solstice_vs_arm2b = round(s3["ood_oslo_solstices_choice_acc"] - s2b["ood_oslo_solstices_choice_acc"], 4)
    gain_st_vs_arm1 = round(s3["ood_solstice_travel_choice_acc"] - s1["ood_solstice_travel_choice_acc"], 4)
    diff_st_vs_arm1b = round(s3["ood_solstice_travel_choice_acc"] - s1b["ood_solstice_travel_choice_acc"], 4)
    diff_all_vs_arm1b = round(s3["ood_all_choice_acc"] - s1b["ood_all_choice_acc"], 4)
    inference_speedup_vs_arm1b = round(s1b["inference_ms_per_example"] / s3["inference_ms_per_example"], 2)

    razor_checks = {
        "exact_3way_adapter_param_parity": checks["exact_adapter_3way_param_parity"],
        "zero_train_id_ood_leakage": checks["zero_train_id_ood_leakage"],
        "all_trained_arms_converged": checks["all_trained_arms_converged"],
        "bar_a1_arm3_beats_arm2_ood_st_ge_15pp": gain_st_vs_arm2 >= 0.15,
        "bar_a2_arm3_beats_location_aware_arm2b_oslo_solstices": gain_solstice_vs_arm2b > 0.0,
        "bar_b1_arm3_beats_frozen_arm1_ood_st": gain_st_vs_arm1 > 0.0,
        "bar_b2_arm3_cuts_clock_tokens_ge_50pct": tok_red_pct >= 50.0,
        "bar_b3_arm3_within_3pp_of_arm1b_ood_st": diff_st_vs_arm1b >= -0.03,
        "bar_b4_arm3_within_3pp_of_arm1b_ood_all": diff_all_vs_arm1b >= -0.03,
    }

    kill_triggered = (
        gain_st_vs_arm2 < 0.15
        or gain_solstice_vs_arm2b <= 0.0
        or gain_st_vs_arm1 < 0.0
        or diff_st_vs_arm1b < -0.03
        or diff_all_vs_arm1b < -0.03
    )
    all_passed = all(razor_checks.values()) and not kill_triggered
    status = "pass" if all_passed else ("fail" if kill_triggered else "inconclusive")
    verdict_tag = "PROVED" if all_passed else ("KILLED" if kill_triggered else "PARTIAL")

    summary = (
        f"6-arm transfer test on frozen {receipt['base_model']['model_id']} "
        f"({receipt['base_model']['frozen_base_params']:,} frozen params, Apple MPS, 0 train/eval overlap, 1,720 held-out prompts). "
        f"Continuous physical injection transfers strongly through frozen weights: Arm3-LoRA-Caelus-GeoAdapter reaches "
        f"{s3['ood_solstice_travel_choice_acc']*100:.1f}% OOD Solstice+Travel (95% CI {s3['ood_solstice_travel_choice_ci95'][0]*100:.1f}-{s3['ood_solstice_travel_choice_ci95'][1]*100:.1f}%), "
        f"beating parameter-matched Arm2-LoRA-UnixFourier by +{gain_st_vs_arm2*100:.1f} pp ({s2['ood_solstice_travel_choice_acc']*100:.1f}%), "
        f"beating location-aware Arm2b-LoRA-UnixFourier+LatLon by +{gain_solstice_vs_arm2b*100:.1f} pp on Oslo Solstices "
        f"({s3['ood_oslo_solstices_choice_acc']*100:.1f}% vs {s2b['ood_oslo_solstices_choice_acc']*100:.1f}%), "
        f"and beating zero-shot Arm1-Frozen-Caelus-TextPrompt by +{gain_st_vs_arm1*100:.1f} pp ({s1['ood_solstice_travel_choice_acc']*100:.1f}%) "
        f"while cutting clock tokens by {tok_red_pct:.1f}% and running {inference_speedup_vs_arm1b:.2f}x faster. "
        f"HOWEVER, plain-text Arm1b-LoRA-TextPrompt (471K fewer params) strictly dominates accuracy across every split: "
        f"{s1b['ood_solstice_travel_choice_acc']*100:.1f}% OOD Solstice+Travel (+{-diff_st_vs_arm1b*100:.1f} pp over Arm3), "
        f"{s1b['ood_compaction_choice_acc']*100:.1f}% OOD Compaction (+{(s1b['ood_compaction_choice_acc']-s3['ood_compaction_choice_acc'])*100:.1f} pp), "
        f"and {s1b['ood_all_choice_acc']*100:.1f}% OOD All (+{-diff_all_vs_arm1b*100:.1f} pp), triggering the pre-registered -3.0 pp kill bar."
    )

    verdict = (
        f"{verdict_tag}: Passed {sum(razor_checks.values())}/{len(razor_checks)} Razor checks; "
        f"failed pre-registered text-steelman accuracy parity bars (Arm3 trails Arm1b-LoRA-TextPrompt by "
        f"{diff_st_vs_arm1b*100:.1f} pp on OOD Solstice+Travel and {diff_all_vs_arm1b*100:.1f} pp on OOD All, exceeding the -3.0 pp kill threshold). "
        f"Although continuous physical slow-clock adapters clearly transfer through frozen 494M weights "
        f"(+{gain_st_vs_arm2*100:.1f} pp vs Arm2 UTC-Fourier; +{gain_solstice_vs_arm2b*100:.1f} pp vs location-aware Arm2b on Oslo Solstices; "
        f"{inference_speedup_vs_arm1b:.2f}x faster MPS inference with {tok_red_pct:.1f}% fewer clock tokens), "
        f"FACT-002 plain-text physical envelopes strictly win on accuracy and simplicity for frozen pretrained LLMs. "
        f"Ship FACT-002 text envelopes, not continuous weight adapters, for frozen LLMs."
    )

    return {
        "id": "EXP-012",
        "run_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "git_sha": get_git_sha(),
        "status": status,
        "summary": summary,
        "metrics": {
            "frozen_base_params": receipt["base_model"]["frozen_base_params"],
            "arm1b_trainable_params": receipt["parameter_parity"]["Arm1b-LoRA-TextPrompt"],
            "arm2_arm2b_arm3_trainable_params": receipt["parameter_parity"]["Arm3-LoRA-Caelus-GeoAdapter"],
            "arm0_ood_solstice_travel_acc": s0["ood_solstice_travel_choice_acc"],
            "arm1_ood_solstice_travel_acc": s1["ood_solstice_travel_choice_acc"],
            "arm1b_ood_solstice_travel_acc": s1b["ood_solstice_travel_choice_acc"],
            "arm2_ood_solstice_travel_acc": s2["ood_solstice_travel_choice_acc"],
            "arm2b_ood_solstice_travel_acc": s2b["ood_solstice_travel_choice_acc"],
            "arm3_ood_solstice_travel_acc": s3["ood_solstice_travel_choice_acc"],
            "arm3_minus_arm2_ood_solstice_travel": gain_st_vs_arm2,
            "arm3_minus_arm2b_ood_oslo_solstices": gain_solstice_vs_arm2b,
            "arm3_minus_arm1_ood_solstice_travel": gain_st_vs_arm1,
            "arm3_minus_arm1b_ood_solstice_travel": diff_st_vs_arm1b,
            "arm1b_ood_all_acc": s1b["ood_all_choice_acc"],
            "arm3_ood_all_acc": s3["ood_all_choice_acc"],
            "arm3_minus_arm1b_ood_all": diff_all_vs_arm1b,
            "arm1b_ood_compaction_acc": s1b["ood_compaction_choice_acc"],
            "arm3_ood_compaction_acc": s3["ood_compaction_choice_acc"],
            "arm1b_ood_all_ce": s1b["ood_all_choice_ce"],
            "arm3_ood_all_ce": s3["ood_all_choice_ce"],
            "arm2b_ood_all_ce": s2b["ood_all_choice_ce"],
            "arm2_ood_all_ce": s2["ood_all_choice_ce"],
            "per_event_clock_token_reduction_pct": tok_red_pct,
            "arm3_vs_arm1b_inference_speedup": inference_speedup_vs_arm1b,
            "summary_by_arm": {arm: ev[arm]["summary"] for arm in ALL_ARMS},
            "slices_by_arm": {
                arm: {
                    sk: {
                        "n": sv["n"],
                        "choice_acc": sv["choice_acc"],
                        "choice_ci95": sv["choice_ci95"],
                        "choice_ce": sv["choice_ce"],
                        "full_vocab_acc": sv["full_vocab_acc"],
                    }
                    for sk, sv in ev[arm]["slices"].items()
                }
                for arm in ALL_ARMS
            },
            "token_accounting": receipt["token_accounting"],
            "ephemeris_live_crosscheck": live_eph,
            "verification_checks": checks,
            "razor_checks": razor_checks,
        },
        "verdict": verdict,
    }


def main() -> None:
    t0 = time.perf_counter()
    if "--train" in sys.argv:
        uv_bin = shutil.which("uv") or "/Users/jeremykrane/.local/bin/uv"
        cmd = [
            uv_bin, "run", "--python", "3.12",
            "--with", "torch", "--with", "transformers", "--with", "numpy",
            "python", str(HERE / "train.py"),
        ]
        print(f"EXP-012: Invoking PyTorch/Transformers training via {' '.join(cmd)}")
        subprocess.run(cmd, check=True, cwd=str(ROOT))

    receipt_path = HERE / "training_receipt.json"
    if not receipt_path.exists():
        print(
            "ERROR: training_receipt.json not found. Run with --train or invoke train.py via uv first.",
            file=sys.stderr,
        )
        sys.exit(1)

    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    live_eph = verify_ephemeris_invariants()
    checks = verify_receipt(receipt, live_eph)
    results = build_results_json(receipt, live_eph, checks)

    results_path = HERE / "results.json"
    results_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    render_tufte_svg(receipt, HERE / "chart.svg")

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    print(f"EXP-012 verified cleanly in {elapsed_ms} ms | status={results['status']}")
    print(f"  {results['verdict']}")


if __name__ == "__main__":
    main()
