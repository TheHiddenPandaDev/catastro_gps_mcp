import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { REFERENCE_COUNTRIES } from "../src/types/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolText } from "./helpers.js";

describe("tool edge cases", () => {
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

  it.each(REFERENCE_COUNTRIES)("get_parcel forwards reference lookups for %s", async (country) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { refCatastral: "R", latitud: 1, longitud: 2 } }));

    const result = await client.callTool({ name: "get_parcel", arguments: { reference: "R", country } });

    expect(result.isError).toBeFalsy();
    expect(lastRequest(fetchMock).url.searchParams.get("country")).toBe(country);
  });

  it("prefers the reference when both reference and coordinates are given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { refCatastral: "R", latitud: 1, longitud: 2 } }));

    await client.callTool({ name: "get_parcel", arguments: { reference: "R", latitude: 40, longitude: -3 } });

    expect(lastRequest(fetchMock).url.pathname).toBe("/api/catastro/R");
  });

  it("rejects out-of-range coordinates at the schema", async () => {
    const result = await client.callTool({ name: "get_parcel", arguments: { latitude: 91, longitude: 0 } });

    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a country without coverage", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: false,
      code: "CNV_COVERAGE",
      error: "Esta referencia está en un país que todavía no cubrimos",
      data: { country: "RO", supported: false },
    }, 422));

    const text = toolText(await client.callTool({ name: "get_parcel", arguments: { latitude: 44.43, longitude: 26.1 } }));
    expect(text).toContain("CNV_COVERAGE");
    expect(text).toContain("RO");
  });

  it("tells the agent to switch tools on a place name", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "CNV_PLACE_NAME", error: "Nombre de lugar" }, 422));

    const text = toolText(await client.callTool({ name: "get_parcel", arguments: { reference: "Zeutern 10385" } }));
    expect(text).toContain("search_address");
  });

  it("surfaces an invalid key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "KEY_AUTH_002", error: "Clave API inválida" }, 401));

    const text = toolText(await client.callTool({ name: "get_boundaries", arguments: { reference: "R" } }));
    expect(text).toContain("CATASTROGPS_API_KEY");
  });

  it("hides unexpected internal errors behind a generic message", async () => {
    fetchMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = await client.callTool({ name: "get_solar_potential", arguments: { reference: "R" } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("MCP_NETWORK");
  });
});
