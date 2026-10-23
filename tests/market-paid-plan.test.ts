import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";

const PAID_PLAN_REFUSAL = {
  success: false,
  code: "KEY_PLAN_001",
  message: "This endpoint returns price data and requires a paid API plan. Upgrade your plan to access it.",
};

const SOURCE_NAMES = /DVF|\bOMI\b|Bodenrichtwert|BORIS|MIVAU|\bMAPA\b|Agenzia delle Entrate|Catastro 20\d\d/;

describe("price tools on paid API plans only", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = installFetchMock();
    client = await connectClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("describes get_market_data as paid-only without naming price sources", async () => {
    const { tools } = await client.listTools();
    const market = tools.find((t) => t.name === "get_market_data")!;

    expect(market.description).toMatch(/^Paid API plans only/);
    expect(market.description).toContain("KEY_PLAN_001");
    expect(market.description).not.toMatch(SOURCE_NAMES);
  });

  it("describes get_value_history as paid-only", async () => {
    const { tools } = await client.listTools();
    const history = tools.find((t) => t.name === "get_value_history")!;

    expect(history.description).toMatch(/^Paid API plans only/);
    expect(history.description).toContain("KEY_PLAN_001");
  });

  it.each([
    ["get_market_data", "/v1/parcels/9872023VH5797S/market"],
    ["get_value_history", "/v1/parcels/9872023VH5797S/value-history"],
  ])("%s turns KEY_PLAN_001 into a clear upgrade message", async (tool, path) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PAID_PLAN_REFUSAL, 403));

    const result = await client.callTool({ name: tool, arguments: { reference: "9872023VH5797S", country: "ES" } });
    const text = toolText(result);

    expect(result.isError).toBe(true);
    expect(lastRequest(fetchMock).url.pathname).toBe(path);
    expect(text).toMatch(/^KEY_PLAN_001: /);
    expect(text).toContain("only available on paid API plans");
    expect(text).toContain("Nothing was charged");
    expect(text).toContain("https://www.parcelgps.com/developers");
    expect(text).not.toContain("Missing or invalid API key");
  });

  it("does not confuse a missing key with a free-plan key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "UNAUTHORIZED", message: "Missing API key" }, 401));

    const result = await client.callTool({ name: "get_market_data", arguments: { reference: "9872023VH5797S" } });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toMatch(/^UNAUTHORIZED: Missing or invalid API key/);
    expect(toolText(result)).not.toContain("paid API plans");
  });

  it("still serves the zone prices to a paid key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: {
        available: true,
        status: "zone_reference",
        estimatedPriceEur: 0,
        pricePerM2Eur: 0,
        salesCount: 0,
        zonePrices: {
          zone: "Madrid",
          zoneLevel: "province",
          urban: { pricePerM2Eur: 4000, statistic: "Official housing price", authority: "Official statistics", period: "2026-Q1" },
        },
      },
    }));

    const result = await client.callTool({ name: "get_market_data", arguments: { reference: "0847106VK4704F" } });
    const body = toolJson(result);

    expect(result.isError).toBeUndefined();
    expect(body).toMatchObject({ available: true, zone_prices: { zone: "Madrid", urban: { price_per_m2_eur: 4000 } } });
  });
});
