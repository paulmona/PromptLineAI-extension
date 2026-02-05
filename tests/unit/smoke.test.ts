// Smoke test to verify test infrastructure is working
import { describe, it, expect } from 'vitest';

describe('Test Infrastructure Smoke Test', () => {
  it('should run vitest successfully', () => {
    expect(true).toBe(true);
  });

  it('should have chrome API mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.storage).toBeDefined();
    expect(chrome.runtime).toBeDefined();
  });

  it('should have access to global test utilities', () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
