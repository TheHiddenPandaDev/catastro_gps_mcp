import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CatastroGPSClient, CatastroGPSApiError, readQuota } from "../src/client/catastrogps-api.js";
import { USER_AGENT } from "../src/version.js";
import { TEST_CONFIG, installFetchMock, jsonResponse, lastRequest } from "./helpers.js";

describe("CatastroGPSClient", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;
  let client: CatastroGPSClient;

  beforeEach(() => {
    fetchMock = installFetchMock();
    client = new CatastroGPSClient(TEST_CONFIG);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the API key and the versioned user agent on every call", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.getParcelByReference("9872023VH5797S0001WX");

    const req = lastRequest(fetchMock);
    expect(req.headers["X-API-Key"]).toBe(TEST_CONFIG.apiKey);
    expect(req.headers["User-Agent"]).toBe(USER_AGENT);
  });

  it("looks up a reference without forcing a country so the API can detect it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.getParcelByReference("9872023VH5797S0001WX");

    const req = lastRequest(fetchMock);
    expect(req.method).toBe("GET");
    expect(req.url.pathname).toBe("/api/catastro/9872023VH5797S0001WX");
    expect(req.url.searchParams.has("country")).toBe(false);
  });

  it("encodes references with slashes and spaces", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.getParcelByReference("146510_8.0502.1 / 3", "PL");

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe("/api/catastro/146510_8.0502.1%20%2F%203");
    expect(req.url.searchParams.get("country")).toBe("PL");
  });

  it("uses the GET coordinates endpoint that covers every wired country", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.getParcelByCoordinates(52.23, 21.012, "PL");

    const req = lastRequest(fetchMock);
    expect(req.method).toBe("GET");
    expect(req.url.pathname).toBe("/api/search/coordinates");
    expect(req.url.searchParams.get("lat")).toBe("52.23");
    expect(req.url.searchParams.get("lng")).toBe("21.012");
    expect(req.url.searchParams.get("country")).toBe("PL");
  });

  it("asks the address candidates endpoint with country and limit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { candidatos: [] } }));
    await client.searchAddressCandidates("8 boulevard du Port, Amiens", "FR", 3);

    const req = lastRequest(fetchMock);
    expect(req.method).toBe("GET");
    expect(req.url.pathname).toBe("/api/search/address/candidates");
    expect(req.url.searchParams.get("q")).toBe("8 boulevard du Port, Amiens");
    expect(req.url.searchParams.get("country")).toBe("FR");
    expect(req.url.searchParams.get("limit")).toBe("3");
    expect(req.body).toBeUndefined();
  });

  it("pages units with country and cursor", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { unidades: [] } }));
    await client.getUnits("020-3-657", "PV", "N0714723L");

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe("/api/catastro/020-3-657/units");
    expect(req.url.searchParams.get("country")).toBe("PV");
    expect(req.url.searchParams.get("cursor")).toBe("N0714723L");
  });

  it("resolves free text with an optional hint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { input: "x", candidates: [], ambiguous: false } }));
    await client.resolve("05102200100005", "DE");

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe("/api/resolve");
    expect(req.url.searchParams.get("q")).toBe("05102200100005");
    expect(req.url.searchParams.get("hint")).toBe("DE");
  });

  it.each([
    ["getTerrain", "/terrain"],
    ["getGroundMotion", "/ground-motion"],
  ] as const)("%s sends the parcel point when given", async (method, suffix) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client[method]("BE1", "BE", { lat: 50.848139, lng: 4.353613 });

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe(`/api/catastro/BE1${suffix}`);
    expect(req.url.searchParams.get("lat")).toBe("50.848139");
    expect(req.url.searchParams.get("lng")).toBe("4.353613");
    expect(req.url.searchParams.get("country")).toBe("BE");
  });

  it.each([
    ["getPolygon", "/polygon"],
    ["getSolarPotential", "/solar"],
    ["getAgriculture", "/agro"],
    ["getMarketData", "/market"],
    ["getInvestmentScore", "/score"],
    ["getValueHistory", "/value-history"],
  ] as const)("%s calls the real backend path %s", async (method, suffix) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client[method]("REF1", "ES");

    expect(lastRequest(fetchMock).url.pathname).toBe(`/api/catastro/REF1${suffix}`);
  });

  it("sends compare requests in the backend's snake_case shape", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.compareParcels([
      { reference: "A", country: "ES" },
      { reference: "B", country: "FR" },
    ]);

    const req = lastRequest(fetchMock);
    expect(req.url.pathname).toBe("/api/catastro/compare");
    expect(req.body).toEqual({
      parcelas: [
        { ref_catastral: "A", country: "ES" },
        { ref_catastral: "B", country: "FR" },
      ],
    });
  });

  it("turns API errors into typed errors that keep the code, status and details", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { success: false, code: "CNV_AMBIGUOUS", error: "Varios países", data: { candidates: [{ country: "DE" }, { country: "PT" }] } },
        300,
      ),
    );

    const error = await client.getParcelByReference("05102200100005").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CatastroGPSApiError);
    expect(error).toMatchObject({ code: "CNV_AMBIGUOUS", status: 300, message: "Varios países" });
    expect((error as CatastroGPSApiError).details).toEqual({ candidates: [{ country: "DE" }, { country: "PT" }] });
  });

  it("keeps the details of a coverage error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, code: "CNV_COVERAGE", error: "no", data: { supportedCountries: ["ES", "FR"] } }, 422),
    );

    const error = (await client.searchAddressCandidates("Storgatan 1", "SE").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("CNV_COVERAGE");
    expect(error.details).toEqual({ supportedCountries: ["ES", "FR"] });
  });

  it("falls back to an HTTP code when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gateway down", { status: 502 }));

    const error = (await client.getPolygon("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("HTTP_502");
    expect(error.status).toBe(502);
  });

  it("keeps the monthly quota reset date of a 429 from X-Quota-Reset, not the per-minute limiter", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, code: "KEY_AUTH_004", error: "Monthly quota used up" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-Quota-Limit": "250",
          "X-Quota-Remaining": "0",
          "X-Quota-Reset": "2026-10-01T00:00:00Z",
          "X-Quota-Tier": "free",
          "X-RateLimit-Limit": "300",
          "X-RateLimit-Remaining": "299",
          "X-RateLimit-Reset": "60",
        },
      }),
    );

    const error = (await client.getPolygon("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.resetsAt).toBe("2026-10-01T00:00:00Z");
    expect(error.quota?.remaining).toBe(0);
    expect(client.lastQuota).toEqual({
      plan: "free",
      limit: 250,
      remaining: 0,
      resetsAt: "2026-10-01T00:00:00Z",
      perMinute: { limit: 300, remaining: 299, resetSeconds: 60 },
    });
  });

  it("returns the quota of each successful response with the data", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { refCatastral: "R" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Quota-Limit": "5000",
          "X-Quota-Remaining": "4899",
          "X-Quota-Reset": "2026-11-01T00:00:00Z",
          "X-Quota-Tier": "developer",
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": "58",
          "X-RateLimit-Reset": "41",
        },
      }),
    );

    const response = await client.getParcelByReference("R");
    expect(response.data).toEqual({ refCatastral: "R" });
    expect(response.quota).toEqual({
      plan: "developer",
      limit: 5000,
      remaining: 4899,
      resetsAt: "2026-11-01T00:00:00Z",
      perMinute: { limit: 60, remaining: 58, resetSeconds: 41 },
    });
    expect(client.lastQuota).toEqual(response.quota);
  });

  it("reads the prepaid overage balance and the per-finca cap", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: {
          "X-Quota-Limit": "15000",
          "X-Quota-Remaining": "0",
          "X-Quota-Tier": "pro",
          "X-Quota-Overage": "on",
          "X-Quota-Balance": "4.995000",
          "X-Quota-Overage-Unit-Price": "0.004000",
          "X-Quota-Overage-Remaining": "1248",
          "X-Quota-Finca-Cap": "50",
          "X-Quota-Finca-Cap-Used": "12",
        },
      }),
    );

    const response = await client.getUnits("0745901TG4304N");
    expect(response.quota?.overage).toEqual({ enabled: true, balanceEur: 4.995, unitPriceEur: 0.004, unitsLeft: 1248 });
    expect(response.quota?.fincaCap).toEqual({ cap: 50, used: 12 });
  });

  it("does not attach a quota when the response carries no quota headers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    const response = await client.getParcelByReference("R");
    expect(response.quota).toBeUndefined();
    expect(readQuota(new Headers({ "X-Quota-Limit": "abc" }))).toBeUndefined();
  });

  it("never reports the per-minute limiter as the monthly quota and keeps Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, code: "KEY_RATE_002", error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "17",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "17",
        },
      }),
    );

    const error = (await client.getPolygon("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.resetsAt).toBeUndefined();
    expect(error.retryAfterSeconds).toBe(17);
    expect(client.lastQuota).toEqual({ perMinute: { limit: 10, remaining: 0, resetSeconds: 17 } });
  });

  it("keeps the last known quota when a response carries no quota headers", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: {} }), {
          status: 200,
          headers: { "X-Quota-Limit": "250", "X-Quota-Remaining": "10", "X-Quota-Tier": "free" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));

    await client.getParcelByReference("R");
    await client.getParcelByReference("R");
    expect(client.lastQuota).toEqual({ plan: "free", limit: 250, remaining: 10 });
  });

  it("reports timeouts as MCP_TIMEOUT", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const error = (await client.getSolarPotential("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("MCP_TIMEOUT");
  });

  it("reports network failures as MCP_NETWORK", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const error = (await client.getAgriculture("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("MCP_NETWORK");
    expect(error.message).toContain("fetch failed");
  });

  it("strips a trailing slash from the base URL", async () => {
    const trailing = new CatastroGPSClient({ ...TEST_CONFIG, apiUrl: "https://api.example.test/" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await trailing.getParcelByReference("R");

    expect(lastRequest(fetchMock).url.toString()).toBe("https://api.example.test/api/catastro/R");
  });
});
