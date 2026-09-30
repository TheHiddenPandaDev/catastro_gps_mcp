import { CatastroGPSApiError } from "../client/catastrogps-api.js";

const log = (msg: string) => console.error(`[catastro-gps-mcp] ${msg}`);

const PRICING_URL = "https://www.parcelgps.com/developers";

const FRIENDLY_MESSAGES: Record<string, string> = {
  KEY_AUTH_001: "Invalid API key format. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_002: "Unknown API key. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_003: "Invalid API key. Check CATASTROGPS_API_KEY.",
  KEY_AUTH_004: `Monthly quota exhausted. Upgrade at ${PRICING_URL}`,
  KEY_AUTH_005: "The API could not verify your organization. Try again later.",
  KEY_RATE_001: "Too many requests. Slow down and retry.",
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

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
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
    const friendly = friendlyMessageFor(error.code, error.status);
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
