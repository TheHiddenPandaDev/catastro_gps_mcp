# catastrogps-mcp

MCP server for European cadastral and territorial data. Access parcel information, solar potential, agricultural data, market prices, and investment scores across Spain, Portugal, France, Italy, and Germany.

**The first MCP server for European cadastral data.**

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "catastrogps": {
      "command": "npx",
      "args": ["-y", "catastrogps-mcp"],
      "env": {
        "CATASTROGPS_API_KEY": "pk_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add catastrogps -- npx -y catastrogps-mcp
```

Then set the environment variable `CATASTROGPS_API_KEY=pk_live_YOUR_KEY_HERE`.

### SSE (Remote / Web Agents)

```json
{
  "mcpServers": {
    "catastrogps": {
      "url": "https://mcp.catastrogps.es/sse",
      "headers": {
        "X-API-Key": "pk_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Get an API Key

1. Sign up at [catastrogps.es](https://catastrogps.es)
2. Go to **Settings > API Keys**
3. Create a new key
4. Copy the `pk_live_xxx` key (shown only once)

## Tools

| Tool | Description | Cost |
|------|-------------|------|
| `get_parcel` | Get cadastral data by reference or GPS coordinates | 1 call |
| `get_solar_potential` | Solar energy potential (PVGIS) | 1 call |
| `get_agriculture` | Land use, NDVI, crop prices | 1 call |
| `get_market_data` | Real estate transactions and prices | 1 call |
| `get_investment_score` | Investment score 1-10 | 1 call |
| `get_value_history` | Historical cadastral value | 1 call |
| `compare_parcels` | Compare 2-3 parcels side by side | 2 calls |

## Supported Countries

| Code | Country | Source |
|------|---------|--------|
| `ES` | Spain | Catastro Nacional (SOAP) |
| `PV` | Basque Country | WFS INSPIRE (3 provinces) |
| `NA` | Navarra | WFS IDENA |
| `PT` | Portugal | OGC API DGT |
| `FR` | France | Geoplateforme IGN + DVF |
| `IT` | Italy | WFS Agenzia Entrate |
| `DE` | Germany (NRW) | WFS NRW ALKIS |

## Example Usage

Ask Claude:

> "What's the solar potential of parcel 9872323VK2897S0001WX in Spain?"

> "Compare these two parcels: 9872323VK2897S0001WX in Spain and 750560000AB0001 in France"

> "Find the parcel at coordinates 40.4165, -3.7038 in Spain and give me its investment score"

## Pricing

| Tier | Price | Calls/month |
|------|-------|-------------|
| Free | 0€ | 100 |
| Developer | 19€/mo | 5,000 |
| Startup | 49€/mo | 15,000 |
| Growth | 99€/mo | 50,000 |
| Enterprise | Contact | Unlimited + SLA |
| Overage | 0.01€/call | Beyond tier limit |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CATASTROGPS_API_KEY` | Yes | — | Your API key (`pk_live_xxx`) |
| `CATASTROGPS_API_URL` | No | `https://api.catastrogps.es` | Backend API URL |
| `CATASTROGPS_TIMEOUT` | No | `10000` | Request timeout (ms) |
| `MCP_PORT` | No | `3001` | SSE server port |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally (stdio)
CATASTROGPS_API_KEY=pk_test_xxx node build/index.js

# Run SSE server
CATASTROGPS_API_KEY=pk_test_xxx node build/sse.js

# Run tests
npm test
```

## License

MIT
