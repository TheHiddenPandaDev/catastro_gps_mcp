import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetSolar(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_solar_potential",
    {
      title: "Get Solar Potential",
      description:
        "Estimate the photovoltaic potential of a parcel from PVGIS (European Commission JRC): " +
        "installable kWp, yearly production, savings, payback, CO2 avoided, optimal tilt and orientation. " +
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
        const { data: d, quota } = await client.getSolarPotential(reference, country);
        return jsonResult({
          available: d.available,
          status: d.status,
          installable_kwp: d.installableKw,
          production_kwh_year: d.annualProductionKwh,
          savings_eur_year: d.annualSavingsEur,
          payback_years: d.paybackYears,
          installation_cost_eur: d.installationCostEur ?? null,
          co2_avoided_kg_year: d.co2AvoidedKg,
          mean_irradiation: d.irradiationKwhM2,
          solar_grade: d.solarGrade,
          optimal_orientation: d.optimalOrientation ?? null,
          optimal_tilt_deg: d.tiltAngleDeg ?? null,
          source: d.source ?? "PVGIS",
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
