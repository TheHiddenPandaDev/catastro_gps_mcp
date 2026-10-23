# CatastroGPS — MCP Server (TypeScript)

Servidor MCP (Model Context Protocol) que expone datos catastrales europeos a agentes AI. TypeScript + Node.js.

## Docs del producto

Lee los docs en `../docs/` antes de implementar:

```
../docs/00-PRODUCT.md       → Qué es el producto, planes, pricing
../docs/01-ARCHITECTURE.md  → Decisiones globales de arquitectura
../docs/18-MCP-SERVER.md    → Spec completa de este MCP server
../docs/06-INTEGRATIONS.md  → API Catastro, integraciones externas
```

## Estructura del proyecto

```
mcp/
  src/
    index.ts                   → Entrypoint (stdio transport)
    server.ts                  → Setup del server MCP + registro de tools
    sse.ts                     → Transporte SSE/HTTP
    client/
      catastrogps-api.ts       → Cliente HTTP hacia el backend Go
    tools/
      get-parcel.ts            → Tool: parcela por referencia o coordenadas (31 códigos)
      search-address.ts        → Tool: dirección en texto libre → candidatos (ES + 26 países)
      get-units.ts             → Tool: unidades/viviendas de una finca (ES/PV/NA), paginado
      resolve-reference.ts     → Tool: clasifica un texto (referencia/coordenadas/topónimo), gratis
      get-boundaries.ts        → Tool: geometría (GeoJSON / anillo), centroide, área
      get-solar.ts             → Tool: potencial solar (ES/PV/NA/PT/FR/IT/DE)
      get-agriculture.ts       → Tool: datos agrícolas (ES/PV/NA/PT/FR/IT/DE)
      get-market.ts            → Tool: mercado agregado (cifras solo FR/IT/DE-NRW)
      get-score.ts             → Tool: score 0-100 + factores cualitativos
      get-value-history.ts     → Tool: instantáneas de superficie/uso (ES/PV/NA/PT/FR/IT/DE/AT)
      compare-parcels.ts       → Tool: 2-3 parcelas (ES/PT/FR/IT/DE)
      get-parcel-subparcels.ts → Tool: subparcelas/cultivos (ES/forales/AT/EE/GR), de pago
      get-crop-catalog.ts      → Tool: catálogo de códigos de cultivo, gratis
      get-neighbors.ts         → Tool: parcelas colindantes
      list-provinces.ts / list-municipalities.ts / list-streets.ts → Tools: callejero del Catastro común
      shared.ts                → Errores y utilidades compartidas
    version.ts                 → Versión única (package.json, server.json, manifest.json, smithery.yaml la repiten; un test lo vigila)
    types/
      index.ts                 → Tipos TypeScript
  build/                       → Salida compilada
  tests/                       → Tests
  server.json                  → Registro oficial MCP (mcp-publisher)
  manifest.json                → Bundle MCPB (Claude Desktop, Smithery)
  smithery.yaml                → Lanzador stdio para Smithery/Glama
  PUBLISHING.md                → Checklist de publicación para Dani
  package.json
  tsconfig.json
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js + TypeScript |
| SDK | `@modelcontextprotocol/sdk` |
| Transporte | stdio (publicado). `sse.ts` existe pero NO está desplegado y usa la key del servidor para todos |
| Cliente HTTP | Fetch nativo |
| Auth | API key en header `X-API-Key` |

## Tools disponibles (2.2.0)

Desde 2.0.0 todo va contra la API v1 en inglés (`/v1/...`); las rutas `/api/...` siguen vivas para la web/app pero están deprecadas para clientes de API.

| Tool | Endpoint backend | Países |
|------|------------------|--------|
| `get_parcel` | `GET /v1/parcels/:ref` · `GET /v1/search/coordinates` | 31 códigos (`wiredCountries`); UK y HR solo coordenadas |
| `search_address` | `GET /v1/search/address/candidates?q=&country=&limit=` | ES (con PV/NA) + 26 países del enum de la OpenAPI; SE/HR → `CNV_COVERAGE` |
| `get_units` | `GET /v1/parcels/:ref/units?country=&cursor=` | ES, PV, NA. Cobra una unidad por unidad servida |
| `resolve_reference` | `GET /v1/resolve?q=&hint=` | Todos; sin auth, no gasta cuota |
| `get_boundaries` | `GET /v1/parcels/:ref/polygon` | 30 (todos menos UK) |
| `get_solar_potential` | `GET /v1/parcels/:ref/solar` | ES, PV, NA, PT, FR, IT, DE |
| `get_terrain` | `GET /v1/parcels/:ref/terrain?lat=&lng=` | Todos los de referencia menos HR; fuera de los 7, `lat`/`lng` obligatorios. Incluye `climate` (ERA5-Land) |
| `get_ground_motion` | `GET /v1/parcels/:ref/ground-motion?lat=&lng=` | Igual que terrain (el backend usa `terrainLocation` en los dos) |
| `get_agriculture` | `GET /v1/parcels/:ref/agriculture` | ES, PV, NA, PT, FR, IT, DE |
| `get_market_data` | `GET /v1/parcels/:ref/market` | Solo planes de pago (free → `403 KEY_PLAN_001`, no cobra) y solo suelo rústico sin edificar de ES/PV/NA: `crop_prices` + `zone_prices.rural`. Vivienda, nave, cualquier construido, rústico sin precio u otro país → `422 MKT_001`, no cobra. Nunca cifras urbanas. La descripción no nombra fuentes |
| `get_investment_score` | `GET /v1/parcels/:ref/score` | ES, PV, NA, PT, FR, IT, DE |
| `get_value_history` | `GET /v1/parcels/:ref/value-history` (solo planes de pago) | ES, PV, NA, PT, FR, IT, DE, AT (donde `GetByRefcat` graba) |
| `compare_parcels` | `POST /v1/parcels/compare` `{parcels:[{reference,country}]}` | ES, PT, FR, IT, DE (PV/NA caen al Catastro común y fallan) |
| `get_parcel_subparcels` | `GET /v1/parcels/:ref/subparcels?country=&lang=` | ES (con forales), AT, DE, CZ, NL, FR, PT, SE, CH, FI, BE, IE, SI, EE, GR. De pago (0 si no hay); `503 SUB_001` no cobra |
| `get_parcel_sigpac` | `GET /v1/parcels/:ref/sigpac?country=&lang=` | ES, PV, NA. Recintos SIGPAC con geometría opcional. De pago (0 si no hay); `503 SIG_001` no cobra |
| `get_crop_catalog` | `GET /v1/reference/crops?lang=` | Todos; gratis, sin cuota |
| `get_neighbors` | `GET /v1/parcels/:ref/neighbors?country=` | ES (catastro); resto desde copia propia (`supported:false` gratis) |
| `list_provinces` / `list_municipalities` / `list_streets` | `GET /v1/locations/{provinces,municipalities?region=,streets?region=&municipality=&name=}` | España común |

Cuota: el cliente lee de cada respuesta `X-Quota-*` (mensual), `X-Quota-Overage`/`-Balance`/`-Overage-Unit-Price`/
`-Overage-Remaining` (saldo prepagado), `X-RateLimit-*` (ráfaga por minuto) y `X-Quota-Finca-Cap*` (tope por finca en
`/units`), y cada tool devuelve un objeto `quota` de ESA respuesta (no del `lastQuota` compartido). Sin saldo la API
responde `429 KEY_AUTH_004`; no existe 402.

Las siete rutas de enriquecimiento van por `RegisterApiProRoutes` (`apiKeyMiddleware,
optionalAuthMiddleware, proOrApiKey`): entran con API key de organización (consume cuota, también
en los "no encontrado") o con JWT Pro. Desde el backend de sep-2026; antes `market`, `score`,
`value-history` y `compare` iban por `RegisterProRoutes` y con API key daban 401.

Coordenadas: siempre `GET /v1/search/coordinates`. El `POST` antiguo solo despacha 8 países y
manda el resto a España.

## Países soportados

Espejo de `wiredCountries` en `backend/internal/conversion/infrastructure/http/resolve_controller.go`
(`tests/types.test.ts` lo compara). Si cambia allí, cambia en `src/types/index.ts` y en la tabla
del README.

## Pricing MCP

| Plan | Precio | Llamadas/mes |
|------|--------|-------------|
| Free | 0€ | 100 |
| Developer | 19€ | 5.000 |
| Startup | 49€ | 15.000 |
| Growth | 99€ | 50.000 |
| Enterprise | Custom | Ilimitado |

## Reglas

- Todo el código en TypeScript strict (`strict: true` en tsconfig)
- Cada tool en su propio archivo en `tools/`
- El cliente HTTP centralizado en `client/catastrogps-api.ts` — nunca llamar al backend directamente desde tools
- Validar inputs de cada tool antes de llamar al backend
- Score devuelto como factores cualitativos, nunca como fórmula numérica
- Datos de mercado siempre agregados, nunca precios individuales
- Rate limiting por API key — respetar límites del plan
- Logs estructurados con contexto (tool, refcat, país)
- Tests para cada tool con mocks del cliente HTTP
