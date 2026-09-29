#!/usr/bin/env node
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
