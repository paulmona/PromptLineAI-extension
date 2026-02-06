# PromptLineAI Extension

[![Tests](https://github.com/PromptLineAI/extension/actions/workflows/test.yml/badge.svg)](https://github.com/PromptLineAI/extension/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-80%25-green.svg)](https://github.com/PromptLineAI/extension/tree/main/coverage)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-blue.svg)](https://developer.chrome.com/docs/extensions/)

A Chrome (Chromium) Manifest V3 extension that detects AI tool usage on ChatGPT and logs high-level events without capturing content.

## Features

- Detects events on ChatGPT (chat.openai.com and chatgpt.com):
  - `visit`: When the page is loaded
  - `prompt_submit`: When user submits a prompt (Enter key or send button)
  - `file_selected`: When user selects a file attachment
- Queues events in `chrome.storage.local`
- Sends events to backend (configurable, DRY_RUN mode by default)
- Popup UI showing device ID and last 20 events

## Privacy

**This extension does NOT capture:**
- Prompt content
- File content
- Any user input text
- Conversation history

It only logs metadata about events (timestamps, event types, file extensions/sizes).

## Setup

### Install Dependencies

```bash
pnpm install
```

### Build

```bash
pnpm build
```

This will create a `dist/` directory with all required files.

### Building with Clerk

The extension uses Clerk for authentication. Set these environment variables via `export` before running the build or dev server:

- **CLERK_PUBLISHABLE_KEY** (required for auth): Your Clerk publishable key (e.g. `pk_test_...` or `pk_live_...`), same as your backend.
- **CLERK_SYNC_HOST** (optional): Origin of your sync-host sign-in page (e.g. `http://127.0.0.1:8787`) so the popup can open "Open sync host to sign in".

Example:

```bash
export CLERK_PUBLISHABLE_KEY=pk_test_xxxx
export CLERK_SYNC_HOST=http://127.0.0.1:8787
pnpm build
```

If the key is not set, the build will log a warning and the extension will show "Clerk Publishable Key Not Configured" until you rebuild with the key set.

### Development (Watch Mode)

```bash
pnpm dev
```

This will watch for changes and rebuild automatically.

## Loading the Extension

1. Open Chrome/Chromium
2. Navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist/` directory from this project

## Verification

1. Open `chatgpt.com` or `chat.openai.com`
2. Open the browser console (F12) to see event logs
3. Type a prompt and press Enter (or click send)
4. Attach a file to see file_selected events
5. Click the extension icon to see the popup with recent events

## Configuration

Edit `src/config.ts` to configure:

- `BACKEND_URL`: Backend endpoint for sending events (default: `http://127.0.0.1:8787/ingest`)
- `POC_TOKEN`: Token for `X-POC-TOKEN` header (default: empty)
- `DRY_RUN`: If `true`, logs events but doesn't send (default: `true`)
- `FLUSH_INTERVAL_MS`: How often to flush events (default: `10000` ms)
- `BATCH_SIZE`: Max events per flush (default: `50`)
- `MAX_QUEUE_SIZE`: Max events in queue before dropping oldest (default: `500`)

## Project Structure

```
/
  /src
    background.ts          # Service worker (handles events, flushing)
    content.ts             # Content script (detects events)
    config.ts              # Configuration
    types.ts               # TypeScript types
    storage.ts             # Storage helpers
    sender.ts              # Backend sender
    popup.ts               # Popup UI logic
    /adapters
      chatgpt.ts          # ChatGPT-specific detection
    /lib
      uuid.ts             # UUID generator
      logger.ts           # Logger utility
  /public
    manifest.json         # Extension manifest
    popup.html            # Popup UI
  /scripts
    build.mjs             # Build script
  package.json
  tsconfig.json
  README.md
```

## Building

The build process:
1. Bundles TypeScript files with esbuild (ESM format for all scripts)
2. Copies `manifest.json` and `popup.html` to `dist/`
3. Copies icons (if present) to `dist/icons/`

Output files in `dist/`:
- `background.js`
- `content.js`
- `popup.js`
- `manifest.json`
- `popup.html`
- `icons/` (if provided)

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test suites
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests only
pnpm test:adapters      # Adapter tests (deferred)

# Run E2E tests (Playwright)
pnpm test:e2e
```

### Test Coverage

Current test coverage:
- **Core utilities**: 100% (uuid, logger)
- **Storage layer**: 100% (queue management, config storage)
- **Network layer**: 86% (sender, policy-fetcher)
- **Integration**: 7 tests validating module interactions

### Test Structure

```
/tests
  /unit              # Unit tests for individual modules
  /integration       # Integration tests for module interactions
  /adapters          # Adapter tests (see tests/adapters/README.md)
  /e2e               # End-to-end tests (Playwright)
  /fixtures          # Test fixtures (events, policies, DOM)
  /helpers           # Test helpers (chrome-api, dom-setup)
  setup.ts           # Test setup (custom chrome mocks)
```

### CI/CD

All tests run automatically on:
- Push to `main`, `develop`, or `feature/*` branches
- Pull requests to `main` or `develop`

See [.github/workflows/](.github/workflows/) for workflow configurations.

## License

MIT
