import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { SUPPORTED_COUNTRIES } from "../types/index.js";
import { handleToolError } from "./shared.js";

export function registerGetScore(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_investment_score",
    {
      title: "Get Investment Score",
      description:
        "Calculate an investment score (1-10) for a parcel based on multiple factors " +
        "including location, solar potential, market trends, agricultural value, " +
        "and data completeness. Returns the score and qualitative factor levels only.",
      inputSchema: {
        reference: z.string().describe("Cadastral reference code"),
        country: z
          .enum(SUPPORTED_COUNTRIES)
          .describe("Country code: ES, PT, FR, IT, DE, PV, NA"),
      },
    },
    async ({ reference, country }) => {
      try {
        const response = await client.getInvestmentScore(reference, country);
        const data = response.data;

        // Only expose score + qualitative factors. Never the formula.
        const result = {
          score: data.score,
          rating: data.rating,
          factors: data.factores,
          note: "Score based on available data. Factor levels are qualitative (high/medium/low).",
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
