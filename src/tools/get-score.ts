import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

type FactorLevel = "high" | "medium" | "low" | "not_available";

const FACTOR_NAMES = ["solar", "agriculture", "market", "accessibility", "risk"] as const;

const HIGH_FROM = 7;
const MEDIUM_FROM = 4;

export function factorLevel(value: number | undefined): FactorLevel {
  if (value === undefined || value <= 0) return "not_available";
  if (value >= HIGH_FROM) return "high";
  if (value >= MEDIUM_FROM) return "medium";
  return "low";
}

export function qualitativeFactors(components: Record<string, number> | undefined): Record<string, FactorLevel> {
  const factors: Record<string, FactorLevel> = {};
  for (const name of FACTOR_NAMES) {
    factors[name] = factorLevel(components?.[name]);
  }
  return factors;
}

export function registerGetScore(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_investment_score",
    {
      title: "Get Investment Score",
      description:
        "Investment score (0-100) for a parcel with a rating (excellent, good, moderate, low, " +
        "very_low or no_data) and qualitative factor levels (high/medium/low/not_available), never the formula. " +
        "Built from the data the API can gather for that country: solar potential (PVGIS) and " +
        "agricultural use in ES, PV, NA, PT, FR, IT and DE; the market factor only in France, Italy " +
        "and Germany (North Rhine-Westphalia). Accessibility and risk are not computed yet and come " +
        "back as not_available, so the score is relative to the factors that were available. " +
        "Other countries are not supported. One API call.",
      inputSchema: {
        reference: z.string().min(1).describe("Official cadastral reference"),
        country: z
          .enum(ENRICHMENT_COUNTRIES)
          .optional()
          .describe("Optional country code: ES, PV, NA, PT, FR, IT or DE. Omit to auto-detect."),
      },
    },
    async ({ reference, country }) => {
      try {
        const { data, quota } = await client.getInvestmentScore(reference, country);
        const s = data;
        return jsonResult({
          reference,
          country: country ?? null,
          score: s.score,
          rating: s.rating,
          recommendation: s.recommendation ?? null,
          factors: qualitativeFactors(s.components),
          risk_factors: s.riskFactors ?? [],
          opportunity_factors: s.opportunityFactors ?? [],
          note: "Score based on the data available for this parcel. Factor levels are qualitative.",
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
