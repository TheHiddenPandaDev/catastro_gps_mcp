import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import type { CropLandPrice, OfficialZonePrice, ZonePrices } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

function zonePrice(price: OfficialZonePrice | undefined): Record<string, unknown> | null {
  if (!price) return null;
  return compact({
    price_per_m2_eur: price.pricePerM2Eur,
    price_per_ha_eur: price.pricePerHaEur,
    period: price.period,
  });
}

function zonePrices(prices: ZonePrices | undefined): Record<string, unknown> | null {
  if (!prices) return null;
  return {
    zone: prices.zone,
    zone_level: prices.zoneLevel,
    municipality: prices.municipality ?? null,
    rural: zonePrice(prices.rural),
  };
}

function cropPrices(prices: CropLandPrice[] | undefined): Record<string, unknown>[] {
  return (prices ?? []).map((price) => compact({
    crop_group: price.cropGroup,
    crop_group_name: price.cropGroupName,
    land_use_codes: price.landUseCodes,
    area_ha: price.areaHa,
    price_per_ha_eur: price.pricePerHaEur,
    sales_count: price.salesCount,
    level: price.level,
    zone: price.zone,
    period: price.period,
  }));
}

export function registerGetMarket(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_market_data",
    {
      title: "Get Market Data",
      description:
        "Paid API plans only (Developer, Startup, Growth, Enterprise): with a Free-plan key it answers " +
        "KEY_PLAN_001 and nothing is charged. Rural land only: prices agricultural parcels in Spain (ES, PV, NA), " +
        "small agricultural buildings allowed (sheds, farm stores, ponds, greenhouses), with crop_prices (EUR per " +
        "hectare for each crop group of the parcel, with the number of sales behind it) and zone_prices.rural (the " +
        "province farmland price per hectare). It is the price of the land; buildings are not valued (price_note). " +
        "Housing, industrial or any other non-agricultural property is not supported and answers MKT_001 with " +
        "nothing charged; so does rural land without a price, and any other country. One API call, charged only " +
        "when a price comes back.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(ENRICHMENT_COUNTRIES)
          .optional()
          .describe("Optional country code. Rural land prices exist for ES, PV and NA; other countries answer MKT_001. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data: d, quota } = await client.getMarketData(reference, country);
        return jsonResult({
          reference,
          country: country ?? null,
          available: d.available,
          granularity: d.granularity || null,
          crop_prices: cropPrices(d.cropPrices),
          zone_prices: zonePrices(d.zonePrices),
          price_note: d.priceNote ?? null,
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
