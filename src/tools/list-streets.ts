import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerListStreets(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "list_streets",
    {
      title: "List Spanish Streets",
      description:
        "Streets of one Spanish municipality as the cadastre writes them (type code such as CL or AV, " +
        "name and full name), optionally filtered by part of the name. Spain only (common territory). " +
        "Take region from list_provinces and municipality from list_municipalities. One API call.",
      inputSchema: {
        region: z.string().trim().min(1).describe("Province name as returned by list_provinces"),
        municipality: z.string().trim().min(1).describe("Municipality name as returned by list_municipalities"),
        name: z.string().trim().min(1).optional().describe("Part of the street name to filter by"),
      },
    },
    async ({ region, municipality, name }) => {
      try {
        const { data, quota } = await client.listStreets(region, municipality, name);
        return jsonResult({ region, municipality, total: data.total, streets: data.streets ?? [] }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
