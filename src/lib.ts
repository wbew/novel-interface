// ============ TYPES ============

export type ActionType = "button" | "link" | "input" | "interactive";

export type ActionItem = {
  id: string;
  label: string;
  element: HTMLElement;
  type: ActionType;
  rawLabel: string;
};

/** Serializable version of ActionItem (no DOM element) for cross-context messaging */
export type SerializedAction = {
  id: string;
  label: string;
  type: ActionType;
  rawLabel: string;
  href?: string;
  selector: string;
};

/** Represents one level in the action chain */
export type ActionChainLevel = {
  url: string;
  pageTitle: string;
  actions: SerializedAction[];
  selectedAction: SerializedAction;
};

// ============ SCANNER ============

/**
 * Extract a meaningful label from an element using various sources
 */
function extractLabel(element: HTMLElement): string {
  // 1. aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // 2. aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
  }

  // 3. innerText (trimmed, first line only for long text)
  const innerText = element.innerText?.trim();
  if (innerText) {
    const firstLine = innerText.split("\n")[0]?.trim() ?? "";
    if (firstLine.length <= 50) return firstLine;
    return firstLine.slice(0, 47) + "...";
  }

  // 4. title attribute
  const title = element.getAttribute("title");
  if (title?.trim()) return title.trim();

  // 5. alt attribute (for images inside buttons)
  const img = element.querySelector("img");
  if (img) {
    const alt = img.getAttribute("alt");
    if (alt?.trim()) return alt.trim();
  }

  // 6. placeholder (for inputs)
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = element.placeholder;
    if (placeholder?.trim()) return placeholder.trim();
  }

  // 7. value (for submit buttons)
  if (element instanceof HTMLInputElement) {
    const value = element.value;
    if (value?.trim()) return value.trim();
  }

  return "";
}

/**
 * Find a meaningful parent context for disambiguation
 */
function getParentContext(element: HTMLElement): string | null {
  const meaningfulTags = ["section", "article", "nav", "form", "header", "footer", "aside", "main"];

  let current = element.parentElement;
  while (current && current !== document.body) {
    // Check for aria-label on parent
    const ariaLabel = current.getAttribute("aria-label");
    if (ariaLabel?.trim()) return ariaLabel.trim();

    // Check for meaningful ID
    const id = current.id;
    if (id && !id.match(/^[a-f0-9-]{20,}$/i)) {
      // Format ID nicely: "user-settings" -> "User Settings"
      return id.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    // Check for meaningful tag
    if (meaningfulTags.includes(current.tagName.toLowerCase())) {
      // Try to get a label for this section
      const heading = current.querySelector("h1, h2, h3, h4, h5, h6");
      if (heading?.textContent?.trim()) {
        const text = heading.textContent.trim();
        return text.length <= 30 ? text : text.slice(0, 27) + "...";
      }
      return current.tagName.toLowerCase().charAt(0).toUpperCase() + current.tagName.toLowerCase().slice(1);
    }

    current = current.parentElement;
  }
  return null;
}

/**
 * Determine the action type based on the element
 */
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

/**
 * Check if an element is visible and interactable
 */
function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);

  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (element.offsetWidth === 0 && element.offsetHeight === 0) return false;

  return true;
}

/**
 * Scan the DOM for all interactive elements
 */
export function scanActions(excludeSelector?: string): ActionItem[] {
  const selectors = [
    "button",
    "a[href]",
    'input[type="submit"]',
    'input[type="button"]',
    "[role='button']",
    "[role='link']",
    "[onclick]",
    "select",
  ];

  const elements = document.querySelectorAll<HTMLElement>(selectors.join(", "));
  const actions: ActionItem[] = [];
  const labelCounts = new Map<string, number>();

  // First pass: collect all elements and count label occurrences
  const candidates: { element: HTMLElement; rawLabel: string; type: ActionType }[] = [];

  elements.forEach((element) => {
    // Skip elements inside excluded selector (e.g., our cmdk overlay)
    if (excludeSelector && element.closest(excludeSelector)) return;

    // Skip invisible elements
    if (!isVisible(element)) return;

    const rawLabel = extractLabel(element);
    if (!rawLabel) return;

    const type = getActionType(element);
    candidates.push({ element, rawLabel, type });

    const count = labelCounts.get(rawLabel) || 0;
    labelCounts.set(rawLabel, count + 1);
  });

  // Second pass: create ActionItems with context for duplicates
  const labelIndices = new Map<string, number>();

  candidates.forEach(({ element, rawLabel, type }, index) => {
    let label = rawLabel;

    // If this label appears multiple times, add context
    if ((labelCounts.get(rawLabel) || 0) > 1) {
      const context = getParentContext(element);
      if (context) {
        label = `${context} > ${rawLabel}`;
      } else {
        // Fallback to index
        const idx = (labelIndices.get(rawLabel) || 0) + 1;
        labelIndices.set(rawLabel, idx);
        label = `${rawLabel} (${idx})`;
      }
    }

    actions.push({
      id: `action-${index}`,
      label,
      element,
      type,
      rawLabel,
    });
  });

  return actions;
}

