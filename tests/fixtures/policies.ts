// Testing Strategy Design Document: tests/fixtures/policies.ts
// Mock policy configuration fixtures for testing
// Generated: 2026-02-05

import type { PolicyConfig } from '../../src/types';

/**
 * Creates a mock policy with all tools enabled
 * Used in: Integration tests, Unit tests (policy-fetcher, config-storage)
 */
export function createMockPolicyAllEnabled(): PolicyConfig {
  return {
    enabled_tools: ['chatgpt', 'gemini', 'claude', 'copilot'],
    log_file_names: true,
    max_queue_size: 100,
    flush_interval_ms: 30000,
    last_updated: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
}

/**
 * Creates a mock policy with specific tools disabled
 * Used in: Integration tests (policy enforcement)
 */
export function createMockPolicyWithDisabledTool(disabledTool: string): PolicyConfig {
  return {
    enabled_tools: ['chatgpt', 'gemini', 'claude', 'copilot'].filter(tool => tool !== disabledTool),
    log_file_names: true,
    max_queue_size: 100,
    flush_interval_ms: 30000,
    last_updated: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
}

/**
 * Creates a mock policy with file name logging disabled
 * Used in: Adapter tests (policy-based file name logging)
 */
export function createMockPolicyNoFileNames(): PolicyConfig {
  return {
    enabled_tools: ['chatgpt', 'gemini', 'claude', 'copilot'],
    log_file_names: false,
    max_queue_size: 100,
    flush_interval_ms: 30000,
    last_updated: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
}

/**
 * Creates a mock policy with custom queue settings
 * Used in: Integration tests (queue management)
 */
export function createMockPolicyCustomQueue(maxSize: number, flushInterval: number): PolicyConfig {
  return {
    enabled_tools: ['chatgpt', 'gemini', 'claude', 'copilot'],
    log_file_names: true,
    max_queue_size: maxSize,
    flush_interval_ms: flushInterval,
    last_updated: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
}
