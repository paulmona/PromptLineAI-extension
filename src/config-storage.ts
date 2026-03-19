import { logger } from "./lib/logger";
import { PolicyConfig } from "./types";
import { DEFAULT_POLLING_INTERVAL_MS } from "./config";

const CONFIG_BASE_URL_KEY = "config_base_url";
const CONFIG_DEVICE_NAME_KEY = "config_device_name";
const CONFIG_POLICY_KEY = "config_policy";
const CONFIG_POLICY_FETCH_TIMESTAMP_KEY = "config_policy_fetch_timestamp";
const CONFIG_POLLING_INTERVAL_KEY = "config_polling_interval";
const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

const DEFAULT_POLICY: PolicyConfig = {
  llms: { chatgpt: true, gemini: true },
  fileUpload: { logFileNames: true },
};

// Track if we've already logged the policy cache warning
let policyCacheWarningLogged = false;

export interface Config {
  baseUrl: string;
  deviceName: string | null;
}

// In-memory cache
let cachedConfig: Config | null = null;
let cacheValid = false;

/**
 * Get storage API (prefer sync, fallback to local)
 */
function getStorage(): chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea {
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
  const result = await storage.get([CONFIG_BASE_URL_KEY, CONFIG_DEVICE_NAME_KEY]);

  const baseUrl = (result[CONFIG_BASE_URL_KEY] as string) || DEFAULT_BASE_URL;
  const deviceName = (result[CONFIG_DEVICE_NAME_KEY] as string) || null;

  cachedConfig = { baseUrl, deviceName };
  cacheValid = true;

  logger.log("config-storage", "Loaded config:", `baseUrl=${baseUrl}`);

  return cachedConfig;
}

/**
 * Set configuration in storage
 */
export async function setConfig(baseUrl: string, deviceName?: string): Promise<void> {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("Base URL must be a non-empty string");
  }
  try {
    new URL(baseUrl);
  } catch {
    throw new Error("Invalid base URL format");
  }

  const storage = getStorage();
  await storage.set({
    [CONFIG_BASE_URL_KEY]: baseUrl,
    [CONFIG_DEVICE_NAME_KEY]: deviceName || null,
  });

  cacheValid = false;
  cachedConfig = null;
  logger.log("config-storage", "Saved config:", `baseUrl=${baseUrl}`);
}

/**
 * Clear configuration from storage
 */
export async function clearConfig(): Promise<void> {
  const storage = getStorage();
  await storage.remove([CONFIG_BASE_URL_KEY, CONFIG_DEVICE_NAME_KEY]);

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
  if (!policyCacheWarningLogged) {
    logger.log("config-storage", "No cached policy found, using default (all enabled)");
    policyCacheWarningLogged = true;
  }
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
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "sync" ||
      areaName === "local" ||
      changes[CONFIG_BASE_URL_KEY] ||
      changes[CONFIG_DEVICE_NAME_KEY]
    ) {
      cacheValid = false;
      cachedConfig = null;
      logger.log("config-storage", "Cache invalidated due to storage change");
    }
  });
}
