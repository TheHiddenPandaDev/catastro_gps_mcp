import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { COUNTRY_CODES_TEXT, CROP_LANGUAGES, SUPPORTED_COUNTRIES } from "../types/index.js";
import { compact, errorResult, handleToolError, jsonResult } from "./shared.js";

export function registerGetParcel(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_parcel",
    {
      title: "Get Parcel",
      description:
        "Look up a cadastral parcel in 29 European countries (including the Basque Country and Navarre " +
        "foral cadastres) by its official cadastral reference or by WGS84 coordinates. Returns the " +
        "reference, location, address, municipality, area, land use and the parcel outline when " +
        "the official source provides them. The country is detected from the reference format or " +
        "the point when omitted. Where the parcel has crop or land-use parts it also returns their count " +
        "and a crop summary (crop and share of the area); the full list with outlines is " +
        "get_parcel_subparcels. United Kingdom: coordinates only. Codes: " + COUNTRY_CODES_TEXT + ".",
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
        lang: z.enum(CROP_LANGUAGES).optional().describe("Language of crop names (default English)"),
      },
    },
    async ({ reference, latitude, longitude, country, lang }) => {
      try {
        if (reference) {
          if (country === "UK") {
            return errorResult("MCP_002", "United Kingdom parcels can only be looked up by coordinates.");
          }
          const { data: d, quota } = await client.getParcelByReference(reference, country, lang);
          return jsonResult(compact({
            reference: d.reference,
            country: d.country || country,
            latitude: d.latitude,
            longitude: d.longitude,
            address: d.address,
            postal_code: d.postalCode,
            municipality: d.municipality,
            region: d.region,
            area_m2: d.parcelArea,
            built_area_m2: d.builtArea,
            land_use: d.use,
            land_class: d.landClass,
            construction_year: d.yearBuilt,
            source: d.source,
            outline_lat_lng: d.polygon,
            subparcel_count: d.subparcelCount,
            crop_summary: d.cropSummary?.map((crop) => compact({
              crop_code: crop.cropCode,
              crop: crop.crop,
              crop_original: crop.cropOriginal,
              use_class: crop.useClass,
              area_m2: crop.area,
              share: crop.share,
            })),
            google_maps_url: d.googleMapsUrl,
          }), quota);
        }

        if (latitude === undefined || longitude === undefined) {
          return errorResult("MCP_001", "Provide either 'reference' or both 'latitude' and 'longitude'.");
        }

        const { data: d, quota } = await client.getParcelByCoordinates(latitude, longitude, country);
        return jsonResult(compact({
          reference: d.reference,
          parcel_reference: d.parcelReference,
          country: d.country || country,
          latitude: d.latitude,
          longitude: d.longitude,
          address: d.address,
          postal_code: d.postalCode,
          municipality: d.municipality,
          region: d.region,
          area_m2: d.parcelArea,
          property_type: d.propertyType,
          google_maps_url: d.googleMapsUrl,
        }), quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
