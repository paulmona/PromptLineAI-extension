# Testing Strategy Design Document

## Document Metadata
- **Created**: 2026-02-05
- **Status**: Approved
- **Complexity**: High
- **Target Version**: 0.2.0

## Executive Summary

This document defines a comprehensive testing strategy for the PromptLineAI Chrome extension. Currently, the extension has **zero tests**. This design proposes implementing unit tests, integration tests, adapter tests, and E2E tests to achieve 80%+ code coverage and ensure reliability of the event detection, queueing, and submission pipeline.

### Key Decisions
- **Test Framework**: Vitest (modern, fast, TypeScript-first)
- **Chrome API Mocking**: vitest-chrome library
- **DOM Environment**: happy-dom for unit/adapter tests
- **E2E Testing**: Playwright for Chrome extension loading
- **Coverage Target**: 80-85% overall, 100% for critical modules

## Problem Statement

The PromptLineAI extension currently has no automated tests, creating several risks:
1. **Regression Risk**: Changes may break existing functionality undetected
2. **Refactoring Friction**: Fear of breaking things prevents code improvements
3. **Chrome Extension Complexity**: Service workers, content scripts, and chrome APIs are difficult to test
4. **CI/CD Gap**: No automated verification before deployment
5. **Adapter Fragility**: DOM detection logic prone to breakage when AI tool UIs change

## Proposed Solution

Implement a comprehensive testing strategy covering four test categories:

### 1. Unit Tests (60% of test effort)
Test individual modules in isolation with mocked dependencies.

**Target Modules**:
- `lib/uuid.ts` - UUID generation (100% coverage)
- `lib/logger.ts` - Logging utility (100% coverage)
- `storage.ts` - Event queue operations (100% coverage)
- `config-storage.ts` - Configuration storage (90% coverage)
- `policy-fetcher.ts` - Policy API client (85% coverage)
- `sender.ts` - HTTP client with retry logic (85% coverage)

### 2. Integration Tests (30% of test effort)
Test component interactions with mocked chrome APIs and network.

**Target Workflows**:
- Event pipeline: content script → background → queue → sender
- Queue management: size limits, batching, persistence
- Policy synchronization: fetch → cache → enforce
- Authentication flow: Clerk token → API calls
- Flush mechanism: timer-based batching

### 3. Adapter Tests
Test DOM detection and event emission for AI tool adapters.

**Target Adapters**:
- `adapters/chatgpt.ts` - ChatGPT DOM detection (75% coverage)
- `adapters/gemini.ts` - Gemini DOM detection (75% coverage)

**Key Scenarios**:
- Find prompt input (textarea and contenteditable)
- Detect send button clicks
- Detect Enter key presses
- Handle MutationObserver for dynamic DOMs
- Extract metadata (prompt length, code blocks, paste detection)
- Handle file uploads with policy-based filename logging

### 4. E2E Tests (10% of test effort)
Test full extension workflows in real Chrome via Playwright.

**Target Scenarios**:
- Extension loads without errors
- Visit event emitted on page load
- Prompt submission creates events
- File upload creates events
- Events queued in chrome.storage
- Policy enforcement (disabled tools = no events)

## Technical Design

### Test Infrastructure

#### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'tests/**',
        'src/env.generated.ts',
        'src/popup.ts',
        'src/options.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
});
```

#### Test Setup File
```typescript
// tests/setup.ts
import chrome from 'vitest-chrome';
import { beforeEach } from 'vitest';

// Make chrome API globally available
global.chrome = chrome;

// Reset all mocks before each test
beforeEach(() => {
  chrome.reset();
});
```

### Chrome Extension Testing Challenges

#### Challenge 1: Service Worker Lifecycle
**Problem**: Service workers are ephemeral - they start/stop automatically.

**Solution**:
- Mock service worker lifecycle events
- Test initialization logic separately
- Use fake timers for setInterval testing
- Test state persistence via chrome.storage

#### Challenge 2: chrome.* API Mocking
**Problem**: chrome.* APIs don't exist in Node.js test environment.

**Solution**: Use `vitest-chrome` library
```typescript
import chrome from 'vitest-chrome';

