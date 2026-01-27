import { logger } from "./lib/logger";
import { PolicyConfig } from "./types";
import { DEFAULT_POLLING_INTERVAL_MS } from "./config";

const CONFIG_BASE_URL_KEY = "config_base_url";
const CONFIG_INGEST_KEY_KEY = "config_ingest_key";
const CONFIG_DEVICE_NAME_KEY = "config_device_name";
const CONFIG_POLICY_KEY = "config_policy";
const CONFIG_POLICY_FETCH_TIMESTAMP_KEY = "config_policy_fetch_timestamp";
const CONFIG_POLLING_INTERVAL_KEY = "config_polling_interval";
const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

const DEFAULT_POLICY: PolicyConfig = {
  llms: { chatgpt: true, gemini: true },
  fileUpload: { logFileNames: true },
};

export interface Config {
  baseUrl: string;
  ingestKey: string | null;
  deviceName: string | null;
}

// In-memory cache
let cachedConfig: Config | null = null;
let cacheValid = false;

/**
 * Redact ingest key for logging (never log the actual key)
 */
function redactKey(key: string | null): string {
  if (!key) return "(not set)";
  if (key.length <= 8) return "***";
  return `${key.substring(0, 4)}***${key.substring(key.length - 4)}`;
}

/**
 * Get storage API (prefer sync, fallback to local)
 */
function getStorage(): typeof chrome.storage.sync {
  // Check if sync is available (may not be in some contexts)
  try {
    if (chrome.storage?.sync) {
      return chrome.storage.sync;
    }
  } catch {
    // Sync not available, fallback to local
  }
  return chrome.storage.local;
}

/**
 * Get configuration from storage (with caching)
 */
export async function getConfig(): Promise<Config> {
  // Return cached config if valid
  if (cacheValid && cachedConfig) {
    return cachedConfig;
  }

  const storage = getStorage();
  const result = await storage.get([CONFIG_BASE_URL_KEY, CONFIG_INGEST_KEY_KEY, CONFIG_DEVICE_NAME_KEY]);

  const baseUrl = (result[CONFIG_BASE_URL_KEY] as string) || DEFAULT_BASE_URL;
  const ingestKey = (result[CONFIG_INGEST_KEY_KEY] as string) || null;
  const deviceName = (result[CONFIG_DEVICE_NAME_KEY] as string) || null;

  cachedConfig = { baseUrl, ingestKey, deviceName };
  cacheValid = true;

  logger.log(
    "config-storage",
    "Loaded config:",
    `baseUrl=${baseUrl}`,
    `ingestKey=${redactKey(ingestKey)}`
  );

  return cachedConfig;
}

/**
 * Set configuration in storage
 */
export async function setConfig(baseUrl: string, ingestKey: string, deviceName?: string): Promise<void> {
  // Validate inputs
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("Base URL must be a non-empty string");
  }
  if (!ingestKey || typeof ingestKey !== "string") {
    throw new Error("Ingest key must be a non-empty string");
  }

  // Basic URL validation
  try {
    new URL(baseUrl);
  } catch {
    throw new Error("Invalid base URL format");
  }

  const storage = getStorage();
  await storage.set({
    [CONFIG_BASE_URL_KEY]: baseUrl,
    [CONFIG_INGEST_KEY_KEY]: ingestKey,
    [CONFIG_DEVICE_NAME_KEY]: deviceName || null,
  });

  // Invalidate cache
  cacheValid = false;
  cachedConfig = null;

  // Clear stale "missing ingest key" error status if it exists
  // This prevents showing old errors after the key has been configured
  try {
    const lastIngestStatus = await chrome.storage.local.get("last_ingest_status");
    if (lastIngestStatus.last_ingest_status) {
      const status = lastIngestStatus.last_ingest_status as { success: boolean; error?: string };
      if (!status.success && status.error && status.error.includes("Missing ingest key")) {
        await chrome.storage.local.remove("last_ingest_status");
        logger.log("config-storage", "Cleared stale 'missing ingest key' error status");
      }
    }
  } catch (error) {
    // Non-critical - if we can't clear the status, that's okay
    logger.log("config-storage", "Could not clear stale status (non-critical):", error);
  }

  logger.log(
    "config-storage",
    "Saved config:",
    `baseUrl=${baseUrl}`,
    `ingestKey=${redactKey(ingestKey)}`
  );
}

