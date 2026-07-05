#!/usr/bin/env bash
# publish.sh — Release KeyValuator to the public GitHub repository.
#
# What this script does:
#   1. Determines the next version tag (major or minor) based on the latest tag.
#   2. Collects release notes from the terminal.
#   3. Creates a throwaway branch from main, strips .claude (private files),
#      and force-pushes it to the public remote as main.
#   4. Creates a GitHub Release on the public repo with the new tag and notes.
#   5. Tags the private repo's main for internal version tracking.
#   6. Cleans up all throwaway branches and returns you to your working branch.
#
# Requirements: git, gh (GitHub CLI), authenticated via `gh auth login`.

set -euo pipefail

PRIVATE_REMOTE="origin"
PUBLIC_REMOTE="public"
PUBLIC_REPO="xofolowski/KeyValuator"
PRIVATE_REPO="xofolowski/KeyValuator-dev"
RELEASE_BRANCH="_release"   # throwaway branch name, never pushed to origin

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}▸${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}✓${RESET} $*"; }
abort()   { echo -e "${RED}${BOLD}✗${RESET} $*"; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || abort "gh CLI not found. Install with: brew install gh"
command -v git >/dev/null 2>&1 || abort "git not found."

# Refuse to run with uncommitted changes — a dirty tree would be misleading.
if ! git diff --quiet || ! git diff --cached --quiet; then
  abort "You have uncommitted changes. Commit or stash them before publishing."
fi

# ── Determine next version ────────────────────────────────────────────────────
# Read the highest vMAJOR.MINOR.PATCH tag; default to v0.0.0 if none exist.
LATEST_TAG=$(git tag --sort=-version:refname 2>/dev/null \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)
LATEST_TAG="${LATEST_TAG:-v0.0.0}"

# Strip the leading 'v' and split into components.
VERSION="${LATEST_TAG#v}"
MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)

echo ""
echo -e "${BOLD}KeyValuator — Release Publisher${RESET}"
echo "──────────────────────────────────────"
echo "  Current latest release: ${LATEST_TAG}"
echo ""
echo "  Release type:"
echo "    1) Minor  →  v${MAJOR}.$((MINOR + 1)).0   (new features, improvements)"
echo "    2) Major  →  v$((MAJOR + 1)).0.0   (breaking changes, major milestones)"
echo ""
read -rp "  Choose [1/2]: " RELEASE_TYPE

case "$RELEASE_TYPE" in
  1) NEW_TAG="v${MAJOR}.$((MINOR + 1)).0" ;;
  2) NEW_TAG="v$((MAJOR + 1)).0.0" ;;
  *) abort "Invalid choice." ;;
esac

echo ""
echo "  New version: ${BOLD}${NEW_TAG}${RESET}"

# ── Collect release notes ─────────────────────────────────────────────────────
echo ""
echo "  Release notes — describe what changed (blank line to finish):"
echo ""
LINES=()
while true; do
  printf "  > "
  IFS= read -r line || break
  [[ -z "$line" ]] && break
  LINES+=("$line")
done

if [[ ${#LINES[@]} -eq 0 ]]; then
  abort "Release notes cannot be empty."
fi

RELEASE_NOTES=$(printf '%s\n' "${LINES[@]}")

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────"
echo -e "  Version:  ${BOLD}${NEW_TAG}${RESET}"
echo "  Notes:"
while IFS= read -r note_line; do
  echo "    ${note_line}"
done <<< "$RELEASE_NOTES"
echo "──────────────────────────────────────"
echo ""
read -rp "  Publish to https://github.com/${PUBLIC_REPO}? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── Remember current branch so we can return to it ───────────────────────────
ORIGINAL_BRANCH=$(git symbolic-ref --short HEAD)

# ── Ensure main is current ────────────────────────────────────────────────────
echo ""
info "Updating main from ${PRIVATE_REMOTE}..."
git checkout main --quiet
git pull "$PRIVATE_REMOTE" main --quiet

# ── Build the stripped release branch ────────────────────────────────────────
info "Creating release branch..."
git checkout -b "$RELEASE_BRANCH" --quiet

info "Stripping private files (.claude)..."
git rm --cached -r .claude --quiet
git commit -m "chore: prepare public release ${NEW_TAG}

Strips .claude (private project files) before publishing." --quiet

# ── Push to public repo ───────────────────────────────────────────────────────
info "Pushing to ${PUBLIC_REPO}..."
git push "$PUBLIC_REMOTE" "${RELEASE_BRANCH}:main" --force --quiet

# ── Create GitHub Release (also creates the tag on public repo) ───────────────
info "Creating GitHub Release ${NEW_TAG}..."
gh release create "$NEW_TAG" \
  --repo "$PUBLIC_REPO" \
  --title "$NEW_TAG" \
  --notes "$RELEASE_NOTES" \
  --target main

# ── Tag the private repo's main for internal version tracking ─────────────────
info "Tagging private repo..."
git checkout main --quiet
git tag "$NEW_TAG" -m "Release ${NEW_TAG}"
git push "$PRIVATE_REMOTE" "$NEW_TAG" --quiet

# ── Tidy up ───────────────────────────────────────────────────────────────────
info "Cleaning up..."
git branch -D "$RELEASE_BRANCH" --quiet
git checkout "$ORIGINAL_BRANCH" --quiet

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
success "Published ${BOLD}${NEW_TAG}${RESET}"
echo ""
echo "  Public release: https://github.com/${PUBLIC_REPO}/releases/tag/${NEW_TAG}"
echo "  Private repo:   https://github.com/${PRIVATE_REPO}/tree/main"
echo ""
