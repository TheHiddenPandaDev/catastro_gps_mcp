import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetValueHistory(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_value_history",
    {
      title: "Get Cadastral Value History",
      description:
        "Get the historical cadastral value for a parcel. " +
        "History accumulates over time from the first query onwards. " +
        "Useful for tracking value trends.",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getValueHistory(reference, country);
        const data = response.data;

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
