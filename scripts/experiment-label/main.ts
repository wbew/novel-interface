#!/usr/bin/env bun
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scanPage, getGeminiSuggestions } from "./lib";
import type { LabelImprovementResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: bun run scripts/experiment-label/main.ts <url>");
    console.error("Example: bun run scripts/experiment-label/main.ts https://github.com");
    process.exit(1);
  }

  console.log(`Analyzing: ${url}`);

  // Create output directory
  const outputDir = join(__dirname, "output");
  await mkdir(outputDir, { recursive: true });

  // Generate output filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const domain = new URL(url).hostname.replace(/\./g, "-");
  const baseName = `${timestamp}-${domain}`;

  // Step 1: Scan page and take screenshots
  console.log("Scanning page and taking screenshots...");
  const { actions, rawScreenshot, annotatedScreenshot, pageTitle } = await scanPage(url);
  console.log(`Found ${actions.length} actions`);

  // Save screenshots
  const rawScreenshotPath = join(outputDir, `${baseName}-raw.png`);
  const annotatedScreenshotPath = join(outputDir, `${baseName}-annotated.png`);
  await writeFile(rawScreenshotPath, rawScreenshot);
  await writeFile(annotatedScreenshotPath, annotatedScreenshot);
  console.log(`Screenshots saved to ${outputDir}/`);

  // Step 2: Get Gemini suggestions
  console.log("Sending to Gemini for analysis...");
  const suggestions = await getGeminiSuggestions(annotatedScreenshot, actions);
  console.log(`Received ${suggestions.length} improvement suggestions`);

  // Step 3: Build result object
  const suggestionMap = new Map(suggestions.map((s) => [s.index, s]));
  const improvedCount = suggestions.filter((s) => s.suggestedLabel).length;

  const result: LabelImprovementResult = {
    url,
    timestamp: new Date().toISOString(),
    pageTitle,
    totalActions: actions.length,
    improvedCount,
    actions: actions.map((action) => {
      const suggestion = suggestionMap.get(action.index);
      return {
        index: action.index,
        id: action.id,
        type: action.type,
        category: suggestion?.category ?? "action",
        selector: action.selector,
        originalLabel: action.label,
        suggestedLabel: suggestion?.suggestedLabel ?? null,
        reason: suggestion?.reason ?? null,
        confidence: suggestion?.confidence ?? null,
      };
    }),
    screenshotPath: annotatedScreenshotPath,
    rawScreenshotPath: rawScreenshotPath,
  };

  // Step 4: Save JSON output
  const jsonPath = join(outputDir, `${baseName}.json`);
  await writeFile(jsonPath, JSON.stringify(result, null, 2));

  // Print summary
  console.log("\n=== Results ===");
  console.log(`Total actions: ${result.totalActions}`);
  console.log(`Improved labels: ${result.improvedCount}`);
  console.log(`Output: ${jsonPath}`);

  // Category breakdown
  const navCount = result.actions.filter((a) => a.category === "navigation").length;
  const actionCount = result.actions.filter((a) => a.category === "action").length;
  const inputCount = result.actions.filter((a) => a.category === "input").length;
  console.log(`\nCategories: ${navCount} navigation, ${actionCount} action, ${inputCount} input`);

  // Show improvements
  const improvements = suggestions.filter((s) => s.suggestedLabel);
  if (improvements.length > 0) {
    console.log("\nSuggested label improvements:");
    for (const s of improvements) {
      console.log(`  [${s.index}] "${s.originalLabel}" -> "${s.suggestedLabel}"`);
      console.log(`      Reason: ${s.reason}`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
