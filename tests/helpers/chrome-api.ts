// Testing Strategy Design Document: tests/helpers/chrome-api.ts
// Chrome API test helper functions
// Generated: 2026-02-05

import chrome from 'vitest-chrome';

/**
 * Setup chrome.storage.local mock with initial data
 * Used in: Unit tests (storage, config-storage), Integration tests
 */
export function mockChromeStorage(initialData: Record<string, any> = {}): void {
  chrome.storage.local.get.mockImplementation((keys: string | string[] | null) => {
    if (keys === null) {
      return Promise.resolve(initialData);
    }
    if (typeof keys === 'string') {
      return Promise.resolve({ [keys]: initialData[keys] });
    }
    const result: Record<string, any> = {};
    keys.forEach(key => {
      if (key in initialData) {
        result[key] = initialData[key];
      }
    });
    return Promise.resolve(result);
  });

  chrome.storage.local.set.mockImplementation((items: Record<string, any>) => {
    Object.assign(initialData, items);
    return Promise.resolve();
  });

  chrome.storage.local.remove.mockImplementation((keys: string | string[]) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach(key => delete initialData[key]);
    return Promise.resolve();
  });
}

/**
 * Setup chrome.runtime.sendMessage mock
 * Used in: Integration tests (message passing)
 */
export function mockChromeMessagePassing(responseData: any = { success: true }): void {
  chrome.runtime.sendMessage.mockResolvedValue(responseData);
}

/**
 * Setup chrome.runtime.onMessage listener mock
 * Used in: Integration tests (background script message handling)
 */
export function mockChromeMessageListener(handler: (message: any, sender: any, sendResponse: any) => void): void {
  chrome.runtime.onMessage.addListener.mockImplementation((callback: any) => {
    // Store the callback for manual triggering in tests
    (global as any).__chromeMessageCallback = callback;
  });
}

/**
 * Trigger a chrome.runtime.onMessage event
 * Used in: Integration tests (simulating message events)
 */
export function triggerChromeMessage(message: any, sender: any = {}, sendResponse: any = vi.fn()): void {
  const callback = (global as any).__chromeMessageCallback;
  if (callback) {
    callback(message, sender, sendResponse);
  }
}

/**
 * Setup chrome.alarms API mock
 * Used in: Integration tests (timer-based operations)
 */
export function mockChromeAlarms(): void {
  const alarms: Map<string, any> = new Map();

  chrome.alarms.create.mockImplementation((name: string, alarmInfo: any) => {
    alarms.set(name, alarmInfo);
  });

  chrome.alarms.get.mockImplementation((name: string) => {
    return Promise.resolve(alarms.get(name));
  });

  chrome.alarms.clear.mockImplementation((name: string) => {
    const existed = alarms.has(name);
    alarms.delete(name);
    return Promise.resolve(existed);
  });

  chrome.alarms.onAlarm.addListener.mockImplementation((callback: any) => {
    (global as any).__chromeAlarmCallback = callback;
  });
}

/**
 * Trigger a chrome.alarms.onAlarm event
 * Used in: Integration tests (simulating alarm events)
 */
export function triggerChromeAlarm(alarmName: string): void {
  const callback = (global as any).__chromeAlarmCallback;
  if (callback) {
    callback({ name: alarmName });
  }
}

/**
 * Reset all chrome API mocks and global state
 * Used in: Test teardown
 */
export function resetChromeAPIMocks(): void {
  chrome.reset();
  delete (global as any).__chromeMessageCallback;
  delete (global as any).__chromeAlarmCallback;
}
