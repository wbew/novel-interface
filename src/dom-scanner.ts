export type ActionItem = {
  id: string;
  label: string;
  element: HTMLElement;
  type: "button" | "link" | "input" | "interactive";
  rawLabel: string;
};

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
function getActionType(element: HTMLElement): ActionItem["type"] {
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
export function scanActions(): ActionItem[] {
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
  const candidates: { element: HTMLElement; rawLabel: string; type: ActionItem["type"] }[] = [];

  elements.forEach((element) => {
    // Skip elements inside our cmdk overlay
    if (element.closest("#cmdk-root")) return;

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
