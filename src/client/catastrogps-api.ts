import type {
  Quota,
  ServerConfig,
  ApiResponse,
  ParcelData,
  PolygonData,
  SolarData,
  TerrainData,
  GroundMotionData,
  AgroData,
  MarketData,
  ScoreData,
  ValueHistoryData,
  CompareData,
  CoordinatesSearchData,
  AddressCandidatesData,
  UnitsPageData,
  ResolveData,
  ApiErrorResponse,
} from "../types/index.js";
import { USER_AGENT } from "../version.js";

export interface ApiErrorExtras {
  quota?: Quota;
  retryAfterSeconds?: number;
}

export class CatastroGPSApiError extends Error {
  public readonly quota?: Quota;
  public readonly retryAfterSeconds?: number;

  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    extras: ApiErrorExtras = {},
  ) {
    super(message);
    this.name = "CatastroGPSApiError";
    this.quota = extras.quota;
    this.retryAfterSeconds = extras.retryAfterSeconds;
  }

  get resetsAt(): string | undefined {
    return this.quota?.resetsAt;
  }
}

type QueryParams = Record<string, string | number | undefined>;

export type { Quota };

function numberHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readOverage(headers: Headers): Quota["overage"] {
  const flag = headers.get("X-Quota-Overage");
  if (flag === null) return undefined;
  return {
    enabled: flag.trim().toLowerCase() === "on",
    balanceEur: numberHeader(headers, "X-Quota-Balance"),
    unitPriceEur: numberHeader(headers, "X-Quota-Overage-Unit-Price"),
    unitsLeft: numberHeader(headers, "X-Quota-Overage-Remaining"),
  };
}

function readPerMinute(headers: Headers): Quota["perMinute"] {
  if (!headers.has("X-RateLimit-Limit") && !headers.has("X-RateLimit-Remaining")) return undefined;
  return {
    limit: numberHeader(headers, "X-RateLimit-Limit"),
    remaining: numberHeader(headers, "X-RateLimit-Remaining"),
    resetSeconds: numberHeader(headers, "X-RateLimit-Reset"),
  };
}

function readFincaCap(headers: Headers): Quota["fincaCap"] {
  const cap = numberHeader(headers, "X-Quota-Finca-Cap");
  if (cap === undefined) return undefined;
  return { cap, used: numberHeader(headers, "X-Quota-Finca-Cap-Used") };
}

export function readQuota(headers: Headers): Quota | undefined {
  const quota: Quota = {};
  const plan = headers.get("X-Quota-Tier");
  if (plan !== null) quota.plan = plan;
  const limit = numberHeader(headers, "X-Quota-Limit");
  if (limit !== undefined) quota.limit = limit;
  const remaining = numberHeader(headers, "X-Quota-Remaining");
  if (remaining !== undefined) quota.remaining = remaining;
  const resetsAt = headers.get("X-Quota-Reset");
  if (resetsAt !== null) quota.resetsAt = resetsAt;
  const overage = readOverage(headers);
  if (overage) quota.overage = overage;
  const perMinute = readPerMinute(headers);
  if (perMinute) quota.perMinute = perMinute;
  const fincaCap = readFincaCap(headers);
  if (fincaCap) quota.fincaCap = fincaCap;
  return Object.keys(quota).length > 0 ? quota : undefined;
}

function retryAfterSeconds(headers: Headers): number | undefined {
  const value = numberHeader(headers, "Retry-After");
  return value !== undefined && value > 0 ? value : undefined;
}

export class CatastroGPSClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  public lastQuota?: Quota;

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

  private async send<T>(method: "GET" | "POST", path: string, params?: QueryParams, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
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

      const quota = readQuota(response.headers);
      if (quota) this.lastQuota = quota;

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as Partial<ApiErrorResponse>;
        throw new CatastroGPSApiError(
          errorBody.code || `HTTP_${response.status}`,
          errorBody.error || errorBody.message || `API returned ${response.status}`,
          response.status,
          errorBody.data ?? errorBody.parsed,
          { quota, retryAfterSeconds: retryAfterSeconds(response.headers) },
        );
      }

      const payload = (await response.json()) as T;
      if (quota && payload && typeof payload === "object") {
        return { ...payload, quota } as T;
      }
      return payload;
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

  async searchAddressCandidates(address: string, country?: string, limit?: number): Promise<ApiResponse<AddressCandidatesData>> {
    return this.send("GET", "/api/search/address/candidates", { q: address, country, limit });
  }

  async getUnits(reference: string, country?: string, cursor?: string): Promise<ApiResponse<UnitsPageData>> {
    return this.send("GET", this.parcelPath(reference, "/units"), { country, cursor });
  }

  async resolve(text: string, hint?: string): Promise<ApiResponse<ResolveData>> {
    return this.send("GET", "/api/resolve", { q: text, hint });
  }

  async getPolygon(reference: string, country?: string): Promise<ApiResponse<PolygonData>> {
    return this.send("GET", this.parcelPath(reference, "/polygon"), { country });
  }

  async getSolarPotential(reference: string, country?: string): Promise<ApiResponse<SolarData>> {
    return this.send("GET", this.parcelPath(reference, "/solar"), { country });
  }

  async getTerrain(reference: string, country?: string, point?: { lat: number; lng: number }): Promise<ApiResponse<TerrainData>> {
    return this.send("GET", this.parcelPath(reference, "/terrain"), { country, lat: point?.lat, lng: point?.lng });
  }

  async getGroundMotion(reference: string, country?: string, point?: { lat: number; lng: number }): Promise<ApiResponse<GroundMotionData>> {
    return this.send("GET", this.parcelPath(reference, "/ground-motion"), { country, lat: point?.lat, lng: point?.lng });
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

  async compareParcels(parcels: Array<{ reference: string; country: string }>): Promise<ApiResponse<CompareData>> {
    return this.send("POST", "/api/catastro/compare", undefined, {
      parcelas: parcels.map((parcel) => ({ ref_catastral: parcel.reference, country: parcel.country })),
    });
  }
}
