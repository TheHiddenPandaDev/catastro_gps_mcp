import { describe, it, expect, vi } from "vitest";
import { CatastroGPSApiError } from "../src/client/catastrogps-api.js";
import { handleToolError } from "../src/tools/shared.js";

// Suppress console.error from handleToolError's log() calls
vi.spyOn(console, "error").mockImplementation(() => {});

describe("handleToolError()", () => {
  describe("CatastroGPSApiError mapping", () => {
    it("should map daily_limit_reached to upgrade message", () => {
      const error = new CatastroGPSApiError("daily_limit_reached", "Daily limit reached", 429);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("daily_limit_reached");
      expect(result.content[0].text).toContain("Upgrade your plan");
      expect(result.content[0].text).toContain("catastrogps.es/precios");
    });

    it("should map rate_limited to slow down message", () => {
      const error = new CatastroGPSApiError("rate_limited", "Rate limited", 429);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("rate_limited");
      expect(result.content[0].text).toContain("Too many requests");
    });

    it("should map catastro_unavailable to retry message", () => {
      const error = new CatastroGPSApiError("catastro_unavailable", "Catastro down", 503);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("catastro_unavailable");
      expect(result.content[0].text).toContain("temporarily unavailable");
    });

    it("should map not_found to check reference message", () => {
      const error = new CatastroGPSApiError("not_found", "Not found", 404);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("not_found");
      expect(result.content[0].text).toContain("Parcel not found");
    });

    it("should map invalid_referencia to format error message", () => {
      const error = new CatastroGPSApiError("invalid_referencia", "Invalid ref", 400);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("invalid_referencia");
      expect(result.content[0].text).toContain("Invalid cadastral reference format");
    });

    it("should map pro_required to upgrade message", () => {
      const error = new CatastroGPSApiError("pro_required", "Pro required", 403);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("pro_required");
      expect(result.content[0].text).toContain("Pro plan");
    });

    it("should map unauthorized to API key message", () => {
      const error = new CatastroGPSApiError("unauthorized", "Unauthorized", 401);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("unauthorized");
      expect(result.content[0].text).toContain("Invalid API key");
      expect(result.content[0].text).toContain("catastrogps.es/developers");
    });

    it("should use raw message for unknown CatastroGPSApiError codes", () => {
      const error = new CatastroGPSApiError("some_unknown_error", "Something weird happened", 500);
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("some_unknown_error");
      expect(result.content[0].text).toContain("Something weird happened");
    });
  });

  describe("non-CatastroGPSApiError handling", () => {
    it("should return MCP_999 for generic Error", () => {
      const error = new Error("Something broke");
      const result = handleToolError(error);

      expect(result.content[0].text).toContain("MCP_999");
      expect(result.content[0].text).toContain("unexpected error");
    });

    it("should return MCP_999 for string errors", () => {
      const result = handleToolError("string error");

      expect(result.content[0].text).toContain("MCP_999");
    });

    it("should return MCP_999 for null/undefined", () => {
      const resultNull = handleToolError(null);
      expect(resultNull.content[0].text).toContain("MCP_999");

      const resultUndef = handleToolError(undefined);
      expect(resultUndef.content[0].text).toContain("MCP_999");
    });
  });

  describe("return format", () => {
    it("should always return isError: true for CatastroGPSApiError", () => {
      const error = new CatastroGPSApiError("not_found", "Not found", 404);
      const result = handleToolError(error);
      expect(result.isError).toBe(true);
    });

    it("should always return isError: true for generic errors", () => {
      const result = handleToolError(new Error("fail"));
      expect(result.isError).toBe(true);
    });

    it("should return content as array with single text object for API errors", () => {
      const error = new CatastroGPSApiError("not_found", "Not found", 404);
      const result = handleToolError(error);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: expect.any(String),
      });
    });

    it("should return content as array with single text object for generic errors", () => {
      const result = handleToolError(new Error("fail"));

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: expect.any(String),
      });
    });

    it("should format API error as 'code: message'", () => {
      const error = new CatastroGPSApiError("not_found", "Not found", 404);
      const result = handleToolError(error);

      // Format is "{code}: {friendly_message}"
      expect(result.content[0].text).toMatch(/^not_found: /);
    });
  });
});
