import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { REFERENCE_COUNTRIES } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

export function registerGetBoundaries(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_boundaries",
    {
      title: "Get Parcel Boundaries",
      description:
        "Get the outline of a cadastral parcel as GeoJSON and/or a [lat, lng] ring, plus its " +
        "centroid and area, for mapping and GIS work. Accepts references from the same 30 " +
        "codes as get_parcel (every covered country except the United Kingdom, which is coordinates only).",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(REFERENCE_COUNTRIES)
          .optional()
          .describe("Optional country code. Omit to auto-detect from the reference format."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data: d } = await client.getPolygon(reference, country);
        return jsonResult(compact({
          reference: d.refCatastral || d.refcat || reference,
          country: d.pais || country,
          latitude: d.latitud ?? d.centroid?.latitude,
          longitude: d.longitud ?? d.centroid?.longitude,
          area_m2: d.area || d.superficieParcela,
          outline_lat_lng: d.poligono,
          geojson: d.geojson,
        }));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
