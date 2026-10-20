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

export const SITE_ANALYSIS_COUNTRIES = [
  "ES", "PV", "NA", "PT", "FR", "IT", "DE", "AT", "CH", "LI",
  "BE", "NL", "LU", "PL", "CZ", "SK", "SI", "BG", "GR",
  "CY", "DK", "SE", "NO", "FI", "IS", "EE", "LV", "LT", "IE",
] as const;
export type SiteAnalysisCountryCode = (typeof SITE_ANALYSIS_COUNTRIES)[number];

export const ADDRESS_COUNTRIES = [
  "ES", "FR", "IT", "DE", "AT", "NL", "BE", "PL", "CH", "CZ",
  "DK", "NO", "FI", "EE", "LV", "LT", "SI", "SK", "BG", "GR",
  "CY", "LU", "LI", "IS", "IE", "UK", "PT",
] as const;
export type AddressCountryCode = (typeof ADDRESS_COUNTRIES)[number];

export const UNITS_COUNTRIES = ["ES", "PV", "NA"] as const;
export type UnitsCountryCode = (typeof UNITS_COUNTRIES)[number];

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
  remainingSearches?: number;
  quota?: Quota;
}

export interface Quota {
  plan?: string;
  limit?: number;
  remaining?: number;
  resetsAt?: string;
  overage?: {
    enabled: boolean;
    balanceEur?: number;
    unitPriceEur?: number;
    unitsLeft?: number;
  };
  perMinute?: {
    limit?: number;
    remaining?: number;
    resetSeconds?: number;
  };
  fincaCap?: {
    cap: number;
    used?: number;
  };
}

export interface AvailableFields {
  use?: boolean;
  landClass?: boolean;
  yearBuilt?: boolean;
  builtArea?: boolean;
  ownershipShare?: boolean;
  dwellings?: boolean;
  floors?: boolean;
  address?: boolean;
  addressSearch?: boolean;
}

export interface ParcelData {
  reference: string;
  parcelReference?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  municipality?: string;
  region?: string;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  propertyType?: string;
  use?: string;
  landClass?: string;
  builtArea?: number;
  parcelArea?: number;
  yearBuilt?: number;
  ownershipShare?: number;
  staircase?: string;
  floor?: string;
  door?: string;
  dwellings?: number;
  floors?: number;
  source?: string;
  fromOwnCopy?: boolean;
  polygon?: number[][];
  availableFields?: AvailableFields;
}

export type CoordinatesSearchData = ParcelData;

export interface AddressCandidate {
  reference: string;
  country?: string;
  address?: string;
  number?: number;
  postalCode?: string;
  municipality?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  confidence?: number;
  numberMatches?: boolean;
  municipalityMatches?: boolean;
  inOwnCopy?: boolean;
  cadastreAddress?: string;
  use?: string;
  dwellings?: number;
  yearBuilt?: number;
}

export interface AddressCandidatesData {
  query?: { text?: string; street?: string; number?: number; municipality?: string; postalCode?: string };
  candidates: AddressCandidate[] | null;
  attribution?: string;
}

export interface Unit {
  reference: string;
  staircase?: string;
  floor?: string;
  door?: string;
  use?: string;
  area?: number;
  description?: string;
  ownershipShare?: number;
  yearBuilt?: number;
  address?: string;
}

export interface Construction {
  staircase?: string;
  floor?: string;
  door?: string;
  use?: string;
  area?: number;
  description?: string;
}

export interface UnitsPageData {
  reference: string;
  address?: string;
  postalCode?: string;
  municipality?: string;
  region?: string;
  mainUse?: string;
  totalArea?: number;
  yearBuilt?: number;
  unitCount?: number;
  propertyUnitCount?: number;
  units: Unit[] | null;
  constructions?: Construction[] | null;
  truncated?: boolean;
  nextCursor?: string;
  dataSource?: string;
  dataDate?: string;
  attribution?: string;
}

export interface ResolveCandidate {
  country: string;
  kind: string;
  normalized: string;
  confidence: number;
  supported: boolean;
}

export interface ResolveData {
  input: string;
  candidates: ResolveCandidate[] | null;
  ambiguous: boolean;
}

export interface PolygonData {
  reference: string;
  country?: string;
  centroid?: { latitude: number; longitude: number };
  area?: number;
  geojson?: unknown;
  officialRecordUrl?: string;
  cadastreUrl?: string;
  googleMapsUrl?: string;
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
  overlapPct: number | null;
}

export interface ClimatePeriod {
  startYear: number;
  endYear: number;
  meanTempC?: number;
  annualPrecipMm?: number;
  frostDaysPerYear?: number;
  hotDaysPerYear?: number;
}

