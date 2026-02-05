// Testing Strategy Design Document: playwright.config.ts
// Playwright configuration for E2E tests with Chrome Extension
// Generated: 2026-02-05

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',

  // Test timeout
  timeout: 60000, // 60 seconds per E2E test

  // Fail tests on first failure in CI
  fullyParallel: false,

  // Forbid test.only in CI
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers in CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],

  // Shared test configuration
  use: {
    // Base URL for navigation
    baseURL: 'https://chat.openai.com',

    // Collect trace for failed tests
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Chrome extension testing configuration
  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Extension loading will be configured in test setup
        // See: https://playwright.dev/docs/chrome-extensions
      },
    },
  ],

  // Web server configuration (if needed for local backend)
  // webServer: {
  //   command: 'npm run start:backend',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
