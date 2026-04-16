#!/usr/bin/env node

/**
 * Catastro GPS MCP Server — SSE transport
 *
 * HTTP server for web-based MCP clients and remote agents.
 * Exposes SSE endpoint at /sse and message endpoint at /message.
 *
 * Usage:
 *   CATASTROGPS_API_KEY=pk_live_xxx MCP_PORT=3001 node build/sse.js
 */

import { createServer as createHttpServer } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, loadConfig } from "./server.js";

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

async function main(): Promise<void> {
  const config = loadConfig();
  const port = parseInt(process.env.MCP_PORT || "3001", 10);

  // Track active transports by session
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "catastro-gps-mcp", version: "1.0.0" }));
      return;
    }

    // SSE connection endpoint
    if (url.pathname === "/sse" && req.method === "GET") {
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

    // Message endpoint for SSE transport
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

    // 404 for everything else
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
