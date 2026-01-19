import { QueuePayload } from "./types";
import { DRY_RUN } from "./config";
import { getConfig } from "./config-storage";
import { logger } from "./lib/logger";

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
}

export async function sendEvents(payload: QueuePayload, retryCount = 0): Promise<SendResult> {
  if (DRY_RUN) {
    logger.log("sender", "DRY_RUN: Would send payload:", payload);
    // In DRY_RUN mode, we treat this as success
    // Background script will handle keeping events in queue
    return { success: true };
  }

  // Load config from storage
  const config = await getConfig();

  // Check for ingest key
  if (!config.ingestKey) {
    logger.warn("sender", "Ingest key not configured, skipping send");
    return {
      success: false,
      error: "Missing ingest key. Configure in Options.",
    };
  }

  // Build URL
  const baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
  const url = `${baseUrl}/ingest`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-INGEST-KEY": config.ingestKey,
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
      // Handle specific error codes
      if (response.status === 401) {
        logger.error("sender", "Invalid or revoked ingest key (401)");
        return {
          success: false,
          error: "Invalid or revoked ingest key.",
          statusCode: 401,
        };
      } else if (response.status === 409) {
        logger.error("sender", "Device org mismatch (409)");
        return {
          success: false,
          error: "Device is already registered to a different org.",
          statusCode: 409,
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
          return sendEvents(payload, retryCount + 1);
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
