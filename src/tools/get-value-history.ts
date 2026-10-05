import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { VALUE_HISTORY_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetValueHistory(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_value_history",
    {
      title: "Get Parcel History",
      description:
        "Snapshots of a parcel as the official cadastre reported it over time: area and land use, " +
        "at most one snapshot every 30 days. History starts the first time anyone looks the parcel " +
        "up through CatastroGPS (get_parcel) and grows from there, so a parcel never queried before " +
        "returns an empty list. The official cadastral value is not recorded yet (always null). " +
        "change_pct is the area change between the oldest and newest snapshot. Recorded for ES, PV, " +
        "NA, PT, FR, IT, DE and AT. One API call.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(VALUE_HISTORY_COUNTRIES)
          .optional()
          .describe("Optional country code: ES, PV, NA, PT, FR, IT, DE or AT. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data, quota } = await client.getValueHistory(reference, country);
        const entries = data.entries ?? [];
        return jsonResult({
          reference: data.refcat ?? reference,
          country: data.country ?? country ?? null,
          snapshots: entries.map((entry) => ({
            date: entry.fecha_captura ?? null,
            area_m2: entry.superficie ?? null,
            land_use: entry.uso || null,
            cadastral_value_eur: entry.valor_catastral ? entry.valor_catastral : null,
            source: entry.fuente ?? null,
          })),
          total: data.totalEntries ?? entries.length,
          change_pct: data.variacionPct ?? null,
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
