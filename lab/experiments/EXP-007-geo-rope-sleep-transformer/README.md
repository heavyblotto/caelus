# EXP-007: Trained Tiny-Transformer Hybrid Dual-Clock Geo-RoPE and Google SLEEP Continual Learning Study

Real PyTorch training study on Apple M5 Pro (`mps`, `26.3 ms/step` vs `97.7 ms/step` CPU, 3.71x speedup) extending `EXP-004`'s mathematical Geo-RoPE probes and `EXP-002`'s phase-stratified memory compaction into trained autoregressive transformer weights and low-rank LoRA continual consolidation.

All astronomical phases (`GAST`, `ASC`, refracted apparent solar altitude and trend, continuous unequal planetary-hour photoperiod arc, lunar sidereal longitude, Sun-Moon synodic elongation, and solar tropical longitude) are computed directly from Caelus's zero-dependency `python/astroengine/` reference engine.

![EXP-007 Results Chart](chart.svg)

## Architecture and Strict Parity Controls

- **Model (`TinyCausalTransformer`):** 4 pre-RMSNorm causal transformer layers, `d_model = 192`, `n_heads = 3`, `head_dim = 64` (exact 32 rotary 2D planes in `SO(2)^32`), `d_ff = 512`, `dropout = 0.05`, `vocab_size = 128`, `max_seq_len = 36`.
- **Exact Part A Parameter Parity:** All 3 models (`Standard-RoPE`, `Hybrid-Unix-Fourier-RoPE`, `Hybrid-Dual-Geo-RoPE`) initialize from the identical state dict (`seed = 20261122`), have **1,427,136** parameters each (0-parameter difference), receive identical discrete token sequences (`input_ids`), and train for 28 epochs (2,940 AdamW steps, `lr = 1.8e-3`, cosine decay, `weight_decay = 0.02`) on identical 13,400-sequence multi-day streams. Position `0` (`<BOS>`) uses `theta = 0` identically across all 3 models.
- **Exact Part B LoRA Parity:** Both SLEEP arms freeze all **1,427,136** pretrained core parameters and attach identical rank-16 (`alpha = 16`) LoRA adapters to all attention (`q/k/v/o`), MLP (`fc1/fc2`), and `lm_head` projections (**193,536** trainable LoRA parameters each, 0-parameter difference) with matched replay buffer capacity (`B = 250`, ingest `125` wake episodes/cycle) and identical Wake (`40` steps) + Sleep Dreaming (`300` cosine-annealed steps) compute budgets.
- **Zero Train/Test Leakage:** Verified live by SHA-256 day-set hashing in `experiment.py`:
  - Train split (`0bc7658da33bbce0`): Oslo & NYC Spring (`Mar 10 - Apr 24`) and Autumn (`Sep 10 - Oct 24`).
  - Held-out ID control (`8f197d8a09efeb55`, 0 overlap with train): Oslo & NYC `Apr 26 - May 5` and `Oct 26 - Nov 4`.
  - Held-out OOD split (`b24c4bc69a04c452`, 0 overlap with train): Oslo Winter Solstice (`Dec 10 - Dec 31`, `5.90h` daylight), Oslo Summer Solstice (`Jun 10 - Jun 30`, `18.83h` daylight), and unseen relocation to Tokyo (`35.68N, 139.65E`, `Sep 15 - Oct 15`, 14h shift from NYC while carrying home NYC profile token).

## Part A: Hybrid Dual-Clock Geo-RoPE on Trained Autoregressive Weights

Real gradient descent convergence (train cross-entropy loss across 2,940 steps on Apple M5 Pro `mps`):
- `Standard-RoPE`: `1.8646 -> 0.7705` (`88.9 s`)
- `Hybrid-Unix-Fourier-RoPE`: `1.7897 -> 0.3476` (`100.1 s`)
- `Hybrid-Dual-Geo-RoPE`: `1.7252 -> 0.3910` (`99.8 s`)

### Held-Out Accuracy Across All 4 Tasks (4,840 Evaluation Sequences)

