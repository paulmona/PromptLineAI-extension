import { QueuePayload } from "./types";
import { DRY_RUN } from "./config";
import { getConfig } from "./config-storage";
import { logger } from "./lib/logger";

function getErrorMessageForCode(code: string): string {
  switch (code) {
    case "ORG_REQUIRED":
      return "You must be in an organization. Contact your admin.";
    case "LICENSE_REQUIRED":
      return "Your account is not licensed. Contact your admin.";
    case "MEMBERSHIP_REQUIRED":
      return "Your membership was revoked. Contact your admin.";
    case "DEVICE_ORG_MISMATCH":
      return "Device is already registered to another org.";
    case "EXTENSION_NOT_ALLOWED_FOR_PLATFORM_ADMIN":
      return "This extension cannot be used with the Platform Admin organization. Sign in with a customer org or use a different account.";
    default:
      return "Not authorized.";
  }
}

const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

/**
 * Send events to backend with retry logic for rate limiting
 * Returns { success: boolean, error?: string } for detailed error reporting
 */
export interface SendResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  /** Machine-readable code from backend (e.g. ORG_REQUIRED, LICENSE_REQUIRED, DEVICE_ORG_MISMATCH) */
  errorCode?: string;
  timestamp?: number;
}

export async function sendEvents(
  payload: QueuePayload,
  bearerToken: string | null,
  retryCount = 0
): Promise<SendResult> {
  if (DRY_RUN) {
    logger.log("sender", "DRY_RUN: Would send payload:", payload);
    return { success: true };
  }

  if (!bearerToken) {
    return {
      success: false,
      error: "Not signed in. Sign in to send events.",
    };
  }

  const config = await getConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/ingest`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let body: { code?: string; error?: string; message?: string } = {};
      try {
        body = (await response.json()) as typeof body;
      } catch {
        // ignore
      }
      const errorCode = body?.code;

      if (response.status === 401) {
        logger.error("sender", "Unauthorized (401)");
        return {
          success: false,
          error: "Session expired or invalid. Sign in again.",
          statusCode: 401,
        };
      } else if (response.status === 403) {
        logger.error("sender", "Forbidden (403)", errorCode ?? "");
        return {
          success: false,
          error: errorCode ? getErrorMessageForCode(errorCode) : "Not authorized.",
          statusCode: 403,
          errorCode: errorCode ?? undefined,
        };
      } else if (response.status === 409) {
        logger.error("sender", "Device org mismatch (409)");
        return {
          success: false,
          error: "Device is already registered to another org.",
          statusCode: 409,
          errorCode: errorCode ?? "DEVICE_ORG_MISMATCH",
        };
      } else if (response.status === 413) {
        logger.error("sender", "Payload too large (413)");
        return {
          success: false,
          error: "Payload too large.",
          statusCode: 413,
        };
      } else if (response.status === 429) {
        // Rate limited - implement exponential backoff
        const backoffMs = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, retryCount),
          MAX_BACKOFF_MS
        );
        const retryAfter = response.headers.get("Retry-After");

        if (retryCount < MAX_RETRIES) {
          logger.warn(
            "sender",
            `Rate limited (429), retrying after ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return sendEvents(payload, bearerToken, retryCount + 1);
        } else {
          logger.warn("sender", "Rate limited (429), max retries exceeded");
          return {
            success: false,
            error: "Rate limited. Retrying later.",
            statusCode: 429,
          };
        }
      } else {
        logger.error(
          "sender",
          "Backend returned error:",
          response.status,
          response.statusText
        );
        return {
          success: false,
          error: `Server error: ${response.status}`,
          statusCode: response.status,
        };
      }
    }

    logger.log("sender", "Successfully sent batch of", payload.events.length, "events");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("sender", "Request timeout after", TIMEOUT_MS, "ms");
      return {
        success: false,
        error: "Request timeout",
      };
    } else {
      logger.error("sender", "Failed to send events:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
