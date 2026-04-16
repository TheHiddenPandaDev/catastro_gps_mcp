import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatastroGPSClient, CatastroGPSApiError } from "../src/client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../src/types/index.js";
import type {
  ParcelResponse,
  SolarResponse,
  AgroResponse,
  ScoreResponse,
  CompareResponse,
} from "../src/types/index.js";

// We need to test the actual tool handler functions, so we import the register functions
// and capture the handlers by mocking McpServer.registerTool
import { registerGetParcel } from "../src/tools/get-parcel.js";
import { registerGetSolar } from "../src/tools/get-solar.js";
import { registerGetAgriculture } from "../src/tools/get-agriculture.js";
import { registerGetMarket } from "../src/tools/get-market.js";
import { registerGetScore } from "../src/tools/get-score.js";
import { registerGetValueHistory } from "../src/tools/get-value-history.js";
import { registerCompareParcels } from "../src/tools/compare-parcels.js";

// Suppress console.error from handleToolError logging
vi.spyOn(console, "error").mockImplementation(() => {});

// Mock fetch globally (needed by CatastroGPSClient)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic",
    url: "",
    clone: () => mockResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// Helper to capture tool handlers from registerTool calls
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function captureHandler(registerFn: (server: any, client: CatastroGPSClient) => void): ToolHandler {
  let handler: ToolHandler | undefined;
  const mockServer = {
    registerTool: (_name: string, _schema: unknown, fn: ToolHandler) => {
      handler = fn;
    },
  };
  const client = new CatastroGPSClient({
    apiKey: "pk_test_edge",
    apiUrl: "https://api.catastrogps.es",
    timeout: 10000,
  });
  registerFn(mockServer as any, client);
  return handler!;
}

