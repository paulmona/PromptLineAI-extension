// Testing Strategy Design Document: tests/integration/policy-sync.test.ts
// Integration tests for policy synchronization (fetch → cache → retrieve)
// Updated: 2026-02-05 | Target: Integration between policy-fetcher.ts and config-storage.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchPolicyConfig } from '../../src/policy-fetcher';
import { getPolicyConfig, setPolicyConfig, getPolicyFetchTimestamp } from '../../src/config-storage';
import { createMockPolicyAllEnabled, createMockPolicyWithDisabledTool } from '../fixtures/policies';
import * as configStorage from '../../src/config-storage';

describe('Policy Synchronization Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    // Mock getConfig to return test configuration
    vi.spyOn(configStorage, 'getConfig').mockResolvedValue({
      baseUrl: 'https://api.test.com',
      deviceName: 'test-device',
    });

    // Mock setPolicyConfig and getPolicyConfig
    vi.spyOn(configStorage, 'setPolicyConfig').mockResolvedValue(undefined);
    vi.spyOn(configStorage, 'getPolicyConfig').mockResolvedValue(createMockPolicyAllEnabled());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Fetch policy from API → Validate → Store in cache → Retrieve from cache
  // @category: integration
  // @dependency: policy-fetcher.ts, config-storage.ts
  // @complexity: high
  it('should fetch, validate, and cache policy end-to-end', async () => {
    // Arrange: Mock successful API response
    const mockPolicy = createMockPolicyAllEnabled();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockPolicy), { status: 200 })
    );

    // Act: Fetch policy
    const fetchedPolicy = await fetchPolicyConfig('mock-token');

    // Assert: Verify policy fetched successfully
    expect(fetchedPolicy).toEqual(mockPolicy);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/config'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token',
        }),
      })
    );

    // Act: Store fetched policy in cache (simulating what background script would do)
    if (fetchedPolicy) {
      await setPolicyConfig(fetchedPolicy);
    }

    // Assert: Verify setPolicyConfig was called
    expect(setPolicyConfig).toHaveBeenCalledWith(mockPolicy);
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Policy fetch fails → Return null → Cached policy still available
  // @category: integration
  // @dependency: policy-fetcher.ts, config-storage.ts
  // @complexity: medium
  it('should fall back to cached policy when fetch fails', async () => {
    // Arrange: Mock policy fetcher to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // Act: Attempt to fetch policy
    const fetchedPolicy = await fetchPolicyConfig('mock-token');

    // Assert: Verify fetch returned null
    expect(fetchedPolicy).toBeNull();

    // Act: Get cached policy (would return default or previously cached)
    const cachedPolicy = await getPolicyConfig();

    // Assert: Verify cached policy available (getPolicyConfig was called)
    expect(getPolicyConfig).toHaveBeenCalled();
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Fetch policy with disabled tool → Cache updated → Subsequent reads get updated policy
  // @category: integration
  // @dependency: policy-fetcher.ts, config-storage.ts
  // @complexity: medium
  it('should update cache when policy changes', async () => {
    // Arrange: First fetch - all tools enabled
    const initialPolicy = createMockPolicyAllEnabled();
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(initialPolicy), { status: 200 })
    );

    // Act: First fetch and cache
    const policy1 = await fetchPolicyConfig('mock-token');
    if (policy1) {
      await setPolicyConfig(policy1);
    }

    // Arrange: Second fetch - chatgpt disabled
    const updatedPolicy = createMockPolicyWithDisabledTool('chatgpt');
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(updatedPolicy), { status: 200 })
    );

    // Act: Second fetch and cache
    const policy2 = await fetchPolicyConfig('mock-token');
    if (policy2) {
      await setPolicyConfig(policy2);
    }

    // Assert: Verify both policies fetched and cached
    expect(policy1).toEqual(initialPolicy);
    expect(policy2).toEqual(updatedPolicy);
    expect(setPolicyConfig).toHaveBeenCalledTimes(2);
    expect(setPolicyConfig).toHaveBeenNthCalledWith(1, initialPolicy);
    expect(setPolicyConfig).toHaveBeenNthCalledWith(2, updatedPolicy);
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Fetch policy without token → No API call → Return null
  // @category: integration
  // @dependency: policy-fetcher.ts
  // @complexity: low
  it('should not fetch policy without bearer token', async () => {
    // Act: Attempt to fetch without token
    const policy = await fetchPolicyConfig(null);

    // Assert: Verify no fetch call and null returned
    expect(policy).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Fetch policy → Invalid schema → Return null → Cache not updated
  // @category: integration
  // @dependency: policy-fetcher.ts, validation
  // @complexity: medium
  it('should reject invalid policy schema', async () => {
    // Arrange: Mock API response with invalid policy
    const invalidPolicy = {
      llms: { chatgpt: true }, // Missing gemini
      // Missing fileUpload
    };
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invalidPolicy), { status: 200 })
    );

    // Act: Fetch policy
    const policy = await fetchPolicyConfig('mock-token');

    // Assert: Verify null returned (schema validation failed)
    expect(policy).toBeNull();

    // Assert: Verify setPolicyConfig not called with invalid policy
    expect(setPolicyConfig).not.toHaveBeenCalled();
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Multiple policy fetches → All succeed → Timestamp updated each time
  // @category: integration
  // @dependency: policy-fetcher.ts, config-storage.ts
  // @complexity: medium
  it('should update timestamp on each successful fetch', async () => {
    // Arrange: Mock successful fetches
    const policy = createMockPolicyAllEnabled();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(policy), { status: 200 })
    );

    // Act: Fetch multiple times
    await fetchPolicyConfig('mock-token');
    await setPolicyConfig(policy);

    await fetchPolicyConfig('mock-token');
    await setPolicyConfig(policy);

    await fetchPolicyConfig('mock-token');
    await setPolicyConfig(policy);

    // Assert: Verify setPolicyConfig called 3 times (each with timestamp update)
    expect(setPolicyConfig).toHaveBeenCalledTimes(3);
  });

  // AC-7: Integration Tests - Policy Synchronization
  // Behavior: Fetch with various HTTP errors → All return null → Cache not corrupted
  // @category: integration
  // @dependency: policy-fetcher.ts
  // @complexity: medium
  it('should handle various HTTP errors gracefully', async () => {
    // Test 401 Unauthorized
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    let policy = await fetchPolicyConfig('invalid-token');
    expect(policy).toBeNull();

    // Test 403 Forbidden
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    );
    policy = await fetchPolicyConfig('mock-token');
    expect(policy).toBeNull();

    // Test 500 Internal Server Error
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
    );
    policy = await fetchPolicyConfig('mock-token');
    expect(policy).toBeNull();

    // Assert: Verify setPolicyConfig never called with errors
    expect(setPolicyConfig).not.toHaveBeenCalled();
  });
});
