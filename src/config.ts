// Sensitive config (ingest key, backend URL) is stored in chrome.storage
// See src/config-storage.ts for storage-based configuration

export const DRY_RUN = false;
export const FLUSH_INTERVAL_MS = 10000;
export const BATCH_SIZE = 50;
export const MAX_QUEUE_SIZE = 500;
