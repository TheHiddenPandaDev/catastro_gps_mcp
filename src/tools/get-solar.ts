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
          available: d.disponible,
          status: d.estado,
          installable_kwp: d.kw_instalables,
          production_kwh_year: d.kwh_year,
          savings_eur_year: d.ahorro_anual_eur,
          payback_years: d.amortizacion_anos,
          installation_cost_eur: d.costo_instalacion_eur ?? null,
          co2_avoided_kg_year: d.co2_evitado_kg,
          mean_irradiation: d.irradiacion_media,
          solar_grade: d.nota_solar,
          optimal_orientation: d.orientacion_optima ?? null,
          optimal_tilt_deg: d.angulo_inclinacion ?? null,
          source: d.fuente ?? "PVGIS",
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
