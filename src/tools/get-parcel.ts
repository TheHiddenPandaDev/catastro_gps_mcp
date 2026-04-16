import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetParcel(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_parcel",
    {
      title: "Get Parcel Data",
      description:
        "Get cadastral data for a parcel by reference code or GPS coordinates. " +
        "Returns address, municipality, area, land use, and construction year. " +
        "Supports Spain (ES), Basque Country (PV), Navarra (NA), Portugal (PT), France (FR), Italy (IT), Germany (DE).",
      inputSchema: {
        reference: z
          .string()
          .optional()
          .describe("Cadastral reference code (format varies by country)"),
        latitude: z
          .number()
          .min(-90)
          .max(90)
          .optional()
          .describe("Latitude in WGS84 (alternative to reference)"),
        longitude: z
          .number()
          .min(-180)
          .max(180)
          .optional()
          .describe("Longitude in WGS84 (alternative to reference)"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, latitude, longitude, country }) => {
      try {
        if (!reference && (latitude === undefined || longitude === undefined)) {
          return {
            content: [
              {
                type: "text" as const,
                text: "MCP_001: Provide either 'reference' or both 'latitude' and 'longitude'.",
              },
            ],
            isError: true,
          };
        }

        if (reference) {
          const response = await client.getParcelByReference(reference, country);
          const d = response.data;

          const result = {
            reference: d.refCatastral,
            country: d.pais || country,
            latitude: d.latitud,
            longitude: d.longitud,
            address: d.direccion || null,
            postal_code: d.codigoPostal || null,
            municipality: d.municipio || null,
            province: d.provincia || null,
            area_m2: d.superficieParcela || null,
            built_area_m2: d.superficieConstruida || null,
            land_use: d.uso || null,
            land_class: d.clase || null,
            construction_year: d.anioConstruccion || null,
            google_maps_url: d.googleMapsUrl,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } else {
          const response = await client.getParcelByCoordinates(latitude!, longitude!, country);
          const d = response.data;

          const result = {
            reference: d.referenciaCatastral,
            country,
            latitude: d.coordenadas.latitud,
            longitude: d.coordenadas.longitud,
            address: d.direccion || null,
            municipality: d.municipio || null,
            google_maps_url: d.googleMapsUrl,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
