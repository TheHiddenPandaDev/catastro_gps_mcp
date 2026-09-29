import { vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

export const TEST_CONFIG = {
  apiKey: "pk_test_000000000000",
  apiUrl: "https://api.example.test",
  timeout: 5000,
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function installFetchMock() {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

export function lastRequest(mock: ReturnType<typeof vi.fn>, index = -1) {
  const calls = mock.mock.calls;
  const [url, init] = calls.at(index) as [string, RequestInit];
  return {
    url: new URL(url),
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

export async function connectClient(): Promise<Client> {
  const server = createServer(TEST_CONFIG);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

export function toolText(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  return content[0].text;
}

export function toolJson(result: unknown): Record<string, unknown> {
  return JSON.parse(toolText(result)) as Record<string, unknown>;
}
