import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetBoundaries(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_boundaries",
    {
      title: "Get Parcel Boundaries",
      description:
        "Get the polygon/GeoJSON boundaries of a cadastral parcel. " +
        "Returns coordinate arrays for mapping and GIS applications. " +
        "Supports all 7 countries/regions.",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getPolygon(reference, country);
        const d = response.data;

        const result = {
          reference: d.refCatastral,
          country: d.pais || country,
          latitude: d.latitud,
          longitude: d.longitud,
          polygon: d.poligono || null,
          geojson: d.geojson || null,
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
