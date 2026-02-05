// Testing Strategy Design Document: tests/helpers/dom-setup.ts
// DOM environment setup helpers for adapter tests
// Generated: 2026-02-05

import { Window } from 'happy-dom';

/**
 * Setup happy-dom environment for testing
 * Used in: Adapter tests (chatgpt.test.ts, gemini.test.ts)
 */
export function setupHappyDOM(): void {
  const window = new Window();
  global.document = window.document as any;
  global.window = window as any;
  global.HTMLElement = window.HTMLElement as any;
  global.MutationObserver = window.MutationObserver as any;
}

/**
 * Cleanup DOM environment after tests
 * Used in: Test teardown
 */
export function cleanupDOM(): void {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
}

/**
 * Create a mock MutationObserver for testing
 * Used in: Adapter tests (MutationObserver behavior)
 */
export function createMockMutationObserver(): {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
  trigger: (mutations: MutationRecord[]) => void;
} {
  let callback: MutationCallback | null = null;

  const mock = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
    trigger: (mutations: MutationRecord[]) => {
      if (callback) {
        callback(mutations, mock as any);
      }
    },
  };

  // Store callback when MutationObserver is instantiated
  (global as any).MutationObserver = class {
    constructor(cb: MutationCallback) {
      callback = cb;
      return mock;
    }
  };

  return mock;
}

/**
 * Create a mock KeyboardEvent
 * Used in: Adapter tests (Enter key press detection)
 */
export function createMockKeyboardEvent(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

/**
 * Create a mock MouseEvent
 * Used in: Adapter tests (send button click detection)
 */
export function createMockMouseEvent(type: string = 'click'): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Wait for next tick (useful for async DOM operations)
 * Used in: Adapter tests
 */
export function waitForNextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
