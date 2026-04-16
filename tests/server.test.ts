import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the tool registration modules before importing server
vi.mock("../src/tools/get-parcel.js", () => ({ registerGetParcel: vi.fn() }));
vi.mock("../src/tools/get-solar.js", () => ({ registerGetSolar: vi.fn() }));
vi.mock("../src/tools/get-agriculture.js", () => ({ registerGetAgriculture: vi.fn() }));
vi.mock("../src/tools/get-market.js", () => ({ registerGetMarket: vi.fn() }));
vi.mock("../src/tools/get-score.js", () => ({ registerGetScore: vi.fn() }));
vi.mock("../src/tools/get-value-history.js", () => ({ registerGetValueHistory: vi.fn() }));
vi.mock("../src/tools/compare-parcels.js", () => ({ registerCompareParcels: vi.fn() }));

import { createServer, loadConfig } from "../src/server.js";
import { registerGetParcel } from "../src/tools/get-parcel.js";
import { registerGetSolar } from "../src/tools/get-solar.js";
import { registerGetAgriculture } from "../src/tools/get-agriculture.js";
import { registerGetMarket } from "../src/tools/get-market.js";
import { registerGetScore } from "../src/tools/get-score.js";
import { registerGetValueHistory } from "../src/tools/get-value-history.js";
import { registerCompareParcels } from "../src/tools/compare-parcels.js";

describe("server", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("loadConfig()", () => {
    it("should load config with valid API key", () => {
      process.env.CATASTROGPS_API_KEY = "pk_test_abc123";
      const config = loadConfig();

      expect(config.apiKey).toBe("pk_test_abc123");
      expect(config.apiUrl).toBe("https://api.catastrogps.es");
      expect(config.timeout).toBe(10000);
    });

    it("should exit process when API key is missing", () => {
      delete process.env.CATASTROGPS_API_KEY;

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => loadConfig()).toThrow("process.exit called");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("CATASTROGPS_API_KEY"),
      );

      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should use custom API URL when provided", () => {
      process.env.CATASTROGPS_API_KEY = "pk_test_abc123";
      process.env.CATASTROGPS_API_URL = "https://staging-api.catastrogps.es";

      const config = loadConfig();
      expect(config.apiUrl).toBe("https://staging-api.catastrogps.es");
    });

    it("should use custom timeout when provided", () => {
      process.env.CATASTROGPS_API_KEY = "pk_test_abc123";
      process.env.CATASTROGPS_TIMEOUT = "30000";

      const config = loadConfig();
      expect(config.timeout).toBe(30000);
    });

    it("should default timeout to 10000 when not set", () => {
      process.env.CATASTROGPS_API_KEY = "pk_test_abc123";
      delete process.env.CATASTROGPS_TIMEOUT;

      const config = loadConfig();
      expect(config.timeout).toBe(10000);
    });

    it("should default API URL to production when not set", () => {
      process.env.CATASTROGPS_API_KEY = "pk_test_abc123";
      delete process.env.CATASTROGPS_API_URL;

      const config = loadConfig();
      expect(config.apiUrl).toBe("https://api.catastrogps.es");
    });
  });

  describe("createServer()", () => {
    const validConfig = {
      apiKey: "pk_test_xxx",
      apiUrl: "https://api.catastrogps.es",
      timeout: 10000,
    };

    it("should return an McpServer instance", () => {
      const server = createServer(validConfig);
      expect(server).toBeDefined();
      expect(server).toHaveProperty("connect");
      expect(server).toHaveProperty("registerTool");
    });

    it("should register all 7 tools", () => {
      createServer(validConfig);

      expect(registerGetParcel).toHaveBeenCalledTimes(1);
      expect(registerGetSolar).toHaveBeenCalledTimes(1);
      expect(registerGetAgriculture).toHaveBeenCalledTimes(1);
      expect(registerGetMarket).toHaveBeenCalledTimes(1);
      expect(registerGetScore).toHaveBeenCalledTimes(1);
      expect(registerGetValueHistory).toHaveBeenCalledTimes(1);
      expect(registerCompareParcels).toHaveBeenCalledTimes(1);
    });

    it("should pass the server and client to each tool register function", () => {
      const server = createServer(validConfig);

      // Each register function receives (server, client)
      expect(registerGetParcel).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerGetSolar).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerGetAgriculture).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerGetMarket).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerGetScore).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerGetValueHistory).toHaveBeenCalledWith(server, expect.any(Object));
      expect(registerCompareParcels).toHaveBeenCalledWith(server, expect.any(Object));
    });
  });
});
