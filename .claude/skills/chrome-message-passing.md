# Chrome Extension Message Passing

Cross-context communication between background, content, and popup scripts.

## Message Types

Define typed request/response pairs:

```typescript
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
};
```

## Sending Messages (Content Script)

```typescript
const response = await chrome.runtime.sendMessage({
  type: "ENHANCE_ACTIONS",
  actions: actionsWithBounds,
  url: window.location.href,
});

if (response?.success) {
  // Handle success
} else {
  // Handle error: response?.error
}
```

## Receiving Messages (Background Script)

Return `true` to keep the channel open for async responses:

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ENHANCE_ACTIONS") {
    handleEnhanceActions(message, sender.tab?.id)
      .then(sendResponse);
    return true; // Keep channel open for async response
  }
});
```

## Available Sender Context

- `sender.tab?.id` - Tab ID (for executeScript, captureVisibleTab)
- `sender.tab?.url` - Current tab URL
- `sender.frameId` - Frame ID if from iframe

## Reference

See `background.ts:692-742` for message listener setup and `content.tsx:533-552` for sending messages.
