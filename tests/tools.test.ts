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
      "get_agriculture",
      "get_boundaries",
      "get_parcel",
      "get_solar_potential",
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

  it("turns quota exhaustion into an upgrade hint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_004", error: "Cuota mensual agotada (100/100)" }, 429));

    const result = await client.callTool({ name: "get_parcel", arguments: { reference: "R" } });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("catastrogps.es/developers");
  });
});
