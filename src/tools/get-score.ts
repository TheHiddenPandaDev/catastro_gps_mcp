import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ENRICHMENT_COUNTRIES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

type FactorLevel = "high" | "medium" | "low" | "not_available";

const FACTOR_NAMES: Record<string, string> = {
  viabilidad_solar: "solar",
  potencial_agricola: "agriculture",
  valor_mercado: "market",
  demanda_terreno: "accessibility",
  estabilidad_politica: "risk",
};

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
  for (const [apiName, name] of Object.entries(FACTOR_NAMES)) {
    factors[name] = factorLevel(components?.[apiName]);
  }
  return factors;
}

export function registerGetScore(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_investment_score",
    {
      title: "Get Investment Score",
      description:
        "Investment score (0-100) for a parcel with a rating (excelente, bueno, moderado, bajo, " +
        "muy_bajo) and qualitative factor levels (high/medium/low/not_available), never the formula. " +
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
        const { data } = await client.getInvestmentScore(reference, country);
        const s = data.score_inversion;
        return jsonResult({
          reference,
          country: country ?? null,
          score: s.puntuacion,
          rating: s.clasificacion,
          recommendation: s.recomendacion ?? null,
          factors: qualitativeFactors(s.componentes),
          risk_factors: s.factores_riesgo ?? [],
          opportunity_factors: s.factores_oportunidad ?? [],
          note: "Score based on the data available for this parcel. Factor levels are qualitative.",
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
