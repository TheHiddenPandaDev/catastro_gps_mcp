import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CatastroGPSClient } from "../client/catastrogps-api.js";
import type { DocumentCatalogEntry, DocumentOrderData, DocumentOrderRequest } from "../types/index.js";
import { errorResult, handleToolError, jsonResult } from "./shared.js";

export const TOP_UP_URL = "https://www.catastrogps.es/app/developer";
const MAX_INLINE_PDF_BYTES = 8 * 1024 * 1024;

export function euros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")} EUR`;
}

export function defaultIdempotencyKey(order: DocumentOrderRequest, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const fingerprint = JSON.stringify([order.country, order.product, order.parcel_ref, order.email ?? "", order.holder ?? null, day]);
  return `mcp-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 40)}`;
}

function catalogView(d: DocumentCatalogEntry) {
  return {
    country: d.country,
    product: d.product,
    name: d.name,
    price: euros(d.amount_cents),
    amount_cents: d.amount_cents,
    orderable_by_api: d.api_orderable,
    delivery: d.delivery ?? null,
    required_fields: d.required_fields,
    unavailable_reason: d.api_unavailable_reason ?? null,
  };
}

function orderView(o: DocumentOrderData) {
  return {
    order_id: o.id,
    status: o.status,
    country: o.country,
    product: o.product,
    parcel_ref: o.parcel_ref,
    charged: euros(o.amount_cents),
    created_at: o.created_at,
    ready_at: o.ready_at ?? null,
    failed_at: o.failed_at ?? null,
    failure_reason: o.failure_reason ?? null,
    refunded: o.refunded_cents ? euros(o.refunded_cents) : null,
    file_url: o.file_url ?? null,
  };
}

