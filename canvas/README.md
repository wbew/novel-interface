# Canvas

An infinite canvas application with URL expansion capabilities built on TanStack Start and tldraw.

## Features

- **Infinite Canvas**: Pan, zoom, and organize content freely using tldraw
- **URL Expansion**: Drop URLs onto the canvas and expand them into:
  - **API Block**: Discovers API endpoints by monitoring network requests
  - **Content Block**: Extracts page structure (headings, links, images, videos) with AI-powered summaries

## Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React + file-based routing + server functions)
- **Canvas**: [tldraw](https://tldraw.dev/) v3
- **Browser Automation**: [Playwright](https://playwright.dev/) for headless content extraction
- **AI Summaries**: [Google Generative AI](https://ai.google.dev/) (Gemini) - optional

## Getting Started

```bash
# Install dependencies
bun install

# Install Playwright browsers (first time only)
bunx playwright install chromium

# Start development server
bun run dev
```

Open http://localhost:3000 to view the canvas.

## Usage

1. **Add a URL**: Drag and drop a URL onto the canvas, or paste a URL
2. **Expand to API**: Click the "API" button to discover API endpoints the page uses
3. **Expand to Content**: Click the "Content" button to extract page content and videos

### Content Extraction

When you click "Content" on a URL, the system:
1. Loads the page in a headless browser
2. Extracts structured content: headings (h1-h3), links, images, and videos
3. Generates an AI summary using Gemini (if `GEMINI_API_KEY` is set)
4. Displays the content grouped by type with visual indicators

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Generative AI API key for content summarization | No |

## Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
bun run test:coverage # Run tests with coverage
```

## Architecture

```
canvas/src/
├── routes/
│   └── index.tsx           # Main canvas page with tldraw setup
├── shapes/
│   ├── url-shape/          # URL preview shape with expand buttons
│   ├── api-block/          # Displays discovered API endpoints
│   └── content-block/      # Displays page content and videos
└── server/
    ├── api-discovery.ts    # Playwright network monitoring
    ├── content-extraction.ts # Playwright content extraction
    └── expand-url.ts       # TanStack Start server functions
```

### Custom Shapes

| Shape | Description |
|-------|-------------|
| `url` | URL preview card with "API" and "Content" expand buttons |
| `api-block` | List of discovered API endpoints with method, URL, and response preview |
| `content-block` | Page summary with extracted headings, links, images, and videos |

### Server Functions

| Function | Description |
|----------|-------------|
| `expandToApi` | Launches headless browser, monitors network requests, returns discovered endpoints |
| `expandToContent` | Launches headless browser, extracts page content, returns summary and videos |

## Tests

Tests use [Vitest](https://vitest.dev/) and cover:

- **Type definitions**: Shape type structure validation
- **API Discovery**: Endpoint detection, filtering, error handling
- **Content Extraction**: Generic content extraction, heading/link/image/video parsing

```bash
bun run test
```

Note: Integration tests require network access and may take 3-5 minutes due to Playwright browser automation.

## Development Notes

- tldraw requires browser APIs; components are client-only rendered
- Playwright is excluded from client bundles via Vite config
- Server functions run on the server via TanStack Start's `createServerFn`
