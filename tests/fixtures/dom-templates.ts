// Testing Strategy Design Document: tests/fixtures/dom-templates.ts
// HTML templates for adapter testing (ChatGPT and Gemini DOM structures)
// Generated: 2026-02-05

/**
 * ChatGPT DOM template with textarea input
 * Used in: Adapter tests (chatgpt.test.ts)
 */
export const CHATGPT_TEXTAREA_TEMPLATE = `
  <div id="prompt-textarea" contenteditable="true" role="textbox" aria-label="Message ChatGPT">
    <p>Test prompt content</p>
  </div>
  <button data-testid="send-button" aria-label="Send prompt">
    <svg><path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"></path></svg>
  </button>
`;

/**
 * ChatGPT DOM template with file upload elements
 * Used in: Adapter tests (file upload scenarios)
 */
export const CHATGPT_FILE_UPLOAD_TEMPLATE = `
  <div id="prompt-textarea" contenteditable="true" role="textbox" aria-label="Message ChatGPT"></div>
  <button data-testid="send-button" aria-label="Send prompt"></button>
  <input type="file" id="file-upload" accept="image/*,.pdf,.txt,.doc,.docx" />
  <button aria-label="Attach files">
    <svg><use href="#paperclip-icon"></use></svg>
  </button>
`;

/**
 * Gemini DOM template with Quill editor
 * Used in: Adapter tests (gemini.test.ts)
 */
export const GEMINI_QUILL_TEMPLATE = `
  <div class="ql-container">
    <div class="ql-editor" contenteditable="true" data-placeholder="Enter a prompt here">
      <p>Test Gemini prompt</p>
    </div>
  </div>
  <button class="send-button" aria-label="Submit">
    <mat-icon>send</mat-icon>
  </button>
`;

/**
 * Gemini DOM template with file upload elements
 * Used in: Adapter tests (file upload scenarios)
 */
export const GEMINI_FILE_UPLOAD_TEMPLATE = `
  <div class="ql-container">
    <div class="ql-editor" contenteditable="true"></div>
  </div>
  <button class="send-button" aria-label="Submit"></button>
  <input type="file" accept="*/*" />
  <button aria-label="Upload file">
    <mat-icon>attach_file</mat-icon>
  </button>
`;

/**
 * Empty DOM template (no AI tool elements)
 * Used in: Adapter tests (missing element scenarios)
 */
export const EMPTY_DOM_TEMPLATE = `
  <div id="content">
    <p>Regular webpage with no AI tool interface</p>
  </div>
`;

/**
 * Helper function to create a DOM environment from template
 * Used in: All adapter tests
 */
export function createDOMFromTemplate(template: string): void {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = template;
  }
}

/**
 * Helper function to trigger MutationObserver callback
 * Used in: Adapter tests (DOM change scenarios)
 */
export function triggerDOMMutation(addedNodes: Node[] = []): void {
  // This will be implemented in the actual test to manually trigger
  // MutationObserver callbacks for testing dynamic DOM changes
}
