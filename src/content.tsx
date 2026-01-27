import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  scanActions,
  executeAction,
  filterActions,
  sortActions,
  scanAndSerialize,
  serializeAction,
  type ActionItem,
  type SerializedAction,
  type ActionChainLevel,
} from "./lib";

// Expose scanAndSerialize for background script to call in hidden tabs
(window as any).__cmdk__ = { scanAndSerialize };

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

.cmdk-breadcrumbs {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid var(--cmdk-border);
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
}

.cmdk-breadcrumb {
  background: none;
  border: none;
  color: var(--cmdk-text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmdk-breadcrumb:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--cmdk-text);
}

.cmdk-breadcrumb.active {
  color: var(--cmdk-text);
  font-weight: 500;
  background: rgba(0, 0, 0, 0.04);
}

.cmdk-breadcrumb-separator {
  color: var(--cmdk-text-secondary);
  font-size: 10px;
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

.cmdk-item-drill {
  font-size: 11px;
  color: var(--cmdk-accent);
  padding: 2px 6px;
  background: rgba(255, 99, 99, 0.1);
  border-radius: 4px;
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

.cmdk-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  gap: 12px;
}

.cmdk-loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--cmdk-border);
  border-top-color: var(--cmdk-accent);
  border-radius: 50%;
  animation: cmdk-spin 0.8s linear infinite;
}

@keyframes cmdk-spin {
  to { transform: rotate(360deg); }
}

.cmdk-loading-text {
  font-size: 13px;
  color: var(--cmdk-text-secondary);
}

.cmdk-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  gap: 12px;
  color: var(--cmdk-accent);
}

.cmdk-error-text {
  font-size: 13px;
}

.cmdk-error-retry {
  font-size: 12px;
  color: var(--cmdk-text-secondary);
  background: none;
  border: 1px solid var(--cmdk-border);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}

.cmdk-error-retry:hover {
  background: rgba(0, 0, 0, 0.04);
}

