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
    TMP=$(mktemp)
    awk -v entry="$ENTRY" 'NR==1{print; print ""; printf entry; next}1' CHANGELOG.md > "$TMP"
    mv "$TMP" CHANGELOG.md
  fi
fi

# ── Tests ────────────────────────────────────────────────────────────────────

echo ""
echo "Running tests..."
npm test

# ── Build & publish to Marketplace ───────────────────────────────────────────

echo ""
echo "Building production bundle..."
npm run build -- --production

echo ""
echo "Publishing to VS Code Marketplace..."
npx @vscode/vsce publish --pat "$TOKEN"

# ── Package VSIX ─────────────────────────────────────────────────────────────

FINAL_VERSION=$(node -p "require('./package.json').version")
VSIX="sap-dictionary-${FINAL_VERSION}.vsix"

echo ""
echo "Packaging VSIX..."
npx @vscode/vsce package --out "$VSIX"

# ── Git commit, tag & push ────────────────────────────────────────────────────

if [ -n "$BUMP" ]; then
  echo ""
  read -rp "Commit, tag and push v$FINAL_VERSION? [Y/n]: " DOTAG
  DOTAG="${DOTAG:-Y}"
  if [[ "$DOTAG" =~ ^[Yy]$ ]]; then
    git add package.json CHANGELOG.md
    git commit -m "Release v$FINAL_VERSION"
    git tag "v$FINAL_VERSION"
    git push && git push --tags
    echo "Tagged and pushed v$FINAL_VERSION"
  fi
fi

# ── GitHub Release ────────────────────────────────────────────────────────────

if command -v gh &>/dev/null; then
  echo ""
  read -rp "Create GitHub release for v$FINAL_VERSION? [Y/n]: " DORELEASE
  DORELEASE="${DORELEASE:-Y}"
  if [[ "$DORELEASE" =~ ^[Yy]$ ]]; then
    # Extract this version's section from CHANGELOG.md
    NOTES=$(awk "/^## \[$FINAL_VERSION\]/{found=1; next} found && /^## \[/{exit} found{print}" CHANGELOG.md | sed '/^---$/d' | sed '/^$/N;/^\n$/d')

    gh release create "v$FINAL_VERSION" "$VSIX" \
      --title "v$FINAL_VERSION" \
      --notes "$NOTES"

    echo "GitHub release created: v$FINAL_VERSION"
  fi
else
  echo ""
  echo "Note: 'gh' not found — skipping GitHub release. Install with: brew install gh"
fi

echo ""
echo "Done."
