import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";

const SIGPAC = {
  reference: "46063A00100121",
  country: "ES",
  sigpacParcel: { province: 46, municipality: 63, aggregate: 0, zone: 0, polygon: 1, parcel: 121 },
  match: "reference",
  count: 2,
  totalAreaHa: 0.8815,
  crs: "EPSG:4258 (ETRS89, lon/lat; equal to WGS84 within about 1 m)",
  retrievedAt: "2026-10-22T13:47:26Z",
  source: {
    name: "SIGPAC",
    provider: "FEGA",
    license: "Free reuse citing the source (Ley 37/2007)",
    attribution: "Fuente: FEGA — SIGPAC",
    url: "https://sigpac-hubcloud.es/servicioconsultassigpac/",
  },
  enclosures: [
    {
      id: "46:63:0:0:1:121:2", province: 46, municipality: 63, aggregate: 0, zone: 0, polygon: 1, parcel: 121,
      enclosure: 2, landUseCode: "FY", landUse: "Fruit trees", cropCode: "SIGPAC:FY", useClass: "orchard",
      useClassName: "Orchard", areaHa: 0.0513, irrigationPct: 0, meanSlopePct: 7.6, altitudeM: 117,
      pastureEligibilityPct: null, capRegion: 12, incidents: [{ code: 199, description: "Recinto inactivo" }],
      geometry: { type: "Polygon", coordinates: [[[-0.5654, 39.2107], [-0.565, 39.2109], [-0.5654, 39.2107]]] },
    },
    {
      id: "46:63:0:0:1:121:9", province: 46, municipality: 63, aggregate: 0, zone: 0, polygon: 1, parcel: 121,
      enclosure: 9, landUseCode: "ZZ", areaHa: 0.0039, irrigationPct: null, meanSlopePct: null, altitudeM: null,
      pastureEligibilityPct: null, capRegion: null, incidents: null, geometry: null,
    },
  ],
};

function withHeaders(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("get_parcel_sigpac", () => {
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

  it("maps every enclosure without geometry by default", async () => {
    fetchMock.mockResolvedValueOnce(withHeaders({ success: true, data: SIGPAC }, 200, { "X-Quota-Remaining": "40" }));

    const body = toolJson(await client.callTool({
      name: "get_parcel_sigpac",
      arguments: { reference: "46063A00100121", lang: "en" },
    }));

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe("/v1/parcels/46063A00100121/sigpac");
    expect(req.url.searchParams.get("lang")).toBe("en");
    expect(req.url.searchParams.has("country")).toBe(false);
    expect(req.url.searchParams.has("format")).toBe(false);
    expect(body).toMatchObject({
      reference: "46063A00100121",
      country: "ES",
      sigpac_parcel: { province: 46, municipality: 63, aggregate: 0, zone: 0, polygon: 1, parcel: 121 },
      match: "reference",
      count: 2,
      total_area_ha: 0.8815,
      retrieved_at: "2026-10-22T13:47:26Z",
      attribution: "Fuente: FEGA — SIGPAC",
      license: "Free reuse citing the source (Ley 37/2007)",
      quota: { remaining: 40 },
    });
    const [first, second] = body.enclosures as Array<Record<string, unknown>>;
    expect(first).toEqual({
      id: "46:63:0:0:1:121:2",
      enclosure: 2,
      land_use_code: "FY",
      land_use: "Fruit trees",
      crop_code: "SIGPAC:FY",
      use_class: "orchard",
      use_class_name: "Orchard",
      area_ha: 0.0513,
      irrigation_pct: 0,
      mean_slope_pct: 7.6,
      altitude_m: 117,
      pasture_eligibility_pct: null,
      cap_region: 12,
      incidents: [{ code: 199, description: "Recinto inactivo" }],
    });
    expect(second).toMatchObject({ land_use_code: "ZZ", irrigation_pct: null, mean_slope_pct: null, cap_region: null, incidents: [] });
    expect(second.land_use).toBeUndefined();
  });

  it("includes geometry on request and passes the foral country", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { ...SIGPAC, country: "NA" } }));
    const body = toolJson(await client.callTool({
      name: "get_parcel_sigpac",
      arguments: { reference: "31201000000100001", country: "NA", include_geometry: true },
    }));
    expect(lastRequest(fetchMock).url.searchParams.get("country")).toBe("NA");
    const [first, second] = body.enclosures as Array<Record<string, unknown>>;
    expect(first.geometry).toMatchObject({ type: "Polygon" });
    expect(second.geometry).toBeNull();
  });

  it("answers a parcel without enclosures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { reference: "X", country: "ES", sigpacParcel: null, count: 0, totalAreaHa: 0, crs: "EPSG:4258", enclosures: null },
    }));
    const body = toolJson(await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "X" } }));
    expect(body).toMatchObject({
      reference: "X",
      sigpac_parcel: null,
      match: null,
      count: 0,
      retrieved_at: null,
      attribution: null,
      license: null,
      enclosures: [],
    });
  });

  it("explains SIG_001 as a retryable, uncharged failure", async () => {
    fetchMock.mockResolvedValueOnce(withHeaders(
      { success: false, code: "SIG_001", message: "The SIGPAC enclosures of this parcel could not be read right now." },
      503,
      { "Retry-After": "5" },
    ));
    const result = await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "46063A00100121" } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/^SIG_001: .*Nothing was charged/);
  });

  it("explains a country without SIGPAC", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: false,
      code: "CNV_COVERAGE",
      message: "This analysis is not available yet for the country of this reference.",
      details: { feature: "sigpac", supportedCountries: ["ES", "PV", "NA"] },
    }, 422));
    const result = await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "CH119192997709" } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/^CNV_COVERAGE: /);
  });

  it("explains an unknown key, an exhausted quota, a server error and a timeout", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_002", message: "Invalid API key" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_004", message: "Monthly quota used up (5000/5000)." }, 429))
      .mockResolvedValueOnce(jsonResponse({ success: false, code: "INTERNAL_ERROR", message: "boom" }, 500))
      .mockRejectedValueOnce(abort);
    const call = () => client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "R" } });
    expect(toolText(await call())).toMatch(/^KEY_AUTH_002: Unknown API key/);
    expect(toolText(await call())).toMatch(/^KEY_AUTH_004: Monthly quota used up/);
    expect(toolText(await call())).toMatch(/^INTERNAL_ERROR: /);
    expect(toolText(await call())).toMatch(/^MCP_TIMEOUT: /);
  });

  it("rejects a country without SIGPAC and an unsupported language before calling the API", async () => {
    const foreign = await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "R", country: "FR" } });
    const language = await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "R", lang: "sv" } });
    const empty = await client.callTool({ name: "get_parcel_sigpac", arguments: { reference: "" } });
    expect(foreign.isError).toBe(true);
    expect(language.isError).toBe(true);
    expect(empty.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
