// Testing Strategy Design Document: tests/unit/lib/logger.test.ts
// Unit tests for logging utility
// Generated: 2026-02-05 | Target Coverage: 100%

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../../../src/lib/logger';

describe('Logger Utility (lib/logger.ts)', () => {
  beforeEach(() => {
    // Mock console methods to prevent actual logging during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: logger.log() with tag and message → Log to console → Calls console.log with tag prefix
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should log messages with tag prefix', () => {
    // Arrange: Prepare test tag and message
    const tag = 'test-tag';
    const message = 'Test log message';

    // Act: Call logger.log
    logger.log(tag, message);

    // Assert: Verify console.log was called with [tag] prefix and message
    expect(console.log).toHaveBeenCalledWith('[test-tag]', message);
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: logger.warn() with tag and warning → Log to console → Calls console.warn with tag prefix
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should log warnings with tag prefix', () => {
    // Arrange: Prepare test tag and warning
    const tag = 'warning-tag';
    const warning = 'Test warning message';

    // Act: Call logger.warn
    logger.warn(tag, warning);

    // Assert: Verify console.warn was called with [tag] prefix
    expect(console.warn).toHaveBeenCalledWith('[warning-tag]', warning);
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: logger.error() with tag and error → Log to console → Calls console.error with tag prefix
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should log errors with tag prefix', () => {
    // Arrange: Prepare test tag and error
    const tag = 'error-tag';
    const error = 'Test error message';

    // Act: Call logger.error
    logger.error(tag, error);

    // Assert: Verify console.error was called with [tag] prefix
    expect(console.error).toHaveBeenCalledWith('[error-tag]', error);
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: logger methods with multiple arguments → Log to console → Passes all arguments to console
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should handle multiple arguments', () => {
    // Arrange: Prepare tag and multiple arguments
    const tag = 'multi-arg';
    const arg1 = 'First';
    const arg2 = { key: 'value' };
    const arg3 = 123;

    // Act: Call logger.log with multiple arguments
    logger.log(tag, arg1, arg2, arg3);

    // Assert: Verify all arguments were passed to console.log
    expect(console.log).toHaveBeenCalledWith('[multi-arg]', arg1, arg2, arg3);
  });
});
