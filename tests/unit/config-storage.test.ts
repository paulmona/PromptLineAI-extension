// Testing Strategy Design Document: tests/unit/config-storage.test.ts
// Unit tests for configuration storage
// Updated: 2026-02-05 | Target Coverage: 90%+

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getConfig,
  setConfig,
  clearConfig,
  getPolicyConfig,
  setPolicyConfig,
  getPolicyFetchTimestamp,
  getPollingInterval,
  setPollingInterval,
} from '../../src/config-storage';

describe('Configuration Storage (config-storage.ts)', () => {
  beforeEach(async () => {
    // Reset chrome storage mocks
    vi.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);
    chrome.storage.local.remove.mockResolvedValue(undefined);
    chrome.storage.sync.get.mockResolvedValue({});
    chrome.storage.sync.set.mockResolvedValue(undefined);
    chrome.storage.sync.remove.mockResolvedValue(undefined);

    // Clear the in-memory cache by calling clearConfig
    // This invalidates cacheValid and cachedConfig module-level variables
    await clearConfig();
    vi.clearAllMocks(); // Clear the mocks again after clearConfig call
  });

  describe('getConfig', () => {
    it('should return default config when storage is empty', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({});
      const config = await getConfig();
      expect(config.baseUrl).toBe('http://127.0.0.1:8787');
      expect(config.deviceName).toBeNull();
    });

    it('should return stored config from storage', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        config_base_url: 'https://api.example.com',
        config_device_name: 'Test Device',
      });
      const config = await getConfig();
      expect(config.baseUrl).toBe('https://api.example.com');
      expect(config.deviceName).toBe('Test Device');
    });
  });

  describe('setConfig', () => {
    it('should store config in chrome.storage', async () => {
      const baseUrl = 'https://api.example.com';
      const deviceName = 'My Device';
      await setConfig(baseUrl, deviceName);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        config_base_url: baseUrl,
        config_device_name: deviceName,
      });
    });

    it('should throw error for invalid URL format', async () => {
      await expect(setConfig('not-a-valid-url')).rejects.toThrow('Invalid base URL format');
    });

    it('should throw error for empty base URL', async () => {
      await expect(setConfig('')).rejects.toThrow('Base URL must be a non-empty string');
    });
  });

  describe('clearConfig', () => {
    it('should remove config from storage', async () => {
      await clearConfig();
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith([
        'config_base_url',
        'config_device_name',
      ]);
    });
  });

  describe('getPolicyConfig', () => {
    it('should return cached policy from storage', async () => {
      const cachedPolicy = {
        llms: { chatgpt: false, gemini: true },
        fileUpload: { logFileNames: false },
      };
      chrome.storage.sync.get.mockResolvedValueOnce({
        config_policy: cachedPolicy,
      });
      const policy = await getPolicyConfig();
      expect(policy).toEqual(cachedPolicy);
    });

    it('should return default policy when no cache exists', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({});
      const policy = await getPolicyConfig();
      expect(policy.llms.chatgpt).toBe(true);
      expect(policy.llms.gemini).toBe(true);
      expect(policy.fileUpload.logFileNames).toBe(true);
    });
  });

  describe('setPolicyConfig', () => {
    it('should store policy with timestamp in chrome.storage', async () => {
      const policy = {
        llms: { chatgpt: true, gemini: false },
        fileUpload: { logFileNames: true },
      };
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      await setPolicyConfig(policy);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        config_policy: policy,
        config_policy_fetch_timestamp: mockTimestamp,
      });
      vi.restoreAllMocks();
    });
  });

  describe('getPolicyFetchTimestamp', () => {
    it('should return stored timestamp', async () => {
      const timestamp = 1234567890;
      chrome.storage.sync.get.mockResolvedValueOnce({
        config_policy_fetch_timestamp: timestamp,
      });
      const result = await getPolicyFetchTimestamp();
      expect(result).toBe(timestamp);
    });

    it('should return null when no timestamp exists', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({});
      const result = await getPolicyFetchTimestamp();
      expect(result).toBeNull();
    });
  });

  describe('getPollingInterval', () => {
    it('should return default interval when not configured', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({});
      const interval = await getPollingInterval();
      expect(interval).toBe(60000);
    });

    it('should return stored interval', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        config_polling_interval: 30000,
      });
      const interval = await getPollingInterval();
      expect(interval).toBe(30000);
    });

    it('should return default for out-of-bounds values', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        config_polling_interval: 5000,
      });
      const interval = await getPollingInterval();
      expect(interval).toBe(60000);
    });
  });

  describe('setPollingInterval', () => {
    it('should store valid polling interval', async () => {
      const interval = 30000;
      await setPollingInterval(interval);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        config_polling_interval: interval,
      });
    });

    it('should throw error for interval below minimum', async () => {
      await expect(setPollingInterval(5000)).rejects.toThrow(
        'Polling interval must be between 10000 and 3600000 milliseconds'
      );
    });

    it('should throw error for interval above maximum', async () => {
      await expect(setPollingInterval(4000000)).rejects.toThrow(
        'Polling interval must be between 10000 and 3600000 milliseconds'
      );
    });
  });
});
