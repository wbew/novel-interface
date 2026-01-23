import type { SerializedAction } from "./lib";

// ============ TYPES ============

type ScanFutureActionsRequest = {
  type: "SCAN_FUTURE_ACTIONS";
  url: string;
  action?: SerializedAction; // Optional action to execute before scanning (for buttons)
};

type ExecuteChainRequest = {
  type: "EXECUTE_CHAIN";
  chain: SerializedAction[];
};

type ScanFutureActionsResponse = {
  type: "FUTURE_ACTIONS_RESULT";
  success: boolean;
  actions?: SerializedAction[];
  pageTitle?: string;
  url?: string;
  error?: string;
};

type ChainExecutionResponse = {
  type: "CHAIN_EXECUTION_COMPLETE";
  success: boolean;
  finalUrl?: string;
  error?: string;
};

// ============ HIDDEN TAB MANAGEMENT ============

async function createHiddenTab(url: string): Promise<number> {
  const tab = await chrome.tabs.create({
    url,
    active: false,
  });

  if (!tab.id) throw new Error("Failed to create tab");

  // Wait for page load
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Page load timeout (30s)"));
    }, 30000);

    const listener = (tabId: number, changeInfo: { status?: string }) => {
      if (tabId === tab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeoutId);
        resolve(tab.id);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function closeHiddenTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // Tab might already be closed
  }
}

function waitForNavigation(tabId: number, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.get(tabId).then((tab) => resolve(tab.url || ""));
    }, timeoutMs);

    const listener = (id: number, changeInfo: { status?: string }, tab: { url?: string }) => {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeoutId);
        resolve(tab.url || "");
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ============ MESSAGE HANDLERS ============

// Inline scanning function to avoid dependency on content script loading
function inlineScanActions() {
  type ActionType = "button" | "link" | "input" | "interactive";
  type SerializedAction = {
    id: string;
    label: string;
    type: ActionType;
    rawLabel: string;
    href?: string;
    selector: string;
  };

  function extractLabel(element: HTMLElement): string {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
    }

    const innerText = element.innerText?.trim();
    if (innerText) {
      const firstLine = innerText.split("\n")[0]?.trim() ?? "";
      if (firstLine.length <= 50) return firstLine;
      return firstLine.slice(0, 47) + "...";
    }

    const title = element.getAttribute("title");
    if (title?.trim()) return title.trim();

    const img = element.querySelector("img");
    if (img) {
      const alt = img.getAttribute("alt");
      if (alt?.trim()) return alt.trim();
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.placeholder?.trim()) return element.placeholder.trim();
    }

    if (element instanceof HTMLInputElement && element.value?.trim()) {
      return element.value.trim();
    }

    return "";
  }

  function getActionType(element: HTMLElement): ActionType {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a") return "link";
    if (tagName === "input" || tagName === "select" || tagName === "textarea") return "input";
    const role = element.getAttribute("role");
    if (role === "button") return "button";
    if (role === "link") return "link";
    return "interactive";
  }

  function isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (style.opacity === "0") return false;
    if (element.offsetWidth === 0 && element.offsetHeight === 0) return false;
    return true;
  }

  function generateSelector(element: HTMLElement): string {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const path: string[] = [];
    let current: HTMLElement | null = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent: HTMLElement | null = current.parentElement;
      if (parent) {
        const currentTag = current.tagName;
        const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === currentTag);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = parent;
    }
    const firstPath = path[0];
    if (path.length > 0 && firstPath && !firstPath.startsWith("#")) {
      path.unshift("body");
    }
    return path.join(" > ");
  }

  const selectors = [
    "button", "a[href]", 'input[type="submit"]', 'input[type="button"]',
    "[role='button']", "[role='link']", "[onclick]", "select",
  ];
  const elements = document.querySelectorAll<HTMLElement>(selectors.join(", "));
  const actions: SerializedAction[] = [];
  const labelCounts = new Map<string, number>();
  const candidates: { element: HTMLElement; rawLabel: string; type: ActionType }[] = [];

  elements.forEach((element) => {
    if (!isVisible(element)) return;
    const rawLabel = extractLabel(element);
    if (!rawLabel) return;
    const type = getActionType(element);
    candidates.push({ element, rawLabel, type });
    labelCounts.set(rawLabel, (labelCounts.get(rawLabel) || 0) + 1);
  });

  const labelIndices = new Map<string, number>();
  const priority: Record<ActionType, number> = { button: 0, interactive: 1, input: 2, link: 3 };

  candidates.sort((a, b) => priority[a.type] - priority[b.type]);

  candidates.forEach(({ element, rawLabel, type }, index) => {
    let label = rawLabel;
    if ((labelCounts.get(rawLabel) || 0) > 1) {
      const idx = (labelIndices.get(rawLabel) || 0) + 1;
      labelIndices.set(rawLabel, idx);
      label = `${rawLabel} (${idx})`;
    }
    actions.push({
      id: `action-${index}`,
      label,
      type,
      rawLabel,
      href: element instanceof HTMLAnchorElement ? element.href : undefined,
      selector: generateSelector(element),
    });
  });

  return { actions, title: document.title, url: window.location.href };
}

