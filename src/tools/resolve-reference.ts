import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerResolveReference(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "resolve_reference",
    {
      title: "Identify a Reference",
      description:
        "Free and without quota: tell what a piece of text is before looking it up. Classifies it as a " +
        "cadastral reference, a coordinate pair or a place name, for each country it could belong to, " +
        "with confidence (0-1), the normalised form and whether that country is supported. ambiguous=true " +
        "means bare digits that fit several countries: pick one and pass it as country to get_parcel. " +
        "Use it when get_parcel answers CNV_AMBIGUOUS, or to find the country of an unknown reference.",
      inputSchema: {
        text: z.string().min(1).max(200).describe("Reference, coordinates or place name as typed"),
        hint: z.enum(SUPPORTED_COUNTRIES).optional()
          .describe("Optional country hint; it only reorders the candidates"),
      },
    },
    async ({ text, hint }) => {
      try {
        const { data } = await client.resolve(text, hint);
        const candidates = data.candidates ?? [];
        return jsonResult({
          input: data.input,
          ambiguous: data.ambiguous,
          best: candidates[0] ?? null,
          candidates,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
