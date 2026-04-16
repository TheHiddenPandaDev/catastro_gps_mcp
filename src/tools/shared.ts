import { CatastroGPSApiError } from "../client/catastrogps-api.js";

const log = (msg: string) => console.error(`[catastrogps-mcp] ${msg}`);

export function handleToolError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  if (error instanceof CatastroGPSApiError) {
    log(`API error: ${error.code} — ${error.message} (${error.status})`);

    // Map backend error codes to user-friendly messages
    const messages: Record<string, string> = {
      DAILY_LIMIT_REACHED: "Daily search limit reached. Upgrade your plan at https://catastrogps.es/precios",
      KEY_AUTH_001: "Invalid API key format.",
      KEY_AUTH_002: "Invalid API key. Check your CATASTROGPS_API_KEY.",
      KEY_AUTH_003: "Invalid API key. Check your CATASTROGPS_API_KEY.",
      KEY_AUTH_004: "Monthly quota exceeded. Upgrade at https://catastrogps.es/developers",
      KEY_AUTH_005: "Error verifying API key organization.",
      UNAUTHORIZED: "Invalid or missing API key. Get one at https://catastrogps.es/developers",
      NOT_FOUND: "Parcel not found. Check the reference code and country.",
      VALIDATION_ERROR: "Invalid input. Check the reference format for this country.",
      SERVICE_UNAVAILABLE: "The cadastral service for this country is temporarily unavailable. Try again in a few minutes.",
      FORBIDDEN: "Access denied. This feature may require a paid plan.",
      INTERNAL_ERROR: "Internal server error. Try again later.",
    };

    const friendlyMessage = messages[error.code] || error.message;

    return {
      content: [{ type: "text" as const, text: `${error.code}: ${friendlyMessage}` }],
      isError: true,
    };
  }

  log(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  return {
    content: [
      { type: "text" as const, text: "MCP_999: An unexpected error occurred. Please try again." },
    ],
    isError: true,
  };
}