// Execute an action in a tab and wait for DOM to settle
async function executeActionInTab(
  tabId: number,
  selector: string,
  actionType: string
): Promise<{ success: boolean; error?: string }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string, type: string) => {
      const element = document.querySelector<HTMLElement>(sel);
      if (!element) return { success: false, error: "Element not found" };

      element.scrollIntoView({ behavior: "instant", block: "center" });

      if (type === "input") {
        element.focus();
        if (element instanceof HTMLSelectElement) {
          element.click();
        }
      } else {
        element.click();
      }
      return { success: true };
    },
    args: [selector, actionType],
  });

  return results[0]?.result as { success: boolean; error?: string } || { success: false, error: "No result" };
}

// Wait for DOM to settle after an action (for modals, dynamic content, etc.)
function waitForDomSettle(delayMs = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function handleScanFutureActions(
  url: string,
  action?: SerializedAction // Optional: execute this action first, then scan
): Promise<ScanFutureActionsResponse> {
  let tabId: number | null = null;

  try {
    tabId = await createHiddenTab(url);

    // If an action was provided (button click), execute it first
    if (action && !action.href) {
      const execResult = await executeActionInTab(tabId, action.selector, action.type);
      if (!execResult.success) {
        return {
          type: "FUTURE_ACTIONS_RESULT",
          success: false,
          error: execResult.error || "Failed to execute action",
        };
      }
      // Wait for DOM to settle after the action
      await waitForDomSettle(800);
    }

    // Execute inline scanning function (doesn't depend on content script)
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: inlineScanActions,
    });

    const result = results[0]?.result as {
      actions: SerializedAction[];
      title: string;
      url: string;
    } | undefined;

    return {
      type: "FUTURE_ACTIONS_RESULT",
      success: true,
      actions: result?.actions || [],
      pageTitle: result?.title || "Unknown",
      url: result?.url || url,
    };
  } catch (error) {
    return {
      type: "FUTURE_ACTIONS_RESULT",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (tabId) await closeHiddenTab(tabId);
  }
}

async function handleExecuteChain(
  chain: SerializedAction[],
  requestingTabId?: number
): Promise<ChainExecutionResponse> {
  let tabId: number | null = null;

  try {
    const firstAction = chain[0];
    if (!firstAction || !firstAction.href) {
      throw new Error("Chain must start with a link action");
    }

    // Create hidden tab and navigate to first URL
    tabId = await createHiddenTab(firstAction.href);
    let currentUrl = firstAction.href;

    // Execute remaining actions in sequence
    for (const action of chain.slice(1)) {
      // Execute action in the hidden tab
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector: string, actionType: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return { success: false, error: "Element not found" };

          element.scrollIntoView({ behavior: "instant", block: "center" });

          if (actionType === "input") {
            element.focus();
            if (element instanceof HTMLSelectElement) {
              element.click();
            }
          } else {
            element.click();
          }
          return { success: true };
        },
        args: [action.selector, action.type],
      });

      const execResult = results[0]?.result as { success: boolean; error?: string } | undefined;
      if (!execResult?.success) {
        throw new Error(execResult?.error || `Failed to execute action: ${action.label}`);
      }

      // If action is a link, wait for navigation
      if (action.href) {
        currentUrl = await waitForNavigation(tabId);
      }
    }

    // Navigate the visible tab to the final URL
    if (requestingTabId) {
      await chrome.tabs.update(requestingTabId, { url: currentUrl });
    }

    return {
      type: "CHAIN_EXECUTION_COMPLETE",
      success: true,
      finalUrl: currentUrl,
    };
  } catch (error) {
    return {
      type: "CHAIN_EXECUTION_COMPLETE",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (tabId) await closeHiddenTab(tabId);
  }
}

// ============ LISTENERS ============

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

// Listen for keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-cmdk") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "toggle-cmdk" });
    }
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_FUTURE_ACTIONS") {
    const req = message as ScanFutureActionsRequest;
    handleScanFutureActions(req.url, req.action).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === "EXECUTE_CHAIN") {
    const req = message as ExecuteChainRequest;
    handleExecuteChain(req.chain, sender.tab?.id).then(sendResponse);
    return true;
  }

  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs
      .captureVisibleTab(undefined, { format: "jpeg", quality: 70 })
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }
});
