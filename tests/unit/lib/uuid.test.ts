// Testing Strategy Design Document: tests/unit/lib/uuid.test.ts
// Unit tests for UUID generation utility
// Generated: 2026-02-05 | Target Coverage: 100%

import { describe, it, expect, vi } from 'vitest';
import { generateUUID } from '../../../src/lib/uuid';

describe('UUID Generation (lib/uuid.ts)', () => {
  // AC-2: Unit Tests - Core Utilities
  // Behavior: generateUUID() → Generate unique identifier → Returns valid UUID v4 format
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should generate a valid UUID v4 format string', () => {
    // Arrange: (no setup needed)

    // Act: Generate UUID
    const uuid = generateUUID();

    // Assert: Verify UUID v4 format (8-4-4-4-12 hex characters)
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: generateUUID() called multiple times → Generate unique values → Returns different UUIDs
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should generate unique UUIDs on multiple calls', () => {
    // Arrange: Generate multiple UUIDs
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    const uuid3 = generateUUID();

    // Act: (UUIDs already generated)

    // Assert: All UUIDs should be unique
    expect(uuid1).not.toBe(uuid2);
    expect(uuid2).not.toBe(uuid3);
    expect(uuid1).not.toBe(uuid3);
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: generateUUID() → Generate UUID → Returns string type
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should return a string type', () => {
    // Arrange & Act: Generate UUID
    const uuid = generateUUID();

    // Assert: Verify type is string
    expect(typeof uuid).toBe('string');
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: generateUUID() → Generate UUID → Returns non-empty string
  // @category: core-functionality
  // @dependency: none
  // @complexity: low
  it('should return a non-empty string', () => {
    // Arrange & Act: Generate UUID
    const uuid = generateUUID();

    // Assert: Verify string is not empty
    expect(uuid.length).toBeGreaterThan(0);
    expect(uuid).not.toBe('');
  });

  // AC-2: Unit Tests - Core Utilities
  // Behavior: generateUUID() when crypto.randomUUID unavailable → Use fallback → Returns valid UUID
  // @category: edge-cases
  // @dependency: none
  // @complexity: low
  it('should use fallback when crypto.randomUUID is unavailable', () => {
    // Arrange: Mock crypto to not have randomUUID
    const mockCrypto = {
      ...crypto,
      randomUUID: undefined as any,
    };
    vi.stubGlobal('crypto', mockCrypto);

    // Act: Generate UUID using fallback
    const uuid = generateUUID();

    // Assert: Verify it still generates valid UUID v4 format
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(uuid.length).toBe(36);

    // Cleanup: Restore original crypto
    vi.unstubAllGlobals();
  });
});
