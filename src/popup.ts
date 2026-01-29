import { getDeviceId, getRecentEvents } from "./storage";
import { getConfig, getPolicyConfig, getPolicyFetchTimestamp } from "./config-storage";

const LAST_INGEST_STATUS_KEY = "last_ingest_status";

interface LastIngestStatus {
  success: boolean;
  error?: string;
  errorCode?: string;
  timestamp: number;
}

interface AuthStateForDisplay {
  signedIn: boolean;
  userDisplay?: string;
  orgDisplay?: string;
  syncHostUrl?: string;
}

/** Path on the sync host that serves the extension sign-in page (backend GET /sync-host). */
const SYNC_HOST_SIGN_IN_PATH = "/sync-host";

/**
 * Derive the URL to open when the user clicks "Open sync host to sign in".
 * Treats syncHostUrl as the backend origin; returns origin + /sync-host so the tab loads the sign-in page.
 */
function getSyncHostSignInUrl(syncHostUrl: string): string {
  try {
    const origin = new URL(syncHostUrl).origin;
    return `${origin.replace(/\/$/, "")}${SYNC_HOST_SIGN_IN_PATH}`;
  } catch {
    return `${syncHostUrl.replace(/\/$/, "")}${SYNC_HOST_SIGN_IN_PATH}`;
  }
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
 * User-facing message for backend error codes
 */
function getGuidanceForErrorCode(code: string): string {
  switch (code) {
    case "ORG_REQUIRED":
      return "You must be in an organization. Contact your admin.";
    case "LICENSE_REQUIRED":
      return "Your account is not licensed. Contact your admin.";
    case "MEMBERSHIP_REQUIRED":
      return "Your membership was revoked. Contact your admin.";
    case "DEVICE_ORG_MISMATCH":
      return "Device already used in another org.";
    default:
      return "";
  }
}

/**
 * Load and display auth state (getAuthState from background; never receives tokens)
 */
async function renderAuth(): Promise<void> {
  const authStateEl = document.getElementById("auth-state");
  const authActionsEl = document.getElementById("auth-actions");
  if (!authStateEl || !authActionsEl) return;

  try {
    const state = (await chrome.runtime.sendMessage({ type: "getAuthState" })) as AuthStateForDisplay | undefined;
    if (!state) {
      authStateEl.textContent = "Not signed in";
      authStateEl.className = "status-value";
      authActionsEl.innerHTML = "";
      return;
    }

    if (state.signedIn) {
      const display = state.orgDisplay
        ? `${state.userDisplay ?? "User"} (${state.orgDisplay})`
        : (state.userDisplay ?? "User");
      authStateEl.textContent = display;
      authStateEl.className = "status-value success";
      authActionsEl.className = "";
      authActionsEl.innerHTML = '<button type="button" class="auth-link secondary" id="sign-out-btn">Sign out</button>';
      const signOutBtn = document.getElementById("sign-out-btn");
      if (signOutBtn) {
        signOutBtn.addEventListener("click", async () => {
          await chrome.runtime.sendMessage({ type: "signOut" });
          await renderAuth();
        });
      }
    } else {
      authStateEl.textContent = "Not signed in";
      authStateEl.className = "status-value";
      authActionsEl.className = "";
      if (state.syncHostUrl) {
        authActionsEl.innerHTML = '<a href="#" class="auth-link" id="open-sync-host-link">Open sync host to sign in</a>';
        const link = document.getElementById("open-sync-host-link");
        if (link) {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            const openUrl = getSyncHostSignInUrl(state.syncHostUrl!);
            chrome.tabs.create({ url: openUrl });
          });
        }
      } else {
        authActionsEl.innerHTML = "";
        authActionsEl.textContent = "Configure CLERK_SYNC_HOST and rebuild the extension to get a sign-in link.";
        authActionsEl.className = "status-value warning";
      }
    }
  } catch (err) {
    console.error("Failed to get auth state:", err);
    authStateEl.textContent = "Not signed in";
    authStateEl.className = "status-value";
    authActionsEl.innerHTML = "";
    authActionsEl.className = "";
  }
}

/**
 * Load and display status
 */
async function renderStatus(): Promise<void> {
  await renderAuth();

  const backendUrlEl = document.getElementById("backend-url");
  const lastIngestStatusEl = document.getElementById("last-ingest-status");
  const lastPolicyFetchEl = document.getElementById("last-policy-fetch");
  const policyConfigEl = document.getElementById("policy-config");

  try {
    const config = await getConfig();

    if (backendUrlEl) {
      backendUrlEl.textContent = truncateUrl(config.baseUrl);
    }

    // Load last ingest status (optionally surface errorCode as guidance)
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
        const guidance = lastStatus.errorCode ? getGuidanceForErrorCode(lastStatus.errorCode) : null;
        const errorMsg = guidance || lastStatus.error || "Unknown error";
        lastIngestStatusEl.textContent = `Error: ${errorMsg}`;
        lastIngestStatusEl.className = "status-value error";
      }
    }

    // Load policy configuration
    const policy = await getPolicyConfig();
    const policyFetchTimestamp = await getPolicyFetchTimestamp();
    
    // Display last policy fetch
    if (lastPolicyFetchEl) {
      if (policyFetchTimestamp) {
        lastPolicyFetchEl.textContent = formatTimestamp(policyFetchTimestamp);
        lastPolicyFetchEl.className = "status-value success";
      } else {
        lastPolicyFetchEl.textContent = "Never";
        lastPolicyFetchEl.className = "status-value warning";
      }
    }
    
    // Display current policy configuration
    if (policyConfigEl) {
      const configParts = [
        `chatgpt: ${policy.llms.chatgpt}`,
        `gemini: ${policy.llms.gemini}`,
        `logFileNames: ${policy.fileUpload.logFileNames}`,
      ];
      policyConfigEl.textContent = configParts.join(", ");
      policyConfigEl.className = "status-value";
    }
  } catch (error) {
    console.error("Failed to load status:", error);
    if (backendUrlEl) backendUrlEl.textContent = "Error loading";
    if (lastPolicyFetchEl) lastPolicyFetchEl.textContent = "Error loading";
    if (policyConfigEl) policyConfigEl.textContent = "Error loading";
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

  setupOptionsLink();

  // Render auth state and status (auth first so "Open sync host" / Sign out appear)
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
