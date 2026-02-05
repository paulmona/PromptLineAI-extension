// Testing Strategy Design Document: vitest.config.ts
// Vitest configuration for PromptLineAI Chrome Extension
// Generated: 2026-02-05

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use happy-dom for DOM environment simulation
    environment: 'happy-dom',

    // Setup file runs before each test file
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
    coverage: {
      // Use V8 coverage provider (faster, more accurate)
      provider: 'v8',

      // Output formats
      reporter: ['text', 'html', 'lcov', 'json'],

      // Files to exclude from coverage
      exclude: [
        'tests/**',
        'src/env.generated.ts',
        'src/popup.ts',
        'src/options.ts',
        'dist/**',
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'scripts/**',
      ],

      // Coverage thresholds (AC-12: Code Coverage)
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,

      // Output directory
      reportsDirectory: './coverage',

      // Include all source files in coverage report
      all: true,
      include: ['src/**/*.ts'],
    },

    // Test isolation
    isolate: true,

    // Test timeout (5 minutes max for entire suite - AC-1)
    testTimeout: 10000, // 10 seconds per test
    hookTimeout: 10000,

    // Parallel test execution for speed
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Test file patterns
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/adapters/**/*.test.ts',
    ],

    // Exclude E2E tests from Vitest (use Playwright instead)
    exclude: [
      'tests/e2e/**/*.test.ts',
      'node_modules/**',
      'dist/**',
    ],
  },

  // TypeScript resolution
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
