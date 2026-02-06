# Adapter Tests

## Status: Deferred

Adapter tests for ChatGPT and Gemini have been deferred for the following reasons:

### Why Adapter Tests Are Deferred

1. **Implementation Mismatch**: Test skeletons reference class-based adapters (`new ChatGPTAdapter()`) but actual implementation uses function-based approach (`initChatGPT(onEvent)`)

2. **Complex DOM Requirements**: Adapter tests require:
   - Extensive DOM mocking for content scripts
   - MutationObserver simulation
   - File input and clipboard event handling
   - Browser-specific behaviors (contenteditable, paste events)

3. **Better Suited for E2E**: These behaviors are more effectively tested with:
   - Browser automation (Playwright/Puppeteer)
   - Real DOM environments
   - Actual ChatGPT/Gemini page loads

4. **Strong Existing Coverage**: Core functionality is well-tested:
   - Storage layer: 100% coverage (Unit Tests)
   - Network layer: 86% coverage (Unit Tests)
   - Policy synchronization: Integration tests passing
   - Event pipeline: Well-covered by unit tests

### What's Covered by Existing Tests

The following adapter functionality is indirectly tested:

- **Event creation**: `createMockVisitEvent`, `createMockPromptSubmitEvent` (fixtures)
- **Event validation**: Type checking in storage tests
- **Policy enforcement**: Integration tests verify policy fetch and cache
- **Queue management**: Integration tests verify queue → sender flow

### Recommendations for Future Testing

If adapter tests are needed, consider:

1. **E2E Testing**: Use Playwright to test actual page interactions
   ```typescript
   // Example E2E test
   test('ChatGPT prompt submission', async ({ page }) => {
     await page.goto('https://chat.openai.com');
     await page.fill('[contenteditable]', 'Test prompt');
     await page.press('[contenteditable]', 'Enter');
     // Verify event was queued via extension API
   });
   ```

2. **Component Testing**: Use testing-library with JSDOM for isolated adapter logic
   ```typescript
   // Test individual adapter functions
   test('detect code blocks', () => {
     const element = document.createElement('div');
     element.textContent = '```javascript\\ncode\\n```';
     expect(detectCodeBlock(element)).toBe(true);
   });
   ```

3. **Manual Testing**: Document manual test cases for adapter behaviors

### Test Skeleton Files

Test skeleton files are preserved for reference:
- `tests/adapters/chatgpt.test.ts` - 20 test cases (all TODO)
- `tests/adapters/gemini.test.ts` - Similar structure

These can serve as a starting point if adapter testing is prioritized in the future.
