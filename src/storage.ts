import { Event } from "./types";
import { generateUUID } from "./lib/uuid";
import { logger } from "./lib/logger";

const DEVICE_ID_KEY = "device_id";
const QUEUE_KEY = "event_queue";

/**
 * Get or create device ID
 */
export async function getDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(DEVICE_ID_KEY);
  if (result[DEVICE_ID_KEY]) {
    return result[DEVICE_ID_KEY];
  }
  const deviceId = generateUUID();
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: deviceId });
  logger.log("storage", "Generated new device_id:", deviceId);
  return deviceId;
}

/**
 * Get current event queue
 */
export async function getQueue(): Promise<Event[]> {
  const result = await chrome.storage.local.get(QUEUE_KEY);
  return (result[QUEUE_KEY] as Event[]) || [];
}

/**
 * Append event to queue
 */
export async function appendEvent(event: Event): Promise<void> {
  const queue = await getQueue();
  queue.push(event);
  await setQueue(queue);
}

/**
 * Set entire queue
 */
export async function setQueue(events: Event[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: events });
}

/**
 * Pop up to n events from queue (destructive)
 */
export async function popBatch(n: number): Promise<Event[]> {
  const queue = await getQueue();
  const batch = queue.slice(0, n);
  const remaining = queue.slice(n);
  await setQueue(remaining);
  return batch;
}

/**
 * Get recent n events (non-destructive, sorted by ts descending)
 */
export async function getRecentEvents(n: number): Promise<Event[]> {
  const queue = await getQueue();
  return queue
    .slice()
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, n);
}
