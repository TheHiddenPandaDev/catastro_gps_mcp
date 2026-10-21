import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { CROP_LANGUAGES } from "../types/index.js";
import { handleToolError, jsonResult } from "./shared.js";

export function registerGetCropCatalog(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_crop_catalog",
    {
      title: "Get Crop Catalog",
      description:
        "Free and without quota: every crop or land-use code that can appear as crop_code (Spanish " +
        "Catastro codes, the foral codes of Alava, Bizkaia, Gipuzkoa and Navarre, and the Austrian, " +
        "Estonian and Greek catalogues) with its name in the requested language, the original label " +
        "and its common use_class. Use it to translate or group crop codes; pass code to look one up.",
      inputSchema: {
        lang: z.enum(CROP_LANGUAGES).optional().describe("Language of the names (default English)"),
        code: z.string().min(1).optional().describe("Return only this crop code (e.g. G-, NA:1501, AT:53)"),
        source: z
          .string()
          .min(1)
          .optional()
          .describe("Return only codes of this catalogue: ES, AL, BI, GI, NA, AT, EE or GR"),
      },
    },
    async ({ lang, code, source }) => {
      try {
        const { data } = await client.getCropCatalog(lang);
        const crops = (data.crops ?? []).filter(
          (crop) => (!code || crop.code === code) && (!source || crop.source === source.toUpperCase()),
        );
        return jsonResult({
          locale: data.locale,
          locales: data.locales,
          sources: data.sources,
          count: crops.length,
          use_classes: (data.useClasses ?? []).map((useClass) => ({ code: useClass.code, name: useClass.name })),
          crops: crops.map((crop) => ({
            code: crop.code,
            source: crop.source,
            name: crop.name,
            original: crop.original,
            use_class: crop.useClass ?? null,
          })),
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
