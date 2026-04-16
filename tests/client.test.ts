import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatastroGPSClient, CatastroGPSApiError } from "../src/client/catastrogps-api.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? "OK" : "Error",
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

const TEST_CONFIG = {
  apiKey: "pk_test_client123",
  apiUrl: "https://api.catastrogps.es",
  timeout: 10000,
};

describe("CatastroGPSClient", () => {
  let client: CatastroGPSClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CatastroGPSClient(TEST_CONFIG);
  });

  describe("constructor", () => {
    it("should store config correctly", async () => {
      // Verify by making a request and checking the headers/URL
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("https://api.catastrogps.es");

      const options = mockFetch.mock.calls[0][1];
      expect(options.headers["X-API-Key"]).toBe("pk_test_client123");
    });

    it("should strip trailing slash from apiUrl", async () => {
      const clientWithSlash = new CatastroGPSClient({
        apiKey: "pk_test_xxx",
        apiUrl: "https://api.catastrogps.es/",
        timeout: 5000,
      });

      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await clientWithSlash.getParcelByReference("REF", "ES");

      const callUrl = mockFetch.mock.calls[0][0] as string;
      // Should not have double slashes
      expect(callUrl).not.toContain("es//convert");
    });
  });

  describe("request() headers", () => {
    it("should send X-API-Key header", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["X-API-Key"]).toBe("pk_test_client123");
    });

    it("should send User-Agent header", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["User-Agent"]).toBe("catastrogps-mcp/1.0.0");
    });

    it("should send Accept: application/json header", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Accept"]).toBe("application/json");
    });

    it("should use GET method for request()", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      expect(mockFetch.mock.calls[0][1].method).toBe("GET");
    });
  });

  describe("request() error handling", () => {
    it("should handle timeout via AbortController", async () => {
      mockFetch.mockImplementationOnce(() => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      await expect(
        client.getParcelByReference("REF", "ES"),
      ).rejects.toThrow(CatastroGPSApiError);

      try {
        mockFetch.mockImplementationOnce(() => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          return Promise.reject(error);
        });
        await client.getParcelByReference("REF", "ES");
      } catch (e) {
        const err = e as CatastroGPSApiError;
        expect(err.code).toBe("MCP_TIMEOUT");
        expect(err.status).toBe(408);
      }
    });

    it("should handle network errors (ECONNREFUSED)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(
        client.getParcelByReference("REF", "ES"),
      ).rejects.toThrow(CatastroGPSApiError);

      try {
        mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        await client.getParcelByReference("REF", "ES");
      } catch (e) {
        const err = e as CatastroGPSApiError;
        expect(err.code).toBe("MCP_NETWORK");
        expect(err.status).toBe(0);
        expect(err.message).toContain("ECONNREFUSED");
      }
    });

    it("should handle non-Error thrown values as network errors", async () => {
      mockFetch.mockRejectedValueOnce("string rejection");

      await expect(
        client.getParcelByReference("REF", "ES"),
      ).rejects.toThrow(CatastroGPSApiError);
    });

    it("should pass AbortController signal to fetch", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ referencia_catastral: "X", latitud: 0, longitud: 0 }),
      );

      await client.getParcelByReference("REF", "ES");

      const options = mockFetch.mock.calls[0][1];
      expect(options.signal).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("post() method", () => {
    it("should use POST method", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ parcels: [] }),
      );

      await client.compareParcels([
        { reference: "REF1", country: "ES" },
        { reference: "REF2", country: "FR" },
      ]);

      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("should send Content-Type: application/json for POST", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ parcels: [] }),
      );

      await client.compareParcels([
        { reference: "REF1", country: "ES" },
        { reference: "REF2", country: "FR" },
      ]);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should send JSON body for POST", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ parcels: [] }),
      );

      const parcels = [
        { reference: "REF1", country: "ES" },
        { reference: "REF2", country: "FR" },
      ];

      await client.compareParcels(parcels);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ parcels });
    });

    it("should handle POST errors the same as GET errors", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "not_found", message: "Parcel not found" }, 404),
      );

      await expect(
        client.compareParcels([
          { reference: "INVALID", country: "ES" },
          { reference: "INVALID2", country: "ES" },
        ]),
      ).rejects.toThrow(CatastroGPSApiError);
    });
  });

  describe("CatastroGPSApiError.fromResponse()", () => {
    it("should parse error response with all fields", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(
          { error: "not_found", message: "Parcel not found in ES cadastre" },
          404,
        ),
      );

      try {
        await client.getParcelByReference("INVALID", "ES");
      } catch (e) {
        const err = e as CatastroGPSApiError;
        expect(err).toBeInstanceOf(CatastroGPSApiError);
        expect(err.code).toBe("not_found");
        expect(err.message).toBe("Parcel not found in ES cadastre");
        expect(err.status).toBe(404);
        expect(err.name).toBe("CatastroGPSApiError");
      }
    });

    it("should handle response with missing error field", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({}, 500),
      );

      try {
        await client.getParcelByReference("REF", "ES");
      } catch (e) {
        const err = e as CatastroGPSApiError;
        expect(err.code).toBe("HTTP_500");
        expect(err.message).toBe("API returned 500");
        expect(err.status).toBe(500);
      }
    });

    it("should handle response with unparseable JSON body", async () => {
      // Create a response where json() throws
      const badResponse = {
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("invalid json")),
        headers: new Headers(),
        redirected: false,
        statusText: "Bad Gateway",
        type: "basic",
        url: "",
        clone: () => badResponse,
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve("not json"),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response;

      mockFetch.mockResolvedValueOnce(badResponse);

      try {
        await client.getParcelByReference("REF", "ES");
      } catch (e) {
        const err = e as CatastroGPSApiError;
        // Falls back to HTTP_{status} when JSON parsing fails
        expect(err.code).toBe("HTTP_502");
        expect(err.status).toBe(502);
      }
    });
  });

  describe("URL building for each public method", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(
        mockResponse({
          referencia_catastral: "X",
          latitud: 0,
          longitud: 0,
          reference: "X",
          annual_radiation_kwh_m2: 0,
          optimal_angle_deg: 0,
          estimated_production_kwh_year: 0,
          monthly_radiation: [],
          data_source: "",
          land_use: { code: "", description: "", source: "" },
          ndvi: { current: 0, trend: "", data_quality: "" },
          crop_prices: [],
          country: "ES",
          granularity: "",
          transactions: [],
          zone_average_price_m2: 0,
          score: 5,
          rating: "",
          factors: {},
          data_quality: "",
          history: [],
          note: "",
          parcels: [],
        }),
      );
    });

    it("getParcelByReference() builds /convert URL with reference and country", async () => {
      await client.getParcelByReference("9872323VK2897S0001WX", "ES");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/convert");
      expect(url).toContain("referencia_catastral=");
      expect(url).toContain("country=ES");
    });

    it("getParcelByCoordinates() builds /convert URL with lat/lng", async () => {
      await client.getParcelByCoordinates(40.4165, -3.7038, "ES");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/convert");
      expect(url).toContain("lat=40.4165");
      expect(url).toContain("lng=-3.7038");
      expect(url).toContain("country=ES");
    });

    it("getSolarPotential() builds correct URL with encoded reference", async () => {
      await client.getSolarPotential("9872323VK2897S0001WX", "ES");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/9872323VK2897S0001WX/solar");
      expect(url).toContain("country=ES");
    });

    it("getAgriculture() builds correct URL", async () => {
      await client.getAgriculture("9872323VK2897S0001WX", "PT");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/9872323VK2897S0001WX/agro");
      expect(url).toContain("country=PT");
    });

    it("getMarketData() builds correct URL", async () => {
      await client.getMarketData("750560000AB0001", "FR");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/750560000AB0001/mercado");
      expect(url).toContain("country=FR");
    });

    it("getInvestmentScore() builds correct URL", async () => {
      await client.getInvestmentScore("A0420001", "IT");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/A0420001/score");
      expect(url).toContain("country=IT");
    });

    it("getValueHistory() builds correct URL", async () => {
      await client.getValueHistory("05315000200001", "DE");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/05315000200001/historico-valor");
      expect(url).toContain("country=DE");
    });

    it("compareParcels() builds /api/catastro/comparar URL", async () => {
      await client.compareParcels([
        { reference: "REF1", country: "ES" },
        { reference: "REF2", country: "FR" },
      ]);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/comparar");
    });

    it("getSolarPotential() encodes special characters in reference", async () => {
      await client.getSolarPotential("REF/WITH SPACES", "ES");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/catastro/REF%2FWITH%20SPACES/solar");
    });
  });
});
