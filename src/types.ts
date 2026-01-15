export type Tool = "chatgpt" | "claude" | "gemini" | "grok" | "unknown";
export type EventType = "visit" | "prompt_submit" | "file_selected";

export interface Event {
  id: string;
  ts: string; // ISO timestamp
  tool: Tool;
  event_type: EventType;
  url_host: string;
  file_ext?: string | null;
  file_size_kb?: number | null;
}

export interface QueuePayload {
  device_id: string;
  events: Event[];
}
