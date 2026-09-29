import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CatastroGPSClient, CatastroGPSApiError } from "../src/client/catastrogps-api.js";
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

  it("posts free-text addresses to the parser endpoint in the field the API expects", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {} }));
    await client.searchAddress("Calle Mallorca 213, Barcelona");

    const req = lastRequest(fetchMock);
    expect(req.method).toBe("POST");
    expect(req.url.pathname).toBe("/api/search/address/parse");
    expect(req.headers["Content-Type"]).toBe("application/json");
    expect(req.body).toEqual({ direccion: "Calle Mallorca 213, Barcelona" });
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

  it("keeps what the address parser understood when it cannot find the address", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "No se pudo determinar la provincia", parsed: { NombreVia: "MAYOR" } }, 404),
    );

    const error = (await client.searchAddress("Calle Mayor").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("HTTP_404");
    expect(error.details).toEqual({ NombreVia: "MAYOR" });
  });

  it("falls back to an HTTP code when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gateway down", { status: 502 }));

    const error = (await client.getPolygon("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.code).toBe("HTTP_502");
    expect(error.status).toBe(502);
  });

  it("keeps the quota reset date of a 429", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, code: "KEY_AUTH_004", error: "Cuota mensual agotada" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "X-RateLimit-Reset": "2026-10-01T00:00:00Z" },
      }),
    );

    const error = (await client.getPolygon("X").catch((e: unknown) => e)) as CatastroGPSApiError;
    expect(error.resetsAt).toBe("2026-10-01T00:00:00Z");
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