| Task / Slice | Standard-RoPE | Hybrid-Unix-Fourier (Steelman) | Hybrid-Dual-Geo-RoPE (Caelus) | Outcome |
| --- | ---: | ---: | ---: | --- |
| **T1: Intra-Turn 2s Turney Register Tracking** | 76.6% | **81.9%** | 76.3% | Geo matches Std (-0.3 pp); Unix leads +5.6 pp |
| **T2: Post-Sleep / Context-Reset (`m = 0`)** | 33.8% | **100.0%** | **100.0%** | **Tie** (+66.2 pp over Standard-RoPE collapse) |
| **T3-ID: Spring/Autumn Control (Oslo + NYC)** | 26.0% | 73.8% | **88.2%** | Both hybrid clocks learn in-distribution |
| **T3-OOD Composite (Solstices + Tokyo Travel)** | 24.1% | 36.7% | **86.6%** | **Caelus +49.9 pp** over Unix-Fourier |
| T3a-OOD: Oslo Winter Solstice Regime (5.90h) | 25.0% | 52.5% | **97.9%** | **+45.4 pp** |
| T3a-OOD: Oslo Summer Solstice Regime (18.83h) | 25.0% | 50.0% | **90.4%** | **+40.4 pp** |
| T3a-OOD: NYC -> Tokyo Travel Regime (+14h lon) | 25.0% | 2.1% | **98.8%** | **+96.7 pp** (UTC completely inverted) |
| T3b-OOD: Oslo Winter Photoperiod Retrieval | 27.1% | 41.7% | **72.1%** | **+30.4 pp** |
| T3b-OOD: Oslo Summer Photoperiod Retrieval | 23.8% | 40.8% | **75.0%** | **+34.2 pp** |
| T3b-OOD: NYC -> Tokyo Photoperiod Retrieval | 18.8% | 32.9% | **85.4%** | **+52.5 pp** |
| **T4a-OOD: 30-Day Same-UTC (`0/7/14/21/28d`)** | 20.2% | **100.0%** | **100.0%** | **Honest Tie** (trained Q/K isolates `365.25d`) |
| **T4b-OOD: 52-Week Annual Wrap (`0/7/14/21/364d`)** | 29.0% | 84.0% | **99.7%** | **Caelus +15.7 pp** (lunar torus avoids triple alias) |
| **T4-OOD Composite** | 23.1% | 94.7% | **99.9%** | **Caelus +5.2 pp** |

### Key Part A Scientific Discovery (Trained Weights vs. Untrained `EXP-004`)

