# Browser Automation Rules

- Prefer Playwright over Puppeteer for auto-waiting and better browser management
- Use `page.evaluate()` for DOM injection instead of canvas libraries
- Always use `waitUntil: "networkidle"` when loading pages
- Add a small fixed delay (~500ms) after networkidle for late-loading elements
- When combining screenshots with structured data, visual context significantly improves LLM understanding
