import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerListMunicipalities(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "list_municipalities",
    {
      title: "List Spanish Municipalities",
      description:
        "Municipalities of one Spanish province, with the cadastre code and the INE code. Spain only " +
        "(common territory). Take the province name from list_provinces. One API call.",
      inputSchema: {
        region: z.string().trim().min(1).describe("Province name as returned by list_provinces (e.g. CIUDAD REAL)"),
      },
    },
    async ({ region }) => {
      try {
        const { data, quota } = await client.listMunicipalities(region);
        return jsonResult({ region, total: data.total, municipalities: data.municipalities ?? [] }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
