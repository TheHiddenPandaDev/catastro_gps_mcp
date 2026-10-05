# Changelog

## 1.3.1 (2026-10-05)

- Coverage stated with the real numbers in README, package.json, manifest.json, server.json and the `get_parcel` description: 29 European countries, 31 official cadastres including the Basque Country and Navarre.

## 1.3.0 (2026-10-05)

- `search_address` now uses `GET /api/search/address/candidates`: ranked candidates with confidence in Spain and 26 more countries (`country`, `limit`), instead of the live Spanish street index only. Sweden and Croatia answer `CNV_COVERAGE`.
- New `get_units`: every unit of a Spanish building (ES, PV, NA) with stair, floor, door, use, area, participation and year, page by page with `cursor`. Costs one quota unit per unit served.
- New `resolve_reference`: free classification of a text as reference, coordinates or place name per country (`GET /api/resolve`).
- `get_terrain` returns the ERA5-Land `climate` block. `get_terrain` and `get_ground_motion` accept every reference country except Croatia, with `latitude`/`longitude` outside ES, PV, NA, PT, FR, IT and DE.
- Every result carries a `quota` object from its own response: monthly quota, prepaid overage balance, units the balance still covers, per-minute headroom and the per-finca cap on `get_units`.
- `KEY_AUTH_004` says whether to top up the prepaid balance or upgrade; `KEY_RATE_002` says how many seconds to wait.
- Fixed: the per-minute limiter was read as the monthly quota when `X-Quota-Limit` was missing; `compare_parcels` description now says it costs one unit per parcel found.
- Directory metadata (server.json, manifest.json, smithery.yaml) at 1.3.0 with the 13 tools.

## 1.2.2

- `get_ground_motion` (Copernicus EGMS) and `get_terrain` (Copernicus DEM, Natura 2000).
