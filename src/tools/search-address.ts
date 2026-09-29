import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

export function registerSearchAddress(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "search_address",
    {
      title: "Search Address (Spain)",
      description:
        "Find the Spanish cadastral reference for a postal address typed as free text, e.g. " +
        "'Calle Mallorca 213, Barcelona' or 'Avenida de la Constitución 1, 41004 Sevilla'. " +
        "Works for Spain under the central Catastro (not the Basque Country or Navarre, and not " +
        "other countries: use get_parcel with coordinates there). Include the street number and " +
        "the municipality or postal code. Then call get_parcel with the returned reference and country ES.",
      inputSchema: {
        address: z
          .string()
          .min(3)
          .max(300)
          .describe("Free-text Spanish address: street, number, municipality and/or postal code"),
      },
    },
    async ({ address }) => {
      try {
        const { data: d } = await client.searchAddress(address);
        return jsonResult(compact({
          reference: d.referenciaCatastral,
          parcel_reference: d.refCat14,
          country: "ES",
          address: d.direccion,
          street_type: d.tipoVia,
          street: d.nombreVia,
          number: d.numero,
          floor: d.planta,
          door: d.puerta,
          postal_code: d.codigoPostal,
          municipality: d.municipio,
          province: d.provincia,
        }));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
