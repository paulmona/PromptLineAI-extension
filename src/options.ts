import { getConfig, setConfig, clearConfig, getPollingInterval, setPollingInterval } from "./config-storage";

// DOM elements
const form = document.getElementById("config-form") as HTMLFormElement;
const baseUrlInput = document.getElementById("base-url") as HTMLInputElement;
const ingestKeyInput = document.getElementById("ingest-key") as HTMLInputElement;
const deviceNameInput = document.getElementById("device-name") as HTMLInputElement;
const pollingIntervalInput = document.getElementById("polling-interval") as HTMLInputElement;
const saveButton = form?.querySelector('button[type="submit"]') as HTMLButtonElement;
const clearButton = document.getElementById("clear-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const backLink = document.getElementById("back-link") as HTMLAnchorElement;

/**
 * Show status message
 */
function showStatus(message: string, isError = false): void {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status ${isError ? "error" : "success"} show`;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusEl.classList.remove("show");
  }, 5000);
}

/**
 * Load current config and populate form
 */
async function loadConfig(): Promise<void> {
  try {
    const config = await getConfig();
    if (baseUrlInput) {
      baseUrlInput.value = config.baseUrl;
    }
    if (ingestKeyInput) {
      // Don't populate password field for security (user must re-enter)
      ingestKeyInput.value = "";
    }
    if (deviceNameInput) {
      deviceNameInput.value = config.deviceName || "";
    }
    if (pollingIntervalInput) {
      // Load polling interval and convert from ms to seconds
      const intervalMs = await getPollingInterval();
      pollingIntervalInput.value = (intervalMs / 1000).toString();
    }
  } catch (error) {
    console.error("Failed to load config:", error);
    showStatus("Failed to load current configuration", true);
  }
}

/**
 * Validate and save configuration
 */
async function saveConfig(event: Event): Promise<void> {
  event.preventDefault();

  if (!form || !baseUrlInput || !ingestKeyInput) {
    showStatus("Form elements not found", true);
    return;
  }

  const baseUrl = baseUrlInput.value.trim();
  const ingestKey = ingestKeyInput.value.trim();
  const deviceName = deviceNameInput ? deviceNameInput.value.trim() : undefined;
  
  // Get polling interval, defaulting to 60 if empty or invalid
  let pollingIntervalSeconds = 60;
  if (pollingIntervalInput) {
    const parsed = parseInt(pollingIntervalInput.value.trim(), 10);
    if (!isNaN(parsed)) {
      pollingIntervalSeconds = parsed;
    }
  }

  // Validate inputs
  if (!baseUrl) {
    showStatus("Backend URL is required", true);
    return;
  }

  if (!ingestKey) {
    showStatus("Ingest key is required", true);
    return;
  }

  // Validate polling interval
  if (pollingIntervalSeconds < 10 || pollingIntervalSeconds > 3600) {
    showStatus("Polling interval must be between 10 and 3600 seconds", true);
    return;
  }

  // Validate URL format
  try {
    const url = new URL(baseUrl);
    // Ensure it's http or https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must use http or https protocol");
    }
  } catch (error) {
    showStatus("Invalid URL format. Please enter a valid URL (e.g., http://127.0.0.1:8787)", true);
    return;
  }

  // Disable save button during save
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }

  try {
    await setConfig(baseUrl, ingestKey, deviceName);
    // Save polling interval (convert seconds to milliseconds)
    await setPollingInterval(pollingIntervalSeconds * 1000);
    showStatus("Configuration saved successfully!");
    
    // Clear password field after successful save (security)
    ingestKeyInput.value = "";
  } catch (error) {
    console.error("Failed to save config:", error);
    showStatus(
      error instanceof Error ? error.message : "Failed to save configuration",
      true
    );
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    }
  }
}

/**
 * Clear configuration
 */
async function handleClear(): Promise<void> {
  if (!confirm("Are you sure you want to clear the configuration?")) {
    return;
  }

  try {
    await clearConfig();
    if (baseUrlInput) baseUrlInput.value = "";
    if (ingestKeyInput) ingestKeyInput.value = "";
    if (deviceNameInput) deviceNameInput.value = "";
    if (pollingIntervalInput) pollingIntervalInput.value = "60";
    showStatus("Configuration cleared");
  } catch (error) {
    console.error("Failed to clear config:", error);
    showStatus("Failed to clear configuration", true);
  }
}

/**
 * Handle back link
 */
function handleBackLink(event: Event): void {
  event.preventDefault();
  // Close options page
  window.close();
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();

  if (form) {
    form.addEventListener("submit", saveConfig);
  }

  if (clearButton) {
    clearButton.addEventListener("click", handleClear);
  }

  if (backLink) {
    backLink.addEventListener("click", handleBackLink);
  }
});
