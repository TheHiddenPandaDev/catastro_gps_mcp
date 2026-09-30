# Catastro GPS MCP server

<!-- mcp-name: com.parcelgps/catastro-gps -->

Official cadastral parcels for AI agents, across **29 European countries plus the Basque Country and Navarre** (31 country and region codes), with one API key.

Ask your agent for a parcel by its cadastral reference, by a point on the map or, in Spain, by a postal address typed as free text. It gets back the reference, location, area, land use and the parcel outline, and it can estimate solar and agricultural potential, read aggregated market prices, score and compare parcels in Spain, Portugal, France, Italy and Germany.

- **31 codes, one call shape.** `ES`, `PT`, `FR`, `IT`, `DE`, `PL`, `NL`, `CH`… and the two Spanish foral cadastres (`PV`, `NA`) that the central Catastro does not serve.
- **The country is optional.** It is detected from the reference format or from the point. A few references are valid in more than one country (some German and Portuguese numbers look alike): pass `country` to be explicit.
- **Free-text Spanish addresses.** `"Calle Mallorca 213, Barcelona"` becomes a cadastral reference.
- **Geometry included.** Parcel outlines as GeoJSON or `[lat, lng]` rings, with centroid and area.
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
| `get_parcel` | Parcel by cadastral reference **or** WGS84 coordinates: reference, location, address, municipality, area, land use, outline | All 31 codes (UK: coordinates only) |
| `search_address` | Spanish postal address in free text → cadastral reference | Spain, central Catastro |
| `get_boundaries` | Parcel outline as GeoJSON / `[lat, lng]` ring, centroid and area | 30 codes (all but UK) |
| `get_solar_potential` | PVGIS photovoltaic estimate: kWp, kWh/year, savings, payback, CO₂, tilt | ES, PV, NA, PT, FR, IT, DE |
| `get_terrain` | Relief over the parcel outline (Copernicus DEM GLO-30: elevation, slope, orientation) and Natura 2000 / protected areas (EEA) with the share of the parcel inside each site | ES, PV, NA, PT, FR, IT, DE |
| `get_agriculture` | Land use, main crop, NDVI and a reference crop price (SIGPAC detail in Spain) | ES, PV, NA, PT, FR, IT, DE |
| `get_market_data` | Aggregated price reference for the parcel's area. Never individual sales | Figures: FR, IT, DE (NRW only). ES, PV, NA, PT: note without figures |
| `get_investment_score` | Score 0–100 with a rating and qualitative factor levels (high / medium / low / not available) | ES, PV, NA, PT, FR, IT, DE |
| `get_value_history` | Area and land-use snapshots of the parcel over time | ES, PV, NA, PT, FR, IT, DE, AT |
| `compare_parcels` | Two or three parcels side by side: location, solar, agriculture, score | ES, PT, FR, IT, DE (not PV or NA) |

Every tool call is one API call against your monthly quota, including calls that end in "not found". `compare_parcels` is one call for the whole comparison.

The API reports the monthly quota of your plan in the `X-Quota-Limit`, `X-Quota-Remaining` and `X-Quota-Reset` headers (plus `X-Quota-Tier`); when it runs out, the error tells you the date it resets. `X-RateLimit-*` is a separate per-key burst limit per minute that depends on your plan (Free 10, Developer 60, Startup 120, Growth 300; a global per-IP guard also applies) and has nothing to do with the monthly quota.

### What the market, score and history tools can and cannot tell

- **`get_market_data`** has numbers only where an official source gives them: France (DVF recorded sales: average €/m², number of sales, last sale date, estimated value), Italy (OMI zone values from the Agenzia delle Entrate) and Germany (official *Bodenrichtwert* land value per m², North Rhine-Westphalia only; elsewhere in Germany it answers `available: false`). In Spain and Portugal it answers with a note and no figures: there is no per-parcel price source yet.
- **`get_investment_score`** combines what the API can gather for the parcel: solar potential and agricultural use everywhere it answers, market prices only in France, Italy and Germany (NRW). Accessibility and risk are not computed yet and come back as `not_available`, so the score is relative to the factors that were available. You get the score, the rating and qualitative factor levels, never the weights.
- **`get_value_history`** starts the first time anyone looks the parcel up through Catastro GPS (at most one snapshot every 30 days). A parcel nobody has queried returns an empty list. It records area and land use; the official cadastral value is not recorded yet, so `cadastral_value_eur` is always `null` and `change_pct` is the change in area.
- **`compare_parcels`** fills area, land use and municipality only for Spanish parcels; for Portugal, France, Italy and Germany it returns the location, solar, agriculture and score. It does not include market prices. A parcel that is not found comes back with an error and the others are still compared.

