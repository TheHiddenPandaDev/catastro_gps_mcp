# Catastro GPS MCP server

<!-- mcp-name: com.parcelgps/catastro-gps -->

Official cadastral parcels for AI agents from **29 European countries (including the Basque Country and Navarre foral cadastres)**, with one API key: by cadastral reference in 27, by coordinates in all 29. In Croatia (ARKOD agricultural parcels), Sweden (agricultural blocks) and Scotland (by coordinates) the source is not a full cadastre.

Ask your agent for a parcel by its cadastral reference, by a point on the map or by a postal address. It gets back the reference, location, area, land use and the parcel outline; it can list every dwelling of a Spanish building, read relief, protected areas, climate normals and satellite ground motion, estimate solar and agricultural potential, read aggregated market prices, and score and compare parcels.

- **29 countries, one call shape.** `ES`, `PT`, `FR`, `IT`, `DE`, `PL`, `NL`, `CH`... and the two Spanish foral cadastres (`PV`, `NA`) that the central Catastro does not serve.
- **The country is optional.** It is detected from the reference format or from the point. When bare digits fit several countries the API says so (`CNV_AMBIGUOUS`) and `resolve_reference` tells you which ones, for free.
- **Address search in 27 countries.** `"Calle Gran Via 31, Madrid"`, `"8 boulevard du Port, Amiens"` or `"Damrak 1, 1012 LG Amsterdam"` become ranked parcels.
- **Buildings, not only plots.** `get_units` lists every dwelling, shop and garage of a Spanish building with floor, door, area and participation coefficient.
- **Your quota in every answer.** Each result carries the monthly quota left, the prepaid balance and the per-minute headroom.
- **Free tier for good.** 250 calls a month at no cost, no card. Failed lookups are not charged.

