#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, loadEndpointConfig, sessionConfig } from "./server.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

async function main(): Promise<void> {
  const endpoint = loadEndpointConfig();
  const port = parseInt(process.env.MCP_PORT || "3001", 10);
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION }));
      return;
    }
    if (url.pathname === "/sse" && req.method === "GET") {
      const config = sessionConfig(endpoint, req.headers["x-api-key"]);
      if (!config) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "X-API-Key header with your own Catastro GPS key is required" }));
        return;
      }
      const transport = new SSEServerTransport("/message", res);
      const sessionId = transport.sessionId;
      transports.set(sessionId, transport);
      log(`SSE client connected: ${sessionId}`);

      res.on("close", () => {
        transports.delete(sessionId);
        log(`SSE client disconnected: ${sessionId}`);
      });

      const server = createServer(config);
      await server.connect(transport);
      return;
    }
    if (url.pathname === "/message" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }));
        return;
      }

      const transport = transports.get(sessionId)!;
      await transport.handlePostMessage(req, res);
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    log(`SSE server listening on http://localhost:${port}`);
    log(`  SSE endpoint:     GET  http://localhost:${port}/sse`);
    log(`  Message endpoint: POST http://localhost:${port}/message`);
    log(`  Health check:     GET  http://localhost:${port}/health`);
  });
}

main().catch((error) => {
  console.error(`[catastro-gps-mcp] Fatal error: ${error}`);
  process.exit(1);
});
