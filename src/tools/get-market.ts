import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetMarket(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_market_data",
    {
      title: "Get Market Data",
      description:
        "Aggregated land and property price reference for the area around a parcel. Never returns " +
        "individual sales. Price figures exist only in France (DVF recorded sales: average EUR/m2, " +
        "number of sales, last sale date, estimated value), Italy (OMI zone values from Agenzia delle " +
        "Entrate) and Germany (official Bodenrichtwert land value per m2, North Rhine-Westphalia only; " +
        "elsewhere in Germany it answers available=false). For Spain (ES, PV, NA) and Portugal it " +
        "returns a reference note without figures: there is no per-parcel price source yet. " +
        "One API call.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(ENRICHMENT_COUNTRIES)
          .optional()
          .describe("Optional country code: ES, PV, NA, PT, FR, IT or DE. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data: d, quota } = await client.getMarketData(reference, country);
        const hasFigures = (d.pricePerM2Eur ?? 0) > 0 || (d.estimatedPriceEur ?? 0) > 0;
        return jsonResult({
          reference,
          country: country ?? null,
          available: d.available,
          has_price_figures: hasFigures,
          price_per_m2_eur: d.pricePerM2Eur || null,
          estimated_value_eur: d.estimatedPriceEur || null,
          sales_count: d.salesCount || null,
          last_sale_date: d.lastSaleDate || null,
          granularity: d.granularity || null,
          data_quality: d.dataQuality ?? null,
          updated: d.updatedAt || null,
          source: d.source ?? null,
          note: d.message || null,
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
