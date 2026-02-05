// Testing Strategy Design Document: tests/fixtures/events.ts
// Mock event data fixtures for testing
// Generated: 2026-02-05

import type { AIToolEvent } from '../../src/types';

/**
 * Creates a mock visit event
 * Used in: Integration tests, E2E tests
 */
export function createMockVisitEvent(overrides?: Partial<AIToolEvent>): AIToolEvent {
  return {
    event_id: 'test-event-001',
    device_id: 'test-device-001',
    session_id: 'test-session-001',
    timestamp: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    event_type: 'page_visit',
    tool_name: 'chatgpt',
    url: 'https://chat.openai.com',
    ...overrides,
  };
}

/**
 * Creates a mock prompt_submit event
 * Used in: Adapter tests, Integration tests, E2E tests
 */
export function createMockPromptSubmitEvent(overrides?: Partial<AIToolEvent>): AIToolEvent {
  return {
    event_id: 'test-event-002',
    device_id: 'test-device-001',
    session_id: 'test-session-001',
    timestamp: new Date('2026-01-01T00:01:00.000Z').toISOString(),
    event_type: 'prompt_submit',
    tool_name: 'chatgpt',
    url: 'https://chat.openai.com',
    metadata: {
      prompt_length: 150,
      has_code_block: false,
      is_paste: false,
    },
    ...overrides,
  };
}

/**
 * Creates a mock file_selected event
 * Used in: Adapter tests, Integration tests, E2E tests
 */
export function createMockFileSelectedEvent(overrides?: Partial<AIToolEvent>): AIToolEvent {
  return {
    event_id: 'test-event-003',
    device_id: 'test-device-001',
    session_id: 'test-session-001',
    timestamp: new Date('2026-01-01T00:02:00.000Z').toISOString(),
    event_type: 'file_selected',
    tool_name: 'chatgpt',
    url: 'https://chat.openai.com',
    metadata: {
      file_name: 'test-document.pdf',
    },
    ...overrides,
  };
}

/**
 * Creates an array of mock events for queue testing
 * Used in: Integration tests (queue management)
 */
export function createMockEventBatch(count: number): AIToolEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    event_id: `test-event-${String(i).padStart(3, '0')}`,
    device_id: 'test-device-001',
    session_id: 'test-session-001',
    timestamp: new Date(`2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`).toISOString(),
    event_type: 'prompt_submit' as const,
    tool_name: 'chatgpt' as const,
    url: 'https://chat.openai.com',
  }));
}
