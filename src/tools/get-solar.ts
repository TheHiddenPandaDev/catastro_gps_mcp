import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetSolar(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_solar_potential",
    {
      title: "Get Solar Potential",
      description:
        "Calculate solar energy potential for a parcel using PVGIS data (JRC European Commission). " +
        "Returns annual radiation, optimal panel angle, estimated yearly production, and monthly breakdown.",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getSolarPotential(reference, country);
        const data = response.data;

        const result = {
          kwh_year: data.kwh_year,
          kw_instalables: data.kw_instalables,
          ahorro_anual_eur: data.ahorro_anual_eur,
          amortizacion_anos: data.amortizacion_anos,
          co2_evitado_kg: data.co2_evitado_kg,
          irradiacion_media: data.irradiacion_media,
          nota_solar: data.nota_solar,
          disponible: data.disponible,
          estado: data.estado,
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
