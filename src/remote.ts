import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, sessionConfig, type EndpointConfig } from "./server.js";
import { REMOTE_USER_AGENT, SERVER_NAME, SERVER_VERSION } from "./version.js";

export const MCP_PATH = "/mcp";
export const DEVELOPERS_URL = "https://www.parcelgps.com/developers";
export const MAX_BODY_BYTES = 1024 * 1024;

const BEARER_PREFIX = /^bearer\s+/i;
const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_SERVER_ERROR = -32000;

type Log = (msg: string) => void;

interface RpcMessage {
  method?: string;
  params?: { name?: string; clientInfo?: { name?: string; version?: string } };
}

export function apiKeyFromRequest(headers: IncomingHttpHeaders, url: URL): string | undefined {
  const authorization = headers.authorization?.trim();
  if (authorization && BEARER_PREFIX.test(authorization)) {
    return authorization.replace(BEARER_PREFIX, "").trim() || undefined;
  }
  const header = headers["x-api-key"];
  const fromHeader = (Array.isArray(header) ? header[0] : header)?.trim();
  if (fromHeader) return fromHeader;
  return url.searchParams.get("api_key")?.trim() || undefined;
}

export function callsATool(body: unknown): boolean {
  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[];
  return messages.some((m) => m?.method === "tools/call");
}

export function describeRpc(body: unknown): string {
  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[];
  return messages
    .map((m) => {
      if (m?.method === "tools/call") return `tools/call:${m.params?.name ?? "?"}`;
      if (m?.method === "initialize") {
        const client = m.params?.clientInfo;
        return `initialize:${client?.name ?? "?"}/${client?.version ?? "?"}`;
      }
      return m?.method ?? "response";
    })
    .join(",");
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(res: ServerResponse, status: number, code: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new RangeError("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function discoveryConfig(endpoint: EndpointConfig, body: unknown) {
  return callsATool(body) ? null : { ...endpoint, apiKey: "" };
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse, endpoint: EndpointConfig, url: URL, log: Log) {
  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const tooLarge = error instanceof RangeError;
    rpcError(res, tooLarge ? 413 : 400, JSONRPC_PARSE_ERROR, tooLarge ? "Request body too large" : "Invalid JSON");
    return;
  }
  const rpc = describeRpc(body);

  const config = sessionConfig(endpoint, apiKeyFromRequest(req.headers, url)) ?? discoveryConfig(endpoint, body);
  if (!config) {
    rpcError(
      res,
      401,
      JSONRPC_SERVER_ERROR,
      `Your own Parcel GPS API key is required: send "Authorization: Bearer <key>" or add ?api_key=<key> ` +
        `to the URL. Free key (250 calls/month): ${DEVELOPERS_URL}`,
    );
    log(`POST ${MCP_PATH} ${rpc} 401 ${Date.now() - startedAt}ms`);
    return;
  }

  const server = createServer({ ...config, userAgent: REMOTE_USER_AGENT });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
    log(`POST ${MCP_PATH} ${rpc} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

export function createRemoteHandler(endpoint: EndpointConfig, log: Log = () => {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    setCors(res);
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", server: SERVER_NAME, version: SERVER_VERSION });
      return;
    }
    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(302, { Location: DEVELOPERS_URL });
      res.end();
      return;
    }
    if (url.pathname !== MCP_PATH) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      rpcError(res, 405, JSONRPC_SERVER_ERROR, "Method not allowed: this server is stateless, use POST");
      return;
    }

    try {
      await handleMcpPost(req, res, endpoint, url, log);
    } catch (error) {
      log(`POST ${MCP_PATH} failed: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) rpcError(res, 500, JSONRPC_SERVER_ERROR, "Internal server error");
    }
  };
}
