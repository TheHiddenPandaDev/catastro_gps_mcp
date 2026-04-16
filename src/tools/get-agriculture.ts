import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetAgriculture(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_agriculture",
    {
      title: "Get Agriculture Data",
      description:
        "Get agricultural data for a parcel: land use classification, NDVI vegetation index, " +
        "and reference crop prices in the area. Sources: SIGPAC (ES), RPG (FR), COS (PT), " +
        "CLC (IT), ALKIS (DE).",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getAgriculture(reference, country);
        const data = response.data;

        const result = {
          uso_suelo: data.uso_suelo || null,
          ndvi: data.ndvi || null,
          cultivos: data.cultivos || [],
          precios_cultivo: data.precios_cultivo || [],
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
