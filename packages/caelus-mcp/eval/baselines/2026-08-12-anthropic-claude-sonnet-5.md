# MCP tool-selection eval report

- fixtures: **82**
- tool-selection accuracy: **91.5%**
- schema-valid rate: **100.0%**
- args-correct rate (of correct-tool cases): **77.3%**

## Semantic predicates (applicable cases only)

| predicate | passed / applicable |
|---|---|
| date_is_utc | 56 / 56 |
| lon_sign_west | 28 / 28 |
| lon_sign_east | 18 / 18 |
| orb_in_range | 4 / 4 |
| synastry_both_present | 4 / 5 |
| exactly_one_target | 9 / 9 |
| range_le_50yr | 0 / 0 |
| snake_case_body | 2 / 2 |
| exactly_one_date | 1 / 1 |
| step_in_range | 1 / 1 |
| window_in_range | 1 / 1 |
| lat_sign_south | 2 / 2 |
| return_window_le_2yr | 2 / 2 |
| target_after_natal | 9 / 9 |

## By tag (tool-selection)

| tag | correct / n |
|---|---|
| ambiguous | 0 / 1 |
| aphesis | 2 / 2 |
| ashtottari | 1 / 1 |
| body-to-body | 1 / 1 |
| composite | 2 / 2 |
| current_sky | 5 / 7 |
| dasha | 3 / 3 |
| date | 2 / 2 |
| date-rollover | 1 / 1 |
| default-house-system | 1 / 1 |
| default-time | 7 / 7 |
| dignities | 2 / 2 |
| directions | 3 / 3 |
| east-lon | 18 / 19 |
| electional | 4 / 4 |
| equator | 2 / 2 |
| event | 0 / 1 |
| find_aspect_dates | 9 / 9 |
| firdaria | 2 / 2 |
| geocode | 13 / 14 |
| graceful-error | 4 / 4 |
| hellenistic | 8 / 8 |
| historical | 2 / 2 |
| house-fallback | 1 / 1 |
| house-system | 4 / 4 |
| house-system-trap | 0 / 1 |
| huge-range | 2 / 2 |
| interpretation | 3 / 3 |
| lots | 2 / 2 |
| lunar-return | 1 / 1 |
| midnight | 1 / 1 |
| missing-data | 0 / 1 |
| mundane-directions | 1 / 1 |
| nakshatras | 1 / 2 |
| natal | 17 / 19 |
| navamsa | 1 / 1 |
| negative | 3 / 4 |
| orb | 2 / 2 |
| orb-edge | 1 / 1 |
| out-of-range | 2 / 2 |
| planetary_hours | 2 / 2 |
| polar | 1 / 1 |
| primary-directions | 2 / 2 |
| profections | 2 / 2 |
| progressions | 2 / 2 |
| raja-yoga | 1 / 1 |
| rectification_grid | 3 / 3 |
| releasing | 2 / 2 |
| relocated | 1 / 1 |
| return | 1 / 1 |
| returns | 3 / 3 |
| sect | 2 / 2 |
| sidereal | 1 / 1 |
| sign-to-degree | 1 / 1 |
| snake-case | 2 / 2 |
| solar-arc | 2 / 2 |
| solar-return | 1 / 1 |
| southern | 5 / 6 |
| synastry | 2 / 3 |
| target-body | 3 / 3 |
| target-lon | 5 / 5 |
| timezone | 15 / 16 |
| timezone-explicit | 0 / 1 |
| tool-select | 25 / 27 |
| transits | 5 / 6 |
| vargas | 2 / 2 |
| vedic | 8 / 9 |
| vimshottari | 1 / 1 |
| void_of_course | 2 / 2 |
| west-lon | 29 / 31 |
| window | 1 / 1 |
| yogas | 2 / 2 |
| yogini | 1 / 1 |

## Failures

- **sky-event-moment** — wrong tool
- **synastry-two-births** — args: b.date: expected "1988-03-21T10:00:00Z", got "1988-03-21T11:00:00Z"
- **synastry-wholesign-trap** — wrong tool | args: a: expected object, got undefined; b: expected object, got undefined
- **find-saturn-square-lon** — args: end: expected "2027-01-01T00:00:00Z", got "2027-12-31T00:00:00Z"
- **find-saturn-square-moon** — args: end: expected "2028-12-31T23:59:59Z", got "2028-12-31T00:00:00Z"
- **find-jupiter-return** — args: end: expected "2024-01-01T00:00:00Z", got "2024-12-31T00:00:00Z"
- **find-mars-conj-jupiter-body** — args: end: expected "2024-01-01T00:00:00Z", got "2024-12-31T23:59:59Z"
- **find-truenode-token** — args: end: expected "2030-01-01T00:00:00Z", got "2030-12-31T23:59:59Z"
- **rectify-unknown-time** — args: date: expected "1990-06-10T00:00:00Z", got "1990-06-10"
- **rectify-rising-leo** — args: date: expected "1980-04-12T00:00:00Z", got "1980-04-12"
- **rectify-window** — args: date: expected "2003-09-09T00:00:00Z", got "2003-09-09"
- **tz-utc-explicit** — wrong tool
- **southern-cape-town** — wrong tool
- **hugerange-find** — args: end: expected "2000-01-01T00:00:00Z", got "1950-01-01T00:00:00Z"
- **ambiguous-my-chart-now** — wrong tool
- **find-sextile-bodies** — args: end: expected "2027-01-01T00:00:00Z", got "2027-12-31T23:59:59Z"
- **transits-default-noplace-err** — wrong tool
- **returns-solar-tampa** — args: search_start: expected "2026-01-01T00:00:00Z", got "2026-06-05T00:00:00Z"; search_end: expected "2026-12-31T23:59:59Z", got "2026-06-15T00:00:00Z"
- **returns-window-too-wide** — args: search_start: expected "2020-01-01T00:00:00Z", got "2020-06-01T00:00:00Z"; search_end: expected "2035-01-01T00:00:00Z", got "2022-06-01T00:00:00Z"
- **composite-two-births** — args: b.date: expected "1988-03-21T10:00:00Z", got "1988-03-21T11:00:00Z"
- **profections-lord-of-year** — args: target_date: expected "2026-06-10T00:00:00Z", got "2026-06-10T18:30:00Z"
- **releasing-spirit-current** — args: target_date: expected "2026-06-10T00:00:00Z", got "2026-06-10T12:00:00Z"
- **nakshatras-moon-tampa** — wrong tool
- **dasha-vimshottari-tampa** — args: system: expected "vimshottari", got undefined
