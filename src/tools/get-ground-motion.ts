import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

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
        "attribution to show. Available for Spain (ES, PV, NA), Portugal, France, Italy and Germany.",
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
        const { data } = await client.getGroundMotion(reference, country);
        return jsonResult({
          reference: data.refcat,
          country: data.country,
          status: data.status,
          reason: data.reason,
          period: data.period.label,
          ground_motion: data.ground_motion,
          source: data.source,
          calculated_at: data.calculated_at,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
