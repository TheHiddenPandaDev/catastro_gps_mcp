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
      get-parcel.ts            → Tool: datos básicos de parcela
      get-solar.ts             → Tool: potencial solar
      get-agriculture.ts       → Tool: datos agrícolas
      get-market.ts            → Tool: datos de mercado
      get-score.ts             → Tool: score de inversión
      get-value-history.ts     → Tool: historial de valor
      compare-parcels.ts       → Tool: comparar parcelas
      shared.ts                → Utilidades compartidas entre tools
    types/
      index.ts                 → Tipos TypeScript
  build/                       → Salida compilada
  tests/                       → Tests
  package.json
  tsconfig.json
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js + TypeScript |
| SDK | `@anthropic-ai/mcp-sdk` |
| Transporte | stdio (local) + SSE/HTTP (remoto) |
| Cliente HTTP | Fetch nativo |
| Auth | API key en header `X-API-Key` |

## Tools disponibles

| Tool | Descripción |
|------|------------|
| `get_parcel` | Datos básicos de parcela por referencia catastral |
| `get_solar_potential` | Potencial solar (orientación, irradiancia, estimación kWh) |
| `get_agriculture` | Datos agrícolas (cultivo, SIGPAC, clima, suelo) |
| `get_market_data` | Datos de mercado (precio €/m², tendencia, comparables) |
| `get_investment_score` | Score cualitativo de inversión (factores, no fórmula) |
| `get_value_history` | Historial de valor catastral |
| `compare_parcels` | Comparar hasta 5 parcelas lado a lado |

## Países soportados

ES (España), PV (País Vasco), NA (Navarra), PT (Portugal), FR (Francia), IT (Italia), DE (Alemania — solo NRW).

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
