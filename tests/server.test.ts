import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS, loadConfig } from "../src/server.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/version.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const serverJson = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CATASTROGPS_API_URL;
    delete process.env.CATASTROGPS_TIMEOUT;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("reads the key and applies defaults", () => {
    process.env.CATASTROGPS_API_KEY = "pk_live_abcdefghijkl";

    expect(loadConfig()).toEqual({ apiKey: "pk_live_abcdefghijkl", apiUrl: DEFAULT_API_URL, timeout: DEFAULT_TIMEOUT_MS });
  });

  it("honours URL and timeout overrides", () => {
    process.env.CATASTROGPS_API_KEY = "k";
    process.env.CATASTROGPS_API_URL = "https://api.parcelgps.com";
    process.env.CATASTROGPS_TIMEOUT = "30000";

    expect(loadConfig()).toMatchObject({ apiUrl: "https://api.parcelgps.com", timeout: 30000 });
  });

  it("ignores a timeout that is not a positive number", () => {
    process.env.CATASTROGPS_API_KEY = "k";
    process.env.CATASTROGPS_TIMEOUT = "soon";

    expect(loadConfig().timeout).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("exits with a pointer to the free tier when the key is missing", () => {
    delete process.env.CATASTROGPS_API_KEY;
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => loadConfig()).toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("parcelgps.com/developers"));
  });
});

describe("release metadata", () => {
  it("keeps package.json, server.json and the runtime version in step", () => {
    expect(pkg.name).toBe(SERVER_NAME);
    expect(pkg.version).toBe(SERVER_VERSION);
    expect(serverJson.version).toBe(SERVER_VERSION);
    expect(serverJson.packages[0].identifier).toBe(pkg.name);
    expect(serverJson.packages[0].version).toBe(SERVER_VERSION);
  });

  it("ships the same version in the MCPB manifest and the Smithery launcher", () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    const smithery = readFileSync(new URL("../smithery.yaml", import.meta.url), "utf8");

    expect(manifest.version).toBe(SERVER_VERSION);
    expect(smithery).toContain(`catastro-gps-mcp@${SERVER_VERSION}`);
  });

  it("uses the same registry name in package.json and server.json", () => {
    expect(pkg.mcpName).toBe(serverJson.name);
  });

  it("stays within the registry description limit", () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });
});
