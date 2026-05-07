#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/.token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "Error: token file not found at $TOKEN_FILE"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

cd "$SCRIPT_DIR/.."

echo "Building production bundle..."
npm run build -- --production

echo "Publishing to VS Code Marketplace..."
npx @vscode/vsce publish --pat "$TOKEN" "$@"

echo "Done."