// ============ EXECUTOR ============

/**
 * Execute an action by scrolling to it and clicking/focusing
 */
export function executeAction(action: ActionItem): void {
  const { element, type } = action;

  // Scroll into view if needed
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Execute based on type
  if (type === "input") {
    element.focus();
    if (element instanceof HTMLSelectElement) {
      // Trigger click to open dropdown
      element.click();
    }
  } else {
    element.click();
  }
}

// ============ MATCHER ============

/**
 * Filter actions by a search query
 */
export function filterActions(actions: ActionItem[], query: string): ActionItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return actions;
  return actions.filter(
    (action) =>
      action.label.toLowerCase().includes(q) ||
      action.rawLabel.toLowerCase().includes(q)
  );
}

/**
 * Sort actions by type priority: buttons first, then interactive, then inputs, then links
 */
export function sortActions(actions: ActionItem[]): ActionItem[] {
  const priority: Record<ActionType, number> = {
    button: 0,
    interactive: 1,
    input: 2,
    link: 3,
  };
  return [...actions].sort((a, b) => priority[a.type] - priority[b.type]);
}

// ============ SERIALIZATION ============

/**
 * Generate a unique CSS selector for an element
 */
export function generateSelector(element: HTMLElement): string {
  // Try ID first (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build path from element up to a unique ancestor
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // If we hit an element with ID, use it as anchor
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // Add nth-of-type for specificity among siblings
    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  // Add body as root if we didn't find an ID
  const firstPath = path[0];
  if (path.length > 0 && firstPath && !firstPath.startsWith("#")) {
    path.unshift("body");
  }

  return path.join(" > ");
}

/**
 * Convert ActionItem to SerializedAction for cross-context messaging
 */
export function serializeAction(action: ActionItem): SerializedAction {
  const { element, ...rest } = action;
  return {
    ...rest,
    href: element instanceof HTMLAnchorElement ? element.href : undefined,
    selector: generateSelector(element),
  };
}

/**
 * Scan and return serialized actions (for use in hidden tabs)
 */
export function scanAndSerialize(excludeSelector?: string): SerializedAction[] {
  const actions = scanActions(excludeSelector);
  return sortActions(actions).map(serializeAction);
}

/**
 * Find element by selector and execute action
 */
export function executeSerializedAction(action: SerializedAction): boolean {
  const element = document.querySelector<HTMLElement>(action.selector);
  if (!element) return false;

  element.scrollIntoView({ behavior: "smooth", block: "center" });

  if (action.type === "input") {
    element.focus();
    if (element instanceof HTMLSelectElement) {
      element.click();
    }
  } else {
    element.click();
  }
  return true;
}

// ============ BOUNDS SCANNING (for Gemini enhancement) ============

import type { ActionWithBounds } from "./types";

/**
 * Scan actions and include bounding box information for screenshot annotation
 */
export function scanActionsWithBounds(excludeSelector?: string): ActionWithBounds[] {
  const actions = scanActions(excludeSelector);
  return sortActions(actions).map((action, index) => {
    const rect = action.element.getBoundingClientRect();
    return {
      id: action.id,
      index: index + 1, // 1-based for display
      label: action.label,
      rawLabel: action.rawLabel,
      type: action.type,
      selector: generateSelector(action.element),
      href: action.element instanceof HTMLAnchorElement ? action.element.href : undefined,
      bounds: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
    };
  });
}
