import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetTerrain(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_terrain",
    {
      title: "Get Terrain and Protected Areas",
      description:
        "Relief of the parcel computed over its outline from Copernicus DEM GLO-30 (30 m): mean/min/max " +
        "elevation, mean and maximum slope with class and distribution, share steeper than 10 %, dominant " +
        "orientation. Plus whether it lies in Natura 2000 (EEA) or a nationally designated protected area " +
        "(CDDA), with each site's name, code, type (SPA/SCI) and the share of the parcel inside it. " +
        "Every block carries its source and licence; status is ok, no_data or unavailable. " +
        "Available for Spain (ES, PV, NA), Portugal, France, Italy and Germany.",
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
        const { data } = await client.getTerrain(reference, country);
        return jsonResult({
          reference: data.refcat,
          country: data.country,
          relief: data.relief,
          protected_areas: data.protected_areas,
          calculated_at: data.calculated_at,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
