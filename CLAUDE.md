# CMDK Project Conventions

## Package Manager

Use `bun` instead of `npm` for all commands (e.g., `bun run build`, `bun install`).

## Architecture

- **Library** (`src/lib.ts`): Browser-agnostic core logic (action scanning, execution, filtering)
- **Extension** (`src/content.tsx`, `src/background.ts`): Chrome-specific integration using the library

## Code Style

- Keep components in a single file - avoid premature splitting
- For now, this is just an extension (no `clients/` folder yet)
- Split files only when there's a clear, demonstrated need

## Environment Variables

- Store API keys in environment variables (e.g., `GEMINI_API_KEY` via `process.env`)
- Never commit secrets to the repository

## Scripts

- `scripts/experiment-label/`: Playwright-based experiments for analyzing and improving action labels using Gemini

## Future Vision

The library is designed to enable autonomous execution mode where the background script orchestrates tab navigation and sends instructions to content scripts, leveraging the user's authenticated browser session.
