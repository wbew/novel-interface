# Gemini Vision API Pattern

Call Gemini with image input for UI analysis tasks.

## Usage

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Extract base64 from data URL
const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
const base64Data = base64Match[1];

const response = await model.generateContent([
  prompt,
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Data,
    },
  },
]);
```

## JSON Response Parsing

Gemini often wraps JSON in code blocks. Handle both formats:

```typescript
const text = response.response.text();
const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\[[\s\S]*\]/);

if (jsonMatch) {
  const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
}
```

## Prompt Structure for UI Analysis

When analyzing UI screenshots with numbered annotations:
1. Describe the task (categorize elements, suggest labels)
2. Provide context (what the numbered boxes represent)
3. Specify exact JSON response format
4. Include confidence levels for reliability assessment

## Reference

See `background.ts:60-98` for the full Gemini prompt and `background.ts:174-239` for the API call implementation.
