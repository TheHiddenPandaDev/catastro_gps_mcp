import type {
  ServerConfig,
  ApiResponse,
  ParcelData,
  PolygonData,
  SolarData,
  TerrainData,
  AgroData,
  MarketData,
  ScoreData,
  ValueHistoryData,
  CompareData,
  CoordinatesSearchData,
  AddressSearchData,
  ApiErrorResponse,
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

export interface Quota {
  plan?: string;
  limit?: number;
  remaining?: number;
  resetsAt?: string;
}

export function readQuota(headers: Headers): Quota | undefined {
  const plan = headers.get("X-Quota-Tier") ?? undefined;
  const family = headers.has("X-Quota-Limit") ? "X-Quota" : plan ? "X-RateLimit" : undefined;
  if (!family) return undefined;
  const limit = headers.get(`${family}-Limit`);
  const remaining = headers.get(`${family}-Remaining`);
  return {
    plan,
    limit: limit === null ? undefined : Number(limit),
    remaining: remaining === null ? undefined : Number(remaining),
    resetsAt: headers.get(`${family}-Reset`) ?? undefined,
  };
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
          quota?.resetsAt,
        );
      }

      return (await response.json()) as T;
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

  async getTerrain(reference: string, country?: string): Promise<ApiResponse<TerrainData>> {
    return this.send("GET", this.parcelPath(reference, "/terrain"), { country });
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
