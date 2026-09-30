import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, installFetchMock, jsonResponse, lastRequest, toolJson, toolText } from "./helpers.js";
import { defaultIdempotencyKey, euros } from "../src/tools/documents.js";

const catalog = (documents: unknown[]) => jsonResponse({ success: true, data: { currency: "EUR", documents } });
const wallet = (balance: number) =>
  jsonResponse({ success: true, data: { organization_id: "org", balance_cents: balance, currency: "EUR", topup_amounts_cents: [5000], moves: [] } });

const visura = {
  country: "IT", product: "visura", name: "Italian cadastral visura", amount_cents: 990, currency: "EUR",
  api_orderable: true, delivery: "automatic", required_fields: ["country", "product", "parcel_ref"],
};
const certidao = {
  country: "PT", product: "certidao", name: "Certidão", amount_cents: 2495, currency: "EUR",
  api_orderable: false, required_fields: [], api_unavailable_reason: "web_only_for_now",
};

const placedOrder = {
  id: "ord-1", status: "processing", country: "IT", product: "visura", parcel_ref: "H501", amount_cents: 990,
  currency: "EUR", channel: "mcp", created_at: "2026-09-30T10:00:00Z",
};

function route(fetchMock: ReturnType<typeof installFetchMock>, handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const key = `${init.method} ${u.pathname}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`unexpected ${key}`);
    return handler();
  });
}

function calls(fetchMock: ReturnType<typeof installFetchMock>, method: string, path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => (init as RequestInit).method === method && new URL(url as string).pathname === path);
}

describe("document tools", () => {
  let fetchMock: ReturnType<typeof installFetchMock>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = installFetchMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
    client = await connectClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("formats euros from cents", () => {
    expect(euros(990)).toBe("9.90 EUR");
    expect(euros(0)).toBe("0.00 EUR");
    expect(euros(250000)).toBe("2500.00 EUR");
    expect(euros(-995)).toBe("-9.95 EUR");
  });

  it("derives a stable key per order and day", () => {
    const order = { country: "IT", product: "visura", parcel_ref: "H501" };
    const day = new Date("2026-09-30T10:00:00Z");
    const later = new Date("2026-09-30T23:59:00Z");
    const tomorrow = new Date("2026-10-01T00:01:00Z");
    expect(defaultIdempotencyKey(order, day)).toBe(defaultIdempotencyKey(order, later));
    expect(defaultIdempotencyKey(order, day)).not.toBe(defaultIdempotencyKey(order, tomorrow));
    expect(defaultIdempotencyKey({ ...order, parcel_ref: "F205" }, day)).not.toBe(defaultIdempotencyKey(order, day));
    expect(defaultIdempotencyKey(order, day)).toMatch(/^mcp-[0-9a-f]{40}$/);
    expect(defaultIdempotencyKey(order)).toMatch(/^mcp-/);
  });

  it("warns in the tool description that ordering spends money", async () => {
    const { tools } = await client.listTools();
    const order = tools.find((t) => t.name === "order_document")!;
    expect(order.description).toContain("SPENDS MONEY");
    expect(order.description).toContain("confirm=true");
    expect(order.annotations?.destructiveHint).toBe(true);
    const list = tools.find((t) => t.name === "list_documents")!;
    expect(list.annotations?.readOnlyHint).toBe(true);
  });

  it("lists documents with euro prices and the wallet balance", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura, certidao]),
      "GET /api/v1/wallet": () => wallet(1500),
    });
    const result = await client.callTool({ name: "list_documents", arguments: { country: "it", parcel_ref: "H501", locale: "es" } });
    const body = toolJson(result);
    const docs = body.documents as Array<Record<string, unknown>>;
    expect(docs[0]).toMatchObject({ product: "visura", price: "9.90 EUR", orderable_by_api: true, delivery: "automatic" });
    expect(docs[1]).toMatchObject({ orderable_by_api: false, unavailable_reason: "web_only_for_now", delivery: null });
    expect(body.wallet_balance).toBe("15.00 EUR");
    const req = lastRequest(fetchMock, 0);
    expect(req.url.searchParams.get("country")).toBe("IT");
    expect(req.url.searchParams.get("parcel_ref")).toBe("H501");
    expect(req.url.searchParams.get("locale")).toBe("es");
  });

  it("still lists documents when the wallet cannot be read", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura]),
      "GET /api/v1/wallet": () => jsonResponse({ success: false, code: "WAL_003", error: "no org" }, 401),
    });
    const body = toolJson(await client.callTool({ name: "list_documents", arguments: {} }));
    expect(body.wallet_balance).toBeNull();
    expect((body.documents as unknown[]).length).toBe(1);
  });

  it("refuses to order without explicit confirmation and calls nothing", async () => {
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "IT", product: "visura", parcel_ref: "H501", confirm: false },
    });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("MCP_CONFIRM");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the balance first and charges nothing when it is short", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura]),
      "GET /api/v1/wallet": () => wallet(500),
    });
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "IT", product: "visura", parcel_ref: "H501", confirm: true },
    });
    expect(result.isError).toBe(true);
    const text = toolText(result);
    expect(text).toContain("WAL_001");
    expect(text).toContain("9.90 EUR");
    expect(text).toContain("5.00 EUR");
    expect(text).toContain("/app/developer");
    expect(calls(fetchMock, "POST", "/api/v1/documents/orders")).toHaveLength(0);
  });

  it("refuses documents that the API cannot deliver", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([certidao]),
      "GET /api/v1/wallet": () => wallet(100000),
    });
    for (const product of ["certidao", "unknown"]) {
      const result = await client.callTool({
        name: "order_document",
        arguments: { country: "PT", product, parcel_ref: "1234", confirm: true },
      });
      expect(toolText(result)).toContain("DOC_002");
    }
    expect(calls(fetchMock, "POST", "/api/v1/documents/orders")).toHaveLength(0);
  });

  it("orders with an idempotency key and the mcp channel", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura]),
      "GET /api/v1/wallet": () => wallet(5000),
      "POST /api/v1/documents/orders": () => jsonResponse({ success: true, data: { order: placedOrder, balance_cents: 4010 } }, 201),
    });
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "it", product: "Visura", parcel_ref: "H501", email: "dev@example.com", confirm: true },
    });
    const body = toolJson(result);
    expect(body).toMatchObject({ order_id: "ord-1", status: "processing", charged: "9.90 EUR", wallet_balance: "40.10 EUR", already_ordered: false });
    const [url, init] = calls(fetchMock, "POST", "/api/v1/documents/orders")[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^mcp-[0-9a-f]{40}$/);
    expect(headers["X-API-Key"]).toBeTruthy();
    expect(JSON.parse(String(init.body))).toMatchObject({ country: "IT", product: "visura", channel: "mcp", email: "dev@example.com" });
    expect(url).toContain("/api/v1/documents/orders");
  });

  it("uses the caller's idempotency key when one is given", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura]),
      "GET /api/v1/wallet": () => wallet(990),
      "POST /api/v1/documents/orders": () => jsonResponse({ success: true, data: { order: placedOrder, balance_cents: 0, replayed: true } }),
    });
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "IT", product: "visura", parcel_ref: "H501", confirm: true, idempotency_key: "gestoria-000123" },
    });
    expect(toolJson(result).already_ordered).toBe(true);
    const [, init] = calls(fetchMock, "POST", "/api/v1/documents/orders")[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("gestoria-000123");
    expect(JSON.parse(String(init.body)).holder).toBeUndefined();
  });

  it("refuses a Spanish nota simple, which is only sold on the web", async () => {
    const nota = { ...visura, country: "ES", product: "nota_simple", amount_cents: 2495, api_orderable: false, api_unavailable_reason: "web_only_for_now" };
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([nota]),
      "GET /api/v1/wallet": () => wallet(5000),
    });
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "ES", product: "nota_simple", parcel_ref: "9872023VH5797S0001WX", confirm: true },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("DOC_002");
    expect(calls(fetchMock, "POST", "/api/v1/documents/orders")).toHaveLength(0);
  });

  it("explains API errors from the order in plain words", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/catalog": () => catalog([visura]),
      "GET /api/v1/wallet": () => wallet(5000),
      "POST /api/v1/documents/orders": () => jsonResponse({ success: false, code: "DOC_005", error: "conflict" }, 409),
    });
    const result = await client.callTool({
      name: "order_document",
      arguments: { country: "IT", product: "visura", parcel_ref: "H501", confirm: true },
    });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("already used for a different order");
  });

  it("reports the status of an order without the file", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/orders/ord-1": () => jsonResponse({ success: true, data: { ...placedOrder, status: "failed", refunded_cents: 990, failure_reason: "no existe" } }),
    });
    const body = toolJson(await client.callTool({ name: "get_document_order", arguments: { order_id: "ord-1", include_file: true } }));
    expect(body).toMatchObject({ status: "failed", refunded: "9.90 EUR", failure_reason: "no existe" });
    expect(calls(fetchMock, "GET", "/api/v1/documents/orders/ord-1/file")).toHaveLength(0);
  });

  it("attaches the PDF of a ready order when asked", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 visura");
    route(fetchMock, {
      "GET /api/v1/documents/orders/ord-1": () =>
        jsonResponse({ success: true, data: { ...placedOrder, status: "ready", file_url: "/api/v1/documents/orders/ord-1/file" } }),
      "GET /api/v1/documents/orders/ord-1/file": () => new Response(pdf, { status: 200, headers: { "Content-Type": "application/pdf" } }),
    });
    const result = await client.callTool({ name: "get_document_order", arguments: { order_id: "ord-1", include_file: true } });
    const content = result.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(2);
    const resource = content[1].resource as { mimeType: string; blob: string; uri: string };
    expect(resource.mimeType).toBe("application/pdf");
    expect(Buffer.from(resource.blob, "base64").toString()).toBe("%PDF-1.7 visura");
    expect(resource.uri).toBe("catastrogps://documents/ord-1.pdf");
  });

  it("points to the URL when the PDF is too large", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/orders/ord-1": () =>
        jsonResponse({ success: true, data: { ...placedOrder, status: "ready", file_url: "/api/v1/documents/orders/ord-1/file" } }),
      "GET /api/v1/documents/orders/ord-1/file": () => new Response(new Uint8Array(9 * 1024 * 1024), { status: 200 }),
    });
    const result = await client.callTool({ name: "get_document_order", arguments: { order_id: "ord-1", include_file: true } });
    expect(toolText({ content: [(result.content as unknown[])[1]] })).toContain("too large");
  });

  it("returns a missing order as a clear error", async () => {
    route(fetchMock, {
      "GET /api/v1/documents/orders/nope": () => jsonResponse({ success: false, code: "DOC_404", error: "Pedido no encontrado" }, 404),
    });
    const result = await client.callTool({ name: "get_document_order", arguments: { order_id: "nope" } });
    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain("Order not found for this API key");
  });
});
