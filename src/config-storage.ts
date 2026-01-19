import { logger } from "./lib/logger";

const CONFIG_BASE_URL_KEY = "config_base_url";
const CONFIG_INGEST_KEY_KEY = "config_ingest_key";
const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

export interface Config {
  baseUrl: string;
  ingestKey: string | null;
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
  const result = await storage.get([CONFIG_BASE_URL_KEY, CONFIG_INGEST_KEY_KEY]);

  const baseUrl = (result[CONFIG_BASE_URL_KEY] as string) || DEFAULT_BASE_URL;
  const ingestKey = (result[CONFIG_INGEST_KEY_KEY] as string) || null;

  cachedConfig = { baseUrl, ingestKey };
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
export async function setConfig(baseUrl: string, ingestKey: string): Promise<void> {
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
  });

  // Invalidate cache
  cacheValid = false;
  cachedConfig = null;

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
  await storage.remove([CONFIG_BASE_URL_KEY, CONFIG_INGEST_KEY_KEY]);

  // Invalidate cache
  cacheValid = false;
  cachedConfig = null;

  logger.log("config-storage", "Cleared config");
}

// Listen for storage changes to invalidate cache
chrome.storage.onChanged.addListener((changes, areaName) => {
  // Only invalidate if our keys changed
  if (
    areaName === "sync" ||
    areaName === "local" ||
    changes[CONFIG_BASE_URL_KEY] ||
    changes[CONFIG_INGEST_KEY_KEY]
  ) {
    cacheValid = false;
    cachedConfig = null;
    logger.log("config-storage", "Cache invalidated due to storage change");
  }
});
