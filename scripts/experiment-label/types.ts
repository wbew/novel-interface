export type ActionType = "button" | "link" | "input" | "interactive";

export type ActionCategory = "navigation" | "action" | "input";

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

export type LabelSuggestion = {
  index: number;
  originalLabel: string;
  suggestedLabel: string | null;
  category: ActionCategory;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type LabelImprovementResult = {
  url: string;
  timestamp: string;
  pageTitle: string;
  totalActions: number;
  improvedCount: number;
  actions: Array<{
    index: number;
    id: string;
    type: ActionType;
    category: ActionCategory;
    selector: string;
    originalLabel: string;
    suggestedLabel: string | null;
    reason: string | null;
    confidence: "high" | "medium" | "low" | null;
  }>;
  screenshotPath: string;
  rawScreenshotPath: string;
};
