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
 * Initialize ChatGPT adapter
 * Sets up observers for prompt submission and file selection
 */
export function initChatGPT(onEvent: EventCallback): void {
  logger.log("chatgpt-adapter", "Initializing ChatGPT adapter");

  let promptSubmitted = false;
  let sendButton: HTMLElement | null = null;
  // Support both textarea and contenteditable div for prompt input
  let promptInput: HTMLElement | null = null;
  // Track file inputs that already have listeners to prevent duplicates
  const fileInputsWithListeners = new WeakSet<HTMLInputElement>();
  // Track paste events for paste detection
  let lastPasteTime: number = 0;
  const PASTE_DETECTION_WINDOW_MS = 5000; // 5 seconds

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
      // Try to find textarea first (traditional ChatGPT UI)
      promptInput = document.querySelector("textarea[data-id='root']") as HTMLElement
        || document.querySelector("textarea#prompt-textarea") as HTMLElement
        || document.querySelector("textarea[placeholder*='Message']") as HTMLElement
        || document.querySelector("textarea[placeholder*='message']") as HTMLElement
        || Array.from(document.querySelectorAll("textarea")).find(t => t.offsetHeight > 0) as HTMLElement;

      // If no textarea found, try contenteditable div (newer ChatGPT UI)
      if (!promptInput) {
        promptInput = document.querySelector("div[contenteditable='true'][role='textbox']") as HTMLElement
          || document.querySelector("div[contenteditable='true'][data-id='root']") as HTMLElement
          || Array.from(document.querySelectorAll("div[contenteditable='true']")).find(
            (div) => {
              // Look for contenteditable divs that are likely the prompt input
              const rect = div.getBoundingClientRect();
              return rect.height > 0 && rect.width > 100; // Reasonable size for input field
            }
          ) as HTMLElement;
      }

      if (promptInput) {
        const elementType = promptInput.tagName.toLowerCase();
        logger.log("chatgpt-adapter", `Found prompt input (${elementType})`);
      } else {
        logger.warn("chatgpt-adapter", "Prompt input not found (neither textarea nor contenteditable div)");
      }
    }

    if (!sendButton) {
      // ChatGPT send button - look for button with aria-label or specific class
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute("aria-label");
        const title = btn.getAttribute("title");
        const className = btn.className || "";
        // Check aria-label, title, or class name for send/submit indicators
        if (
          (ariaLabel && (ariaLabel.toLowerCase().includes("send") || ariaLabel.toLowerCase().includes("submit"))) ||
          (title && (title.toLowerCase().includes("send") || title.toLowerCase().includes("submit"))) ||
          (className && (className.toLowerCase().includes("send") || className.toLowerCase().includes("submit")))
        ) {
          sendButton = btn;
          logger.log("chatgpt-adapter", "Found send button");
          break;
        }
      }
      if (!sendButton) {
        logger.warn("chatgpt-adapter", "Send button not found");
      }
    }
  }

  // Handle prompt submission
  function handlePromptSubmit(): void {
    if (promptSubmitted) return;
    promptSubmitted = true;
    logger.log("chatgpt-adapter", "Prompt submitted");

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
    // Don't prevent default - let ChatGPT handle the submission, we just detect it
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        handlePromptSubmit();
      }
    });

    // Track paste events for paste detection
    promptInput.addEventListener("paste", () => {
      lastPasteTime = Date.now();
      logger.log("chatgpt-adapter", "Paste detected");
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
    fileInputs.forEach((element) => {
      const input = element as HTMLInputElement;
      // Only attach listener if we haven't already attached one to this input
      if (!fileInputsWithListeners.has(input)) {
        fileInputsWithListeners.add(input);

        input.addEventListener("change", async (e) => {
          const target = e.target as HTMLInputElement;
          const files = target.files;
          if (files && files.length > 0) {
            const file = files[0];
            const fileExt = file.name.split(".").pop() || undefined;
            const fileSizeKb = Math.round(file.size / 1024);
            logger.log("chatgpt-adapter", "File selected:", file.name, fileSizeKb, "KB");

            // Check policy for file name logging
            const logFileName = await shouldLogFileName();
            onEvent("file_selected", {
              file_ext: fileExt,
              file_size_kb: fileSizeKb,
              file_name: logFileName ? file.name : undefined
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

  logger.log("chatgpt-adapter", "ChatGPT adapter initialized with observers");
}
