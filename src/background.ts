import { Event } from "./types";
import { getDeviceId, getQueue, popBatch, setQueue } from "./storage";
import { sendEvents, SendResult } from "./sender";
import { getConfig, getPollingInterval, getPolicyConfig, setPolicyConfig } from "./config-storage";
import { fetchPolicyConfig } from "./policy-fetcher";
import { getClerkToken, getAuthStateForDisplay, clerkSignOut } from "./clerk-auth";
import { FLUSH_INTERVAL_MS, BATCH_SIZE, MAX_QUEUE_SIZE, DRY_RUN } from "./config";
import { logger } from "./lib/logger";

const LAST_INGEST_STATUS_KEY = "last_ingest_status";

interface LastIngestStatus {
  success: boolean;
  error?: string;
  errorCode?: string;
  timestamp: number;
}

/**
 * Store last ingest status for popup display
 */
async function storeIngestStatus(result: SendResult): Promise<void> {
  const status: LastIngestStatus = {
    success: result.success,
    error: result.error,
    errorCode: result.errorCode,
    timestamp: Date.now(),
  };
  await chrome.storage.local.set({ [LAST_INGEST_STATUS_KEY]: status });
}

let flushLock = false;
let policyPollingInterval: number | null = null;

// Message API: allowlist by type. Only handle known types. Never return tokens.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "event") {
    handleEvent(message.event as Event)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        logger.error("background", "Failed to handle event:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true;
  }
  if (message.type === "getAuthState") {
    getAuthStateForDisplay()
      .then((state) => sendResponse(state))
      .catch((err) => {
        logger.error("background", "getAuthState failed:", err);
        sendResponse({ signedIn: false });
      });
    return true;
  }
  if (message.type === "signOut") {
    clerkSignOut()
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        logger.error("background", "signOut failed:", err);
        sendResponse({ success: false });
      });
    return true;
  }
  // Ignore unknown message types; do not reply with auth state or tokens
  return false;
});

// Handle incoming event
async function handleEvent(event: Event): Promise<void> {
  logger.log("background", "Received event:", event.event_type);

  // Ensure device_id exists
  await getDeviceId();

  // Get current queue
  const queue = await getQueue();

  // Check queue size limit
  if (queue.length >= MAX_QUEUE_SIZE) {
    logger.warn("background", "Queue full, dropping oldest event");
    queue.shift();
  }

  // Append new event
  queue.push(event);
  await setQueue(queue);

  logger.log("background", "Queue size:", queue.length);
}

// Flush events to backend
async function flushEvents(): Promise<void> {
  if (flushLock) {
    logger.log("background", "Flush already in progress, skipping");
    return;
  }

  flushLock = true;
  try {
    // Get token per request, retry once on failure
    let token = await getClerkToken(true);
    if (!token) {
      logger.warn("background", "No token, skipping flush (auth attention needed)");
      await storeIngestStatus({
        success: false,
        error: "Not signed in. Sign in to send events.",
        timestamp: Date.now(),
      });
      flushLock = false;
      return;
    }

    const config = await getConfig();
    const queue = await getQueue();
    if (queue.length === 0) {
      logger.log("background", "Queue empty, nothing to flush");
      flushLock = false;
      return;
    }

    const batch = await popBatch(Math.min(BATCH_SIZE, queue.length));
    if (batch.length === 0) {
      flushLock = false;
      return;
    }

    const deviceId = await getDeviceId();
    const payload = {
      device_id: deviceId,
      device_name: config.deviceName || "unassigned",
      events: batch,
    };

    const result = await sendEvents(payload, token);

    // Store status for popup display
    await storeIngestStatus(result);

    if (result.success) {
      logger.log("background", "Successfully flushed", batch.length, "events");
      // In DRY_RUN mode, keep events in queue so popup can display them
      if (DRY_RUN) {
        // Put events back in queue for DRY_RUN mode
        const currentQueue = await getQueue();
        await setQueue([...batch, ...currentQueue]);
      }
      // If not DRY_RUN, events already popped in popBatch, so we're done
    } else {
      if (result.statusCode === 409 || result.statusCode === 401) {
        logger.error(
          "background",
          result.statusCode === 409 ? "Device org mismatch (409)" : "Unauthorized (401)",
          "not re-queuing"
        );
      } else {
        logger.warn("background", "Flush failed, re-queuing", batch.length, "events");
        const currentQueue = await getQueue();
        await setQueue([...batch, ...currentQueue]);
      }
    }
  } catch (error) {
    logger.error("background", "Error during flush:", error);
    await storeIngestStatus({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    flushLock = false;
  }
}

/**
 * Fetch and cache policy configuration
 */
async function fetchAndCachePolicy(): Promise<void> {
  const token = await getClerkToken(true);
  if (!token) {
    logger.warn("background", "No token, skipping policy fetch");
    return;
  }
  logger.log("background", "Fetching policy configuration");
  const policy = await fetchPolicyConfig(token);

  if (policy) {
    // Get current policy to detect changes
    const currentPolicy = await getPolicyConfig();
    const policyChanged = 
      currentPolicy.llms.chatgpt !== policy.llms.chatgpt ||
      currentPolicy.llms.gemini !== policy.llms.gemini ||
      currentPolicy.fileUpload.logFileNames !== policy.fileUpload.logFileNames;
    
    await setPolicyConfig(policy);  // This now stores timestamp
    logger.log("background", "Policy configuration updated", {
      chatgpt: policy.llms.chatgpt,
      gemini: policy.llms.gemini,
      logFileNames: policy.fileUpload.logFileNames,
      changed: policyChanged,
      fetchedAt: new Date().toISOString(),
    });
  } else {
    logger.warn("background", "Failed to fetch policy, using cached policy");
  }
}

/**
 * Start policy polling with the configured interval
 */
async function startPolicyPolling(): Promise<void> {
  // Clear existing interval if any
  if (policyPollingInterval !== null) {
    clearInterval(policyPollingInterval);
    policyPollingInterval = null;
  }

  const intervalMs = await getPollingInterval();
  logger.log("background", "Policy polling interval:", intervalMs, "ms");

  // Fetch immediately after a short delay
  setTimeout(fetchAndCachePolicy, 2000);

  // Set up periodic polling
  policyPollingInterval = setInterval(fetchAndCachePolicy, intervalMs) as unknown as number;
}

// Listen for polling interval changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    (areaName === "sync" || areaName === "local") &&
    changes["config_polling_interval"]
  ) {
    logger.log("background", "Polling interval changed, restarting policy polling");
    startPolicyPolling();
  }
});

// Start periodic flush
logger.log("background", "Background service worker started");
logger.log("background", "Flush interval:", FLUSH_INTERVAL_MS, "ms");

// Initial flush after a short delay
setTimeout(flushEvents, 2000);

// Periodic flush
setInterval(flushEvents, FLUSH_INTERVAL_MS);

// Start policy polling
startPolicyPolling();
