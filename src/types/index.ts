// Supported country codes
export const SUPPORTED_COUNTRIES = ["ES", "PT", "FR", "IT", "DE", "PV", "NA"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

// API wrapper response — backend always wraps in { success, data, error, code }
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  searchesRemaining?: number;
}

// Backend Parcel entity (camelCase JSON tags from Go struct)
export interface ParcelData {
  refCatastral: string;
  pais?: string;
  direccion?: string;
  codigoPostal?: string;
  municipio?: string;
  provincia?: string;
  latitud: number;
  longitud: number;
  googleMapsUrl: string;
  uso?: string;
  clase?: string;
  superficieConstruida?: number;
  superficieParcela?: number;
  anioConstruccion?: number;
  coefParticipacion?: string;
  poligono?: number[][];
  availableFields?: Record<string, boolean>;
}

// Polygon response
export interface PolygonData {
  refCatastral: string;
  pais?: string;
  latitud: number;
  longitud: number;
  poligono?: number[][];
  geojson?: unknown;
}

// Solar response
export interface SolarData {
  kwh_year: number;
  kw_instalables: number;
  ahorro_anual_eur: number;
  amortizacion_anos: number;
  co2_evitado_kg: number;
  irradiacion_media: number;
  nota_solar: number;
  disponible: boolean;
  estado: string;
}

// Agriculture response
export interface AgroData {
  uso_suelo?: string;
  ndvi?: { current: number; trend: string };
  cultivos?: Array<{ nombre: string; superficie_m2: number }>;
  precios_cultivo?: Array<{ cultivo: string; precio_eur_ton: number }>;
}

// Market response
export interface MarketData {
  transacciones?: Array<{
    fecha: string;
    precio_eur: number;
    superficie_m2: number;
    precio_m2: number;
    tipo: string;
  }>;
  precio_medio_m2?: number;
  fuente?: string;
}

// Score response
export interface ScoreData {
  score: number;
  rating: string;
  factores: Record<string, string>;
}

// Value history response
export interface ValueHistoryData {
  historial: Array<{
    fecha: string;
    valor_catastral: number;
    superficie_m2: number;
    uso: string;
  }>;
  nota?: string;
}

// Compare response
export interface CompareData {
  parcelas: Array<{
    refCatastral: string;
    pais: string;
    latitud: number;
    longitud: number;
    superficieParcela?: number;
    uso?: string;
    score?: number;
    solar_kwh?: number;
    precio_m2?: number;
  }>;
}

// Coordinates search response
export interface CoordinatesSearchData {
  referenciaCatastral: string;
  refCat14?: string;
  direccion?: string;
  municipio?: string;
  tipoInmueble?: string;
  coordenadas: { latitud: number; longitud: number };
  googleMapsUrl: string;
}

// API error response
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

// Config
export interface ServerConfig {
  apiKey: string;
  apiUrl: string;
  timeout: number;
}
