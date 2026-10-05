import { CatastroGPSApiError } from "../client/catastrogps-api.js";
import type { Quota } from "../types/index.js";

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

const PRICING_URL = "https://www.parcelgps.com/developers";
const TOP_UP_URL = "https://parcelgps.com/app/developer";

const FRIENDLY_MESSAGES: Record<string, string> = {
  KEY_AUTH_001: "Invalid API key format. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_002: "Unknown API key. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_003: "Invalid API key. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_004: `Monthly quota used up. Upgrade at ${PRICING_URL} or turn on prepaid overage and top up at ${TOP_UP_URL}`,
  KEY_AUTH_005: "The API could not verify your organization. Try again later.",
  KEY_RATE_001: "Too many requests. Slow down and retry.",
  KEY_RATE_002: "Per-minute limit of your plan reached. Slow down and retry.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Slow down and retry.",
  UNAUTHORIZED: `Missing or invalid API key. Get one at ${PRICING_URL}`,
  PRO_REQUIRED: `This endpoint needs a developer API key. Get one at ${PRICING_URL}`,
  NOT_FOUND: "Nothing found. Check the reference (or address) and the country code.",
  VALIDATION_ERROR: "Invalid input. Check the reference format for this country.",
  CNV_COVERAGE: "That reference or point is in a country that is not covered yet.",
  CNV_AMBIGUOUS: "The reference matches several countries. Call again with one of the candidate country codes.",
  CNV_PLACE_NAME: "That looks like a place name, not a cadastral reference. Use coordinates or search_address instead.",
  SERVICE_UNAVAILABLE: "The official cadastre for this country is not responding. Try again in a few minutes.",
  INTERNAL_ERROR: "Internal server error. Try again later.",
  MCP_TIMEOUT: "The request timed out. Official cadastres can be slow; try again or raise CATASTROGPS_TIMEOUT.",
  MCP_NETWORK: "Could not reach the CatastroGPS API. Check your connection or CATASTROGPS_API_URL.",
};

const BALANCE_EMPTY_MESSAGE =
  `Monthly quota used up and prepaid balance empty: top up at ${TOP_UP_URL} (or upgrade at ${PRICING_URL}).`;

function balanceExhausted(error: CatastroGPSApiError): boolean {
  return error.quota?.overage?.enabled === true || /prepaid balance/i.test(error.message);
}

function friendlyMessageForError(error: CatastroGPSApiError): string | undefined {
  if (error.code === "KEY_AUTH_004" && balanceExhausted(error)) return BALANCE_EMPTY_MESSAGE;
  const base = friendlyMessageFor(error.code, error.status);
  if (base && error.retryAfterSeconds !== undefined && error.status === 429 && error.code !== "KEY_AUTH_004") {
    return `${base} Wait ${error.retryAfterSeconds} seconds before the next call.`;
  }
  return base;
}

export function friendlyMessageFor(code: string, status: number): string | undefined {
  const byCode = FRIENDLY_MESSAGES[code];
  if (byCode) return byCode;
  if (status === 401 || status === 403) return FRIENDLY_MESSAGES.UNAUTHORIZED;
  if (status === 429) return FRIENDLY_MESSAGES.RATE_LIMIT_EXCEEDED;
  if (status >= 500) return "The CatastroGPS API is having trouble right now. Try again in a few minutes; failed calls are not charged.";
  return undefined;
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
};

export function quotaSummary(quota: Quota | undefined): Record<string, unknown> | undefined {
  if (!quota) return undefined;
  const summary = compact({
    remaining: quota.remaining,
    limit: quota.limit,
    resets_at: quota.resetsAt,
    plan: quota.plan,
    prepaid_overage: quota.overage?.enabled,
    prepaid_balance_eur: quota.overage?.balanceEur,
    overage_units_left: quota.overage?.unitsLeft,
    per_minute_remaining: quota.perMinute?.remaining,
    finca_cap: quota.fincaCap?.cap,
    finca_cap_used: quota.fincaCap?.used,
  });
  return Object.keys(summary).length > 0 ? summary : undefined;
}

export function jsonResult(value: unknown, quota?: Quota): ToolResult {
  const summary = quotaSummary(quota);
  const payload = summary && value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>), quota: summary }
    : value;
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function errorResult(code: string, message: string, details?: unknown): ToolResult & { isError: true } {
  const text = details === undefined
    ? `${code}: ${message}`
    : `${code}: ${message}\n${JSON.stringify(details, null, 2)}`;
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function handleToolError(error: unknown): ToolResult & { isError: true } {
  if (error instanceof CatastroGPSApiError) {
    log(`API error: ${error.code} (${error.status})`);
    const friendly = friendlyMessageForError(error);
    const base = friendly ? `${friendly} (${error.message})` : error.message;
    const message = error.resetsAt ? `${base} Quota resets at ${error.resetsAt}.` : base;
    return errorResult(error.code, message, error.details);
  }

  log(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  return errorResult("MCP_999", "An unexpected error occurred. Please try again.");
}

export function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<T>;
}

const REFERENCE_ONLY_SITE_COUNTRIES: readonly string[] = ["ES", "PV", "NA", "PT", "FR", "IT", "DE"];

export type SitePoint = { lat: number; lng: number };

export function sitePoint(
  country: string | undefined,
  latitude: number | undefined,
  longitude: number | undefined,
): { point?: SitePoint; error?: ToolResult & { isError: true } } {
  if ((latitude === undefined) !== (longitude === undefined)) {
    return { error: errorResult("MCP_003", "Pass both 'latitude' and 'longitude', or neither.") };
  }
  if (latitude !== undefined && longitude !== undefined) {
    return { point: { lat: latitude, lng: longitude } };
  }
  if (country && !REFERENCE_ONLY_SITE_COUNTRIES.includes(country)) {
    return {
      error: errorResult(
        "MCP_004",
        `Outside ES, PV, NA, PT, FR, IT and DE the API needs the parcel point: pass 'latitude' and 'longitude' ` +
          `(the latitude and longitude that get_parcel returns for this reference in ${country}).`,
      ),
    };
  }
  return {};
}
