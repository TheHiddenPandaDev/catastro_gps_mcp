import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerCompareParcels(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "compare_parcels",
    {
      title: "Compare Parcels",
      description:
        "Compare 2-3 parcels side by side across all available metrics: " +
        "area, land use, investment score, solar potential, and market price. " +
        "Parcels can be from different countries. Costs 2 API calls.",
      inputSchema: {
        parcels: z
          .array(
            z.object({
              reference: z.string().describe("Cadastral reference code"),
              country: z
                .enum(SUPPORTED_COUNTRIES)
                .describe("Country code"),
            }),
          )
          .min(2)
          .max(3)
          .describe("Array of 2-3 parcels to compare"),
      },
    },
    async ({ parcels }) => {
      try {
        const response = await client.compareParcels(parcels);
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
