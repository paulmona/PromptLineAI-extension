import { QueuePayload } from "./types";
import { BACKEND_URL, POC_TOKEN, DRY_RUN } from "./config";
import { logger } from "./lib/logger";

const TIMEOUT_MS = 5000;

/**
 * Send events to backend
 * Returns true on success, false on failure
 */
export async function sendEvents(payload: QueuePayload): Promise<boolean> {
  if (DRY_RUN) {
    logger.log("sender", "DRY_RUN: Would send payload:", payload);
    // In DRY_RUN mode, we treat this as success
    // Background script will handle keeping events in queue
    return true;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (POC_TOKEN) {
      headers["X-POC-TOKEN"] = POC_TOKEN;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error("sender", "Backend returned error:", response.status, response.statusText);
      return false;
    }

    logger.log("sender", "Successfully sent batch of", payload.events.length, "events");
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("sender", "Request timeout after", TIMEOUT_MS, "ms");
    } else {
      logger.error("sender", "Failed to send events:", error);
    }
    return false;
  }
}
