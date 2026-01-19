import { getDeviceId, getRecentEvents } from "./storage";
import { getConfig } from "./config-storage";

const LAST_INGEST_STATUS_KEY = "last_ingest_status";

interface LastIngestStatus {
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * Truncate URL for display
 */
function truncateUrl(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + "...";
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

/**
 * Load and display status
 */
async function renderStatus(): Promise<void> {
  const backendUrlEl = document.getElementById("backend-url");
  const ingestKeyStatusEl = document.getElementById("ingest-key-status");
  const lastIngestStatusEl = document.getElementById("last-ingest-status");

  try {
    // Load config
    const config = await getConfig();
    
    if (backendUrlEl) {
      backendUrlEl.textContent = truncateUrl(config.baseUrl);
    }

    if (ingestKeyStatusEl) {
      if (config.ingestKey) {
        ingestKeyStatusEl.textContent = "✓ Configured";
        ingestKeyStatusEl.className = "status-value success";
      } else {
        ingestKeyStatusEl.textContent = "✗ Not configured";
        ingestKeyStatusEl.className = "status-value error";
      }
    }

    // Load last ingest status
    if (lastIngestStatusEl) {
      const result = await chrome.storage.local.get(LAST_INGEST_STATUS_KEY);
      const lastStatus = result[LAST_INGEST_STATUS_KEY] as LastIngestStatus | undefined;

      if (!lastStatus) {
        lastIngestStatusEl.textContent = "Never sent";
        lastIngestStatusEl.className = "status-value";
      } else if (lastStatus.success) {
        lastIngestStatusEl.textContent = `Success (${formatTimestamp(lastStatus.timestamp)})`;
        lastIngestStatusEl.className = "status-value success";
      } else {
        const errorMsg = lastStatus.error || "Unknown error";
        lastIngestStatusEl.textContent = `Error: ${errorMsg}`;
        lastIngestStatusEl.className = "status-value error";
      }
    }
  } catch (error) {
    console.error("Failed to load status:", error);
    if (backendUrlEl) backendUrlEl.textContent = "Error loading";
    if (ingestKeyStatusEl) ingestKeyStatusEl.textContent = "Error loading";
  }
}

/**
 * Handle options link click
 */
function setupOptionsLink(): void {
  const optionsLink = document.getElementById("options-link");
  if (optionsLink) {
    optionsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}

async function render(): Promise<void> {
  const deviceIdEl = document.getElementById("device-id");
  const eventsEl = document.getElementById("events");

  if (!deviceIdEl || !eventsEl) {
    console.error("Required DOM elements not found");
    return;
  }

  // Setup options link
  setupOptionsLink();

  // Render status
  await renderStatus();

  try {
    const deviceId = await getDeviceId();
    deviceIdEl.textContent = deviceId;

    const events = await getRecentEvents(20);
    if (events.length === 0) {
      eventsEl.innerHTML = '<div class="empty">No events yet</div>';
      return;
    }

    eventsEl.innerHTML = events
      .map((event) => {
        const date = new Date(event.ts);
        const timeStr = date.toLocaleString();
        const details: string[] = [];
        details.push(`Tool: ${event.tool}`);
        details.push(`Host: ${event.url_host}`);
        
        // For prompt_submit events, show prompt metadata
        if (event.event_type === "prompt_submit") {
          // Explicit check to ensure all bucket values including "1000+" are displayed
          if (event.prompt_len_bucket != null && event.prompt_len_bucket !== "") {
            details.push(`Prompt size: ${event.prompt_len_bucket}`);
          }
          if (event.has_code_block === true) {
            details.push(`Code block: Yes`);
          }
          if (event.paste_detected === true) {
            details.push(`Paste detected: Yes`);
          }
        }
        // For file_selected events, show file name prominently
        else if (event.event_type === "file_selected") {
          if (event.file_name) {
            details.push(`File: ${event.file_name}`);
          } else if (event.file_ext) {
            details.push(`File: .${event.file_ext}`);
          }
          if (event.file_size_kb !== null && event.file_size_kb !== undefined) {
            details.push(`Size: ${event.file_size_kb} KB`);
          }
        } else {
          // For other events, show file info if present (shouldn't happen, but keep for consistency)
          if (event.file_ext) {
            details.push(`File: .${event.file_ext}`);
          }
          if (event.file_size_kb !== null && event.file_size_kb !== undefined) {
            details.push(`Size: ${event.file_size_kb} KB`);
          }
        }

        return `
          <div class="event">
            <div class="event-header">
              <span class="event-type">${event.event_type}</span>
              <span class="event-time">${timeStr}</span>
            </div>
            <div class="event-details">${details.join(" • ")}</div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Failed to render popup:", error);
    eventsEl.innerHTML = '<div class="empty">Error loading events</div>';
  }
}

// Render on load
document.addEventListener("DOMContentLoaded", () => {
  render();
  // Refresh status every 5 seconds
  setInterval(renderStatus, 5000);
});
