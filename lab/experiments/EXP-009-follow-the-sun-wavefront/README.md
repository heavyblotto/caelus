# EXP-009: Geocentric Follow-the-Sun Wavefront Orchestration

Tests Vector #6 from `caelus_agent_chronosense.md`: whether globally distributed human-tethered agent nodes computing local solar-horizon quadrants offline via `sceneGeometry` (`packages/caelus/dist/src/observe.js`) outperform static UTC round-robin and zero-RPC longitude-derived fixed-24h solar clocks across all four seasons.

## Experimental Design

- **8 Global Cities**: `Tokyo` (35.7N), `Singapore` (1.4N, equatorial tie-control), `Oslo` (59.9N), `London` (51.5N), `New York` (40.7N), `San Francisco` (37.8N), `Sydney` (33.9S, Southern Hemisphere), `Tromso` (69.6N, polar stress test).
- **4 Seasonal 96-Hour Windows** (`2026` March equinox, June solstice, September equinox, December solstice) sampled every 30 minutes (`768` global UTC ticks x `8` cities = **`6,144` node evaluations**).
- **3 Zero-RPC Arms**:
  1. `Control-UTC-RoundRobin`: static 6-hour UTC phase rotation ignoring geography.
  2. `Control-Lon-Fixed24h`: zero-RPC local mean solar time (`LMT = UTC + lon/15`) assigning `06-10` initiate, `10-14` execute, `14-18` review/ship, `18-06` subterranean GC, ignoring latitude, solar declination, Equation of Time, and polar day/night.
  3. `Treatment-Caelus-Wavefront`: offline `sceneGeometry` quadrant mapping (`sunAlt >= 0` normalized `[sunrise..sunset]` into `0..30%` initiate, `30..70%` execute, `70..100%` review/ship; `[-6, 0)` deg civil twilight as `handoff_buffer`; `< -6` deg as `subterranean_gc`; polar midnight-sun nadir fallback as `polar_low_sun_gc`).

## Measured Results (`results.json`)

| Slice | Metric | Control-UTC-RR | Control-Lon-Fixed24h | Treatment-Caelus-Wavefront |
| --- | --- | ---: | ---: | ---: |
| **Overall (6,144 evals)** | Daylight alignment (civil / strict) | 49.0% / 43.8% | 94.8% / 91.2% | **100.0% / 100.0%** |
| **Overall (6,144 evals)** | Nocturnal GC safety (strict / civil) | 32.4% / 23.1% | 93.3% / 82.9% | **100.0% / 100.0%** |
| **Solstice High+Polar** (`Oslo`, `London`, `Tromso`) | Daylight alignment (civil / strict) | 53.2% / 44.0% | 79.9% / 68.8% | **100.0% / 100.0%** |
| **Solstice High+Polar** | Nocturnal GC safety (strict / civil) | 45.8% / 20.8% | 84.0% / 60.4% | **100.0% / 100.0%** |
| **Solstice Mid+High Non-Polar** | Nocturnal GC safety (strict / civil) | 37.0% / 29.2% | 84.4% / 77.4% | **100.0% / 100.0%** |
| **Equinox All Cities** (tie-slice) | Daylight alignment (civil / strict) | 46.6% / 42.1% | **100.0%** / 99.2% | **100.0% / 100.0%** |
| **Equatorial Singapore** (tie-slice) | Daylight alignment (civil / strict) | 37.5% / 33.3% | **100.0%** / 99.0% | **100.0% / 100.0%** |
| **Global Fleet Coverage** | 24h daylight-active / execute / GC | 100% / 68.2% / 56.4% | 100% / 85.4% / 100% | **100% / 90.1% / 100%** |
| **Latency** | Mean compute per node tick | 0.21 us | 0.19 us | **887.2 us** |

## Honest Tie-vs-Win Summary

- **Where `Control-Lon-Fixed24h` ties Caelus**: At equatorial Singapore (`100.0%` vs `100.0%` civil daylight alignment, `99.0%` strict) and across all cities near the March and September equinoxes (`100.0%` civil, `99.2%` strict), longitude-adjusted fixed 24h clocks match Caelus because day length is close to 12 hours everywhere.
- **Where `Treatment-Caelus-Wavefront` genuinely wins**: Around the June and December solstices, fixed 24h clocks misroute `20.1%` of interactive work into local darkness (`31.2%` below geometric horizon) and run `16.0%` of GC jobs during full daylight (`39.6%` above civil twilight) across high-latitude and polar nodes (`Oslo`, `London`, `Tromso`), and `15.6%` of solstice GC jobs during daylight even on strictly non-polar mid/high-latitude cities. Caelus eliminates those errors at `0.89 ms` offline per node tick with zero coordinator RPCs and lifts continuous global daylight-execute coverage from `85.4%` to `90.1%`.

## Reproducing

```bash
node lab/scripts/lab.mjs run EXP-009
```
