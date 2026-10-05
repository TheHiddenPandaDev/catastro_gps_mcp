import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { COUNTRY_CODES_TEXT, SUPPORTED_COUNTRIES } from "../types/index.js";
import { compact, errorResult, handleToolError, jsonResult } from "./shared.js";

export function registerGetParcel(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_parcel",
    {
      title: "Get Parcel",
      description:
        "Look up a cadastral parcel in 29 European countries (31 official cadastres, including the " +
        "Basque Country and Navarre) by its official cadastral reference or by WGS84 coordinates. Returns the " +
        "reference, location, address, municipality, area, land use and the parcel outline when " +
        "the official source provides them. The country is detected from the reference format or " +
        "the point when omitted. United Kingdom: coordinates only. Codes: " + COUNTRY_CODES_TEXT + ".",
      inputSchema: {
        reference: z
          .string()
          .min(1)
          .optional()
          .describe("Official cadastral reference as written in the country (e.g. 9872023VH5797S0001WX, 750560000AB0001)"),
        latitude: z.number().min(-90).max(90).optional().describe("Latitude in WGS84 (use with longitude instead of reference)"),
        longitude: z.number().min(-180).max(180).optional().describe("Longitude in WGS84 (use with latitude instead of reference)"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .optional()
          .describe("Optional country code. Omit to auto-detect. PV and NA are the Spanish foral cadastres."),
      },
    },
    async ({ reference, latitude, longitude, country }) => {
      try {
        if (reference) {
          if (country === "UK") {
            return errorResult("MCP_002", "United Kingdom parcels can only be looked up by coordinates.");
          }
          const { data: d, quota } = await client.getParcelByReference(reference, country);
          return jsonResult(compact({
            reference: d.refCatastral,
            country: d.pais || country,
            latitude: d.latitud,
            longitude: d.longitud,
            address: d.direccion,
            postal_code: d.codigoPostal,
            municipality: d.municipio,
            province: d.provincia,
            area_m2: d.superficieParcela,
            built_area_m2: d.superficieConstruida,
            land_use: d.uso,
            land_class: d.clase,
            construction_year: d.anioConstruccion,
            source: d.fuenteDatos,
            outline_lat_lng: d.poligono,
            google_maps_url: d.googleMapsUrl,
          }), quota);
        }

        if (latitude === undefined || longitude === undefined) {
          return errorResult("MCP_001", "Provide either 'reference' or both 'latitude' and 'longitude'.");
        }

        const { data: d, quota } = await client.getParcelByCoordinates(latitude, longitude, country);
        return jsonResult(compact({
          reference: d.referenciaCatastral || d.refCatastral,
          country: d.pais || country,
          latitude: d.coordenadas?.latitud,
          longitude: d.coordenadas?.longitud,
          address: d.direccion,
          postal_code: d.codigoPostal,
          municipality: d.municipio,
          province: d.provincia,
          area_m2: d.superficieParcela,
          property_type: d.tipoInmueble,
          google_maps_url: d.googleMapsUrl,
        }), quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
