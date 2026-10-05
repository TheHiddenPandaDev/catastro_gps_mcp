import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { COMPARE_COUNTRIES, type CompareItem } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

function summarize(item: CompareItem) {
  if (item.error) {
    return { reference: item.ref_catastral, country: item.country, error: item.error };
  }
  const parcel = item.parcela ?? {};
  const solar = item.solar;
  const agro = item.agro;
  return {
    reference: item.ref_catastral,
    country: item.country,
    latitude: parcel.latitud ?? null,
    longitude: parcel.longitud ?? null,
    area_m2: parcel.superficieParcela || null,
    land_use: parcel.uso || null,
    municipality: parcel.municipio || null,
    solar: solar?.disponible
      ? { production_kwh_year: solar.kwh_year ?? null, installable_kwp: solar.kw_instalables ?? null, solar_grade: solar.nota_solar ?? null }
      : null,
    agriculture: agro?.disponible
      ? { is_agricultural: agro.es_agricola ?? null, land_use: agro.uso_suelo?.descripcion || null, crop_group: agro.uso_suelo?.grupo || null }
      : null,
    score: item.score?.disponible ? { value: item.score.score_global ?? null, rating: item.score.clasificacion ?? null } : null,
  };
}

export function registerCompareParcels(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "compare_parcels",
    {
      title: "Compare Parcels",
      description:
        "Compare 2 or 3 parcels side by side: location, solar potential, agricultural use and " +
        "investment score (0-100 with rating). Parcels can be in different countries: ES (Spain, " +
        "common regime), PT, FR, IT and DE. The Basque Country and Navarre are not supported here " +
        "(use the single-parcel tools). Area, land use and municipality are only filled for Spain. " +
        "No market prices. A parcel that is not found comes back with an error and the others are " +
        "still compared. Costs one quota unit per parcel found (0 to 3).",
      inputSchema: {
        parcels: z
          .array(
            z.object({
              reference: z.string().min(1).describe("Official cadastral reference"),
              country: z.enum(COMPARE_COUNTRIES).describe("Country code: ES, PT, FR, IT or DE"),
            }),
          )
          .min(2)
          .max(3)
          .describe("Two or three parcels to compare"),
      },
    },
    async ({ parcels }) => {
      try {
        const { data, quota } = await client.compareParcels(parcels);
        const items = data.comparacion ?? [];
        return jsonResult({ total: data.total ?? items.length, parcels: items.map(summarize) }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
