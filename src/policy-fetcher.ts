import { PolicyConfig } from "./types";
import { getConfig } from "./config-storage";
import { logger } from "./lib/logger";

const TIMEOUT_MS = 5000;

/**
 * Fetch policy configuration from backend.
 * Returns null on failure (no token, network error, 401, 403, 500, etc.)
 */
export async function fetchPolicyConfig(bearerToken: string | null): Promise<PolicyConfig | null> {
  if (!bearerToken) {
    logger.warn("policy-fetcher", "No token, cannot fetch policy");
    return null;
  }

  const config = await getConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/config`;

  logger.log("policy-fetcher", `Fetching policy from GET ${url}`);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        logger.error("policy-fetcher", "Unauthorized (401)");
        return null;
      } else if (response.status === 403) {
        logger.error("policy-fetcher", "Forbidden (403)");
        return null;
      } else if (response.status === 500) {
        logger.error("policy-fetcher", "Server error (500)");
        return null;
      } else {
        logger.error(
          "policy-fetcher",
          "Backend returned error:",
          response.status,
          response.statusText
        );
        return null;
      }
    }

    const policy = (await response.json()) as PolicyConfig;

    // Validate policy structure
    if (
      !policy ||
      typeof policy !== "object" ||
      !policy.llms ||
      typeof policy.llms.chatgpt !== "boolean" ||
      typeof policy.llms.gemini !== "boolean" ||
      !policy.fileUpload ||
      typeof policy.fileUpload.logFileNames !== "boolean"
    ) {
      logger.error("policy-fetcher", "Invalid policy structure received");
      return null;
    }

    logger.log("policy-fetcher", `Successfully fetched policy config from GET ${url}`, {
      chatgpt: policy.llms.chatgpt,
      gemini: policy.llms.gemini,
      logFileNames: policy.fileUpload.logFileNames,
    });
    return policy;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("policy-fetcher", "Request timeout after", TIMEOUT_MS, "ms");
      return null;
    } else {
      logger.error("policy-fetcher", "Failed to fetch policy:", error);
      return null;
    }
  }
}
