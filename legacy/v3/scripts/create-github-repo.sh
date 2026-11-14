#!/bin/sh
# Usage: ./scripts/create-github-repo.sh [YOUR_GITHUB_OWNER] [private|public]
# Requires Git and authenticated GitHub CLI. Safe by default: refuses overwriting any repo.
set -eu
OWNER="${1:-}"
VISIBILITY="${2:-private}"
REPO="tender-atlas"
case "$VISIBILITY" in private|public) ;; *) echo 'Choose private or public' >&2; exit 2;; esac
command -v gh >/dev/null 2>&1 || { echo 'GitHub CLI not installed: https://cli.github.com/' >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo 'Log in with: gh auth login' >&2; exit 1; }
if [ -z "$OWNER" ]; then OWNER="$(gh api user --jq '.login')"; fi
if [ -z "$OWNER" ]; then echo 'Unable to determine active GitHub owner' >&2; exit 1; fi
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then echo "Repository $OWNER/$REPO already exists. No change made." >&2; exit 1; fi
if [ ! -d .git ]; then git init -b main; fi
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  git add .
  git commit -m 'Initial production-minded TenderAtlas application'
else
  if [ -n "$(git status --porcelain)" ]; then echo 'Uncommitted changes present. Commit or stash first.' >&2; exit 1; fi
fi
if git remote get-url origin >/dev/null 2>&1; then echo 'Existing origin found. No remote changed.' >&2; exit 1; fi
if [ "$VISIBILITY" = public ]; then FLAG='--public'; else FLAG='--private'; fi
gh repo create "$OWNER/$REPO" "$FLAG" --source=. --remote=origin --push
printf '\nRepository: https://github.com/%s/%s\n' "$OWNER" "$REPO"
