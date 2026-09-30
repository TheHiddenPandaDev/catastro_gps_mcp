export const SUPPORTED_COUNTRIES = [
  "ES", "PV", "NA", "PT", "FR", "IT", "DE", "AT", "CH", "LI",
  "BE", "NL", "LU", "PL", "CZ", "SK", "SI", "HR", "BG", "GR",
  "CY", "DK", "SE", "NO", "FI", "IS", "EE", "LV", "LT", "IE",
  "UK",
] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export const COORDINATES_ONLY_COUNTRIES = ["UK"] as const;

export const REFERENCE_COUNTRIES = [
  "ES", "PV", "NA", "PT", "FR", "IT", "DE", "AT", "CH", "LI",
  "BE", "NL", "LU", "PL", "CZ", "SK", "SI", "HR", "BG", "GR",
  "CY", "DK", "SE", "NO", "FI", "IS", "EE", "LV", "LT", "IE",
] as const;
export type ReferenceCountryCode = (typeof REFERENCE_COUNTRIES)[number];

export const ENRICHMENT_COUNTRIES = ["ES", "PV", "NA", "PT", "FR", "IT", "DE"] as const;
export type EnrichmentCountryCode = (typeof ENRICHMENT_COUNTRIES)[number];

export const VALUE_HISTORY_COUNTRIES = ["ES", "PV", "NA", "PT", "FR", "IT", "DE", "AT"] as const;
export type ValueHistoryCountryCode = (typeof VALUE_HISTORY_COUNTRIES)[number];

export const COMPARE_COUNTRIES = ["ES", "PT", "FR", "IT", "DE"] as const;
export type CompareCountryCode = (typeof COMPARE_COUNTRIES)[number];

export const COUNTRY_CODES_TEXT =
  "ES Spain, PV Basque Country, NA Navarre, PT Portugal, FR France, IT Italy, DE Germany, " +
  "AT Austria, CH Switzerland, LI Liechtenstein, BE Belgium, NL Netherlands, LU Luxembourg, " +
  "PL Poland, CZ Czechia, SK Slovakia, SI Slovenia, HR Croatia, BG Bulgaria, GR Greece, " +
  "CY Cyprus, DK Denmark, SE Sweden, NO Norway, FI Finland, IS Iceland, EE Estonia, " +
  "LV Latvia, LT Lithuania, IE Ireland, UK United Kingdom";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  searchesRemaining?: number;
}

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
  fuenteDatos?: string;
  poligono?: number[][];
  availableFields?: Record<string, boolean>;
}

export interface CoordinatesSearchData {
  referenciaCatastral: string;
  refCatastral?: string;
  refCat14?: string;
  pais?: string;
  direccion?: string;
  codigoPostal?: string;
  municipio?: string;
  provincia?: string;
  tipoInmueble?: string;
  superficieParcela?: number;
  coordenadas: { latitud: number; longitud: number };
  googleMapsUrl: string;
}

export interface AddressSearchData {
  referenciaCatastral: string;
  refCat14?: string;
  direccion?: string;
  provincia?: string;
  municipio?: string;
  tipoVia?: string;
  nombreVia?: string;
  numero?: number;
  planta?: string;
  puerta?: string;
  codigoPostal?: string;
}

export interface PolygonData {
  refcat?: string;
  refCatastral?: string;
  pais?: string;
  latitud?: number;
  longitud?: number;
  centroid?: { latitude: number; longitude: number };
  area?: number;
  superficieParcela?: number;
  poligono?: number[][];
  geojson?: unknown;
}

export interface TerrainSource {
  name: string;
  provider: string;
  license: string;
  attribution: string;
  url: string;
  resolution?: string;
  edition?: string;
}

export interface TerrainSite {
  code: string;
  name: string;
  type?: string;
  designation?: string;
  country: string;
  overlap_pct: number | null;
}

export interface TerrainData {
  refcat: string;
  country: string;
  relief: {
    status: "ok" | "no_data" | "unavailable";
    elevation_m?: { mean: number; min: number; max: number };
    slope?: {
      mean_pct: number;
      mean_deg: number;
      max_pct: number;
      class: string;
      max_class: string;
      share_over_10_pct: number;
      classes_pct: Record<string, number>;
    };
    aspect?: {
      dominant: string;
      dominant_share_pct: number;
      mean_deg: number | null;
      flat_share_pct: number;
      sectors_pct: Record<string, number>;
    };
    sample?: { method: string; cells: number; resolution_m: number };
    source: TerrainSource;
  };
  protected_areas: {
    status: "ok" | "no_data" | "unavailable";
    intersects?: boolean;
    inside?: boolean;
    max_overlap_pct?: number | null;
    natura2000?: TerrainSite[];
    national?: TerrainSite[];
    method?: string;
    sources: TerrainSource[];
  };
  calculated_at: string;
  provenance: string;
}

export interface SolarData {
  kwh_year: number;
  kw_instalables: number;
  ahorro_anual_eur: number;
  amortizacion_anos: number;
  co2_evitado_kg: number;
  irradiacion_media: number;
  nota_solar: number;
  orientacion_optima?: string;
  angulo_inclinacion?: number;
  costo_instalacion_eur?: number;
  disponible: boolean;
  estado: string;
  fuente?: string;
}

export interface AgroData {
  agro?: Record<string, unknown>;
}

export interface MarketData {
  precio_estimado_eur?: number;
  precio_m2_eur?: number;
  num_transacciones?: number;
  fecha_ultima_transaccion?: string;
  granularidad?: string;
  granularidad_display?: string;
  fuente?: string;
  transacciones_historial?: unknown[];
  disponible: boolean;
  estado?: string;
  mensaje_usuario?: string;
  data_quality?: string;
  fecha_actualizacion?: string;
}

export interface ScoreData {
  score_inversion: {
    puntuacion: number;
    clasificacion: string;
    recomendacion?: string;
    componentes?: Record<string, number>;
    factores_riesgo?: string[];
    factores_oportunidad?: string[];
  };
}

export interface ValueHistoryEntry {
  parcel_ref?: string;
  country?: string;
  valor_catastral?: number;
  superficie?: number;
  uso?: string;
  fecha_captura?: string;
  fuente?: string;
}

export interface ValueHistoryData {
  refcat: string;
  country: string;
  entries: ValueHistoryEntry[] | null;
  totalEntries: number;
  variacionPct: number | null;
}

export interface CompareItem {
  ref_catastral: string;
  country: string;
  parcela?: Partial<ParcelData>;
  solar?: Partial<SolarData>;
  agro?: {
    es_agricola?: boolean;
    disponible?: boolean;
    uso_suelo?: { descripcion?: string; grupo?: string };
  };
  score?: {
    score_global?: number;
    clasificacion?: string;
    disponible?: boolean;
  };
  error?: string;
}

export interface CompareData {
  comparacion: CompareItem[];
  total: number;
}

export interface ApiErrorResponse {
  success: false;
  error?: string;
  message?: string;
  code?: string;
  data?: unknown;
  parsed?: unknown;
}

export interface ServerConfig {
  apiKey: string;
  apiUrl: string;
  timeout: number;
}
