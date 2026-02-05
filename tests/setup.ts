// Testing Strategy Design Document: tests/setup.ts
// Global test setup file - Initializes chrome API mocks and test environment
// Generated: 2026-02-05

import { beforeEach, vi } from 'vitest';

// Manual chrome API mock for testing
// Since vitest-chrome has CommonJS/ESM compatibility issues, we'll create a simple mock
const createChromeMock = () => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
});

// AC-1: Test Framework Setup
// Make chrome API globally available for all tests
global.chrome = createChromeMock() as any;

// Reset all chrome API mocks before each test to ensure test independence
beforeEach(() => {
  global.chrome = createChromeMock() as any;
});
