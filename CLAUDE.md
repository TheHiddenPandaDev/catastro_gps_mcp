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

## Tools disponibles (1.3.0)

| Tool | Endpoint backend | Países |
|------|------------------|--------|
| `get_parcel` | `GET /api/catastro/:ref` · `GET /api/search/coordinates` | 31 códigos (`wiredCountries`); UK y HR solo coordenadas |
| `search_address` | `GET /api/search/address/candidates?q=&country=&limit=` | ES (con PV/NA) + 26 países del enum de la OpenAPI; SE/HR → `CNV_COVERAGE` |
| `get_units` | `GET /api/catastro/:ref/units?country=&cursor=` | ES, PV, NA. Cobra una unidad por unidad servida |
| `resolve_reference` | `GET /api/resolve?q=&hint=` | Todos; sin auth, no gasta cuota |
| `get_boundaries` | `GET /api/catastro/:ref/polygon` | 30 (todos menos UK) |
| `get_solar_potential` | `GET /api/catastro/:ref/solar` | ES, PV, NA, PT, FR, IT, DE |
| `get_terrain` | `GET /api/catastro/:ref/terrain?lat=&lng=` | Todos los de referencia menos HR; fuera de los 7, `lat`/`lng` obligatorios. Incluye `climate` (ERA5-Land) |
| `get_ground_motion` | `GET /api/catastro/:ref/ground-motion?lat=&lng=` | Igual que terrain (el backend usa `terrainLocation` en los dos) |
| `get_agriculture` | `GET /api/catastro/:ref/agro` | ES, PV, NA, PT, FR, IT, DE |
| `get_market_data` | `GET /api/catastro/:ref/market` | Cifras: FR (DVF), IT (OMI), DE (BORIS, solo NRW). ES/PV/NA/PT: nota sin cifras |
| `get_investment_score` | `GET /api/catastro/:ref/score` | ES, PV, NA, PT, FR, IT, DE |
| `get_value_history` | `GET /api/catastro/:ref/value-history` | ES, PV, NA, PT, FR, IT, DE, AT (donde `GetByRefcat` graba) |
| `compare_parcels` | `POST /api/catastro/compare` `{parcelas:[{ref_catastral,country}]}` | ES, PT, FR, IT, DE (PV/NA caen al Catastro común y fallan) |

Cuota: el cliente lee de cada respuesta `X-Quota-*` (mensual), `X-Quota-Overage`/`-Balance`/`-Overage-Unit-Price`/
`-Overage-Remaining` (saldo prepagado), `X-RateLimit-*` (ráfaga por minuto) y `X-Quota-Finca-Cap*` (tope por finca en
`/units`), y cada tool devuelve un objeto `quota` de ESA respuesta (no del `lastQuota` compartido). Sin saldo la API
responde `429 KEY_AUTH_004`; no existe 402.

Las siete rutas de enriquecimiento van por `RegisterApiProRoutes` (`apiKeyMiddleware,
optionalAuthMiddleware, proOrApiKey`): entran con API key de organización (consume cuota, también
en los "no encontrado") o con JWT Pro. Desde el backend de sep-2026; antes `market`, `score`,
`value-history` y `compare` iban por `RegisterProRoutes` y con API key daban 401.

Coordenadas: siempre `GET /api/search/coordinates`. El `POST` antiguo solo despacha 8 países y
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
