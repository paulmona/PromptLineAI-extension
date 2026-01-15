import { Event, Tool } from "./types";
import { generateUUID } from "./lib/uuid";
import { logger } from "./lib/logger";
import { initChatGPT } from "./adapters/chatgpt";

// Determine tool based on hostname
function getTool(hostname: string): Tool {
  if (hostname.includes("chat.openai.com") || hostname.includes("chatgpt.com")) {
    return "chatgpt";
  }
  return "unknown";
}

// Create and send event
function createEvent(
  eventType: "visit" | "prompt_submit" | "file_selected",
  metadata?: { file_ext?: string; file_size_kb?: number }
): void {
  const tool = getTool(window.location.hostname);
  if (tool === "unknown") {
    logger.warn("content", "Unknown tool for hostname:", window.location.hostname);
    return;
  }

  const event: Event = {
    id: generateUUID(),
    ts: new Date().toISOString(),
    tool,
    event_type: eventType,
    url_host: window.location.hostname,
    file_ext: metadata?.file_ext || null,
    file_size_kb: metadata?.file_size_kb || null,
  };

  logger.log("content", "Sending event:", event);
  // Access chrome API - use window.chrome to ensure it's available after bundling
  const chromeApi = (window as any).chrome || (globalThis as any).chrome;
  if (!chromeApi || !chromeApi.runtime) {
    logger.error("content", "Chrome runtime API not available");
    return;
  }
  chromeApi.runtime.sendMessage({ type: "event", event }).catch((err) => {
    logger.error("content", "Failed to send event:", err);
  });
}

// Initialize content script
function init(): void {
  logger.log("content", "Content script initialized for", window.location.hostname);

  // Emit visit event once per page load
  createEvent("visit");

  // Initialize adapter based on tool
  const tool = getTool(window.location.hostname);
  if (tool === "chatgpt") {
    initChatGPT((eventType, metadata) => {
      createEvent(eventType, metadata);
    });
  } else {
    logger.warn("content", "No adapter for tool:", tool);
  }
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
