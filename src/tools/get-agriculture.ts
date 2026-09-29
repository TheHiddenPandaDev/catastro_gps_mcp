import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetAgriculture(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_agriculture",
    {
      title: "Get Agricultural Data",
      description:
        "Agricultural context for a rural parcel: land use and main crop from the agricultural " +
        "parcel registry (SIGPAC in Spain, with slope, altitude and irrigation), vegetation index " +
        "(NDVI) and a reference crop price when available. Richest in Spain; also Portugal, France, " +
        "Italy and Germany. Field names are returned in Spanish, as the API sends them.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference of a rural parcel"),
        country: z
          .enum(ENRICHMENT_COUNTRIES)
          .optional()
          .describe("Optional country code: ES, PV, NA, PT, FR, IT or DE. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data } = await client.getAgriculture(reference, country);
        return jsonResult({ reference, country: country ?? null, agriculture: data.agro ?? data });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
