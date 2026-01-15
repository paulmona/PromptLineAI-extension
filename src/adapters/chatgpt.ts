import { EventType } from "../types";
import { logger } from "../lib/logger";

export type EventCallback = (eventType: EventType, metadata?: { file_ext?: string; file_size_kb?: number }) => void;

/**
 * Initialize ChatGPT adapter
 * Sets up observers for prompt submission and file selection
 */
export function initChatGPT(onEvent: EventCallback): void {
  logger.log("chatgpt-adapter", "Initializing ChatGPT adapter");

  let promptSubmitted = false;
  let sendButton: HTMLElement | null = null;
  let textarea: HTMLTextAreaElement | null = null;

  // Find textarea and send button
  function findElements(): void {
    if (!textarea) {
      // ChatGPT uses a textarea for the prompt input - try multiple selectors
      textarea = document.querySelector("textarea[data-id='root']") as HTMLTextAreaElement
        || document.querySelector("textarea#prompt-textarea") as HTMLTextAreaElement
        || document.querySelector("textarea[placeholder*='Message']") as HTMLTextAreaElement
        || document.querySelector("textarea[placeholder*='message']") as HTMLTextAreaElement
        || Array.from(document.querySelectorAll("textarea")).find(t => t.offsetHeight > 0) as HTMLTextAreaElement;
      if (textarea) {
        logger.log("chatgpt-adapter", "Found textarea");
      } else {
        logger.warn("chatgpt-adapter", "Textarea not found");
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
    onEvent("prompt_submit");
    // Reset after a short delay to allow for rapid submissions
    setTimeout(() => {
      promptSubmitted = false;
    }, 1000);
  }

  // Set up textarea listeners
  function setupTextareaListeners(): void {
    if (!textarea) return;

    // Listen for Enter key (without Shift)
    // Don't prevent default - let ChatGPT handle the submission, we just detect it
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        handlePromptSubmit();
      }
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
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const file = files[0];
          const fileExt = file.name.split(".").pop() || null;
          const fileSizeKb = Math.round(file.size / 1024);
          logger.log("chatgpt-adapter", "File selected:", file.name, fileSizeKb, "KB");
          onEvent("file_selected", { file_ext: fileExt || undefined, file_size_kb: fileSizeKb });
        }
      });
    });
  }

  // Initial setup
  findElements();
  if (textarea) {
    setupTextareaListeners();
  }
  if (sendButton) {
    setupSendButtonListener();
  }
  setupFileInputListeners();

  // Use MutationObserver to watch for dynamic content
  const observer = new MutationObserver(() => {
    const hadTextarea = !!textarea;
    const hadSendButton = !!sendButton;

    findElements();

    if (!hadTextarea && textarea) {
      setupTextareaListeners();
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