/**
 * Clear configuration from storage
 */
export async function clearConfig(): Promise<void> {
  const storage = getStorage();
  await storage.remove([CONFIG_BASE_URL_KEY, CONFIG_INGEST_KEY_KEY, CONFIG_DEVICE_NAME_KEY]);

  // Invalidate cache
  cacheValid = false;
  cachedConfig = null;

  logger.log("config-storage", "Cleared config");
}

/**
 * Get cached policy configuration
 */
export async function getPolicyConfig(): Promise<PolicyConfig> {
  const storage = getStorage();
  const result = await storage.get([CONFIG_POLICY_KEY]);

  if (result[CONFIG_POLICY_KEY]) {
    const policy = result[CONFIG_POLICY_KEY] as PolicyConfig;
    logger.log("config-storage", "Retrieved cached policy:", policy);
    return policy;
  }

  // Return default policy if no cache exists
  logger.warn("config-storage", "No cached policy found, using default (all enabled)");
  return DEFAULT_POLICY;
}

/**
 * Store policy configuration
 */
export async function setPolicyConfig(policy: PolicyConfig): Promise<void> {
  const storage = getStorage();
  const timestamp = Date.now();
  
  await storage.set({
    [CONFIG_POLICY_KEY]: policy,
    [CONFIG_POLICY_FETCH_TIMESTAMP_KEY]: timestamp,
  });

  logger.log("config-storage", "Policy config cached:", {
    chatgpt: policy.llms.chatgpt,
    gemini: policy.llms.gemini,
    logFileNames: policy.fileUpload.logFileNames,
    fetchedAt: new Date(timestamp).toISOString(),
  });
}

/**
 * Get policy fetch timestamp
 */
export async function getPolicyFetchTimestamp(): Promise<number | null> {
  const storage = getStorage();
  const result = await storage.get([CONFIG_POLICY_FETCH_TIMESTAMP_KEY]);
  return (result[CONFIG_POLICY_FETCH_TIMESTAMP_KEY] as number) || null;
}

/**
 * Get polling interval in milliseconds
 */
export async function getPollingInterval(): Promise<number> {
  const storage = getStorage();
  const result = await storage.get([CONFIG_POLLING_INTERVAL_KEY]);

  if (result[CONFIG_POLLING_INTERVAL_KEY] !== undefined) {
    const interval = result[CONFIG_POLLING_INTERVAL_KEY] as number;
    // Ensure it's a valid number and within reasonable bounds
    if (typeof interval === "number" && interval >= 10000 && interval <= 3600000) {
      return interval;
    }
  }

  return DEFAULT_POLLING_INTERVAL_MS;
}

/**
 * Set polling interval in milliseconds
 */
export async function setPollingInterval(ms: number): Promise<void> {
  // Validate bounds
  if (typeof ms !== "number" || ms < 10000 || ms > 3600000) {
    throw new Error("Polling interval must be between 10000 and 3600000 milliseconds");
  }

  const storage = getStorage();
  await storage.set({
    [CONFIG_POLLING_INTERVAL_KEY]: ms,
  });

  logger.log("config-storage", `Polling interval set to ${ms}ms`);
}

// Listen for storage changes to invalidate cache
chrome.storage.onChanged.addListener((changes, areaName) => {
  // Only invalidate if our keys changed
  if (
    areaName === "sync" ||
    areaName === "local" ||
    changes[CONFIG_BASE_URL_KEY] ||
    changes[CONFIG_INGEST_KEY_KEY] ||
    changes[CONFIG_DEVICE_NAME_KEY]
  ) {
    cacheValid = false;
    cachedConfig = null;
    logger.log("config-storage", "Cache invalidated due to storage change");
  }
});
