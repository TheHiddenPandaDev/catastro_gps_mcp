import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";

const SUBPARCELS = {
  reference: "46063A00100121",
  country: "ES",
  parcelArea: 8814,
  count: 2,
  subparcels: [
    {
      id: "a", cropCode: "G-", crop: "Rainfed carob", cropOriginal: "Algarrobo secano", intensity: 1, area: 6623,
      kind: "cadastral", useClass: "orchard", source: "Catastro",
      geometry: { type: "MultiPolygon", coordinates: [[[[-0.56, 39.21], [-0.57, 39.21], [-0.56, 39.22], [-0.56, 39.21]]]] },
    },
    { id: "b", cropCode: "AT:53", crop: "Vineyards", cropOriginal: "Weingärten", area: 2191, kind: "cadastral" },
  ],
};

function withHeaders(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("tools added in 2.1", () => {
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

  describe("get_parcel_subparcels", () => {
    it("maps every subparcel without geometry by default", async () => {
      fetchMock.mockResolvedValueOnce(withHeaders({ success: true, data: SUBPARCELS }, 200, { "X-Quota-Remaining": "40" }));

      const body = toolJson(await client.callTool({
        name: "get_parcel_subparcels",
        arguments: { reference: "46063A00100121", lang: "en" },
      }));

      const req = lastRequest(fetchMock);
      expect(req.url.pathname).toBe("/v1/parcels/46063A00100121/subparcels");
      expect(req.url.searchParams.get("lang")).toBe("en");
      expect(req.url.searchParams.has("country")).toBe(false);
      expect(body).toMatchObject({
        reference: "46063A00100121",
        country: "ES",
        parcel_area_m2: 8814,
        count: 2,
        subparcels: [
          { id: "a", crop_code: "G-", crop: "Rainfed carob", crop_original: "Algarrobo secano", area_m2: 6623, kind: "cadastral", use_class: "orchard", intensity: 1 },
          { id: "b", crop_code: "AT:53", area_m2: 2191 },
        ],
        quota: { remaining: 40 },
      });
      expect((body.subparcels as Array<Record<string, unknown>>)[0].geometry).toBeUndefined();
    });

    it("includes geometry on request and passes the country", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: SUBPARCELS }));
      const body = toolJson(await client.callTool({
        name: "get_parcel_subparcels",
        arguments: { reference: "46063A00100121", country: "ES", include_geometry: true },
      }));
      expect(lastRequest(fetchMock).url.searchParams.get("country")).toBe("ES");
      expect((body.subparcels as Array<Record<string, unknown>>)[0].geometry).toMatchObject({ type: "MultiPolygon" });
    });

    it("answers an empty parcel as zero subparcels", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { reference: "X", count: 0, subparcels: null } }));
      const body = toolJson(await client.callTool({ name: "get_parcel_subparcels", arguments: { reference: "X" } }));
      expect(body).toMatchObject({ reference: "X", country: null, parcel_area_m2: null, count: 0, subparcels: [] });
    });

    it("explains SUB_001 as a retryable, uncharged failure", async () => {
      fetchMock.mockResolvedValueOnce(withHeaders(
        { success: false, code: "SUB_001", message: "The subparcels of this parcel could not be read right now." },
        503,
        { "Retry-After": "5" },
      ));
      const result = await client.callTool({ name: "get_parcel_subparcels", arguments: { reference: "46063A00100121" } });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toMatch(/^SUB_001: .*Nothing was charged/);
    });

    it("explains an unknown key and an exhausted quota", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_002", message: "Invalid API key" }, 401))
        .mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_004", message: "Monthly quota used up (5000/5000)." }, 429));
      const unauthorized = await client.callTool({ name: "get_parcel_subparcels", arguments: { reference: "R" } });
      expect(toolText(unauthorized)).toMatch(/^KEY_AUTH_002: Unknown API key/);
      const exhausted = await client.callTool({ name: "get_parcel_subparcels", arguments: { reference: "R" } });
      expect(toolText(exhausted)).toMatch(/^KEY_AUTH_004: Monthly quota used up/);
    });

    it("rejects a language outside the ten supported", async () => {
      const result = await client.callTool({ name: "get_parcel_subparcels", arguments: { reference: "R", lang: "sv" } });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_crop_catalog", () => {
    const catalog = {
      locale: "es",
      locales: ["es", "ca", "en", "pt", "fr", "it", "de", "pl", "nl", "cs"],
      sources: ["ES", "NA", "AT"],
      count: 3,
      useClasses: [{ code: "vineyard", name: "Viñedo", labels: { en: "Vineyard" } }],
      crops: [
        { code: "G-", source: "ES", name: "Algarrobo de secano", original: "Algarrobo secano", labels: {} },
        { code: "NA:1501", source: "NA", name: "Tierra de labor de secano", original: "T. labor secano", labels: {} },
        { code: "AT:53", source: "AT", name: "Viñedos", original: "Weingärten", useClass: "vineyard", labels: {} },
      ],
    };

    it("returns the whole catalogue in the asked language", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: catalog }));
      const body = toolJson(await client.callTool({ name: "get_crop_catalog", arguments: { lang: "es" } }));
      const req = lastRequest(fetchMock);
      expect(req.url.pathname).toBe("/v1/reference/crops");
      expect(req.url.searchParams.get("lang")).toBe("es");
      expect(body).toMatchObject({
        locale: "es",
        count: 3,
        use_classes: [{ code: "vineyard", name: "Viñedo" }],
        crops: [{ code: "G-", use_class: null }, { code: "NA:1501" }, { code: "AT:53", use_class: "vineyard" }],
      });
      expect(body.quota).toBeUndefined();
    });

    it("filters by code and by source", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data: catalog }));
      const byCode = toolJson(await client.callTool({ name: "get_crop_catalog", arguments: { code: "G-" } }));
      expect(byCode).toMatchObject({ count: 1, crops: [{ code: "G-", original: "Algarrobo secano" }] });
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data: catalog }));
      const bySource = toolJson(await client.callTool({ name: "get_crop_catalog", arguments: { source: "na" } }));
      expect(bySource).toMatchObject({ count: 1, crops: [{ code: "NA:1501" }] });
      expect(lastRequest(fetchMock).url.searchParams.has("lang")).toBe(false);
    });

    it("reports a server failure", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "INTERNAL_ERROR", message: "boom" }, 500));
      const result = await client.callTool({ name: "get_crop_catalog", arguments: {} });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toMatch(/^INTERNAL_ERROR/);
    });
  });

  describe("get_neighbors", () => {
    it("lists adjoining parcels", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { country: "ES", supported: true, count: 1, neighbors: [{ reference: "9871005VH5797S", latitude: 38.64, longitude: -3.46 }] },
      }));
      const body = toolJson(await client.callTool({ name: "get_neighbors", arguments: { reference: "9871004VH5797S", country: "ES" } }));
      const req = lastRequest(fetchMock);
      expect(req.url.pathname).toBe("/v1/parcels/9871004VH5797S/neighbors");
      expect(req.url.searchParams.get("country")).toBe("ES");
      expect(body).toMatchObject({ reference: "9871004VH5797S", country: "ES", supported: true, count: 1, neighbors: [{ reference: "9871005VH5797S" }] });
    });

    it("keeps supported false and an empty list", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { supported: false, count: 0, neighbors: null } }));
      const body = toolJson(await client.callTool({ name: "get_neighbors", arguments: { reference: "X" } }));
      expect(body).toMatchObject({ country: null, supported: false, count: 0, neighbors: [] });
    });

    it("explains a burst limit with its wait", async () => {
      fetchMock.mockResolvedValueOnce(withHeaders({ success: false, code: "KEY_RATE_002", message: "slow down" }, 429, { "Retry-After": "12" }));
      const result = await client.callTool({ name: "get_neighbors", arguments: { reference: "X" } });
      expect(toolText(result)).toMatch(/Wait 12 seconds/);
    });
  });

  describe("Spanish locations", () => {
    it("lists provinces", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { total: 1, provinces: [{ code: "13", name: "CIUDAD REAL" }] } }));
      const body = toolJson(await client.callTool({ name: "list_provinces", arguments: {} }));
      expect(lastRequest(fetchMock).url.pathname).toBe("/v1/locations/provinces");
      expect(body).toMatchObject({ total: 1, provinces: [{ code: "13", name: "CIUDAD REAL" }] });
    });

    it("lists municipalities of a province", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { total: 1, municipalities: [{ code: "1", ineCode: "001", name: "ABENOJAR" }] } }));
      const body = toolJson(await client.callTool({ name: "list_municipalities", arguments: { region: " CIUDAD REAL " } }));
      const req = lastRequest(fetchMock);
      expect(req.url.pathname).toBe("/v1/locations/municipalities");
      expect(req.url.searchParams.get("region")).toBe("CIUDAD REAL");
      expect(body).toMatchObject({ region: "CIUDAD REAL", total: 1, municipalities: [{ ineCode: "001" }] });
    });

    it("lists streets with and without a name filter", async () => {
      const data = { total: 1, streets: [{ code: "33", type: "CL", name: "GLORIA", fullName: "CL GLORIA" }] };
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data }));
      const body = toolJson(await client.callTool({
        name: "list_streets",
        arguments: { region: "CIUDAD REAL", municipality: "AGUDO", name: "GLO" },
      }));
      let req = lastRequest(fetchMock);
      expect(req.url.pathname).toBe("/v1/locations/streets");
      expect(req.url.searchParams.get("municipality")).toBe("AGUDO");
      expect(req.url.searchParams.get("name")).toBe("GLO");
      expect(body).toMatchObject({ region: "CIUDAD REAL", municipality: "AGUDO", streets: [{ fullName: "CL GLORIA" }] });
      fetchMock.mockResolvedValue(jsonResponse({ success: true, data }));
      await client.callTool({ name: "list_streets", arguments: { region: "CIUDAD REAL", municipality: "AGUDO" } });
      req = lastRequest(fetchMock);
      expect(req.url.searchParams.has("name")).toBe(false);
    });

    it("refuses an empty region before calling", async () => {
      const result = await client.callTool({ name: "list_municipalities", arguments: { region: "  " } });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("explains a cadastre outage", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "SERVICE_UNAVAILABLE", message: "down" }, 503));
      const result = await client.callTool({ name: "list_provinces", arguments: {} });
      expect(toolText(result)).toMatch(/^SERVICE_UNAVAILABLE: The official cadastre/);
    });
  });

  describe("crop summary and zone prices", () => {
    it("get_parcel sends lang and returns the crop summary", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          reference: "46063A00100121", country: "ES", latitude: 39.21, longitude: -0.56, subparcelCount: 3,
          cropSummary: [{ cropCode: "G-", crop: "Algarrobo de secano", cropOriginal: "Algarrobo secano", area: 6623, share: 0.75 }],
        },
      }));
      const body = toolJson(await client.callTool({ name: "get_parcel", arguments: { reference: "46063A00100121", lang: "es" } }));
      expect(lastRequest(fetchMock).url.searchParams.get("lang")).toBe("es");
      expect(body).toMatchObject({
        subparcel_count: 3,
        crop_summary: [{ crop_code: "G-", crop: "Algarrobo de secano", area_m2: 6623, share: 0.75 }],
      });
    });

    it("get_market_data returns the rural province price without the urban one", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          available: true, status: "available", estimatedPriceEur: 0, pricePerM2Eur: 0, salesCount: 0, granularity: "province",
          zonePrices: {
            zone: "VALENCIA", zoneLevel: "province",
            urban: { pricePerM2Eur: 1720, statistic: "mean", authority: "Official statistics", period: "2026-Q1" },
            rural: { pricePerM2Eur: 2.1, pricePerHaEur: 21000, statistic: "mean", authority: "Official statistics", period: "2024" },
          },
        },
      }));
      const body = toolJson(await client.callTool({ name: "get_market_data", arguments: { reference: "46063A00100121" } }));
      expect(body).toMatchObject({
        granularity: "province",
        crop_prices: [],
        zone_prices: {
          zone: "VALENCIA",
          zone_level: "province",
          municipality: null,
          rural: { price_per_ha_eur: 21000, period: "2024" },
        },
      });
      expect(body.zone_prices.urban).toBeUndefined();
    });

    it("get_market_data copes with partial or missing zone prices", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { available: true, status: "available", zonePrices: { zone: "Z", zoneLevel: "province" } },
      }));
      const body = toolJson(await client.callTool({ name: "get_market_data", arguments: { reference: "46063A00100121" } }));
      expect(body).toMatchObject({ zone_prices: { zone: "Z", rural: null } });
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { available: false } }));
      const none = toolJson(await client.callTool({ name: "get_market_data", arguments: { reference: "X" } }));
      expect(none.zone_prices).toBeNull();
      expect(none.crop_prices).toEqual([]);
    });
  });
});