.cmdk-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--cmdk-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cmdk-hint {
  font-size: 12px;
  color: var(--cmdk-text-secondary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.cmdk-hint-item {
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

.cmdk-preview {
  position: fixed;
  top: 50%;
  left: calc(50% + 336px);
  transform: translateY(-50%);
  background: var(--cmdk-bg);
  border: 1px solid var(--cmdk-border);
  border-radius: var(--cmdk-radius);
  box-shadow: var(--cmdk-shadow);
  overflow: hidden;
  pointer-events: none;
  z-index: 2147483647;
}

.cmdk-preview-image {
  position: relative;
  width: 180px;
  height: 120px;
  overflow: hidden;
}

.cmdk-preview-image img {
  position: absolute;
  max-width: none;
}

.cmdk-preview-highlight {
  position: absolute;
  background: rgba(255, 99, 99, 0.2);
  border: 2px solid var(--cmdk-accent);
  border-radius: 2px;
  pointer-events: none;
}

.cmdk-preview-offscreen {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--cmdk-text-secondary);
  text-align: center;
  border-top: 1px solid var(--cmdk-border);
}
`;

// Highlight styles injected into main document (outside shadow DOM)
const highlightStyles = `
#cmdk-highlight {
  position: fixed;
  pointer-events: none;
  background: rgba(255, 99, 99, 0.15);
  border: 2px solid rgba(255, 99, 99, 0.8);
  border-radius: 4px;
  z-index: 2147483646;
  transition: all 0.15s ease-out;
  opacity: 0;
}

#cmdk-highlight.visible {
  opacity: 1;
}
`;

// Create highlight element in main document (outside shadow DOM)
const highlightEl = document.createElement("div");
highlightEl.id = "cmdk-highlight";
document.body.appendChild(highlightEl);

const highlightStyleEl = document.createElement("style");
highlightStyleEl.textContent = highlightStyles;
document.head.appendChild(highlightStyleEl);

function updateHighlight(element: HTMLElement | null) {
  if (!element) {
    highlightEl.classList.remove("visible");
    return;
  }

  const rect = element.getBoundingClientRect();
  highlightEl.style.top = `${rect.top}px`;
  highlightEl.style.left = `${rect.left}px`;
  highlightEl.style.width = `${rect.width}px`;
  highlightEl.style.height = `${rect.height}px`;
  highlightEl.classList.add("visible");
}

// Chain state type
interface ChainState {
  levels: ActionChainLevel[];
  isLoading: boolean;
  error: string | null;
}

interface CommandPaletteProps {
  visible: boolean;
  screenshot: string | null;
  onClose: () => void;
}

function CommandPalette({ visible, screenshot, onClose }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Chain state for stringed actions
  const [chainState, setChainState] = useState<ChainState>({
    levels: [],
    isLoading: false,
    error: null,
  });



  // Get current actions (either from chain level or local scan)
  const currentSerializedActions = useMemo(() => {
    const currentLevel = chainState.levels[chainState.levels.length - 1];
    return currentLevel?.actions ?? null;
  }, [chainState.levels]);

  // Filter and sort actions
  const filteredActions = useMemo(() => {
    if (currentSerializedActions) {
      // Filter serialized actions from chain
      const q = query.toLowerCase().trim();
      if (!q) return currentSerializedActions;
      return currentSerializedActions.filter(
        (action) =>
          action.label.toLowerCase().includes(q) ||
          action.rawLabel.toLowerCase().includes(q)
      );
    }
    // Filter local actions
    const filtered = filterActions(actions, query);
    return sortActions(filtered);
  }, [actions, query, currentSerializedActions]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Update highlight when selection changes (only for local actions)
  useEffect(() => {
    if (currentSerializedActions) {
      // No highlight for remote actions
      updateHighlight(null);
      return;
    }
    const selectedAction = filteredActions[selectedIndex] as
      | ActionItem
      | undefined;
    if (selectedAction && visible && "element" in selectedAction) {
      updateHighlight(selectedAction.element);
    } else {
      updateHighlight(null);
    }
  }, [selectedIndex, filteredActions, visible, currentSerializedActions]);

  // Clear highlight when palette closes
  useEffect(() => {
    if (!visible) {
      updateHighlight(null);
    }
  }, [visible]);

  // Scan DOM when palette opens, reset chain state
  useEffect(() => {
    if (visible) {
      const scanned = scanActions("#cmdk-root");
      setActions(scanned);
      setQuery("");
      setSelectedIndex(0);
      setChainState({ levels: [], isLoading: false, error: null });
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
        const shadowRoot = inputRef.current.getRootNode() as ShadowRoot;
        if (shadowRoot.activeElement === inputRef.current) {
          return;
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

  // Drill down into any action (links navigate, buttons execute then scan)
  const handleDrillDown = async (action: ActionItem | SerializedAction) => {
    const serialized = "element" in action ? serializeAction(action) : action;
    const isLink = !!serialized.href;

    // Determine the URL to use:
    // - For links: use the href
    // - For buttons/other: use current page URL (from chain level or window.location)
    const currentLevelUrl =
      chainState.levels.length > 0
        ? chainState.levels[chainState.levels.length - 1]?.url
        : window.location.href;
    const targetUrl = isLink ? serialized.href! : currentLevelUrl;

    setChainState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SCAN_FUTURE_ACTIONS",
        url: targetUrl,
        // For non-link actions, pass the action to execute before scanning
        action: isLink ? undefined : serialized,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to scan page");
      }

      setChainState((prev) => ({
        levels: [
          ...prev.levels,
          {
            url: response.url || targetUrl,
            pageTitle: response.pageTitle || "Unknown",
            actions: response.actions || [],
            selectedAction: serialized,
          },
        ],
        isLoading: false,
        error: null,
      }));

      setQuery("");
      setSelectedIndex(0);
    } catch (error) {
      setChainState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  };

  // Go back to a previous level in the chain
  const handleNavigateBack = (targetIndex: number) => {
    if (targetIndex < 0) {
      // Go back to current page (level 0)
      setChainState({ levels: [], isLoading: false, error: null });
    } else {
      setChainState((prev) => ({
        ...prev,
        levels: prev.levels.slice(0, targetIndex + 1),
      }));
    }
    setQuery("");
    setSelectedIndex(0);
  };

  // Execute a local action
  const handleExecuteLocalAction = (action: ActionItem) => {
    onClose();
    setTimeout(() => executeAction(action), 100);
  };

  // Execute the chain without adding the current selection
  const handleExecuteChainOnly = async () => {
    if (chainState.levels.length === 0) return;

    const chain: SerializedAction[] = chainState.levels.map(
      (level) => level.selectedAction
    );

    onClose();

    try {
      await chrome.runtime.sendMessage({
        type: "EXECUTE_CHAIN",
        chain,
      });
    } catch (error) {
      console.error("Failed to execute chain:", error);
    }
  };

  // Execute the full chain (with current selection if any)
  const handleExecuteChain = async () => {
    if (chainState.levels.length === 0) return;

    // Build chain from all selected actions
    const chain: SerializedAction[] = chainState.levels.map(
      (level) => level.selectedAction
    );

    // Add currently selected action if it exists and not the "execute chain" option
    const adjustedIndex = selectedIndex - 1; // Account for "Execute chain" option at top
    if (adjustedIndex >= 0) {
      const currentAction = filteredActions[adjustedIndex] as
        | SerializedAction
        | undefined;
      if (currentAction) {
        chain.push(currentAction);
      }
    }

    onClose();

    try {
      await chrome.runtime.sendMessage({
        type: "EXECUTE_CHAIN",
        chain,
      });
    } catch (error) {
      console.error("Failed to execute chain:", error);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Calculate total items (including "Execute chain" option when in chain mode)
    const totalItems =
      chainState.levels.length > 0
        ? filteredActions.length + 1
        : filteredActions.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (totalItems > 0 ? (i + 1) % totalItems : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        totalItems > 0 ? (i - 1 + totalItems) % totalItems : 0
      );
    } else if (e.key === "Tab" && !e.shiftKey) {
      // Tab to drill down into any action
      e.preventDefault();
      // In chain mode, account for "Execute chain" option at index 0
      const actionIndex =
        chainState.levels.length > 0 ? selectedIndex - 1 : selectedIndex;
      if (actionIndex >= 0) {
        const action = filteredActions[actionIndex];
        if (action) {
          handleDrillDown(action);
        }
      }
    } else if (
      e.key === "Backspace" &&
      query === "" &&
      chainState.levels.length > 0
    ) {
      // Backspace with empty query goes back
      e.preventDefault();
      handleNavigateBack(chainState.levels.length - 2);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (chainState.levels.length > 0) {
        // In chain mode
        if (selectedIndex === 0) {
          // "Execute chain" option selected - execute without adding new action
          handleExecuteChainOnly();
        } else {
          // An action is selected - add it to chain and execute
          handleExecuteChain();
        }
      } else {
        // Execute local action
        const action = filteredActions[selectedIndex] as ActionItem | undefined;
        if (action && "element" in action) {
          handleExecuteLocalAction(action);
        }
      }
    } else if (e.key === "Escape") {
      if (e.metaKey && chainState.levels.length > 0) {
        // Cmd+Escape: go back to first page of actions
        e.preventDefault();
        handleNavigateBack(-1);
      } else {
        onClose();
      }
    } else if (e.key === " " && e.shiftKey && !currentSerializedActions) {
      // Shift+Space to scroll to element (only for local actions)
      e.preventDefault();
      const action = filteredActions[selectedIndex] as ActionItem | undefined;
      if (action && "element" in action) {
        action.element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Render breadcrumbs for chain navigation
  const renderBreadcrumbs = () => {
    if (chainState.levels.length === 0) return null;

    return (
      <div className="cmdk-breadcrumbs">
        <button
          className="cmdk-breadcrumb"
          onClick={() => handleNavigateBack(-1)}
        >
          Current Page
        </button>
        {chainState.levels.map((level, index) => (
          <React.Fragment key={index}>
            <span className="cmdk-breadcrumb-separator">›</span>
            <button
              className={`cmdk-breadcrumb ${
                index === chainState.levels.length - 1 ? "active" : ""
              }`}
              onClick={() => handleNavigateBack(index)}
              title={level.pageTitle}
            >
              {level.pageTitle}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render content based on state
  const renderContent = () => {
    if (chainState.isLoading) {
      return (
        <div className="cmdk-loading">
          <div className="cmdk-loading-spinner" />
          <span className="cmdk-loading-text">Loading future actions...</span>
        </div>
      );
    }

    if (chainState.error) {
      return (
        <div className="cmdk-error">
          <span className="cmdk-error-text">{chainState.error}</span>
          <button
            className="cmdk-error-retry"
            onClick={() => {
              const lastLevel = chainState.levels[chainState.levels.length - 1];
              if (lastLevel) {
                handleDrillDown(lastLevel.selectedAction);
              }
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    if (filteredActions.length === 0) {
      return (
        <div className="cmdk-empty">
          {(currentSerializedActions
            ? currentSerializedActions.length
            : actions.length) === 0
            ? "No actions found on this page"
            : "No matching actions"}
        </div>
      );
    }

    // When in chain mode, show "Execute chain" option at top
    const items = filteredActions.map((action, index) => {
      const adjustedIndex = chainState.levels.length > 0 ? index + 1 : index;
      return (
        <div
          key={action.id}
          className={`cmdk-item ${
            adjustedIndex === selectedIndex ? "selected" : ""
          }`}
          onClick={() => {
            setSelectedIndex(adjustedIndex);
            if (chainState.levels.length > 0) {
              handleExecuteChain();
            } else if ("element" in action) {
              handleExecuteLocalAction(action);
            }
          }}
          onMouseEnter={() => setSelectedIndex(adjustedIndex)}
        >
          <span className="cmdk-item-label">{action.label}</span>
          <span className="cmdk-item-type">{action.type}</span>
        </div>
      );
    });

    // Add "Execute chain" option at top when in chain mode
    if (chainState.levels.length > 0) {
      const lastLevel = chainState.levels[chainState.levels.length - 1];
      items.unshift(
        <div
          key="execute-chain"
          className={`cmdk-item ${selectedIndex === 0 ? "selected" : ""}`}
          onClick={() => {
            setSelectedIndex(0);
            handleExecuteChainOnly();
          }}
          onMouseEnter={() => setSelectedIndex(0)}
        >
          <span className="cmdk-item-label">
            Execute:{" "}
            {chainState.levels.map((l) => l.selectedAction.label).join(" → ")}
          </span>
          <span className="cmdk-item-type">chain</span>
        </div>
      );
    }

    return items;
  };

  // Render element preview showing a cropped view centered on the selected element
  const renderPreview = () => {
    // Only show for local actions (not chain/future actions)
    if (currentSerializedActions) {
      console.log("[cmdk] Preview: skipping (chain actions)");
      return null;
    }
    if (!screenshot) {
      console.log("[cmdk] Preview: skipping (no screenshot)");
      return null;
    }

    const selectedAction = filteredActions[selectedIndex] as ActionItem | undefined;
    if (!selectedAction || !("element" in selectedAction)) {
      console.log("[cmdk] Preview: skipping (no selected action)", { selectedAction, selectedIndex });
      return null;
    }
    console.log("[cmdk] Preview: rendering for", selectedAction.label);

    const element = selectedAction.element;
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Preview dimensions
    const previewWidth = 180;
    const previewHeight = 120;

    // Check if element is visible in viewport
    const isInViewport =
      rect.top < viewportHeight &&
      rect.bottom > 0 &&
      rect.left < viewportWidth &&
      rect.right > 0;

    if (!isInViewport) {
      // Element is off-screen - show indicator
      const direction = rect.bottom <= 0 ? "Above" : "Below";
      return (
        <div className="cmdk-preview">
          <div className="cmdk-preview-offscreen">
            Element is {direction.toLowerCase()} viewport
          </div>
        </div>
      );
    }

    // Calculate crop region centered on element
    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

    // Calculate the visible portion we want to show (in viewport coordinates)
    const cropLeft = Math.max(0, elementCenterX - previewWidth / 2);
    const cropTop = Math.max(0, elementCenterY - previewHeight / 2);

    // Adjust if crop would go past viewport edges
    const adjustedCropLeft = Math.min(cropLeft, viewportWidth - previewWidth);
    const adjustedCropTop = Math.min(cropTop, viewportHeight - previewHeight);

    // Element position relative to the crop region
    const highlightLeft = rect.left - adjustedCropLeft;
    const highlightTop = rect.top - adjustedCropTop;

    return (
      <div className="cmdk-preview">
        <div className="cmdk-preview-image">
          <img
            src={screenshot}
            style={{
              width: viewportWidth,
              height: viewportHeight,
              left: -adjustedCropLeft,
              top: -adjustedCropTop,
            }}
          />
          <div
            className="cmdk-preview-highlight"
            style={{
              left: highlightLeft,
              top: highlightTop,
              width: rect.width,
              height: rect.height,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      id="cmdk-overlay"
      className={visible ? "visible" : ""}
      onClick={handleOverlayClick}
    >
      {renderPreview()}
      <div className="cmdk-modal" onKeyDown={handleKeyDown}>
        {renderBreadcrumbs()}
        <div className="cmdk-header">
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder={
              chainState.levels.length > 0
                ? "Search future actions..."
                : "Type to search actions..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="cmdk-content" ref={contentRef}>
          {renderContent()}
        </div>
        <div className="cmdk-footer">
          <span className="cmdk-hint">
            <span className="cmdk-hint-item">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              navigate
            </span>
            {chainState.levels.length > 0 ? (
              <>
                <span className="cmdk-hint-item">
                  <kbd>⌫</kbd>
                  back
                </span>
                <span className="cmdk-hint-item">
                  <kbd>↵</kbd>
                  execute
                </span>
              </>
            ) : (
              <>
                <span className="cmdk-hint-item">
                  <kbd>⇧␣</kbd>
                  focus
                </span>
                <span className="cmdk-hint-item">
                  <kbd>Tab</kbd>
                  queue
                </span>
                <span className="cmdk-hint-item">
                  <kbd>↵</kbd>
                  select
                </span>
              </>
            )}
            <span className="cmdk-hint-item">
              <kbd>esc</kbd>
              close
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [visible, setVisible] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const visibleRef = useRef(visible);
  const lastToggleRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Debounced toggle to prevent double-firing from both DOM and Chrome commands
  const toggle = async () => {
    const now = Date.now();
    if (now - lastToggleRef.current < 100) return;
    lastToggleRef.current = now;

    if (!visibleRef.current) {
      // Capture screenshot BEFORE showing palette
      try {
        console.log("[cmdk] Capturing screenshot...");
        const response = await chrome.runtime.sendMessage({
          type: "CAPTURE_SCREENSHOT",
        });
        console.log("[cmdk] Screenshot response:", response?.success, response?.dataUrl?.length);
        if (response.success && response.dataUrl) {
          setScreenshot(response.dataUrl);
        }
      } catch (err) {
        console.error("[cmdk] Screenshot error:", err);
        setScreenshot(null);
      }
      setVisible(true);
    } else {
      setVisible(false);
      setScreenshot(null);
    }
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

  return (
    <CommandPalette
      visible={visible}
      screenshot={screenshot}
      onClose={() => {
        setVisible(false);
        setScreenshot(null);
      }}
    />
  );
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
