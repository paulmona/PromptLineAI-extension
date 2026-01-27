import { Event } from "./types";
import { getDeviceId, getQueue, popBatch, setQueue } from "./storage";
import { sendEvents, SendResult } from "./sender";
import { getConfig, getPollingInterval, getPolicyConfig, setPolicyConfig } from "./config-storage";
import { fetchPolicyConfig } from "./policy-fetcher";
import { FLUSH_INTERVAL_MS, BATCH_SIZE, MAX_QUEUE_SIZE, DRY_RUN } from "./config";
import { logger } from "./lib/logger";

const LAST_INGEST_STATUS_KEY = "last_ingest_status";

interface LastIngestStatus {
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * Store last ingest status for popup display
 */
async function storeIngestStatus(result: SendResult): Promise<void> {
  const status: LastIngestStatus = {
    success: result.success,
    error: result.error,
    timestamp: Date.now(),
  };
  await chrome.storage.local.set({ [LAST_INGEST_STATUS_KEY]: status });
}

let flushLock = false;
let policyPollingInterval: number | null = null;

// Handle incoming messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "event") {
    handleEvent(message.event as Event)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        logger.error("background", "Failed to handle event:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Keep channel open for async response
  }
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
    // Check for ingest key before attempting flush
    const config = await getConfig();
    if (!config.ingestKey) {
      logger.warn("background", "Ingest key not configured, skipping flush");
      await storeIngestStatus({
        success: false,
        error: "Missing ingest key. Configure in Options.",
      });
      return;
    }

    const queue = await getQueue();
    if (queue.length === 0) {
      logger.log("background", "Queue empty, nothing to flush");
      return;
    }

    const batch = await popBatch(Math.min(BATCH_SIZE, queue.length));
    if (batch.length === 0) {
      return;
    }

    const deviceId = await getDeviceId();
    const payload = {
      device_id: deviceId,
      device_name: config.deviceName || "unassigned",
      events: batch,
    };

    const result = await sendEvents(payload);

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
      // Handle different error types
      if (result.statusCode === 409) {
        // Device org mismatch - permanent error, don't retry
        logger.error(
          "background",
          "Device org mismatch (409), not re-queuing events. User must resolve org conflict."
        );
        // Don't re-queue - events are lost (user needs to fix org assignment)
      } else if (result.statusCode === 401) {
        // Invalid key - don't retry until user fixes config
        logger.error("background", "Invalid ingest key (401), not re-queuing until config is fixed");
        // Don't re-queue - user must fix config
      } else {
        // Other errors - re-queue for retry
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
  logger.log("background", "Fetching policy configuration");
  const policy = await fetchPolicyConfig();

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
