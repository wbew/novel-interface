#!/bin/bash
# Setup script for Conductor to copy .env from Projects/novel-interface to current worktree

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_ENV="/Users/willwang/conductor/workspaces/novel-interface/Projects/novel-interface/.env"

if [ -f "$SOURCE_ENV" ]; then
  cp "$SOURCE_ENV" "$WORKTREE_ROOT/canvas/.env"
  echo "Copied .env to $WORKTREE_ROOT/canvas/.env"
else
  echo "Warning: Source .env not found at $SOURCE_ENV"
  exit 1
fi
