# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Manifest V3 extension that detects and logs AI tool usage events (ChatGPT, Gemini) without capturing content. Events are queued locally and sent to a backend ingest API with Clerk-based authentication.

## Build & Development

```bash
# Install dependencies
pnpm install

# Build for production
export CLERK_PUBLISHABLE_KEY=pk_test_xxxx  # Required
export CLERK_SYNC_HOST=http://127.0.0.1:8787  # Optional
pnpm build

# Development with watch mode
pnpm dev
```

Output goes to `dist/` directory which can be loaded as an unpacked extension in Chrome.

## Git Workflow

**IMPORTANT: Always follow this workflow before making any changes:**

### Branch First
Always create a new branch before starting work. Never commit directly to `main`.

```bash
# Create and switch to a new branch
git checkout -b feature/descriptive-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### Commit Strategy
Make **small, frequent commits** rather than large, monolithic commits.

**Good commit practices:**
- Commit after completing each logical unit of work (single function, single file, single bug fix)
- Each commit should represent a working state (no broken code)
- Write clear, descriptive commit messages
- Prefer 3-5 small commits over 1 large commit

**Examples of good commit granularity:**
```bash
git commit -m "Add file upload detection to ChatGPT adapter"
git commit -m "Update PolicyConfig type to include file name logging"
git commit -m "Add policy check before emitting visit events"
```

**Avoid:**
```bash
# Bad: Too much in one commit
git commit -m "Add feature X with tests and docs and refactoring"
```

### When to Commit
- ✅ After implementing a single function or method
- ✅ After fixing a specific bug
- ✅ After updating a configuration file
- ✅ After adding tests for a specific feature
- ✅ Before switching tasks or approaches
- ❌ After implementing multiple unrelated changes
- ❌ After a full day of work without intermediate commits

## Architecture

### Core Pipeline
Events flow through: **content script → background service worker → queue → sender → backend**

1. **Content Scripts** (`src/content.ts`): Detect events on AI tool pages
2. **Adapters** (`src/adapters/`): Tool-specific DOM detection logic (ChatGPT, Gemini)
3. **Background Service Worker** (`src/background.ts`): Receives events via messages, manages queue, flushes batches
4. **Queue** (`src/storage.ts`): Persists events in `chrome.storage.local` before sending
5. **Sender** (`src/sender.ts`): Batches and sends events to backend with auth token

### Authentication
- Uses `@clerk/chrome-extension` for auth
- Clerk keys injected at build time via `scripts/build.mjs` → `src/env.generated.ts`
- Background worker gets tokens via `src/clerk-auth.ts`
- Tokens never exposed to content scripts or popup UI

### Configuration
- **Build-time**: Clerk keys from environment variables
- **Runtime**: Backend URL, device name, policy config stored in `chrome.storage.sync` (fallback to `local`)
- See `src/config-storage.ts` for storage-based config
- See `src/config.ts` for constants (flush interval, batch size, queue limits)

### Policy System
Background worker polls backend for policy configuration:
- Which tools to track (`chatgpt`, `gemini`)
- Whether to log file names
- Stored in `chrome.storage` and checked by content scripts before emitting events
- Default polling: 60s (configurable via `getPollingInterval`)

### Event Types
- `visit`: Page load
- `prompt_submit`: User submits prompt (Enter key or send button)
  - Includes metadata: `prompt_len_bucket`, `has_code_block`, `paste_detected`
- `file_selected`: File attachment selected
  - Includes metadata: `file_ext`, `file_size_kb`, optionally `file_name` (based on policy)

**Privacy**: No prompt content or file content is captured, only metadata.

## Key Constraints

### Manifest V3
- Service worker (not background page)
- No remote code execution
- Must request explicit permissions

### Security & Privacy
- Never store secrets in extension code (tokens are ephemeral)
- No logging of prompt content or file content
- `DRY_RUN=false` by default (sends data)
- All network requests go through authenticated sender

### Adapter Pattern
All site-specific detection logic must live in `src/adapters/<tool>.ts`. Core pipeline code (`content.ts`, `background.ts`, `storage.ts`, `sender.ts`) must remain tool-agnostic.

Adapters use `MutationObserver` to detect DOM changes and call event callbacks. They must handle:
- Dynamic DOM changes
- Avoiding duplicate listeners
- Graceful handling of page navigation and extension reloads

## Extension Restrictions

### Platform Admin Organization
Extension cannot be used with Platform Admin organization (backend returns 403 with `EXTENSION_NOT_ALLOWED_FOR_PLATFORM_ADMIN`). When detected:
- `extensionNotAllowedCached` flag prevents further send attempts
- UI displays: "This extension cannot be used with the Platform Admin organization"
- Events are not sent (queue remains in storage)

### Error Handling
- 401/409 status codes: Events dropped (not re-queued)
- Other failures: Events re-queued for retry
- Queue size limited to `MAX_QUEUE_SIZE` (500), oldest events dropped when full
- Extension context invalidation (e.g. reload) is handled silently

## Development Principles

### From .cursor/rules/001-cursor-rules.mdc:

**Scope Control**
- No features beyond explicit request
- No refactoring unrelated code
- Minimal diffs
- Do not change event schema without approval

**Dependencies**
- Avoid new dependencies
- Prefer Web APIs over libraries
- No upgrades without approval

**Code Quality**
- Strict TypeScript, avoid `any`
- Small, single-purpose modules
- Clear naming over clever abstractions
- Handle errors explicitly, never swallow

**Data Integrity**
- UUID per event
- Queue persisted in `chrome.storage.local`
- Retry with backoff
- Max queue size enforced
- Batch sends (max 50 events)

**Performance**
- Do not degrade host page
- Use `MutationObserver` carefully (debounce, disconnect when stable)
- No polling loops in content scripts

**Logging**
- Prefix logs with `[PromptLineAI]`
- Gate verbose logs behind `DEBUG` flag

## Common Tasks

### Adding a New AI Tool Adapter
1. Create `src/adapters/<tool>.ts` with `init<Tool>(onEvent: EventCallback)` function
2. Add tool to `Tool` type in `src/types.ts`
3. Add content script match in `public/manifest.json`
4. Add host permission in `public/manifest.json`
5. Update `getTool()` in `src/content.ts`
6. Add init call in `init()` in `src/content.ts`
7. Update backend policy to include new tool

### Testing Extension Locally
1. Build with `pnpm build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist/` directory
6. Open target AI tool page and check browser console for `[PromptLineAI]` logs
7. Click extension icon to see popup with recent events

### Changing Event Schema
**STOP AND ASK FIRST** - event schema changes require backend coordination.

## File Structure
- `src/background.ts` - Service worker: event handling, queue management, flushing, policy polling
- `src/content.ts` - Content script: tool detection, policy checking, event creation
- `src/adapters/` - Tool-specific DOM detection (ChatGPT, Gemini)
- `src/clerk-auth.ts` - Clerk authentication (background only)
- `src/config-storage.ts` - Runtime configuration storage
- `src/storage.ts` - Event queue storage
- `src/sender.ts` - Backend API client
- `src/popup.ts` - Extension popup UI logic
- `src/options.ts` - Options page UI logic
- `src/types.ts` - TypeScript type definitions
- `scripts/build.mjs` - esbuild-based build script
- `public/` - Static assets (manifest, HTML files, icons)

## Build Output
esbuild bundles TypeScript → ESM format:
- `dist/background.js` - Service worker
- `dist/content.js` - Content script
- `dist/popup.js` - Popup UI
- `dist/options.js` - Options page
- `dist/manifest.json` - Extension manifest
- `dist/popup.html` - Popup HTML
- `dist/options.html` - Options HTML