// Mock storage
chrome.storage.local.set({ event_queue: [mockEvent] });
const result = await chrome.storage.local.get('event_queue');

// Mock message passing
chrome.runtime.sendMessage.mockResolvedValue({ success: true });
```

#### Challenge 3: Content Script Isolation
**Problem**: Content scripts run in isolated contexts separate from page and background.

**Solution**:
- Test content.ts separately with mocked chrome.runtime.sendMessage
- Test background.ts separately with mocked onMessage handlers
- Integration tests verify message contracts

#### Challenge 4: MutationObserver Testing
**Problem**: Adapters use MutationObserver to watch DOM changes.

**Solution**:
- Use happy-dom which includes MutationObserver
- Manually trigger observer callbacks in tests
- Verify observer is created and disconnected properly

#### Challenge 5: Async Event Pipeline
**Problem**: Events flow asynchronously through multiple components.

**Solution**:
- Use async/await in all tests
- Mock timers with vi.useFakeTimers()
- Test each pipeline stage independently
- Integration tests verify end-to-end flow

### Mock Strategies

#### Chrome API Mocking (vitest-chrome)
```typescript
// Mock storage
chrome.storage.local.get.mockResolvedValue({ device_id: 'test-id' });
chrome.storage.local.set.mockResolvedValue(undefined);

// Mock messages
chrome.runtime.sendMessage.mockResolvedValue({ success: true });
```

#### Fetch API Mocking
```typescript
global.fetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ success: true }), {
    status: 200
  }))
);
```

#### Clerk Authentication Mocking
```typescript
vi.mock('../../src/clerk-auth', () => ({
  getClerkToken: vi.fn(() => Promise.resolve('mock-token')),
  getAuthStateForDisplay: vi.fn(() => Promise.resolve({
    signedIn: true,
    userDisplay: 'test@example.com'
  }))
}));
```

#### DOM Environment (happy-dom)
```typescript
import { Window } from 'happy-dom';

beforeEach(() => {
  const window = new Window();
  global.document = window.document as any;
  global.window = window as any;
});
```

## Coverage Goals

| Module | Target Coverage | Priority | Rationale |
|--------|----------------|----------|-----------|
| `lib/uuid.ts` | 100% | High | Simple, pure function |
| `lib/logger.ts` | 100% | High | Simple utility |
| `storage.ts` | 100% | High | Critical - queue management |
| `config-storage.ts` | 90% | High | Core functionality |
| `sender.ts` | 85% | High | Critical path, many error branches |
| `policy-fetcher.ts` | 85% | High | Critical path |
| `background.ts` | 80% | High | Complex, many code paths |
| `content.ts` | 80% | High | Entry point |
| `adapters/chatgpt.ts` | 75% | Medium | DOM-dependent |
| `adapters/gemini.ts` | 75% | Medium | DOM-dependent |
| `clerk-auth.ts` | 70% | Low | Third-party integration |
| `popup.ts` | 50% | Low | UI - deferred |
| `options.ts` | 50% | Low | UI - deferred |

**Overall Target**: 80-85% code coverage

## Test Organization

```
tests/
├── setup.ts                    # Global test setup
├── fixtures/
│   ├── events.ts              # Mock event data
│   ├── policies.ts            # Mock policy configurations
│   └── dom-templates.ts       # HTML templates for adapters
├── helpers/
│   ├── chrome-api.ts          # Chrome API test helpers
│   └── dom-setup.ts           # DOM environment helpers
├── unit/
│   ├── lib/
│   │   ├── uuid.test.ts
│   │   └── logger.test.ts
│   ├── storage.test.ts
│   ├── config-storage.test.ts
│   ├── sender.test.ts
│   └── policy-fetcher.test.ts
├── integration/
│   ├── event-pipeline.test.ts
│   ├── queue-management.test.ts
│   └── policy-sync.test.ts
├── adapters/
│   ├── chatgpt.test.ts
│   └── gemini.test.ts
└── e2e/
    ├── chatgpt-workflow.test.ts
    └── gemini-workflow.test.ts