export function registerListDocuments(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "list_documents",
    {
      title: "List Official Documents",
      description:
        "List the official documents that can be ordered for a country or a parcel (Spanish nota simple, " +
        "Italian visura and mortgage inspection, German Flurstückskarte…), with their price in euros, whether " +
        "they can be ordered through the API and which fields they need. Also returns the prepaid wallet " +
        "balance of the organization that owns the API key. Free: listing never charges anything.",
      inputSchema: {
        country: z.string().length(2).optional().describe("Country code (ES, IT, DE, FR, PT, PL). Omit to list every country."),
        parcel_ref: z.string().min(1).optional().describe("Parcel reference, to keep only documents that exist for it. Needs country."),
        locale: z.string().min(2).max(5).optional().describe("Language of the document names, e.g. en, es, it, de. Defaults to en."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ country, parcel_ref, locale }) => {
      try {
        const [{ data: catalog }, wallet] = await Promise.all([
          client.listDocuments(country?.toUpperCase(), parcel_ref, locale),
          client.getWallet().then((r) => r.data).catch(() => null),
        ]);
        return jsonResult({
          documents: catalog.documents.map(catalogView),
          wallet_balance: wallet ? euros(wallet.balance_cents) : null,
          wallet_balance_cents: wallet ? wallet.balance_cents : null,
          top_up: `Top up the wallet at ${TOP_UP_URL} (fixed amounts, paid by card).`,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}

const holderSchema = z
  .object({
    name: z.string().min(1).describe("Full name of the person or company the document is requested for"),
    tax_id: z.string().min(1).describe("Their NIF, NIE or CIF"),
    tax_id_type: z.enum(["nif", "nie", "cif", "passport"]).optional().describe("Type of tax_id. Defaults to nif."),
    cru: z.string().optional().describe("Registry identifier (CRU/IDUFIR) when the property needs one"),
    mandate_given: z.boolean().describe("The holder authorised you to request it on their behalf (you keep the proof)"),
    consent_given: z.boolean().describe("The holder consented to the processing of their data"),
    parcel_year: z.number().int().optional().describe("Year the building was built, if known"),
  })
  .describe("Only for the Spanish nota simple: whose name the registry request goes in");

export function registerOrderDocument(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "order_document",
    {
      title: "Order Official Document (charges the wallet)",
      description:
        "THIS SPENDS MONEY. Orders an official document and charges its catalogue price to the prepaid wallet " +
        "of the organization that owns the API key. Before calling, show the user the document, the parcel and the " +
        "price from list_documents and get their explicit confirmation; only then set confirm=true. The balance is " +
        "checked first and nothing is charged if it is not enough. If the document cannot be issued the money goes " +
        "back to the wallet automatically. Retrying the same order the same day never charges twice. " +
        "Follow up with get_document_order.",
      inputSchema: {
        country: z.string().length(2).describe("Country code, e.g. ES, IT, DE"),
        product: z.string().min(1).describe("Product code from list_documents, e.g. nota_simple, visura, flurkarte"),
        parcel_ref: z.string().min(1).describe("Official parcel reference"),
        email: z.string().email().optional().describe("Where a copy is delivered. Defaults to the API key owner's email."),
        locale: z.string().min(2).max(5).optional().describe("Language for emails about the order"),
        holder: holderSchema.optional(),
        confirm: z.boolean().describe("Must be true, and only after the user explicitly approved paying the price"),
        idempotency_key: z
          .string()
          .regex(/^[A-Za-z0-9_.:-]{8,128}$/)
          .optional()
          .describe("Optional. Same key = same order, never charged twice. Defaults to a fingerprint of the order and today's date."),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ country, product, parcel_ref, email, locale, holder, confirm, idempotency_key }) => {
      if (confirm !== true) {
        return errorResult(
          "MCP_CONFIRM",
          "Not ordered. This document costs money: show the user the price from list_documents, ask for explicit approval and call again with confirm=true.",
        );
      }
      const order: DocumentOrderRequest = {
        country: country.toUpperCase(),
        product: product.toLowerCase(),
        parcel_ref,
        email,
        locale,
        holder,
        channel: "mcp",
      };
      try {
        const [{ data: catalog }, { data: wallet }] = await Promise.all([
          client.listDocuments(order.country, parcel_ref),
          client.getWallet(),
        ]);
        const entry = catalog.documents.find((d) => d.product === order.product);
        if (!entry || !entry.api_orderable) {
          return errorResult(
            "DOC_002",
            `${order.country}/${order.product} cannot be ordered through the API for this parcel. Call list_documents to see what can.`,
          );
        }
        if (wallet.balance_cents < entry.amount_cents) {
          return errorResult(
            "WAL_001",
            `Not enough balance: the ${entry.name} costs ${euros(entry.amount_cents)} and the wallet has ${euros(wallet.balance_cents)}. ` +
              `Nothing was charged. Top up at ${TOP_UP_URL}.`,
            { balance_cents: wallet.balance_cents, required_cents: entry.amount_cents },
          );
        }
        const key = idempotency_key ?? defaultIdempotencyKey(order);
        const { data } = await client.orderDocument(order, key);
        return jsonResult({
          ...orderView(data.order),
          wallet_balance: euros(data.balance_cents),
          already_ordered: data.replayed === true,
          idempotency_key: key,
          next: "Call get_document_order with this order_id until status is ready (PDF available) or failed (refunded).",
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}

export function registerGetDocumentOrder(server: McpServer, client: CatastroGPSClient): void {
  server.registerTool(
    "get_document_order",
    {
      title: "Get Document Order",
      description:
        "Status of a document ordered with order_document: processing, ready (the PDF can be downloaded) or failed " +
        "(the price was returned to the wallet). With include_file=true and a ready order, the PDF is attached. Free.",
      inputSchema: {
        order_id: z.string().min(1).describe("order_id returned by order_document"),
        include_file: z.boolean().optional().describe("Attach the PDF when the order is ready"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ order_id, include_file }) => {
      try {
        const { data } = await client.getDocumentOrder(order_id);
        const text = { type: "text" as const, text: JSON.stringify(orderView(data), null, 2) };
        if (!include_file || data.status !== "ready") {
          return { content: [text] };
        }
        const pdf = await client.getDocumentFile(order_id);
        if (pdf.byteLength > MAX_INLINE_PDF_BYTES) {
          return { content: [text, { type: "text" as const, text: `The PDF is too large to attach; download it from ${data.file_url} with your API key.` }] };
        }
        return {
          content: [
            text,
            {
              type: "resource" as const,
              resource: {
                uri: `catastrogps://documents/${data.id}.pdf`,
                mimeType: "application/pdf",
                blob: Buffer.from(pdf).toString("base64"),
              },
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
