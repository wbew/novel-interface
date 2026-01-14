import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { scanActions, type ActionItem } from "./dom-scanner";

const styles = `
:host {
  all: initial;
}

#cmdk-overlay {
  --cmdk-bg: rgba(255, 255, 255, 0.98);
  --cmdk-border: rgba(0, 0, 0, 0.08);
  --cmdk-text: #1a1a1a;
  --cmdk-text-secondary: rgba(0, 0, 0, 0.45);
  --cmdk-accent: #ff6363;
  --cmdk-input-bg: rgba(0, 0, 0, 0.04);
  --cmdk-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  --cmdk-radius: 12px;

  position: fixed;
  left: 50%;
  bottom: 10vh;
  transform: translateX(-50%);
  z-index: 2147483647;
  width: 100%;
  max-width: 640px;
  padding: 0 16px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  pointer-events: none;
}

#cmdk-overlay.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

#cmdk-overlay * {
  box-sizing: border-box;
}

.cmdk-modal {
  position: relative;
  width: 100%;
  background: var(--cmdk-bg);
  border: 1px solid var(--cmdk-border);
  border-radius: var(--cmdk-radius);
  box-shadow: var(--cmdk-shadow);
  overflow: hidden;
  transform: translateY(10px);
  transition: transform 0.15s ease;
}

#cmdk-overlay.visible .cmdk-modal {
  transform: translateY(0);
}

.cmdk-header {
  padding: 16px;
  border-bottom: 1px solid var(--cmdk-border);
}

.cmdk-input {
  width: 100%;
  background: var(--cmdk-input-bg);
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
  color: var(--cmdk-text);
  outline: none;
  font-family: inherit;
}

.cmdk-input::placeholder {
  color: var(--cmdk-text-secondary);
}

.cmdk-input:focus {
  background: rgba(0, 0, 0, 0.06);
}

.cmdk-content {
  padding: 8px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.cmdk-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  gap: 12px;
}

.cmdk-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.cmdk-item.selected {
  background: rgba(0, 0, 0, 0.08);
}

.cmdk-item-label {
  flex: 1;
  font-size: 14px;
  color: var(--cmdk-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmdk-item-type {
  font-size: 11px;
  color: var(--cmdk-text-secondary);
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  text-transform: capitalize;
}

.cmdk-group {
  margin-bottom: 8px;
}

.cmdk-group:last-child {
  margin-bottom: 0;
}

.cmdk-group-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--cmdk-text-secondary);
  padding: 8px 12px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cmdk-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  font-size: 14px;
  color: var(--cmdk-text-secondary);
}

.cmdk-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--cmdk-border);
  display: flex;
  justify-content: flex-end;
}

.cmdk-hint {
  font-size: 12px;
  color: var(--cmdk-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cmdk-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  margin-right: 8px;
  font-size: 11px;
  font-family: inherit;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid var(--cmdk-border);
  border-radius: 4px;
  color: var(--cmdk-text-secondary);
}

.cmdk-content::-webkit-scrollbar {
  width: 8px;
}

.cmdk-content::-webkit-scrollbar-track {
  background: transparent;
}

.cmdk-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.cmdk-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
`;

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
}

function CommandPalette({ visible, onClose }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter and sort actions by type
  const filteredActions = useMemo(() => {
    let filtered = actions;
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = actions.filter(
        (action) =>
          action.label.toLowerCase().includes(lowerQuery) ||
          action.rawLabel.toLowerCase().includes(lowerQuery)
      );
    }
    // Sort by type priority: buttons first, then interactive, then inputs, then links
    const typePriority: Record<string, number> = {
      button: 0,
      interactive: 1,
      input: 2,
      link: 3,
    };
    return [...filtered].sort((a, b) => (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99));
  }, [actions, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scan DOM when palette opens
  useEffect(() => {
    if (visible) {
      const scanned = scanActions();
      setActions(scanned);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [visible]);

  // Focus input when palette opens - retry until it works
  useEffect(() => {
    if (!visible) return;

    let attempts = 0;
    const maxAttempts = 10;

    const tryFocus = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Check if focus worked (either in main document or shadow root)
        const shadowRoot = inputRef.current.getRootNode() as ShadowRoot;
        if (shadowRoot.activeElement === inputRef.current) {
          return; // Success
        }
      }
      if (attempts++ < maxAttempts) {
        requestAnimationFrame(tryFocus);
      }
    };

    requestAnimationFrame(tryFocus);
  }, [visible]);

  // Scroll selected item into view
  useEffect(() => {
    if (!contentRef.current) return;
    const selectedEl = contentRef.current.querySelector(".cmdk-item.selected");
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Execute an action
  const executeAction = (action: ActionItem) => {
    onClose();

    // Small delay to let the palette close
    setTimeout(() => {
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
    }, 100);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) =>
        filteredActions.length > 0 ? (i + 1) % filteredActions.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        filteredActions.length > 0
          ? (i - 1 + filteredActions.length) % filteredActions.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        executeAction(filteredActions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      id="cmdk-overlay"
      className={visible ? "visible" : ""}
      onClick={handleOverlayClick}
    >
      <div className="cmdk-modal" onKeyDown={handleKeyDown}>
        <div className="cmdk-header">
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="Type to search actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="cmdk-content" ref={contentRef}>
          {filteredActions.length > 0 ? (
            filteredActions.map((action, index) => (
              <div
                key={action.id}
                className={`cmdk-item ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => executeAction(action)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="cmdk-item-label">{action.label}</span>
                <span className="cmdk-item-type">{action.type}</span>
              </div>
            ))
          ) : (
            <div className="cmdk-empty">
              {actions.length === 0
                ? "No actions found on this page"
                : "No matching actions"}
            </div>
          )}
        </div>
        <div className="cmdk-footer">
          <span className="cmdk-hint">
            <kbd>↑</kbd><kbd>↓</kbd> navigate
            <kbd>↵</kbd> select
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(visible);
  const lastToggleRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Debounced toggle to prevent double-firing from both DOM and Chrome commands
  const toggle = () => {
    const now = Date.now();
    if (now - lastToggleRef.current < 100) return;
    lastToggleRef.current = now;
    setVisible((v) => !v);
  };

  useEffect(() => {
    const handleMessage = (message: { action: string }) => {
      if (message.action === "toggle-cmdk") {
        toggle();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      // Escape to close
      if (e.key === "Escape" && visibleRef.current) {
        setVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return <CommandPalette visible={visible} onClose={() => setVisible(false)} />;
}

// Mount React app in shadow DOM for style isolation
const host = document.createElement("div");
host.id = "cmdk-root";
const shadow = host.attachShadow({ mode: "open", delegatesFocus: true });

const styleEl = document.createElement("style");
styleEl.textContent = styles;
shadow.appendChild(styleEl);

const reactRoot = document.createElement("div");
shadow.appendChild(reactRoot);

document.body.appendChild(host);
createRoot(reactRoot).render(<App />);
