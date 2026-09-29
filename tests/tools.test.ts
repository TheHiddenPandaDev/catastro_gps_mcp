import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SUPPORTED_COUNTRIES } from "../src/types/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";

describe("MCP tools", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = installFetchMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
    client = await connectClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes exactly the tools that work with an API key", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "compare_parcels",
      "get_agriculture",
      "get_boundaries",
      "get_investment_score",
      "get_market_data",
      "get_parcel",
      "get_solar_potential",
      "get_value_history",
      "search_address",
    ]);
  });

  it("advertises all 31 country codes on get_parcel", async () => {
    const { tools } = await client.listTools();
    const getParcel = tools.find((t) => t.name === "get_parcel")!;
    const country = (getParcel.inputSchema.properties as Record<string, { enum: string[] }>).country;

    expect(SUPPORTED_COUNTRIES).toHaveLength(31);
    expect(country.enum).toEqual([...SUPPORTED_COUNTRIES]);
    expect(getParcel.description).toContain("31 codes");
  });

  it("keeps the United Kingdom out of reference-based tools", async () => {
    const { tools } = await client.listTools();
    const boundaries = tools.find((t) => t.name === "get_boundaries")!;
    const country = (boundaries.inputSchema.properties as Record<string, { enum: string[] }>).country;

    expect(country.enum).toHaveLength(30);
    expect(country.enum).not.toContain("UK");
  });

  describe("get_parcel", () => {
    it("maps a reference lookup, outline included", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          refCatastral: "9872023VH5797S0001WX",
          pais: "ES",
          direccion: "CL MAYOR 1",
          municipio: "MADRID",
          provincia: "MADRID",
          latitud: 40.4165,
          longitud: -3.7038,
          superficieParcela: 512,
          uso: "Residencial",
          anioConstruccion: 1901,
          googleMapsUrl: "https://maps.google.com/?q=40.4165,-3.7038",
          poligono: [[40.1, -3.1], [40.2, -3.2], [40.1, -3.1]],
        },
      }));

      const result = await client.callTool({ name: "get_parcel", arguments: { reference: "9872023VH5797S0001WX" } });
      const body = toolJson(result);

      expect(result.isError).toBeFalsy();
      expect(body).toMatchObject({
        reference: "9872023VH5797S0001WX",
        country: "ES",
        municipality: "MADRID",
        area_m2: 512,
        construction_year: 1901,
      });
      expect(body.outline_lat_lng).toHaveLength(3);
      expect(body).not.toHaveProperty("built_area_m2");
    });

    it("passes the country hint through for foral cadastres", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { refCatastral: "X", latitud: 42.8, longitud: -1.6 } }));
      await client.callTool({ name: "get_parcel", arguments: { reference: "X", country: "NA" } });

      expect(lastRequest(fetchMock).url.searchParams.get("country")).toBe("NA");
    });

    it("maps a coordinate lookup outside Spain", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          referenciaCatastral: "146510_8.0502.1",
          pais: "PL",
          municipio: "Warszawa",
          coordenadas: { latitud: 52.23, longitud: 21.012 },
          googleMapsUrl: "https://maps.google.com/?q=52.23,21.012",
        },
      }));

      const result = await client.callTool({ name: "get_parcel", arguments: { latitude: 52.23, longitude: 21.012 } });

      expect(toolJson(result)).toMatchObject({ reference: "146510_8.0502.1", country: "PL", latitude: 52.23 });
      expect(lastRequest(fetchMock).url.pathname).toBe("/api/search/coordinates");
    });

    it("keeps a longitude of zero", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { referenciaCatastral: "R", coordenadas: { latitud: 51.48, longitud: 0 }, googleMapsUrl: "u" },
      }));

      const result = await client.callTool({ name: "get_parcel", arguments: { latitude: 51.48, longitude: 0, country: "UK" } });
      expect(toolJson(result).longitude).toBe(0);
    });

    it("asks for input when neither reference nor both coordinates are given", async () => {
      const result = await client.callTool({ name: "get_parcel", arguments: { latitude: 40 } });

      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("MCP_001");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses UK references before spending a call", async () => {
      const result = await client.callTool({ name: "get_parcel", arguments: { reference: "ABC", country: "UK" } });

      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("coordinates");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects unknown country codes at the schema", async () => {
      const result = await client.callTool({ name: "get_parcel", arguments: { reference: "X", country: "US" } });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("hands ambiguity candidates back to the agent", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: false,
        code: "CNV_AMBIGUOUS",
        error: "Esta referencia podría ser de varios países",
        data: { reference: "05102200100005", candidates: [{ country: "DE" }, { country: "PT" }] },
      }, 300));

      const result = await client.callTool({ name: "get_parcel", arguments: { reference: "05102200100005" } });
      const text = toolText(result);

      expect(result.isError).toBe(true);
      expect(text).toContain("CNV_AMBIGUOUS");
      expect(text).toContain("\"country\": \"PT\"");
    });
  });

  describe("search_address", () => {
    it("returns the reference and the parsed address", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          referenciaCatastral: "0485206DF3808E0016EZ",
          refCat14: "0485206DF3808E",
          direccion: "CL MALLORCA 213, BARCELONA",
          provincia: "BARCELONA",
          municipio: "BARCELONA",
          tipoVia: "CL",
          nombreVia: "MALLORCA",
          numero: 213,
        },
      }));

      const result = await client.callTool({ name: "search_address", arguments: { address: "Calle Mallorca 213, Barcelona" } });

      expect(toolJson(result)).toMatchObject({
        reference: "0485206DF3808E0016EZ",
        parcel_reference: "0485206DF3808E",
        country: "ES",
        street: "MALLORCA",
        number: 213,
        municipality: "BARCELONA",
      });
      expect(lastRequest(fetchMock).body).toEqual({ direccion: "Calle Mallorca 213, Barcelona" });
    });

    it("explains a miss and shows what was understood", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: false,
        error: "No se pudo determinar la provincia. Añade el código postal o el nombre de la provincia.",
        parsed: { NombreVia: "MAYOR", Numero: 1 },
      }, 404));

      const result = await client.callTool({ name: "search_address", arguments: { address: "Calle Mayor 1" } });

      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("provincia");
      expect(toolText(result)).toContain("MAYOR");
    });

    it("rejects empty input without calling the API", async () => {
      const result = await client.callTool({ name: "search_address", arguments: { address: "" } });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_boundaries", () => {
    it("normalises the Spanish GeoJSON shape", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          refcat: "9872023VH5797S",
          geojson: { type: "Feature", geometry: { type: "Polygon", coordinates: [] } },
          centroid: { latitude: 40.41, longitude: -3.7 },
          area: 512,
        },
      }));

      const body = toolJson(await client.callTool({ name: "get_boundaries", arguments: { reference: "9872023VH5797S" } }));
      expect(body).toMatchObject({ reference: "9872023VH5797S", latitude: 40.41, longitude: -3.7, area_m2: 512 });
      expect(body.geojson).toBeDefined();
    });

    it("normalises the ring shape used by the other countries", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { refCatastral: "CZ1", pais: "CZ", latitud: 50.08, longitud: 14.42, superficieParcela: 300, poligono: [[50, 14]] },
      }));

      const body = toolJson(await client.callTool({ name: "get_boundaries", arguments: { reference: "CZ1", country: "CZ" } }));
      expect(body).toMatchObject({ reference: "CZ1", country: "CZ", area_m2: 300, outline_lat_lng: [[50, 14]] });
    });
  });

  describe("get_solar_potential", () => {
    it("translates the PVGIS estimate to English keys", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          kwh_year: 7200,
          kw_instalables: 5,
          ahorro_anual_eur: 900,
          amortizacion_anos: 7.5,
          co2_evitado_kg: 2100,
          irradiacion_media: 5.1,
          nota_solar: 8,
          orientacion_optima: "Sur",
          angulo_inclinacion: 33,
          disponible: true,
          estado: "ok",
          fuente: "PVGIS",
        },
      }));

      const body = toolJson(await client.callTool({ name: "get_solar_potential", arguments: { reference: "R", country: "ES" } }));
      expect(body).toMatchObject({
        available: true,
        installable_kwp: 5,
        production_kwh_year: 7200,
        payback_years: 7.5,
        optimal_tilt_deg: 33,
      });
    });

    it("only accepts the countries the solar endpoint supports", async () => {
      const result = await client.callTool({ name: "get_solar_potential", arguments: { reference: "R", country: "PL" } });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_agriculture", () => {
    it("unwraps the agro envelope the API returns", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { agro: { uso_suelo: "TA", cultivo_principal: "Cebada", ndvi: { valor_medio: 0.61 } } },
      }));

      const body = toolJson(await client.callTool({ name: "get_agriculture", arguments: { reference: "R", country: "ES" } }));
      expect(body.agriculture).toMatchObject({ uso_suelo: "TA", cultivo_principal: "Cebada" });
    });
  });

  describe("get_market_data", () => {
    it("returns aggregated figures and drops individual sales", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          precio_estimado_eur: 250000,
          precio_m2_eur: 3100,
          num_transacciones: 4,
          fecha_ultima_transaccion: "2025-06-01",
          granularidad: "parcelle",
          fuente: "DVF",
          transacciones_historial: [{ valeur_fonciere: 180000, adresse: "1 RUE X" }],
          disponible: true,
          estado: "ok",
          data_quality: "real",
        },
      }));

      const result = await client.callTool({ name: "get_market_data", arguments: { reference: "75056000AB0001", country: "FR" } });
      const body = toolJson(result);
      const req = lastRequest(fetchMock);

      expect(req.method).toBe("GET");
      expect(req.url.pathname).toBe("/api/catastro/75056000AB0001/market");
      expect(req.url.searchParams.get("country")).toBe("FR");
      expect(body).toMatchObject({ available: true, has_price_figures: true, price_per_m2_eur: 3100, sales_count: 4, source: "DVF" });
      expect(toolText(result)).not.toContain("valeur_fonciere");
      expect(toolText(result)).not.toContain("1 RUE X");
    });

    it("says plainly when a country has no price figures", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { disponible: true, estado: "referencia", fuente: "Registradores de la Propiedad", mensaje_usuario: "Datos agregados por zona." },
      }));

      const body = toolJson(await client.callTool({ name: "get_market_data", arguments: { reference: "9872023VH5797S", country: "ES" } }));
      expect(body).toMatchObject({ has_price_figures: false, price_per_m2_eur: null, note: "Datos agregados por zona." });
    });

    it("rejects countries the market endpoint does not cover", async () => {
      const result = await client.callTool({ name: "get_market_data", arguments: { reference: "R", country: "PL" } });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_investment_score", () => {
    it("returns the score and qualitative factors, never the component numbers", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          score_inversion: {
            puntuacion: 72.5,
            clasificacion: "bueno",
            recomendacion: "Buen potencial de inversión.",
            componentes: { viabilidad_solar: 8.1, potencial_agricola: 5.5, valor_mercado: 2.3, demanda_terreno: 0, estabilidad_politica: 0 },
            factores_riesgo: ["Sin datos de mercado inmobiliario"],
            factores_oportunidad: ["Buena irradiación solar"],
          },
        },
      }));

      const result = await client.callTool({ name: "get_investment_score", arguments: { reference: "9872023VH5797S", country: "ES" } });
      const body = toolJson(result);

      expect(lastRequest(fetchMock).url.pathname).toBe("/api/catastro/9872023VH5797S/score");
      expect(body).toMatchObject({
        score: 72.5,
        rating: "bueno",
        factors: { solar: "high", agriculture: "medium", market: "low", accessibility: "not_available", risk: "not_available" },
        risk_factors: ["Sin datos de mercado inmobiliario"],
      });
      expect(toolText(result)).not.toContain("8.1");
      expect(toolText(result)).not.toContain("componentes");
    });
  });

  describe("get_value_history", () => {
    it("maps snapshots and hides the unrecorded cadastral value", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          refcat: "9872023VH5797S",
          country: "ES",
          entries: [
            { fecha_captura: "2026-09-01", superficie: 520, uso: "Residencial", valor_catastral: 0, fuente: "catastro_api" },
            { fecha_captura: "2026-06-01", superficie: 512, uso: "Residencial", valor_catastral: 0, fuente: "catastro_api" },
          ],
          totalEntries: 2,
          variacionPct: 1.5625,
        },
      }));

      const body = toolJson(await client.callTool({ name: "get_value_history", arguments: { reference: "9872023VH5797S", country: "ES" } }));

      expect(lastRequest(fetchMock).url.pathname).toBe("/api/catastro/9872023VH5797S/value-history");
      expect(body).toMatchObject({ reference: "9872023VH5797S", country: "ES", total: 2, change_pct: 1.5625 });
      expect((body.snapshots as unknown[])[0]).toEqual({
        date: "2026-09-01", area_m2: 520, land_use: "Residencial", cadastral_value_eur: null, source: "catastro_api",
      });
    });

    it("returns an empty list for a parcel nobody looked up yet", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { refcat: "R", country: "AT", entries: null, totalEntries: 0, variacionPct: null },
      }));

      const body = toolJson(await client.callTool({ name: "get_value_history", arguments: { reference: "R", country: "AT" } }));
      expect(body).toMatchObject({ snapshots: [], total: 0, change_pct: null });
    });
  });

  describe("compare_parcels", () => {
    it("posts the parcels and summarises each result", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          total: 2,
          comparacion: [
            {
              ref_catastral: "9872023VH5797S",
              country: "ES",
              parcela: { latitud: 40.41, longitud: -3.7, superficieParcela: 512, uso: "Residencial", municipio: "MADRID" },
              solar: { disponible: true, kwh_year: 7200, kw_instalables: 5, nota_solar: 4 },
              agro: { disponible: true, es_agricola: false },
              score: { score_global: 64, clasificacion: "bueno", disponible: true, componentes: { solar: { score: 80, peso: 0.2 } } },
            },
            { ref_catastral: "NOPE", country: "FR", error: "Parcel not found." },
          ],
        },
      }));

      const result = await client.callTool({
        name: "compare_parcels",
        arguments: { parcels: [{ reference: "9872023VH5797S", country: "ES" }, { reference: "NOPE", country: "FR" }] },
      });
      const body = toolJson(result);
      const req = lastRequest(fetchMock);

      expect(req.method).toBe("POST");
      expect(req.url.pathname).toBe("/api/catastro/compare");
      expect(body.total).toBe(2);
      expect((body.parcels as unknown[])[0]).toMatchObject({
        reference: "9872023VH5797S",
        area_m2: 512,
        solar: { production_kwh_year: 7200 },
        agriculture: { is_agricultural: false },
        score: { value: 64, rating: "bueno" },
      });
      expect((body.parcels as unknown[])[1]).toEqual({ reference: "NOPE", country: "FR", error: "Parcel not found." });
      expect(toolText(result)).not.toContain("peso");
    });

    it("refuses the Basque Country and Navarre before spending a call", async () => {
      const result = await client.callTool({
        name: "compare_parcels",
        arguments: { parcels: [{ reference: "A", country: "ES" }, { reference: "B", country: "PV" }] },
      });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("needs at least two parcels", async () => {
      const result = await client.callTool({ name: "compare_parcels", arguments: { parcels: [{ reference: "A", country: "ES" }] } });

      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("explains a rejected key on the reopened tools", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "UNAUTHORIZED", error: "No autorizado" }, 401));

    const result = await client.callTool({ name: "get_investment_score", arguments: { reference: "R", country: "FR" } });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("catastrogps.es/developers");
  });

  it("turns quota exhaustion into an upgrade hint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_004", error: "Cuota mensual agotada (100/100)" }, 429));

    const result = await client.callTool({ name: "get_parcel", arguments: { reference: "R" } });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("catastrogps.es/developers");
  });
});
