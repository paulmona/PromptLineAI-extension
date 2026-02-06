// Testing Strategy Design Document: tests/fixtures/events.ts
// Mock event data fixtures for testing
// Updated: 2026-02-05

import type { Event } from '../../src/types';

/**
 * Creates a mock visit event
 * Used in: Integration tests, E2E tests, Storage tests
 */
export function createMockVisitEvent(overrides?: Partial<Event>): Event {
  return {
    id: 'test-event-001',
    ts: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    tool: 'chatgpt',
    event_type: 'visit',
    url_host: 'chat.openai.com',
    file_ext: null,
    file_size_kb: null,
    file_name: null,
    prompt_len_bucket: null,
    has_code_block: null,
    paste_detected: null,
    ...overrides,
  };
}

/**
 * Creates a mock prompt_submit event
 * Used in: Adapter tests, Integration tests, E2E tests
 */
export function createMockPromptSubmitEvent(overrides?: Partial<Event>): Event {
  return {
    id: 'test-event-002',
    ts: new Date('2026-01-01T00:01:00.000Z').toISOString(),
    tool: 'chatgpt',
    event_type: 'prompt_submit',
    url_host: 'chat.openai.com',
    file_ext: null,
    file_size_kb: null,
    file_name: null,
    prompt_len_bucket: '200-1000',
    has_code_block: false,
    paste_detected: false,
    ...overrides,
  };
}

/**
 * Creates a mock file_selected event
 * Used in: Adapter tests, Integration tests, E2E tests
 */
export function createMockFileSelectedEvent(overrides?: Partial<Event>): Event {
  return {
    id: 'test-event-003',
    ts: new Date('2026-01-01T00:02:00.000Z').toISOString(),
    tool: 'chatgpt',
    event_type: 'file_selected',
    url_host: 'chat.openai.com',
    file_ext: 'pdf',
    file_size_kb: 1024,
    file_name: 'test-document.pdf',
    prompt_len_bucket: null,
    has_code_block: null,
    paste_detected: null,
    ...overrides,
  };
}

/**
 * Creates an array of mock events for queue testing
 * Used in: Integration tests (queue management), Storage tests
 */
export function createMockEventBatch(count: number): Event[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-event-${String(i).padStart(3, '0')}`,
    ts: new Date(`2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`).toISOString(),
    tool: 'chatgpt' as const,
    event_type: 'prompt_submit' as const,
    url_host: 'chat.openai.com',
    file_ext: null,
    file_size_kb: null,
    file_name: null,
    prompt_len_bucket: '200-1000',
    has_code_block: false,
    paste_detected: false,
  }));
}
