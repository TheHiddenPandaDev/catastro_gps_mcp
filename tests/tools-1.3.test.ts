import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";

describe("tools added or widened in 1.3", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = installFetchMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
    client = await connectClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("get_units", () => {
    it("maps one page of units with the cursor and the per-finca cap", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          refCatastral: "0745901TG4304N",
          direccion: "AV JOSE RODRIGUEZ DE LA BORBOLLA 10",
          municipio: "DOS HERMANAS",
          provincia: "SEVILLA",
          totalUnidades: 1,
          totalUnidadesFinca: 312,
          unidades: [{
            refCatastral: "0745901TG4304N0002KH", escalera: "1", planta: "02", puerta: "B", uso: "Residencial",
            superficie: 92, descripcion: "VIVIENDA", participacion: 0.31, anio: 1975,
          }],
          construcciones: [{ escalera: "", planta: "-1", puerta: "", uso: "Almacen", superficie: 40, descripcion: "TRASTERO" }],
          truncated: true,
          nextCursor: "0745901TG4304N0002KH",
          dataSource: "clone",
          dataDate: "2026-07-01",
          attribution: "Direccion General del Catastro",
        },
      }), { status: 200, headers: { "X-Quota-Remaining": "100", "X-Quota-Finca-Cap": "50", "X-Quota-Finca-Cap-Used": "1" } }));

      const body = toolJson(await client.callTool({ name: "get_units", arguments: { reference: "0745901TG4304N" } }));

      expect(lastRequest(fetchMock).url.pathname).toBe("/api/catastro/0745901TG4304N/units");
      expect(body).toMatchObject({
        reference: "0745901TG4304N",
        total_units_in_finca: 312,
        units_in_page: 1,
        units: [{ reference: "0745901TG4304N0002KH", stair: "1", floor: "02", door: "B", area_m2: 92, participation_pct: 0.31, year: 1975 }],
        constructions: [{ floor: "-1", use: "Almacen", area_m2: 40 }],
        truncated: true,
        next_cursor: "0745901TG4304N0002KH",
        data_source: "clone",
        quota: { remaining: 100, finca_cap: 50, finca_cap_used: 1 },
      });
    });

    it("passes country and cursor and copes with an empty last page", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { refCatastral: "020-3-657", unidades: null, truncated: false, nextCursor: "ZZZZZZ" },
      }));

      const body = toolJson(await client.callTool({
        name: "get_units",
        arguments: { reference: "020-3-657", country: "PV", cursor: "N0714723L" },
      }));

      const req = lastRequest(fetchMock);
      expect(req.url.searchParams.get("country")).toBe("PV");
      expect(req.url.searchParams.get("cursor")).toBe("N0714723L");
      expect(body).toMatchObject({ total_units_in_finca: 0, units: [], constructions: [], truncated: false });
      expect(body).not.toHaveProperty("next_cursor");
    });

    it("rejects countries other than ES, PV and NA", async () => {
      const result = await client.callTool({ name: "get_units", arguments: { reference: "0745901TG4304N", country: "FR" } });
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("explains an exhausted quota with an empty prepaid balance", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        success: false, code: "KEY_AUTH_004", error: "Monthly quota used up (250/250) and prepaid balance empty.",
      }), { status: 429, headers: { "X-Quota-Overage": "on", "X-Quota-Balance": "0.000000", "X-Quota-Reset": "2026-11-01T00:00:00Z" } }));

      const result = await client.callTool({ name: "get_units", arguments: { reference: "0745901TG4304N" } });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("top up at https://parcelgps.com/app/developer");
      expect(toolText(result)).toContain("Quota resets at 2026-11-01T00:00:00Z.");
    });
  });

  describe("resolve_reference", () => {
    it("returns the candidates with the best first", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          input: "05102200100005",
          candidates: [
            { country: "DE", kind: "reference", normalized: "05102200100005", confidence: 0.6, supported: true },
            { country: "PT", kind: "reference", normalized: "05102200100005", confidence: 0.4, supported: true },
          ],
          ambiguous: true,
        },
      }));

      const body = toolJson(await client.callTool({ name: "resolve_reference", arguments: { text: "05102200100005", hint: "DE" } }));

      expect(lastRequest(fetchMock).url.searchParams.get("hint")).toBe("DE");
      expect(body).toMatchObject({ ambiguous: true, best: { country: "DE" } });
      expect(body).not.toHaveProperty("quota");
      expect(body.candidates).toHaveLength(2);
    });

    it("answers best null when nothing matches", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { input: "zz", candidates: null, ambiguous: false } }));
      const body = toolJson(await client.callTool({ name: "resolve_reference", arguments: { text: "zz" } }));
      expect(body).toMatchObject({ best: null, candidates: [] });
    });

    it("reports API errors", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, code: "RSV_001", message: "Falta el texto" }, 400));
      const result = await client.callTool({ name: "resolve_reference", arguments: { text: " " } });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("RSV_001");
    });
  });

  describe("get_terrain", () => {
    it("returns the ERA5-Land climate block", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          refcat: "R", country: "ES",
          relief: { status: "ok", source: { name: "DEM" } },
          protected_areas: { status: "no_data", sources: [] },
          climate: {
            status: "ok",
            baseline: { start_year: 1991, end_year: 2020, mean_temp_c: 15.2, annual_precip_mm: 540 },
            recent: { start_year: 2016, end_year: 2025, mean_temp_c: 16.1, annual_precip_mm: 498 },
            change: { mean_temp_c: 0.9 },
            source: { name: "ERA5-Land" },
          },
          calculated_at: "2026-10-01T00:00:00Z",
          provenance: "1",
        },
      }));

      const body = toolJson(await client.callTool({ name: "get_terrain", arguments: { reference: "R" } }));
      expect(body).toMatchObject({ climate: { status: "ok", change: { mean_temp_c: 0.9 } } });
    });

    it("sends the point outside the seven reference countries", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { refcat: "BE1", country: "BE", relief: { status: "ok" }, protected_areas: { status: "ok" }, calculated_at: "x" },
      }));

      const body = toolJson(await client.callTool({
        name: "get_terrain",
        arguments: { reference: "BE1", country: "BE", latitude: 50.848139, longitude: 4.353613 },
      }));
      const req = lastRequest(fetchMock);
      expect(req.url.searchParams.get("lat")).toBe("50.848139");
      expect(req.url.searchParams.get("lng")).toBe("4.353613");
      expect(body).toMatchObject({ country: "BE", climate: null });
    });

    it("asks for the point before calling when it is missing outside the seven", async () => {
      const result = await client.callTool({ name: "get_terrain", arguments: { reference: "BE1", country: "BE" } });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("MCP_004");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps Croatia and the United Kingdom out", async () => {
      for (const country of ["HR", "UK"]) {
        const result = await client.callTool({ name: "get_terrain", arguments: { reference: "X", country, latitude: 1, longitude: 1 } });
        expect(result.isError).toBe(true);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("get_ground_motion", () => {
    it("sends the point for a Dutch parcel", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { refcat: "NL1", country: "NL", status: "no_data", reason: "outside_coverage", source: {}, calculated_at: "x" },
      }));

      const body = toolJson(await client.callTool({
        name: "get_ground_motion",
        arguments: { reference: "NL1", country: "NL", latitude: 52.37, longitude: 4.89 },
      }));
      expect(lastRequest(fetchMock).url.searchParams.get("lat")).toBe("52.37");
      expect(body).toMatchObject({ country: "NL", status: "no_data", reason: "outside_coverage" });
    });

    it("refuses half a point", async () => {
      const result = await client.callTool({ name: "get_ground_motion", arguments: { reference: "NL1", latitude: 52.37 } });
      expect(toolText(result)).toContain("MCP_003");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("tells to wait on the per-minute limit", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, code: "KEY_RATE_002", error: "Too many" }), {
        status: 429, headers: { "Retry-After": "9" },
      }));
      const text = toolText(await client.callTool({ name: "get_ground_motion", arguments: { reference: "R", country: "ES" } }));
      expect(text).toContain("Wait 9 seconds");
    });
  });

  describe("ambiguity and place names keep their details", () => {
    it("lists the candidate countries", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: false, code: "CNV_AMBIGUOUS", error: "Several countries",
        data: { reference: "123", candidates: [{ country: "LV", confidence: 0.5, supported: true }] },
      }, 300));
      const text = toolText(await client.callTool({ name: "get_parcel", arguments: { reference: "123" } }));
      expect(text).toContain("\"country\": \"LV\"");
    });

    it("keeps the geocoded location of a place name", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        success: false, code: "CNV_PLACE_NAME", error: "Place name",
        data: { query: "Zeutern 10385", place: "Zeutern", parcelNumber: "10385", location: { lat: 49.2, lng: 8.6 } },
      }, 422));
      const text = toolText(await client.callTool({ name: "get_parcel", arguments: { reference: "Zeutern 10385" } }));
      expect(text).toContain("\"lat\": 49.2");
    });
  });
});