## Coverage

What each code answers today. "Partial" means the official source does not cover the whole territory.

| Code | Country / region | By reference | By coordinates | Geometry | Notes |
|------|------------------|:---:|:---:|:---:|-------|
| `ES` | Spain (central Catastro) | ✅ | ✅ | ✅ | Free-text address search too |
| `PV` | Basque Country (Álava, Bizkaia, Gipuzkoa) | ✅ | ✅ | ✅ | Foral cadastres, separate from the central Catastro |
| `NA` | Navarre | ✅ | ✅ | ✅ | Foral cadastre |
| `PT` | Portugal | Partial | ✅ | Partial | Digital cadastre does not cover the whole country |
| `FR` | France | ✅ | ✅ | ✅ | |
| `IT` | Italy | ✅ | ✅ | ✅ | |
| `DE` | Germany | Partial | Partial | Partial | Every Land except Bavaria |
| `AT` | Austria | ✅ | ✅ | ✅ | |
| `CH` | Switzerland | ✅ | ✅ | ✅ | E-GRID references |
| `LI` | Liechtenstein | ✅ | ✅ | ✅ | |
| `BE` | Belgium | ✅ | ✅ | ✅ | |
| `NL` | Netherlands | ✅ | ✅ | ✅ | |
| `LU` | Luxembourg | ✅ | ✅ | ✅ | |
| `PL` | Poland | ✅ | ✅ | ✅ | TERYT parcel IDs |
| `CZ` | Czechia | ✅ | ✅ | ✅ | |
| `SK` | Slovakia | ✅ | ✅ | ✅ | |
| `SI` | Slovenia | ✅ | ✅ | ✅ | |
| `HR` | Croatia | ✅ | ✅ | ✅ | |
| `BG` | Bulgaria | ✅ | ✅ | ✅ | |
| `GR` | Greece | ✅ | ✅ | ✅ | |
| `CY` | Cyprus | ✅ | ✅ | ✅ | |
| `DK` | Denmark | ✅ | ✅ | ✅ | |
| `SE` | Sweden | ✅ | ✅ | ✅ | Agricultural blocks (Jordbruksverket), not property units |
| `NO` | Norway | ✅ | ✅ | ✅ | |
| `FI` | Finland | ✅ | ✅ | ✅ | |
| `IS` | Iceland | ✅ | ✅ | ✅ | |
| `EE` | Estonia | ✅ | ✅ | ✅ | |
| `LV` | Latvia | ✅ | ✅ | ✅ | |
| `LT` | Lithuania | ✅ | ✅ | ✅ | |
| `IE` | Ireland | ✅ | ✅ | ✅ | |
| `UK` | United Kingdom | — | Scotland | Scotland | Registers of Scotland; England, Wales and Northern Ireland not yet |

Data comes live from each country's official cadastre or INSPIRE service, so availability follows theirs: some national services are slow, and the server raises a clear `SERVICE_UNAVAILABLE` when one is down. Outside the table, a point or reference answers `CNV_COVERAGE`.

Official registry documents (Spanish *nota simple*, Italian *visura*, Portuguese *certidão permanente* and others) can be ordered at [catastrogps.es](https://www.catastrogps.es). They are not exposed through the API or this server yet.

## Examples

Ask your agent:

> Find the cadastral parcel at Calle Mallorca 213, Barcelona, and give me its area and outline.

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
KEY_AUTH_004: Monthly quota exhausted. Upgrade at https://www.parcelgps.com/developers
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
npm run build
CATASTROGPS_API_KEY=pk_live_xxx node build/index.js
```

## License

MIT
