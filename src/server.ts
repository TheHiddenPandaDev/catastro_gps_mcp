import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CatastroGPSClient } from "./client/catastrogps-api.js";
import { registerGetParcel } from "./tools/get-parcel.js";
import { registerGetSolar } from "./tools/get-solar.js";
import { registerGetAgriculture } from "./tools/get-agriculture.js";
import { registerGetMarket } from "./tools/get-market.js";
import { registerGetScore } from "./tools/get-score.js";
import { registerGetValueHistory } from "./tools/get-value-history.js";
import { registerCompareParcels } from "./tools/compare-parcels.js";
import { registerGetBoundaries } from "./tools/get-boundaries.js";
import type { ServerConfig } from "./types/index.js";

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "catastrogps",
    version: "1.0.0",
  });

  const client = new CatastroGPSClient(config);

  // Register all 8 tools
  registerGetParcel(server, client);
  registerGetBoundaries(server, client);
  registerGetSolar(server, client);
  registerGetAgriculture(server, client);
  registerGetMarket(server, client);
  registerGetScore(server, client);
  registerGetValueHistory(server, client);
  registerCompareParcels(server, client);

  return server;
}

export function loadConfig(): ServerConfig {
  const apiKey = process.env.CATASTROGPS_API_KEY;
  if (!apiKey) {
    console.error(
      "[catastro-gps-mcp] ERROR: CATASTROGPS_API_KEY environment variable is required.\n" +
        "Get your API key at https://catastrogps.es/api",
    );
    process.exit(1);
  }

  return {
    apiKey,
    apiUrl: process.env.CATASTROGPS_API_URL || "https://api.catastrogps.es",
    timeout: parseInt(process.env.CATASTROGPS_TIMEOUT || "10000", 10),
  };
}
