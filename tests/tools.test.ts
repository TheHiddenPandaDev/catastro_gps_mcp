import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatastroGPSClient, CatastroGPSApiError } from "../src/client/catastrogps-api.js";
import type {
  ParcelResponse,
  SolarResponse,
  AgroResponse,
  MarketResponse,
  ScoreResponse,
  ValueHistoryResponse,
  CompareResponse,
} from "../src/types/index.js";

// Test RefCats from docs/15-COUNTRY-LAUNCH.md
const TEST_REFCATS = {
  ES_MADRID: "9872323VK2897S0001WX",
  ES_BARCELONA: "0485206DF3808E0016EZ",
  PT: "U0512N0003200",
  FR: "750560000AB0001",
  IT: "A0420001",
  DE: "05315000200001",
} as const;

const TEST_CONFIG = {
  apiKey: "pk_test_xxx",
  apiUrl: "https://api.catastrogps.es",
  timeout: 10000,
};

// Mock fetch globally
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

describe("CatastroGPSClient", () => {
  let client: CatastroGPSClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CatastroGPSClient(TEST_CONFIG);
  });

  describe("getParcelByReference", () => {
    it("should fetch ES parcel by reference (Madrid)", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.ES_MADRID,
        latitud: 40.41650,
        longitud: -3.70381,
        direccion: "CALLE MAYOR 1",
        municipio: "MADRID",
        provincia: "MADRID",
        superficie_m2: 89.5,
        uso_catastral: "Residencial",
        anyo_construccion: 1985,
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES");

      expect(result.referencia_catastral).toBe(TEST_REFCATS.ES_MADRID);
      expect(result.latitud).toBe(40.41650);
      expect(result.longitud).toBe(-3.70381);
      expect(result.superficie_m2).toBe(89.5);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("/convert");
      expect(callUrl).toContain("country=ES");
      expect(callUrl).toContain(encodeURIComponent(TEST_REFCATS.ES_MADRID));
    });

    it("should fetch FR parcel by reference (Paris)", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.FR,
        latitud: 48.8566,
        longitud: 2.3522,
        direccion: "RUE DE RIVOLI",
        municipio: "PARIS",
        provincia: "PARIS",
        superficie_m2: 1234,
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByReference(TEST_REFCATS.FR, "FR");

      expect(result.referencia_catastral).toBe(TEST_REFCATS.FR);
      expect(result.latitud).toBe(48.8566);
    });

    it("should fetch PT parcel by reference", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.PT,
        latitud: 38.7223,
        longitud: -9.1393,
        municipio: "LISBOA",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByReference(TEST_REFCATS.PT, "PT");
      expect(result.referencia_catastral).toBe(TEST_REFCATS.PT);
    });

    it("should fetch IT parcel by reference", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.IT,
        latitud: 41.9028,
        longitud: 12.4964,
        municipio: "ROMA",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByReference(TEST_REFCATS.IT, "IT");
      expect(result.referencia_catastral).toBe(TEST_REFCATS.IT);
    });

    it("should fetch DE parcel by reference (NRW)", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.DE,
        latitud: 51.4556,
        longitud: 7.0116,
        municipio: "ESSEN",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByReference(TEST_REFCATS.DE, "DE");
      expect(result.referencia_catastral).toBe(TEST_REFCATS.DE);
    });
  });

  describe("getParcelByCoordinates", () => {
    it("should fetch parcel by GPS coordinates", async () => {
      const mockData: ParcelResponse = {
        referencia_catastral: TEST_REFCATS.ES_MADRID,
        latitud: 40.41650,
        longitud: -3.70381,
        municipio: "MADRID",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getParcelByCoordinates(40.41650, -3.70381, "ES");
      expect(result.referencia_catastral).toBe(TEST_REFCATS.ES_MADRID);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("lat=40.4165");
      expect(callUrl).toContain("lng=-3.70381");
    });
  });

  describe("getSolarPotential", () => {
    it("should fetch solar data for ES parcel", async () => {
      const mockData: SolarResponse = {
        reference: TEST_REFCATS.ES_MADRID,
        annual_radiation_kwh_m2: 1650.5,
        optimal_angle_deg: 35,
        estimated_production_kwh_year: 4800,
        monthly_radiation: [85, 105, 140, 165, 195, 210, 220, 200, 170, 130, 90, 75],
        data_source: "PVGIS (JRC European Commission)",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getSolarPotential(TEST_REFCATS.ES_MADRID, "ES");

      expect(result.annual_radiation_kwh_m2).toBe(1650.5);
      expect(result.monthly_radiation).toHaveLength(12);
      expect(result.data_source).toContain("PVGIS");
    });
  });

  describe("getAgriculture", () => {
    it("should fetch agro data for ES parcel", async () => {
      const mockData: AgroResponse = {
        reference: TEST_REFCATS.ES_MADRID,
        land_use: { code: "TA", description: "Tierras arables", source: "SIGPAC" },
        ndvi: { current: 0.65, trend: "stable", data_quality: "simulated" },
        crop_prices: [
          { crop: "Trigo blando", price_eur_ton: 215.0, source: "MAPA" },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getAgriculture(TEST_REFCATS.ES_MADRID, "ES");

      expect(result.land_use.source).toBe("SIGPAC");
      expect(result.ndvi.current).toBeGreaterThan(0);
    });
  });

  describe("getMarketData", () => {
    it("should fetch market data for FR parcel (DVF)", async () => {
      const mockData: MarketResponse = {
        reference: TEST_REFCATS.FR,
        country: "FR",
        granularity: "parcela",
        transactions: [
          {
            date: "2025-06-15",
            price_eur: 320000,
            area_m2: 85,
            price_per_m2: 3764.71,
            type: "Appartement",
          },
        ],
        zone_average_price_m2: 3500.0,
        data_source: "DVF (data.gouv.fr)",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getMarketData(TEST_REFCATS.FR, "FR");

      expect(result.granularity).toBe("parcela");
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.data_source).toContain("DVF");
    });
  });

  describe("getInvestmentScore", () => {
    it("should fetch score for ES parcel", async () => {
      const mockData: ScoreResponse = {
        reference: TEST_REFCATS.ES_MADRID,
        score: 7.2,
        rating: "Buena inversión",
        factors: {
          location: "high",
          solar_potential: "high",
          market_trend: "stable",
          agricultural_value: "medium",
          data_completeness: "high",
        },
        data_quality: "Score based on available data.",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getInvestmentScore(TEST_REFCATS.ES_MADRID, "ES");

      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
      expect(result.rating).toBeDefined();
      // Score should NOT expose formula weights
      expect(result).not.toHaveProperty("weights");
      expect(result).not.toHaveProperty("formula");
    });
  });

  describe("getValueHistory", () => {
    it("should fetch value history for ES parcel", async () => {
      const mockData: ValueHistoryResponse = {
        reference: TEST_REFCATS.ES_MADRID,
        history: [
          { date: "2026-03-01", cadastral_value: 85000, area_m2: 89.5, use: "Residencial" },
          { date: "2026-01-15", cadastral_value: 84500, area_m2: 89.5, use: "Residencial" },
        ],
        note: "El histórico crece con el tiempo.",
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.getValueHistory(TEST_REFCATS.ES_MADRID, "ES");

      expect(result.history.length).toBeGreaterThan(0);
      expect(result.history[0].cadastral_value).toBeGreaterThan(0);
    });
  });

  describe("compareParcels", () => {
    it("should compare 2 parcels from different countries", async () => {
      const mockData: CompareResponse = {
        parcels: [
          {
            reference: TEST_REFCATS.ES_MADRID,
            country: "ES",
            latitude: 40.41650,
            longitude: -3.70381,
            area_m2: 89.5,
            score: 7.2,
          },
          {
            reference: TEST_REFCATS.FR,
            country: "FR",
            latitude: 48.8566,
            longitude: 2.3522,
            area_m2: 1234,
            score: 6.8,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await client.compareParcels([
        { reference: TEST_REFCATS.ES_MADRID, country: "ES" },
        { reference: TEST_REFCATS.FR, country: "FR" },
      ]);

      expect(result.parcels).toHaveLength(2);

      // Verify POST was used
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("error handling", () => {
    it("should throw CatastroGPSApiError on 404", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "not_found", message: "Parcel not found" }, 404),
      );

      await expect(
        client.getParcelByReference("INVALID_REF", "ES"),
      ).rejects.toThrow(CatastroGPSApiError);

      try {
        mockFetch.mockResolvedValueOnce(
          mockResponse({ error: "not_found", message: "Parcel not found" }, 404),
        );
        await client.getParcelByReference("INVALID_REF", "ES");
      } catch (error) {
        expect(error).toBeInstanceOf(CatastroGPSApiError);
        expect((error as CatastroGPSApiError).code).toBe("not_found");
        expect((error as CatastroGPSApiError).status).toBe(404);
      }
    });

    it("should throw CatastroGPSApiError on 401 (invalid API key)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "unauthorized", message: "Invalid API key" }, 401),
      );

      await expect(
        client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES"),
      ).rejects.toThrow(CatastroGPSApiError);
    });

    it("should throw CatastroGPSApiError on 429 (quota exceeded)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(
          { error: "daily_limit_reached", message: "Daily limit reached" },
          429,
        ),
      );

      await expect(
        client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES"),
      ).rejects.toThrow(CatastroGPSApiError);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(
        client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES"),
      ).rejects.toThrow(CatastroGPSApiError);
    });

    it("should handle timeout", async () => {
      mockFetch.mockImplementationOnce(
        () => new Promise((_, reject) => {
          const error = new Error("AbortError");
          error.name = "AbortError";
          setTimeout(() => reject(error), 50);
        }),
      );

      await expect(
        client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES"),
      ).rejects.toThrow(CatastroGPSApiError);
    });
  });

  describe("API key authentication", () => {
    it("should send X-API-Key header on every request", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          referencia_catastral: TEST_REFCATS.ES_MADRID,
          latitud: 40.0,
          longitud: -3.0,
        }),
      );

      await client.getParcelByReference(TEST_REFCATS.ES_MADRID, "ES");

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers["X-API-Key"]).toBe("pk_test_xxx");
      expect(headers["User-Agent"]).toBe("catastrogps-mcp/1.0.0");
    });
  });
});
