# Novel Interface

A monorepo for exploring novel human-computer interfaces.

## Structure

- `cmdk/`: Chrome extension for command-palette style interaction with web pages
- `canvas/`: Infinite canvas app built with TanStack Start + tldraw

## Project: cmdk/

### Package Manager

Use `bun` instead of `npm` for all commands (e.g., `cd cmdk && bun run build`).

### Architecture

- **Library** (`cmdk/src/lib.ts`): Browser-agnostic core logic (action scanning, execution, filtering)
- **Extension** (`cmdk/src/content.tsx`, `cmdk/src/background.ts`): Chrome-specific integration using the library

### Code Style

- Keep components in a single file - avoid premature splitting
- Split files only when there's a clear, demonstrated need
- Add TODOs to `TODO.md`, not as inline comments

### Keyboard Shortcuts

- Prefer `Shift+<key>` over system-conflicting shortcuts like `Cmd+Space`
- Use explicit modifier checks (`e.shiftKey`) for intentional gestures
- Always update UI hints (footer text) when changing keybindings

### Environment Variables

- Store API keys in environment variables (e.g., `GEMINI_API_KEY` via `process.env`)
- Never commit secrets to the repository

### Scripts

- `cmdk/scripts/experiment-label/`: Playwright-based experiments for analyzing and improving action labels using Gemini

### Chrome Extension Patterns

- **Message Passing**: Use `chrome.runtime.sendMessage/onMessage` for communication between background, content, and popup scripts
- **Inline Script Execution**: Use `chrome.scripting.executeScript` for isolated DOM tasks (avoids dependency on content script loading)
- **Screenshot Capture**: Use `chrome.tabs.captureVisibleTab` with explicit format/quality options
- **Storage**: Use `chrome.storage.local` for persisting API keys and settings

### React Patterns

- **Shadow DOM**: Mount React app in shadow DOM (`delegatesFocus: true`) to isolate styles from host page
- **CSS Variables**: Use CSS custom properties for consistent theming (`--cmdk-bg`, `--cmdk-accent`, etc.)
- **Performance**: Use `useMemo` for expensive filtering/sorting, `useRef` for mutable non-reactive values
- **Debouncing**: Prevent double-toggle issues with timestamp-based debouncing via `useRef`

### Gemini Integration

- **Two-Phase Screenshot**: Inject visual annotations → capture screenshot → remove annotations → call API
- **Caching**: Cache API responses in-memory with TTL (e.g., 5 minutes) keyed by URL
- **Error Handling**: Always clean up annotations even on API error; provide user-facing error messages

### Future Vision

The library is designed to enable autonomous execution mode where the background script orchestrates tab navigation and sends instructions to content scripts, leveraging the user's authenticated browser session.

## Project: canvas/

### Package Manager

Use `bun` instead of `npm` for all commands (e.g., `cd canvas && bun run dev`).

### Stack

- **Framework**: TanStack Start (React + file-based routing)
- **Canvas**: tldraw for infinite canvas functionality
- **Build**: Vite

### Development

```bash
cd canvas && bun install && bun run dev
```

Open http://localhost:3000 to view the canvas.

### SSR Handling

tldraw requires browser APIs. Components using tldraw are client-only rendered using a mounted state check.
