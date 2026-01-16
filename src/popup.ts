import { getDeviceId, getRecentEvents } from "./storage";

async function render(): Promise<void> {
  const deviceIdEl = document.getElementById("device-id");
  const eventsEl = document.getElementById("events");

  if (!deviceIdEl || !eventsEl) {
    console.error("Required DOM elements not found");
    return;
  }

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
        // For file_selected events, show file name prominently
        if (event.event_type === "file_selected") {
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
document.addEventListener("DOMContentLoaded", render);
