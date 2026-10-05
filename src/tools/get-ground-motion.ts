import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SITE_ANALYSIS_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult, sitePoint } from "./shared.js";

export function registerGetGroundMotion(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_ground_motion",
    {
      title: "Get Ground Motion (Subsidence)",
      description:
        "Whether the ground under the parcel sinks or rises and how fast, measured by satellite radar " +
        "(Copernicus European Ground Motion Service, EGMS L3 Ortho, Sentinel-1 InSAR, 100 m grid, 2020-2024): " +
        "mean vertical velocity in mm/year over the parcel outline (negative = sinking), fastest-sinking cell, " +
        "east-west velocity, class from stable to severe_subsidence, cells with data and the mean displacement " +
        "of each year. status no_data with reason no_reflectors means the satellite found nothing stable to " +
        "measure (fields, forest, water): there is no figure, not a zero. Carries the source, licence and the " +
        "attribution to show. Every covered country inside EGMS coverage: in ES, PV, NA, PT, FR, IT and DE the " +
        "reference is enough; elsewhere also pass latitude and longitude (from get_parcel). Costs 1 quota unit.",
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
        const { data, quota } = await client.getGroundMotion(reference, country, point);
        return jsonResult({
          reference: data.refcat,
          country: data.country,
          status: data.status,
          reason: data.reason,
          period: data.period?.label,
          ground_motion: data.ground_motion,
          source: data.source,
          calculated_at: data.calculated_at,
        }, quota);
      } catch (caught) {
        return handleToolError(caught);
      }
    },
  );
}
