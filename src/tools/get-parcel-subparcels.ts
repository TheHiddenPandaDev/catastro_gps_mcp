import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { CROP_LANGUAGES, REFERENCE_COUNTRIES } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

export function registerGetParcelSubparcels(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_parcel_subparcels",
    {
      title: "Get Parcel Subparcels",
      description:
        "What is on each part of a parcel: every crop or land-use subparcel with a stable crop_code, the " +
        "crop name in the requested language, the original label of the source, area in m2, kind " +
        "(cadastral, declaredCrop, landCover), a common use_class (arable, vineyard, olive, forest...), " +
        "intensity, land type and class, source and, with include_geometry, its GeoJSON outline. " +
        "Spain (Catastro, including Bizkaia, Alava, Navarre; Gipuzkoa without outlines), Austria, " +
        "Germany, Czechia, the Netherlands, France, Portugal, Sweden, Switzerland, Finland, Belgium, " +
        "Ireland, Slovenia, Estonia and Greece. One API call; free when the parcel has none. If the source does not " +
        "answer it returns SUB_001: nothing is charged, retry in a few seconds. Translate codes with " +
        "get_crop_catalog.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference of the parcel"),
        country: z
          .enum(REFERENCE_COUNTRIES)
          .optional()
          .describe("Optional country code (ES, PV, NA, AT, EE, GR...). Omit to auto-detect."),
        lang: z.enum(CROP_LANGUAGES).optional().describe("Language of crop names (default English)"),
        include_geometry: z
          .boolean()
          .optional()
          .describe("Include the GeoJSON outline of each subparcel (large). Default false."),
      },
    },
    async ({ reference, country, lang, include_geometry }) => {
      try {
        const { data: d, quota } = await client.getSubparcels(reference, country, lang);
        return jsonResult({
          reference: d.reference,
          country: d.country ?? country ?? null,
          parcel_area_m2: d.parcelArea ?? null,
          count: d.count,
          subparcels: (d.subparcels ?? []).map((row) => compact({
            id: row.id,
            crop_code: row.cropCode,
            crop: row.crop,
            crop_original: row.cropOriginal,
            area_m2: row.area,
            kind: row.kind,
            use_class: row.useClass,
            use_class_name: row.useClassName,
            intensity: row.intensity,
            land_type: row.landType,
            land_class: row.landClass,
            source: row.source,
            geometry: include_geometry ? row.geometry : undefined,
          })),
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
