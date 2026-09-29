import { describe, it, expect } from "vitest";
import {
  COORDINATES_ONLY_COUNTRIES,
  COUNTRY_CODES_TEXT,
  ENRICHMENT_COUNTRIES,
  REFERENCE_COUNTRIES,
  SUPPORTED_COUNTRIES,
} from "../src/types/index.js";

const BACKEND_WIRED_COUNTRIES = [
  "ES", "DE", "FR", "IT", "PT", "AT", "NA", "PV", "PL", "NL", "CZ", "SE", "BE", "NO", "FI",
  "EE", "SI", "IE", "GR", "DK", "LV", "HR", "LT", "LU", "SK", "BG", "CY", "IS", "LI", "CH", "UK",
];

describe("country lists", () => {
  it("mirror the backend's wiredCountries", () => {
    expect([...SUPPORTED_COUNTRIES].sort()).toEqual([...BACKEND_WIRED_COUNTRIES].sort());
  });

  it("have no duplicates", () => {
    expect(new Set(SUPPORTED_COUNTRIES).size).toBe(SUPPORTED_COUNTRIES.length);
  });

  it("split reference and coordinates-only countries without overlap", () => {
    const union = [...REFERENCE_COUNTRIES, ...COORDINATES_ONLY_COUNTRIES].sort();
    expect(union).toEqual([...SUPPORTED_COUNTRIES].sort());
  });

  it("limit enrichment to countries the solar and agro endpoints handle", () => {
    for (const code of ENRICHMENT_COUNTRIES) {
      expect(SUPPORTED_COUNTRIES).toContain(code);
    }
    expect(ENRICHMENT_COUNTRIES).toHaveLength(7);
  });

  it("name every code in the tool description text", () => {
    for (const code of SUPPORTED_COUNTRIES) {
      expect(COUNTRY_CODES_TEXT).toContain(`${code} `);
    }
  });
});
