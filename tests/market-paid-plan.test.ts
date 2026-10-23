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

  it("describes get_market_data as rural land only, with MKT_001 for anything else", async () => {
    const { tools } = await client.listTools();
    const market = tools.find((t) => t.name === "get_market_data")!;

    expect(market.description).toContain("Rural land only");
    expect(market.description).toMatch(/Housing, industrial\s+or any built property is not supported and answers MKT_001 with nothing charged/);
    expect(market.description).not.toMatch(/housing per built m2|Italy|France|Germany|Portugal/);
  });

  it("serves crop and rural zone prices of rural land to a paid key, never urban figures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: {
        available: true,
        status: "available",
        estimatedPriceEur: 0,
        pricePerM2Eur: 0,
        salesCount: 0,
        granularity: "parcel",
        zonePrices: {
          zone: "Valencia",
          zoneLevel: "province",
          urban: { pricePerM2Eur: 1650, statistic: "Official housing price", authority: "Official statistics", period: "2026-Q1" },
          rural: { pricePerM2Eur: 2, pricePerHaEur: 20000, statistic: "Official farmland price", authority: "Official statistics", period: "2024" },
        },
        cropPrices: [{
          cropGroup: "CIT", cropGroupName: "Citrus", landUseCodes: ["NR"], basis: "cadastral_subparcels", areaHa: 1.5,
          pricePerHaEur: 45000, salesCount: 30, level: "agricultural_zone", zone: "46-03", period: "2026",
          authority: "Official statistics", statistic: "Official price per hectare by crop",
        }],
      },
    }));

    const result = await client.callTool({ name: "get_market_data", arguments: { reference: "46063A00100121" } });
    const body = toolJson(result) as Record<string, any>;

    expect(result.isError).toBeUndefined();
    expect(body).toMatchObject({
      available: true,
      granularity: "parcel",
      crop_prices: [{ crop_group: "CIT", price_per_ha_eur: 45000, sales_count: 30, level: "agricultural_zone" }],
      zone_prices: { zone: "Valencia", rural: { price_per_ha_eur: 20000 } },
    });
    expect(body.zone_prices.urban).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/authority|statistic|1650/);
  });

  it.each([
    ["built or urban parcel", "not_unbuilt_rural_land", "9872023VH5797S0001WX"],
    ["rural land without a price", "no_rural_price", "46063A00100121"],
    ["country without rural land prices", "country_not_covered", "75056000AB0001"],
  ])("explains MKT_001 for a %s and says nothing was charged", async (_case, reason, reference) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: false,
      code: "MKT_001",
      message: "A price cannot be estimated for this parcel.",
      details: { reference, feature: "market", reason },
    }, 422));

    const result = await client.callTool({ name: "get_market_data", arguments: { reference } });
    const text = toolText(result);

    expect(result.isError).toBe(true);
    expect(text).toMatch(/^MKT_001: No price can be estimated for this parcel/);
    expect(text).toContain("only covers rural land");
    expect(text).toContain("Nothing was charged");
    expect(text).toContain(reason);
  });
});
