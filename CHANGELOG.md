# Changelog

## Unreleased

- Remote server at `https://mcp.parcelgps.com/mcp` (Streamable HTTP, stateless): nothing to install. Each request runs on the caller's own key, taken from `Authorization: Bearer`, `X-API-Key` or `?api_key=` for clients that only take a URL; never on a server key. `server.json` declares it under `remotes`.
- `build/sse.js` is gone: the remote server replaces the SSE transport, which was never deployed.

## 2.2.0 (2026-10-23)

- New `get_parcel_sigpac`: every SIGPAC enclosure of a Spanish parcel (ES, PV, NA) from `GET /v1/parcels/{ref}/sigpac`: SIGPAC parcel key, `match`, `land_use_code`, `land_use` in `lang`, `crop_code`, `use_class`, `area_ha`, `irrigation_pct`, `mean_slope_pct`, `altitude_m`, `pasture_eligibility_pct`, `cap_region` (null when SIGPAC does not apply them), `incidents`, attribution and licence, outline with `include_geometry`. `SIG_001` (SIGPAC down) is explained as retryable and not charged.
- `get_parcel_subparcels` states its real coverage: Spain, Austria, Germany, Czechia, the Netherlands, France, Portugal, Sweden, Switzerland, Finland, Belgium, Ireland, Slovenia, Estonia and Greece.

## 2.1.0 (2026-10-21)

- New `get_parcel_subparcels`: every crop or land-use subparcel (`crop_code`, `crop` in `lang`, `crop_original`, `area_m2`, `kind`, `use_class`, `intensity`, `land_type`, `land_class`, `source`, outline with `include_geometry`). Spain (foral territories included), Austria, Estonia and Greece. `SUB_001` (source down) is explained as retryable and not charged.
- New `get_crop_catalog` (free, no quota): crop codes with names in 10 languages, filterable by `code` or `source`.
- New `get_neighbors`: adjoining parcels with reference and centre point.
- New `list_provinces`, `list_municipalities`, `list_streets`: the Spanish cadastre lists.
- `get_parcel` takes `lang` and returns `subparcel_count` and `crop_summary` (the API no longer embeds subparcels in the parcel).
- `get_market_data` returns `zone_prices` for Spanish parcels: official province prices for housing (€/m²) and farmland (€/ha).

## 2.0.0 (2026-10-20)

- Every tool calls the English v1 API (`/v1/parcels/...`, `/v1/search/...`, `/v1/resolve`) instead of the legacy `/api/...` routes, which answer in Spanish field names and are now deprecated.
- Breaking: `get_parcel`, `search_address` and `get_units` return `region` instead of `province`; `get_parcel` by coordinates also returns `parcel_reference`.
- Breaking: the nested blocks passed through from the API are English camelCase: `get_agriculture.agriculture` (`landUse`, `mainCrop`, `ndvi.cropHealth`, `cropPrice`...), `get_terrain.relief`/`protected_areas`/`climate` (`meanPct`, `overlapPct`...) and `get_ground_motion.ground_motion` (`meanMmYear`...).
- `get_investment_score` ratings are English: `excellent`, `good`, `moderate`, `low`, `very_low`, `no_data`; risk and opportunity factors are English sentences.
- `get_boundaries` returns GeoJSON for every country (the `outline_lat_lng` ring of non-Spanish parcels is gone; use `get_parcel` for it).
- Errors read the v1 `{code, message, details}` body; the legacy `{error, data}` body is still understood.

## 1.3.2 (2026-10-06)

- Coverage stated the same way as the website: 29 European countries, including the Basque Country and Navarre foral cadastres; by cadastral reference in 27 and by coordinates in all 29 (United Kingdom and Croatia are coordinates only). The "31 official cadastres" count is gone.

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
