#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { loadEndpointConfig } from "./server.js";
import { createRemoteHandler, MCP_PATH } from "./remote.js";

const DEFAULT_PORT = 3001;

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

function main(): void {
  const port = parseInt(process.env.MCP_PORT || process.env.PORT || "", 10) || DEFAULT_PORT;
  const httpServer = createHttpServer(createRemoteHandler(loadEndpointConfig(), log));
  httpServer.listen(port, () => {
    log(`Streamable HTTP server listening on :${port}${MCP_PATH}`);
  });
}

main();
