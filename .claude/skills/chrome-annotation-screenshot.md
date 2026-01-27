# Chrome Annotation Screenshot Pattern

Two-phase pattern for capturing annotated screenshots without persisting overlays.

## Flow

1. **Inject annotations** via `chrome.scripting.executeScript`
2. **Wait for render** (small delay, ~100ms)
3. **Capture screenshot** via `chrome.tabs.captureVisibleTab`
4. **Remove annotations** immediately
5. **Process image** (call API, etc.)

## Implementation

```typescript
// Inject annotations
await chrome.scripting.executeScript({
  target: { tabId },
  func: (actionsJson: string) => {
    const container = document.createElement("div");
    container.id = "cmdk-gemini-annotations";
    container.style.cssText = "position: absolute; top: 0; left: 0; pointer-events: none; z-index: 999999;";
    document.body.appendChild(container);
    // ... add annotation boxes
  },
  args: [JSON.stringify(actions)],
});

// Capture
await new Promise((r) => setTimeout(r, 100));
const dataUrl = await chrome.tabs.captureVisibleTab({ format: "jpeg", quality: 85 });

// Remove
await chrome.scripting.executeScript({
  target: { tabId },
  func: () => document.getElementById("cmdk-gemini-annotations")?.remove(),
});
```

## Error Handling

Always remove annotations even on error:

```typescript
try {
  // ... inject, capture, process
} catch (error) {
  // Handle error
} finally {
  await removeAnnotations(tabId).catch(() => {});
}
```

## Reference

See `background.ts:100-171` for inject/remove functions and `background.ts:242-316` for the full flow.
