import { describe, it, expect } from "vitest";
import {
  SUPPORTED_COUNTRIES,
  type CountryCode,
  type ParcelResponse,
  type SolarResponse,
  type AgroResponse,
  type MarketResponse,
  type ScoreResponse,
  type ValueHistoryResponse,
  type CompareResponse,
  type ApiErrorResponse,
  type ServerConfig,
} from "../src/types/index.js";

describe("types", () => {
  describe("SUPPORTED_COUNTRIES", () => {
    it("should contain all 7 country codes", () => {
      expect(SUPPORTED_COUNTRIES).toHaveLength(7);
    });

    it("should include ES (Spain)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("ES");
    });

    it("should include PT (Portugal)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("PT");
    });

    it("should include FR (France)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("FR");
    });

    it("should include IT (Italy)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("IT");
    });

    it("should include DE (Germany/NRW)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("DE");
    });

    it("should include PV (Basque Country)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("PV");
    });

    it("should include NA (Navarra)", () => {
      expect(SUPPORTED_COUNTRIES).toContain("NA");
    });

    it("should be readonly (as const)", () => {
      // Verify the array is the exact expected set
      expect([...SUPPORTED_COUNTRIES].sort()).toEqual(
        ["DE", "ES", "FR", "IT", "NA", "PT", "PV"],
      );
    });

    it("should not contain unsupported countries", () => {
      expect(SUPPORTED_COUNTRIES).not.toContain("UK");
      expect(SUPPORTED_COUNTRIES).not.toContain("US");
      expect(SUPPORTED_COUNTRIES).not.toContain("NL");
    });
  });

  describe("type exports", () => {
    it("should allow creating a valid ParcelResponse", () => {
      const parcel: ParcelResponse = {
        referencia_catastral: "TEST123",
        latitud: 40.0,
        longitud: -3.0,
      };
      expect(parcel.referencia_catastral).toBe("TEST123");
    });

    it("should allow creating a ParcelResponse with optional fields", () => {
      const parcel: ParcelResponse = {
        referencia_catastral: "TEST123",
        latitud: 40.0,
        longitud: -3.0,
        direccion: "Calle Test 1",
        municipio: "Madrid",
        provincia: "Madrid",
        superficie_m2: 100,
        uso_catastral: "Residencial",
        anyo_construccion: 2000,
        google_maps_url: "https://maps.google.com/?q=40.0,-3.0",
      };
      expect(parcel.direccion).toBe("Calle Test 1");
      expect(parcel.superficie_m2).toBe(100);
    });

    it("should allow creating a valid SolarResponse", () => {
      const solar: SolarResponse = {
        reference: "TEST123",
        annual_radiation_kwh_m2: 1650,
        optimal_angle_deg: 35,
        estimated_production_kwh_year: 4800,
        monthly_radiation: [85, 105, 140, 165, 195, 210, 220, 200, 170, 130, 90, 75],
        data_source: "PVGIS",
      };
      expect(solar.monthly_radiation).toHaveLength(12);
    });

    it("should allow creating a valid AgroResponse", () => {
      const agro: AgroResponse = {
        reference: "TEST123",
        land_use: { code: "TA", description: "Tierras arables", source: "SIGPAC" },
        ndvi: { current: 0.65, trend: "stable", data_quality: "good" },
        crop_prices: [{ crop: "Trigo", price_eur_ton: 215, source: "MAPA" }],
      };
      expect(agro.crop_prices).toHaveLength(1);
    });

    it("should allow creating a valid MarketResponse", () => {
      const market: MarketResponse = {
        reference: "TEST123",
        country: "FR",
        granularity: "parcela",
        transactions: [{
          date: "2025-06-15",
          price_eur: 320000,
          area_m2: 85,
          price_per_m2: 3764.71,
          type: "Appartement",
        }],
        zone_average_price_m2: 3500,
        data_source: "DVF",
      };
      expect(market.transactions).toHaveLength(1);
    });

    it("should allow creating a valid ScoreResponse", () => {
      const score: ScoreResponse = {
        reference: "TEST123",
        score: 7.2,
        rating: "Buena inversion",
        factors: { location: "high", solar_potential: "medium" },
        data_quality: "good",
      };
      expect(score.score).toBe(7.2);
    });

    it("should allow creating a valid ValueHistoryResponse", () => {
      const history: ValueHistoryResponse = {
        reference: "TEST123",
        history: [{ date: "2026-03-01", cadastral_value: 85000, area_m2: 89.5, use: "Residencial" }],
        note: "Test note",
      };
      expect(history.history).toHaveLength(1);
    });

    it("should allow creating a valid CompareResponse", () => {
      const compare: CompareResponse = {
        parcels: [
          { reference: "REF1", country: "ES", latitude: 40.0, longitude: -3.0 },
          { reference: "REF2", country: "FR", latitude: 48.0, longitude: 2.0 },
        ],
      };
      expect(compare.parcels).toHaveLength(2);
    });

    it("should allow creating a valid ApiErrorResponse", () => {
      const error: ApiErrorResponse = {
        error: "not_found",
        message: "Parcel not found",
      };
      expect(error.error).toBe("not_found");
    });

    it("should allow creating a valid ServerConfig", () => {
      const config: ServerConfig = {
        apiKey: "pk_test_xxx",
        apiUrl: "https://api.catastrogps.es",
        timeout: 10000,
      };
      expect(config.apiKey).toBe("pk_test_xxx");
    });

    it("should allow CountryCode type to match supported countries", () => {
      const code: CountryCode = "ES";
      expect(SUPPORTED_COUNTRIES).toContain(code);
    });
  });
});
