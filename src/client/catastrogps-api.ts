import type {
  ServerConfig,
  ApiResponse,
  ParcelData,
  PolygonData,
  SolarData,
  AgroData,
  MarketData,
  ScoreData,
  ValueHistoryData,
  CompareData,
  CoordinatesSearchData,
  AddressSearchData,
  ApiErrorResponse,
  DocumentCatalogData,
  WalletData,
  DocumentOrderRequest,
  DocumentOrderPlacement,
  DocumentOrderData,
} from "../types/index.js";
import { USER_AGENT } from "../version.js";

export class CatastroGPSApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly resetsAt?: string,
  ) {
    super(message);
    this.name = "CatastroGPSApiError";
  }
}

type QueryParams = Record<string, string | number | undefined>;

export class CatastroGPSClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: ServerConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.timeout = config.timeout;
  }

  private buildUrl(path: string, params?: QueryParams): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async send<T>(
    method: "GET" | "POST",
    path: string,
    params?: QueryParams,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const response = await this.request(method, path, params, body, { Accept: "application/json", ...extraHeaders });
    return (await response.json()) as T;
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    params: QueryParams | undefined,
    body: unknown,
    extraHeaders: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "User-Agent": USER_AGENT,
      ...extraHeaders,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(this.buildUrl(path, params), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as Partial<ApiErrorResponse>;
        throw new CatastroGPSApiError(
          errorBody.code || `HTTP_${response.status}`,
          errorBody.error || errorBody.message || `API returned ${response.status}`,
          response.status,
          errorBody.data ?? errorBody.parsed,
          response.headers.get("X-RateLimit-Reset") ?? undefined,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof CatastroGPSApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new CatastroGPSApiError("MCP_TIMEOUT", "Request timed out", 408);
      }
      throw new CatastroGPSApiError(
        "MCP_NETWORK",
        `Network error: ${error instanceof Error ? error.message : "unknown"}`,
        0,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parcelPath(reference: string, suffix = ""): string {
    return `/api/catastro/${encodeURIComponent(reference)}${suffix}`;
  }

  async getParcelByReference(reference: string, country?: string): Promise<ApiResponse<ParcelData>> {
    return this.send("GET", this.parcelPath(reference), { country });
  }

  async getParcelByCoordinates(lat: number, lng: number, country?: string): Promise<ApiResponse<CoordinatesSearchData>> {
    return this.send("GET", "/api/search/coordinates", { lat, lng, country });
  }

  async searchAddress(address: string): Promise<ApiResponse<AddressSearchData>> {
    return this.send("POST", "/api/search/address/parse", undefined, { direccion: address });
  }

  async getPolygon(reference: string, country?: string): Promise<ApiResponse<PolygonData>> {
    return this.send("GET", this.parcelPath(reference, "/polygon"), { country });
  }

  async getSolarPotential(reference: string, country?: string): Promise<ApiResponse<SolarData>> {
    return this.send("GET", this.parcelPath(reference, "/solar"), { country });
  }

  async getAgriculture(reference: string, country?: string): Promise<ApiResponse<AgroData>> {
    return this.send("GET", this.parcelPath(reference, "/agro"), { country });
  }

  async getMarketData(reference: string, country?: string): Promise<ApiResponse<MarketData>> {
    return this.send("GET", this.parcelPath(reference, "/market"), { country });
  }

  async getInvestmentScore(reference: string, country?: string): Promise<ApiResponse<ScoreData>> {
    return this.send("GET", this.parcelPath(reference, "/score"), { country });
  }

  async getValueHistory(reference: string, country?: string): Promise<ApiResponse<ValueHistoryData>> {
    return this.send("GET", this.parcelPath(reference, "/value-history"), { country });
  }

  async listDocuments(country?: string, parcelRef?: string, locale?: string): Promise<ApiResponse<DocumentCatalogData>> {
    return this.send("GET", "/api/v1/documents/catalog", { country, parcel_ref: parcelRef, locale });
  }

  async getWallet(): Promise<ApiResponse<WalletData>> {
    return this.send("GET", "/api/v1/wallet");
  }

  async orderDocument(order: DocumentOrderRequest, idempotencyKey: string): Promise<ApiResponse<DocumentOrderPlacement>> {
    return this.send("POST", "/api/v1/documents/orders", undefined, order, { "Idempotency-Key": idempotencyKey });
  }

  async getDocumentOrder(orderId: string): Promise<ApiResponse<DocumentOrderData>> {
    return this.send("GET", `/api/v1/documents/orders/${encodeURIComponent(orderId)}`);
  }

  async getDocumentFile(orderId: string): Promise<Uint8Array> {
    const response = await this.request(
      "GET",
      `/api/v1/documents/orders/${encodeURIComponent(orderId)}/file`,
      undefined,
      undefined,
      { Accept: "application/pdf" },
    );
    return new Uint8Array(await response.arrayBuffer());
  }

  async compareParcels(parcels: Array<{ reference: string; country: string }>): Promise<ApiResponse<CompareData>> {
    return this.send("POST", "/api/catastro/compare", undefined, {
      parcelas: parcels.map((parcel) => ({ ref_catastral: parcel.reference, country: parcel.country })),
    });
  }
}
