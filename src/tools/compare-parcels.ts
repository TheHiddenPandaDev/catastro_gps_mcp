import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { COMPARE_COUNTRIES, type CompareItem } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

function summarize(item: CompareItem) {
  if (item.error) {
    return { reference: item.reference, country: item.country, error: item.error };
  }
  const parcel = item.parcel ?? {};
  const solar = item.solar;
  const agro = item.agriculture;
  return {
    reference: item.reference,
    country: item.country,
    latitude: parcel.latitude ?? null,
    longitude: parcel.longitude ?? null,
    area_m2: parcel.parcelArea || null,
    land_use: parcel.use || null,
    municipality: parcel.municipality || null,
    solar: solar?.available
      ? { production_kwh_year: solar.annualProductionKwh ?? null, installable_kwp: solar.installableKw ?? null, solar_grade: solar.solarGrade ?? null }
      : null,
    agriculture: agro?.available
      ? { is_agricultural: agro.isAgricultural ?? null, land_use: agro.landUse || null, crop_group: agro.cropGroup || null }
      : null,
    score: item.score?.available ? { value: item.score.score ?? null, rating: item.score.rating ?? null } : null,
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
        const items = data.parcels ?? [];
        return jsonResult({ total: data.total ?? items.length, parcels: items.map(summarize) }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
