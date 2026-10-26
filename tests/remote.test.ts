import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { createServer as createHttpServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { apiKeyFromRequest, createRemoteHandler, describeRpc, DEVELOPERS_URL, MAX_BODY_BYTES } from "../src/remote.js";
import { SERVER_VERSION } from "../src/version.js";
import { installFetchMock, jsonResponse, lastRequest, TEST_CONFIG } from "./helpers.js";

const ENDPOINT = { apiUrl: TEST_CONFIG.apiUrl, timeout: TEST_CONFIG.timeout };
const MCP_HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let httpServer: Server;
let port: number;
let logs: string[];

function send(method: string, path: string, headers: Record<string, string> = {}, body?: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function rpc(method: string, params: unknown, headers: Record<string, string>, path = "/mcp") {
  return send("POST", path, { ...MCP_HEADERS, ...headers }, JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
}

const initializeParams = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "claude-ai", version: "1.0" },
};

beforeAll(async () => {
  httpServer = createHttpServer(createRemoteHandler(ENDPOINT, (msg) => logs.push(msg)));
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

beforeEach(() => {
  logs = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiKeyFromRequest", () => {
  const url = (query = "") => new URL(`http://localhost/mcp${query}`);

  it("reads a bearer token", () => {
    expect(apiKeyFromRequest({ authorization: "Bearer pk_live_a" }, url())).toBe("pk_live_a");
  });

  it("accepts the bearer scheme in any case and trims spaces", () => {
    expect(apiKeyFromRequest({ authorization: "  bearer   pk_live_a  " }, url())).toBe("pk_live_a");
  });

  it("reads X-API-Key when there is no bearer", () => {
    expect(apiKeyFromRequest({ "x-api-key": " pk_live_b " }, url())).toBe("pk_live_b");
  });

  it("takes the first X-API-Key when the header repeats", () => {
    expect(apiKeyFromRequest({ "x-api-key": ["pk_live_b", "pk_live_c"] as unknown as string }, url())).toBe("pk_live_b");
  });

  it("reads the api_key query parameter for clients that only take a URL", () => {
    expect(apiKeyFromRequest({}, url("?api_key=pk_live_q"))).toBe("pk_live_q");
  });

  it("prefers the bearer over the header and the header over the query", () => {
    expect(apiKeyFromRequest({ authorization: "Bearer a", "x-api-key": "b" }, url("?api_key=c"))).toBe("a");
    expect(apiKeyFromRequest({ "x-api-key": "b" }, url("?api_key=c"))).toBe("b");
  });

  it("ignores other authorization schemes and empty values", () => {
    expect(apiKeyFromRequest({ authorization: "Basic dXNlcjpwYXNz" }, url())).toBeUndefined();
    expect(apiKeyFromRequest({ authorization: "Bearer   " }, url())).toBeUndefined();
    expect(apiKeyFromRequest({ "x-api-key": "  " }, url("?api_key="))).toBeUndefined();
    expect(apiKeyFromRequest({}, url())).toBeUndefined();
  });
});

describe("describeRpc", () => {
  it("names the tool of a call", () => {
    expect(describeRpc({ method: "tools/call", params: { name: "get_parcel" } })).toBe("tools/call:get_parcel");
  });

  it("names the client on initialize", () => {
    expect(describeRpc({ method: "initialize", params: initializeParams })).toBe("initialize:claude-ai/1.0");
  });

  it("joins a batch and survives odd messages", () => {
    expect(describeRpc([{ method: "tools/list" }, { id: 1, result: {} }, null])).toBe("tools/list,response,response");
    expect(describeRpc({ method: "tools/call", params: {} })).toBe("tools/call:?");
  });
});

describe("remote MCP over HTTP", () => {
  it("answers the health check with the version", async () => {
    const res = await send("GET", "/health");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "ok", version: SERVER_VERSION });
  });

  it("sends a browser on the root to the developers page", async () => {
    const res = await send("GET", "/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(DEVELOPERS_URL);
  });

  it("returns 404 for unknown paths", async () => {
    expect((await send("GET", "/sse")).status).toBe(404);
  });

  it("answers CORS preflight and lets browsers send the key headers", async () => {
    const res = await send("OPTIONS", "/mcp");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(res.headers["access-control-allow-headers"]).toContain("X-API-Key");
  });

  it("refuses GET and DELETE on /mcp because it keeps no sessions", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await send(method, "/mcp", { Authorization: "Bearer k" });
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("POST, OPTIONS");
    }
  });

  it("refuses a request without a key and points at the free tier", async () => {
    const fetchMock = installFetchMock();
    const res = await rpc("initialize", initializeParams, {});

    expect(res.status).toBe(401);
    expect(JSON.parse(res.body).error.message).toContain(DEVELOPERS_URL);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs).toEqual([expect.stringMatching(/^POST \/mcp initialize:claude-ai\/1\.0 401 \d+ms$/)]);
  });

  it("never falls back to a server key", async () => {
    process.env.CATASTROGPS_API_KEY = "pk_live_server_key";
    const res = await rpc("initialize", initializeParams, {});
    delete process.env.CATASTROGPS_API_KEY;

    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const res = await send("POST", "/mcp", { ...MCP_HEADERS, Authorization: "Bearer k" }, "{not json");
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe(-32700);
  });

  it("rejects a body over the limit", async () => {
    const huge = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "x".repeat(MAX_BODY_BYTES) } });
    const res = await send("POST", "/mcp", { ...MCP_HEADERS, Authorization: "Bearer k" }, huge);
    expect(res.status).toBe(413);
  });

  it("initializes without a session id", async () => {
    const res = await rpc("initialize", initializeParams, { Authorization: "Bearer pk_live_caller" });

    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeUndefined();
    expect(JSON.parse(res.body).result.serverInfo).toMatchObject({ name: "catastrogps", version: SERVER_VERSION });
  });

  it("lists every tool on a fresh stateless request", async () => {
    const res = await rpc("tools/list", {}, { Authorization: "Bearer pk_live_caller" });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).result.tools.map((t: { name: string }) => t.name)).toContain("get_parcel");
  });

  it.each([
    ["a bearer token", { Authorization: "Bearer pk_live_caller" }, "/mcp"],
    ["the X-API-Key header", { "X-API-Key": "pk_live_caller" }, "/mcp"],
    ["the api_key query", {}, "/mcp?api_key=pk_live_caller"],
  ])("calls the API with the caller's own key from %s", async (_label, headers, path) => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { locale: "es", locales: [], sources: [], count: 0, useClasses: [], crops: [] } }),
    );

    const res = await rpc("tools/call", { name: "get_crop_catalog", arguments: {} }, headers, path);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).result.isError).toBeFalsy();
    expect(lastRequest(fetchMock).headers["X-API-Key"]).toBe("pk_live_caller");
  });

  it("keeps two callers apart", async () => {
    const fetchMock = installFetchMock();
    const catalog = { success: true, data: { locale: "es", locales: [], sources: [], count: 0, useClasses: [], crops: [] } };
    fetchMock.mockImplementation(async () => jsonResponse(catalog));
    const call = (key: string) =>
      rpc("tools/call", { name: "get_crop_catalog", arguments: {} }, { Authorization: `Bearer ${key}` });

    await Promise.all([call("pk_live_one"), call("pk_live_two")]);

    const keys = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["X-API-Key"]);
    expect(keys.sort()).toEqual(["pk_live_one", "pk_live_two"]);
  });

  it("logs the tool and status but never the key", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { locale: "es", locales: [], sources: [], count: 0, useClasses: [], crops: [] } }),
    );

    await rpc("tools/call", { name: "get_crop_catalog", arguments: {} }, {}, "/mcp?api_key=pk_live_secret");
    await vi.waitFor(() => expect(logs.length).toBe(1));

    expect(logs[0]).toMatch(/^POST \/mcp tools\/call:get_crop_catalog 200 \d+ms$/);
    expect(logs.join()).not.toContain("pk_live_secret");
  });
});
