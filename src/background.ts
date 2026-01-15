import { Event } from "./types";
import { getDeviceId, getQueue, popBatch, setQueue } from "./storage";
import { sendEvents } from "./sender";
import { FLUSH_INTERVAL_MS, BATCH_SIZE, MAX_QUEUE_SIZE, DRY_RUN } from "./config";
import { logger } from "./lib/logger";

let flushLock = false;

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
      events: batch,
    };

    const success = await sendEvents(payload);

    if (success) {
      logger.log("background", "Successfully flushed", batch.length, "events");
      // In DRY_RUN mode, keep events in queue so popup can display them
      if (DRY_RUN) {
        // Put events back in queue for DRY_RUN mode
        const currentQueue = await getQueue();
        await setQueue([...batch, ...currentQueue]);
      }
      // If not DRY_RUN, events already popped in popBatch, so we're done
    } else {
      // On failure, put events back at the front of the queue
      logger.warn("background", "Flush failed, re-queuing", batch.length, "events");
      const currentQueue = await getQueue();
      await setQueue([...batch, ...currentQueue]);
    }
  } catch (error) {
    logger.error("background", "Error during flush:", error);
  } finally {
    flushLock = false;
  }
}

// Start periodic flush
logger.log("background", "Background service worker started");
logger.log("background", "Flush interval:", FLUSH_INTERVAL_MS, "ms");

// Initial flush after a short delay
setTimeout(flushEvents, 2000);

// Periodic flush
setInterval(flushEvents, FLUSH_INTERVAL_MS);
