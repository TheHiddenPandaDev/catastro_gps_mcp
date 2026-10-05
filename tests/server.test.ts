import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS, loadConfig, loadEndpointConfig, sessionConfig } from "../src/server.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/version.js";
import { connectClient } from "./helpers.js";

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

  it("lists in the MCPB manifest exactly the tools the server registers", async () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    const client = await connectClient();
    const { tools } = await client.listTools();

    expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(tools.map((t) => t.name).sort());
  });

  it("stays within the registry description limit", () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });
});

describe("sessionConfig", () => {
  const endpoint = { apiUrl: DEFAULT_API_URL, timeout: DEFAULT_TIMEOUT_MS };

  it("uses the caller's own key for the session", () => {
    expect(sessionConfig(endpoint, "pk_live_caller")).toEqual({ ...endpoint, apiKey: "pk_live_caller" });
  });

  it("takes the first key when the header repeats and trims it", () => {
    expect(sessionConfig(endpoint, ["  pk_live_a ", "pk_live_b"])?.apiKey).toBe("pk_live_a");
  });

  it("refuses a session without a key so no server key is ever shared", () => {
    process.env.CATASTROGPS_API_KEY = "pk_live_server_key";
    expect(sessionConfig(endpoint, undefined)).toBeNull();
    expect(sessionConfig(endpoint, "   ")).toBeNull();
    expect(sessionConfig(endpoint, [])).toBeNull();
    delete process.env.CATASTROGPS_API_KEY;
  });
});

describe("loadEndpointConfig", () => {
  it("does not need a server key", () => {
    delete process.env.CATASTROGPS_API_KEY;
    expect(loadEndpointConfig()).toEqual({ apiUrl: process.env.CATASTROGPS_API_URL || DEFAULT_API_URL, timeout: expect.any(Number) });
  });
});