In untrained isotropic `EXP-004`, `Hybrid-Unix-Fourier` dropped to `64.7%` on 30-day same-UTC retrieval because its 12 aliased `24h + 7d` planes drowned out its 4 `365.25d` planes. When trained via gradient descent (`EXP-007`), `Hybrid-Unix-Fourier-RoPE` learns to project away the aliased `7d` planes and isolate its `8x` annual harmonic (`55 deg/week`), reaching `100.0%` on 30-day (`0/7/14/21/28d`) retrieval and tying `Hybrid-Dual-Geo-RoPE`. Its rational-period weakness re-emerges at 52-week annual wrap (`364d`), where `24h`, `7d`, and `365.25d` triple-alias simultaneously (`84.0%` vs `99.7%` for Caelus's incommensurate `27.32d` / `29.53d` lunar torus). On OOD physical photoperiod and geographic relocation (Task 3), gradient descent cannot rescue UTC Fourier clocks because observer latitude and longitude are absent from UTC: `Hybrid-Dual-Geo-RoPE` transfers zero-shot (`86.6%` vs `36.7%`, `+49.9 pp`).

## Part B: Google Research SLEEP 5-Cycle Continual Consolidation

Five sequential Wake -> Sleep operating regimes over shared work-event tokens (`EVT_0..3`) and register states (`R0..3`, `V0..7`), with disjoint wake/eval dates:
1. **C1 (`Daytime Coding`)**: Oslo Autumn daylight (`sun_alt >= +8 deg`)
2. **C2 (`Dusk Handoff`)**: Oslo Autumn civil twilight/sunset (`-6 <= sun_alt <= +6 deg`, setting)
3. **C3 (`Nocturnal Maintenance`)**: Oslo Autumn night (`sun_alt <= -8 deg`)
4. **C4 (`Oslo Winter Shift`)**: Oslo Winter Solstice (`5.90h` daylight, `12:30-15:30 UTC` overlaps C1's UTC afternoon)
5. **C5 (`Tokyo Travel`)**: Tokyo local daytime (`00:00-06:30 UTC` overlaps C3's Oslo UTC night)

### Continual Retention, Forgetting Delta, and Sleep-Gate Safety

| Consolidation Arm | Backbone / Buffer (`B=250`) | C1 | C2 | C3 | C4 (Wint) | C5 (Tok) | Final Mean (C1..C5) | Forgetting Delta (C1..C4) | Nocturnal Gate Safety |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Naive-Online-FT` | Geo-RoPE / Full FT (no replay) | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | **20.0%** | **99.2 pp** | N/A |
| `SLEEP-Fixed24h-LRU` | Unix-Fourier + LoRA / LRU | 0.0% | 0.0% | 0.0% | 100.0% | 100.0% | **40.0%** | **74.0 pp** | **70.5%** (0.0% Tokyo) |
| `Diag-SLEEP-GeoRoPE-LRU` | Geo-RoPE + LoRA / LRU (diag) | 0.0% | 0.0% | 0.0% | 100.0% | 100.0% | **40.0%** | **69.2 pp** | 100.0% |
| **`SLEEP-Caelus-Circadian-Stratified`** | **Geo-RoPE + LoRA / Phase-Stratified** | **86.7%** | **99.2%** | **88.3%** | **48.3%** | **85.0%** | **81.5%** | **5.4 pp** | **100.0%** |

### Unsupervised Buffer Survival and Honest Trade-Offs

- **Zero-label physical stratification:** Using only `(horizon_state, astronomical_season_quadrant, observer_lon_bin)` from `python/astroengine/` with zero cycle or task labels, the `B = 250` Caelus dreaming buffer naturally retains `[C1: 48, C2: 48, C3: 48, C4: 59, C5: 47]` after Cycle 5, compared to LRU's `[C1: 0, C2: 0, C3: 0, C4: 125, C5: 125]`.
- **Causal attribution (`Diag-SLEEP-GeoRoPE-LRU`):** Pairing `Hybrid-Dual-Geo-RoPE` with plain LRU lands at `40.0%` (`69.2 pp` forgetting), proving that unsupervised phase-stratified dreaming replay accounts for the `+41.5 pp` retention gain and `-63.8 pp` forgetting drop.
- **Honest plasticity-stability trade-off:** Because LRU dedicates 100% of its 250 slots exclusively to the 2 most recent cycles (`C4+C5`, erasing `C1-C3` to `0.0%`), LRU reaches `100.0%` on `C4+C5` recency-only accuracy vs `66.7%` (`C4=48.3%, C5=85.0%`) for `SLEEP-Caelus-Circadian-Stratified`, which spreads the same 250-slot budget across all 5 regimes to keep `C1-C3` at `86.7%-99.2%`.
- **Frozen core reversibility:** While active specialist LoRA weights overwrite the shared `lm_head` output distribution toward `ACT_0..15` (`post_task1/2` with specialist active drops to ~0%), the frozen `1,427,136`-param pretrained core remains bit-identical and 100% restorable by detaching the LoRA adapter, whereas `Naive-Online-FT` permanently destroys the core weights.

## Reproducing

Fast zero-dependency verification (`< 0.3 s`, refreshes `results.json` and `chart.svg` from `training_receipt.json` and live-checks `python/astroengine/` invariants):

```bash
node lab/scripts/lab.mjs run EXP-007
```

Full PyTorch GPU/CPU re-training from scratch (ephemeral `uv` environment, zero global installs):

```bash
uv run --python 3.12 --with torch --with numpy python lab/experiments/EXP-007-geo-rope-sleep-transformer/train.py
python3 lab/experiments/EXP-007-geo-rope-sleep-transformer/experiment.py
```
