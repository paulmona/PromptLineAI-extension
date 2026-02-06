// Testing Strategy Design Document: tests/fixtures/policies.ts
// Mock policy configuration fixtures for testing
// Updated: 2026-02-05

import type { PolicyConfig } from '../../src/types';

/**
 * Creates a mock policy with all tools enabled
 * Used in: Integration tests, Unit tests (policy-fetcher, config-storage)
 */
export function createMockPolicyAllEnabled(): PolicyConfig {
  return {
    llms: {
      chatgpt: true,
      gemini: true,
    },
    fileUpload: {
      logFileNames: true,
    },
  };
}

/**
 * Creates a mock policy with specific tool disabled
 * Used in: Integration tests (policy enforcement)
 */
export function createMockPolicyWithDisabledTool(disabledTool: 'chatgpt' | 'gemini'): PolicyConfig {
  return {
    llms: {
      chatgpt: disabledTool !== 'chatgpt',
      gemini: disabledTool !== 'gemini',
    },
    fileUpload: {
      logFileNames: true,
    },
  };
}

/**
 * Creates a mock policy with file name logging disabled
 * Used in: Adapter tests (policy-based file name logging)
 */
export function createMockPolicyNoFileNames(): PolicyConfig {
  return {
    llms: {
      chatgpt: true,
      gemini: true,
    },
    fileUpload: {
      logFileNames: false,
    },
  };
}

/**
 * Creates a mock policy with all tools disabled
 * Used in: Integration tests (policy enforcement)
 */
export function createMockPolicyAllDisabled(): PolicyConfig {
  return {
    llms: {
      chatgpt: false,
      gemini: false,
    },
    fileUpload: {
      logFileNames: false,
    },
  };
}
