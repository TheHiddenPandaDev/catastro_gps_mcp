import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SITE_ANALYSIS_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult, sitePoint } from "./shared.js";

export function registerGetTerrain(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_terrain",
    {
      title: "Get Terrain, Protected Areas and Climate",
      description:
        "Relief of the parcel computed over its outline from Copernicus DEM GLO-30 (30 m): mean/min/max " +
        "elevation, mean and maximum slope with class and distribution, share steeper than 10 %, dominant " +
        "orientation. Whether it lies in Natura 2000 (EEA) or a nationally designated protected area " +
        "(CDDA), with each site's name, code, type (SPA/SCI) and the share of the parcel inside it. " +
        "Climate normals at the parcel point from ERA5-Land (mean temperature, precipitation, frost and " +
        "hot days, and the recent change against the baseline). Every block carries its source and " +
        "licence; status is ok, no_data or unavailable. In ES, PV, NA, PT, FR, IT and DE the reference is " +
        "enough; in every other covered country also pass latitude and longitude (from get_parcel). " +
        "Costs 1 quota unit.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(SITE_ANALYSIS_COUNTRIES)
          .optional()
          .describe("Optional country code. Omit to auto-detect from the reference."),
        latitude: z.number().min(-90).max(90).optional()
          .describe("Latitude of the parcel point (WGS84). Required outside ES, PV, NA, PT, FR, IT and DE"),
        longitude: z.number().min(-180).max(180).optional()
          .describe("Longitude of the parcel point (WGS84). Required outside ES, PV, NA, PT, FR, IT and DE"),
      },
    },
    async ({ reference, country, latitude, longitude }) => {
      const { point, error } = sitePoint(country, latitude, longitude);
      if (error) return error;
      try {
        const { data, quota } = await client.getTerrain(reference, country, point);
        return jsonResult({
          reference: data.refcat,
          country: data.country,
          relief: data.relief,
          protected_areas: data.protected_areas,
          climate: data.climate ?? null,
          calculated_at: data.calculated_at,
        }, quota);
      } catch (caught) {
        return handleToolError(caught);
      }
    },
  );
}