Get a key at **[parcelgps.com/developers](https://www.parcelgps.com/developers)**.

## Install

### Claude Desktop

```json
{
  "mcpServers": {
    "catastro-gps": {
      "command": "npx",
      "args": ["-y", "catastro-gps-mcp"],
      "env": { "CATASTROGPS_API_KEY": "pk_live_your_key_here" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add catastro-gps --env CATASTROGPS_API_KEY=pk_live_your_key_here -- npx -y catastro-gps-mcp
```

### Cursor, Windsurf, VS Code and other MCP clients

Use the same `npx -y catastro-gps-mcp` command with `CATASTROGPS_API_KEY` in the environment.

## Tools

| Tool | What it does | Countries |
|------|--------------|-----------|
| `get_parcel` | Parcel by cadastral reference **or** WGS84 coordinates: reference, location, address, municipality, area, land use, outline | All 31 codes (UK and HR: coordinates only) |
| `search_address` | Postal address in free text to ranked parcels, with confidence and whether the number and municipality match | ES (with PV and NA entrances) and FR, IT, DE, AT, NL, BE, PL, CH, CZ, DK, NO, FI, EE, LV, LT, SI, SK, BG, GR, CY, LU, LI, IS, IE, UK, PT |
| `get_units` | Every unit (dwelling, shop, garage, storage) of a Spanish building: stair, floor, door, use, area, participation, year. Paginated, 200 per page | ES, PV, NA |
| `resolve_reference` | Free, no quota: is this text a reference, coordinates or a place name, and of which country | All |
| `get_boundaries` | Parcel outline as GeoJSON / `[lat, lng]` ring, centroid and area | 30 codes (all but UK) |
| `get_terrain` | Relief over the parcel outline (Copernicus DEM GLO-30), Natura 2000 / protected areas (EEA) and ERA5-Land climate normals with the recent change | Every reference country but HR; outside ES, PV, NA, PT, FR, IT, DE pass `latitude`/`longitude` |
| `get_ground_motion` | Ground motion measured by satellite (Copernicus EGMS, 2020-2024): subsidence or uplift in mm/year, fastest-sinking cell, east-west motion, yearly displacement; says so when there are no radar reflectors | Same as `get_terrain` |
| `get_solar_potential` | PVGIS photovoltaic estimate: kWp, kWh/year, savings, payback, CO2, tilt | ES, PV, NA, PT, FR, IT, DE |
| `get_agriculture` | Land use, main crop, NDVI and a reference crop price (SIGPAC detail in Spain) | ES, PV, NA, PT, FR, IT, DE |
| `get_market_data` | Aggregated price reference for the parcel's area. Never individual sales | Figures: FR, IT, DE (NRW only). ES, PV, NA, PT: note without figures |
| `get_investment_score` | Score 0-100 with a rating and qualitative factor levels (high / medium / low / not available) | ES, PV, NA, PT, FR, IT, DE |
| `get_value_history` | Area and land-use snapshots of the parcel over time | ES, PV, NA, PT, FR, IT, DE, AT |
| `compare_parcels` | Two or three parcels side by side: location, solar, agriculture, score | ES, PT, FR, IT, DE (not PV or NA) |

## Quota, prepaid balance and limits

- Only successful answers with data spend quota: a not found, a validation error, `CNV_COVERAGE`, `CNV_AMBIGUOUS`, a 5xx and an answer without data (`available: false`) are free. `resolve_reference` never spends.
- Each successful call costs 1 unit, except `get_units` (one unit per unit served in the page, minimum 1) and `compare_parcels` (one per parcel found).
- Every result carries a `quota` object read from that same response: `remaining`, `limit`, `resets_at`, `plan`, and when they apply `prepaid_overage`, `prepaid_balance_eur`, `overage_units_left`, `per_minute_remaining`, and on `get_units` with a contract per-finca cap `finca_cap` / `finca_cap_used`.
- When the monthly quota runs out the API does not cut you off if you have prepaid balance: each extra unit is paid from it (top up at [parcelgps.com/app/developer](https://parcelgps.com/app/developer)). With the quota used up and no balance the call fails with `KEY_AUTH_004` (HTTP 429, never 402) and the error says whether to top up or upgrade, and when the quota resets.
- A separate per-minute limit depends on the plan (Free 10, Developer 60, Startup 120, Growth 300 calls per minute; a global per-IP guard also applies). Going over it answers `KEY_RATE_002` with the seconds to wait.

### What the market, score and history tools can and cannot tell

- **`get_market_data`** has numbers only where an official source gives them: France (DVF recorded sales: average €/m², number of sales, last sale date, estimated value), Italy (OMI zone values from the Agenzia delle Entrate) and Germany (official *Bodenrichtwert* land value per m², North Rhine-Westphalia only; elsewhere in Germany it answers `available: false`). In Spain and Portugal it answers with a note and no figures: there is no per-parcel price source yet.
- **`get_investment_score`** combines what the API can gather for the parcel: solar potential and agricultural use everywhere it answers, market prices only in France, Italy and Germany (NRW). Accessibility and risk are not computed yet and come back as `not_available`, so the score is relative to the factors that were available. You get the score, the rating and qualitative factor levels, never the weights.
- **`get_value_history`** starts the first time anyone looks the parcel up through Catastro GPS (at most one snapshot every 30 days). A parcel nobody has queried returns an empty list. It records area and land use; the official cadastral value is not recorded yet, so `cadastral_value_eur` is always `null` and `change_pct` is the change in area.
- **`compare_parcels`** fills area, land use and municipality only for Spanish parcels; for Portugal, France, Italy and Germany it returns the location, solar, agriculture and score. It does not include market prices. A parcel that is not found comes back with an error and the others are still compared.

## Coverage

What each code answers today (measured against production on 1 October 2026). "Partial" means the official source does not cover the whole territory.

| Code | Country / region | By reference | By coordinates | Address search | Notes |
|------|------------------|---|---|---|-------|
| `ES` | Spain (central Catastro) | yes | yes | yes | Buildings and dwellings with `get_units` |
| `PV` | Basque Country (Araba, Bizkaia, Gipuzkoa) | yes | yes | with `country: ES` | Foral cadastres; `get_units` without participation coefficient |
| `NA` | Navarre | yes | yes | with `country: ES` | Foral cadastre; `get_units` |
| `FR` | France | yes | yes | yes | |
| `IT` | Italy | yes | yes | yes | |
| `DE` | Germany | partial | partial | partial | 15 of 16 Lander: **not Bavaria** |
| `AT` | Austria | yes | yes | yes | |
| `NL` | Netherlands | yes | yes | yes | |
| `BE` | Belgium | yes | yes (slow source) | yes | |
| `PL` | Poland | yes | yes | yes | TERYT parcel IDs |
| `CH` | Switzerland | yes | partial | yes | Not in cantons that publish no parcels (e.g. Vaud) |
| `CZ` `DK` `NO` `FI` `EE` | Czechia, Denmark, Norway, Finland, Estonia | yes | yes | yes | |
| `LT` `SI` `SK` `BG` | Lithuania, Slovenia, Slovakia, Bulgaria | yes | yes | yes | |
| `LU` `LI` `IS` | Luxembourg, Liechtenstein, Iceland | yes | yes | yes | |
| `CY` | Cyprus | yes | yes | yes, low confidence | Few house numbers mapped |
| `LV` | Latvia | with `country: LV` | yes | yes | |
| `GR` | Greece | with `country: GR` | yes | yes | |
| `PT` | Portugal | yes | partial | partial | The cadastre does not cover Lisbon, Porto or Coimbra; the DGT source is often down |
| `IE` | Ireland | with `country: IE` (SP_ID) | partial | partial | |
| `UK` | United Kingdom | no | Scotland only | Scotland only | England, Wales and Northern Ireland not yet |
| `HR` | Croatia | no | ARKOD agricultural parcels only | no | No open cadastre; not Zagreb or Rijeka |
| `SE` | Sweden | agricultural blocks | agricultural blocks | no | Not property units |

Hungary, Romania and the rest of Europe are not covered: a reference or point there answers `CNV_COVERAGE`. Data comes from each country's official cadastre or INSPIRE service (Spain from our copy of the Catastro), so availability follows theirs; when one is down the server answers `SERVICE_UNAVAILABLE`, which is free.

Official registry documents (Spanish *nota simple*, Italian *visura*, Portuguese *certidão permanente* and others) can be ordered at [catastrogps.es](https://www.catastrogps.es). They are not exposed through the API or this server yet.

## Examples

Ask your agent:

> Find the cadastral parcel at Calle Mallorca 213, Barcelona, and give me its area and outline.

> List every flat of the building at Avenida Jose Rodriguez de la Borbolla 10, Dos Hermanas, with floor, door and area.

> Is the ground sinking under parcel 30024A16000286? Is it inside a Natura 2000 site?

> What is the parcel at 52.2297, 21.0122? What's its area?

> Look up the Polish parcel 146510_8.0502.1/3 and tell me its area.

> Compare the solar potential of these two rural parcels in Navarre and Portugal.

> Compare these three parcels in Spain, France and Italy and tell me which has the best investment score.

> What do land prices look like around the French parcel 75056000AB0001?

What a `get_parcel` call returns (shortened; values are illustrative):

```json
{
  "reference": "9872023VH5797S0001WX",
  "country": "ES",
  "latitude": 40.4165,
  "longitude": -3.7038,
  "address": "CL MAYOR 1",
  "municipality": "MADRID",
  "province": "MADRID",
  "area_m2": 512,
  "land_use": "Residencial",
  "outline_lat_lng": [[40.41662, -3.70391], [40.41671, -3.70362], "..."],
  "google_maps_url": "https://maps.google.com/?q=40.4165,-3.7038"
}
```

Errors come back as a code plus a sentence the agent can act on, for example:

```text
CNV_COVERAGE: That reference or point is in a country that is not covered yet.
SERVICE_UNAVAILABLE: The official cadastre for this country is not responding. Try again in a few minutes.
KEY_AUTH_004: Monthly quota used up and prepaid balance empty: top up at https://parcelgps.com/app/developer (or upgrade at https://www.parcelgps.com/developers).
```

## Pricing

The same key works for this server, the REST API and the SDKs ([`catastrogps`](https://www.npmjs.com/package/catastrogps) on npm and PyPI).

| Plan | Price | Calls / month |
|------|-------|---------------|
| Free | €0, forever | 250 |
| Developer | €19 / month | 5,000 |
| Startup | €49 / month | 15,000 |
| Growth | €99 / month | 50,000 |
| Enterprise | Contact us | Custom |

Details and sign-up: [parcelgps.com/developers](https://www.parcelgps.com/developers).

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CATASTROGPS_API_KEY` | Yes | | Your API key |
| `CATASTROGPS_TIMEOUT` | No | `20000` | Request timeout in ms. Official cadastres can be slow |
| `CATASTROGPS_API_URL` | No | `https://api.parcelgps.com` | API base URL |

## Development

```bash
npm install
npm run lint
npm test
npm run test:coverage
npm run build
CATASTROGPS_API_KEY=pk_live_xxx node build/index.js
```

## License

MIT
