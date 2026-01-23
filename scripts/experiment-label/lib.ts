import { chromium } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ActionWithBounds, LabelSuggestion } from "./types";

// Inline scanning code to inject into the page
const SCAN_ACTIONS_CODE = `
(() => {
  function extractLabel(element) {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
    }

    const innerText = element.innerText?.trim();
    if (innerText) {
      const firstLine = innerText.split("\\n")[0]?.trim() ?? "";
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
      const placeholder = element.placeholder;
      if (placeholder?.trim()) return placeholder.trim();
    }

    if (element instanceof HTMLInputElement) {
      const value = element.value;
      if (value?.trim()) return value.trim();
    }

    return "";
  }

  function getActionType(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a") return "link";
    if (tagName === "input" || tagName === "select" || tagName === "textarea") return "input";
    const role = element.getAttribute("role");
    if (role === "button") return "button";
    if (role === "link") return "link";
    return "interactive";
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (style.opacity === "0") return false;
    if (element.offsetWidth === 0 && element.offsetHeight === 0) return false;
    return true;
  }

  function generateSelector(element) {
    if (element.id) {
      return "#" + CSS.escape(element.id);
    }
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift("#" + CSS.escape(current.id));
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ":nth-of-type(" + index + ")";
        }
      }
      path.unshift(selector);
      current = parent;
    }
    if (path.length > 0 && !path[0].startsWith("#")) {
      path.unshift("body");
    }
    return path.join(" > ");
  }

  const selectors = [
    "button", "a[href]", 'input[type="submit"]', 'input[type="button"]',
    "[role='button']", "[role='link']", "[onclick]", "select",
  ];

  const elements = document.querySelectorAll(selectors.join(", "));
  const actions = [];
  let index = 1;

  elements.forEach((element) => {
    if (!isVisible(element)) return;
    const rawLabel = extractLabel(element);
    if (!rawLabel) return;

    const rect = element.getBoundingClientRect();

    actions.push({
      id: "action-" + index,
      index: index,
      label: rawLabel,
      rawLabel: rawLabel,
      type: getActionType(element),
      selector: generateSelector(element),
      href: element.tagName === "A" ? element.href : undefined,
      bounds: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
    });
    index++;
  });

  return {
    actions,
    title: document.title,
    pageHeight: document.documentElement.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
  };
})();
`;

// Code to inject annotation overlays directly on the page
function getAnnotationCode(actions: ActionWithBounds[]): string {
  return `
(() => {
  const actions = ${JSON.stringify(actions)};

  // Create container for all annotations
  const container = document.createElement('div');
  container.id = 'experiment-label-annotations';
  container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999999;';
  document.body.appendChild(container);

  for (const action of actions) {
    const { bounds, index } = action;

    // Create bounding box
    const box = document.createElement('div');
    box.style.cssText = \`
      position: absolute;
      left: \${bounds.x}px;
      top: \${bounds.y}px;
      width: \${bounds.width}px;
      height: \${bounds.height}px;
      border: 2px solid rgba(255, 99, 99, 0.8);
      box-sizing: border-box;
      pointer-events: none;
    \`;
    container.appendChild(box);

    // Create number label
    const label = document.createElement('div');
    label.textContent = String(index);
    label.style.cssText = \`
      position: absolute;
      left: \${bounds.x - 1}px;
      top: \${bounds.y - 20}px;
      background: rgba(255, 99, 99, 1);
      color: white;
      font-size: 12px;
      font-weight: bold;
      font-family: sans-serif;
      padding: 2px 6px;
      pointer-events: none;
    \`;
    container.appendChild(label);
  }
})();
`;
}

export async function scanPage(url: string): Promise<{
  actions: ActionWithBounds[];
  rawScreenshot: Buffer;
  annotatedScreenshot: Buffer;
  pageTitle: string;
}> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for any late-loading elements
    await page.waitForTimeout(1000);

    // Take raw screenshot first
    const rawScreenshot = await page.screenshot({ fullPage: true, type: "png" });

    // Execute action scanning in page context
    const result = await page.evaluate(SCAN_ACTIONS_CODE);
    const actions = result.actions as ActionWithBounds[];

    // Inject annotation overlays
    await page.evaluate(getAnnotationCode(actions));

    // Take annotated screenshot
    const annotatedScreenshot = await page.screenshot({ fullPage: true, type: "png" });

    return {
      actions,
      rawScreenshot: rawScreenshot as Buffer,
      annotatedScreenshot: annotatedScreenshot as Buffer,
      pageTitle: result.title as string,
    };
  } finally {
    await browser.close();
  }
}

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

export async function getGeminiSuggestions(
  screenshotBuffer: Buffer,
  actions: ActionWithBounds[]
): Promise<LabelSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "image/png",
        data: screenshotBuffer.toString("base64"),
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    console.warn("Could not parse Gemini response as JSON:", text);
    return [];
  }

  try {
    const suggestions = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    return suggestions as LabelSuggestion[];
  } catch (e) {
    console.warn("Failed to parse suggestions JSON:", e);
    return [];
  }
}
