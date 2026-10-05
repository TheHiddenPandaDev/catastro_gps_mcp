import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import { ADDRESS_COUNTRIES, type AddressCandidate } from "../types/index.js";
import { compact, handleToolError, jsonResult } from "./shared.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function candidate(item: AddressCandidate) {
  return compact({
    reference: item.refCatastral,
    country: item.pais,
    address: item.direccion,
    number: item.numero,
    postal_code: item.codigoPostal,
    municipality: item.municipio,
    province: item.provincia,
    latitude: item.latitud,
    longitude: item.longitud,
    confidence: item.confianza,
    number_matches: item.coincideNumero,
    municipality_matches: item.coincideMunicipio,
    use: item.uso,
    dwellings: item.viviendas,
    construction_year: item.anioConstruccion,
  });
}

export function registerSearchAddress(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "search_address",
    {
      title: "Search Address",
      description:
        "Turn a postal address typed as free text into cadastral parcels, ranked by confidence (0 to 1; " +
        "0.75 or more means the house number and the municipality match). Spain (default, CartoCiudad; " +
        "Basque Country and Navarre entrances come back with country ES and their foral reference) and " +
        "26 more countries: FR, IT, DE (not Bavaria), AT, NL, BE, PL, CH, CZ, DK, NO, FI, EE, LV, LT, SI, SK, " +
        "BG, GR, CY, LU, LI, IS, IE, UK (Scotland only) and PT (not Lisbon, Porto or Coimbra). Sweden and " +
        "Croatia answer CNV_COVERAGE. Include the street number and the municipality or postcode, e.g. " +
        "'Calle Gran Via 31, Madrid' or '8 boulevard du Port, Amiens'. In Spain the 14-character reference " +
        "is the building (finca): call get_units for its dwellings or get_parcel for the outline. " +
        "Costs 1 quota unit when it returns candidates; misses are free.",
      inputSchema: {
        address: z
          .string()
          .min(3)
          .max(200)
          .describe("Free-text address: street and number, then municipality and/or postcode"),
        country: z
          .enum(ADDRESS_COUNTRIES)
          .optional()
          .describe("Country of the address. Default ES (also returns Basque Country and Navarre)."),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional()
          .describe(`Maximum candidates (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT})`),
      },
    },
    async ({ address, country, limit }) => {
      try {
        const { data, quota } = await client.searchAddressCandidates(address, country, limit);
        const candidates = data.candidatos ?? [];
        return jsonResult({
          query: data.consulta?.texto ?? address,
          country: country ?? "ES",
          total: candidates.length,
          candidates: candidates.map(candidate),
          attribution: data.attribution ?? null,
        }, quota);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
