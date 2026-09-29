import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CatastroGPSApiError } from "../src/client/catastrogps-api.js";
import { compact, handleToolError, jsonResult } from "../src/tools/shared.js";

describe("handleToolError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["KEY_AUTH_004", "catastrogps.es/developers"],
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
