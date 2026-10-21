import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerListProvinces(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "list_provinces",
    {
      title: "List Spanish Provinces",
      description:
        "Provinces of the Spanish cadastre, with the names that list_municipalities and list_streets " +
        "expect as region. Spain only (common territory: the Basque Country and Navarre have their own " +
        "cadastres and are not listed). One API call.",
      inputSchema: {},
    },
    async () => {
      try {
        const { data, quota } = await client.listProvinces();
        return jsonResult({ total: data.total, provinces: data.provinces ?? [] }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
