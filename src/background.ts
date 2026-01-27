import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SerializedAction } from "./lib";
import type {
  ActionWithBounds,
  LabelSuggestion,
  EnhancedAction,
  EnhancementCache,
  ActionCategory,
} from "./types";

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

type EnhanceActionsRequest = {
  type: "ENHANCE_ACTIONS";
  actions: ActionWithBounds[];
  url: string;
};

type EnhanceActionsResponse = {
  type: "ENHANCE_ACTIONS_RESULT";
  success: boolean;
  enhancedActions?: EnhancedAction[];
  error?: string;
  fromCache?: boolean;
};

// ============ GEMINI ENHANCEMENT ============

// Cache for enhanced results (in-memory, keyed by URL)
const enhancementCache = new Map<string, EnhancementCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const GEMINI_PROMPT = `You are an expert UI/UX analyst. Your task is to analyze a webpage screenshot, categorize interactive elements, and improve their labels for a command palette (like macOS Spotlight or VS Code's Cmd+K).

The screenshot shows a webpage with numbered red bounding boxes. Each box corresponds to an interactive element.

I will provide you with:
1. An annotated screenshot showing all detected actions with numbered boxes
2. A JSON list of actions with their current labels

## Your Tasks

### 1. Categorize EVERY element into one of these categories:
- **navigation**: Links that go somewhere (page links, breadcrumbs, pagination, external/social links)
- **action**: Operations that do something (buttons, toggles, modals, media controls, settings, share)
- **input**: Data entry elements (text fields, dropdowns, checkboxes, search boxes)

### 2. Suggest better labels for elements that have:
- Vague labels (e.g., "Click here", "Submit", "Go")
- Missing context (e.g., "Edit" when there are multiple edit buttons)
- Technical/internal names (e.g., "btn-primary", "nav-link-2")
- Truncated or unclear labels

Good labels should be:
- Clear and descriptive (e.g., "Edit Profile Settings" instead of "Edit")
- Action-oriented (start with a verb when possible)
- Concise but complete (max 40 characters)
- Contextual (include what it affects, e.g., "Delete Comment" not just "Delete")

## Response Format

Respond with ONLY a JSON array. Include an entry for EVERY element with its category. Only include suggestedLabel if the label needs improvement:

{
  "index": <number>,
  "originalLabel": "<current label>",
  "category": "navigation" | "action" | "input",
  "suggestedLabel": "<improved label, or null if no change needed>",
  "reason": "<brief explanation for category choice and any label change>",
  "confidence": "high" | "medium" | "low"
}`;

// Inject annotation overlays into the page
async function injectAnnotations(
  tabId: number,
  actions: ActionWithBounds[]
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (actionsJson: string) => {
      const actions = JSON.parse(actionsJson) as Array<{
        index: number;
        bounds: { x: number; y: number; width: number; height: number };
      }>;

      // Create container for all annotations
      const container = document.createElement("div");
      container.id = "cmdk-gemini-annotations";
      container.style.cssText =
        "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999999;";
      document.body.appendChild(container);

      for (const action of actions) {
        const { bounds, index } = action;

        // Create bounding box
        const box = document.createElement("div");
        box.style.cssText = `
          position: absolute;
          left: ${bounds.x}px;
          top: ${bounds.y}px;
          width: ${bounds.width}px;
          height: ${bounds.height}px;
          border: 2px solid rgba(255, 99, 99, 0.8);
          box-sizing: border-box;
          pointer-events: none;
        `;
        container.appendChild(box);

        // Create number label
        const label = document.createElement("div");
        label.textContent = String(index);
        label.style.cssText = `
          position: absolute;
          left: ${bounds.x - 1}px;
          top: ${bounds.y - 20}px;
          background: rgba(255, 99, 99, 1);
          color: white;
          font-size: 12px;
          font-weight: bold;
          font-family: sans-serif;
          padding: 2px 6px;
          pointer-events: none;
        `;
        container.appendChild(label);
      }
    },
    args: [JSON.stringify(actions)],
  });
}

// Remove annotation overlays
async function removeAnnotations(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.getElementById("cmdk-gemini-annotations")?.remove();
      },
    });
  } catch {
    // Tab might be gone or not accessible
  }
}

