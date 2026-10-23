import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { CROP_LANGUAGES, SIGPAC_COUNTRIES } from "../types/index.js";
import type { SIGPACEnclosure } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

function mapEnclosure(row: SIGPACEnclosure, includeGeometry: boolean | undefined): Record<string, unknown> {
  return {
    ...compact({
      id: row.id,
      enclosure: row.enclosure,
      land_use_code: row.landUseCode,
      land_use: row.landUse,
      crop_code: row.cropCode,
      use_class: row.useClass,
      use_class_name: row.useClassName,
      area_ha: row.areaHa,
    }),
    irrigation_pct: row.irrigationPct ?? null,
    mean_slope_pct: row.meanSlopePct ?? null,
    altitude_m: row.altitudeM ?? null,
    pasture_eligibility_pct: row.pastureEligibilityPct ?? null,
    cap_region: row.capRegion ?? null,
    incidents: row.incidents ?? [],
    ...(includeGeometry ? { geometry: row.geometry ?? null } : {}),
  };
}

export function registerGetParcelSIGPAC(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_parcel_sigpac",
    {
      title: "Get Parcel SIGPAC Enclosures",
      description:
        "Every SIGPAC enclosure (recinto) of a Spanish parcel, the CAP land parcel identification system: " +
        "SIGPAC id, land-use code (TA, OV, VI, FY, PS...) with its name in the requested language, area in " +
        "hectares, irrigation coefficient, mean slope, altitude, CAP pasture eligibility and region, " +
        "incidents with their official text and, with include_geometry, the GeoJSON outline. Spain, the " +
        "Basque Country and Navarre only; other countries answer CNV_COVERAGE. match tells whether the " +
        "SIGPAC parcel was found by the cadastral reference or under the parcel's point. Source FEGA " +
        "SIGPAC: cite 'Fuente: FEGA - SIGPAC'. One API call; free when there are no enclosures. If SIGPAC " +
        "does not answer it returns SIG_001: nothing is charged, retry in a few seconds.",
      inputSchema: {
        reference: z.string().min(1).describe("Official Spanish cadastral reference of the parcel or unit"),
        country: z
          .enum(SIGPAC_COUNTRIES)
          .optional()
          .describe("Optional: ES, PV (Basque Country) or NA (Navarre). Omit to auto-detect."),
        lang: z.enum(CROP_LANGUAGES).optional().describe("Language of land-use names (default English)"),
        include_geometry: z
          .boolean()
          .optional()
          .describe("Include the GeoJSON outline of each enclosure (large). Default false."),
      },
    },
    async ({ reference, country, lang, include_geometry }) => {
      try {
        const { data: d, quota } = await client.getSIGPAC(reference, country, lang);
        const parcel = d.sigpacParcel;
        return jsonResult({
          reference: d.reference,
          country: d.country ?? country ?? null,
          sigpac_parcel: parcel
            ? {
              province: parcel.province,
              municipality: parcel.municipality,
              aggregate: parcel.aggregate,
              zone: parcel.zone,
              polygon: parcel.polygon,
              parcel: parcel.parcel,
            }
            : null,
          match: d.match ?? null,
          count: d.count,
          total_area_ha: d.totalAreaHa,
          crs: d.crs,
          retrieved_at: d.retrievedAt ?? null,
          attribution: d.source?.attribution ?? null,
          license: d.source?.license ?? null,
          enclosures: (d.enclosures ?? []).map((row) => mapEnclosure(row, include_geometry)),
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
