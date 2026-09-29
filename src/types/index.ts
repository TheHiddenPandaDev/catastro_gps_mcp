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

export interface ScoreData {
  score: number;
  rating: string;
  factores: Record<string, string>;
}

export interface ValueHistoryData {
  historial: Array<{
    fecha: string;
    valor_catastral: number;
    superficie_m2: number;
    uso: string;
  }>;
  nota?: string;
}

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
