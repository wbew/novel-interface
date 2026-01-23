# TODO

## Element Preview

### Red bounding box not showing on some elements
- Test on HackerNews - header links don't show the highlight
- Likely a z-index or positioning issue with the preview overlay

### Preview elements below viewport
- Currently shows "Element is below viewport" message
- Supporting this would require scrolling to the element and re-capturing the screenshot
- Adds complexity - evaluate if the UX benefit is worth it

---

## Future Features

### AI-Generated Descriptions
- Send DOM context around an action to an LLM to generate a one-line description of what it likely does
- Useful when labels are vague or missing context
- Could cache descriptions per selector/URL pattern

### Smart Grouping
- Group actions by page region (header, sidebar, main content, footer)
- Or by semantic purpose (navigation, forms, social, etc.)
- Makes long lists easier to scan

### Recent/Frequent Actions
- Track which actions users execute on a site
- Surface frequently used actions first
- Could be per-domain or global

---

## Code Smells to Revisit

### Focus Management
- Current fix uses `requestAnimationFrame` to ensure DOM is ready before focusing
- Look into better approaches:
  - React's `useLayoutEffect` for synchronous DOM updates
  - `focus()` with `{ preventScroll: true }` options
  - Custom focus trap libraries designed for Shadow DOM
  - MutationObserver to detect when element is actually rendered

### Escape Key Handler
- Current fix adds document-level Escape listener
- This could override keyboard shortcuts on the host page
- Look into better approaches:
  - Only listen when panel is visible (current plan does this)
  - Use capture phase with conditional propagation
  - Check if focus is within the Shadow DOM before handling
  - Consider a focus trap that naturally handles Escape
