import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { REFERENCE_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetNeighbors(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_neighbors",
    {
      title: "Get Neighboring Parcels",
      description:
        "Parcels that touch or surround a parcel (up to 60), each with its cadastral reference and " +
        "centre point. Spain from the official cadastre; other countries from our own copy where we " +
        "hold one. Where neighbours cannot be listed it answers supported=false with an empty list, " +
        "free. One API call.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference of the parcel"),
        country: z.enum(REFERENCE_COUNTRIES).optional().describe("Optional country code. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data: d, quota } = await client.getNeighbors(reference, country);
        return jsonResult({
          reference,
          country: d.country ?? country ?? null,
          supported: d.supported,
          count: d.count,
          neighbors: d.neighbors ?? [],
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
