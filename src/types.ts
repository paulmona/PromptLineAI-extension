export type Tool = "chatgpt" | "claude" | "gemini" | "grok" | "ai.google.dev" | "unknown";
export type EventType = "visit" | "prompt_submit" | "file_selected";

export interface Event {
  id: string;
  ts: string; // ISO timestamp
  tool: Tool;
  event_type: EventType;
  url_host: string;
  file_ext?: string | null;
  file_size_kb?: number | null;
  file_name?: string | null;
  prompt_len_bucket?: string | null; // "0-200", "200-1000", "1000+"
  has_code_block?: boolean | null;
  paste_detected?: boolean | null;
}

export interface QueuePayload {
  device_id: string;
  device_name: string;
  events: Event[];
}
