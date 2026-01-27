import { EventType } from "../types";
import { logger } from "../lib/logger";
import { getPolicyConfig } from "../config-storage";

export type EventCallback = (
  eventType: EventType,
  metadata?: {
    file_ext?: string;
    file_size_kb?: number;
    file_name?: string;
    prompt_len_bucket?: string;
    has_code_block?: boolean;
    paste_detected?: boolean;
  }
) => void;

/**
 * Initialize Google Gemini adapter
 * Sets up observers for prompt submission and file selection
 * Works for both gemini.google.com and ai.google.dev
 */
export function initGoogle(onEvent: EventCallback): void {
  logger.log("gemini-adapter", "Initializing Google Gemini adapter");

  let promptSubmitted = false;
  let sendButton: HTMLElement | null = null;
  // Support both textarea and contenteditable div for prompt input
  let promptInput: HTMLElement | null = null;
  // Track file inputs that already have listeners to prevent duplicates
  const fileInputsWithListeners = new WeakSet<HTMLInputElement>();
  // Track paste events for paste detection
  let lastPasteTime: number = 0;
  const PASTE_DETECTION_WINDOW_MS = 5000; // 5 seconds
  // Track if we've already logged the send button warning (Gemini uses Enter key, not a button)
  let sendButtonWarningLogged = false;

  /**
   * Check if an element is still valid (exists, in DOM, and visible)
   */
  function isElementValid(element: HTMLElement | null): boolean {
    if (!element) return false;
    // Check if element is still in the document
    if (!document.body.contains(element)) return false;
    // Check if element is visible (offsetParent is null for hidden elements)
    if (element.offsetParent === null && element.offsetHeight === 0) return false;
    return true;
  }

  /**
   * Bucket prompt length into categories
   */
  function getPromptLengthBucket(text: string): string {
    const len = text.length;
    if (len <= 200) return "0-200";
    if (len <= 1000) return "200-1000";
    return "1000+";
  }

  /**
   * Check if file names should be logged based on policy
   */
  async function shouldLogFileName(): Promise<boolean> {
    const policy = await getPolicyConfig();
    // Default to true if no policy cached
    return policy?.fileUpload?.logFileNames ?? true;
  }

  /**
   * Detect if prompt contains code blocks (DOM-based heuristic)
   */
  function detectCodeBlock(element: HTMLElement): boolean {
    if (!element) return false;

    // For textarea, check text content
    if (element.tagName.toLowerCase() === "textarea") {
      const text = (element as HTMLTextAreaElement).value;
      // Check for backticks (common in markdown code blocks)
      if (text.includes("```") || text.includes("`")) {
        return true;
      }
      // Check for common code patterns
      if (text.match(/\b(function|const|let|var|class|import|export|def|return|if|for|while)\b/)) {
        return true;
      }
    }

    // For contenteditable div, check DOM structure
    if (element.contentEditable === "true") {
      // Check for <code> or <pre> elements
      const codeElements = element.querySelectorAll("code, pre");
      if (codeElements.length > 0) {
        return true;
      }
      // Check text content for backticks
      const text = element.textContent || element.innerText || "";
      if (text.includes("```") || text.includes("`")) {
        return true;
      }
      // Check for code-like formatting (monospace font, etc.)
      const computedStyle = window.getComputedStyle(element);
      const fontFamily = computedStyle.fontFamily.toLowerCase();
      if (fontFamily.includes("monospace") || fontFamily.includes("courier")) {
        // Additional check: if it's a small portion, might be code
        const text = element.textContent || "";
        if (text.length > 50 && text.match(/\b(function|const|let|var|class|import|export)\b/)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get prompt text from element (without storing it)
   */
  function getPromptText(element: HTMLElement): string {
    if (element.tagName.toLowerCase() === "textarea") {
      return (element as HTMLTextAreaElement).value;
    }
    if (element.contentEditable === "true") {
      return element.textContent || element.innerText || "";
    }
    return "";
  }

  // Find prompt input (textarea or contenteditable div) and send button
  function findElements(): void {
    // Validate existing promptInput - reset if invalid
    if (!isElementValid(promptInput)) {
      promptInput = null;
    }

    // Validate existing sendButton - reset if invalid
    if (!isElementValid(sendButton)) {
      sendButton = null;
    }

    if (!promptInput) {
      // Try contenteditable div first (Gemini uses Quill editor, not textarea)
      // Priority: Most specific Gemini selectors first
      promptInput = document.querySelector("div.ql-editor[contenteditable='true'][role='textbox']") as HTMLElement
        || document.querySelector("div[contenteditable='true'][aria-label='Enter a prompt here']") as HTMLElement
        || document.querySelector("div[contenteditable='true'][aria-label*='prompt']") as HTMLElement
        || document.querySelector("div[contenteditable='true'][role='textbox']") as HTMLElement
        || Array.from(document.querySelectorAll("div[contenteditable='true']")).find(
            (div) => {
              // Look for contenteditable divs that are likely the prompt input
              const rect = div.getBoundingClientRect();
              return rect.height > 0 && rect.width > 100; // Reasonable size for input field
            }
          ) as HTMLElement;

      // Fallback to textarea (for edge cases or older UI versions)
      if (!promptInput) {
        promptInput = document.querySelector("textarea[placeholder*='message']") as HTMLElement
          || document.querySelector("textarea[placeholder*='Message']") as HTMLElement
          || document.querySelector("textarea[aria-label*='message']") as HTMLElement
          || document.querySelector("textarea[aria-label*='Message']") as HTMLElement
          || document.querySelector("textarea[role='textbox']") as HTMLElement
          || Array.from(document.querySelectorAll("textarea")).find(t => t.offsetHeight > 0) as HTMLElement;
      }

      if (promptInput) {
        const elementType = promptInput.tagName.toLowerCase();
        const selector = promptInput.classList.contains("ql-editor") ? "ql-editor class"
          : promptInput.getAttribute("aria-label") === "Enter a prompt here" ? "exact aria-label"
          : promptInput.getAttribute("aria-label")?.includes("prompt") ? "prompt aria-label"
          : promptInput.getAttribute("role") === "textbox" ? "role=textbox"
          : "generic";
        logger.log("gemini-adapter", `Found prompt input (${elementType}) via ${selector} selector`);
      } else {
        logger.warn("gemini-adapter", "Prompt input not found (neither textarea nor contenteditable div)");
      }
    }

    if (!sendButton) {
      // Gemini send button - look for button with aria-label or specific class
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute("aria-label");
        const title = btn.getAttribute("title");
        const className = btn.className || "";
        const textContent = btn.textContent || "";
        // Check aria-label, title, class name, or text content for send/submit indicators
        if (
          (ariaLabel && (ariaLabel.toLowerCase().includes("send") || ariaLabel.toLowerCase().includes("submit"))) ||
          (title && (title.toLowerCase().includes("send") || title.toLowerCase().includes("submit"))) ||
          (className && (className.toLowerCase().includes("send") || className.toLowerCase().includes("submit"))) ||
          (textContent && (textContent.toLowerCase().trim() === "send" || textContent.toLowerCase().includes("send")))
        ) {
          sendButton = btn;
          logger.log("gemini-adapter", "Found send button");
          break;
        }
      }
      if (!sendButton && !sendButtonWarningLogged) {
        logger.log("gemini-adapter", "Send button not found (expected - Gemini uses Enter key)");
        sendButtonWarningLogged = true;
      }
    }
  }

  // Handle prompt submission
  function handlePromptSubmit(): void {
    if (promptSubmitted) return;
    promptSubmitted = true;
    logger.log("gemini-adapter", "Prompt submitted");

    // Collect prompt metadata (without storing actual text)
    let promptLenBucket: string | undefined;
    let hasCodeBlock: boolean | undefined;
    let pasteDetected: boolean | undefined;

    if (promptInput) {
      const promptText = getPromptText(promptInput);
      promptLenBucket = getPromptLengthBucket(promptText);
      hasCodeBlock = detectCodeBlock(promptInput);
      
      // Check if paste was detected recently
      const now = Date.now();
      pasteDetected = (now - lastPasteTime) < PASTE_DETECTION_WINDOW_MS && lastPasteTime > 0;
    }

    onEvent("prompt_submit", {
      prompt_len_bucket: promptLenBucket,
      has_code_block: hasCodeBlock,
      paste_detected: pasteDetected,
    });

    // Reset after a short delay to allow for rapid submissions
    setTimeout(() => {
      promptSubmitted = false;
    }, 1000);
  }

  // Set up prompt input listeners (works for both textarea and contenteditable div)
  function setupPromptInputListeners(): void {
    if (!promptInput) return;

    // Listen for Enter key (without Shift)
    // Don't prevent default - let Gemini handle the submission, we just detect it
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        handlePromptSubmit();
      }
    });

    // Track paste events for paste detection
    promptInput.addEventListener("paste", () => {
      lastPasteTime = Date.now();
      logger.log("gemini-adapter", "Paste detected");
    });
  }

  // Set up send button listener
  function setupSendButtonListener(): void {
    if (!sendButton) return;

    sendButton.addEventListener("click", () => {
      handlePromptSubmit();
    });
  }

  // Set up file input listeners
  function setupFileInputListeners(): void {
    // Find all file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      // Only attach listener if we haven't already attached one to this input
      if (!fileInputsWithListeners.has(input)) {
        fileInputsWithListeners.add(input);
        
        input.addEventListener("change", async (e) => {
          const target = e.target as HTMLInputElement;
          const files = target.files;
          if (files && files.length > 0) {
            const file = files[0];
            const fileExt = file.name.split(".").pop() || null;
            const fileSizeKb = Math.round(file.size / 1024);
            logger.log("gemini-adapter", "File selected:", file.name, fileSizeKb, "KB");
            
            // Check policy for file name logging
            const logFileName = await shouldLogFileName();
            onEvent("file_selected", { 
              file_ext: fileExt || undefined, 
              file_size_kb: fileSizeKb, 
              file_name: logFileName ? file.name : null 
            });
          }
        });
      }
    });
  }

  // Initial setup
  findElements();
  if (promptInput) {
    setupPromptInputListeners();
  }
  if (sendButton) {
    setupSendButtonListener();
  }
  setupFileInputListeners();

  // Use MutationObserver to watch for dynamic content
  const observer = new MutationObserver(() => {
    const hadPromptInput = !!promptInput;
    const hadSendButton = !!sendButton;

    // Validate existing elements before searching
    if (!isElementValid(promptInput)) {
      promptInput = null;
    }
    if (!isElementValid(sendButton)) {
      sendButton = null;
    }

    findElements();

    // Set up listeners if we found new elements
    if (!hadPromptInput && promptInput) {
      setupPromptInputListeners();
    }

    if (!hadSendButton && sendButton) {
      setupSendButtonListener();
    }

    // Re-check file inputs periodically
    setupFileInputListeners();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  logger.log("gemini-adapter", "Google Gemini adapter initialized with observers");
}
