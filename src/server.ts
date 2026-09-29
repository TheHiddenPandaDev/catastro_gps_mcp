import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CatastroGPSClient } from "./client/catastrogps-api.js";
import { registerGetParcel } from "./tools/get-parcel.js";
import { registerSearchAddress } from "./tools/search-address.js";
import { registerGetBoundaries } from "./tools/get-boundaries.js";
import { registerGetSolar } from "./tools/get-solar.js";
import { registerGetAgriculture } from "./tools/get-agriculture.js";
import { registerGetMarket } from "./tools/get-market.js";
import { registerGetScore } from "./tools/get-score.js";
import { registerGetValueHistory } from "./tools/get-value-history.js";
import { registerCompareParcels } from "./tools/compare-parcels.js";
import { SERVER_VERSION } from "./version.js";
import type { ServerConfig } from "./types/index.js";

export const DEFAULT_API_URL = "https://api.parcelgps.com";
export const DEFAULT_TIMEOUT_MS = 20000;

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "catastrogps",
    version: SERVER_VERSION,
  });

  const client = new CatastroGPSClient(config);

  registerGetParcel(server, client);
  registerSearchAddress(server, client);
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
        "Get a free key (250 calls/month, failed lookups are free) at https://catastrogps.es/developers",
    );
    process.exit(1);
  }

  const timeout = parseInt(process.env.CATASTROGPS_TIMEOUT || "", 10);

  return {
    apiKey,
    apiUrl: process.env.CATASTROGPS_API_URL || DEFAULT_API_URL,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}
