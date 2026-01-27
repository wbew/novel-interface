import type { ActionType, SerializedAction } from "./lib";

// ============ GEMINI ENHANCEMENT TYPES ============

/** Action category for filtering in UI */
export type ActionCategory = "navigation" | "action" | "input";

/** Action with bounding box information for screenshot annotation */
export type ActionWithBounds = {
  id: string;
  index: number;
  label: string;
  rawLabel: string;
  type: ActionType;
  selector: string;
  href?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

/** Gemini's suggestion for a single action */
export type LabelSuggestion = {
  index: number;
  originalLabel: string;
  suggestedLabel: string | null;
  category: ActionCategory;
  reason: string;
  confidence: "high" | "medium" | "low";
};

/** Action enhanced with Gemini suggestions */
export type EnhancedAction = SerializedAction & {
  category?: ActionCategory;
  enhancedLabel?: string;
  enhanceReason?: string;
  confidence?: "high" | "medium" | "low";
};

/** Cache entry for enhanced results */
export type EnhancementCache = {
  url: string;
  timestamp: number;
  actions: EnhancedAction[];
};