describe("tool edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_parcel", () => {
    const handler = captureHandler(registerGetParcel);

    it("should return error when neither reference nor coordinates provided", async () => {
      const result = await handler({ country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("MCP_001");
      expect(result.content[0].text).toContain("reference");
    });

    it("should return error when only latitude provided (no longitude)", async () => {
      const result = await handler({ latitude: 40.0, country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("MCP_001");
    });

    it("should return error when only longitude provided (no latitude)", async () => {
      const result = await handler({ longitude: -3.0, country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("MCP_001");
    });

    it("should prioritize reference over coordinates when both provided", async () => {
      const mockParcel: ParcelResponse = {
        referencia_catastral: "9872323VK2897S0001WX",
        latitud: 40.4165,
        longitud: -3.7038,
        municipio: "MADRID",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockParcel));

      const result = await handler({
        reference: "9872323VK2897S0001WX",
        latitude: 41.0,
        longitude: -4.0,
        country: "ES",
      });

      expect(result.isError).toBeUndefined();

      // Verify reference-based URL was called, not coordinate-based
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("referencia_catastral=");
      expect(callUrl).not.toContain("lat=41");
    });

    it("should work with each supported country code", async () => {
      for (const country of SUPPORTED_COUNTRIES) {
        mockFetch.mockResolvedValueOnce(
          mockResponse({
            referencia_catastral: `REF_${country}`,
            latitud: 40.0,
            longitud: -3.0,
            municipio: "TEST",
          }),
        );

        const result = await handler({ reference: `REF_${country}`, country });

        expect(result.isError).toBeUndefined();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.country).toBe(country);
      }
    });

    it("should include google_maps_url in output", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          referencia_catastral: "REF",
          latitud: 40.4165,
          longitud: -3.7038,
        }),
      );

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.google_maps_url).toBe("https://maps.google.com/?q=40.4165,-3.7038");
    });

    it("should handle API errors gracefully via handleToolError", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "not_found", message: "Parcel not found" }, 404),
      );

      const result = await handler({ reference: "INVALID", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not_found");
    });
  });

  describe("get_solar_potential", () => {
    const handler = captureHandler(registerGetSolar);

    it("should return solar data for valid request", async () => {
      const mockSolar: SolarResponse = {
        reference: "REF_ES",
        annual_radiation_kwh_m2: 1650,
        optimal_angle_deg: 35,
        estimated_production_kwh_year: 4800,
        monthly_radiation: [85, 105, 140, 165, 195, 210, 220, 200, 170, 130, 90, 75],
        data_source: "PVGIS (JRC European Commission)",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockSolar));

      const result = await handler({ reference: "REF_ES", country: "ES" });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.annual_radiation_kwh_m2).toBe(1650);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "pro_required", message: "Pro plan required" }, 403),
      );

      const result = await handler({ reference: "REF", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("pro_required");
    });
  });

  describe("get_agriculture", () => {
    const handler = captureHandler(registerGetAgriculture);

    it("should filter source field from crop_prices", async () => {
      const mockAgro: AgroResponse = {
        reference: "REF",
        land_use: { code: "TA", description: "Tierras arables", source: "SIGPAC" },
        ndvi: { current: 0.65, trend: "stable", data_quality: "simulated" },
        crop_prices: [
          { crop: "Trigo blando", price_eur_ton: 215.0, source: "MAPA" },
          { crop: "Cebada", price_eur_ton: 190.0, source: "MAPA" },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockAgro));

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      // crop_prices should NOT contain source field (filtered out)
      for (const price of parsed.crop_prices) {
        expect(price).not.toHaveProperty("source");
        expect(price).toHaveProperty("crop");
        expect(price).toHaveProperty("price_eur_ton");
      }
    });

    it("should filter code field from land_use (only description + source)", async () => {
      const mockAgro: AgroResponse = {
        reference: "REF",
        land_use: { code: "TA", description: "Tierras arables", source: "SIGPAC" },
        ndvi: { current: 0.65, trend: "stable", data_quality: "simulated" },
        crop_prices: [],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockAgro));

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      // land_use should have description and source but NOT code
      expect(parsed.land_use).not.toHaveProperty("code");
      expect(parsed.land_use.description).toBe("Tierras arables");
      expect(parsed.land_use.source).toBe("SIGPAC");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "catastro_unavailable", message: "Service down" }, 503),
      );

      const result = await handler({ reference: "REF", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("catastro_unavailable");
    });
  });

  describe("get_investment_score", () => {
    const handler = captureHandler(registerGetScore);

    it("should not expose weights or formula in output", async () => {
      const mockScore: ScoreResponse & { weights?: unknown; formula?: unknown } = {
        reference: "REF",
        score: 7.2,
        rating: "Buena inversion",
        factors: { location: "high", solar_potential: "medium" },
        data_quality: "good",
      };
      // Simulate backend accidentally including internal fields
      (mockScore as any).weights = { location: 0.3, solar: 0.2 };
      (mockScore as any).formula = "weighted_sum";

      mockFetch.mockResolvedValueOnce(mockResponse(mockScore));

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).not.toHaveProperty("weights");
      expect(parsed).not.toHaveProperty("formula");
      expect(parsed).not.toHaveProperty("data_quality");
      expect(parsed).toHaveProperty("note");
    });

    it("should include score, rating, and factors", async () => {
      const mockScore: ScoreResponse = {
        reference: "REF",
        score: 8.5,
        rating: "Excelente inversion",
        factors: { location: "high", solar_potential: "high", market_trend: "rising" },
        data_quality: "good",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockScore));

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.score).toBe(8.5);
      expect(parsed.rating).toBe("Excelente inversion");
      expect(parsed.factors.location).toBe("high");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "unauthorized", message: "Bad key" }, 401),
      );

      const result = await handler({ reference: "REF", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("unauthorized");
    });
  });

  describe("get_market_data", () => {
    const handler = captureHandler(registerGetMarket);

    it("should return market data as-is from API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          reference: "REF_FR",
          country: "FR",
          granularity: "parcela",
          transactions: [{ date: "2025-06-15", price_eur: 320000, area_m2: 85, price_per_m2: 3764, type: "Appartement" }],
          zone_average_price_m2: 3500,
          data_source: "DVF (data.gouv.fr)",
        }),
      );

      const result = await handler({ reference: "REF_FR", country: "FR" });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data_source).toContain("DVF");
      expect(parsed.transactions).toHaveLength(1);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "rate_limited", message: "Slow down" }, 429),
      );

      const result = await handler({ reference: "REF", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("rate_limited");
    });
  });

  describe("get_value_history", () => {
    const handler = captureHandler(registerGetValueHistory);

    it("should return value history as-is from API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          reference: "REF",
          history: [
            { date: "2026-03-01", cadastral_value: 85000, area_m2: 89.5, use: "Residencial" },
          ],
          note: "Test",
        }),
      );

      const result = await handler({ reference: "REF", country: "ES" });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.history).toHaveLength(1);
      expect(parsed.history[0].cadastral_value).toBe(85000);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "invalid_referencia", message: "Bad ref" }, 400),
      );

      const result = await handler({ reference: "BAD", country: "ES" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("invalid_referencia");
    });
  });

  describe("compare_parcels", () => {
    const handler = captureHandler(registerCompareParcels);

    it("should compare 2 parcels", async () => {
      const mockCompare: CompareResponse = {
        parcels: [
          { reference: "REF1", country: "ES", latitude: 40.0, longitude: -3.0, area_m2: 100, score: 7 },
          { reference: "REF2", country: "ES", latitude: 41.0, longitude: -4.0, area_m2: 200, score: 6 },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockCompare));

      const result = await handler({
        parcels: [
          { reference: "REF1", country: "ES" },
          { reference: "REF2", country: "ES" },
        ],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.parcels).toHaveLength(2);
    });

    it("should compare 3 parcels", async () => {
      const mockCompare: CompareResponse = {
        parcels: [
          { reference: "REF1", country: "ES", latitude: 40.0, longitude: -3.0 },
          { reference: "REF2", country: "FR", latitude: 48.0, longitude: 2.0 },
          { reference: "REF3", country: "PT", latitude: 38.0, longitude: -9.0 },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockCompare));

      const result = await handler({
        parcels: [
          { reference: "REF1", country: "ES" },
          { reference: "REF2", country: "FR" },
          { reference: "REF3", country: "PT" },
        ],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.parcels).toHaveLength(3);
    });

    it("should work with parcels from different countries", async () => {
      const mockCompare: CompareResponse = {
        parcels: [
          { reference: "REF_ES", country: "ES", latitude: 40.0, longitude: -3.0 },
          { reference: "REF_DE", country: "DE", latitude: 51.0, longitude: 7.0 },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockCompare));

      const result = await handler({
        parcels: [
          { reference: "REF_ES", country: "ES" },
          { reference: "REF_DE", country: "DE" },
        ],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.parcels[0].country).toBe("ES");
      expect(parsed.parcels[1].country).toBe("DE");
    });

    it("should use POST method for compareParcels", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ parcels: [] }));

      await handler({
        parcels: [
          { reference: "REF1", country: "ES" },
          { reference: "REF2", country: "FR" },
        ],
      });

      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "daily_limit_reached", message: "Limit reached" }, 429),
      );

      const result = await handler({
        parcels: [
          { reference: "REF1", country: "ES" },
          { reference: "REF2", country: "FR" },
        ],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("daily_limit_reached");
    });
  });

  describe("all tools: generic error handling", () => {
    it("should handle network errors across all tools", async () => {
      const tools = [
        { register: registerGetParcel, args: { reference: "REF", country: "ES" } },
        { register: registerGetSolar, args: { reference: "REF", country: "ES" } },
        { register: registerGetAgriculture, args: { reference: "REF", country: "ES" } },
        { register: registerGetMarket, args: { reference: "REF", country: "ES" } },
        { register: registerGetScore, args: { reference: "REF", country: "ES" } },
        { register: registerGetValueHistory, args: { reference: "REF", country: "ES" } },
        {
          register: registerCompareParcels,
          args: {
            parcels: [
              { reference: "REF1", country: "ES" },
              { reference: "REF2", country: "ES" },
            ],
          },
        },
      ];

      for (const { register, args } of tools) {
        const toolHandler = captureHandler(register);

        mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

        const result = await toolHandler(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe("text");
        // Should contain either a known error code or MCP_NETWORK
        expect(result.content[0].text).toBeTruthy();
      }
    });

    it("should handle timeout errors across all tools", async () => {
      const tools = [
        { register: registerGetParcel, args: { reference: "REF", country: "ES" } },
        { register: registerGetSolar, args: { reference: "REF", country: "ES" } },
        { register: registerGetAgriculture, args: { reference: "REF", country: "ES" } },
        { register: registerGetMarket, args: { reference: "REF", country: "ES" } },
        { register: registerGetScore, args: { reference: "REF", country: "ES" } },
        { register: registerGetValueHistory, args: { reference: "REF", country: "ES" } },
        {
          register: registerCompareParcels,
          args: {
            parcels: [
              { reference: "REF1", country: "ES" },
              { reference: "REF2", country: "ES" },
            ],
          },
        },
      ];

      for (const { register, args } of tools) {
        const toolHandler = captureHandler(register);

        mockFetch.mockImplementationOnce(() => {
          const error = new Error("AbortError");
          error.name = "AbortError";
          return Promise.reject(error);
        });

        const result = await toolHandler(args);

        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe("text");
      }
    });
  });
});
