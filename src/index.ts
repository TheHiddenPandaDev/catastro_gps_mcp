#!/usr/bin/env node

/**
 * Catastro GPS MCP Server — stdio transport
 *
 * Entry point for Claude Desktop, Claude Code, and other MCP clients
 * that use the stdio transport (JSON-RPC over stdin/stdout).
 *
 * Usage:
 *   CATASTROGPS_API_KEY=pk_live_xxx npx catastro-gps-mcp
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, loadConfig } from "./server.js";

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  log("Server running on stdio transport");
}

main().catch((error) => {
  console.error(`[catastro-gps-mcp] Fatal error: ${error}`);
  process.exit(1);
});
