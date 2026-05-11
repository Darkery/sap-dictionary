#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/.token"
ROOT="$SCRIPT_DIR/.."

# ── Token check ──────────────────────────────────────────────────────────────

if [ ! -f "$TOKEN_FILE" ]; then
  echo "Error: token file not found at $TOKEN_FILE"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

cd "$ROOT"

# ── Version bump ─────────────────────────────────────────────────────────────

CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"
echo ""
echo "Select version bump:"
echo "  1) patch  ($(npx --yes semver -i patch "$CURRENT"))"
echo "  2) minor  ($(npx --yes semver -i minor "$CURRENT"))"
echo "  3) major  ($(npx --yes semver -i major "$CURRENT"))"
echo "  4) keep   ($CURRENT — re-publish same version, will fail if already exists)"
echo ""
read -rp "Choice [1]: " CHOICE
CHOICE="${CHOICE:-1}"

case "$CHOICE" in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  4) BUMP="" ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

if [ -n "$BUMP" ]; then
  NEW_VERSION=$(npx --yes semver -i "$BUMP" "$CURRENT")
  echo ""
  echo "Bumping $CURRENT → $NEW_VERSION"

  # Update package.json version
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  # Prompt for changelog entry
  echo ""
  echo "Add a one-line summary for CHANGELOG.md (leave blank to skip):"
  read -rp "> " SUMMARY

  if [ -n "$SUMMARY" ]; then
    TODAY=$(date +%Y-%m-%d)
    ENTRY="## [$NEW_VERSION] - $TODAY\n\n### Changed\n- $SUMMARY\n\n---\n"
    # Prepend after the first line (# Changelog header)
    TMP=$(mktemp)
    awk -v entry="$ENTRY" 'NR==1{print; print ""; printf entry; next}1' CHANGELOG.md > "$TMP"
    mv "$TMP" CHANGELOG.md
  fi
fi

# ── Tests ────────────────────────────────────────────────────────────────────

echo ""
echo "Running tests..."
npm test

# ── Build & publish ───────────────────────────────────────────────────────────

echo ""
echo "Building production bundle..."
npm run build -- --production

echo ""
echo "Publishing to VS Code Marketplace..."
npx @vscode/vsce publish --pat "$TOKEN"

# ── Git commit & tag ──────────────────────────────────────────────────────────

if [ -n "$BUMP" ]; then
  FINAL_VERSION=$(node -p "require('./package.json').version")
  echo ""
  read -rp "Commit and tag v$FINAL_VERSION? [Y/n]: " DOTAG
  DOTAG="${DOTAG:-Y}"
  if [[ "$DOTAG" =~ ^[Yy]$ ]]; then
    git add package.json CHANGELOG.md
    git commit -m "Release v$FINAL_VERSION"
    git tag "v$FINAL_VERSION"
    git push && git push --tags
    echo "Tagged and pushed v$FINAL_VERSION"
  fi
fi

echo ""
echo "Done."