// Call Gemini API with screenshot and actions
async function callGeminiAPI(
  screenshotDataUrl: string,
  actions: ActionWithBounds[]
): Promise<LabelSuggestion[]> {
  const result = await chrome.storage.local.get("geminiApiKey");
  const apiKey = result.geminiApiKey as string | undefined;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please add your API key in the extension settings.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Build action list for prompt
  const actionList = actions.map((a) => ({
    index: a.index,
    currentLabel: a.label,
    type: a.type,
    hasHref: !!a.href,
  }));

  const prompt = `${GEMINI_PROMPT}

Here are the detected actions:
\`\`\`json
${JSON.stringify(actionList, null, 2)}
\`\`\`

Analyze the screenshot and suggest improvements for any poorly labeled actions.`;

  // Extract base64 from data URL
  const base64Match = screenshotDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match || !base64Match[1]) {
    throw new Error("Invalid screenshot format");
  }
  const base64Data = base64Match[1];

  const response = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    },
  ]);

  const text = response.response.text();

  // Extract JSON from response (may be in code blocks or raw)
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    console.warn("Could not parse Gemini response as JSON:", text);
    return [];
  }

  try {
    const suggestions = JSON.parse(jsonMatch[1] || jsonMatch[0]) as LabelSuggestion[];
    return suggestions;
  } catch (e) {
    console.warn("Failed to parse suggestions JSON:", e);
    return [];
  }
}

// Handle ENHANCE_ACTIONS request
async function handleEnhanceActions(
  request: EnhanceActionsRequest,
  senderTabId: number
): Promise<EnhanceActionsResponse> {
  // Check cache first
  const cached = enhancementCache.get(request.url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      type: "ENHANCE_ACTIONS_RESULT",
      success: true,
      enhancedActions: cached.actions,
      fromCache: true,
    };
  }

  try {
    // 1. Inject annotations
    await injectAnnotations(senderTabId, request.actions);

    // 2. Small delay for render
    await new Promise((r) => setTimeout(r, 100));

    // 3. Capture screenshot
    const dataUrl = await chrome.tabs.captureVisibleTab({
      format: "jpeg",
      quality: 85,
    });

    // 4. Remove annotations immediately
    await removeAnnotations(senderTabId);

    // 5. Call Gemini
    const suggestions = await callGeminiAPI(dataUrl, request.actions);

    // 6. Merge suggestions with actions
    const suggestionMap = new Map(suggestions.map((s) => [s.index, s]));
    const enhancedActions: EnhancedAction[] = request.actions.map((action) => {
      const suggestion = suggestionMap.get(action.index);
      return {
        id: action.id,
        label: action.label,
        type: action.type,
        rawLabel: action.rawLabel,
        href: action.href,
        selector: action.selector,
        category: (suggestion?.category ?? "action") as ActionCategory,
        enhancedLabel: suggestion?.suggestedLabel ?? undefined,
        enhanceReason: suggestion?.reason ?? undefined,
        confidence: suggestion?.confidence ?? undefined,
      };
    });

    // 7. Cache results
    enhancementCache.set(request.url, {
      url: request.url,
      timestamp: Date.now(),
      actions: enhancedActions,
    });

    return {
      type: "ENHANCE_ACTIONS_RESULT",
      success: true,
      enhancedActions,
    };
  } catch (error) {
    // Make sure annotations are removed even on error
    await removeAnnotations(senderTabId).catch(() => {});

    return {
      type: "ENHANCE_ACTIONS_RESULT",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

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
      .captureVisibleTab({ format: "jpeg", quality: 70 })
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  // API Key management
  if (message.type === "GET_API_KEY") {
    chrome.storage.local.get("geminiApiKey").then((result) => {
      sendResponse({ success: true, apiKey: result.geminiApiKey || "" });
    });
    return true;
  }

  if (message.type === "SET_API_KEY") {
    chrome.storage.local.set({ geminiApiKey: message.apiKey }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Gemini enhancement
  if (message.type === "ENHANCE_ACTIONS") {
    const req = message as EnhanceActionsRequest;
    if (sender.tab?.id) {
      handleEnhanceActions(req, sender.tab.id).then(sendResponse);
    } else {
      sendResponse({
        type: "ENHANCE_ACTIONS_RESULT",
        success: false,
        error: "No tab ID available",
      } as EnhanceActionsResponse);
    }
    return true;
  }
});
