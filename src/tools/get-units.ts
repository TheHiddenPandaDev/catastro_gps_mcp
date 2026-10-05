import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { UNITS_COUNTRIES, type Construction, type Unit } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

function unit(item: Unit) {
  return compact({
    reference: item.refCatastral,
    stair: item.escalera,
    floor: item.planta,
    door: item.puerta,
    use: item.uso,
    area_m2: item.superficie,
    participation_pct: item.participacion,
    year: item.anio,
    description: item.descripcion,
  });
}

function construction(item: Construction) {
  return compact({
    stair: item.escalera,
    floor: item.planta,
    door: item.puerta,
    use: item.uso,
    area_m2: item.superficie,
    description: item.descripcion,
  });
}

export function registerGetUnits(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_units",
    {
      title: "Get Units of a Building (Spain)",
      description:
        "Every unit (dwelling, shop, garage, storage) of a Spanish building (finca), up to 200 per page, " +
        "with stair, floor, door, use, area, participation coefficient and year. Spain only: ES (14-character " +
        "finca reference, e.g. from search_address), PV (Basque Country) and NA (Navarre) with the foral " +
        "reference of any unit or the finca key; the foral data carry no participation coefficient. When " +
        "truncated is true, call again with cursor = next_cursor. Costs one quota unit per unit served " +
        "(minimum 1 per page), so a 120-dwelling building costs 120 units; repeat pages within the plan's " +
        "per-finca cap (Startup/Growth contracts) are free.",
      inputSchema: {
        reference: z.string().min(6).max(25)
          .describe("ES: 14-character finca reference. PV/NA: foral unit reference or finca key"),
        country: z.enum(UNITS_COUNTRIES).optional()
          .describe("ES (default), PV or NA. Optional for foral references detected by their shape"),
        cursor: z.string().regex(/^[0-9A-Z]{6,24}$/).optional()
          .describe("next_cursor of the previous page"),
      },
    },
    async ({ reference, country, cursor }) => {
      try {
        const { data, quota } = await client.getUnits(reference, country, cursor);
        const units = data.unidades ?? [];
        return jsonResult(compact({
          reference: data.refCatastral,
          address: data.direccion,
          postal_code: data.codigoPostal,
          municipality: data.municipio,
          province: data.provincia,
          general_use: data.usoGeneral,
          construction_year: data.anioConstruccion,
          total_units_in_finca: data.totalUnidadesFinca ?? units.length,
          units_in_page: units.length,
          units: units.map(unit),
          constructions: (data.construcciones ?? []).map(construction),
          truncated: data.truncated ?? false,
          next_cursor: data.truncated ? data.nextCursor : undefined,
          data_source: data.dataSource,
          data_date: data.dataDate,
          attribution: data.attribution,
        }), quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