export interface TerrainData {
  reference: string;
  country: string;
  relief: {
    status: "ok" | "no_data" | "unavailable";
    elevationM?: { mean: number; min: number; max: number };
    slope?: {
      meanPct: number;
      meanDeg: number;
      maxPct: number;
      class: string;
      maxClass: string;
      shareOver10Pct: number;
      classesPct: Record<string, number>;
    };
    aspect?: {
      dominant: string;
      dominantSharePct: number;
      meanDeg: number | null;
      flatSharePct: number;
      sectorsPct: Record<string, number>;
    };
    sample?: { method: string; cells: number; resolutionM: number };
    source: TerrainSource;
  };
  protectedAreas: {
    status: "ok" | "no_data" | "unavailable";
    intersects?: boolean;
    inside?: boolean;
    maxOverlapPct?: number | null;
    natura2000?: TerrainSite[];
    national?: TerrainSite[];
    method?: string;
    sources: TerrainSource[];
  };
  climate?: {
    status: "ok" | "no_data" | "unavailable";
    baseline?: ClimatePeriod;
    recent?: ClimatePeriod;
    change?: {
      meanTempC?: number;
      annualPrecipMm?: number;
      annualPrecipPct?: number;
      frostDaysPerYear?: number;
      hotDaysPerYear?: number;
    };
    frostThresholdC?: number;
    hotThresholdC?: number;
    cell?: { lat: number; lng: number; resolutionDeg: number };
    source?: TerrainSource;
  };
  calculatedAt: string;
  provenance: string;
}

export interface GroundMotionData {
  reference: string;
  country: string;
  status: "ok" | "no_data" | "unavailable";
  reason?: "no_reflectors" | "outside_coverage" | "parcel_too_large";
  period: { from: string; to: string; label: string };
  groundMotion?: {
    class: string;
    worstClass: string;
    vertical: {
      meanMmYear: number;
      maxSubsidenceMmYear: number;
      maxUpliftMmYear: number;
      stdMmYear?: number;
      accelerationMmYear2?: number;
      rmseMm?: number;
    };
    eastWest?: { meanMmYear: number; stdMmYear?: number };
    yearlyDisplacement?: Array<{ year: number; mm: number }>;
    cellsWithData: number;
    cellsConsidered: number;
    coveragePct: number;
    basis: "parcel" | "surroundings";
    cellSizeM: number;
  };
  source: TerrainSource;
  calculatedAt: string;
  provenance: string;
}

export interface SolarData {
  available: boolean;
  status: string;
  annualProductionKwh: number;
  installableKw: number;
  annualSavingsEur: number;
  paybackYears: number;
  co2AvoidedKg: number;
  irradiationKwhM2: number;
  solarGrade: number;
  optimalOrientation?: string;
  tiltAngleDeg?: number;
  installationCostEur?: number;
  source?: string;
}

export type AgroData = Record<string, unknown>;

export interface MarketData {
  available: boolean;
  status?: string;
  estimatedPriceEur?: number;
  pricePerM2Eur?: number;
  salesCount?: number;
  lastSaleDate?: string;
  granularity?: string;
  source?: string;
  message?: string;
  dataQuality?: string;
  updatedAt?: string;
}

export interface ScoreData {
  score: number;
  rating: string;
  recommendation?: string;
  components?: Record<string, number>;
  availableComponents?: Record<string, boolean>;
  riskFactors?: string[];
  opportunityFactors?: string[];
}

export interface ValueHistoryEntry {
  id?: string;
  reference?: string;
  country?: string;
  cadastralValueEur?: number;
  area?: number;
  use?: string;
  capturedOn?: string;
  source?: string;
  createdAt?: string;
}

export interface ValueHistoryData {
  reference: string;
  country: string;
  entries: ValueHistoryEntry[] | null;
  totalEntries: number;
  areaChangePct: number | null;
}

export interface CompareItem {
  reference: string;
  country: string;
  parcel?: Partial<ParcelData>;
  solar?: Partial<SolarData>;
  agriculture?: {
    available?: boolean;
    status?: string;
    isAgricultural?: boolean;
    landUse?: string;
    cropGroup?: string;
    crop?: string;
    areaHa?: number;
  };
  score?: {
    available?: boolean;
    score?: number;
    rating?: string;
  };
  error?: string;
}

export interface CompareData {
  parcels: CompareItem[];
  total: number;
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
  message?: string;
  error?: string;
  details?: unknown;
  data?: unknown;
}

export interface ServerConfig {
  apiKey: string;
  apiUrl: string;
  timeout: number;
}