```

## Acceptance Criteria

### AC-1: Test Framework Setup ✓
**Given** a clean repository
**When** test infrastructure is installed and configured
**Then**:
- Vitest, vitest-chrome, happy-dom, and coverage tools are in package.json
- `vitest.config.ts` exists with correct configuration
- `tests/setup.ts` initializes chrome API mocks
- `pnpm test` command runs all tests successfully
- Tests complete in < 5 minutes

**Verification Level**: L3 (Build success)

### AC-2: Unit Tests - Core Utilities ✓
**Given** core utility modules (uuid, logger)
**When** unit tests are executed
**Then**:
- `lib/uuid.test.ts` has 100% coverage
- `lib/logger.test.ts` has 100% coverage
- All edge cases covered
- Tests pass consistently

**Verification Level**: L2 (Tests pass)

### AC-3: Unit Tests - Storage Layer ✓
**Given** storage modules (storage.ts, config-storage.ts)
**When** unit tests are executed
**Then**:
- `storage.test.ts` has 90%+ coverage
- `config-storage.test.ts` has 90%+ coverage
- chrome.storage API mocked correctly
- Async operations tested properly
- Cache invalidation scenarios tested

**Verification Level**: L2 (Tests pass)

### AC-4: Unit Tests - Network Layer ✓
**Given** network modules (sender.ts, policy-fetcher.ts)
**When** unit tests are executed
**Then**:
- `sender.test.ts` has 85%+ coverage
- `policy-fetcher.test.ts` has 85%+ coverage
- All HTTP status codes tested (200, 401, 403, 409, 413, 429, 500)
- Retry logic tested with fake timers
- Timeout scenarios tested
- DRY_RUN mode tested

**Verification Level**: L2 (Tests pass)

### AC-5: Integration Tests - Event Pipeline ✓
**Given** event pipeline components
**When** integration tests are executed
**Then**:
- Full pipeline tested (event creation → queue → flush → send)
- Message passing between contexts mocked correctly
- Error scenarios tested (send failures, re-queueing)
- Policy enforcement tested (disabled tools = no events)

**Verification Level**: L2 (Tests pass)

### AC-6: Integration Tests - Queue Management ✓
**Given** queue management components
**When** integration tests are executed
**Then**:
- MAX_QUEUE_SIZE limit enforced (oldest events dropped)
- BATCH_SIZE limit enforced
- Queue persistence tested
- Concurrent flush prevention tested (lock mechanism)
- DRY_RUN mode tested (events kept in queue)

**Verification Level**: L2 (Tests pass)

### AC-7: Integration Tests - Policy Synchronization ✓
**Given** policy components
**When** integration tests are executed
**Then**:
- Policy fetch on startup tested
- Policy caching tested
- Polling interval tested with fake timers
- Failed fetch fallback tested (uses cached policy)
- Policy timestamp updates tested

**Verification Level**: L2 (Tests pass)

### AC-8: Adapter Tests - ChatGPT ✓
**Given** ChatGPT adapter
**When** adapter tests are executed
**Then**:
- DOM element detection tested (textarea, contenteditable, send button)
- Event emission tested (prompt_submit on Enter/click, file_selected)
- Metadata collection tested (prompt length, code blocks, paste detection)
- MutationObserver tested (re-finds elements after DOM change)
- Policy-based file name logging tested
- Edge cases tested (missing elements, element removal)
- 75%+ coverage achieved

**Verification Level**: L2 (Tests pass)

### AC-9: Adapter Tests - Gemini ✓
**Given** Gemini adapter
**When** adapter tests are executed
**Then**:
- Quill editor detection tested (contenteditable div)
- Event emission tested (Enter key primary, send button fallback)
- Metadata collection tested (same as ChatGPT)
- MutationObserver tested
- Policy-based file name logging tested
- Edge cases tested
- 75%+ coverage achieved

**Verification Level**: L2 (Tests pass)

### AC-10: E2E Tests - ChatGPT Workflow ✓
**Given** built extension and ChatGPT workflow
**When** E2E tests are executed
**Then**:
- Extension loads on chat.openai.com
- Visit event created on page load
- Prompt submission creates prompt_submit event
- File upload creates file_selected event
- Events stored in chrome.storage.local
- Events flushed to backend (or verified in DRY_RUN mode)
- Policy disabled = no events emitted

**Verification Level**: L1 (Full workflow operational)

### AC-11: E2E Tests - Gemini Workflow ✓
**Given** built extension and Gemini workflow
**When** E2E tests are executed
**Then**:
- Extension loads on gemini.google.com
- Visit event created on page load
- Prompt submission creates prompt_submit event
- File upload creates file_selected event
- Events stored in chrome.storage.local
- Events flushed to backend
- Policy disabled = no events emitted

**Verification Level**: L1 (Full workflow operational)

### AC-12: Code Coverage ✓
**Given** all tests executed
**When** coverage report is generated
**Then**:
- Overall coverage ≥ 80% (lines, functions, statements)
- Overall branch coverage ≥ 75%
- Each critical module meets individual coverage targets
- Coverage report generated in HTML format
- Coverage report shows per-file breakdown

**Verification Level**: L2 (Coverage tool passes)

### AC-13: CI/CD Integration ✓
**Given** GitHub Actions (or equivalent CI/CD)
**When** PR is opened
**Then**:
- All tests run automatically
- Build fails if tests fail
- Build fails if coverage drops below 80%
- Coverage report posted as PR comment
- Tests complete in < 5 minutes

**Verification Level**: L3 (CI pipeline passes)

### AC-14: Test Documentation ✓
**Given** testing infrastructure
**When** developer reads documentation
**Then**:
- README.md includes testing section with commands
- Testing guidelines documented
- Mock strategy documented
- Fixture usage documented
- Examples provided for each test type

**Verification Level**: L3 (Documentation exists)

## Implementation Approach

### Selected Strategy: Vertical Slice (Feature-driven)

**Rationale**:
1. Low interdependencies - test categories can be implemented independently
2. Early value delivery - unit tests first for quick wins
3. Testability - each slice is independently verifiable
4. Team coordination - different developers can work in parallel

### Phase Breakdown

#### Phase 1: Foundation (Test Infrastructure)
**Duration**: 1-2 days

**Tasks**:
1. Install dependencies (Vitest, vitest-chrome, happy-dom, coverage)
2. Create `vitest.config.ts`
3. Create `tests/setup.ts` (chrome API mock initialization)
4. Create fixture structure (`tests/fixtures/`)
5. Create helper structure (`tests/helpers/`)
6. Verify test runner works with simple smoke test

**Verification**: L3 (Build success) - `pnpm test` runs without errors

#### Phase 2: Unit Tests - Core Utilities
**Duration**: 1 day

**Tasks**:
1. Write `lib/uuid.test.ts` (4 test cases)
2. Write `lib/logger.test.ts` (4 test cases)
3. Achieve 100% coverage for both modules

**Verification**: L2 (Tests pass) - All utility tests pass, 100% coverage

#### Phase 3: Unit Tests - Storage Layer
**Duration**: 2 days

**Tasks**:
1. Write `storage.test.ts` (8 test cases)
2. Write `config-storage.test.ts` (9 test cases)
3. Create storage fixtures
4. Achieve 90%+ coverage

**Verification**: L2 (Tests pass) - All storage tests pass, 90%+ coverage

#### Phase 4: Unit Tests - Network Layer
**Duration**: 2 days

**Tasks**:
1. Write `sender.test.ts` (10 test cases)
2. Write `policy-fetcher.test.ts` (8 test cases)
3. Create policy fixtures
4. Achieve 85%+ coverage

**Verification**: L2 (Tests pass) - All network tests pass, 85%+ coverage

#### Phase 5: Integration Tests
**Duration**: 3 days

**Tasks**:
1. Write `event-pipeline.test.ts` (7 test cases)
2. Write `queue-management.test.ts` (5 test cases)
3. Write `policy-sync.test.ts` (6 test cases)
4. Test message passing between contexts
5. Test timer-based operations with fake timers

**Verification**: L2 (Tests pass) - All integration tests pass

#### Phase 6: Adapter Tests
**Duration**: 3 days

**Tasks**:
1. Write `chatgpt.test.ts` (19 test cases)
2. Write `gemini.test.ts` (19 test cases)
3. Create DOM template fixtures
4. Setup happy-dom environment
5. Test MutationObserver behavior
6. Achieve 75%+ coverage

**Verification**: L2 (Tests pass) - All adapter tests pass, 75%+ coverage

#### Phase 7: E2E Tests
**Duration**: 2-3 days

**Tasks**:
1. Setup Playwright configuration
2. Create extension build for E2E testing
3. Write `chatgpt-workflow.test.ts` (5-7 test cases)
4. Write `gemini-workflow.test.ts` (5-7 test cases)
5. Handle authentication challenges

**Verification**: L1 (Functional) - Full workflows operational in real Chrome

#### Phase 8: CI/CD Integration
**Duration**: 1 day

**Tasks**:
1. Create `.github/workflows/test.yml`
2. Configure coverage reporting
3. Setup PR comments for coverage
4. Verify < 5 minute execution time
5. Test build failure scenarios

**Verification**: L3 (CI pipeline passes) - Tests run on every PR

#### Phase 9: Documentation
**Duration**: 1 day

**Tasks**:
1. Update README.md with testing section
2. Create TESTING.md guide
3. Document mock strategies
4. Document fixture usage
5. Provide examples for each test type

**Verification**: L3 (Documentation exists) - Comprehensive testing docs

**Total Estimated Duration**: 15-18 days

## Change Impact Map

### Direct Impact
- `package.json` - New devDependencies added
- `vitest.config.ts` - New file created
- `tests/` directory - New directory structure created
- `.github/workflows/test.yml` - New CI/CD workflow created

### Indirect Impact
- Development workflow - Developers must run tests before commit
- CI/CD pipeline - Tests added to build process
- Code review process - Coverage reports inform reviews

### No Impact
- Production source code (no changes to src/)
- Extension functionality (tests validate, don't modify)
- User experience (testing is development-time only)

## Non-Functional Requirements

### Performance
- **Test Execution Speed**: Total test suite < 5 minutes
  - Unit tests: < 1 second total
  - Integration tests: < 2 seconds total
  - Adapter tests: < 1 second total
  - E2E tests: < 60 seconds total
- **CI/CD Impact**: Minimal pipeline slowdown (tests parallelized)

### Maintainability
- **Test Quality**: All tests follow AAA pattern (Arrange-Act-Assert)
- **Test Independence**: No shared state between tests
- **Fixture Reusability**: Centralized fixtures for common data
- **Mock Hygiene**: Mocks reset before each test

### Reliability
- **Deterministic Tests**: No flaky tests (use fake timers, no real delays)
- **Isolation**: Tests don't depend on external services (all mocked)
- **Error Messages**: Clear failure messages for debugging

### Scalability
- **Parallelization**: Tests run in parallel (Vitest default)
- **Selective Execution**: Run specific test suites (`pnpm test:unit`, `pnpm test:e2e`)
- **Watch Mode**: Fast feedback during development (`pnpm test:watch`)

## Dependencies

### New Development Dependencies
```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "vitest-chrome": "^1.0.0",
    "happy-dom": "^15.0.0",
    "@vitest/coverage-v8": "^2.1.0",
    "playwright": "^1.50.0"
  }
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:adapters": "vitest run tests/adapters",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "coverage:view": "open coverage/index.html"
  }
}
```

## References

### Chrome Extension Testing
- [Migrate to Manifest V3 | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate)
- [How to Automate Tests for a Chrome Extension using Playwright? | BrowserStack](https://www.browserstack.com/guide/playwright-chrome-extension)

### Vitest & Testing Tools
- [vitest-chrome GitHub](https://github.com/probil/vitest-chrome)
- [Vitest Browser Mode - Mock Service Worker](https://mswjs.io/docs/recipes/vitest-browser-mode/)
- [Testing Service Worker | Guide | Vite PWA](https://vite-pwa-org.netlify.app/guide/testing-service-worker)

### Project Documentation
- `testing-principles` skill document
- `coding-principles` skill document
- `documentation-criteria` skill document

---

**Document Version**: 1.0
**Last Updated**: 2026-02-05
**Status**: Ready for Implementation
