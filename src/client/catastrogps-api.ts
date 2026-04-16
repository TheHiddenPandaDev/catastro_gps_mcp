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
  ApiErrorResponse,
} from "../types/index.js";

export class CatastroGPSApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CatastroGPSApiError";
  }
}

export class CatastroGPSClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: ServerConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.timeout = config.timeout;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
          "Accept": "application/json",
          "User-Agent": "catastrogps-mcp/1.0.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Partial<ApiErrorResponse>;
        throw new CatastroGPSApiError(
          body.code || `HTTP_${response.status}`,
          body.error || `API returned ${response.status}`,
          response.status,
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

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "catastrogps-mcp/1.0.0",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const resBody = await response.json().catch(() => ({})) as Partial<ApiErrorResponse>;
        throw new CatastroGPSApiError(
          resBody.code || `HTTP_${response.status}`,
          resBody.error || `API returned ${response.status}`,
          response.status,
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

  // GET /api/catastro/:refcat?country=XX
  async getParcelByReference(reference: string, country: string): Promise<ApiResponse<ParcelData>> {
    return this.request<ApiResponse<ParcelData>>(
      `/api/catastro/${encodeURIComponent(reference)}`,
      { country },
    );
  }

  // POST /api/search/coordinates
  async getParcelByCoordinates(lat: number, lng: number, country: string): Promise<ApiResponse<CoordinatesSearchData>> {
    return this.post<ApiResponse<CoordinatesSearchData>>("/api/search/coordinates", {
      latitude: lat,
      longitude: lng,
      country,
    });
  }

  // GET /api/catastro/:refcat/polygon?country=XX
  async getPolygon(reference: string, country: string): Promise<ApiResponse<PolygonData>> {
    return this.request<ApiResponse<PolygonData>>(
      `/api/catastro/${encodeURIComponent(reference)}/polygon`,
      { country },
    );
  }

  // GET /api/catastro/:refcat/solar?country=XX
  async getSolarPotential(reference: string, country: string): Promise<ApiResponse<SolarData>> {
    return this.request<ApiResponse<SolarData>>(
      `/api/catastro/${encodeURIComponent(reference)}/solar`,
      { country },
    );
  }

  // GET /api/catastro/:refcat/agro?country=XX
  async getAgriculture(reference: string, country: string): Promise<ApiResponse<AgroData>> {
    return this.request<ApiResponse<AgroData>>(
      `/api/catastro/${encodeURIComponent(reference)}/agro`,
      { country },
    );
  }

  // GET /api/catastro/:refcat/mercado?country=XX
  async getMarketData(reference: string, country: string): Promise<ApiResponse<MarketData>> {
    return this.request<ApiResponse<MarketData>>(
      `/api/catastro/${encodeURIComponent(reference)}/mercado`,
      { country },
    );
  }

  // GET /api/catastro/:refcat/score?country=XX
  async getInvestmentScore(reference: string, country: string): Promise<ApiResponse<ScoreData>> {
    return this.request<ApiResponse<ScoreData>>(
      `/api/catastro/${encodeURIComponent(reference)}/score`,
      { country },
    );
  }

  // GET /api/catastro/:refcat/historico-valor?country=XX
  async getValueHistory(reference: string, country: string): Promise<ApiResponse<ValueHistoryData>> {
    return this.request<ApiResponse<ValueHistoryData>>(
      `/api/catastro/${encodeURIComponent(reference)}/historico-valor`,
      { country },
    );
  }

  // POST /api/catastro/comparar
  async compareParcels(parcels: Array<{ reference: string; country: string }>): Promise<ApiResponse<CompareData>> {
    return this.post<ApiResponse<CompareData>>("/api/catastro/comparar", { parcels });
  }
}
