import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetMarket(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_market_data",
    {
      title: "Get Market Data",
      description:
        "Get real estate market data for a parcel's area. " +
        "France has parcel-level transaction data (DVF). " +
        "Spain, Portugal, Italy, and Germany provide zone or municipality-level averages.",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getMarketData(reference, country);
        const data = response.data;

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
