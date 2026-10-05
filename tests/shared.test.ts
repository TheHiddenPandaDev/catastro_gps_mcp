import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CatastroGPSApiError } from "../src/client/catastrogps-api.js";
import { compact, handleToolError, jsonResult, quotaSummary, sitePoint } from "../src/tools/shared.js";

describe("handleToolError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["KEY_AUTH_004", "parcelgps.com/developers"],
    ["UNAUTHORIZED", "API key"],
    ["NOT_FOUND", "country code"],
    ["CNV_AMBIGUOUS", "candidate"],
    ["SERVICE_UNAVAILABLE", "not responding"],
    ["MCP_TIMEOUT", "CATASTROGPS_TIMEOUT"],
  ])("maps %s to a helpful message", (code, fragment) => {
    const result = handleToolError(new CatastroGPSApiError(code, "raw", 400));

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(code);
    expect(result.content[0].text).toContain(fragment);
    expect(result.content[0].text).toContain("raw");
  });

  it.each([
    [502, "having trouble"],
    [503, "not charged"],
    [429, "Slow down"],
    [401, "API key"],
  ])("explains HTTP_%s bodies the API did not write", (status, fragment) => {
    const result = handleToolError(new CatastroGPSApiError(`HTTP_${status}`, `API returned ${status}`, status));
    expect(result.content[0].text).toContain(fragment);
  });

  it("explains network failures", () => {
    const result = handleToolError(new CatastroGPSApiError("MCP_NETWORK", "Network error: ECONNREFUSED", 0));
    expect(result.content[0].text).toContain("CATASTROGPS_API_URL");
  });

  it("tells when an exhausted quota comes back", () => {
    const result = handleToolError(
      new CatastroGPSApiError("KEY_AUTH_004", "Monthly quota used up (250/250)", 429, undefined, {
        quota: { resetsAt: "2026-10-01T00:00:00Z" },
      }),
    );
    expect(result.content[0].text).toContain("Quota resets at 2026-10-01T00:00:00Z.");
  });

  it("tells to top up when the prepaid balance is empty", () => {
    const fromHeader = handleToolError(
      new CatastroGPSApiError("KEY_AUTH_004", "x", 429, undefined, { quota: { overage: { enabled: true, balanceEur: 0 } } }),
    );
    const fromMessage = handleToolError(
      new CatastroGPSApiError("KEY_AUTH_004", "Monthly quota used up (5/5) and prepaid balance empty.", 429),
    );
    for (const result of [fromHeader, fromMessage]) {
      expect(result.content[0].text).toContain("prepaid balance empty");
      expect(result.content[0].text).toContain("parcelgps.com/app/developer");
    }
  });

  it("offers prepaid overage when the quota is used up without it", () => {
    const result = handleToolError(new CatastroGPSApiError("KEY_AUTH_004", "x", 429));
    expect(result.content[0].text).toContain("prepaid overage");
    expect(result.content[0].text).not.toContain("balance empty");
  });

  it("says how long to wait on the per-minute limit", () => {
    const result = handleToolError(new CatastroGPSApiError("KEY_RATE_002", "slow", 429, undefined, { retryAfterSeconds: 12 }));
    expect(result.content[0].text).toContain("Per-minute limit");
    expect(result.content[0].text).toContain("Wait 12 seconds");
  });

  it("keeps the API message for unmapped codes", () => {
    const result = handleToolError(new CatastroGPSApiError("CNV_999", "algo raro", 400));
    expect(result.content[0].text).toBe("CNV_999: algo raro");
  });

  it("appends error details as JSON", () => {
    const result = handleToolError(new CatastroGPSApiError("NOT_FOUND", "x", 404, { parsed: true }));
    expect(result.content[0].text).toContain("\"parsed\": true");
  });

  it("never leaks unexpected error messages", () => {
    const result = handleToolError(new Error("secret stack"));
    expect(result.content[0].text).toBe("MCP_999: An unexpected error occurred. Please try again.");
  });
});

describe("compact", () => {
  it("drops empty values but keeps zero and false", () => {
    expect(compact({ a: undefined, b: null, c: "", d: 0, e: false, f: "x" })).toEqual({ d: 0, e: false, f: "x" });
  });
});

describe("jsonResult", () => {
  it("wraps a value as pretty JSON text", () => {
    expect(jsonResult({ a: 1 })).toEqual({ content: [{ type: "text", text: "{\n  \"a\": 1\n}" }] });
  });
});

describe("quotaSummary", () => {
  it("flattens the quota for tool results", () => {
    expect(quotaSummary({
      plan: "pro",
      limit: 15000,
      remaining: 0,
      resetsAt: "2026-11-01T00:00:00Z",
      overage: { enabled: true, balanceEur: 3.5, unitPriceEur: 0.004, unitsLeft: 875 },
      perMinute: { limit: 120, remaining: 119 },
      fincaCap: { cap: 50, used: 50 },
    })).toEqual({
      remaining: 0,
      limit: 15000,
      resets_at: "2026-11-01T00:00:00Z",
      plan: "pro",
      prepaid_overage: true,
      prepaid_balance_eur: 3.5,
      overage_units_left: 875,
      per_minute_remaining: 119,
      finca_cap: 50,
      finca_cap_used: 50,
    });
  });

  it("is undefined without data", () => {
    expect(quotaSummary(undefined)).toBeUndefined();
    expect(quotaSummary({})).toBeUndefined();
  });

  it("is attached to object results only", () => {
    expect(JSON.parse(jsonResult({ a: 1 }, { remaining: 3 }).content[0].text)).toEqual({ a: 1, quota: { remaining: 3 } });
    expect(JSON.parse(jsonResult([1], { remaining: 3 }).content[0].text)).toEqual([1]);
  });
});

describe("sitePoint", () => {
  it("needs both coordinates or none", () => {
    expect(sitePoint("BE", 50, undefined).error?.content[0].text).toContain("MCP_003");
  });

  it("asks for the point outside the seven reference countries", () => {
    expect(sitePoint("BE", undefined, undefined).error?.content[0].text).toContain("MCP_004");
  });

  it("lets the reference alone through in the seven countries or without country", () => {
    expect(sitePoint("ES", undefined, undefined)).toEqual({});
    expect(sitePoint(undefined, undefined, undefined)).toEqual({});
  });

  it("returns the point when given", () => {
    expect(sitePoint("NL", 52.37, 4.89)).toEqual({ point: { lat: 52.37, lng: 4.89 } });
  });
});
